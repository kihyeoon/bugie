import type { EntityId } from '../../../domain/shared/types';

/**
 * "누구의 거래인가" = 지출자, 없으면 작성자 — PostgREST `or` 조건.
 * get_daily_summary RPC의 `coalesce(paid_by, created_by) = p_member_id`와 같은 규칙이어야
 * 캘린더 합계와 목록이 같은 거래를 센다 (docs/features/member-filter/design.md §4.3).
 */
export function memberFilter(memberId: EntityId): string {
  return `paid_by.eq.${memberId},and(paid_by.is.null,created_by.eq.${memberId})`;
}
