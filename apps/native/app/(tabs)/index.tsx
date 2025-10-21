import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, Card, AmountDisplay } from '@/components/ui';
import { Calendar } from '@/components/shared/calendar';
import { useLedger } from '../../contexts/LedgerContext';
import { useMonthlyData } from '../../hooks/useMonthlyData';
import { ErrorState } from '../../components/shared/ErrorState';
import { EmptyState } from '../../components/shared/EmptyState';
import { CreateLedgerModal } from '../../components/ledger/CreateLedgerModal';
import { format } from 'date-fns';

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
} as const;

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [currentMonth, setCurrentMonth] = useState(new Date());
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

  const lastRefetchTime = useRef(0);
  const [appReady, setAppReady] = useState(false);

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
        lastRefetchTime.current = now;
      }
    }, [refetchData])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshLedgers(), refetchData()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshLedgers, refetchData]);

  const handleDateSelect = (date: Date) => {
    if (!calendarData) return;

    const dateStr = format(date, 'yyyy-MM-dd');
    const dayTransactions = calendarData[dateStr];
    const hasTransactions =
      dayTransactions &&
      (dayTransactions.income > 0 || dayTransactions.expense > 0);

    if (hasTransactions) {
      router.push(`/transactions?date=${dateStr}`);
    }
  };

  const handleMonthChange = (year: number, month: number) => {
    setCurrentMonth(new Date(year, month));
  };

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
