import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider } from '../contexts/AuthContext';
import { ServiceProvider } from '../contexts/ServiceContext';
import { LedgerProvider } from '../contexts/LedgerContext';

const SPLASH_SCREEN_DURATION = 1000;

// 스플래시 화면이 자동으로 숨겨지지 않도록 설정 -> 로딩 중 스플래시 화면 노출
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({
  fade: true, // iOS 페이드 애니메이션
  duration: SPLASH_SCREEN_DURATION,
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ServiceProvider>
          <LedgerProvider>
            <ThemeProvider
              value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
            >
              <Stack>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </LedgerProvider>
        </ServiceProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
