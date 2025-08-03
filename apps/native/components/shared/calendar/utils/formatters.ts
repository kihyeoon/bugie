export function formatAmount(amount: number): string {
  if (amount === 0) return '';
  
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 1000000) {
    // 백만 단위
    const millions = absAmount / 1000000;
    return `${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
  } else if (absAmount >= 1000) {
    // 천 단위
    const thousands = absAmount / 1000;
    return `${thousands.toFixed(thousands >= 10 ? 0 : 1)}k`;
  }
  
  return absAmount.toString();
}

export function formatTransactionAmount(amount: number, type: 'income' | 'expense'): string {
  const formatted = formatAmount(amount);
  if (!formatted) return '';
  
  return type === 'income' ? `+${formatted}` : `-${formatted}`;
}

export function formatFullAmount(amount: number): string {
  if (amount === 0) return '';
  
  const absAmount = Math.abs(amount);
  
  // 천만원 이상은 축약 표현
  if (absAmount >= 10000000) {
    const millions = absAmount / 1000000;
    return `${millions.toFixed(millions >= 100 ? 0 : 1)}M`;
  }
  
  // 천만원 미만은 전체 표시
  return absAmount.toLocaleString('ko-KR');
}

export function formatFullTransactionAmount(amount: number, type: 'income' | 'expense'): string {
  const formatted = formatFullAmount(amount);
  if (!formatted) return '';
  
  return type === 'income' ? `+${formatted}` : `-${formatted}`;
}

export function formatCurrency(amount: number, currency: string = 'KRW'): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

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