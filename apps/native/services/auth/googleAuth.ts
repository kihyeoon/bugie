import {
  GoogleSignin,
  statusCodes,
  type SignInSuccessResponse,
} from '@react-native-google-signin/google-signin';

export interface GoogleAuthError {
  code: string;
  message: string;
}

// 초기화 상태 플래그
let isConfigured = false;

/**
 * Google Sign-In 초기화 (한 번만 실행)
 */
const ensureGoogleSignInConfigured = (): void => {
  if (!isConfigured) {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      offlineAccess: false,
    });
    isConfigured = true;
  }
};

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
    ensureGoogleSignInConfigured(); // 초기화 보장
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
 * Google 로그아웃 수행
 */
export const signOutFromGoogle = async (): Promise<void> => {
  try {
    ensureGoogleSignInConfigured(); // 초기화 보장
    await GoogleSignin.signOut();
  } catch (error) {
    console.error('Google Sign-Out Error:', error);
    // 로그아웃은 실패해도 계속 진행
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
