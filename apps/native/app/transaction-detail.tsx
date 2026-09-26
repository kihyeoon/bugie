import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTransactionDetail } from '@/hooks/useTransactionDetail';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { getIoniconName } from '@/constants/categories';
import { formatDateKorean } from '@/utils/dateFormatter';
import { EditAmountModal } from '@/components/transaction/EditAmountModal';
import { TransactionInfoRow } from '@/components/transaction/TransactionInfoRow';
import { EditTextModal } from '@/components/shared/EditTextModal';
import { PaidByBottomSheet } from '@/components/shared/PaidByBottomSheet';
import { PaymentMethodBottomSheet } from '@/components/shared/PaymentMethodBottomSheet';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { addYears } from 'date-fns';
import { CategoryBottomSheet } from '@/components/shared/CategorySelector/CategoryBottomSheet';
import { useCategories } from '@/hooks/useCategories';
import { useLedger } from '@/contexts/LedgerContext';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionService, formatLocalDate, parseLocalDate } from '@repo/core';
import type { MemberRole } from '@repo/core';
import { ScreenHeader } from '@/components/shared/ScreenHeader';

const DELETED_USER_LABEL = '탈퇴한 사용자';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const {
    transaction,
    initialLoading,
    error,
    updateTransaction,
    deleteTransaction,
    refetch,
  } = useTransactionDetail(id);
  const {
    categories,
    updateCategory,
    deleteCategory,
    refresh: refreshCategories,
  } = useCategories();
  const { currentLedger } = useLedger();
  const { user } = useAuth();
  const { paymentMethods } = usePaymentMethods();

  // 현재 사용자의 가계부 내 역할을 가져옵니다.
  const getUserRole = (): MemberRole | null => {
    if (!currentLedger || !user) return null;
    const member = currentLedger.ledger_members.find(
      (m) => m.user_id === user.id
    );
    return member?.role || null;
  };

  const userRole = getUserRole();
  const canUpdateTransaction = PermissionService.canDo(
    'updateTransaction',
    userRole
  );
  const canDeleteTransaction = PermissionService.canDo(
    'deleteTransaction',
    userRole
  );

  // 멤버 목록 (지출자 변경용)
  const members = currentLedger?.ledger_members ?? [];
  const isSharedLedger = members.length > 1;

  // 모달 상태들
  const [amountModalVisible, setAmountModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [titleModalVisible, setTitleModalVisible] = useState(false);
  const [memoModalVisible, setMemoModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [paidByModalVisible, setPaidByModalVisible] = useState(false);
  const [paymentMethodModalVisible, setPaymentMethodModalVisible] =
    useState(false);

  // 편집 핸들러들
  const handleAmountSave = useCallback(
    async (amount: number) => {
      try {
        await updateTransaction({ amount });
        // 자연스럽게 변경사항 반영 (Alert 제거)
      } catch {
        Alert.alert('오류', '금액 수정에 실패했습니다.');
      }
    },
    [updateTransaction]
  );

  const handleCategorySave = useCallback(
    async (categoryId: string) => {
      try {
        const selectedCategory = categories.find((c) => c.id === categoryId);
        if (selectedCategory) {
          await updateTransaction({
            categoryId,
            type: selectedCategory.type,
            // 카테고리 정보도 함께 낙관적 업데이트
            category_id: categoryId,
            category_name: selectedCategory.name,
            category_color: selectedCategory.color,
            category_icon: selectedCategory.icon,
          });
          // 자연스럽게 변경사항 반영 (Alert 제거)
        }
      } catch {
        Alert.alert('오류', '카테고리 변경에 실패했습니다.');
      }
    },
    [updateTransaction, categories]
  );

  // 카테고리 수정/삭제 후 거래 상세 데이터도 동기화
  const handleCategoryUpdate = useCallback(
    async (
      categoryId: string,
      updates: { name: string; color: string; icon: string }
    ) => {
      await updateCategory(categoryId, updates);
      refetch();
    },
    [updateCategory, refetch]
  );

  const handleCategoryDelete = useCallback(
    async (categoryId: string) => {
      const result = await deleteCategory(categoryId);
      if (result) {
        refetch();
      }
      return result;
    },
    [deleteCategory, refetch]
  );

  const handleTitleSave = useCallback(
    async (title: string) => {
      try {
        await updateTransaction({ title });
        // 자연스럽게 변경사항 반영 (Alert 제거)
      } catch {
        Alert.alert('오류', '제목 수정에 실패했습니다.');
      }
    },
    [updateTransaction]
  );

  const handleMemoSave = useCallback(
    async (description: string) => {
      try {
        await updateTransaction({ description });
        // 자연스럽게 변경사항 반영 (Alert 제거)
      } catch {
        Alert.alert('오류', '메모 수정에 실패했습니다.');
      }
    },
    [updateTransaction]
  );

  const handlePaymentMethodSave = useCallback(
    async (paymentMethodId: string) => {
      try {
        const selected = paymentMethods.find((m) => m.id === paymentMethodId);
        await updateTransaction({
          paymentMethodId,
          payment_method_id: paymentMethodId,
          payment_method_name: selected?.name ?? null,
          payment_method_icon: selected?.icon ?? null,
          payment_method_is_shared: selected?.isShared ?? null,
        });
      } catch {
        Alert.alert('오류', '결제 수단 변경에 실패했습니다.');
      }
    },
    [updateTransaction, paymentMethods]
  );

  const handlePaymentMethodClear = useCallback(async () => {
    try {
      await updateTransaction({
        paymentMethodId: null,
        payment_method_id: null,
        payment_method_name: null,
        payment_method_icon: null,
        payment_method_is_shared: null,
      });
    } catch {
      Alert.alert('오류', '결제 수단 변경에 실패했습니다.');
    }
  }, [updateTransaction]);

  const handlePaidBySave = useCallback(
    async (paidByUserId: string) => {
      try {
        const selectedMember = members.find((m) => m.user_id === paidByUserId);
        await updateTransaction({
          paidBy: paidByUserId,
          paid_by: paidByUserId,
          paid_by_name: selectedMember?.full_name ?? null,
        });
      } catch {
        Alert.alert('오류', '지출자 변경에 실패했습니다.');
      }
    },
    [updateTransaction, members]
  );

  const handleDateConfirm = useCallback(
    async (date: Date) => {
      try {
        await updateTransaction({
          transactionDate: formatLocalDate(date),
        });
        setDatePickerVisible(false);
        // 자연스럽게 변경사항 반영 (Alert 제거)
      } catch {
        Alert.alert('오류', '날짜 변경에 실패했습니다.');
      }
    },
    [updateTransaction]
  );

  // 삭제 버튼 핸들러
  const handleDelete = useCallback(() => {
    Alert.alert(
      '거래 삭제',
      '이 거래를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction();
              router.back();
            } catch (error) {
              console.error('Delete transaction error:', error);
              Alert.alert('오류', '거래를 삭제할 수 없습니다.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [deleteTransaction]);

  // 분기별 본문을 동일 래퍼로 감싸 헤더를 화면당 1회만 합성.
  const renderScreen = (body: React.ReactNode) => (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="상세 내역" background={colors.background} />
      {body}
    </View>
  );

  // 초기 로딩 상태 (첫 진입 시에만 표시)
  if (initialLoading) {
    return renderScreen(
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // 에러 상태
  if (error || !transaction) {
    return renderScreen(
      <View
        style={[styles.errorContainer, { backgroundColor: colors.background }]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.textSecondary}
        />
        <Typography variant="body1" color="secondary" align="center">
          {error?.message || '거래를 불러올 수 없습니다.'}
        </Typography>
        <Button variant="secondary" onPress={() => router.back()}>
          돌아가기
        </Button>
      </View>
    );
  }

  return renderScreen(
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.contentContainer,
          { backgroundColor: colors.backgroundSecondary },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 상단 금액 섹션 */}
        <View
          style={[styles.amountSection, { backgroundColor: colors.background }]}
        >
          <View style={styles.titleRow}>
            <View
              style={[
                styles.categoryIconSmall,
                { backgroundColor: transaction.category_color + '20' },
              ]}
            >
              <Ionicons
                name={getIoniconName(transaction.category_icon, true)}
                size={20}
                color={transaction.category_color}
              />
            </View>
            <Typography variant="body1" weight="500" style={styles.title}>
              {transaction.title}
            </Typography>
          </View>
          <View style={styles.amountRow}>
            <AmountDisplay
              amount={Number(transaction.amount)}
              type={transaction.type}
              size="large"
              style={styles.amount}
            />
            {canUpdateTransaction && (
              <Pressable
                style={styles.editIcon}
                onPress={() => setAmountModalVisible(true)}
              >
                <Ionicons
                  name="pencil"
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            )}
          </View>
        </View>

        {/* 정보 섹션 */}
        <View
          style={[styles.infoSection, { backgroundColor: colors.background }]}
        >
          <TransactionInfoRow
            label="카테고리 설정"
            value={transaction.category_name}
            onPress={() => setCategoryModalVisible(true)}
            disabled={!canUpdateTransaction}
          />
          <TransactionInfoRow
            label="제목"
            value={transaction.title}
            onPress={() => setTitleModalVisible(true)}
            disabled={!canUpdateTransaction}
          />
          <TransactionInfoRow
            label="메모"
            value={transaction.description}
            placeholder="메모를 남겨보세요"
            multiline
            onPress={() => setMemoModalVisible(true)}
            disabled={!canUpdateTransaction}
          />
          <TransactionInfoRow
            label="거래일"
            value={formatDateKorean(transaction.transaction_date)}
            onPress={() => setDatePickerVisible(true)}
            disabled={!canUpdateTransaction}
          />
          {/* 지출자 - 공유 가계부에서만 표시 */}
          {isSharedLedger && (
            <TransactionInfoRow
              label="지출자"
              value={
                transaction.paid_by
                  ? transaction.paid_by_name || DELETED_USER_LABEL
                  : transaction.created_by_name || DELETED_USER_LABEL
              }
              onPress={() => setPaidByModalVisible(true)}
              disabled={!canUpdateTransaction}
            />
          )}
          {/* 결제 수단 - 지출 거래에서만 표시 */}
          {transaction.type === 'expense' && (
            <TransactionInfoRow
              label="결제 수단"
              value={
                transaction.payment_method_name
                  ? `${transaction.payment_method_name}${transaction.payment_method_is_shared ? ' (공동)' : ''}`
                  : null
              }
              placeholder="미지정"
              onPress={() => setPaymentMethodModalVisible(true)}
              disabled={!canUpdateTransaction}
            />
          )}
          {/* 작성자 - 수정 불가 */}
          <TransactionInfoRow
            label="작성자"
            value={transaction.created_by_name || DELETED_USER_LABEL}
          />
        </View>
      </ScrollView>

      {/* 하단 고정 삭제 버튼 - 권한이 있을 때만 표시 */}
      {canDeleteTransaction && (
        <View
          style={[
            styles.deleteButtonContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <Pressable
            style={[
              styles.deleteButton,
              { backgroundColor: colors.backgroundSecondary },
            ]}
            onPress={handleDelete}
          >
            <Typography
              variant="body1"
              align="center"
              style={{ color: colors.expense }}
            >
              삭제하기
            </Typography>
          </Pressable>
        </View>
      )}

      {/* 편집 모달들 */}
      {transaction && (
        <>
          {/* 금액 편집 모달 */}
          <EditAmountModal
            visible={amountModalVisible}
            initialAmount={Number(transaction.amount)}
            type={transaction.type}
            onSave={handleAmountSave}
            onClose={() => setAmountModalVisible(false)}
          />

          {/* 카테고리 선택 모달 */}
          <CategoryBottomSheet
            visible={categoryModalVisible}
            categories={categories.filter((c) => c.type === transaction.type)}
            selectedCategory={
              categories.find((c) => c.id === transaction.category_id) || null
            }
            onSelectCategory={(category) => {
              if (category) {
                handleCategorySave(category.id);
              }
              setCategoryModalVisible(false);
            }}
            onClose={() => setCategoryModalVisible(false)}
            transactionType={transaction.type}
            onCategoriesRefresh={refreshCategories}
            onUpdateCategory={handleCategoryUpdate}
            onDeleteCategory={handleCategoryDelete}
          />

          {/* 제목 편집 모달 */}
          <EditTextModal
            visible={titleModalVisible}
            title="제목 수정"
            initialValue={transaction.title}
            placeholder="거래 제목을 입력하세요"
            maxLength={50}
            onSave={handleTitleSave}
            onClose={() => setTitleModalVisible(false)}
          />

          {/* 메모 편집 모달 */}
          <EditTextModal
            visible={memoModalVisible}
            title="메모 수정"
            initialValue={transaction.description || ''}
            placeholder="메모를 입력하세요"
            maxLength={200}
            multiline={true}
            onSave={handleMemoSave}
            onClose={() => setMemoModalVisible(false)}
          />

          {/* 날짜 선택 모달 */}
          <DateTimePickerModal
            isVisible={datePickerVisible}
            mode="date"
            onConfirm={handleDateConfirm}
            onCancel={() => setDatePickerVisible(false)}
            date={parseLocalDate(transaction.transaction_date)}
            maximumDate={addYears(new Date(), 1)}
            locale="ko"
            confirmTextIOS="완료"
            cancelTextIOS="취소"
          />

          {/* 결제 수단 선택 바텀시트 */}
          <PaymentMethodBottomSheet
            visible={paymentMethodModalVisible}
            paymentMethods={paymentMethods}
            selectedId={transaction.payment_method_id}
            currentUserId={user?.id}
            onSelect={handlePaymentMethodSave}
            onClear={handlePaymentMethodClear}
            onClose={() => setPaymentMethodModalVisible(false)}
          />

          {/* 지출자 선택 바텀시트 */}
          <PaidByBottomSheet
            visible={paidByModalVisible}
            members={members}
            selectedUserId={transaction.paid_by || transaction.created_by}
            currentUserId={user?.id}
            onSelect={handlePaidBySave}
            onClose={() => setPaidByModalVisible(false)}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  amountSection: {
    alignItems: 'flex-start',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    flexShrink: 1,
  },
  categoryIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  amount: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  editIcon: {
    padding: 8,
  },
  infoSection: {},
  deleteButtonContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  deleteButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
});
