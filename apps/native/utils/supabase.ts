import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import type { Database } from '@repo/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore adapter for Supabase Auth
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // React Native에서는 수동 처리 필요
  },
});

// OAuth 리다이렉트 URL 생성 헬퍼
export const getOAuthRedirectUrl = () => {
  // 개발 환경에서는 Expo 개발 서버 URL 사용
  if (__DEV__) {
    // Expo Go 앱에서 테스트하는 경우
    const devUrl = Linking.createURL('auth/callback');
    console.log('OAuth Redirect URL (dev):', devUrl);
    return devUrl;
  }

  // 프로덕션 환경
  return 'bugie://auth/callback';
};
