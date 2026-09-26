/**
 * 앱 버전 정책 (BGI-52)
 * 운영자가 플랫폼별로 직접 관리하는 값. 비어 있는 항목은 해당 안내를 하지 않는다는 뜻이다.
 */
export interface AppVersionPolicy {
  /** 이 버전보다 낮으면 업데이트를 권한다. 기능을 알리고 싶을 때만 채운다. */
  recommendedVersion: string | null;
  /** 권장 안내 본문. 비어 있으면 앱의 기본 문구를 쓴다. */
  recommendedMessage: string | null;
  /** 이 버전보다 낮으면 앱 사용을 막는다. */
  minSupportedVersion: string | null;
}

export type UpdatePrompt =
  | { type: 'none' }
  | { type: 'recommended'; version: string; message: string | null }
  | { type: 'required' };

export interface AppVersionPolicyRepository {
  findByPlatform(platform: string): Promise<AppVersionPolicy | null>;
}
