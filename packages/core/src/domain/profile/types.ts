import type { EntityId, DomainDate } from '../shared/types';

/**
 * 프로필 엔티티
 * 사용자의 프로필 정보를 나타내는 도메인 모델
 */
export interface ProfileEntity {
  id: EntityId;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  currency: string;
  timezone: string;
  createdAt: DomainDate;
  updatedAt: DomainDate;
  isDeleted: boolean;
}

/**
 * 프로필 리포지토리 인터페이스
 * 프로필 데이터 접근을 추상화
 */
export interface ProfileRepository {
  findById(id: EntityId): Promise<ProfileEntity | null>;
  update(id: EntityId, data: Partial<ProfileEntity>): Promise<ProfileEntity>;
  delete(id: EntityId): Promise<void>;
  
  // 프로필 soft delete (회원 탈퇴 시)
  softDelete(userId: EntityId): Promise<void>;
}

/**
 * 프로필 업데이트 입력
 */
export interface UpdateProfileData {
  fullName?: string;
  avatarUrl?: string | null;
  currency?: string;
  timezone?: string;
}