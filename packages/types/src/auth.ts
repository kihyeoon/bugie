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
}

export interface Session extends SupabaseSession {
  // Supabase Session 타입 확장
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  needsProfile: boolean;
}

export type OAuthProvider = "google" | "apple" | "kakao";

export interface AuthError {
  message: string;
  status?: number;
  code?: string;
}
