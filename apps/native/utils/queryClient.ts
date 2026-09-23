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
  paymentMethods: (ledgerId: string | undefined) =>
    ['paymentMethods', ledgerId] as const,
  monthlySummary: {
    all: ['monthlySummary'] as const,
    month: (ledgerId: string | undefined, year: number, month: number) =>
      ['monthlySummary', ledgerId, year, month] as const,
  },
};

/**
 * 거래(또는 거래 행에 조인되는 카테고리·결제 수단·닉네임)를 바꾸면 홈 합계와 목록 행이 낡은 데이터가 된다.
 * 낡았다고 표시만 하고 다시 받지는 않는다(refetchType: 'none'). 홈·목록은 돌아올 때 어차피 재조회하므로
 * 여기서 받으면 요청만 두 번이 된다. staleTime을 늘리더라도 이 표시 덕분에 바뀐 데이터는 다시 받는다.
 */
export function invalidateTransactionLists(client: QueryClient) {
  client.invalidateQueries({
    queryKey: queryKeys.transactions.all,
    refetchType: 'none',
  });
  client.invalidateQueries({
    queryKey: queryKeys.monthlySummary.all,
    refetchType: 'none',
  });
}
