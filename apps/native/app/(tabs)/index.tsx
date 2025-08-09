import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, Card, Button, AmountDisplay } from '@/components/ui';
import { Calendar } from '@/components/shared/calendar';
import { router } from 'expo-router';
import { useLedger } from '../../contexts/LedgerContext';
import { useMonthlyData } from '../../hooks/useMonthlyData';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { EmptyState } from '../../components/shared/EmptyState';
import { LedgerSelector } from '../../components/shared/LedgerSelector';

export default function HomeScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const colors = Colors[colorScheme ?? 'light'];

  const {
    currentLedger,
    ledgers,
    loading: ledgerLoading,
    error: ledgerError,
    refreshLedgers,
  } = useLedger();

  // Extract year and month for API calls
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;

  // Fetch monthly data (calendar + summary)
  const {
    calendarData,
    monthlySummary,
    loading: dataLoading,
    error: dataError,
    refetch: refetchData,
  } = useMonthlyData(year, month);

  const userName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || '사용자';

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshLedgers(), refetchData()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshLedgers, refetchData]);

  // 날짜 선택 핸들러
  const handleDateSelect = (date: Date) => {
    // 해당 날짜의 거래 목록으로 이동
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    if (calendarData) {
      const dayTransactions = calendarData[date.getDate()];
      if (
        dayTransactions &&
        (dayTransactions.income > 0 || dayTransactions.expense > 0)
      ) {
        // TODO: 거래 목록 화면으로 네비게이션
        // router.push(`/transactions?date=${dateKey}`);
        console.log('Navigate to transactions for:', dateKey);
      }
    }
  };

  // 월 변경 핸들러
  const handleMonthChange = (year: number, month: number) => {
    setCurrentMonth(new Date(year, month));
  };

  // Show loading state
  if (ledgerLoading || (currentLedger && dataLoading)) {
    return <LoadingState message="데이터를 불러오는 중..." />;
  }

  // Show error state
  if (ledgerError || dataError) {
    return (
      <ErrorState
        message="데이터를 불러올 수 없습니다"
        onRetry={handleRefresh}
      />
    );
  }

  // Show empty state if no ledgers
  if (!currentLedger || ledgers.length === 0) {
    return (
      <EmptyState
        icon="wallet-outline"
        title="가계부가 없습니다"
        message="새로운 가계부를 만들어 재무 관리를 시작해보세요"
        actionLabel="가계부 만들기"
        onAction={() => {
          // TODO: Navigate to create ledger
          console.log('Create ledger');
        }}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.tint}
          />
        }
      >
        {/* 헤더 */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <Typography variant="h3" color="secondary">
            안녕하세요, {userName}님
          </Typography>
          <LedgerSelector />
        </View>

        {/* 캘린더 */}
        <Calendar
          mode="static"
          viewType="month"
          selectedDate={currentMonth}
          transactions={calendarData || {}}
          onDateSelect={handleDateSelect}
          onMonthChange={handleMonthChange}
          containerStyle={styles.calendarContainer}
        />

        {/* 월간 요약 */}
        <Card variant="elevated" style={styles.summaryCard}>
          <Typography variant="body1" weight="600" style={{ marginBottom: 20 }}>
            이번 달 요약
          </Typography>

          <View style={styles.summaryRow}>
            <Typography variant="body1" color="secondary">
              수입
            </Typography>
            <AmountDisplay
              amount={monthlySummary?.income || 0}
              type="income"
              size="medium"
            />
          </View>

          <View style={styles.summaryRow}>
            <Typography variant="body1" color="secondary">
              지출
            </Typography>
            <AmountDisplay
              amount={monthlySummary?.expense || 0}
              type="expense"
              size="medium"
            />
          </View>

          <View
            style={[
              styles.summaryRow,
              styles.summaryTotal,
              { borderTopColor: colors.border },
            ]}
          >
            <Typography variant="body1">잔액</Typography>
            <AmountDisplay
              amount={monthlySummary?.balance || 0}
              type="neutral"
              size="large"
            />
          </View>
        </Card>

        {/* 빠른 입력 버튼 */}
        <Button
          variant="primary"
          size="large"
          icon="plus"
          fullWidth
          style={styles.quickAddButton}
          onPress={() => router.push('/add')}
        >
          빠른 입력
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16, // 좌우 일관된 패딩
    paddingBottom: Platform.select({
      ios: 100, // 탭바 80px + 여유 20px
      android: 80, // 탭바 60px + 여유 20px
    }),
  },
  header: {
    paddingTop: Platform.select({
      ios: 8, // SafeAreaView가 처리하므로 최소 여백만
      android: 16, // Android는 SafeAreaView가 status bar를 처리 안 함
    }),
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  calendarContainer: {
    marginTop: 8,
    marginBottom: 16,
    minHeight: 380, // 460에서 축소
  },
  summaryCard: {
    // marginHorizontal 제거
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    marginBottom: 0,
  },
  quickAddButton: {
    marginTop: 20,
    marginBottom: 10, // 20에서 축소
  },
});
