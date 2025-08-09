import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  SharedValue,
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
  const { mode, viewType, setViewType } = useCalendar();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Internal animation values
  const isExpanded = useSharedValue(viewType === 'month' ? 1 : 0);

  // Height calculations
  const monthViewHeight = 300; // 6 weeks * 50px per week
  const weekViewHeight = 80; // 1 week + reduced header

  useEffect(() => {
    if (mode !== 'scrollable' || !scrollY) return;
  }, [
    mode,
    scrollY,
    mergedConfig.threshold,
    mergedConfig.duration,
    setViewType,
  ]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    if (mode !== 'scrollable') {
      return {};
    }

    // Scrollable 모드에서만 애니메이션 높이 적용
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
