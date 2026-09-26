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
  updatePrompt: ['updatePrompt'] as const,
};

/**
 * 로그아웃하면 사용자 데이터 캐시를 비운다. 안 그러면 다음에 로그인한 사용자에게 이전 사용자 가계부가 보인다.
 * `meta: { userScoped: false }`인 쿼리만 남긴다 — 로그인 전에도 구독되는 쿼리는 이 표시를 달아야 한다.
 * clear()로 같이 지우면 구독 중인 옵저버가 캐시에서 빠진 쿼리에 붙은 채 남아 결과를 영영 못 받는다 (BGI-52).
 * 표시가 없으면 지우는 쪽이 기본이라, 빠뜨려도 다른 사용자 데이터가 새지는 않는다.
 */
export function clearUserQueries(client: QueryClient) {
  client.removeQueries({
    predicate: (query) => query.meta?.userScoped !== false,
  });
  client.getMutationCache().clear();
}

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
