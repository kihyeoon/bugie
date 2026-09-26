import { describe, expect, it } from 'vitest';
import { AppVersionRules } from './rules';
import type { AppVersionPolicy } from './types';

const EMPTY_POLICY: AppVersionPolicy = {
  recommendedVersion: null,
  recommendedMessage: null,
  minSupportedVersion: null,
};

function policy(overrides: Partial<AppVersionPolicy>): AppVersionPolicy {
  return { ...EMPTY_POLICY, ...overrides };
}

describe('AppVersionRules.compare', () => {
  it('세그먼트를 숫자로 비교한다', () => {
    expect(AppVersionRules.compare('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(AppVersionRules.compare('1.9.0', '1.10.0')).toBeLessThan(0);
  });

  it('앞 세그먼트가 우선한다', () => {
    expect(AppVersionRules.compare('2.0.0', '1.99.99')).toBeGreaterThan(0);
  });

  it('같은 버전은 0', () => {
    expect(AppVersionRules.compare('1.5.1', '1.5.1')).toBe(0);
  });

  it('형식이 이상하면 비교할 수 없다(null)', () => {
    expect(AppVersionRules.compare('1.6', '1.5.0')).toBeNull();
    expect(AppVersionRules.compare('1.5.0', '1.6.0 ')).toBeNull();
    expect(AppVersionRules.compare('v1.5.0', '1.5.0')).toBeNull();
  });
});

describe('AppVersionRules.evaluate', () => {
  it('정책이 없으면 none', () => {
    expect(AppVersionRules.evaluate('1.5.0', null)).toEqual({ type: 'none' });
  });

  it('값이 모두 비어 있으면 none', () => {
    expect(AppVersionRules.evaluate('1.5.0', EMPTY_POLICY)).toEqual({
      type: 'none',
    });
  });

  it('현재 버전을 모르면 none', () => {
    expect(
      AppVersionRules.evaluate(
        undefined,
        policy({ minSupportedVersion: '9.9.9' })
      )
    ).toEqual({ type: 'none' });
  });

  it('최소 지원 버전보다 낮으면 required', () => {
    expect(
      AppVersionRules.evaluate('1.5.0', policy({ minSupportedVersion: '1.5.1' }))
    ).toEqual({ type: 'required' });
  });

  it('최소 지원 버전과 같으면 막지 않는다', () => {
    expect(
      AppVersionRules.evaluate('1.5.1', policy({ minSupportedVersion: '1.5.1' }))
    ).toEqual({ type: 'none' });
  });

  it('권장 버전보다 낮으면 recommended — 버전과 문구를 함께 준다', () => {
    expect(
      AppVersionRules.evaluate(
        '1.5.0',
        policy({ recommendedVersion: '1.6.0', recommendedMessage: '검색 추가' })
      )
    ).toEqual({ type: 'recommended', version: '1.6.0', message: '검색 추가' });
  });

  it('권장 버전 이상이면 none', () => {
    expect(
      AppVersionRules.evaluate('1.6.0', policy({ recommendedVersion: '1.6.0' }))
    ).toEqual({ type: 'none' });
  });

  it('강제와 권장이 둘 다 해당하면 required가 우선한다', () => {
    expect(
      AppVersionRules.evaluate(
        '1.5.0',
        policy({ recommendedVersion: '1.6.0', minSupportedVersion: '1.6.0' })
      )
    ).toEqual({ type: 'required' });
  });

  it('형식이 이상한 값은 그 규칙만 무시한다', () => {
    expect(
      AppVersionRules.evaluate(
        '1.5.0',
        policy({ recommendedVersion: '1.6.0', minSupportedVersion: '1.6' })
      )
    ).toEqual({ type: 'recommended', version: '1.6.0', message: null });
  });
});
