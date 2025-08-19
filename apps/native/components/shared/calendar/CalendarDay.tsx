import React, { memo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { CalendarDayProps } from './types';
import { formatCalendarAmount } from '@/utils/currency';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export const CalendarDay = memo(
  ({
    date,
    isToday,
    isSelected,
    isCurrentMonth,
    transaction,
    onPress,
  }: CalendarDayProps) => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const dayStyles = [styles.day, !isCurrentMonth && styles.otherMonth];

    const dayTextStyles = [
      styles.dayText,
      { color: isCurrentMonth ? colors.text : colors.textDisabled },
      isToday && styles.todayText,
      isSelected && !isToday && { color: colors.tint },
    ];

    return (
      <TouchableOpacity style={dayStyles} onPress={onPress} activeOpacity={0.7}>
        <View
          style={[
            styles.dayContent,
            isSelected && [
              styles.selectedBackground,
              {
                backgroundColor: colors.tintLight,
                shadowColor: colors.tint,
              },
            ],
          ]}
        >
          <View
            style={[
              styles.dayTextContainer,
              isToday && [styles.todayBadge, { backgroundColor: colors.tint }],
            ]}
          >
            <Text
              style={[
                dayTextStyles,
                isToday && styles.todayBadgeText,
                isSelected && !isToday && styles.selectedText,
              ]}
            >
              {date.getDate()}
            </Text>
          </View>

          {transaction && isCurrentMonth && (
            <View style={styles.transactionContainer}>
              {transaction.income > 0 && (
                <Text
                  style={[styles.transactionText, { color: colors.income }]}
                >
                  {formatCalendarAmount(transaction.income, 'income')}
                </Text>
              )}
              {transaction.expense > 0 && (
                <Text
                  style={[styles.transactionText, { color: colors.expense }]}
                >
                  {formatCalendarAmount(transaction.expense, 'expense')}
                </Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }
);

CalendarDay.displayName = 'CalendarDay';

const styles = StyleSheet.create({
  day: {
    flex: 1,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  otherMonth: {
    opacity: 0.3,
  },
  dayContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingBottom: 4,
  },
  dayTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    minHeight: 20,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  todayBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: {
    fontWeight: '600',
  },
  todayBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectedBackground: {
    borderRadius: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  selectedText: {
    fontWeight: '600',
  },
  transactionContainer: {
    alignItems: 'center',
    gap: 1,
    flexShrink: 0,
  },
  transactionRow: {
    flexDirection: 'row',
    gap: 2,
  },
  transactionText: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: -0.5,
    lineHeight: 12,
    height: 12,
  },
});
