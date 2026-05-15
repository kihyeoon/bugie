const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * fmt 11.0.2(React Native 0.79.x 번들)의 consteval format-string 생성자가
 * Apple clang(Xcode 26.3+)의 엄격한 검사에서 컴파일 실패한다.
 *
 * Podfile의 post_install에 패치 스크립트(fmt-consteval-fix.rb)를 주입해,
 * pod install 직후 fmt 헤더의 FMT_USE_CONSTEVAL을 0으로 강제한다.
 * prebuild로 ios/가 재생성돼도 매번 자동 적용된다.
 *
 * EAS production 빌드(Xcode 26.2)는 원래 통과하므로 영향 없다(idempotent).
 */
const INJECT_TAG = '[withFmtConstevalFix]';
const POST_INSTALL_ANCHOR = /post_install do \|[^|]*\|\n/;
const RUBY_SNIPPET = fs.readFileSync(
  path.join(__dirname, 'fmt-consteval-fix.rb'),
  'utf8'
);

module.exports = function withFmtConstevalFix(config) {
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
      if (!POST_INSTALL_ANCHOR.test(podfile)) {
        throw new Error(
          `withFmtConstevalFix: Podfile에서 post_install 블록을 찾지 못해 패치를 주입할 수 없습니다 (${podfilePath})`
        );
      }

      fs.writeFileSync(
        podfilePath,
        podfile.replace(POST_INSTALL_ANCHOR, (anchor) => anchor + RUBY_SNIPPET)
      );
      return config;
    },
  ]);
};
