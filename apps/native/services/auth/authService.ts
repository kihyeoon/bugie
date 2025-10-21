import { router } from 'expo-router';
import { supabase } from '../../utils/supabase';
import type { OAuthProvider, AuthProfile as Profile } from '@repo/types';
import { signInWithGoogle, GoogleAuthError } from './googleAuth';
import { signInWithApple, AppleAuthError } from './appleAuth';
import { ensureProfile, isProfileComplete } from './profileService';

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
        return await handleAppleSignIn();
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

    // 프로필 확인 및 자동 생성 (간소화)
    const profile = await ensureProfile(
      data.user.id,
      data.user.email,
      data.user
    );

    if (!profile) {
      console.error('Failed to ensure profile for user');
      // 프로필 생성 실패해도 로그인은 성공 처리
      // profile-setup 화면에서 재시도 가능
    }

    // 프로필 확인 및 라우팅
    const result = await checkProfileAndRoute(data.user.id, profile);

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
 * Apple 로그인 처리
 */
const handleAppleSignIn = async (): Promise<AuthResult> => {
  try {
    // Apple 로그인
    const appleCredential = await signInWithApple();

    if (!appleCredential.identityToken) {
      return {
        success: false,
        error: 'Apple 인증 토큰을 받을 수 없습니다.',
      };
    }

    // Supabase 인증
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: appleCredential.identityToken,
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

    // Apple fullName 처리 (첫 로그인 시에만 제공됨)
    const fullName = appleCredential.fullName
      ? `${appleCredential.fullName.givenName || ''} ${appleCredential.fullName.familyName || ''}`.trim()
      : undefined;

    // 프로필 확인 및 자동 생성
    const profile = await ensureProfile(
      data.user.id,
      data.user.email,
      data.user,
      {
        fullName,
        avatarUrl: undefined, // Apple은 프로필 사진 제공 안함
      }
    );

    if (!profile) {
      console.error('Failed to ensure profile for user');
    }

    // 프로필 확인 및 라우팅
    const result = await checkProfileAndRoute(data.user.id, profile);

    return {
      success: true,
      needsProfile: result.needsProfile,
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const appleError = error as AppleAuthError;

      // 사용자가 취소한 경우 에러로 처리하지 않음
      if (appleError.code === 'CANCELLED') {
        return {
          success: false,
          error: '',
        };
      }

      return {
        success: false,
        error: appleError.message,
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
  userId: string,
  profile?: Profile | null
): Promise<{ needsProfile: boolean }> => {
  // 프로필이 전달되지 않은 경우에만 조회
  if (!profile) {
    const { ensureProfile } = await import('./profileService');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    profile = await ensureProfile(userId, user?.email, user);
  }

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
