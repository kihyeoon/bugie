import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
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
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [viewType, setViewType] = useState<ViewType>(initialViewType);
  
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