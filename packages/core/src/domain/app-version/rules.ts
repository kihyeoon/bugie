import type { AppVersionPolicy, UpdatePrompt } from './types';

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * 앱 버전 정책 규칙 (BGI-52)
 *
 * 버전 확인이 앱을 잘못 막는 일이 없도록 판단할 수 없는 경우는 전부 'none'으로 통과시킨다(fail-open).
 */
export class AppVersionRules {
  /**
   * 두 버전을 세그먼트 단위 숫자로 비교한다. 문자열 비교는 '1.10.0' < '1.9.0'이 된다.
   * 형식이 MAJOR.MINOR.PATCH가 아니면 비교할 수 없어 null.
   */
  static compare(a: string, b: string): number | null {
    const left = AppVersionRules.parse(a);
    const right = AppVersionRules.parse(b);
    if (!left || !right) {
      return null;
    }

    for (let i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) {
        return left[i] - right[i];
      }
    }
    return 0;
  }

  static evaluate(
    currentVersion: string | undefined,
    policy: AppVersionPolicy | null
  ): UpdatePrompt {
    if (!currentVersion || !policy) {
      return { type: 'none' };
    }

    if (AppVersionRules.isBelow(currentVersion, policy.minSupportedVersion)) {
      return { type: 'required' };
    }

    if (
      policy.recommendedVersion &&
      AppVersionRules.isBelow(currentVersion, policy.recommendedVersion)
    ) {
      return {
        type: 'recommended',
        version: policy.recommendedVersion,
        message: policy.recommendedMessage,
      };
    }

    return { type: 'none' };
  }

  private static isBelow(current: string, target: string | null): boolean {
    if (!target) {
      return false;
    }
    const result = AppVersionRules.compare(current, target);
    return result !== null && result < 0;
  }

  private static parse(version: string): number[] | null {
    const match = VERSION_PATTERN.exec(version);
    return match ? match.slice(1).map(Number) : null;
  }
}
