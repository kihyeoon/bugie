import {
  StyleSheet,
  View,
  SectionList,
  SectionListData,
  SafeAreaView,
  Text,
  TouchableOpacity,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useState, useCallback, useRef } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, AmountDisplay } from '@/components/ui';
import { Calendar } from '@/components/shared/calendar';
import { LoadingState } from '../components/shared/LoadingState';
import { ErrorState } from '../components/shared/ErrorState';
import { EmptyState } from '../components/shared/EmptyState';
import { useLedger } from '../contexts/LedgerContext';
import { useTransactions } from '../hooks/useTransactions';
import type { TransactionWithDetails } from '@repo/core';

// 상수
const CONSTANTS = {
  HEADER_HEIGHT: Platform.select({ ios: 100, android: 80 }) ?? 80,
  CALENDAR_MONTH_HEIGHT: 360,
  CALENDAR_WEEK_HEIGHT: 120,
  SCROLL_THRESHOLD: 50,
  ANIMATION_DURATION: 300,
  PAGE_SIZE: 20,
} as const;

// 거래 아이템 컴포넌트
const TransactionItem = ({
  transaction,
  onPress,
}: {
  transaction: TransactionWithDetails;
  onPress: () => void;
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity
      style={[styles.transactionItem, { backgroundColor: colors.background }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.transactionLeft}>
        <View
          style={[
            styles.categoryIcon,
            { backgroundColor: transaction.category_color + '20' },
          ]}
        >
          <Text style={{ fontSize: 20 }}>{transaction.category_icon}</Text>
        </View>
        <View style={styles.transactionInfo}>
          <Typography variant="body1" weight="500">
            {transaction.title}
          </Typography>
          <Typography variant="caption" color="secondary">
            {transaction.category_name}
          </Typography>
        </View>
      </View>
      <AmountDisplay
        amount={Number(transaction.amount)}
        type={transaction.type}
        size="medium"
      />
    </TouchableOpacity>
  );
};

// 날짜 섹션 헤더 컴포넌트
const DateSectionHeader = ({ date }: { date: string }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}월 ${day}일 (${weekDay})`;
  };

  return (
    <View
      style={[
        styles.sectionHeader,
        { backgroundColor: colors.backgroundSecondary },
      ]}
    >
      <Typography variant="body1" weight="600">
        📅 {formatDate(date)}
      </Typography>
    </View>
  );
};

// 헤더 타이틀 컴포넌트
const HeaderTitle = ({
  date,
  onPrevMonth,
  onNextMonth,
}: {
  date: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const monthText = `${date.getMonth() + 1}월`;

  return (
    <View style={styles.headerTitle}>
      <TouchableOpacity onPress={onPrevMonth} style={styles.monthNavButton}>
        <Ionicons name="caret-back" size={16} color={colors.text} />
      </TouchableOpacity>
      <Typography variant="h3" weight="600" style={{ marginHorizontal: 20 }}>
        {monthText}
      </Typography>
      <TouchableOpacity onPress={onNextMonth} style={styles.monthNavButton}>
        <Ionicons name="caret-forward" size={16} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
};

export default function TransactionsScreen() {
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { currentLedger } = useLedger();

  const [selectedDate, setSelectedDate] = useState<Date>(
    params.date ? new Date(params.date as string) : new Date()
  );
  const [calendarViewType, setCalendarViewType] = useState<'month' | 'week'>(
    'month'
  );

  // 애니메이션 값
  const scrollY = useSharedValue(0);
  const calendarHeight = useSharedValue<number>(
    CONSTANTS.CALENDAR_MONTH_HEIGHT
  );
  const listRef =
    useRef<SectionList<TransactionWithDetails, { date: string }>>(null);

  // 데이터 가져오기 위한 현재 월/년 가져오기
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;

  // 거래 내역 가져오기
  const {
    transactions,
    groupedTransactions,
    calendarData,
    loading,
    error,
    hasMore,
    loadMore,
    refetch,
  } = useTransactions({
    ledgerId: currentLedger?.id,
    year,
    month,
  });

  // 스크롤 이벤트 처리
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollY.value = offsetY;

      // 스크롤 기반으로 캘린더 뷰 타입 결정
      if (
        offsetY > CONSTANTS.SCROLL_THRESHOLD &&
        calendarViewType === 'month'
      ) {
        setCalendarViewType('week');
        calendarHeight.value = withTiming(CONSTANTS.CALENDAR_WEEK_HEIGHT, {
          duration: CONSTANTS.ANIMATION_DURATION,
          easing: Easing.out(Easing.ease),
        });
      } else if (
        offsetY < -CONSTANTS.SCROLL_THRESHOLD &&
        calendarViewType === 'week'
      ) {
        setCalendarViewType('month');
        calendarHeight.value = withTiming(CONSTANTS.CALENDAR_MONTH_HEIGHT, {
          duration: CONSTANTS.ANIMATION_DURATION,
          easing: Easing.out(Easing.ease),
        });
      }
    },
    [calendarViewType, scrollY, calendarHeight]
  );

  // 날짜 선택 처리
  const handleDateSelect = useCallback(
    (date: Date) => {
      setSelectedDate(date);

      // 이 날짜에 대한 섹션 찾기
      const dateStr = date.toISOString().split('T')[0];
      const sectionIndex = groupedTransactions.findIndex(
        (group) => group.date === dateStr
      );

      if (sectionIndex !== -1 && listRef.current) {
        // SectionList scrollToLocation 호출
        listRef.current.scrollToLocation({
          sectionIndex,
          itemIndex: 0,
          animated: true,
        });
      }
    },
    [groupedTransactions]
  );

  // 월 변경 처리
  const handleMonthChange = useCallback((year: number, month: number) => {
    setSelectedDate(new Date(year, month));
  }, []);

  // 이전/다음 월 네비게이션
  const handlePrevMonth = useCallback(() => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  }, []);

  // 캘린더 컨테이너 애니메이션 스타일
  const animatedCalendarStyle = useAnimatedStyle(() => {
    return {
      height: calendarHeight.value,
      overflow: 'hidden',
    };
  });

  // 거래 상세 화면으로 네비게이션 처리
  const handleTransactionPress = useCallback((transactionId: string) => {
    // TODO: 거래 상세 화면 구현
    console.log('Navigate to transaction detail:', transactionId);
  }, []);

  // 검색 핸들러
  const handleSearch = useCallback(() => {
    // TODO: 검색 기능 구현
    console.log('Search');
  }, []);

  // 렌더 함수들
  const renderTransaction = useCallback(
    ({ item }: { item: TransactionWithDetails }) => (
      <TransactionItem
        transaction={item}
        onPress={() => handleTransactionPress(item.id)}
      />
    ),
    [handleTransactionPress]
  );

  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: SectionListData<TransactionWithDetails, { date: string }>;
    }) => <DateSectionHeader date={section.date} />,
    []
  );

  // 푸터를 위한 일일 합계 계산
  const calculateDailyTotals = useCallback(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const todayTransactions = transactions.filter(
      (t: TransactionWithDetails) => t.transaction_date === dateStr
    );

    const todayIncome = todayTransactions
      .filter((t: TransactionWithDetails) => t.type === 'income')
      .reduce(
        (sum: number, t: TransactionWithDetails) => sum + Number(t.amount),
        0
      );

    const todayExpense = todayTransactions
      .filter((t: TransactionWithDetails) => t.type === 'expense')
      .reduce(
        (sum: number, t: TransactionWithDetails) => sum + Number(t.amount),
        0
      );

    const monthlyIncome = transactions
      .filter((t: TransactionWithDetails) => t.type === 'income')
      .reduce(
        (sum: number, t: TransactionWithDetails) => sum + Number(t.amount),
        0
      );

    const monthlyExpense = transactions
      .filter((t: TransactionWithDetails) => t.type === 'expense')
      .reduce(
        (sum: number, t: TransactionWithDetails) => sum + Number(t.amount),
        0
      );

    return {
      today: todayIncome - todayExpense,
      monthly: monthlyIncome - monthlyExpense,
    };
  }, [selectedDate, transactions]);

  const totals = calculateDailyTotals();

  // 로딩 상태
  if (loading && !transactions.length) {
    return <LoadingState message="거래 내역을 불러오는 중..." />;
  }

  // 에러 상태
  if (error) {
    return (
      <ErrorState message="거래 내역을 불러올 수 없습니다" onRetry={refetch} />
    );
  }

  // 빈 상태
  if (!loading && transactions.length === 0) {
    return (
      <EmptyState
        icon="receipt-outline"
        title="거래 내역이 없습니다"
        message="이번 달에는 아직 거래가 없어요"
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen
        options={{
          headerTitle: () => (
            <HeaderTitle
              date={selectedDate}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          ),
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={handleSearch} style={{ marginRight: 8 }}>
              <Ionicons name="search" size={24} color={colors.icon} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.content}>
        {/* 애니메이션 캘린더 */}
        <Animated.View style={animatedCalendarStyle}>
          <Calendar
            mode="scrollable"
            viewType={calendarViewType}
            selectedDate={selectedDate}
            transactions={calendarData}
            onDateSelect={handleDateSelect}
            onMonthChange={handleMonthChange}
            scrollY={scrollY}
            showHeader={false}
          />
        </Animated.View>

        {/* 거래 목록 */}
        <SectionList
          ref={listRef}
          sections={groupedTransactions}
          renderItem={renderTransaction}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          stickySectionHeadersEnabled={false}
          ListFooterComponent={
            <View style={styles.footer}>
              <View style={styles.footerRow}>
                <Typography variant="caption" color="secondary">
                  오늘 합계
                </Typography>
                <AmountDisplay
                  amount={totals.today}
                  type={totals.today >= 0 ? 'income' : 'expense'}
                  size="small"
                />
              </View>
              <View style={styles.footerRow}>
                <Typography variant="body1" weight="600">
                  이번 달
                </Typography>
                <AmountDisplay
                  amount={totals.monthly}
                  type={totals.monthly >= 0 ? 'income' : 'expense'}
                  size="medium"
                />
              </View>
              {hasMore && (
                <View style={styles.loadingMore}>
                  <Typography variant="caption" color="secondary">
                    더 불러오는 중...
                  </Typography>
                </View>
              )}
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavButton: {
    padding: 8,
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E8EB',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
