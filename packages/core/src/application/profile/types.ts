/**
 * 프로필 업데이트 입력
 */
export interface UpdateProfileInput {
  fullName?: string;
  avatarUrl?: string | null;
  currency?: string;
  timezone?: string;
}

/**
 * 회원 탈퇴 입력
 */
export interface DeleteAccountInput {
  userId: string;
  confirmText?: string;
}

/**
 * 프로필 상세 정보
 */
export interface ProfileDetail {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  currency: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;

  // 추가 정보
  ownedLedgerCount?: number;
  sharedLedgerCount?: number;
  ownedLedgersWithOtherMembers?: number; // 다른 멤버가 있는 소유 가계부 수
}
