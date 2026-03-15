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
import { getIoniconName } from '@/constants/categories';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, ToggleSwitch, Button, AmountInput } from '@/components/ui';
import { CategorySelector } from '@/components/shared/CategorySelector';
import { PaidByBottomSheet } from '@/components/shared/PaidByBottomSheet';
import { PaymentMethodBottomSheet } from '@/components/shared/PaymentMethodBottomSheet';
import { useCategories } from '@/hooks/useCategories';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useLedger } from '@/contexts/LedgerContext';
import { useServices } from '@/contexts/ServiceContext';
import { useAuth } from '@/contexts/AuthContext';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { PermissionService } from '@repo/core';
import type { CategoryDetail, MemberRole } from '@repo/core';

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
  const [selectedPaidBy, setSelectedPaidBy] = useState<string | null>(null);
  const [paidBySheetVisible, setPaidBySheetVisible] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(null);
  const [paymentMethodSheetVisible, setPaymentMethodSheetVisible] =
    useState(false);

  // Input refs for focus management
  const titleInputRef = useRef<TextInput>(null);
  const memoInputRef = useRef<TextInput>(null);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { currentLedger } = useLedger();
  const { transactionService } = useServices();
  const { user } = useAuth();
  const {
    paymentMethods,
    create: createPaymentMethod,
    update: updatePaymentMethod,
    softDelete: deletePaymentMethod,
  } = usePaymentMethods();

  // 결제 수단 관리 권한
  const userRole = (() => {
    if (!currentLedger || !user) return null;
    const member = currentLedger.ledger_members.find(
      (m) => m.user_id === user.id
    );
    return (member?.role as MemberRole) ?? null;
  })();
  const canCreatePM = PermissionService.canDo('createPaymentMethod', userRole);
  const canUpdatePM = PermissionService.canDo('updatePaymentMethod', userRole);
  const canDeletePM = PermissionService.canDo('deletePaymentMethod', userRole);

  // 현재 유저를 기본 지출자로 설정
  useEffect(() => {
    if (user && !selectedPaidBy) {
      setSelectedPaidBy(user.id);
    }
  }, [user, selectedPaidBy]);

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
    setSelectedPaidBy(user?.id ?? null);
    setSelectedPaymentMethodId(null);
    // transactionType은 사용자 편의를 위해 유지
  }, [user]);

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
        paidBy: selectedPaidBy ?? undefined,
        paymentMethodId: selectedPaymentMethodId ?? undefined,
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
                // 수입 전환 시 결제 수단 초기화
                if (newType === 'income') {
                  setSelectedPaymentMethodId(null);
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

          {/* 지출자 선택 (공유 가계부에서만 표시) */}
          {currentLedger && currentLedger.ledger_members.length > 1 && (
            <View style={styles.paidBySection}>
              <TouchableOpacity
                style={[
                  styles.paidByInput,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
                onPress={() => setPaidBySheetVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={colors.textSecondary}
                  style={styles.paidByIcon}
                />
                <Text
                  style={[styles.paidByText, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {currentLedger.ledger_members.find(
                    (m) => m.user_id === selectedPaidBy
                  )?.full_name || '지출자 선택'}
                </Text>
                {selectedPaidBy === user?.id && (
                  <View
                    style={[
                      styles.paidByBadge,
                      { backgroundColor: colors.tint + '15' },
                    ]}
                  >
                    <Text
                      style={[styles.paidByBadgeText, { color: colors.tint }]}
                    >
                      나
                    </Text>
                  </View>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* 결제 수단 선택 (지출일 때만) */}
          {transactionType === 'expense' && (
            <View style={styles.paidBySection}>
              <TouchableOpacity
                style={[
                  styles.paidByInput,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
                onPress={() => setPaymentMethodSheetVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={getIoniconName(
                    paymentMethods.find((m) => m.id === selectedPaymentMethodId)
                      ?.icon ?? 'card',
                    true
                  )}
                  size={20}
                  color={colors.textSecondary}
                  style={styles.paidByIcon}
                />
                <Text
                  style={[
                    styles.paidByText,
                    {
                      color: selectedPaymentMethodId
                        ? colors.text
                        : colors.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {paymentMethods.find((m) => m.id === selectedPaymentMethodId)
                    ?.name || '결제 수단 (선택)'}
                </Text>
                {paymentMethods.find((m) => m.id === selectedPaymentMethodId)
                  ?.isShared && (
                  <View
                    style={[
                      styles.paidByBadge,
                      { backgroundColor: colors.tint + '15' },
                    ]}
                  >
                    <Text
                      style={[styles.paidByBadgeText, { color: colors.tint }]}
                    >
                      공동
                    </Text>
                  </View>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )}

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

      {/* 지출자 선택 바텀시트 */}
      {currentLedger && currentLedger.ledger_members.length > 1 && (
        <PaidByBottomSheet
          visible={paidBySheetVisible}
          members={currentLedger.ledger_members}
          selectedUserId={selectedPaidBy}
          currentUserId={user?.id}
          onSelect={(userId) => {
            setSelectedPaidBy(userId);
          }}
          onClose={() => setPaidBySheetVisible(false)}
        />
      )}
      {/* 결제 수단 선택 바텀시트 */}
      <PaymentMethodBottomSheet
        visible={paymentMethodSheetVisible}
        paymentMethods={paymentMethods}
        selectedId={selectedPaymentMethodId}
        currentUserId={user?.id}
        onSelect={(id) => setSelectedPaymentMethodId(id)}
        onClear={() => setSelectedPaymentMethodId(null)}
        onClose={() => setPaymentMethodSheetVisible(false)}
        onAdd={canCreatePM ? createPaymentMethod : undefined}
        onUpdate={canUpdatePM ? updatePaymentMethod : undefined}
        onDelete={canDeletePM ? deletePaymentMethod : undefined}
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
  paidBySection: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  paidByInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    height: 52,
  },
  paidByIcon: {
    marginRight: 10,
  },
  paidByText: {
    fontSize: 15,
    letterSpacing: -0.3,
    flex: 1,
  },
  paidByBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  paidByBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  saveButtonContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.select({
      ios: 24,
      android: 20,
    }),
  },
});
