import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { PAYMENT_METHOD_ICONS } from '@/constants/paymentMethods';
import { getIoniconName } from '@/constants/categories';
import type { PaymentMethodEntity, UpdatePaymentMethodInput } from '@repo/core';
import { PaymentMethodRules } from '@repo/core';

interface EditPaymentMethodModalProps {
  visible: boolean;
  paymentMethod: PaymentMethodEntity | null;
  onSave: (id: string, input: UpdatePaymentMethodInput) => Promise<void>;
  onClose: () => void;
}

export function EditPaymentMethodModal({
  visible,
  paymentMethod,
  onSave,
  onClose,
}: EditPaymentMethodModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);

  // 모달 열릴 때 기존 값으로 초기화
  useEffect(() => {
    if (paymentMethod && visible) {
      setName(paymentMethod.name);
      setSelectedIcon(paymentMethod.icon);
      setIsShared(paymentMethod.isShared);
    }
  }, [paymentMethod, visible]);

  const hasChanges =
    paymentMethod &&
    (name !== paymentMethod.name ||
      selectedIcon !== paymentMethod.icon ||
      isShared !== paymentMethod.isShared);

  const handleSave = async () => {
    if (!paymentMethod || !name.trim() || !hasChanges) return;

    setSaving(true);
    try {
      const updates: UpdatePaymentMethodInput = {};
      if (name !== paymentMethod.name) updates.name = name.trim();
      if (selectedIcon !== paymentMethod.icon) updates.icon = selectedIcon;
      if (isShared !== paymentMethod.isShared) updates.isShared = isShared;

      await onSave(paymentMethod.id, updates);
      onClose();
    } catch {
      // 에러는 usePaymentMethods에서 Alert 처리
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Typography variant="h3" weight="600">
            결제 수단 수정
          </Typography>
          <View style={styles.closeButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 미리보기 */}
          <View
            style={[
              styles.preview,
              { backgroundColor: colors.backgroundSecondary },
            ]}
          >
            <View
              style={[
                styles.previewIcon,
                { backgroundColor: colors.tint + '15' },
              ]}
            >
              <Ionicons
                name={getIoniconName(selectedIcon)}
                size={28}
                color={colors.tint}
              />
            </View>
            <Typography variant="body1" weight="600">
              {name || '결제 수단 이름'}
            </Typography>
            {isShared && (
              <View
                style={[
                  styles.previewBadge,
                  { backgroundColor: colors.tint + '15' },
                ]}
              >
                <Typography
                  variant="caption"
                  style={{ color: colors.tint, fontWeight: '700' }}
                >
                  공동
                </Typography>
              </View>
            )}
          </View>

          {/* 이름 입력 */}
          <View style={styles.section}>
            <Typography
              variant="body2"
              color="secondary"
              style={styles.sectionLabel}
            >
              이름
            </Typography>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.text,
                },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="결제 수단 이름"
              placeholderTextColor={colors.textSecondary}
              maxLength={PaymentMethodRules.MAX_NAME_LENGTH}
            />
          </View>

          {/* 아이콘 선택 */}
          <View style={styles.section}>
            <Typography
              variant="body2"
              color="secondary"
              style={styles.sectionLabel}
            >
              아이콘
            </Typography>
            <View style={styles.iconGrid}>
              {PAYMENT_METHOD_ICONS.map((icon) => {
                const isSelected = icon.dbValue === selectedIcon;
                return (
                  <Pressable
                    key={icon.dbValue}
                    style={[
                      styles.iconItem,
                      {
                        backgroundColor: isSelected
                          ? colors.tint + '20'
                          : colors.backgroundSecondary,
                        borderColor: isSelected ? colors.tint : 'transparent',
                      },
                    ]}
                    onPress={() => setSelectedIcon(icon.dbValue)}
                  >
                    <Ionicons
                      name={icon.name}
                      size={28}
                      color={isSelected ? colors.tint : colors.textSecondary}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 공동 여부 토글 */}
          <View style={styles.section}>
            <Typography
              variant="body2"
              color="secondary"
              style={styles.sectionLabel}
            >
              공동 결제 수단
            </Typography>
            <View
              style={[
                styles.toggleRow,
                { backgroundColor: colors.backgroundSecondary },
              ]}
            >
              <View style={styles.toggleTextContainer}>
                <Typography variant="body1">공동 수단으로 설정</Typography>
                <Typography variant="caption" color="secondary">
                  공동 지출에 사용하는 결제 수단
                </Typography>
              </View>
              <Switch
                value={isShared}
                onValueChange={setIsShared}
                trackColor={{ false: '#E5E5EA', true: colors.tint }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </ScrollView>

        {/* 저장 버튼 */}
        <View style={styles.footer}>
          <Button
            variant="primary"
            size="large"
            fullWidth
            disabled={!name.trim() || !hasChanges || saving}
            onPress={handleSave}
          >
            {saving ? '저장 중...' : '수정하기'}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  previewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    height: 52,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  iconItem: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 40,
  },
});
