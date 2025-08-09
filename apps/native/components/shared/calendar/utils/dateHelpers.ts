import { CalendarDate } from '../types';

export const DAYS_IN_WEEK = 7;
export const WEEKS_IN_VIEW = 6;

export function getMonthDates(year: number, month: number): CalendarDate[] {
  const dates: CalendarDate[] = [];
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  const today = new Date();
  
  // 주의 시작일을 일요일로 맞추기
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  for (let week = 0; week < WEEKS_IN_VIEW; week++) {
    for (let day = 0; day < DAYS_IN_WEEK; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + (week * DAYS_IN_WEEK + day));
      
      dates.push({
        date,
        isCurrentMonth: date.getMonth() === month,
        isToday: isSameDay(date, today),
        weekIndex: week,
        dayIndex: day,
      });
    }
  }
  
  return dates;
}

export function getWeekDates(date: Date): CalendarDate[] {
  const dates: CalendarDate[] = [];
  const startOfWeek = new Date(date);
  const today = new Date();
  
  // 주의 시작일을 일요일로 맞추기
  startOfWeek.setDate(date.getDate() - date.getDay());
  
  for (let day = 0; day < DAYS_IN_WEEK; day++) {
    const weekDate = new Date(startOfWeek);
    weekDate.setDate(startOfWeek.getDate() + day);
    
    dates.push({
      date: weekDate,
      isCurrentMonth: true, // 주간 뷰에서는 모두 현재 달로 취급
      isToday: isSameDay(weekDate, today),
      weekIndex: 0,
      dayIndex: day,
    });
  }
  
  return dates;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  );
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonthName(date: Date, locale: string = 'ko-KR'): string {
  return date.toLocaleDateString(locale, { month: 'long' });
}

export function getWeekdayNames(locale: string = 'ko-KR'): string[] {
  const baseDate = new Date(2024, 0, 7); // 2024년 1월 7일은 일요일
  const weekdays: string[] = [];
  
  for (let i = 0; i < DAYS_IN_WEEK; i++) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + i);
    weekdays.push(date.toLocaleDateString(locale, { weekday: 'short' }));
  }
  
  return weekdays;
}

export function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayOfWeek = firstDay.getDay();
  const dayOfMonth = date.getDate();
  
  return Math.ceil((dayOfMonth + firstDayOfWeek) / DAYS_IN_WEEK);
}

export function addMonths(date: Date, months: number): Date {
  const newDate = new Date(date);
  newDate.setMonth(date.getMonth() + months);
  return newDate;
}