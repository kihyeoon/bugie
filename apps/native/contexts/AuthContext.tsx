import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
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
  const [authState, setAuthState] = useState<AuthState>(() => {
    const initialState = {
      user: null,
      profile: null,
      session: null,
      loading: true,
      needsProfile: false,
    };
    console.log('[AuthContext] Initial state created:', initialState);
    return initialState;
  });

  // React StrictMode 대응을 위한 초기화 플래그
  const isInitialized = useRef(false);
  const isSettingSession = useRef(false);
  const stateUpdateCount = useRef(0);

  // Auth state 변경 추적을 위한 로깅
  const logAuthStateChange = (source: string, newState: AuthState) => {
    stateUpdateCount.current += 1;
    console.log(`[AuthState #${stateUpdateCount.current}] ${source}:`, {
      user: newState.user
        ? { id: newState.user.id, email: newState.user.email }
        : null,
      profile: !!newState.profile,
      session: !!newState.session,
      loading: newState.loading,
      needsProfile: newState.needsProfile,
    });
  };

  // 프로필 데이터 가져오기
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        throw error;
      }

      console.log('Profile data retrieved:', data);
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, []);

  // OAuth 콜백 처리를 위한 딥링크 핸들러
  const handleOAuthCallback = useCallback(
    async (url: string) => {
      if (!url.includes('auth/callback') || isSettingSession.current) return;

      console.log('AuthContext: Processing OAuth callback from URL:', url);
      isSettingSession.current = true;

      try {
        const fragment = url.split('#')[1];
        if (fragment) {
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            console.log('AuthContext: Found OAuth tokens, setting session...');

            // 먼저 loading을 true로 설정하여 UI가 대기하도록 함
            setAuthState((prev) => {
              const newState = { ...prev, loading: true };
              logAuthStateChange('OAuth Processing Start', newState);
              return newState;
            });

            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('AuthContext: Session error:', error);
              // 에러 발생 시 loading을 false로
              setAuthState((prev) => {
                const newState = { ...prev, loading: false };
                logAuthStateChange('OAuth Session Error', newState);
                return newState;
              });
            } else if (data?.session) {
              console.log(
                'AuthContext: Session set successfully, fetching profile...'
              );
              // 프로필 가져오기
              const profile = await fetchProfile(data.session.user.id);
              const newState = {
                user: data.session.user,
                profile,
                session: data.session,
                loading: false,
                needsProfile: !profile?.full_name,
              };
              logAuthStateChange('OAuth Complete', newState);
              setAuthState(newState);
              console.log('AuthContext: OAuth flow completed successfully');

              // Double-check the session was set correctly
              setTimeout(async () => {
                const {
                  data: { session: currentSession },
                } = await supabase.auth.getSession();
                console.log('AuthContext: Session verification:', {
                  hasSession: !!currentSession,
                  userId: currentSession?.user?.id,
                  matches: currentSession?.user?.id === data?.session?.user?.id,
                });
              }, 100);
            }
          } else {
            console.warn(
              'AuthContext: No valid tokens found in OAuth callback'
            );
          }
        }
      } catch (error) {
        console.error('AuthContext: OAuth callback error:', error);
        // 에러 발생 시 loading을 false로
        setAuthState((prev) => {
          const newState = { ...prev, loading: false };
          logAuthStateChange('OAuth Error', newState);
          return newState;
        });
      } finally {
        isSettingSession.current = false;
        console.log('AuthContext: OAuth callback processing completed');
      }
    },
    [fetchProfile]
  );

  // 세션 체크 및 초기화
  useEffect(() => {
    // React StrictMode에서 중복 실행 방지
    if (isInitialized.current) {
      console.log('AuthContext: Already initialized, skipping...');
      return;
    }
    isInitialized.current = true;

    console.log('AuthContext: Initializing for the first time...');

    // 딥링크 리스너 설정
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('AuthContext: URL event received:', event.url);
      handleOAuthCallback(event.url);
    });

    // 초기 URL 확인 (앱이 딥링크로 열린 경우)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('AuthContext: Initial URL detected:', url);
        handleOAuthCallback(url);
      }
    });

    // 기존 세션 확인
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('AuthContext: Initial session check:', {
        hasSession: !!session,
        error: error?.message,
        userId: session?.user?.id,
      });

      if (session && !isSettingSession.current) {
        fetchProfile(session.user.id).then((profile) => {
          console.log('AuthContext: Initial profile loaded:', !!profile);
          const newState = {
            user: session.user,
            profile,
            session,
            loading: false,
            needsProfile: !profile?.full_name,
          };
          logAuthStateChange('Initial Session Loaded', newState);
          setAuthState(newState);
        });
      } else if (!isSettingSession.current) {
        console.log(
          'AuthContext: No initial session, setting loading to false'
        );
        const newState = { ...authState, loading: false };
        logAuthStateChange('No Initial Session', newState);
        setAuthState(newState);
      }
    });

    // 인증 상태 변경 리스너
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: onAuthStateChange event:', event);
        console.log(
          'AuthContext: Session in event:',
          session
            ? {
                userId: session.user.id,
                email: session.user.email,
                expiresAt: session.expires_at,
              }
            : null
        );

        // 이미 세션 설정 중이면 무시
        if (isSettingSession.current) {
          console.log(
            'AuthContext: Session is being set, ignoring auth state change'
          );
          return;
        }

        if (event === 'SIGNED_IN' && session) {
          console.log('AuthContext: SIGNED_IN event - fetching profile...');
          const profile = await fetchProfile(session.user.id);
          console.log('AuthContext: Profile fetch result:', {
            hasProfile: !!profile,
            fullName: profile?.full_name,
          });

          const newState = {
            user: session.user,
            profile,
            session,
            loading: false,
            needsProfile: !profile?.full_name,
          };
          console.log('AuthContext: Updating auth state after SIGNED_IN:', {
            hasUser: !!newState.user,
            hasProfile: !!newState.profile,
            needsProfile: newState.needsProfile,
          });
          logAuthStateChange('SIGNED_IN Event', newState);
          setAuthState(newState);
        } else if (event === 'SIGNED_OUT') {
          console.log('AuthContext: SIGNED_OUT event');
          const newState = {
            user: null,
            profile: null,
            session: null,
            loading: false,
            needsProfile: false,
          };
          logAuthStateChange('SIGNED_OUT Event', newState);
          setAuthState(newState);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          console.log('AuthContext: TOKEN_REFRESHED event');
          setAuthState((prev: AuthState) => {
            const newState = { ...prev, session };
            logAuthStateChange('TOKEN_REFRESHED Event', newState);
            return newState;
          });
        } else if (event === 'INITIAL_SESSION' && session) {
          console.log(
            'AuthContext: INITIAL_SESSION event - fetching profile...'
          );
          const profile = await fetchProfile(session.user.id);
          const newState = {
            user: session.user,
            profile,
            session,
            loading: false,
            needsProfile: !profile?.full_name,
          };
          logAuthStateChange('INITIAL_SESSION Event', newState);
          setAuthState(newState);
        }
      }
    );

    return () => {
      subscription.remove();
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile, handleOAuthCallback]);

  // OAuth 로그인
  const signInWithOAuth = useCallback(async (provider: OAuthProvider) => {
    try {
      const redirectTo = getOAuthRedirectUrl();
      console.log('redirectTo', redirectTo);
      // OAuth URL 생성 및 브라우저 열기
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        await Linking.openURL(data.url);
      }
    } catch (error) {
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
      console.log('Starting logout process...');
      await supabase.auth.signOut();
      console.log('Logout successful');
    } catch (error) {
      // AuthSessionMissingError는 이미 로그아웃된 상태이므로 정상으로 처리
      if (
        error instanceof Error &&
        error.message.includes('Auth session missing')
      ) {
        console.log('Session already missing, proceeding with cleanup');
      } else {
        console.error('Unexpected logout error:', error);
        Alert.alert(
          '로그아웃 오류',
          error instanceof Error
            ? error.message
            : '로그아웃 중 오류가 발생했습니다.'
        );
        return; // 예상치 못한 에러는 상태 정리하지 않음
      }
    } finally {
      // 성공하거나 AuthSessionMissingError인 경우 상태 정리
      console.log('Clearing auth state...');
      const newState = {
        user: null,
        profile: null,
        session: null,
        loading: false,
        needsProfile: false,
      };
      logAuthStateChange('Sign Out', newState);
      setAuthState(newState);
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
        setAuthState((prev: AuthState) => {
          const newState = {
            ...prev,
            profile: updatedProfile,
            needsProfile: false,
          };
          logAuthStateChange('Profile Updated', newState);
          return newState;
        });
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
        setAuthState((prev: AuthState) => {
          const newState = { ...prev, session };
          logAuthStateChange('Session Refreshed', newState);
          return newState;
        });
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
