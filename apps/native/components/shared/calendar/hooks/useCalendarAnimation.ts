import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  SharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCalendar } from '../CalendarContext';
import { CalendarAnimationConfig } from '../types';

const DEFAULT_CONFIG: Required<CalendarAnimationConfig> = {
  threshold: 50,
  duration: 300,
  enableSnap: true,
};

export function useCalendarAnimation(
  scrollY?: SharedValue<number>,
  config?: CalendarAnimationConfig
) {
  const { mode, viewType } = useCalendar();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // 내부 애니메이션 값
  const isExpanded = useSharedValue(viewType === 'month' ? 1 : 0);

  // 높이 계산
  const monthViewHeight = 320; // CALENDAR_MONTH_HEIGHT와 일치
  const weekViewHeight = 120; // CALENDAR_WEEK_HEIGHT와 일치

  useEffect(() => {
    if (mode !== 'scrollable' || !scrollY) return;

    // viewType 변경 시 애니메이션 값 업데이트
    const targetValue = viewType === 'month' ? 1 : 0;
    isExpanded.value = withTiming(targetValue, {
      duration: mergedConfig.duration,
    });
  }, [mode, scrollY, viewType, mergedConfig.duration, isExpanded]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    if (mode !== 'scrollable') {
      return {};
    }

    // 스크롤 가능 모드에서만 애니메이션 높이 적용
    const height = interpolate(
      isExpanded.value,
      [0, 1],
      [weekViewHeight, monthViewHeight]
    );

    return {
      height,
    };
  });

  const animatedWeekStyle = useAnimatedStyle(() => {
    if (mode !== 'scrollable') {
      return {
        opacity: 1,
        transform: [{ translateY: 0 }],
      };
    }

    // 주간 뷰로 전환될 때 선택된 주만 보이도록
    return {
      opacity: interpolate(isExpanded.value, [0, 0.5, 1], [1, 0.8, 1]),
    };
  });

  const animatedHeaderStyle = useAnimatedStyle(() => {
    if (mode !== 'scrollable') {
      return {
        opacity: 1,
        height: 40,
      };
    }

    // 헤더 축소 애니메이션
    const opacity = interpolate(isExpanded.value, [0, 1], [0.8, 1]);

    const height = interpolate(isExpanded.value, [0, 1], [30, 40]);

    return {
      opacity,
      height,
    };
  });

  return {
    animatedContainerStyle,
    animatedWeekStyle,
    animatedHeaderStyle,
    isExpanded,
  };
}
