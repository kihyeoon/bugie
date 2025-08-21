/**
 * 날짜 포맷팅 유틸리티 함수들
 */

/**
 * 한국식 날짜 포맷팅
 * @param date Date 객체 또는 ISO 문자열
 * @returns "2025년 1월 21일 (화)" 형식
 */
export const formatDateKorean = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
  return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
};

/**
 * 날짜시간 포맷팅 (거래 상세용)
 * @param dateStr ISO 문자열
 * @returns "2025년 1월 21일 (화) 오후 2:30" 형식
 */
export const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};