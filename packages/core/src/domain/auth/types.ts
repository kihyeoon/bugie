import type { EntityId } from '../shared/types';

/**
 * 현재 사용자 정보
 */
export interface CurrentUser {
  id: EntityId;
  email: string;
}

/**
 * 인증 서비스 인터페이스 (의존성 역전)
 */
export interface AuthService {
  getCurrentUser(): Promise<CurrentUser | null>;
}
