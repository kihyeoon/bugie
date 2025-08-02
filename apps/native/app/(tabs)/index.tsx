import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';

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

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ko-KR');
  };

  return (
    <ThemedView style={styles.container}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.greeting, { color: colors.textSecondary }]}>
          안녕하세요, {userName}님
        </Text>
      </View>

      {/* 월 선택 */}
      <View style={[styles.monthSelector, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={goToPreviousMonth} style={styles.monthButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: colors.text }]}>{formatMonth(currentMonth)}</Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.monthButton}>
          <IconSymbol name="chevron.right" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* 캘린더 (임시) */}
      <View style={[styles.calendar, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
          캘린더 컴포넌트 (구현 예정)
        </Text>
      </View>

      {/* 월간 요약 */}
      <View style={[styles.summaryCard, { backgroundColor: colors.background }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>이번 달 요약</Text>
        
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>수입</Text>
          <Text style={[styles.summaryAmount, { color: colors.income }]}>
            +{formatCurrency(0)}원
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>지출</Text>
          <Text style={[styles.summaryAmount, { color: colors.expense }]}>
            -{formatCurrency(0)}원
          </Text>
        </View>
        
        <View style={[styles.summaryRow, styles.summaryTotal, { borderTopColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.text }]}>잔액</Text>
          <Text style={[styles.summaryTotalAmount, { color: colors.text }]}>
            {formatCurrency(0)}원
          </Text>
        </View>
      </View>

      {/* 빠른 입력 버튼 */}
      <TouchableOpacity
        style={[styles.quickAddButton, { backgroundColor: colors.tint }]}
        activeOpacity={0.8}
      >
        <IconSymbol name="plus" size={20} color="white" />
        <Text style={styles.quickAddText}>빠른 입력</Text>
      </TouchableOpacity>
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
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginVertical: 20,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  quickAddText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});