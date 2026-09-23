import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, Card, AmountDisplay } from '@/components/ui';
import { Calendar } from '@/components/shared/calendar';
import { useLedger } from '../../contexts/LedgerContext';
import { useSelectedDate } from '@/contexts/SelectedDateContext';
import { useMonthlyData } from '../../hooks/useMonthlyData';
import { useTransactions } from '../../hooks/useTransactions';
import { SelectedDayTransactions } from '@/components/transaction/SelectedDayTransactions';
import { ErrorState } from '../../components/shared/ErrorState';
import { EmptyState } from '../../components/shared/EmptyState';
import { CreateLedgerModal } from '../../components/ledger/CreateLedgerModal';
import { formatLocalDate } from '@repo/core';

// Constants
const CONSTANTS = {
  PADDING: {
    HORIZONTAL: 16,
    HEADER_HORIZONTAL: 16,
    HEADER_TOP_IOS: 8,
    HEADER_TOP_ANDROID: 16,
    HEADER_BOTTOM: 8,
    // 탭바는 콘텐츠 영역 밖에 렌더되므로 일반 콘텐츠 끝 여백만 두면 된다.
    BOTTOM_IOS: 24,
    BOTTOM_ANDROID: 24,
  },
  SPACING: {
    SUMMARY_ROW: 16,
    SUMMARY_TOTAL_TOP: 8,
    SUMMARY_CARD_TITLE: 20,
    CALENDAR_TOP: 8,
    CALENDAR_BOTTOM: 16,
  },
} as const;

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { setSelectedDate: setSharedDate } = useSelectedDate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // 캘린더에서 고른 날짜. null이면 아직 고르지 않은 상태(첫 진입)라 상세 섹션도 없다.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const colors = Colors[colorScheme ?? 'light'];

  const {
    currentLedger,
    ledgers,
    loading: ledgerLoading,
    error: ledgerError,
    refreshLedgers,
  } = useLedger();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;

  const {
    calendarData,
    monthlySummary,
    loading: dataLoading,
    error: dataError,
    refetch: refetchData,
  } = useMonthlyData(year, month);

  // 거래 행은 날짜를 처음 고르는 시점에야 필요하다. 홈 첫 진입을 느리게 만들지 않도록 지연 로드한다.
  const {
    transactions: monthTransactions,
    loading: transactionsLoading,
    refetch: refetchTransactions,
  } = useTransactions({
    ledgerId: currentLedger?.id,
    year,
    month,
    enabled: selectedDate !== null,
  });

  const selectedDayTransactions = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = formatLocalDate(selectedDate);
    return monthTransactions.filter((t) => t.transaction_date === dateStr);
  }, [monthTransactions, selectedDate]);

  const lastRefetchTime = useRef(0);
  const [appReady, setAppReady] = useState(false);

  // useFocusEffect는 콜백 정체성이 바뀌면 포커스 중에도 다시 실행된다.
  // refetchTransactions는 날짜를 처음 고르는 순간(enabled 전환) 정체성이 바뀌므로
  // deps에 그대로 넣으면 훅이 스스로 하는 첫 fetch와 겹쳐 같은 요청이 두 번 나간다.
  const refetchTransactionsRef = useRef(refetchTransactions);
  useEffect(() => {
    refetchTransactionsRef.current = refetchTransactions;
  }, [refetchTransactions]);

  useEffect(() => {
    async function prepare() {
      try {
        if (!ledgerLoading && !dataLoading && !appReady) {
          setAppReady(true);
          await SplashScreen.hideAsync();
        }
      } catch (e) {
        console.warn('SplashScreen hide error:', e);
      }
    }

    prepare();
  }, [ledgerLoading, dataLoading, appReady]);

  // 화면 포커스 시 데이터 새로고침 (디바운싱 적용)
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      // 마지막 리페치로부터 1초 이상 경과 시만 리페치
      if (now - lastRefetchTime.current > 1000) {
        refetchData();
        refetchTransactionsRef.current();
        lastRefetchTime.current = now;
      }
    }, [refetchData])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshLedgers(),
        refetchData(),
        refetchTransactions(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshLedgers, refetchData, refetchTransactions]);

  // 날짜 탭은 선택만 한다. 거래 유무에 따라 화면을 옮기면 같은 제스처가 두 가지 뜻을 갖게 된다.
  const handleDateSelect = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      // 빠른 입력 화면에서 사용할 공유 날짜 설정
      setSharedDate(date);
    },
    [setSharedDate]
  );

  // 다른 달로 넘어가면 선택을 지운다. 보이지 않는 날짜의 내역이 아래에 남아 있으면 헷갈린다.
  const handleMonthChange = useCallback((year: number, month: number) => {
    setCurrentMonth(new Date(year, month));
    setSelectedDate(null);
  }, []);

  const handleViewAllTransactions = useCallback(() => {
    if (!selectedDate) return;
    router.push(`/transactions?date=${formatLocalDate(selectedDate)}`);
  }, [router, selectedDate]);

  const handleTransactionPress = useCallback(
    (transactionId: string) => {
      router.push({
        pathname: '/transaction-detail',
        params: { id: transactionId },
      });
    },
    [router]
  );

  // 초기 로딩 중에는 스플래시 화면이 표시되므로 여기서는 null 반환
  if (!appReady) {
    return null;
  }

  if (ledgerError || dataError) {
    return (
      <ErrorState
        message="데이터를 불러올 수 없습니다"
        onRetry={handleRefresh}
      />
    );
  }

  if (!currentLedger || ledgers.length === 0) {
    return (
      <>
        <EmptyState
          icon="wallet-outline"
          title="가계부가 없습니다"
          message="새로운 가계부를 만들어 재무 관리를 시작해보세요"
          actionLabel="가계부 만들기"
          onAction={() => setShowCreateModal(true)}
        />

        <CreateLedgerModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            refreshLedgers();
            setShowCreateModal(false);
          }}
        />
      </>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
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
        <View style={styles.header}>
          <Typography variant="h4" color="secondary">
            {currentLedger.name}
          </Typography>
        </View>

        <Calendar
          mode="static"
          viewType="month"
          selectedDate={selectedDate ?? undefined}
          visibleMonth={currentMonth}
          transactions={calendarData || {}}
          onDateSelect={handleDateSelect}
          onMonthChange={handleMonthChange}
          containerStyle={styles.calendarContainer}
        />

        {/* 선택한 날짜의 거래 내역 */}
        {selectedDate && (
          <SelectedDayTransactions
            date={selectedDate}
            transactions={selectedDayTransactions}
            loading={transactionsLoading}
            onPressTransaction={handleTransactionPress}
            onPressViewAll={handleViewAllTransactions}
            style={styles.dayTransactions}
          />
        )}

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
  dayTransactions: {
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
