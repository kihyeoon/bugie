import { CalendarDate } from '../types';
import {
  startOfMonth,
  startOfWeek,
  addDays,
  addWeeks,
  format,
  isToday,
  isSameDay as isSameDayFns,
  isSameMonth as isSameMonthFns,
  addMonths as addMonthsFns,
  getWeek,
} from 'date-fns';

export const DAYS_IN_WEEK = 7;
export const WEEKS_IN_VIEW = 6;

export function getMonthDates(year: number, month: number): CalendarDate[] {
  const dates: CalendarDate[] = [];
  const firstDayOfMonth = startOfMonth(new Date(year, month));
  const startDate = startOfWeek(firstDayOfMonth, { weekStartsOn: 0 }); // 일요일 시작
  
  for (let week = 0; week < WEEKS_IN_VIEW; week++) {
    for (let day = 0; day < DAYS_IN_WEEK; day++) {
      const date = addDays(addWeeks(startDate, week), day);
      
      dates.push({
        date,
        isCurrentMonth: isSameMonthFns(date, firstDayOfMonth),
        isToday: isToday(date),
        weekIndex: week,
        dayIndex: day,
      });
    }
  }
  
  return dates;
}

export function getWeekDates(date: Date): CalendarDate[] {
  const dates: CalendarDate[] = [];
  const startDate = startOfWeek(date, { weekStartsOn: 0 }); // 일요일 시작
  
  for (let day = 0; day < DAYS_IN_WEEK; day++) {
    const weekDate = addDays(startDate, day);
    
    dates.push({
      date: weekDate,
      isCurrentMonth: true, // 주간 뷰에서는 모두 현재 달로 취급
      isToday: isToday(weekDate),
      weekIndex: 0,
      dayIndex: day,
    });
  }
  
  return dates;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return isSameDayFns(date1, date2);
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return isSameMonthFns(date1, date2);
}

export function formatDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
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
  return getWeek(date, { weekStartsOn: 0 }) - getWeek(startOfMonth(date), { weekStartsOn: 0 }) + 1;
}

export function addMonths(date: Date, months: number): Date {
  return addMonthsFns(date, months);
}