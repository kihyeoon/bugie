import React, { useCallback } from 'react';
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

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { transaction, loading, error, deleteTransaction } =
    useTransactionDetail(id);

  // 시간 포맷팅
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

  // 로딩 상태
  if (loading) {
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
              onPress={() => console.log('Edit amount')}
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
            onPress={() => console.log('Edit category')}
          >
            <Typography variant="body1" color="secondary">
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
            onPress={() => console.log('Edit title')}
          >
            <Typography variant="body1" color="secondary">
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
            onPress={() => console.log('Edit memo')}
          >
            <Typography variant="body1" color="secondary">
              메모
            </Typography>
            <View style={styles.valueContainer}>
              <Typography
                variant="body1"
                color={transaction.description ? 'primary' : 'secondary'}
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
            onPress={() => console.log('Edit date')}
          >
            <Typography variant="body1" color="secondary">
              거래일시
            </Typography>
            <View style={styles.valueContainer}>
              <Typography variant="body1">
                {formatDateTime(transaction.transaction_date)}
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
            <Typography variant="body1" color="secondary">
              사용자
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
