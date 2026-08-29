/**
 * 날짜 포맷팅 유틸리티 함수들
 */

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 한국식 날짜 포맷팅
 * @param date Date 객체 또는 ISO 문자열
 * @returns "2025년 1월 21일 (화)" 형식
 */
export const formatDateKorean = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return `${dateObj.getFullYear()}년 ${formatDayKorean(dateObj)}`;
};

/**
 * 연도를 뺀 한국식 날짜 포맷팅. 이미 어느 해인지 아는 화면에서 쓴다.
 * @param date Date 객체 또는 ISO 문자열
 * @returns "1월 21일 (화)" 형식
 */
export const formatDayKorean = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  return `${month}월 ${day}일 (${WEEKDAY_NAMES[dateObj.getDay()]})`;
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