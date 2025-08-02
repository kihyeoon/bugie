import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { CalendarProvider, useCalendar } from './CalendarContext';
import { CalendarHeader } from './CalendarHeader';
import { CalendarWeekDays } from './CalendarWeekDays';
import { CalendarGrid } from './CalendarGrid';
import { CalendarProps } from './types';
import { useCalendarAnimation } from './hooks/useCalendarAnimation';
import { addMonths } from './utils/dateHelpers';

function CalendarContent({
  showNavigation = true,
  containerStyle,
  animationConfig,
  scrollY,
}: Pick<CalendarProps, 'containerStyle' | 'animationConfig' | 'scrollY'> & {
  showNavigation?: boolean;
}) {
  const {
    animatedContainerStyle,
    animatedHeaderStyle,
    animatedWeekStyle,
  } = useCalendarAnimation(scrollY, animationConfig);
  
  const { currentMonth, changeMonth } = useCalendar();
  
  const handlePrevMonth = useCallback(() => {
    const prevMonth = addMonths(currentMonth, -1);
    changeMonth(prevMonth.getFullYear(), prevMonth.getMonth());
  }, [currentMonth, changeMonth]);
  
  const handleNextMonth = useCallback(() => {
    const nextMonth = addMonths(currentMonth, 1);
    changeMonth(nextMonth.getFullYear(), nextMonth.getMonth());
  }, [currentMonth, changeMonth]);
  
  return (
    <Animated.View style={[styles.container, animatedContainerStyle, containerStyle]}>
      <Animated.View style={animatedHeaderStyle}>
        <CalendarHeader
          currentMonth={currentMonth}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          showNavigation={showNavigation}
        />
      </Animated.View>
      
      <CalendarWeekDays />
      
      <CalendarGrid animatedStyle={animatedWeekStyle} />
    </Animated.View>
  );
}

export function Calendar({
  mode = 'static',
  viewType = 'month',
  selectedDate,
  transactions,
  onDateSelect,
  onMonthChange,
  scrollY,
  animationConfig,
  containerStyle,
  ...props
}: CalendarProps) {
  // 스와이프 기능은 제거됨 (사용자 요청)
  const showNavigation = mode === 'static';
  
  return (
    <CalendarProvider
      mode={mode}
      initialViewType={viewType}
      selectedDate={selectedDate}
      transactions={transactions}
      onDateSelect={onDateSelect}
      onMonthChange={onMonthChange}
    >
      <CalendarContent
        showNavigation={showNavigation}
        containerStyle={containerStyle}
        animationConfig={animationConfig}
        scrollY={scrollY}
        {...props}
      />
    </CalendarProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});