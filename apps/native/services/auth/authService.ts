import { supabase } from '../../utils/supabase';
import type { OAuthProvider } from '@repo/types';
import { signInWithGoogle, GoogleAuthError } from './googleAuth';
import {
  signInWithApple,
  formatAppleFullName,
  AppleAuthError,
} from './appleAuth';
import { rememberSignupName } from './profileService';

// 프로필 생성과 화면 이동은 여기서 하지 않는다. signInWithIdToken이 AuthContext의 SIGNED_IN 리스너를
// 기다리는 동안 리스너가 프로필을 만들고 상태를 세팅하며, 이동은 그 상태를 보는 화면들이 맡는다.
export interface AuthResult {
  success: boolean;
  error?: string;
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

    return { success: true };
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

    // Supabase 인증. 신규 가입이면 이 호출 안에서 리스너가 애플 이름으로 프로필을 만든다.
    rememberSignupName(formatAppleFullName(appleCredential.fullName));
    const { data, error } = await supabase.auth
      .signInWithIdToken({
        provider: 'apple',
        token: appleCredential.identityToken,
      })
      // 실패·기존 계정이어도 이름이 남아 같은 세션의 다른 가입에 붙지 않게 한다
      .finally(() => rememberSignupName(undefined));

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

    return { success: true };
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
