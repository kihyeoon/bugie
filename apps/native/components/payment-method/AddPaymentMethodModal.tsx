import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { PAYMENT_METHOD_ICONS, DEFAULT_PAYMENT_METHOD_ICON } from '@/constants/paymentMethods';
import { getIoniconName } from '@/constants/categories';
import { PaymentMethodRules } from '@repo/core';

interface AddPaymentMethodModalProps {
  visible: boolean;
  onSave: (input: { name: string; icon: string; isShared: boolean }) => Promise<void>;
  onClose: () => void;
}

export function AddPaymentMethodModal({
  visible,
  onSave,
  onClose,
}: AddPaymentMethodModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(DEFAULT_PAYMENT_METHOD_ICON);
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetAndClose = () => {
    setName('');
    setSelectedIcon(DEFAULT_PAYMENT_METHOD_ICON);
    setIsShared(false);
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), icon: selectedIcon, isShared });
      resetAndClose();
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
      onRequestClose={resetAndClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Pressable onPress={resetAndClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Typography variant="h3" weight="600">
            결제 수단 추가
          </Typography>
          <View style={styles.closeButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 미리보기 */}
          <View style={[styles.preview, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.previewIcon, { backgroundColor: colors.tint + '15' }]}>
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
              <View style={[styles.previewBadge, { backgroundColor: colors.tint + '15' }]}>
                <Typography variant="caption" style={{ color: colors.tint, fontWeight: '700' }}>
                  공동
                </Typography>
              </View>
            )}
          </View>

          {/* 이름 입력 */}
          <View style={styles.section}>
            <Typography variant="body2" color="secondary" style={styles.sectionLabel}>
              이름
            </Typography>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.backgroundSecondary, color: colors.text },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="예: 국민카드, 현금"
              placeholderTextColor={colors.textSecondary}
              maxLength={PaymentMethodRules.MAX_NAME_LENGTH}
              autoFocus
            />
          </View>

          {/* 아이콘 선택 */}
          <View style={styles.section}>
            <Typography variant="body2" color="secondary" style={styles.sectionLabel}>
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
                      size={24}
                      color={isSelected ? colors.tint : colors.textSecondary}
                    />
                    <Typography
                      variant="caption"
                      color={isSelected ? 'primary' : 'secondary'}
                      style={{ marginTop: 4 }}
                    >
                      {icon.label}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 공동 여부 토글 */}
          <View style={styles.section}>
            <Typography variant="body2" color="secondary" style={styles.sectionLabel}>
              공동 결제 수단
            </Typography>
            <View style={[styles.toggleRow, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.toggleTextContainer}>
                <Typography variant="body1">공동 수단으로 설정</Typography>
                <Typography variant="caption" color="secondary">
                  모든 멤버가 사용할 수 있는 결제 수단
                </Typography>
              </View>
              <ToggleSwitch
                options={[
                  { label: '개인', value: 'personal' },
                  { label: '공동', value: 'shared' },
                ]}
                value={isShared ? 'shared' : 'personal'}
                onChange={(v) => setIsShared(v === 'shared')}
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
            disabled={!name.trim() || saving}
            onPress={handleSave}
          >
            {saving ? '저장 중...' : '추가하기'}
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
    gap: 10,
  },
  iconItem: {
    width: 72,
    height: 72,
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
