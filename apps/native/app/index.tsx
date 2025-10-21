import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { user, loading, needsProfile, session } = useAuth();

  // 로딩 중에는 스플래시 화면 유지 (null 반환)
  if (loading) {
    return null;
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
