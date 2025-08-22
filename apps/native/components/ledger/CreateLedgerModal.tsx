import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, Card } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { useServices } from '@/contexts/ServiceContext';
import { useAuth } from '@/contexts/AuthContext';

interface CreateLedgerModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (ledgerId: string) => void;
}

export function CreateLedgerModal({
  visible,
  onClose,
  onSuccess,
}: CreateLedgerModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { ledgerService } = useServices();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('알림', '가계부 이름을 입력해주세요.');
      return;
    }

    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    setCreating(true);

    try {
      const ledgerId = await ledgerService.createLedger({
        name: name.trim(),
        description: description.trim() || undefined,
        currency: 'KRW', // MVP에서는 KRW 고정
      });

      // 성공 시 모달 닫고 콜백 호출
      onSuccess(ledgerId);
      // 입력 필드 초기화
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Create ledger error:', error);
      Alert.alert('오류', '가계부 생성 중 문제가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (!creating) {
      setName('');
      setDescription('');
      onClose();
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
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          {/* 드래그 핸들 */}
          <View style={styles.dragHandle} />

          {/* 헤더 */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={handleClose} disabled={creating}>
              <Typography variant="body1" color="primary">
                취소
              </Typography>
            </Pressable>
            <Typography variant="h3" weight="600">
              새 가계부 만들기
            </Typography>
            <Pressable
              onPress={handleCreate}
              disabled={!name.trim() || creating}
            >
              <Typography
                variant="body1"
                weight="600"
                color={!name.trim() || creating ? 'disabled' : 'primary'}
              >
                {creating ? '생성 중...' : '만들기'}
              </Typography>
            </Pressable>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 가계부 이름 입력 */}
            <View style={[styles.inputGroup, { marginTop: 20 }]}>
              <Typography
                variant="body2"
                color="secondary"
                style={styles.label}
              >
                가계부 이름 *
              </Typography>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    color: colors.text,
                  },
                ]}
                placeholder="예: 우리집 가계부"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                maxLength={50}
                returnKeyType="next"
                editable={!creating}
              />
            </View>

            {/* 설명 입력 (선택) */}
            <View style={styles.inputGroup}>
              <Typography
                variant="body2"
                color="secondary"
                style={styles.label}
              >
                설명 (선택)
              </Typography>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    color: colors.text,
                  },
                ]}
                placeholder="가계부에 대한 간단한 설명을 입력하세요"
                placeholderTextColor={colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                maxLength={200}
                multiline
                numberOfLines={3}
                editable={!creating}
              />
            </View>

            {/* 안내 메시지 */}
            <Card variant="outlined" style={styles.infoCard}>
              <View style={styles.infoContent}>
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={colors.tint}
                />
                <Typography
                  variant="caption"
                  color="secondary"
                  style={styles.infoText}
                >
                  가계부를 만들면 자동으로 소유자 권한을 갖게 되며, 다른
                  사용자를 초대할 수 있습니다.
                </Typography>
              </View>
            </Card>
          </ScrollView>
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
    paddingHorizontal: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  textArea: {
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  currencyOption: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  infoCard: {
    marginBottom: 20,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    lineHeight: 18,
  },
});
