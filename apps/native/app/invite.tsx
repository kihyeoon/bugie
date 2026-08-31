import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeInviteCode } from '@/utils/invite';

/**
 * 초대 딥링크 수신 (bugie://invite?code=...)
 *
 * 경량 설계(BGI-22): 로그인 상태면 코드를 프리필해 수락 화면으로 보내고,
 * 비로그인이면 로그인으로 유도한다. 코드를 보관했다가 로그인 후 재개하는 로직은
 * 두지 않는다 — 코드 입력 화면이 폴백이라 사용자가 직접 입력하면 된다.
 */
export default function InviteDeepLinkScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { session, loading, needsProfile } = useAuth();

  // 딥링크 콜드 스타트는 이 화면이 초기 라우트라 app/index.tsx를 거치지 않는다.
  // 여기서 숨기지 않으면 스플래시가 영원히 남는다.
  useEffect(() => {
    SplashScreen.hideAsync().catch((e) =>
      console.warn('SplashScreen hide error:', e)
    );
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace('/(auth)/login');
      return;
    }

    // 프로필 미설정 사용자는 먼저 프로필 설정으로 (app/index.tsx의 게이트와 동일)
    // 초대는 신규 가입자가 받는 경우가 많아 이 분기가 실제로 자주 걸린다.
    if (needsProfile) {
      router.replace('/(auth)/profile-setup');
      return;
    }

    const normalized = code ? normalizeInviteCode(code) : '';
    router.replace(
      normalized
        ? { pathname: '/accept-invite', params: { code: normalized } }
        : '/accept-invite'
    );
  }, [loading, session, needsProfile, code]);

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
