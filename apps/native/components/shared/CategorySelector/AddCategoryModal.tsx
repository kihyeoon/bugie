import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ToggleSwitch } from '@/components/ui';
import type { CategoryType } from '@repo/core';
import {
  CATEGORY_COLOR_PALETTE,
  SELECTABLE_ICONS,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON_IONICON,
  getDbIconName,
} from '@/constants/categories';

interface AddCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (category: {
    name: string;
    type: CategoryType;
    color: string;
    icon: string;
  }) => Promise<void>;
  initialType?: CategoryType;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.75;

export function AddCategoryModal({
  visible,
  onClose,
  onSave,
  initialType = 'expense',
}: AddCategoryModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<CategoryType>(initialType);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [selectedIcon, setSelectedIcon] = useState<
    keyof typeof Ionicons.glyphMap
  >(DEFAULT_CATEGORY_ICON_IONICON);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const translateY = useRef(new Animated.Value(MODAL_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // 열기 애니메이션
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  const handleClose = () => {
    // 닫기 애니메이션
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: MODAL_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Reset state
      setCategoryName('');
      setCategoryType(initialType);
      setSelectedColor(DEFAULT_CATEGORY_COLOR);
      setSelectedIcon(DEFAULT_CATEGORY_ICON_IONICON);
      setShowColorPicker(false);
      setShowIconPicker(false);
      onClose();
    });
  };

  const handleSave = async () => {
    // 유효성 검사
    if (!categoryName.trim()) {
      Alert.alert('알림', '카테고리 이름을 입력해주세요.');
      return;
    }

    if (categoryName.trim().length < 2 || categoryName.trim().length > 20) {
      Alert.alert('알림', '카테고리 이름은 2-20자 사이로 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      await onSave({
        name: categoryName.trim(),
        type: categoryType,
        color: selectedColor,
        icon: getDbIconName(selectedIcon),
      });
      handleClose();
    } catch (error) {
      console.error('Failed to save category:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : '카테고리 저장에 실패했습니다. 다시 시도해주세요.';
      Alert.alert('오류', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const renderColorPicker = () => (
    <View style={styles.pickerContainer}>
      <Text style={[styles.pickerTitle, { color: colors.text }]}>
        색상 선택
      </Text>
      <View style={styles.colorGrid}>
        {CATEGORY_COLOR_PALETTE.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorItem,
              { backgroundColor: color },
              selectedColor === color && styles.selectedColorItem,
            ]}
            onPress={() => {
              setSelectedColor(color);
              setShowColorPicker(false);
            }}
            activeOpacity={0.7}
          >
            {selectedColor === color && (
              <Ionicons name="checkmark" size={20} color="white" />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderIconPicker = () => (
    <View style={styles.pickerContainer}>
      <Text style={[styles.pickerTitle, { color: colors.text }]}>
        아이콘 선택
      </Text>
      <ScrollView style={styles.iconScrollView}>
        <View style={styles.iconGrid}>
          {SELECTABLE_ICONS.map((icon) => (
            <TouchableOpacity
              key={icon.name}
              style={[
                styles.iconItem,
                { backgroundColor: colors.backgroundSecondary },
                selectedIcon === icon.name && { backgroundColor: colors.tint },
              ]}
              onPress={() => {
                setSelectedIcon(icon.name);
                setShowIconPicker(false);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={icon.name}
                size={28}
                color={selectedIcon === icon.name ? 'white' : colors.text}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* 배경 딤 처리 */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: opacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.5],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* 모달 컨텐츠 */}
        <Animated.View
          style={[
            styles.modal,
            {
              backgroundColor: colors.background,
              height: MODAL_HEIGHT + insets.bottom,
              transform: [{ translateY }],
            },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            {/* 헤더 */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                커스텀 카테고리 추가
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* 카테고리 이름 입력 */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.text }]}>
                  카테고리 이름 *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      color: colors.text,
                    },
                  ]}
                  placeholder="예: 반려동물, 구독료, 기부금"
                  placeholderTextColor={colors.textSecondary}
                  value={categoryName}
                  onChangeText={setCategoryName}
                  maxLength={20}
                  autoFocus
                />
                <Text
                  style={[styles.helperText, { color: colors.textSecondary }]}
                >
                  {categoryName.length}/20
                </Text>
              </View>

              {/* 수입/지출 선택 */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.text }]}>
                  카테고리 유형
                </Text>
                <ToggleSwitch
                  options={[
                    { label: '수입', value: 'income', color: colors.income },
                    { label: '지출', value: 'expense', color: colors.expense },
                  ]}
                  value={categoryType}
                  onChange={(value) => setCategoryType(value as CategoryType)}
                  fullWidth
                />
              </View>

              {/* 색상 선택 */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.text }]}>색상</Text>
                <TouchableOpacity
                  style={[
                    styles.selectorButton,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}
                  onPress={() => setShowColorPicker(!showColorPicker)}
                  activeOpacity={0.7}
                >
                  <View style={styles.selectorContent}>
                    <View
                      style={[
                        styles.colorPreview,
                        { backgroundColor: selectedColor },
                      ]}
                    />
                    <Text style={[styles.selectorText, { color: colors.text }]}>
                      색상 선택
                    </Text>
                  </View>
                  <Ionicons
                    name={showColorPicker ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
                {showColorPicker && renderColorPicker()}
              </View>

              {/* 아이콘 선택 */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.text }]}>
                  아이콘
                </Text>
                <TouchableOpacity
                  style={[
                    styles.selectorButton,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}
                  onPress={() => setShowIconPicker(!showIconPicker)}
                  activeOpacity={0.7}
                >
                  <View style={styles.selectorContent}>
                    <Ionicons
                      name={selectedIcon}
                      size={24}
                      color={selectedColor}
                    />
                    <Text style={[styles.selectorText, { color: colors.text }]}>
                      아이콘 선택
                    </Text>
                  </View>
                  <Ionicons
                    name={showIconPicker ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
                {showIconPicker && renderIconPicker()}
              </View>

              {/* 미리보기 */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.text }]}>
                  미리보기
                </Text>
                <View
                  style={[
                    styles.previewCard,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}
                >
                  <View
                    style={[
                      styles.previewIcon,
                      { backgroundColor: `${selectedColor}20` },
                    ]}
                  >
                    <Ionicons
                      name={selectedIcon}
                      size={32}
                      color={selectedColor}
                    />
                  </View>
                  <Text style={[styles.previewName, { color: colors.text }]}>
                    {categoryName || '카테고리 이름'}
                  </Text>
                  <Text
                    style={[
                      styles.previewType,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {categoryType === 'income' ? '수입' : '지출'}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* 액션 버튼 */}
            <View
              style={[
                styles.footer,
                {
                  paddingBottom: insets.bottom || 20,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={saving}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.saveButton,
                  { backgroundColor: colors.tint },
                  (!categoryName.trim() || saving) && styles.disabledButton,
                ]}
                onPress={handleSave}
                disabled={!categoryName.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.buttonText, { color: 'white' }]}>
                    저장
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  modal: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E8EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    letterSpacing: -0.3,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectorText: {
    fontSize: 16,
    letterSpacing: -0.3,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  pickerContainer: {
    marginTop: 12,
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: -0.2,
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
  selectedColorItem: {
    borderWidth: 3,
    borderColor: 'white',
  },
  iconScrollView: {
    maxHeight: 200,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconItem: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  previewIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.5,
    flex: 1,
  },
  previewType: {
    fontSize: 14,
    letterSpacing: -0.3,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  saveButton: {},
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
