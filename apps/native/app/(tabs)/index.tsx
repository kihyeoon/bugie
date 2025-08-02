import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Typography, Card, Button, AmountDisplay } from '@/components/ui';

export default function HomeScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const colors = Colors[colorScheme ?? 'light'];

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '사용자';

  const formatMonth = (date: Date) => {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };


  return (
    <ThemedView style={styles.container}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Typography variant="h3" color="secondary">
          안녕하세요, {userName}님
        </Typography>
      </View>

      {/* 월 선택 */}
      <View style={[styles.monthSelector, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={goToPreviousMonth} style={styles.monthButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Typography variant="h4">{formatMonth(currentMonth)}</Typography>
        <TouchableOpacity onPress={goToNextMonth} style={styles.monthButton}>
          <IconSymbol name="chevron.right" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* 캘린더 (임시) */}
      <Card variant="filled" style={[styles.calendar, { backgroundColor: colors.backgroundSecondary }]}>
        <Typography variant="body2" color="secondary" align="center">
          캘린더 컴포넌트 (구현 예정)
        </Typography>
      </Card>

      {/* 월간 요약 */}
      <Card variant="elevated" style={styles.summaryCard}>
        <Typography variant="body1" weight="600" style={{ marginBottom: 20 }}>
          이번 달 요약
        </Typography>
        
        <View style={styles.summaryRow}>
          <Typography variant="body1" color="secondary">수입</Typography>
          <AmountDisplay
            amount={0}
            type="income"
            size="medium"
          />
        </View>
        
        <View style={styles.summaryRow}>
          <Typography variant="body1" color="secondary">지출</Typography>
          <AmountDisplay
            amount={0}
            type="expense"
            size="medium"
          />
        </View>
        
        <View style={[styles.summaryRow, styles.summaryTotal, { borderTopColor: colors.border }]}>
          <Typography variant="body1">잔액</Typography>
          <AmountDisplay
            amount={0}
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
      >
        빠른 입력
      </Button>
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
    paddingBottom: 20,
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
  calendar: {
    flex: 1,
    margin: 24,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
  },
  summaryCard: {
    marginHorizontal: 24,
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
    marginHorizontal: 24,
    marginVertical: 20,
  },
});