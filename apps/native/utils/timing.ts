/**
 * 타이밍 관련 유틸리티 함수들
 */

/**
 * 디바운스 함수 - 연속된 호출을 지연시켜 마지막 호출만 실행
 * @param func 실행할 함수
 * @param delay 지연 시간 (ms)
 * @returns 디바운스된 함수 (cancel 메서드 포함)
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: number;
  
  const debouncedFunc = ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T & { cancel: () => void };
  
  debouncedFunc.cancel = () => {
    clearTimeout(timeoutId);
  };
  
  return debouncedFunc;
}

/**
 * 스로틀 함수 - 지정된 시간 간격으로만 함수 실행 허용
 * @param func 실행할 함수
 * @param limit 제한 시간 (ms)
 * @returns 스로틀된 함수
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean;
  
  return ((...args: any[]) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
}

/**
 * 지연 실행 함수
 * @param ms 지연 시간 (ms)
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}