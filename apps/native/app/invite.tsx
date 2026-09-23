import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeInviteCode } from '@/utils/invite';
import { useHideSplashOnMount } from '@/hooks/useHideSplashOnMount';

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

  // 딥링크 콜드 스타트의 초기 라우트 — app/index.tsx를 거치지 않는다.
  useHideSplashOnMount();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace('/(auth)/login');
      return;
    }

    // 닉네임 미설정 사용자는 먼저 닉네임 화면으로 (app/index.tsx의 게이트와 동일).
    // 초대는 신규 가입자가 받는 경우가 많아 이 분기가 실제로 자주 걸린다. 코드를 넘겨 저장 후 수락으로 잇는다.
    const normalized = code ? normalizeInviteCode(code) : '';
    router.replace({
      pathname: needsProfile ? '/(auth)/profile-setup' : '/accept-invite',
      params: normalized ? { code: normalized } : {},
    });
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
