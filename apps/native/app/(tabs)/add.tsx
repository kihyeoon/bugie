import {
  StyleSheet,
  TextInput,
  View,
  ScrollView,
  Keyboard,
  Alert,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, ToggleSwitch, Button, AmountInput } from '@/components/ui';
import { CategorySelector } from '@/components/shared/CategorySelector';
import { useCategories } from '@/hooks/useCategories';
import { useLedger } from '@/contexts/LedgerContext';
import { useServices } from '@/contexts/ServiceContext';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import type { CategoryDetail } from '@repo/core';

export default function AddTransactionScreen() {
  const [amount, setAmount] = useState(0);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>(
    'expense'
  );
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryDetail | null>(null);
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [saving, setSaving] = useState(false);

  // Input refs for focus management
  const titleInputRef = useRef<TextInput>(null);
  const memoInputRef = useRef<TextInput>(null);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { currentLedger } = useLedger();
  const { transactionService } = useServices();

  // 실제 DB에서 카테고리 가져오기
  const {
    categories,
    loading: categoriesLoading,
    refresh: refreshCategories,
    updateCategory,
    deleteCategory,
  } = useCategories(transactionType);

  // 날짜 포맷팅 함수
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekDay})`;
  };

  // 날짜 선택 핸들러
  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date: Date) => {
    setSelectedDate(date);
    hideDatePicker();
  };

  // 폼 초기화 함수
  const resetForm = useCallback(() => {
    setAmount(0);
    setSelectedCategory(null);
    setTitle('');
    setMemo('');
    setSelectedDate(new Date());
    // transactionType은 사용자 편의를 위해 유지
  }, []);

  // 카테고리가 수정/삭제되면 선택된 카테고리도 자동 업데이트
  useEffect(() => {
    setSelectedCategory((prev) => {
      if (!prev) return prev;

      const updatedCategory = categories.find((cat) => cat.id === prev.id);
      if (!updatedCategory) {
        // 카테고리가 삭제된 경우 - 선택 해제
        return null;
      } else if (
        updatedCategory.name !== prev.name ||
        updatedCategory.color !== prev.color ||
        updatedCategory.icon !== prev.icon
      ) {
        // 카테고리가 수정된 경우 - 최신 데이터로 업데이트
        return updatedCategory;
      }

      return prev;
    });
  }, [categories]);

  const handleSave = async () => {
    // 유효성 검사
    if (!currentLedger) {
      Alert.alert('알림', '가계부를 선택해주세요.');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('알림', '카테고리를 선택해주세요.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('알림', '거래 제목을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);

      // 데이터 준비
      const transactionInput = {
        ledgerId: currentLedger.id,
        categoryId: selectedCategory.id,
        amount: amount,
        type: transactionType,
        title: title.trim(),
        description: memo || undefined,
        transactionDate: format(selectedDate, 'yyyy-MM-dd'),
      };

      // 거래 저장
      await transactionService.createTransaction(transactionInput);

      // 성공 - 폼 초기화 후 홈 화면으로 이동
      resetForm();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('거래 저장 실패:', error);
      Alert.alert(
        '저장 실패',
        '거래 저장 중 오류가 발생했습니다. 다시 시도해주세요.'
      );
    } finally {
      setSaving(false);
    }
  };

  // 저장 버튼 활성화 여부
  const isSaveDisabled =
    amount === 0 || !selectedCategory || !title.trim() || saving;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 헤더 */}
          <View style={styles.header}>
            <Typography variant="h2" style={{ marginBottom: 20 }}>
              빠른 입력
            </Typography>

            {/* 수입/지출 토글 */}
            <ToggleSwitch
              options={[
                { label: '수입', value: 'income', color: colors.income },
                { label: '지출', value: 'expense', color: colors.expense },
              ]}
              value={transactionType}
              onChange={(value) => {
                const newType = value as 'income' | 'expense';
                setTransactionType(newType);
                // 타입이 변경되면 선택된 카테고리 초기화
                if (selectedCategory && selectedCategory.type !== newType) {
                  setSelectedCategory(null);
                }
              }}
              fullWidth
            />
          </View>

          {/* 금액 표시 및 편집 */}
          <AmountInput
            value={amount}
            onChange={setAmount}
            type={transactionType}
            style={styles.amountContainer}
            onSubmitEditing={() => {
              // 금액 입력 후 카테고리가 선택되어 있으면 제목으로, 아니면 카테고리 선택
              if (selectedCategory) {
                titleInputRef.current?.focus();
              }
            }}
          />

          {/* 카테고리 선택 */}
          <View style={styles.categorySection}>
            <CategorySelector
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={(category) => {
                setSelectedCategory(category);
                // 카테고리 선택 후 자동으로 제목 필드로 포커스 이동
                if (category) {
                  setTimeout(() => {
                    titleInputRef.current?.focus();
                  }, 100);
                }
              }}
              transactionType={transactionType}
              loading={categoriesLoading}
              placeholder="카테고리를 선택하세요"
              onCategoriesRefresh={refreshCategories}
              onUpdateCategory={updateCategory}
              onDeleteCategory={deleteCategory}
            />
          </View>

          {/* 날짜 선택 */}
          <View style={styles.dateSection}>
            <TouchableOpacity
              style={[
                styles.dateInput,
                {
                  backgroundColor: colors.backgroundSecondary,
                },
              ]}
              onPress={showDatePicker}
              activeOpacity={0.7}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={colors.textSecondary}
                style={styles.dateIcon}
              />
              <Text style={[styles.dateText, { color: colors.text }]}>
                {formatDate(selectedDate)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 제목 입력 */}
          <View style={styles.titleSection}>
            <TextInput
              ref={titleInputRef}
              style={[
                styles.titleInput,
                {
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.text,
                },
              ]}
              placeholder="거래 제목 (필수)"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
              maxLength={50}
              onSubmitEditing={() => {
                memoInputRef.current?.focus();
              }}
            />
          </View>

          {/* 메모 입력 */}
          <View style={styles.memoSection}>
            <TextInput
              ref={memoInputRef}
              style={[
                styles.memoInput,
                {
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.text,
                },
              ]}
              placeholder="메모 입력 (선택)"
              placeholderTextColor={colors.textSecondary}
              value={memo}
              onChangeText={setMemo}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              maxLength={200}
            />
          </View>

          {/* 저장 버튼 */}
          <View style={styles.saveButtonContainer}>
            <Button
              variant="primary"
              size="large"
              fullWidth
              disabled={isSaveDisabled}
              onPress={handleSave}
            >
              {saving ? '저장 중...' : '저장하기'}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* DateTimePicker Modal - 모든 플랫폼 */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
        date={selectedDate}
        maximumDate={new Date()}
        locale="ko"
        confirmTextIOS="완료"
        cancelTextIOS="취소"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    paddingTop: Platform.select({
      ios: 10,
      android: 20,
    }),
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  amountContainer: {
    paddingVertical: 8,
  },
  amount: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
  },
  categorySection: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  titleSection: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  titleInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    letterSpacing: -0.3,
    height: 52,
  },
  dateSection: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    height: 52,
  },
  dateIcon: {
    marginRight: 10,
  },
  dateText: {
    fontSize: 15,
    letterSpacing: -0.3,
    flex: 1,
  },
  memoSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
    minHeight: 60,
  },
  memoInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    letterSpacing: -0.3,
    height: 52,
  },
  saveButtonContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.select({
      ios: 24,
      android: 20,
    }),
  },
});
