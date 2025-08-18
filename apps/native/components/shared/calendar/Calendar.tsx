import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { CalendarProvider, useCalendar } from './CalendarContext';
import { CalendarHeader } from './CalendarHeader';
import { CalendarWeekDays } from './CalendarWeekDays';
import { CalendarGrid } from './CalendarGrid';
import { CalendarProps } from './types';
import { useCalendarAnimation } from './hooks/useCalendarAnimation';
import { addMonths } from './utils/dateHelpers';

function CalendarContent({
  showHeader = true,
  containerStyle,
  animationConfig,
  scrollY,
  onViewTypeChange,
}: Pick<
  CalendarProps,
  'containerStyle' | 'animationConfig' | 'scrollY' | 'onViewTypeChange'
> & {
  showHeader?: boolean;
}) {
  const { animatedContainerStyle, animatedHeaderStyle, animatedWeekStyle } =
    useCalendarAnimation(scrollY, animationConfig);

  const { currentMonth, changeMonth, mode, viewType } = useCalendar();

  const handlePrevMonth = useCallback(() => {
    const prevMonth = addMonths(currentMonth, -1);
    changeMonth(prevMonth.getFullYear(), prevMonth.getMonth());
  }, [currentMonth, changeMonth]);

  const handleNextMonth = useCallback(() => {
    const nextMonth = addMonths(currentMonth, 1);
    changeMonth(nextMonth.getFullYear(), nextMonth.getMonth());
  }, [currentMonth, changeMonth]);

  // 드래그 제스처를 위한 애니메이션 값
  const dragY = useSharedValue(0);
  const GESTURE_THRESHOLD = 30; // 드래그 임계값

  // 뷰 타입 변경 핸들러
  const handleViewTypeChange = useCallback(
    (newViewType: string) => {
      if (onViewTypeChange) {
        onViewTypeChange(newViewType as 'month' | 'week');
      }
    },
    [onViewTypeChange]
  );

  // 제스처 핸들러 (v2 API)
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      dragY.value = 0;
    })
    .onUpdate((event) => {
      // scrollable 모드에서만 드래그 제스처 활성화
      if (mode === 'scrollable') {
        dragY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      // scrollable 모드에서만 처리
      if (mode !== 'scrollable') return;

      const translationY = event.translationY;
      const velocityY = event.velocityY;

      // 드래그 거리나 속도가 임계값을 넘으면 모드 변경
      if (
        Math.abs(translationY) > GESTURE_THRESHOLD ||
        Math.abs(velocityY) > 500
      ) {
        if (translationY < 0 && viewType === 'month') {
          // 위로 드래그 → 주간 모드 (축소)
          runOnJS(handleViewTypeChange)('week');
        } else if (translationY > 0 && viewType === 'week') {
          // 아래로 드래그 → 월간 모드 (확장)
          runOnJS(handleViewTypeChange)('month');
        }
      }

      // 드래그 값 초기화
      dragY.value = 0;
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.container, animatedContainerStyle, containerStyle]}
      >
        {showHeader && (
          <Animated.View style={animatedHeaderStyle}>
            <CalendarHeader
              currentMonth={currentMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          </Animated.View>
        )}

        <CalendarWeekDays />

        <CalendarGrid animatedStyle={animatedWeekStyle} />
      </Animated.View>
    </GestureDetector>
  );
}

export function Calendar({
  mode = 'static',
  viewType = 'month',
  selectedDate,
  transactions,
  onDateSelect,
  onMonthChange,
  onViewTypeChange,
  scrollY,
  animationConfig,
  containerStyle,
  showHeader,
  ...props
}: CalendarProps) {
  // showHeader가 명시적으로 전달되지 않은 경우, mode가 'static'일 때만 true
  const shouldShowHeader = showHeader ?? mode === 'static';

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
        showHeader={shouldShowHeader}
        containerStyle={containerStyle}
        animationConfig={animationConfig}
        scrollY={scrollY}
        onViewTypeChange={onViewTypeChange}
        {...props}
      />
    </CalendarProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    gap: 12,
  },
});
