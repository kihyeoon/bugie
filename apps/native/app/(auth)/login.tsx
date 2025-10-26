import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../../hooks/useAuth';
import { SocialLoginButton } from '../../components/auth/SocialLoginButton';
import type { OAuthProvider } from '@repo/types';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const { signInWithOAuth } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(
    null
  );

  // 로그인 화면 마운트 시 스플래시 숨김
  useEffect(() => {
    async function hideSplash() {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn('SplashScreen hide error:', e);
      }
    }
    hideSplash();
  }, []);

  const handleSocialLogin = async (provider: OAuthProvider) => {
    try {
      setLoadingProvider(provider);
      await signInWithOAuth(provider);
      // 로그인 성공 시 AuthContext와 authService에서 자동으로 라우팅 처리
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
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.greeting}>Bugie</Text>
            <Text style={styles.subtitle}>함께 만드는 우리의 가계부</Text>
          </View>

          <View style={styles.buttonSection}>
            {Platform.OS === 'ios' && (
              <>
                <SocialLoginButton
                  provider="apple"
                  onPress={() => handleSocialLogin('apple')}
                  loading={loadingProvider === 'apple'}
                  disabled={loadingProvider !== null}
                />
                <View style={styles.buttonSpacing} />
              </>
            )}
            <SocialLoginButton
              provider="google"
              onPress={() => handleSocialLogin('google')}
              loading={loadingProvider === 'google'}
              disabled={loadingProvider !== null}
            />
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
  logo: {
    width: 96,
    height: 96,
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
});
