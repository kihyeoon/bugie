import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppStateHandler } from '../hooks/useAppStateHandler';
import { AppErrorBoundary } from '../components/shared/AppErrorBoundary';
import { AuthProvider } from '../contexts/AuthContext';
import { ServiceProvider } from '../contexts/ServiceContext';
import { LedgerProvider } from '../contexts/LedgerContext';
import { SelectedDateProvider } from '../contexts/SelectedDateContext';
import { queryClient } from '../utils/queryClient';

const SPLASH_SCREEN_DURATION = 1000;

// 스플래시 화면이 자동으로 숨겨지지 않도록 설정 -> 로딩 중 스플래시 화면 노출
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({
  fade: true, // iOS 페이드 애니메이션
  duration: SPLASH_SCREEN_DURATION,
});

export default function RootLayout() {
  useAppStateHandler();
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ServiceProvider>
              <LedgerProvider>
                <SelectedDateProvider>
                  <ThemeProvider
                    value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
                  >
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(auth)" />
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen
                        name="+not-found"
                        options={{ headerShown: true, title: 'Oops!' }}
                      />
                    </Stack>
                    <StatusBar style="auto" />
                  </ThemeProvider>
                </SelectedDateProvider>
              </LedgerProvider>
            </ServiceProvider>
          </AuthProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}
