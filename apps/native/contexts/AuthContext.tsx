import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Alert } from 'react-native';
import type {
  AuthState,
  AuthProfile as Profile,
  OAuthProvider,
} from '@repo/types';
import { supabase } from '../utils/supabase';
import { signInWithOAuth as authSignInWithOAuth } from '../services/auth';
import { signOutFromGoogle } from '../services/auth/googleAuth';

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
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

  // React StrictMode 대응을 위한 초기화 플래그
  const isInitialized = useRef(false);
  const isSettingSession = useRef(false);

  // 프로필 데이터 가져오기
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // 먼저 계정 복구 시도 (탈퇴한 계정인 경우 자동 복구)
      const { data: restoreResult, error: restoreError } = (await supabase.rpc(
        'restore_deleted_account' as any,
        {
          target_user_id: userId,
        }
      )) as {
        data: {
          success: boolean;
          message: string;
          days_since_deletion?: number;
        } | null;
        error: any;
      };

      if (restoreError) {
        console.error('Account restoration check error:', restoreError);
        // 복구 실패해도 프로필 조회는 계속 진행
      } else if (restoreResult?.success) {
        console.log('탈퇴한 계정이 자동으로 복구되었습니다.');
        console.log(
          `복구 정보: 탈퇴 후 ${restoreResult.days_since_deletion}일 경과`
        );
        // TODO: 필요시 Toast 메시지로 사용자에게 알림
      }

      // 프로필 조회
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, []);

  // 세션 체크 및 초기화
  useEffect(() => {
    // React StrictMode에서 중복 실행 방지
    if (isInitialized.current) {
      return;
    }
    isInitialized.current = true;

    // 기존 세션 확인
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (session && !isSettingSession.current) {
        fetchProfile(session.user.id).then((profile) => {
          setAuthState({
            user: session.user,
            profile,
            session,
            loading: false,
            needsProfile: !profile?.full_name,
          });
        });
      } else if (!isSettingSession.current) {
        setAuthState((prev) => ({ ...prev, loading: false }));
      }
    });

    // 인증 상태 변경 리스너
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // 이미 세션 설정 중이면 무시
        if (isSettingSession.current) {
          return;
        }

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
        } else if (event === 'INITIAL_SESSION' && session) {
          const profile = await fetchProfile(session.user.id);
          setAuthState({
            user: session.user,
            profile,
            session,
            loading: false,
            needsProfile: !profile?.full_name,
          });
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
      const result = await authSignInWithOAuth(provider);

      if (!result.success && result.error) {
        // 빈 에러 메시지는 사용자 취소를 의미하므로 Alert 표시하지 않음
        if (result.error) {
          Alert.alert('로그인 오류', result.error);
        }
      }
    } catch (error) {
      console.error('OAuth sign in error:', error);
      Alert.alert(
        '로그인 오류',
        error instanceof Error
          ? error.message
          : '로그인 중 오류가 발생했습니다.'
      );
    }
  }, []);

  // 로그아웃
  const signOut = useCallback(async () => {
    try {
      // Google Sign-In SDK에서도 로그아웃
      await signOutFromGoogle();
      // Supabase 로그아웃
      await supabase.auth.signOut();
    } catch (err) {
      // AuthSessionMissingError는 이미 로그아웃된 상태이므로 정상으로 처리
      if (
        err instanceof Error &&
        err.message.includes('Auth session missing')
      ) {
        // 세션이 없는 것은 정상
      } else {
        console.error('Unexpected logout error:', err);
        Alert.alert(
          '로그아웃 오류',
          err instanceof Error
            ? err.message
            : '로그아웃 중 오류가 발생했습니다.'
        );
        return; // 예상치 못한 에러는 상태 정리하지 않음
      }
    } finally {
      // 성공하거나 AuthSessionMissingError인 경우 상태 정리
      setAuthState({
        user: null,
        profile: null,
        session: null,
        loading: false,
        needsProfile: false,
      });
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
      } catch (error) {
        Alert.alert(
          '프로필 업데이트 오류',
          error instanceof Error
            ? error.message
            : '프로필 업데이트 중 오류가 발생했습니다.'
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
    signOut,
    signInWithOAuth,
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
