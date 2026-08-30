import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { useServices } from '@/contexts/ServiceContext';
import { useLedger } from '@/contexts/LedgerContext';
import { formatInviteCode, normalizeInviteCode } from '@/utils/invite';

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
  const { refreshLedgers, selectLedger } = useLedger();

  const [code, setCode] = useState(
    codeParam ? formatInviteCode(codeParam) : ''
  );
  const [isJoining, setIsJoining] = useState(false);

  const normalized = normalizeInviteCode(code);
  const canSubmit = normalized.length === CODE_LENGTH && !isJoining;

  const handleChange = (text: string) => {
    // 입력 즉시 표기형(ABCD-EFGH-IJKL)으로 정리
    const next = normalizeInviteCode(text).slice(0, CODE_LENGTH);
    setCode(formatInviteCode(next));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsJoining(true);
    try {
      const ledgerId = await ledgerService.acceptInvite(normalized);
      await refreshLedgers();
      await selectLedger(ledgerId);

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
            value={code}
            onChangeText={handleChange}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus={!codeParam}
            editable={!isJoining}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <Pressable
            style={[
              styles.submitButton,
              {
                backgroundColor: canSubmit
                  ? colors.tint
                  : colors.backgroundSecondary,
                borderColor: colors.border,
              },
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Typography
                variant="body1"
                weight="600"
                style={canSubmit ? styles.submitTextActive : undefined}
                color={canSubmit ? 'inherit' : 'disabled'}
              >
                참여하기
              </Typography>
            )}
          </Pressable>
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
  submitButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  submitTextActive: {
    color: '#FFFFFF',
  },
});
