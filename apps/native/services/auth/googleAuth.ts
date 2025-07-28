import {
  GoogleSignin,
  statusCodes,
  type SignInSuccessResponse,
} from '@react-native-google-signin/google-signin';

export interface GoogleAuthError {
  code: string;
  message: string;
}

/**
 * Google Play Services 사용 가능 여부 확인
 */
const checkPlayServices = async (): Promise<boolean> => {
  try {
    await GoogleSignin.hasPlayServices();
    return true;
  } catch {
    return false;
  }
};

/**
 * Google 로그인 수행
 */
export const signInWithGoogle = async (): Promise<SignInSuccessResponse> => {
  try {
    await checkPlayServices();
    const userInfo = await GoogleSignin.signIn();

    if (!userInfo.data?.idToken) {
      throw new Error('Google ID token을 받을 수 없습니다.');
    }

    return userInfo;
  } catch (error) {
    throw handleGoogleSignInError(error);
  }
};

/**
 * Google Sign-In 에러 처리
 */
const handleGoogleSignInError = (error: unknown): GoogleAuthError => {
  const googleError = error as { code?: string; message?: string };

  switch (googleError.code) {
    case statusCodes.SIGN_IN_CANCELLED:
      return {
        code: 'CANCELLED',
        message: '로그인이 취소되었습니다.',
      };
    case statusCodes.IN_PROGRESS:
      return {
        code: 'IN_PROGRESS',
        message: '이미 로그인이 진행 중입니다.',
      };
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return {
        code: 'PLAY_SERVICES_NOT_AVAILABLE',
        message: 'Google Play 서비스를 사용할 수 없습니다.',
      };
    default:
      return {
        code: 'UNKNOWN',
        message: googleError.message || '구글 로그인 중 오류가 발생했습니다.',
      };
  }
};
