import { useCallback } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';

/**
 * 데이터 hook이 화면에 넘기는 로딩·에러·새로고침을 한 규칙으로 만든다.
 *
 * - loading: 보여줄 데이터 없이 처음 받는 중일 때만. isPending은 비활성 쿼리(가계부 없음 등)에서도
 *   true라 쓰면 홈 스플래시가 풀리지 않는다.
 * - error: 보여줄 데이터가 없을 때만. 재조회만 실패했으면 받아둔 데이터를 그대로 보여준다.
 * - refetch: useQuery의 refetch는 enabled를 무시하므로 비활성이면 아무것도 안 한다.
 *   화면이 마운트 직후 포커스 refetch를 부르면 진행 중인 요청을 같이 쓴다(기본값은 취소 후 재요청).
 */
export function useQueryStatus<T>(query: UseQueryResult<T>, enabled: boolean) {
  const { refetch: refetchQuery } = query;
  const refetch = useCallback(async () => {
    if (enabled) await refetchQuery({ cancelRefetch: false });
  }, [enabled, refetchQuery]);

  return {
    loading: query.isLoading,
    error: query.data === undefined ? query.error : null,
    refetch,
  };
}
