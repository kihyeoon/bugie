import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getWeekdayNames } from './utils/dateHelpers';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface CalendarWeekDaysProps {
  locale?: string;
}

export const CalendarWeekDays = memo(({ locale = 'ko-KR' }: CalendarWeekDaysProps) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const weekdays = getWeekdayNames(locale);
  
  return (
    <View style={styles.container}>
      {weekdays.map((day, index) => (
        <View key={index} style={styles.weekday}>
          <Text
            style={[
              styles.weekdayText,
              { color: colors.textSecondary },
              index === 0 && { color: colors.expense },
              index === 6 && { color: colors.income },
            ]}
          >
            {day}
          </Text>
        </View>
      ))}
    </View>
  );
});

CalendarWeekDays.displayName = 'CalendarWeekDays';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  weekday: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});