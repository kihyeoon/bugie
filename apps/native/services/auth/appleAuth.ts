import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

export interface AppleAuthError {
  code: string;
  message: string;
}

export interface AppleCredential {
  identityToken: string;
  fullName?: {
    givenName: string | null;
    familyName: string | null;
  } | null;
  email?: string | null;
}

/**
 * 애플이 준 이름을 한 줄로 만든다. 성·이름이 모두 한글이면 '홍길동'처럼 붙이고, 아니면 '이름 성'으로 띄운다.
 * 애플은 이름을 첫 승인 때만 주고, 그 뒤로는 값이 모두 null인 객체를 준다. 이때는 undefined를 돌려준다
 * (빈 문자열을 넘기면 프로필 이름이 ''로 저장된다).
 */
export const formatAppleFullName = (
  fullName: AppleCredential['fullName']
): string | undefined => {
  const given = fullName?.givenName?.trim() ?? '';
  const family = fullName?.familyName?.trim() ?? '';
  if (!given && !family) return undefined;

  const hangul = /^[가-힣]+$/;
  if (hangul.test(given) && hangul.test(family)) return family + given;
  return [given, family].filter(Boolean).join(' ');
};

/**
 * Apple Sign-In 사용 가능 여부 확인
 */
const checkAppleAuthAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
};

/**
 * Apple 로그인 수행
 */
export const signInWithApple = async (): Promise<AppleCredential> => {
  try {
    const isAvailable = await checkAppleAuthAvailable();

    if (!isAvailable) {
      throw new Error('Apple Sign-In을 사용할 수 없습니다.');
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple ID token을 받을 수 없습니다.');
    }

    return {
      identityToken: credential.identityToken,
      fullName: credential.fullName,
      email: credential.email,
    };
  } catch (error) {
    throw handleAppleSignInError(error);
  }
};

/**
 * Apple Sign-In 에러 처리
 */
const handleAppleSignInError = (error: unknown): AppleAuthError => {
  const appleError = error as { code?: string; message?: string };

  switch (appleError.code) {
    case 'ERR_REQUEST_CANCELED':
      return {
        code: 'CANCELLED',
        message: '로그인이 취소되었습니다.',
      };
    case 'ERR_INVALID_RESPONSE':
      return {
        code: 'INVALID_RESPONSE',
        message: '잘못된 응답을 받았습니다.',
      };
    case 'ERR_REQUEST_FAILED':
      return {
        code: 'REQUEST_FAILED',
        message: '로그인 요청에 실패했습니다.',
      };
    case 'ERR_REQUEST_NOT_HANDLED':
      return {
        code: 'NOT_HANDLED',
        message: 'Apple Sign-In을 사용할 수 없습니다.',
      };
    case 'ERR_REQUEST_NOT_INTERACTIVE':
      return {
        code: 'NOT_INTERACTIVE',
        message: '사용자 인터랙션이 필요합니다.',
      };
    case 'ERR_REQUEST_UNKNOWN':
      return {
        code: 'UNKNOWN',
        message: '알 수 없는 오류가 발생했습니다.',
      };
    default:
      return {
        code: 'UNKNOWN',
        message: appleError.message || 'Apple 로그인 중 오류가 발생했습니다.',
      };
  }
};
