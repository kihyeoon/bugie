import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { APP_STORE_URL } from '@/constants/appStore';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useHideSplashOnMount } from '@/hooks/useHideSplashOnMount';
import { useUpdatePrompt } from '@/hooks/useUpdatePrompt';

/**
 * 최소 지원 버전 미만이면 앱 전체를 덮어 업데이트로만 보낸다 (BGI-52)
 *
 * 루트 레이아웃에 둔다. 라우트 안(app/index.tsx 등)에 두면 딥링크 콜드 스타트가
 * 그 라우트를 건너뛰어 게이트를 우회한다.
 * 절대 위치 View로는 네이티브로 띄운 모달 화면(present)까지 덮지 못한다 → Modal로 띄운다.
 */
export function ForceUpdateGate() {
  const prompt = useUpdatePrompt();
  return prompt.type === 'required' ? <ForceUpdateScreen /> : null;
}

function ForceUpdateScreen() {
  // 스플래시는 첫 화면이 데이터를 준비할 때까지 남아 있으므로, 막는 화면은 직접 걷어야 보인다
  useHideSplashOnMount();
  const colors = Colors[useColorScheme()];

  return (
    <Modal visible animationType="none">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Ionicons
          name="arrow-up-circle-outline"
          size={56}
          color={colors.tint}
        />
        <Text style={[styles.title, { color: colors.text }]}>
          업데이트가 필요해요
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {'이 버전은 더 이상 지원되지 않아요.\n최신 버전으로 업데이트해 주세요.'}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.tint, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => Linking.openURL(APP_STORE_URL)}
        >
          <Text style={styles.buttonText}>업데이트</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
