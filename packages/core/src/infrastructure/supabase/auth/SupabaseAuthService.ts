import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthService, CurrentUser } from '../../../domain/auth/types';

/**
 * Supabase를 사용한 인증 서비스 구현
 */
export class SupabaseAuthService implements AuthService {
  constructor(private supabase: SupabaseClient) {}

  async getCurrentUser(): Promise<CurrentUser | null> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || '',
    };
  }

  /**
   * 로그아웃
   */
  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      // AuthSessionMissingError는 이미 로그아웃된 상태이므로 정상으로 처리
      if (error.message?.includes('Auth session missing')) {
        return;
      }
      throw new Error(`로그아웃 실패: ${error.message}`);
    }
  }

  /**
   * 회원 탈퇴 (계정 삭제)
   */
  async deleteAccount(): Promise<void> {
    const {
      data: { user },
      error: getUserError,
    } = await this.supabase.auth.getUser();

    if (getUserError || !user) {
      throw new Error('인증된 사용자를 찾을 수 없습니다.');
    }

    // Supabase Admin API를 통한 사용자 삭제는 서버 사이드에서만 가능
    // 클라이언트에서는 soft delete로 처리
    const { error: deleteError } = await this.supabase
      .from('profiles')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (deleteError) {
      throw new Error(`계정 삭제 실패: ${deleteError.message}`);
    }

    // 로그아웃 처리
    await this.signOut();
  }
}
