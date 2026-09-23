import { QueryClient } from '@tanstack/react-query';

// 앱 전체에서 하나만 쓴다. 컴포넌트 안에서 만들면 리렌더마다 캐시가 사라진다.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 기본값 3회는 실패 화면이 뜨기까지 너무 오래 걸린다
      retry: 1,
    },
  },
});

interface TransactionFilters {
  categoryId?: string;
  type?: 'income' | 'expense';
}

// 무효화할 때 앞부분만으로 여러 쿼리를 한 번에 고를 수 있게 넓은 범위 → 좁은 범위 순으로 둔다.
export const queryKeys = {
  transactions: {
    all: ['transactions'] as const,
    month: (
      ledgerId: string | undefined,
      year: number,
      month: number,
      filters: TransactionFilters
    ) => ['transactions', ledgerId, year, month, filters] as const,
  },
  transaction: (transactionId: string | undefined) =>
    ['transaction', transactionId] as const,
};
