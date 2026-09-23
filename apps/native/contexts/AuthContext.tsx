import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import type {
  AuthState,
  AuthProfile as Profile,
  OAuthProvider,
} from '@repo/types';
import { supabase } from '../utils/supabase';
import { signInWithOAuth as authSignInWithOAuth } from '../services/auth';
import { signOutFromGoogle } from '../services/auth/googleAuth';
import { ensureProfile, needsOnboarding } from '../services/auth/profileService';
import { invalidateTransactionLists } from '../utils/queryClient';

const PROFILE_CACHE_KEY = '@auth/profile_cache';

interface AuthContextValue extends AuthState {
  /** 닉네임 화면을 보여줘야 하는지. profile에서 계산한다. */
  needsProfile: boolean;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  refreshSession: () => Promise<void>;
  retryInitialization: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    error: null,
  });

  // 로그아웃되면 캐시를 비운다. 안 그러면 다음에 로그인한 사용자에게 이전 사용자 가계부가 보인다.
  // 로그아웃·탈퇴·테스트 계정 전환이 모두 user가 null이 되는 경로를 거치므로 여기 한 곳에서 처리한다.
  const queryClient = useQueryClient();
  const userId = authState.user?.id;
  useEffect(() => {
    if (!userId) queryClient.clear();
  }, [userId, queryClient]);

  // React StrictMode 대응을 위한 초기화 플래그
  const isInitialized = useRef(false);

  // 프로필 데이터 가져오기 (간소화됨)
  const getProfile = useCallback(async (userId: string, userEmail?: string | null) => {
    try {
      // 현재 사용자 정보 가져오기 (메타데이터 포함)
      const { data: { user } } = await supabase.auth.getUser();
      
      // ensureProfile로 모든 로직 통합
      return await ensureProfile(userId, userEmail, user);
    } catch (error) {
      console.error('Error getting profile:', error);
      return null;
    }
  }, []);

  // 세션 및 프로필 초기화 (useEffect와 retryInitialization에서 공유)
  const initializeAuth = useCallback(async () => {
    try {
      const [{ data: { session } }, cachedProfileJson] = await Promise.race([
        Promise.all([
          supabase.auth.getSession(),
          AsyncStorage.getItem(PROFILE_CACHE_KEY),
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('서버 연결 시간이 초과되었습니다')), 10000)
        ),
      ]);

      if (!session) {
        setAuthState((prev) => ({ ...prev, loading: false }));
        return;
      }

      // 캐시된 프로필이 있으면 즉시 UI 표시
      if (cachedProfileJson) {
        try {
          const cachedProfile = JSON.parse(cachedProfileJson);
          setAuthState({
            user: session.user,
            profile: cachedProfile,
            session,
            loading: false,
            error: null,
          });
        } catch (e) {
          console.warn('Failed to parse cached profile:', e);
        }
      }

      // 백그라운드에서 최신 프로필 동기화
      const latestProfile = await getProfile(session.user.id, session.user.email);

      // 최신 프로필로 업데이트 (캐시와 다른 경우에만)
      if (latestProfile && JSON.stringify(latestProfile) !== cachedProfileJson) {
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(latestProfile));
        setAuthState({
          user: session.user,
          profile: latestProfile,
          session,
          loading: false,
          error: null,
        });
      } else if (!cachedProfileJson) {
        setAuthState({
          user: session.user,
          profile: latestProfile,
          session,
          loading: false,
          error: null,
        });
      }
    } catch (err) {
      console.error('Auth initialization failed:', err);
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err : new Error('서버 연결에 실패했습니다'),
      }));
    }
  }, [getProfile]);

  // 초기화 재시도
  const retryInitialization = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, loading: true, error: null }));
    await initializeAuth();
  }, [initializeAuth]);

  // 세션 체크 및 초기화
  useEffect(() => {
    // React StrictMode에서 중복 실행 방지
    if (isInitialized.current) {
      return;
    }
    isInitialized.current = true;

    initializeAuth();

    // 인증 상태 변경 리스너
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const profile = await getProfile(session.user.id, session.user.email);
          if (profile) {
            await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
          }
          setAuthState({
            user: session.user,
            profile,
            session,
            loading: false,
            error: null,
          });
        } else if (event === 'SIGNED_OUT') {
          await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
          setAuthState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            error: null,
          });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setAuthState((prev: AuthState) => ({ ...prev, session }));
        } else if (event === 'INITIAL_SESSION' && session) {
          const profile = await getProfile(session.user.id, session.user.email);
          if (profile) {
            await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
          }
          setAuthState({
            user: session.user,
            profile,
            session,
            loading: false,
            error: null,
          });
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [getProfile, initializeAuth]);

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
      // 캐시 삭제
      await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
      // 성공하거나 AuthSessionMissingError인 경우 상태 정리
      setAuthState({
        user: null,
        profile: null,
        session: null,
        loading: false,
        error: null,
      });
    }
  }, []);

  // 프로필 업데이트. 실패하면 던지므로 알림은 호출하는 화면이 띄운다.
  const updateProfile = useCallback(
    async (data: Partial<Profile>) => {
      if (!authState.user) return;

      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authState.user.id)
        .select()
        .single();

      if (error) throw error;

      await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(updatedProfile));
      setAuthState((prev: AuthState) => ({
        ...prev,
        profile: updatedProfile,
      }));
      // 거래 행에 지출자·작성자 이름이 조인돼 있다
      invalidateTransactionLists(queryClient);
    },
    [authState.user, queryClient]
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
    needsProfile: !!authState.user && needsOnboarding(authState.profile),
    signOut,
    signInWithOAuth,
    updateProfile,
    refreshSession,
    retryInitialization,
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
