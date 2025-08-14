import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Platform,
  SafeAreaView,
  Text,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, Card, AmountDisplay } from '@/components/ui';
import { Calendar } from '@/components/shared/calendar';
import { useLedger } from '../../contexts/LedgerContext';
import { useMonthlyData } from '../../hooks/useMonthlyData';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { EmptyState } from '../../components/shared/EmptyState';
import { LedgerSelector } from '../../components/shared/LedgerSelector';

// Constants
const CONSTANTS = {
  PADDING: {
    HORIZONTAL: 16,
    HEADER_HORIZONTAL: 16,
    HEADER_TOP_IOS: 8,
    HEADER_TOP_ANDROID: 16,
    HEADER_BOTTOM: 8,
    BOTTOM_IOS: 100,
    BOTTOM_ANDROID: 80,
  },
  SPACING: {
    SUMMARY_ROW: 16,
    SUMMARY_TOTAL_TOP: 8,
    SUMMARY_CARD_TITLE: 20,
    CALENDAR_TOP: 8,
    CALENDAR_BOTTOM: 16,
  },
  DEFAULTS: {
    USERNAME: '사용자',
  },
} as const;

// Utility functions
// 날짜를 YYYY-MM-DD 형식으로 변환 (추후 거래 목록 화면에서 사용 예정)
// const formatDateKey = (date: Date): string => {
//   const year = date.getFullYear();
//   const month = String(date.getMonth() + 1).padStart(2, '0');
//   const day = String(date.getDate()).padStart(2, '0');
//   return `${year}-${month}-${day}`;
// };

const extractUserName = (
  user: { user_metadata?: { full_name?: string }; email?: string } | null
): string => {
  return (
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    CONSTANTS.DEFAULTS.USERNAME
  );
};

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

  const userName = extractUserName(user);

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
    if (!calendarData) return;

    const dayTransactions = calendarData[date.getDate()];
    const hasTransactions =
      dayTransactions &&
      (dayTransactions.income > 0 || dayTransactions.expense > 0);

    if (hasTransactions) {
      // TODO: 거래 목록 화면으로 네비게이션
      // router.push(`/transactions?date=${dateKey}`);
      console.log('Navigate to transactions');
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
          // TODO: 가계부 생성 화면으로 이동
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
        <View style={styles.header}>
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
        <Card variant="elevated" padding="large">
          <Typography
            variant="body1"
            weight="600"
            style={{ marginBottom: CONSTANTS.SPACING.SUMMARY_CARD_TITLE }}
          >
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
    paddingHorizontal: CONSTANTS.PADDING.HORIZONTAL,
    paddingBottom: Platform.select({
      ios: CONSTANTS.PADDING.BOTTOM_IOS,
      android: CONSTANTS.PADDING.BOTTOM_ANDROID,
    }),
  },
  header: {
    paddingTop: Platform.select({
      ios: CONSTANTS.PADDING.HEADER_TOP_IOS,
      android: CONSTANTS.PADDING.HEADER_TOP_ANDROID,
    }),
    paddingHorizontal: CONSTANTS.PADDING.HEADER_HORIZONTAL,
    paddingBottom: CONSTANTS.PADDING.HEADER_BOTTOM,
  },
  calendarContainer: {
    marginTop: CONSTANTS.SPACING.CALENDAR_TOP,
    marginBottom: CONSTANTS.SPACING.CALENDAR_BOTTOM,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: CONSTANTS.SPACING.SUMMARY_ROW,
  },
  summaryTotal: {
    marginTop: CONSTANTS.SPACING.SUMMARY_TOTAL_TOP,
    paddingTop: CONSTANTS.SPACING.SUMMARY_ROW,
    borderTopWidth: 1,
    marginBottom: 0,
  },
});
