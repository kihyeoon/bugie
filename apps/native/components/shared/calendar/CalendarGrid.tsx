import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  AnimatedStyleProp,
} from 'react-native-reanimated';
import { CalendarDay } from './CalendarDay';
import { useCalendar } from './CalendarContext';
import { useCalendarDates } from './hooks/useCalendarDates';
import { formatDateKey, isSameDay } from './utils/dateHelpers';

interface CalendarGridProps {
  animatedStyle?: AnimatedStyleProp<ViewStyle>;
}

export function CalendarGrid({ animatedStyle }: CalendarGridProps) {
  const { selectedDate, selectDate, transactions, viewType } = useCalendar();
  const { weekDates, selectedWeekIndex } = useCalendarDates();

  const weekAnimatedStyle = useAnimatedStyle(() => {
    if (viewType === 'month') {
      return {
        opacity: 1,
      };
    }

    // 주간 뷰에서는 선택된 주만 보이도록
    return {
      opacity: 1,
      height: 50, // 주간 뷰 높이
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {weekDates.map((week, weekIndex) => {
        // 월간 뷰: 모든 주 표시
        // 주간 뷰: 선택된 날짜가 속한 주만 표시 (이미 weekDates에서 필터링됨)
        const shouldShow =
          viewType === 'month' || 
          (viewType === 'week' && weekIndex === 0) ||
          weekIndex === selectedWeekIndex;

        if (!shouldShow) return null;

        return (
          <Animated.View
            key={`week-${weekIndex}`}
            style={[styles.week, weekAnimatedStyle]}
          >
            {week.map((day) => {
              const dateKey = formatDateKey(day.date);
              const transaction = transactions?.[dateKey];
              const isSelected = selectedDate
                ? isSameDay(day.date, selectedDate)
                : false;

              return (
                <CalendarDay
                  key={dateKey}
                  date={day.date}
                  isToday={day.isToday}
                  isSelected={isSelected}
                  isCurrentMonth={day.isCurrentMonth}
                  transaction={transaction}
                  onPress={() => selectDate(day.date)}
                />
              );
            })}
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
  },
  week: {
    flexDirection: 'row',
    marginBottom: 2,
  },
});
