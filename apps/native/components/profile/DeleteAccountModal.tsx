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
import { DELETE_ACCOUNT } from '@repo/core';

interface DeleteAccountModalProps {
  visible: boolean;
  ownedLedgerCount: number;
  ownedLedgersWithOtherMembers: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAccountModal({
  visible,
  ownedLedgerCount,
  ownedLedgersWithOtherMembers,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState(1);

  const requiredText = DELETE_ACCOUNT.CONFIRM_TEXT;
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
    if (ownedLedgersWithOtherMembers > 0) {
      // 다른 멤버가 있는 소유 가계부가 있으면 탈퇴 불가
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
          <Pressable onPress={handleClose} style={styles.headerButton}>
            <Typography variant="body1" color="primary">
              {DELETE_ACCOUNT.UI.BUTTON_CANCEL}
            </Typography>
          </Pressable>
          <View style={styles.headerTitle}>
            <Typography variant="h3" weight="600">
              {DELETE_ACCOUNT.UI.TITLE}
            </Typography>
          </View>
          <View style={styles.headerButton} />
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
                    { backgroundColor: `${colors.expense}15` },
                  ]}
                >
                  <Ionicons name="warning" size={32} color={colors.expense} />
                </View>
              </View>

              <View style={styles.warningContent}>
                <Typography variant="body1" style={styles.warningText}>
                  {DELETE_ACCOUNT.UI.WARNING_TITLE}
                </Typography>

                <View style={styles.warningList}>
                  <View style={styles.warningItem}>
                    <Typography variant="body1" color="secondary">
                      • {DELETE_ACCOUNT.MESSAGES.LEAVE_LEDGERS}
                    </Typography>
                  </View>
                  <View style={styles.warningItem}>
                    <Typography variant="body1" color="secondary">
                      • {DELETE_ACCOUNT.MESSAGES.PERMANENT_DELETE}
                    </Typography>
                  </View>
                </View>

                {ownedLedgersWithOtherMembers > 0 && (
                  <View
                    style={[
                      styles.errorBox,
                      { backgroundColor: colors.error + '10' },
                    ]}
                  >
                    <Typography variant="body1" color="error">
                      ⚠️
                      {DELETE_ACCOUNT.MESSAGES.OWNED_LEDGERS_WARNING(
                        ownedLedgersWithOtherMembers
                      )}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="error"
                      style={{ marginTop: 4 }}
                    >
                      {DELETE_ACCOUNT.MESSAGES.TRANSFER_REQUIRED}
                    </Typography>
                  </View>
                )}
                {ownedLedgerCount > 0 && ownedLedgersWithOtherMembers === 0 && (
                  <View
                    style={[
                      styles.infoBox,
                      { backgroundColor: colors.tint + '10' },
                    ]}
                  >
                    <Typography variant="body2" color="primary">
                      ℹ️ 혼자 사용 중인 가계부 {ownedLedgerCount}개는 탈퇴 후 30일 뒤에 자동으로 삭제됩니다.
                    </Typography>
                  </View>
                )}
              </View>

              <View style={styles.buttonContainer}>
                <Button
                  variant="danger"
                  onPress={handleFirstStep}
                  disabled={ownedLedgersWithOtherMembers > 0}
                  fullWidth
                >
                  {DELETE_ACCOUNT.UI.BUTTON_NEXT}
                </Button>
              </View>
            </>
          ) : (
            // Step 2: 최종 확인
            <>
              <View style={styles.stepHeader}>
                <View
                  style={[
                    styles.dangerIconContainer,
                    { backgroundColor: `${colors.expense}15` },
                  ]}
                >
                  <Ionicons name="warning" size={32} color={colors.expense} />
                </View>
                <Typography
                  variant="h1"
                  weight="700"
                  style={{ color: colors.expense, marginTop: 12 }}
                >
                  {DELETE_ACCOUNT.UI.FINAL_CONFIRM_TITLE}
                </Typography>
              </View>

              <View style={styles.confirmContent}>
                <Typography
                  variant="body1"
                  style={[
                    styles.confirmText,
                    { fontSize: 17, marginBottom: 8 },
                  ]}
                >
                  {DELETE_ACCOUNT.UI.FINAL_CONFIRM_QUESTION}
                </Typography>
                <Typography
                  variant="body2"
                  color="secondary"
                  style={[styles.confirmText, { marginBottom: 20 }]}
                >
                  {DELETE_ACCOUNT.UI.INPUT_INSTRUCTION}
                </Typography>

                <View
                  style={[
                    styles.requiredTextBox,
                    {
                      backgroundColor: `${colors.expense}10`,
                      borderColor: colors.expense,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Typography
                    variant="h3"
                    weight="700"
                    style={{ color: colors.expense }}
                  >
                    {requiredText}
                  </Typography>
                </View>

                <View style={styles.inputContainer}>
                  <Typography
                    variant="caption"
                    color="secondary"
                    style={styles.inputLabel}
                  >
                    위 문구를 입력해주세요
                  </Typography>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.background,
                          color: colors.text,
                          borderColor: confirmText
                            ? isConfirmTextValid
                              ? colors.success
                              : colors.expense
                            : colors.border,
                          borderWidth:
                            confirmText && isConfirmTextValid ? 2 : 1,
                        },
                      ]}
                      value={confirmText}
                      onChangeText={setConfirmText}
                      placeholder={DELETE_ACCOUNT.CONFIRM_TEXT}
                      placeholderTextColor={colors.textSecondary}
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {confirmText && (
                      <View style={styles.inputFeedback}>
                        <Ionicons
                          name={
                            isConfirmTextValid
                              ? 'checkmark-circle'
                              : 'close-circle'
                          }
                          size={20}
                          color={
                            isConfirmTextValid ? colors.success : colors.expense
                          }
                        />
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.finalButtonContainer}>
                <Pressable
                  onPress={() => {
                    setStep(1);
                    setConfirmText('');
                  }}
                  style={styles.textButton}
                >
                  <Typography variant="body1" color="secondary">
                    {DELETE_ACCOUNT.UI.BUTTON_PREVIOUS}
                  </Typography>
                </Pressable>
                <Button
                  variant="danger"
                  onPress={handleFinalConfirm}
                  disabled={!isConfirmTextValid}
                  fullWidth
                  style={!isConfirmTextValid ? { opacity: 0.4 } : {}}
                >
                  {DELETE_ACCOUNT.UI.BUTTON_DELETE}
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
    position: 'relative',
  },
  headerButton: {
    minWidth: 60,
    alignItems: 'flex-start',
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
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
  infoBox: {
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
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  dangerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    marginTop: 20,
  },
  inputLabel: {
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputFeedback: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  textButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  finalButtonContainer: {
    gap: 8,
    marginTop: 24,
    marginBottom: 20,
  },
});
