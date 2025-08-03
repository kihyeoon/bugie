import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Typography, Card, Button, AmountDisplay } from '@/components/ui';
import { Calendar } from '@/components/shared/calendar';
import { CalendarTransaction } from '@/components/shared/calendar/types';
import { router } from 'expo-router';

export default function HomeScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const colors = Colors[colorScheme ?? 'light'];

  const userName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || '사용자';

  const formatMonth = (date: Date) => {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    );
  };

  // 더미 거래 데이터 (개발용)
  const dummyTransactions: CalendarTransaction = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    return {
      [`${year}-${String(month + 1).padStart(2, '0')}-01`]: {
        income: 50949,
        expense: 15500,
      },
      [`${year}-${String(month + 1).padStart(2, '0')}-02`]: {
        income: 0,
        expense: 40758,
      },
      [`${year}-${String(month + 1).padStart(2, '0')}-03`]: {
        income: 0,
        expense: 7750,
      },
      [`${year}-${String(month + 1).padStart(2, '0')}-04`]: {
        income: 2773580,
        expense: 15511,
      },
      [`${year}-${String(month + 1).padStart(2, '0')}-05`]: {
        income: 0,
        expense: 232230,
      },
      [`${year}-${String(month + 1).padStart(2, '0')}-06`]: {
        income: 0,
        expense: 84431,
      },
      [`${year}-${String(month + 1).padStart(2, '0')}-07`]: {
        income: 0,
        expense: 13700,
      },
      [`${year}-${String(month + 1).padStart(2, '0')}-08`]: {
        income: 1182,
        expense: 101900,
      },
      [`${year}-${String(month + 1).padStart(2, '0')}-09`]: {
        income: 100,
        expense: 14600,
      },
      [`${year}-${String(month + 1).padStart(2, '0')}-10`]: {
        income: 1100000,
        expense: 185290,
      },
      [`${year}-${String(month + 1).padStart(2, '0')}-11`]: {
        income: 51200000,
        expense: 110200,
      },
      [`${year}-${String(month + 1).padStart(2, '0')}-12`]: {
        income: 0,
        expense: 66900,
      },
    };
  }, [currentMonth]);

  // 월간 합계 계산
  const monthlyTotal = useMemo(() => {
    const totals = Object.values(dummyTransactions).reduce(
      (acc, day) => ({
        income: acc.income + day.income,
        expense: acc.expense + day.expense,
      }),
      { income: 0, expense: 0 }
    );

    return {
      ...totals,
      balance: totals.income - totals.expense,
    };
  }, [dummyTransactions]);

  // 날짜 선택 핸들러
  const handleDateSelect = (date: Date) => {
    // 해당 날짜의 거래 목록으로 이동
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const hasTransactions = dummyTransactions[dateKey];

    if (hasTransactions) {
      // TODO: 거래 목록 화면으로 네비게이션
      // router.push(`/transactions?date=${dateKey}`);
      console.log('Navigate to transactions for:', dateKey);
    }
  };

  // 월 변경 핸들러
  const handleMonthChange = (year: number, month: number) => {
    setCurrentMonth(new Date(year, month - 1));
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 헤더 */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <Typography variant="h3" color="secondary">
            안녕하세요, {userName}님
          </Typography>
        </View>

        {/* 캘린더 */}
        <Calendar
          mode="static"
          viewType="month"
          selectedDate={currentMonth}
          transactions={dummyTransactions}
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
              amount={monthlyTotal.income}
              type="income"
              size="medium"
            />
          </View>

          <View style={styles.summaryRow}>
            <Typography variant="body1" color="secondary">
              지출
            </Typography>
            <AmountDisplay
              amount={monthlyTotal.expense}
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
              amount={monthlyTotal.balance}
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F6',
  },
  monthButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 24,
    letterSpacing: -0.3,
  },
  calendarContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    minHeight: 460,
  },
  placeholderText: {
    fontSize: 14,
  },
  summaryCard: {
    marginHorizontal: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
  summaryAmount: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    marginBottom: 0,
  },
  summaryTotalAmount: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  quickAddButton: {
    marginHorizontal: 16,
    marginVertical: 20,
  },
});
