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
  categories: (ledgerId: string | undefined) =>
    ['categories', ledgerId] as const,
  monthlySummary: {
    all: ['monthlySummary'] as const,
    month: (ledgerId: string | undefined, year: number, month: number) =>
      ['monthlySummary', ledgerId, year, month] as const,
  },
};

/**
 * 거래를 추가·수정·삭제하면 홈 합계와 목록 행이 낡은 데이터가 된다.
 * 표시만 해두고 다시 받지는 않는다. 홈·목록은 돌아올 때 어차피 재조회하므로 여기서 받으면 요청만 두 번이 된다.
 */
export function invalidateTransactionLists(client: QueryClient) {
  for (const queryKey of [
    queryKeys.transactions.all,
    queryKeys.monthlySummary.all,
  ]) {
    client.invalidateQueries({ queryKey, refetchType: 'none' });
  }
}
