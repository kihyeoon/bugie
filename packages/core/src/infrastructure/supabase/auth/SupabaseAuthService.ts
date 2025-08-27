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

}
