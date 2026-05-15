import {
  StyleSheet,
  View,
  SectionList,
  SectionListData,
  TouchableOpacity,
  Pressable,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
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
import { useMonthlyData } from '../hooks/useMonthlyData';
import type { TransactionWithDetails } from '@repo/core';
import {
  addMonths,
  formatDateKey,
} from '@/components/shared/calendar/utils/dateHelpers';
import { debounce } from '@/utils/timing';
import { getIoniconName } from '@/constants/categories';

// 상수
const CONSTANTS = {
  HEADER_HEIGHT: Platform.select({ ios: 100, android: 80 }) ?? 80,
  CALENDAR_MONTH_HEIGHT: 420,
  CALENDAR_WEEK_HEIGHT: 120,
  SCROLL_THRESHOLD: 50,
  ANIMATION_DURATION: 300,
} as const;

// SectionList 가시성 설정
const viewabilityConfig = {
  itemVisiblePercentThreshold: 50, // 50% 이상 보일 때 활성화
  waitForInteraction: false, // 디바운스가 타이밍 제어
};

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
          <Ionicons
            name={getIoniconName(transaction.category_icon, true)}
            size={20}
            color={transaction.category_color}
          />
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
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}월 ${day}일 (${weekDay})`;
  };

  return (
    <View style={styles.sectionHeader}>
      <Typography variant="body2" weight="500" color="secondary">
        {formatDate(date)}
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
  const isProgrammaticScroll = useRef(false);
  const hasScrolledToInitialDate = useRef(false);
  // onScrollToIndexFailed 발생 시 측정 진행을 기다린 뒤 재시도하기 위한 마지막 의도.
  const lastScrollAttempt = useRef<{ sectionIndex: number } | null>(null);
  // 사용자가 month 전환/캘린더 탭 이후 직접 리스트를 드래그했는지 추적.
  // 이게 false인 동안엔 viewable 이벤트가 자연 layout으로 발화해도 selectedDate를 덮어쓰지 않는다.
  // (예: 4/6 선택 후 ◀▶로 이동했는데 해당 일자에 거래가 없으면 scrollToDate가 no-op이라
  //  자연 layout 상단의 다른 일자로 selectedDate가 잠식되는 결함을 차단.)
  const userHasDraggedSinceChange = useRef(false);

  // 데이터 가져오기 위한 현재 월/년 가져오기
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;

  // 거래 내역 가져오기 (한 달 전체)
  const { transactions, groupedTransactions, loading, error, refetch } =
    useTransactions({
      ledgerId: currentLedger?.id,
      year,
      month,
    });

  // 캘린더용 월별 집계 (서버 집계와 일관 — 홈 화면과 동일 소스)
  const { calendarData: monthlyCalendarData, refetch: refetchMonthly } =
    useMonthlyData(year, month);

  // 마지막 리페치 시간 추적 (디바운싱용)
  const lastRefetchTime = useRef(0);

  // 화면 포커스 시 데이터 새로고침 (디바운싱 적용)
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      // 마지막 리페치로부터 1초 이상 경과 시만 리페치
      if (now - lastRefetchTime.current > 1000) {
        Promise.all([refetch(), refetchMonthly()]);
        lastRefetchTime.current = now;
      }
    }, [refetch, refetchMonthly])
  );

  // 스크롤 이벤트 처리
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const previousY = scrollY.value;
      scrollY.value = offsetY;

      // 프로그래매틱 스크롤일 경우 캘린더 모드 전환 방지
      if (isProgrammaticScroll.current) {
        return;
      }

      const scrollDirection = offsetY - previousY; // 양수: 위로 스크롤, 음수: 아래로 스크롤

      // 월간 → 주간: 최상단 근처에서 실제로 위로 스크롤할 때만
      if (
        calendarViewType === 'month' &&
        offsetY > 0 && // 실제로 컨텐츠를 스크롤 (바운스 제외)
        offsetY <= CONSTANTS.SCROLL_THRESHOLD && // 최상단 근처에서만
        scrollDirection > 0 // 위로 스크롤
      ) {
        setCalendarViewType('week');
        calendarHeight.value = withTiming(CONSTANTS.CALENDAR_WEEK_HEIGHT, {
          duration: CONSTANTS.ANIMATION_DURATION,
          easing: Easing.out(Easing.ease),
        });
      }
      // 주간 → 월간: 최상단에서 아래로 당길 때만 (pull-to-expand)
      else if (
        calendarViewType === 'week' &&
        offsetY < -CONSTANTS.SCROLL_THRESHOLD // 최상단에서 아래로 당기기
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

  // 날짜로 스크롤하는 헬퍼 함수
  const scrollToDate = useCallback(
    (dateStr: string) => {
      const sectionIndex = groupedTransactions.findIndex(
        (group) => group.date === dateStr
      );

      if (sectionIndex !== -1 && listRef.current) {
        // 프로그래매틱 스크롤 플래그 설정
        isProgrammaticScroll.current = true;
        lastScrollAttempt.current = { sectionIndex };

        // 레이아웃 측정 완료를 위한 지연 후 스크롤
        setTimeout(() => {
          try {
            listRef.current?.scrollToLocation({
              sectionIndex,
              itemIndex: 0,
              animated: true,
              viewPosition: 0, // 상단에 위치
            });
          } catch (error) {
            console.warn('ScrollToLocation failed:', error);
            // Fallback: 첫 번째 섹션으로라도 이동
            if (sectionIndex > 0) {
              listRef.current?.scrollToLocation({
                sectionIndex: 0,
                itemIndex: 0,
                animated: true,
                viewPosition: 0,
              });
            }
          }

          // 스크롤 완료 후 플래그 해제 (애니메이션 시간 고려)
          setTimeout(() => {
            isProgrammaticScroll.current = false;
          }, 500);
        }, 300); // 더 긴 지연으로 안정성 확보
      }
    },
    [groupedTransactions]
  );

  // 날짜 선택 처리
  const handleDateSelect = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      // 명시적 탭이므로 드래그 신호 리셋 — viewable이 selectedDate를 덮어쓰지 못하게.
      userHasDraggedSinceChange.current = false;
      scrollToDate(formatDateKey(date));
    },
    [scrollToDate]
  );

  // 현재 그려진 SectionList 데이터의 month — fetch가 진행되는 동안 옛 transactions가
  // 그대로 표시되므로 stale 여부 판정을 위한 메타.
  const renderedMonth = useMemo(() => {
    if (groupedTransactions.length === 0) return null;
    const date = new Date(groupedTransactions[0].date);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  }, [groupedTransactions]);

  const isStaleData =
    !renderedMonth ||
    renderedMonth.year !== year ||
    renderedMonth.month !== month;

  // 자동 스크롤: 새 month 데이터 도착 후 selectedDate 섹션으로 한 번만 이동.
  useEffect(() => {
    if (hasScrolledToInitialDate.current || loading || isStaleData) {
      return;
    }
    const dateStr = formatDateKey(selectedDate);
    if (groupedTransactions.some((group) => group.date === dateStr)) {
      scrollToDate(dateStr);
    }
    // 해당 날짜 섹션이 없어도 한 번 시도한 것으로 간주 (반복 시도 방지).
    hasScrolledToInitialDate.current = true;
  }, [groupedTransactions, scrollToDate, loading, selectedDate, isStaleData]);

  // selectedDate를 ref로 노출 — debounced 함수가 매 변경마다 재생성되지 않게.
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  // 디바운스된 캘린더 날짜 업데이트 (300ms). 1회만 생성되므로 onViewableItemsChanged의
  // reference도 stable하게 유지된다 (RN의 "Changing onViewableItemsChanged on the fly" 경고 회피).
  // setSelectedDate가 month/day를 모두 담고 있어 별도 handleMonthChange는 불필요하고,
  // 오히려 day=1로 덮어쓰는 부작용을 유발해 제거함.
  const debouncedDateUpdate = useMemo(
    () =>
      debounce((newDate: Date) => {
        if (formatDateKey(newDate) !== formatDateKey(selectedDateRef.current)) {
          setSelectedDate(newDate);
        }
      }, 300),
    []
  );

  // viewable 가드 값들도 ref로 모아 onViewableItemsChanged가 평생 stable 유지되도록.
  const viewableGuardsRef = useRef({ loading, isStaleData, year, month });
  useEffect(() => {
    viewableGuardsRef.current = { loading, isStaleData, year, month };
  }, [loading, isStaleData, year, month]);

  // 스크롤 시 보이는 날짜에 따른 캘린더 동기화.
  const onViewableItemsChanged = useCallback(
    ({
      viewableItems,
    }: {
      viewableItems: ViewToken<TransactionWithDetails>[];
    }) => {
      if (isProgrammaticScroll.current) return;
      const { loading, isStaleData, year, month } = viewableGuardsRef.current;
      // transition 구간에서 viewable이 옛 섹션을 보고 selectedDate를 되돌리는 race 차단.
      if (loading || isStaleData) return;
      // 사용자가 드래그한 적 없으면 viewable은 자연 layout 부산물 — 덮어쓰기 금지.
      if (!userHasDraggedSinceChange.current) return;
      const firstVisibleSection = viewableItems[0]?.section;
      if (!firstVisibleSection?.date) return;
      const newDate = new Date(firstVisibleSection.date);
      // belt-and-suspenders: 가시 섹션이 현재 month 윈도우 밖이면 무시.
      if (newDate.getFullYear() !== year || newDate.getMonth() + 1 !== month) {
        return;
      }
      debouncedDateUpdate(newDate);
    },
    [debouncedDateUpdate]
  );

  // 컴포넌트 언마운트 시 디바운스 타이머 정리
  useEffect(() => {
    return () => {
      debouncedDateUpdate.cancel();
    };
  }, [debouncedDateUpdate]);

  // month 전환 시 stale 정리: 옛 month 기준 pending update 취소 + 자동 스크롤 재개 + 드래그 신호 리셋.
  useEffect(() => {
    debouncedDateUpdate.cancel();
    hasScrolledToInitialDate.current = false;
    userHasDraggedSinceChange.current = false;
  }, [year, month, debouncedDateUpdate]);

  // 이전/다음 월 네비게이션 — date-fns addMonths가 1/31 → 2/28 자동 클램프.
  const handlePrevMonth = useCallback(() => {
    setSelectedDate((prev) => addMonths(prev, -1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setSelectedDate((prev) => addMonths(prev, 1));
  }, []);

  // 캘린더 뷰 타입 변경 핸들러 (드래그 제스처용)
  const handleCalendarViewChange = useCallback(
    (newViewType: 'month' | 'week') => {
      setCalendarViewType(newViewType);
      // 드래그로 모드 변경 시에는 애니메이션 값도 업데이트
      if (newViewType === 'week') {
        calendarHeight.value = withTiming(CONSTANTS.CALENDAR_WEEK_HEIGHT, {
          duration: CONSTANTS.ANIMATION_DURATION,
          easing: Easing.out(Easing.ease),
        });
      } else {
        calendarHeight.value = withTiming(CONSTANTS.CALENDAR_MONTH_HEIGHT, {
          duration: CONSTANTS.ANIMATION_DURATION,
          easing: Easing.out(Easing.ease),
        });
      }
    },
    [calendarHeight]
  );

  // 캘린더 컨테이너 애니메이션 스타일
  const animatedCalendarStyle = useAnimatedStyle(() => {
    return {
      height: calendarHeight.value,
      overflow: 'hidden',
    };
  });

  // 거래 상세 화면으로 네비게이션 처리
  const handleTransactionPress = useCallback((transactionId: string) => {
    router.push({
      pathname: '/transaction-detail',
      params: { id: transactionId },
    });
  }, []);

  // 스크롤 실패 시 처리
  // info.index는 섹션 헤더 + 아이템을 합산한 flat 인덱스이므로 sectionIndex로 사용하면
  // sections out-of-bounds → TypeError로 스크롤이 깨진다.
  // 1단계: averageItemLength × index 근사 오프셋으로 점프해 frame 측정을 진행시킴.
  // 2단계: 측정이 충분히 진행될 시간을 둔 뒤 lastScrollAttempt의 정확한 sectionIndex로 재시도.
  // 단발성 fallback만 두면 averageItemLength이 underestimate되어(예: 42px) 목적지가 한참 앞에서 멈춘다.

  // 손가락 드래그가 시작된 시점부터만 viewable이 selectedDate를 갱신하도록 권한 부여.
  // (프로그래매틱 스크롤·자연 layout shift는 이 이벤트를 발화시키지 않아 정확한 신호.)
  const onScrollBeginDrag = useCallback(() => {
    userHasDraggedSinceChange.current = true;
  }, []);

  const onScrollToIndexFailed = useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      const offset = info.averageItemLength * info.index;
      listRef.current?.getScrollResponder()?.scrollTo({
        y: offset,
        animated: false,
      });

      setTimeout(() => {
        const target = lastScrollAttempt.current;
        if (!target || !listRef.current) return;
        try {
          listRef.current.scrollToLocation({
            sectionIndex: target.sectionIndex,
            itemIndex: 0,
            animated: false,
            viewPosition: 0,
          });
        } catch {
          // 재시도도 실패하면 사용자가 수동으로 스크롤하면 됨.
        }
      }, 100);
    },
    []
  );

  // TODO: Phase 2에서 검색 기능 구현
  // const handleSearch = useCallback(() => {
  //   // TODO: 검색 기능 구현
  //   console.log('Search');
  // }, []);

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

  // 푸터용 월간 합계 — 홈 "이번 달 요약" 카드와 동일 시맨틱(income/expense/balance).
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      const amount = Number(t.amount);
      if (t.type === 'income') income += amount;
      else expense += amount;
    }
    return { income, expense, balance: income - expense };
  }, [transactions]);

  // 모든 분기에서 동일한 헤더를 즉시 마운트해서
  // expo-router default back title('(tabs)')이 잠깐 보이는 깜빡임 방지.
  const headerScreen = (
    <Stack.Screen
      options={{
        headerTitle: () => (
          <HeaderTitle
            date={selectedDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />
        ),
        headerShadowVisible: false,
        headerLeft: () => (
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ),
        // TODO: Phase 2에서 검색 기능 구현 시 활성화
        // headerRight: () => (
        //   <TouchableOpacity onPress={handleSearch} style={{ marginRight: 8 }}>
        //     <Ionicons name="search" size={24} color={colors.icon} />
        //   </TouchableOpacity>
        // ),
      }}
    />
  );

  // 로딩 상태
  if (loading && !transactions.length) {
    return (
      <>
        {headerScreen}
        <LoadingState message="거래 내역을 불러오는 중..." />
      </>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <>
        {headerScreen}
        <ErrorState
          message="거래 내역을 불러올 수 없습니다"
          onRetry={refetch}
        />
      </>
    );
  }

  // 빈 상태
  if (!loading && transactions.length === 0) {
    return (
      <>
        {headerScreen}
        <EmptyState
          icon="receipt-outline"
          title="거래 내역이 없습니다"
          message="이번 달에는 아직 거래가 없어요"
        />
      </>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {headerScreen}

      <View style={styles.content}>
        {/* 애니메이션 캘린더 */}
        <Animated.View
          style={[animatedCalendarStyle, styles.calendarContainer]}
        >
          <Calendar
            mode="scrollable"
            viewType={calendarViewType}
            selectedDate={selectedDate}
            transactions={monthlyCalendarData ?? {}}
            onDateSelect={handleDateSelect}
            onViewTypeChange={handleCalendarViewChange}
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
          onScrollBeginDrag={onScrollBeginDrag}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          onScrollToIndexFailed={onScrollToIndexFailed}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          // 한 달 거래 = 섹션 + 아이템 합쳐 ~70~100 frame. 첫 렌더에 충분히 마운트되어야
          // 오래된 날짜로의 자동 스크롤 시 onScrollToIndexFailed가 발화하지 않는다.
          initialNumToRender={80}
          maxToRenderPerBatch={20}
          windowSize={31}
          ListFooterComponent={
            <View style={styles.footer}>
              <View style={styles.footerRow}>
                <Typography variant="body1" color="secondary">
                  수입
                </Typography>
                <AmountDisplay
                  amount={totals.income}
                  type="income"
                  size="medium"
                />
              </View>
              <View style={styles.footerRow}>
                <Typography variant="body1" color="secondary">
                  지출
                </Typography>
                <AmountDisplay
                  amount={totals.expense}
                  type="expense"
                  size="medium"
                />
              </View>
              <View
                style={[
                  styles.footerRow,
                  styles.footerTotal,
                  { borderTopColor: colors.border },
                ]}
              >
                <Typography variant="body1" weight="600">
                  이번 달 잔액
                </Typography>
                <AmountDisplay
                  amount={totals.balance}
                  type="neutral"
                  size="large"
                />
              </View>
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
  calendarContainer: {
    paddingHorizontal: 16,
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
    paddingVertical: 8,
    paddingTop: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  footerTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 16,
  },
});
