/**
 * 캘린더 날짜 포맷팅 유틸리티
 * 
 * 금액 관련 함수들은 @/utils/currency.ts로 이동되었습니다.
 * 이 파일은 날짜 포맷팅 함수들만 포함합니다.
 */

export function formatMonthYear(date: Date, locale: string = 'ko-KR'): string {
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
  });
}

export function formatWeekRange(startDate: Date, locale: string = 'ko-KR'): string {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  
  const month = startDate.toLocaleDateString(locale, { month: 'long' });
  const weekOfMonth = Math.ceil(startDate.getDate() / 7);
  
  return `${month} ${weekOfMonth}주`;
}