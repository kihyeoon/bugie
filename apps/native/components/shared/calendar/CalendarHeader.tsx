import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { CalendarHeaderProps } from './types';
import { formatMonthYear, formatWeekRange } from './utils/formatters';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useCalendar } from './CalendarContext';

export function CalendarHeader({
  currentMonth,
  onPrevMonth,
  onNextMonth,
}: CalendarHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { viewType, selectedDate } = useCalendar();
  
  const title = viewType === 'month' 
    ? formatMonthYear(currentMonth)
    : formatWeekRange(selectedDate || currentMonth);
  
  return (
    <Animated.View style={styles.container}>
      <TouchableOpacity
        onPress={onPrevMonth}
        style={styles.navButton}
        activeOpacity={0.7}
      >
        <IconSymbol name="chevron.left" size={20} color={colors.text} />
      </TouchableOpacity>
      
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      
      <TouchableOpacity
        onPress={onNextMonth}
        style={styles.navButton}
        activeOpacity={0.7}
      >
        <IconSymbol name="chevron.right" size={20} color={colors.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  navButton: {
    padding: 8,
  },
});