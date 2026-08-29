import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
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
  visibleMonth?: Date;
  transactions?: CalendarTransaction;
  onDateSelect?: (date: Date) => void;
  onMonthChange?: (year: number, month: number) => void;
}

export function CalendarProvider({
  children,
  mode = 'static',
  initialViewType = 'month',
  selectedDate: propSelectedDate,
  visibleMonth,
  transactions,
  onDateSelect,
  onMonthChange,
}: CalendarProviderProps) {
  // 선택 날짜는 props가 소유한다(controlled). 내부 사본을 두면 부모가 콜백을 무시하거나
  // 미룰 때 한 프레임 동안 사본이 이기는 상태가 생긴다.
  const [currentMonth, setCurrentMonth] = useState(
    () => visibleMonth || propSelectedDate || new Date()
  );
  const [viewType, setViewType] = useState<ViewType>(initialViewType);

  // 표시할 월을 동기화한다. visibleMonth를 넘기면 그것이 기준이고,
  // 없으면 selectedDate에서 유도한다(선택 = 그 달을 본다는 뜻인 화면들).
  // 외부 헤더(예: transactions.tsx)에서 월을 바꾸는 경우 changeMonth 콜백이 호출되지 않으므로
  // 여기서 맞춰주지 않으면 그리드가 이전 월에 고정된다.
  useEffect(() => {
    const source = visibleMonth ?? propSelectedDate;
    if (!source) return;

    setCurrentMonth((prev) => {
      if (
        prev.getFullYear() === source.getFullYear() &&
        prev.getMonth() === source.getMonth()
      ) {
        return prev; // 같은 월이면 reference 유지 → 불필요한 그리드 재계산 방지
      }
      return new Date(source.getFullYear(), source.getMonth(), 1);
    });
  }, [visibleMonth, propSelectedDate]);

  // props로 전달된 viewType이 변경되면 내부 상태도 업데이트
  useEffect(() => {
    setViewType(initialViewType);
  }, [initialViewType]);

  // Animation values for scrollable mode
  const animatedHeight = useSharedValue(mode === 'scrollable' ? 300 : 0);
  const animatedOpacity = useSharedValue(1);

  const selectDate = useCallback(
    (date: Date) => {
      onDateSelect?.(date);
    },
    [onDateSelect]
  );

  const changeMonth = useCallback(
    (year: number, month: number) => {
      const newDate = new Date(year, month, 1);
      setCurrentMonth(newDate);
      onMonthChange?.(year, month);
    },
    [onMonthChange]
  );

  const value = useMemo<CalendarContextValue>(
    () => ({
      mode,
      viewType,
      selectedDate: propSelectedDate,
      currentMonth,
      transactions,
      animatedHeight: mode === 'scrollable' ? animatedHeight : undefined,
      animatedOpacity: mode === 'scrollable' ? animatedOpacity : undefined,
      selectDate,
      changeMonth,
      setViewType,
    }),
    [
      mode,
      viewType,
      propSelectedDate,
      currentMonth,
      transactions,
      animatedHeight,
      animatedOpacity,
      selectDate,
      changeMonth,
    ]
  );

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}
