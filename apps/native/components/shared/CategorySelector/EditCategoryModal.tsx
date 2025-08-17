import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { Category } from '@repo/types';
import {
  CATEGORY_COLOR_PALETTE,
  SELECTABLE_ICONS,
} from '@/constants/categories';

interface EditCategoryModalProps {
  visible: boolean;
  category: Category | null;
  onSave: (
    categoryId: string,
    updates: { name: string; color: string; icon: string }
  ) => Promise<void>;
  onClose: () => void;
}

export default function EditCategoryModal({
  visible,
  category,
  onSave,
  onClose,
}: EditCategoryModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 카테고리 정보로 초기화
  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setSelectedColor(category.color);
      setSelectedIcon(category.icon);
    }
  }, [category]);

  const handleSave = async () => {
    if (!category) return;

    // 유효성 검사
    if (!name.trim()) {
      Alert.alert('입력 오류', '카테고리 이름을 입력해주세요.');
      return;
    }

    if (name.trim().length > 20) {
      Alert.alert('입력 오류', '카테고리 이름은 20자 이내로 입력해주세요.');
      return;
    }

    // 변경사항 확인
    const hasChanges =
      name !== category.name ||
      selectedColor !== category.color ||
      selectedIcon !== category.icon;

    if (!hasChanges) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(category.id, {
        name: name.trim(),
        color: selectedColor,
        icon: selectedIcon,
      });
      onClose();
    } catch (error) {
      console.error('Failed to update category:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : '카테고리 수정 중 오류가 발생했습니다.';
      Alert.alert('수정 실패', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible || !category) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={[styles.cancelButton, { color: colors.tint }]}>
                취소
              </Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>
              카테고리 수정
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              activeOpacity={0.7}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.saveButton,
                  { color: isSaving ? colors.textDisabled : colors.tint },
                ]}
              >
                저장
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* 카테고리 이름 입력 */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                카테고리 이름
              </Text>
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
                placeholder="카테고리 이름 입력"
                placeholderTextColor={colors.textSecondary}
                maxLength={20}
                autoFocus
              />
              <Text style={[styles.charCount, { color: colors.textSecondary }]}>
                {name.length}/20
              </Text>
            </View>

            {/* 색상 선택 */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                색상 선택
              </Text>
              <View style={styles.colorGrid}>
                {CATEGORY_COLOR_PALETTE.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorItem,
                      { backgroundColor: color },
                      selectedColor === color && styles.selectedColor,
                    ]}
                    onPress={() => setSelectedColor(color)}
                    activeOpacity={0.7}
                  >
                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 아이콘 선택 */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                아이콘 선택
              </Text>
              <View style={styles.iconGrid}>
                {SELECTABLE_ICONS.map((icon) => {
                  const ioniconsName =
                    icon.name as keyof typeof Ionicons.glyphMap;
                  return (
                    <TouchableOpacity
                      key={icon.name}
                      style={[
                        styles.iconItem,
                        {
                          backgroundColor:
                            selectedIcon === icon.dbValue
                              ? selectedColor || colors.tint
                              : colors.backgroundSecondary,
                        },
                      ]}
                      onPress={() => setSelectedIcon(icon.dbValue)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={ioniconsName}
                        size={28}
                        color={
                          selectedIcon === icon.dbValue ? 'white' : colors.text
                        }
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  cancelButton: {
    fontSize: 17,
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  saveButton: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    letterSpacing: -0.3,
  },
  charCount: {
    fontSize: 13,
    letterSpacing: -0.2,
    marginTop: 8,
    textAlign: 'right',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedColor: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
  },
});
