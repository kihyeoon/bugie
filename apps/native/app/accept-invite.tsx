import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { useServices } from '@/contexts/ServiceContext';
import { useLedger } from '@/contexts/LedgerContext';
import { formatInviteCode, normalizeInviteCode } from '@/utils/invite';
import { useHideSplashOnMount } from '@/hooks/useHideSplashOnMount';

const CODE_LENGTH = 12;

/**
 * 초대 코드 입력 화면 (BGI-22)
 *
 * 딥링크(bugie://invite?code=...)로 들어오면 code 파라미터가 프리필된다.
 */
export default function AcceptInviteScreen() {
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { ledgerService } = useServices();
  const { refreshAndSelectLedger } = useLedger();

  // 저장은 정규형(ABCDEFGHIJKL), 화면 표시만 표기형(ABCD-EFGH-IJKL)으로 파생한다.
  const [code, setCode] = useState(() =>
    normalizeInviteCode(codeParam ?? '').slice(0, CODE_LENGTH)
  );
  const [isJoining, setIsJoining] = useState(false);

  // 보통은 invite.tsx를 거쳐 오지만, bugie://accept-invite 직접 콜드 진입 대비(방어적).
  useHideSplashOnMount();

  const canSubmit = code.length === CODE_LENGTH && !isJoining;

  const handleChange = (text: string) => {
    setCode(normalizeInviteCode(text).slice(0, CODE_LENGTH));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsJoining(true);
    try {
      const ledgerId = await ledgerService.acceptInvite(code);
      // 방금 합류한 가계부는 아직 컨텍스트 목록에 없다 → 저장 후 새로고침으로 선택
      await refreshAndSelectLedger(ledgerId);

      Alert.alert('참여 완료', '가계부에 참여했습니다.', [
        { text: '확인', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '초대 코드를 확인해주세요.';
      Alert.alert('참여할 수 없습니다', message);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.backgroundSecondary },
      ]}
    >
      <ScreenHeader
        title="초대 코드 입력"
        background={colors.backgroundSecondary}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.intro}>
            <Ionicons
              name="ticket-outline"
              size={44}
              color={colors.tint}
            />
            <Typography variant="body1" weight="600" align="center">
              받은 초대 코드를 입력하세요
            </Typography>
            <Typography variant="caption" color="secondary" align="center">
              가계부 주인이 만든 12자리 코드입니다.
            </Typography>
          </View>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: canSubmit ? colors.tint : colors.border,
              },
            ]}
            placeholder="ABCD-EFGH-IJKL"
            placeholderTextColor={colors.textDisabled}
            value={formatInviteCode(code)}
            onChangeText={handleChange}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus={!codeParam}
            editable={!isJoining}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <Button
            variant="primary"
            size="large"
            fullWidth
            loading={isJoining}
            disabled={!canSubmit}
            onPress={handleSubmit}
          >
            참여하기
          </Button>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  intro: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  input: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
  },
});
