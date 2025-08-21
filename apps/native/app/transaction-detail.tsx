import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
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
import { EditTextModal } from '@/components/transaction/EditTextModal';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { format } from 'date-fns';
import { CategoryBottomSheet } from '@/components/shared/CategorySelector/CategoryBottomSheet';
import { useCategories } from '@/hooks/useCategories';

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
  } = useTransactionDetail(id);
  const { categories } = useCategories();

  // 모달 상태들
  const [amountModalVisible, setAmountModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [titleModalVisible, setTitleModalVisible] = useState(false);
  const [memoModalVisible, setMemoModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

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

  // CategoryBottomSheet에서 필요한 핸들러들 (실제로는 사용하지 않음)
  const handleCategoryUpdate = useCallback(async () => {
    // 거래 상세에서는 카테고리 수정 기능을 제공하지 않음
    return Promise.resolve();
  }, []);

  const handleCategoryDelete = useCallback(async () => {
    // 거래 상세에서는 카테고리 삭제 기능을 제공하지 않음
    return Promise.resolve(false);
  }, []);

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

  const handleDateConfirm = useCallback(
    async (date: Date) => {
      try {
        await updateTransaction({
          transactionDate: format(date, 'yyyy-MM-dd'),
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
            } catch {
              Alert.alert('오류', '거래를 삭제할 수 없습니다.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [deleteTransaction]);

  // 초기 로딩 상태 (첫 진입 시에만 표시)
  if (initialLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: '상세 내역',
            headerShadowVisible: false,
            headerLeft: () => (
              <Pressable onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
            ),
          }}
        />
        <View
          style={[
            styles.loadingContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </>
    );
  }

  // 에러 상태
  if (error || !transaction) {
    return (
      <>
        <Stack.Screen
          options={{
            title: '상세 내역',
            headerShadowVisible: false,
            headerLeft: () => (
              <Pressable onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
            ),
          }}
        />
        <View
          style={[
            styles.errorContainer,
            { backgroundColor: colors.background },
          ]}
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
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '상세 내역',
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
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
            <Typography variant="body1" weight="500">
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
            <Pressable
              style={styles.editIcon}
              onPress={() => setAmountModalVisible(true)}
            >
              <Ionicons name="pencil" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* 정보 섹션 */}
        <View
          style={[styles.infoSection, { backgroundColor: colors.background }]}
        >
          {/* 카테고리 설정 */}
          <Pressable
            style={styles.infoRow}
            onPress={() => setCategoryModalVisible(true)}
          >
            <Typography variant="body1" color="secondary" weight="500">
              카테고리 설정
            </Typography>
            <View style={styles.valueContainer}>
              <Typography variant="body1">
                {transaction.category_name}
              </Typography>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </View>
          </Pressable>

          {/* 제목 */}
          <Pressable
            style={styles.infoRow}
            onPress={() => setTitleModalVisible(true)}
          >
            <Typography variant="body1" color="secondary" weight="500">
              제목
            </Typography>
            <View style={styles.valueContainer}>
              <Typography variant="body1">{transaction.title}</Typography>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </View>
          </Pressable>

          {/* 메모 */}
          <Pressable
            style={styles.infoRow}
            onPress={() => setMemoModalVisible(true)}
          >
            <Typography variant="body1" color="secondary" weight="500">
              메모
            </Typography>
            <View style={styles.valueContainer}>
              <Typography
                variant="body1"
                color={transaction.description ? 'primary' : 'secondary'}
                numberOfLines={2}
                ellipsizeMode="tail"
                style={{ flex: 1, textAlign: 'right' }}
              >
                {transaction.description || '메모를 남겨보세요'}
              </Typography>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </View>
          </Pressable>

          {/* 거래 날짜 */}
          <Pressable
            style={styles.infoRow}
            onPress={() => setDatePickerVisible(true)}
          >
            <Typography variant="body1" color="secondary" weight="500">
              거래일
            </Typography>
            <View style={styles.valueContainer}>
              <Typography variant="body1">
                {formatDateKorean(transaction.transaction_date)}
              </Typography>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </View>
          </Pressable>

          {/* 작성자 - 수정 불가 */}
          <View style={styles.infoRow}>
            <Typography variant="body1" color="secondary" weight="500">
              작성자
            </Typography>
            <Typography variant="body1">
              {transaction.created_by_name || '알 수 없음'}
            </Typography>
          </View>
        </View>
      </ScrollView>

      {/* 하단 고정 삭제 버튼 */}
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
            date={new Date(transaction.transaction_date)}
            maximumDate={new Date()}
            locale="ko"
            confirmTextIOS="완료"
            cancelTextIOS="취소"
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
    backgroundColor: '#F2F4F6',
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: 56,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
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
