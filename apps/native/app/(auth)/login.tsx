import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { SocialLoginButton } from '../../components/auth/SocialLoginButton';
import type { OAuthProvider } from '@repo/types';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const { signInWithOAuth } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(
    null
  );

  const handleSocialLogin = async (provider: OAuthProvider) => {
    try {
      setLoadingProvider(provider);
      await signInWithOAuth(provider);
      // 로그인 성공 시 AuthContext에서 자동으로 홈으로 리다이렉트됨
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* 상단 영역 - 로고와 인사말 */}
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              {/* 로고 이미지가 있다면 여기에 추가 */}
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoText}>B</Text>
              </View>
            </View>
            <Text style={styles.greeting}>안녕하세요!</Text>
            <Text style={styles.subtitle}>Bugie와 함께 시작해보세요</Text>
          </View>

          {/* 중앙 영역 - 소셜 로그인 버튼들 */}
          <View style={styles.buttonSection}>
            <SocialLoginButton
              provider="google"
              onPress={() => handleSocialLogin('google')}
              loading={loadingProvider === 'google'}
              disabled={loadingProvider !== null}
            />
            <View style={styles.buttonSpacing} />
            <SocialLoginButton
              provider="apple"
              onPress={() => handleSocialLogin('apple')}
              loading={loadingProvider === 'apple'}
              disabled={loadingProvider !== null}
            />
            <View style={styles.buttonSpacing} />
            <SocialLoginButton
              provider="kakao"
              onPress={() => handleSocialLogin('kakao')}
              loading={loadingProvider === 'kakao'}
              disabled={loadingProvider !== null}
            />
          </View>

          {/* 하단 영역 - 약관 안내 */}
          <View style={styles.footerSection}>
            <Text style={styles.termsText}>
              로그인하면{' '}
              <Text style={styles.termsLink}>서비스 이용약관</Text>에
              동의하게 됩니다
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  headerSection: {
    flex: 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: height * 0.08,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#191919',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  greeting: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#191919',
    marginBottom: 8,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8B8B8B',
    letterSpacing: -0.3,
  },
  buttonSection: {
    flex: 0.4,
    justifyContent: 'center',
    paddingVertical: 48,
  },
  buttonSpacing: {
    height: 12,
  },
  footerSection: {
    flex: 0.2,
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  termsText: {
    fontSize: 14,
    color: '#8B8B8B',
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: '#191919',
    textDecorationLine: 'underline',
  },
});