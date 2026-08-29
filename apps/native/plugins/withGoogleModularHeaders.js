const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * GoogleSignIn이 끌어오는 `AppCheckCore`는 Swift pod인데, 그 의존인
 * `GoogleUtilities`/`RecaptchaInterop`이 모듈맵을 정의하지 않아
 * 정적 라이브러리로 통합될 수 없다 → `pod install` 실패.
 *
 *   [!] The following Swift pods cannot yet be integrated as static libraries:
 *   The Swift pod `AppCheckCore` depends upon `GoogleUtilities` and
 *   `RecaptchaInterop`, which do not define modules.
 *
 * ios/는 gitignore라 EAS가 매번 prebuild + pod install을 하고,
 * Podfile.lock이 없어 pod 최신 버전으로 해석된다. 그래서 코드 변경이 없어도
 * 의존 pod가 올라가면 어느 날 갑자기 깨진다 (v1.2.2는 통과, v1.2.3에서 실패).
 *
 * 해당 pod들에만 modular headers를 켜서 해결한다.
 * `use_modular_headers!` 전역 적용은 다른 pod까지 영향을 주므로 쓰지 않는다.
 */
const INJECT_TAG = '[withGoogleModularHeaders]';
const ANCHOR = /(target '[^']+' do\n\s*use_expo_modules!\n)/;
const SNIPPET = `
  # ${INJECT_TAG} AppCheckCore(Swift pod)의 정적 라이브러리 통합을 위해
  # 모듈맵이 없는 의존 pod에 modular headers를 켠다.
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true
`;

module.exports = function withGoogleModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );
      const podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes(INJECT_TAG)) {
        return config;
      }
      if (!ANCHOR.test(podfile)) {
        throw new Error(
          `withGoogleModularHeaders: Podfile에서 target/use_expo_modules! 앵커를 찾지 못했습니다 (${podfilePath})`
        );
      }

      fs.writeFileSync(podfilePath, podfile.replace(ANCHOR, `$1${SNIPPET}`));
      return config;
    },
  ]);
};
