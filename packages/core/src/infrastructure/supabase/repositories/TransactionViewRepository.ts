import type { SupabaseClient } from '@supabase/supabase-js';
import type { TransactionFilter, CategorySummary } from '../../../domain/transaction/types';
import type { EntityId } from '../../../domain/shared/types';
import type { TransactionWithDetails as DbTransactionWithDetails } from '../../../shared/types';

/**
 * UI 데이터 조회를 위한 거래 뷰 리포지토리
 * active_transactions 뷰를 사용하여 UI에 필요한 추가 정보를 포함한 데이터를 제공
 */
export class TransactionViewRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * UI용 거래 상세 목록 조회
   * 카테고리명, 색상, 아이콘, 가계부명, 작성자명 등 UI 표시용 정보 포함
   */
  async findWithDetails(filter: TransactionFilter): Promise<{ data: DbTransactionWithDetails[]; total: number }> {
    let query = this.supabase
      .from('active_transactions')
      .select('*', { count: 'exact' })
      .eq('ledger_id', filter.ledgerId);

    // 날짜 필터
    if (filter.startDate) {
      query = query.gte('transaction_date', filter.startDate.toISOString().split('T')[0]);
    }
    if (filter.endDate) {
      query = query.lte('transaction_date', filter.endDate.toISOString().split('T')[0]);
    }

    // 타입 필터
    if (filter.type) {
      query = query.eq('type', filter.type);
    }

    // 카테고리 필터
    if (filter.categoryId) {
      query = query.eq('category_id', filter.categoryId);
    }

    // 정렬 및 페이징
    query = query
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filter.limit) {
      query = query.limit(filter.limit);
    }
    if (filter.offset) {
      query = query.range(
        filter.offset,
        filter.offset + (filter.limit || 10) - 1
      );
    }

    const { data, error, count } = await query;

    if (error) throw error;
    
    return {
      data: data || [],
      total: count || 0
    };
  }

  /**
   * UI용 특정 거래 상세 조회
   */
  async findByIdWithDetails(id: EntityId): Promise<DbTransactionWithDetails | null> {
    const { data, error } = await this.supabase
      .from('active_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * 카테고리별 요약 정보 조회 (UI용)
   * 카테고리명 등 UI 표시 정보 포함
   */
  async getCategorySummary(
    ledgerId: EntityId, 
    startDate: Date, 
    endDate: Date
  ): Promise<CategorySummary[]> {
    const { data, error } = await this.supabase
      .from('active_transactions')
      .select('category_id, category_name, type, amount')
      .eq('ledger_id', ledgerId)
      .gte('transaction_date', startDate.toISOString().split('T')[0])
      .lte('transaction_date', endDate.toISOString().split('T')[0]);

    if (error) throw error;

    // 카테고리별 집계
    const summaryMap = new Map<string, CategorySummary>();
    let totalExpense = 0;

    (data || []).forEach(transaction => {
      const key = transaction.category_id;
      const existing = summaryMap.get(key);
      const amount = Number(transaction.amount);

      if (transaction.type === 'expense') {
        totalExpense += amount;
      }

      if (existing) {
        existing.totalAmount += amount;
        existing.transactionCount += 1;
      } else {
        summaryMap.set(key, {
          categoryId: transaction.category_id,
          categoryName: transaction.category_name,
          totalAmount: amount,
          transactionCount: 1,
          percentage: 0
        });
      }
    });

    // 퍼센트 계산
    const summaries = Array.from(summaryMap.values());
    summaries.forEach(summary => {
      if (totalExpense > 0) {
        summary.percentage = (summary.totalAmount / totalExpense) * 100;
      }
    });

    return summaries.sort((a, b) => b.totalAmount - a.totalAmount);
  }
}