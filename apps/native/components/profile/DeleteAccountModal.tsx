import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Typography, Button } from '../ui';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';

interface DeleteAccountModalProps {
  visible: boolean;
  ownedLedgerCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAccountModal({
  visible,
  ownedLedgerCount,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState(1);

  const requiredText = '정말 탈퇴하시겠습니까?';
  const isConfirmTextValid = confirmText === requiredText;

  // 초기화
  useEffect(() => {
    if (visible) {
      setStep(1);
      setConfirmText('');
    }
  }, [visible]);

  const handleClose = () => {
    setStep(1);
    setConfirmText('');
    onClose();
  };

  const handleFirstStep = () => {
    if (ownedLedgerCount > 0) {
      // 소유한 가계부가 있으면 탈퇴 불가
      return;
    }
    setStep(2);
  };

  const handleFinalConfirm = () => {
    if (isConfirmTextValid) {
      onConfirm();
      handleClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* 드래그 핸들 */}
        <View style={styles.dragHandle} />

        {/* 헤더 */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose}>
            <Typography variant="body1" color="primary">
              취소
            </Typography>
          </Pressable>
          <Typography variant="h3" weight="600">
            회원 탈퇴
          </Typography>
          <View style={{ width: 40 }} />
        </View>

        {/* 컨텐츠 */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {step === 1 ? (
            // Step 1: 경고 및 확인
            <>
              <View style={styles.stepHeader}>
                <View
                  style={[
                    styles.warningIcon,
                    { backgroundColor: colors.error + '20' },
                  ]}
                >
                  <Ionicons name="warning" size={32} color={colors.error} />
                </View>
              </View>

              <View style={styles.warningContent}>
                <Typography variant="body1" style={styles.warningText}>
                  회원 탈퇴 시 다음 사항을 확인해주세요:
                </Typography>

                <View style={styles.warningList}>
                  <View style={styles.warningItem}>
                    <Typography variant="body1" color="secondary">
                      • 탈퇴 후 30일 이내 재로그인 시 자동 복구됩니다
                    </Typography>
                  </View>
                  <View style={styles.warningItem}>
                    <Typography variant="body1" color="secondary">
                      • 30일이 지나면 모든 데이터가 영구 삭제됩니다
                    </Typography>
                  </View>
                  <View style={styles.warningItem}>
                    <Typography variant="body1" color="secondary">
                      • 참여 중인 가계부에서 자동으로 나가게 됩니다
                    </Typography>
                  </View>
                  <View style={styles.warningItem}>
                    <Typography variant="body1" color="secondary">
                      • 개인 정보는 즉시 비공개 처리됩니다
                    </Typography>
                  </View>
                </View>

                {ownedLedgerCount > 0 && (
                  <View
                    style={[
                      styles.errorBox,
                      { backgroundColor: colors.error + '10' },
                    ]}
                  >
                    <Typography variant="body1" color="error">
                      ⚠️ 소유한 가계부가 {ownedLedgerCount}개 있습니다.
                    </Typography>
                    <Typography
                      variant="caption"
                      color="error"
                      style={{ marginTop: 4 }}
                    >
                      탈퇴하려면 먼저 가계부를 삭제하거나 다른 사용자에게
                      양도해주세요.
                    </Typography>
                  </View>
                )}
              </View>

              <View style={styles.buttonContainer}>
                <Button
                  variant="danger"
                  onPress={handleFirstStep}
                  disabled={ownedLedgerCount > 0}
                  fullWidth
                >
                  다음
                </Button>
              </View>
            </>
          ) : (
            // Step 2: 최종 확인
            <>
              <View style={styles.stepHeader}>
                <Typography variant="h3" style={styles.title}>
                  최종 확인
                </Typography>
              </View>

              <View style={styles.confirmContent}>
                <Typography variant="body1" style={styles.confirmText}>
                  정말로 회원 탈퇴를 진행하시겠습니까?
                </Typography>
                <Typography variant="body1" style={styles.confirmText}>
                  아래 문구를 정확히 입력해주세요:
                </Typography>

                <View
                  style={[
                    styles.requiredTextBox,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}
                >
                  <Typography variant="body1" style={{ fontWeight: '600' }}>
                    {requiredText}
                  </Typography>
                </View>

                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      color: colors.text,
                      borderColor: isConfirmTextValid
                        ? colors.success
                        : colors.border,
                    },
                  ]}
                  value={confirmText}
                  onChangeText={setConfirmText}
                  placeholder="위 문구를 입력하세요"
                  placeholderTextColor={colors.textSecondary}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.buttonContainer}>
                <Button
                  variant="secondary"
                  onPress={() => setStep(1)}
                  style={styles.button}
                >
                  이전
                </Button>
                <Button
                  variant="danger"
                  onPress={handleFinalConfirm}
                  disabled={!isConfirmTextValid}
                  style={styles.button}
                >
                  탈퇴하기
                </Button>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dragHandle: {
    width: 36,
    height: 5,
    backgroundColor: '#C7C7CC',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  warningIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
  },
  warningContent: {
    marginBottom: 24,
  },
  warningText: {
    marginBottom: 16,
  },
  warningList: {
    gap: 8,
  },
  warningItem: {
    paddingLeft: 8,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  confirmContent: {
    marginBottom: 24,
  },
  confirmText: {
    marginBottom: 12,
    textAlign: 'center',
  },
  requiredTextBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  button: {
    flex: 1,
  },
});
