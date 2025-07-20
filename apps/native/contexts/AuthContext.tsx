import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import type {
  AuthState,
  OAuthProvider,
  AuthProfile as Profile,
} from '@repo/types';
import { supabase, getOAuthRedirectUrl } from '../utils/supabase';

interface AuthContextValue extends AuthState {
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    needsProfile: false,
  });

  // 프로필 데이터 가져오기
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, []);

  // 세션 체크 및 초기화
  useEffect(() => {
    // 기존 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id).then((profile) => {
          setAuthState({
            user: session.user,
            profile,
            session,
            loading: false,
            needsProfile: !profile?.full_name,
          });
        });
      } else {
        setAuthState((prev: AuthState) => ({ ...prev, loading: false }));
      }
    });

    // 인증 상태 변경 리스너
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const profile = await fetchProfile(session.user.id);
          setAuthState({
            user: session.user,
            profile,
            session,
            loading: false,
            needsProfile: !profile?.full_name,
          });
        } else if (event === 'SIGNED_OUT') {
          setAuthState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            needsProfile: false,
          });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setAuthState((prev: AuthState) => ({ ...prev, session }));
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // OAuth 로그인
  const signInWithOAuth = useCallback(async (provider: OAuthProvider) => {
    try {
      const redirectTo = getOAuthRedirectUrl();

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      // OAuth URL을 브라우저에서 열기
      const { data } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });

      if (data?.url) {
        await Linking.openURL(data.url);
      }
    } catch (error: any) {
      Alert.alert(
        '로그인 오류',
        error.message || '로그인 중 오류가 발생했습니다.'
      );
    }
  }, []);

  // 로그아웃
  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      Alert.alert(
        '로그아웃 오류',
        error.message || '로그아웃 중 오류가 발생했습니다.'
      );
    }
  }, []);

  // 프로필 업데이트
  const updateProfile = useCallback(
    async (data: Partial<Profile>) => {
      if (!authState.user) return;

      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', authState.user.id);

        if (error) throw error;

        // 프로필 다시 가져오기
        const updatedProfile = await fetchProfile(authState.user.id);
        setAuthState((prev: AuthState) => ({
          ...prev,
          profile: updatedProfile,
          needsProfile: false,
        }));
      } catch (error: any) {
        Alert.alert(
          '프로필 업데이트 오류',
          error.message || '프로필 업데이트 중 오류가 발생했습니다.'
        );
      }
    },
    [authState.user, fetchProfile]
  );

  // 세션 갱신
  const refreshSession = useCallback(async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();
      if (error) throw error;

      if (session) {
        setAuthState((prev: AuthState) => ({ ...prev, session }));
      }
    } catch (error) {
      console.error('Session refresh error:', error);
    }
  }, []);

  const value: AuthContextValue = {
    ...authState,
    signInWithOAuth,
    signOut,
    updateProfile,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
