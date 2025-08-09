import { useCallback, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export function useCalendarScroll() {
  const scrollY = useSharedValue(0);
  const lastScrollY = useRef(0);
  
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    'worklet';
    const y = event.nativeEvent.contentOffset.y;
    scrollY.value = y;
    lastScrollY.current = y;
  }, [scrollY]);
  
  const scrollToDate = useCallback(() => {
    // This will be used to scroll to a specific date in the transaction list
    // Implementation depends on the list ref which will be passed from parent
  }, []);
  
  return {
    scrollY,
    handleScroll,
    scrollToDate,
  };
}