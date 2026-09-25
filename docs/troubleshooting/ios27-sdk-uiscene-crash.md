# Xcode 27로 빌드하면 앱이 켜지자마자 꺼지는 문제

## 📋 한 줄 요약

**새 Xcode(27)로 빌드한 앱은 새 규칙(UIScene)을 지켜야 실행되는데, Expo가 아직 그 규칙을 지원하지 않는다.**
그래서 Expo가 지원할 때까지는 옛 Xcode(26)로 빌드해야 한다.

## 🧩 등장하는 것들

| 이름 | 한마디로 | 비유 |
|---|---|---|
| **iOS** | 아이폰에 깔린 운영체제. 지금 폰은 iOS 27 | 앱이 사는 집 |
| **Xcode** | 애플이 주는 앱 빌드 도구. Mac에 설치 | 앱을 만드는 공장 |
| **iOS SDK** | Xcode 안에 들어 있는 "이 버전 iOS의 규칙 모음". Xcode 26엔 SDK 26, Xcode 27엔 SDK 27 | 공장에 붙은 건축 규정집 |
| **AppDelegate / UIScene** | 앱이 켜질 때 iOS와 대화하는 방식. AppDelegate가 옛 방식, UIScene이 새 방식 | 집에 들어가는 문 |
| **Expo prebuild** | 우리 설정(`app.json`)을 보고 iOS 네이티브 코드(`ios/` 폴더)를 대신 만들어 준다. 우리는 이 코드를 직접 쓰지 않는다 | 설계도를 대신 그려주는 건축사 |
| **EAS 클라우드 빌드** | Expo 서버의 Mac에서 빌드. 서버엔 Xcode 26.6이 깔려 있다 | 외주 공장 |
| **로컬 빌드** (`eas build --local`) | 같은 과정을 내 Mac에서. 내 Mac엔 Xcode 27이 깔려 있다 | 우리 집 공장 |

## 🔍 왜 꼬였나

1. 애플이 규칙을 바꿨다: **"SDK 27로 빌드한 앱은 새 문(UIScene)으로만 들어올 수 있다."**
   옛 문(AppDelegate)만 있는 앱은 iOS 27이 켜자마자 강제로 종료한다. 애플이 1년 전부터 예고했던 변경이다.
2. 그런데 SDK 26으로 빌드한 앱은 이 검사를 받지 않는다. 옛 규정집으로 지은 집은 옛 문으로도 들어갈 수 있다.
3. Bugie의 네이티브 코드는 Expo가 만들어 주는데, **Expo SDK 57은 아직 옛 문(AppDelegate)만 만든다.**
   Expo 코드에 `// TODO: - Configuring and Discarding Scenes`라고 적혀 있다(`ExpoAppDelegate.swift`).
4. 그래서 결과가 갈렸다.

| 빌드 | 어디서 | Xcode / SDK | 새 문(UIScene) | iOS 27 폰에서 |
|---|---|---|---|---|
| 21 | EAS 클라우드 | 26.6 / 26.5 | 없음 | ✅ 정상 (옛 규정이라 검사 안 받음) |
| 24 | 내 Mac | **27.0 / 27.0** | 없음 | ❌ 켜자마자 종료 |

코드는 똑같았다. **어떤 공장(Xcode)에서 지었느냐**만 달랐다. 그래서 1.5.0은 같은 커밋을 클라우드로 다시 빌드했다(빌드 25).

## 🕵️ 어떻게 알아냈나

- 폰을 USB로 연결하고 크래시 로그를 가져왔다.
  ```bash
  xcrun devicectl list devices
  xcrun devicectl device copy from --device <UDID> --domain-type systemCrashLogs --source / --destination ./crash
  ```
- 로그에 찍힌 위치가 이름부터 답이었다: `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`
  ("Scene 라이프사이클을 채택하지 않았음을 검사하는 곳")
- 두 빌드의 `Info.plist`를 비교했다. 21은 `DTSDKName = iphoneos26.5`, 24는 `iphoneos27.0`. 둘 다 `UIApplicationSceneManifest`(새 문) 없음.
  ```bash
  unzip -p app.ipa 'Payload/Bugie.app/Info.plist' > /tmp/i.plist
  /usr/libexec/PlistBuddy -c 'Print DTSDKName' -c 'Print UIApplicationSceneManifest' /tmp/i.plist
  ```

크래시가 JS가 뜨기도 전(스플래시 단계)에 나서 JS 로그로는 보이지 않는다. **기기 크래시 로그를 봐야 한다.**

## ✅ 그래서 어떻게 하나

| 언제 | 할 일 |
|---|---|
| 지금 | **EAS 클라우드로 빌드한다**(Xcode 26.6). 업로드 큐가 느리면 `--auto-submit` 없이 빌드하고 `.ipa`를 받아 Transporter로 올린다 |
| 지금 (안전장치) | `eas.json`에 Xcode 26 이미지를 고정한다. EAS가 기본 Xcode를 27로 바꾸면 클라우드 빌드도 똑같이 죽기 때문 |
| Expo가 UIScene을 지원하면 | 그 SDK로 업그레이드 → 딥링크·소셜 로그인·스플래시 확인 → Xcode 27 빌드 가능 |
| 시한 | App Store가 iOS 27 SDK를 필수로 요구하기 전(애플은 보통 이듬해 봄). 그 뒤엔 Xcode 26 빌드를 받아주지 않는다 |

로컬 빌드가 꼭 필요하면 Xcode 26.6을 따로 설치하고 그 빌드만 옛 Xcode로 돌리면 된다(여러 버전을 함께 설치할 수 있다).

```bash
DEVELOPER_DIR=/Applications/Xcode-26.6.app/Contents/Developer npx eas-cli build --platform ios --profile production --local --non-interactive
```

추적: Linear **BGI-50**

## 📎 덤: 같은 날 겪은 작은 함정들

- **fastlane을 설치했더니 CocoaPods가 고장 났다.** `brew install fastlane`이 Ruby를 새 버전(4.0.7)으로 올렸다.
  CocoaPods는 옛 Ruby 기준으로 설치돼 있어 필요한 부품(`ffi`)을 못 찾았다. → `brew reinstall cocoapods`로 해결
- **`!`로 실행한 로컬 빌드는 `--non-interactive`가 필요하다.** 입력을 받을 수 없어서 "애플 계정 로그인할까요?" 질문에서 멈춘다
- **빌드가 실패해도 빌드 번호는 올라간다.** EAS가 번호를 먼저 올리고 빌드를 시작하기 때문. 그래서 22·23은 빈 번호가 됐다. App Store는 번호가 커지기만 하면 되니 문제없다
- **로컬 빌드 로그엔 배포 인증서가 base64로 찍힌다.** 로그를 공유하지 말 것
