import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, loading, needsProfile, session } = useAuth();

  console.log('app/index.tsx - Navigation decision:', {
    user: user ? { id: user.id, email: user.email } : null,
    loading,
    needsProfile,
    session: !!session,
    decision:
      loading
        ? 'loading'
        : !user
          ? 'login'
          : needsProfile
            ? 'profile'
            : 'home',
  });

  // 로딩 중일 때는 로딩 화면 표시
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
        }}
      >
        <ActivityIndicator size="large" color="#191919" />
      </View>
    );
  }

  // 로그인 안 된 경우 로그인 화면으로
  if (!user || !session) {
    console.log('app/index.tsx - Redirecting to login');
    return <Redirect href="/(auth)/login" />;
  }

  // 프로필 설정이 필요한 경우
  if (needsProfile) {
    console.log('app/index.tsx - Redirecting to profile setup');
    return <Redirect href="/(auth)/profile-setup" />;
  }

  // 로그인되고 프로필도 설정된 경우 홈으로
  console.log('app/index.tsx - Redirecting to home tabs');
  return <Redirect href="/(tabs)" />;
}
