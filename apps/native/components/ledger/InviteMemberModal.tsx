import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { IconSymbol } from '@/components/ui/IconSymbol';
import type { MemberRole } from '@repo/core';

interface InviteMemberModalProps {
  visible: boolean;
  ledgerId: string;
  onInvite: (email: string, role: MemberRole) => Promise<void>;
  onClose: () => void;
}

export function InviteMemberModal({
  visible,
  onInvite,
  onClose,
}: InviteMemberModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [email, setEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  // MVP에서는 member 권한만 초대 가능
  const inviteRole: MemberRole = 'member';

  const handleClose = () => {
    setEmail('');
    onClose();
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInvite = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      Alert.alert('오류', '이메일을 입력해주세요.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      Alert.alert('오류', '올바른 이메일 형식이 아닙니다.');
      return;
    }

    setIsInviting(true);
    try {
      await onInvite(trimmedEmail, inviteRole);
      Alert.alert('성공', '멤버 초대가 완료되었습니다.', [
        { text: '확인', onPress: handleClose },
      ]);
    } catch (error) {
      let errorMessage = '초대 중 문제가 발생했습니다.';

      if (error instanceof Error) {
        if (error.message.includes('사용자를 찾을 수 없습니다')) {
          errorMessage = '해당 이메일로 가입한 사용자가 없습니다.';
        } else if (error.message.includes('이미 가계부 멤버입니다')) {
          errorMessage = '이미 초대된 멤버입니다.';
        }
      }

      Alert.alert('오류', errorMessage);
    } finally {
      setIsInviting(false);
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
          <Pressable onPress={handleClose} disabled={isInviting}>
            <Typography variant="body1" color="primary">
              취소
            </Typography>
          </Pressable>
          <Typography variant="h3" weight="600">
            멤버 초대
          </Typography>
          <Pressable onPress={handleInvite} disabled={isInviting}>
            {isInviting ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <Typography variant="body1" weight="600" color="primary">
                초대
              </Typography>
            )}
          </Pressable>
        </View>

        {/* 컨텐츠 */}
        <View style={styles.content}>
          {/* 이메일 입력 */}
          <View style={styles.section}>
            <Typography
              variant="caption"
              color="secondary"
              style={styles.label}
            >
              이메일 주소
            </Typography>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.text,
                },
              ]}
              placeholder="example@email.com"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isInviting}
            />
          </View>

          {/* 권한 안내 - MVP에서는 member 권한만 초대 */}
          <View style={styles.section}>
            <Typography
              variant="caption"
              color="secondary"
              style={styles.label}
            >
              초대 권한
            </Typography>
            <View
              style={[
                styles.roleOption,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.roleIconContainer}>
                <IconSymbol name="person.fill" size={20} color={colors.text} />
              </View>
              <View style={styles.roleInfo}>
                <Typography variant="body1" weight="600">
                  멤버
                </Typography>
                <Typography variant="caption" color="secondary">
                  거래 입력 및 수정 가능
                </Typography>
              </View>
            </View>
          </View>

          {/* 안내 메시지 */}
          <View style={styles.infoSection}>
            <Typography
              variant="caption"
              color="secondary"
              style={styles.infoText}
            >
              초대할 사용자는 Bugie 계정이 있어야 합니다.
              {'\n'}
              초대 후 즉시 가계부에 접근할 수 있습니다.
            </Typography>
          </View>
        </View>
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
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  label: {
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
  },
  selectedRole: {
    borderWidth: 2,
  },
  roleIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleInfo: {
    flex: 1,
  },
  infoSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  infoText: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
