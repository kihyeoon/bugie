import { useMemo } from 'react';
import { useCalendar } from '../CalendarContext';
import { CalendarDate } from '../types';
import { getMonthDates, getWeekDates } from '../utils/dateHelpers';

export function useCalendarDates() {
  const { currentMonth, viewType, selectedDate } = useCalendar();
  
  const dates = useMemo(() => {
    if (viewType === 'month') {
      return getMonthDates(
        currentMonth.getFullYear(),
        currentMonth.getMonth()
      );
    } else {
      // 주간 뷰에서는 선택된 날짜가 속한 주를 표시
      const targetDate = selectedDate || new Date();
      return getWeekDates(targetDate);
    }
  }, [currentMonth, viewType, selectedDate]);
  
  const weekDates = useMemo(() => {
    // 주별로 날짜 그룹핑
    const weeks: CalendarDate[][] = [];
    
    if (viewType === 'month') {
      for (let i = 0; i < dates.length; i += 7) {
        weeks.push(dates.slice(i, i + 7));
      }
    } else {
      // 주간 뷰는 하나의 주만 표시
      weeks.push(dates);
    }
    
    return weeks;
  }, [dates, viewType]);
  
  const selectedWeekIndex = useMemo(() => {
    if (!selectedDate) return 0;
    
    if (viewType === 'week') {
      // 주간 뷰에서는 항상 0 (이미 선택된 날짜가 속한 주만 표시)
      return 0;
    }
    
    // 월간 뷰에서 선택된 날짜가 속한 주 인덱스 계산
    const selectedDateInfo = dates.find(d => 
      d.date.getDate() === selectedDate.getDate() &&
      d.date.getMonth() === selectedDate.getMonth() &&
      d.date.getFullYear() === selectedDate.getFullYear()
    );
    
    return selectedDateInfo?.weekIndex || 0;
  }, [selectedDate, dates, viewType]);
  
  return {
    dates,
    weekDates,
    selectedWeekIndex,
  };
}