import type { User as SupabaseUser, Session as SupabaseSession } from "@supabase/supabase-js";

export interface User extends SupabaseUser {
  // Supabase User 타입 확장
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url?: string | null;
  currency: string | null;
  timezone: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at?: string | null;
  /** 닉네임 설정 완료 시각. 이 컬럼이 생기기 전에 저장된 프로필 캐시에는 키가 없다(undefined). */
  onboarded_at?: string | null;
}

export interface Session extends SupabaseSession {
  // Supabase Session 타입 확장
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: Error | null;
}

export type OAuthProvider = "google" | "apple" | "kakao";

export interface AuthError {
  message: string;
  status?: number;
  code?: string;
}
