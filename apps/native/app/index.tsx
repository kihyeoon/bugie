import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../contexts/AuthContext';
import { ErrorState } from '../components/shared/ErrorState';

export default function Index() {
  const { user, loading, needsProfile, session, error, retryInitialization } =
    useAuth();

  // 에러 발생 시 스플래시 숨김
  useEffect(() => {
    if (error) {
      SplashScreen.hideAsync().catch((e) =>
        console.warn('SplashScreen hide error:', e)
      );
    }
  }, [error]);

  // 로딩 중에는 스플래시 화면 유지 (null 반환)
  if (loading) {
    return null;
  }

  // 연결 에러 시 에러 화면 표시
  if (error) {
    return (
      <ErrorState
        message={'서버에 연결할 수 없습니다.\n네트워크 상태를 확인하고 다시 시도해 주세요.'}
        onRetry={retryInitialization}
      />
    );
  }

  // 로그인 안 된 경우 → 로그인 화면
  if (!user || !session) {
    return <Redirect href="/(auth)/login" />;
  }

  // 프로필 설정 필요 → 프로필 설정 화면
  if (needsProfile) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  // 로그인 완료 → 홈 화면
  return <Redirect href="/(tabs)" />;
}
