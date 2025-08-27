import { router } from 'expo-router';
import { supabase } from '../../utils/supabase';
import type { OAuthProvider } from '@repo/types';
import { signInWithGoogle, GoogleAuthError } from './googleAuth';
import { fetchProfile, isProfileComplete } from './profileService';

export interface AuthResult {
  success: boolean;
  error?: string;
  needsProfile?: boolean;
}

/**
 * OAuth 프로바이더별 로그인 처리
 */
export const signInWithOAuth = async (
  provider: OAuthProvider
): Promise<AuthResult> => {
  try {
    switch (provider) {
      case 'google':
        return await handleGoogleSignIn();
      case 'apple':
        // Apple 로그인 구현 예정
        return {
          success: false,
          error: 'Apple 로그인은 준비 중입니다.',
        };
      case 'kakao':
        // Kakao 로그인 구현 예정
        return {
          success: false,
          error: '카카오 로그인은 준비 중입니다.',
        };
      default:
        return {
          success: false,
          error: '지원하지 않는 로그인 방식입니다.',
        };
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : '로그인 중 오류가 발생했습니다.',
    };
  }
};

/**
 * Google 로그인 처리
 */
const handleGoogleSignIn = async (): Promise<AuthResult> => {
  try {
    // Google 로그인
    const googleUser = await signInWithGoogle();

    if (!googleUser.data?.idToken) {
      return {
        success: false,
        error: 'Google 인증 토큰을 받을 수 없습니다.',
      };
    }

    // Supabase 인증
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: googleUser.data.idToken,
    });

    if (error) {
      console.error('Supabase auth error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: '사용자 정보를 가져올 수 없습니다.',
      };
    }

    // 프로필 확인 및 라우팅
    const result = await checkProfileAndRoute(data.user.id);

    return {
      success: true,
      needsProfile: result.needsProfile,
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const googleError = error as GoogleAuthError;

      // 사용자가 취소한 경우 에러로 처리하지 않음
      if (googleError.code === 'CANCELLED') {
        return {
          success: false,
          error: '',
        };
      }

      return {
        success: false,
        error: googleError.message,
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : '로그인 중 오류가 발생했습니다.',
    };
  }
};

/**
 * 프로필 확인 후 적절한 화면으로 라우팅
 */
const checkProfileAndRoute = async (
  userId: string
): Promise<{ needsProfile: boolean }> => {
  // 프로필 정보 가져오기
  const profile = await fetchProfile(userId);

  // 프로필 완성 여부 확인
  const profileComplete = isProfileComplete(profile);

  // 적절한 화면으로 라우팅
  if (!profileComplete) {
    router.replace('/(auth)/profile-setup');
    return { needsProfile: true };
  } else {
    router.replace('/(tabs)');
    return { needsProfile: false };
  }
};

