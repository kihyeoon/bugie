# [withFmtConstevalFix] config plugin이 주입함 — Podfile을 직접 수정하지 말 것
#
# fmt 11.0.2의 base.h는 FMT_USE_CONSTEVAL을 #ifndef 없이 재정의하므로
# 커맨드라인 -D로는 못 막는다. consteval format-string 생성자가
# Apple clang(Xcode 26.3+)에서 컴파일 실패해, 헤더를 직접 패치한다.
fmt_base = File.join(__dir__, 'Pods/fmt/include/fmt/base.h')
if File.exist?(fmt_base)
  contents = File.read(fmt_base)
  marker = "// [withFmtConstevalFix] force-disable fmt consteval\n"
  unless contents.include?(marker)
    anchor = "#if FMT_USE_CONSTEVAL\n"
    patched = contents.sub(
      anchor,
      "#{marker}#undef FMT_USE_CONSTEVAL\n#define FMT_USE_CONSTEVAL 0\n#{anchor}"
    )
    if patched == contents
      raise '[withFmtConstevalFix] fmt base.h anchor를 찾지 못함 — fmt 버전 변경 가능성, 플러그인 갱신 필요'
    end
    File.chmod(0644, fmt_base) # CocoaPods가 설치한 헤더는 read-only일 수 있음
    File.write(fmt_base, patched)
  end
end
