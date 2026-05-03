import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import {
  CalendarContextValue,
  CalendarMode,
  ViewType,
  CalendarTransaction,
} from './types';

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within CalendarProvider');
  }
  return context;
}

interface CalendarProviderProps {
  children: React.ReactNode;
  mode?: CalendarMode;
  initialViewType?: ViewType;
  selectedDate?: Date;
  transactions?: CalendarTransaction;
  onDateSelect?: (date: Date) => void;
  onMonthChange?: (year: number, month: number) => void;
}

export function CalendarProvider({
  children,
  mode = 'static',
  initialViewType = 'month',
  selectedDate: propSelectedDate,
  transactions,
  onDateSelect,
  onMonthChange,
}: CalendarProviderProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(propSelectedDate);
  const [currentMonth, setCurrentMonth] = useState(() => propSelectedDate || new Date());
  const [viewType, setViewType] = useState<ViewType>(initialViewType);

  // props로 전달된 selectedDate가 변경되면 내부 상태도 업데이트
  // selectedDate뿐 아니라 currentMonth도 함께 동기화해야 한다.
  // 외부 헤더(예: transactions.tsx)에서 월을 바꾸는 경우 changeMonth 콜백이 호출되지 않으므로
  // currentMonth가 정체되어 그리드가 이전 월에 고정되는 버그가 발생한다.
  useEffect(() => {
    if (propSelectedDate) {
      setSelectedDate(propSelectedDate);
      setCurrentMonth((prev) => {
        if (
          prev.getFullYear() === propSelectedDate.getFullYear() &&
          prev.getMonth() === propSelectedDate.getMonth()
        ) {
          return prev; // 같은 월이면 reference 유지 → 불필요한 그리드 재계산 방지
        }
        return new Date(
          propSelectedDate.getFullYear(),
          propSelectedDate.getMonth(),
          1
        );
      });
    }
  }, [propSelectedDate]);

  // props로 전달된 viewType이 변경되면 내부 상태도 업데이트
  useEffect(() => {
    setViewType(initialViewType);
  }, [initialViewType]);
  
  // Animation values for scrollable mode
  const animatedHeight = useSharedValue(mode === 'scrollable' ? 300 : 0);
  const animatedOpacity = useSharedValue(1);
  
  const selectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  }, [onDateSelect]);
  
  const changeMonth = useCallback((year: number, month: number) => {
    const newDate = new Date(year, month, 1);
    setCurrentMonth(newDate);
    onMonthChange?.(year, month);
  }, [onMonthChange]);
  
  const value = useMemo<CalendarContextValue>(() => ({
    mode,
    viewType,
    selectedDate,
    currentMonth,
    transactions,
    animatedHeight: mode === 'scrollable' ? animatedHeight : undefined,
    animatedOpacity: mode === 'scrollable' ? animatedOpacity : undefined,
    selectDate,
    changeMonth,
    setViewType,
  }), [
    mode,
    viewType,
    selectedDate,
    currentMonth,
    transactions,
    animatedHeight,
    animatedOpacity,
    selectDate,
    changeMonth,
  ]);
  
  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}