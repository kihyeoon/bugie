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
                    { backgroundColor: colors.error + '20' },
                  ]}
                >
                  <Ionicons name="warning" size={32} color={colors.error} />
                </View>
              </View>

              <View style={styles.warningContent}>
                <Typography variant="body1" style={styles.warningText}>
                  {DELETE_ACCOUNT.UI.WARNING_TITLE}
                </Typography>

                <View style={styles.warningList}>
                  <View style={styles.warningItem}>
                    <Typography variant="body1" color="secondary">
                      • {DELETE_ACCOUNT.MESSAGES.GRACE_PERIOD}
                    </Typography>
                  </View>
                  <View style={styles.warningItem}>
                    <Typography variant="body1" color="secondary">
                      • {DELETE_ACCOUNT.MESSAGES.PERMANENT_DELETE}
                    </Typography>
                  </View>
                  <View style={styles.warningItem}>
                    <Typography variant="body1" color="secondary">
                      • {DELETE_ACCOUNT.MESSAGES.LEAVE_LEDGERS}
                    </Typography>
                  </View>
                  <View style={styles.warningItem}>
                    <Typography variant="body1" color="secondary">
                      • {DELETE_ACCOUNT.MESSAGES.PRIVACY_PROTECTION}
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
                      ⚠️
                      {DELETE_ACCOUNT.MESSAGES.OWNED_LEDGERS_WARNING(
                        ownedLedgerCount
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
              </View>

              <View style={styles.buttonContainer}>
                <Button
                  variant="danger"
                  onPress={handleFirstStep}
                  disabled={ownedLedgerCount > 0}
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
                <Typography variant="h3" style={styles.title}>
                  {DELETE_ACCOUNT.UI.FINAL_CONFIRM_TITLE}
                </Typography>
              </View>

              <View style={styles.confirmContent}>
                <Typography variant="body1" style={styles.confirmText}>
                  {DELETE_ACCOUNT.UI.FINAL_CONFIRM_QUESTION}
                </Typography>
                <Typography variant="body1" style={styles.confirmText}>
                  {DELETE_ACCOUNT.UI.INPUT_INSTRUCTION}
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
                  placeholder={DELETE_ACCOUNT.UI.INPUT_PLACEHOLDER}
                  placeholderTextColor={colors.textSecondary}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.buttonContainer}>
                <Button
                  variant="secondary"
                  onPress={() => {
                    setStep(1);
                    setConfirmText('');
                  }}
                  fullWidth
                >
                  {DELETE_ACCOUNT.UI.BUTTON_PREVIOUS}
                </Button>
                <Button
                  variant="danger"
                  onPress={handleFinalConfirm}
                  disabled={!isConfirmTextValid}
                  fullWidth
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
});
