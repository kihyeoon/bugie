import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useLedger } from '@/contexts/LedgerContext';
import { useServices } from '@/contexts/ServiceContext';
import { useHideSplashOnMount } from '@/hooks/useHideSplashOnMount';
import {
  defaultLedgerName,
  findDefaultLedger,
  nicknameError,
  toNicknameDraft,
} from '@/services/auth/profileService';

// (auth) 그룹은 흰 배경·어두운 상태바로 고정돼 있어 라이트 토큰을 쓴다.
const colors = Colors.light;

/**
 * 가입 닉네임 화면 (BGI-40). onboarded_at이 없는 사용자가 한 번 거친다.
 * 저장하면 needsProfile이 false가 되고, 아래 effect가 홈(초대 링크로 왔으면 초대 수락)으로 보낸다.
 */
export default function ProfileSetupScreen() {
  const { user, profile, needsProfile, updateProfile, signOut } = useAuth();
  const { ledgers, refreshLedgers } = useLedger();
  const { ledgerService } = useServices();
  const { code } = useLocalSearchParams<{ code?: string }>();

  const currentName = profile?.full_name ?? '';
  const [initialDraft] = useState(() =>
    toNicknameDraft(profile?.full_name, profile?.email)
  );
  const [nickname, setNickname] = useState(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useHideSplashOnMount();

  // 저장이 끝났을 때와, 다른 기기에서 이미 설정해 캐시만 옛 값이던 경우를 같은 길로 보낸다.
  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
    } else if (!needsProfile) {
      router.replace(
        code ? { pathname: '/accept-invite', params: { code } } : '/(tabs)'
      );
    }
  }, [user, needsProfile, code]);

  const trimmed = nickname.trim();
  const canSave = !!trimmed && !saving;
  const defaultLedger = findDefaultLedger(ledgers, user?.id, currentName);
  // 한글 조합 중간 상태(길ㄷ)가 규칙에 걸리므로 입력 중에는 오류를 띄우지 않는다. 안내만 조용히 계산한다.
  const ledgerRename =
    defaultLedger && trimmed !== currentName && !nicknameError(trimmed)
      ? { ledgerId: defaultLedger.id, name: defaultLedgerName(trimmed) }
      : null;

  const handleChange = (text: string) => {
    setNickname(text);
    setError(null);
  };

  // 가계부 이름은 못 바꿔도 가입은 계속한다. 가계부 설정에서 직접 바꿀 수 있다.
  const renameDefaultLedger = async (
    rename: NonNullable<typeof ledgerRename>
  ) => {
    try {
      await ledgerService.updateLedger(rename);
      await refreshLedgers();
    } catch (err) {
      console.warn('기본 가계부 이름 변경 실패:', err);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    const message = nicknameError(trimmed);
    if (message) {
      setError(message);
      return;
    }

    setSaving(true);
    try {
      // 가계부 이름을 먼저 바꾼다. 프로필이 저장되는 순간 needsProfile이 false가 되어 effect가 홈으로 보내기 때문이다.
      if (ledgerRename) await renameDefaultLedger(ledgerRename);
      await updateProfile({
        full_name: trimmed,
        onboarded_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Profile setup error:', err);
      Alert.alert('저장하지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.headerSection}>
          <Text style={styles.title} accessibilityRole="header">
            Bugie에서 쓸 닉네임을 정해주세요
          </Text>
          <Text style={styles.subtitle}>
            함께 쓰는 사람에게 이 닉네임으로 보여요. 나중에 설정에서 바꿀 수
            있어요.
          </Text>
          {!initialDraft && currentName ? (
            <Text style={styles.currentName}>
              지금 표시 이름: {currentName}
            </Text>
          ) : null}
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>닉네임</Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            placeholder="닉네임을 입력하세요"
            placeholderTextColor={colors.textDisabled}
            value={nickname}
            onChangeText={handleChange}
            autoFocus
            autoCorrect={false}
            textContentType="nickname"
            clearButtonMode="while-editing"
            returnKeyType="done"
            onSubmitEditing={handleSave}
            editable={!saving}
            accessibilityLabel="닉네임"
          />
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : ledgerRename ? (
            <Text style={styles.hint}>
              가계부 이름도 &apos;{ledgerRename.name}&apos;로 바뀌어요
            </Text>
          ) : null}
        </View>

        <View style={styles.buttonSection}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              !canSave && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleSave}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave, busy: saving }}
          >
            {saving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>시작하기</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.switchAccount}
            onPress={signOut}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.switchAccountText}>다른 계정으로 로그인</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  headerSection: {
    paddingTop: 48,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  currentName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  formSection: {
    paddingTop: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    color: colors.error,
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    color: colors.textSecondary,
  },
  buttonSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  button: {
    height: 56,
    backgroundColor: colors.tint,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.textDisabled,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  switchAccount: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  switchAccountText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
