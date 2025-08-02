import React, { memo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { CalendarDayProps } from './types';
import { formatTransactionAmount } from './utils/formatters';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export const CalendarDay = memo(({
  date,
  isToday,
  isSelected,
  isCurrentMonth,
  transaction,
  onPress,
}: CalendarDayProps) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const dayStyles = [
    styles.day,
    !isCurrentMonth && styles.otherMonth,
    isToday && styles.today,
    isSelected && styles.selected,
  ];
  
  const dayTextStyles = [
    styles.dayText,
    { color: isCurrentMonth ? colors.text : colors.textDisabled },
    isToday && styles.todayText,
    isSelected && styles.selectedText,
  ];
  
  return (
    <TouchableOpacity
      style={dayStyles}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={dayTextStyles}>{date.getDate()}</Text>
      
      {transaction && isCurrentMonth && (
        <View style={styles.transactionContainer}>
          {transaction.income > 0 && (
            <Text style={[styles.transactionText, styles.incomeText]}>
              {formatTransactionAmount(transaction.income, 'income')}
            </Text>
          )}
          {transaction.expense > 0 && (
            <Text style={[styles.transactionText, styles.expenseText]}>
              {formatTransactionAmount(transaction.expense, 'expense')}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
});

CalendarDay.displayName = 'CalendarDay';

const styles = StyleSheet.create({
  day: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  otherMonth: {
    opacity: 0.3,
  },
  today: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#3182F6',
  },
  selected: {
    backgroundColor: '#E8F3FF',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  todayText: {
    color: '#3182F6',
    fontWeight: '600',
  },
  selectedText: {
    color: '#3182F6',
  },
  transactionContainer: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  transactionText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  incomeText: {
    color: '#4E7EFF',
  },
  expenseText: {
    color: '#FF5A5F',
  },
});