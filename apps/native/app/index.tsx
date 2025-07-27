import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';

export default function Index() {
  const { user, loading, needsProfile, session } = useAuth();
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);

  // OAuth 콜백 감지
  useEffect(() => {
    const checkForOAuthCallback = async () => {
      const url = await Linking.getInitialURL();
      if (url && url.includes('auth/callback')) {
        console.log(
          'app/index.tsx - OAuth callback detected, waiting for processing...'
        );
        setIsProcessingOAuth(true);
        // OAuth 처리를 위한 짧은 대기
        setTimeout(() => {
          setIsProcessingOAuth(false);
        }, 1000);
      }
    };

    checkForOAuthCallback();
  }, []);

  console.log('app/index.tsx - Navigation decision:', {
    user: user ? { id: user.id, email: user.email } : null,
    loading,
    needsProfile,
    session: !!session,
    isProcessingOAuth,
    decision:
      loading || isProcessingOAuth
        ? 'loading'
        : !user
          ? 'login'
          : needsProfile
            ? 'profile'
            : 'home',
  });

  // 로딩 중이거나 OAuth 처리 중일 때는 로딩 화면 표시
  if (loading || isProcessingOAuth) {
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
