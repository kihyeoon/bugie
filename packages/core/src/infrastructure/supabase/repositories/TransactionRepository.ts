import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  TransactionEntity,
  TransactionRepository as ITransactionRepository,
  TransactionFilter,
  DailySummary,
  MonthlySummary,
  CategorySummary,
} from '../../../domain/transaction/types';
import type { EntityId } from '../../../domain/shared/types';
import { TransactionRules } from '../../../domain/transaction/rules';
import { TransactionMapper } from '../mappers/TransactionMapper';

/**
 * Supabase를 사용한 거래 리포지토리 구현
 */
export class TransactionRepository implements ITransactionRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: EntityId): Promise<TransactionEntity | null> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;
    return TransactionMapper.toDomain(data);
  }

  async findByFilter(
    filter: TransactionFilter
  ): Promise<{ data: TransactionEntity[]; total: number }> {
    let query = this.supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('ledger_id', filter.ledgerId)
      .is('deleted_at', null);

    // 날짜 필터
    if (filter.startDate) {
      query = query.gte(
        'transaction_date',
        filter.startDate.toISOString().split('T')[0]
      );
    }
    if (filter.endDate) {
      query = query.lte(
        'transaction_date',
        filter.endDate.toISOString().split('T')[0]
      );
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
      data: (data || []).map((item) => TransactionMapper.toDomain(item)),
      total: count || 0,
    };
  }

  async create(transaction: Omit<TransactionEntity, 'id'>): Promise<EntityId> {
    const dbData = TransactionMapper.toDbForCreate(transaction);

    const { data, error } = await this.supabase
      .from('transactions')
      .insert(dbData)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async update(transaction: TransactionEntity): Promise<void> {
    const dbData = TransactionMapper.toDb(transaction);

    const { error } = await this.supabase
      .from('transactions')
      .update(dbData)
      .eq('id', transaction.id);

    if (error) throw error;
  }

  async delete(id: EntityId): Promise<void> {
    // RLS 정책을 우회하기 위해 RPC 함수 사용
    const { error } = await this.supabase.rpc('soft_delete_transaction', {
      transaction_id: id
    });

    if (error) throw error;
  }

  async countByCategoryId(categoryId: EntityId): Promise<number> {
    const { count, error } = await this.supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId)
      .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
  }

  async updateCategoryBatch(
    fromCategoryId: EntityId,
    toCategoryId: EntityId
  ): Promise<number> {
    // 먼저 영향받을 거래 수 확인
    const count = await this.countByCategoryId(fromCategoryId);

    if (count > 0) {
      const { error } = await this.supabase
        .from('transactions')
        .update({
          category_id: toCategoryId,
          updated_at: new Date().toISOString(),
        })
        .eq('category_id', fromCategoryId)
        .is('deleted_at', null);

      if (error) throw error;
    }

    return count;
  }

  async getDailySummary(ledgerId: EntityId, date: Date): Promise<DailySummary> {
    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('transactions')
      .select('amount, type')
      .eq('ledger_id', ledgerId)
      .eq('transaction_date', dateStr)
      .is('deleted_at', null);

    if (error) throw error;

    let income = 0;
    let expense = 0;
    let transactionCount = 0;

    (data || []).forEach((transaction) => {
      if (transaction.type === 'income') {
        income += Number(transaction.amount);
      } else {
        expense += Number(transaction.amount);
      }
      transactionCount++;
    });

    return {
      date,
      income,
      expense,
      transactionCount,
    };
  }

  async getMonthlySummary(
    ledgerId: EntityId,
    year: number,
    month: number
  ): Promise<MonthlySummary> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('ledger_id', ledgerId)
      .gte('transaction_date', startDate.toISOString().split('T')[0])
      .lte('transaction_date', endDate.toISOString().split('T')[0])
      .is('deleted_at', null)
      .order('transaction_date');

    if (error) throw error;

    const transactions = (data || []).map((item) =>
      TransactionMapper.toDomain(item)
    );
    const dailySummaries = TransactionRules.calculateDailySummary(transactions);

    return TransactionRules.calculateMonthlySummary(
      year,
      month,
      dailySummaries
    );
  }

  async getCategorySummary(
    ledgerId: EntityId,
    startDate: Date,
    endDate: Date
  ): Promise<CategorySummary[]> {
    // 카테고리별 집계를 위해 순수 거래 데이터 조회
    const { data, error } = await this.supabase
      .from('transactions')
      .select('category_id, type, amount')
      .eq('ledger_id', ledgerId)
      .gte('transaction_date', startDate.toISOString().split('T')[0])
      .lte('transaction_date', endDate.toISOString().split('T')[0])
      .is('deleted_at', null);

    if (error) throw error;

    // 카테고리별 집계 (카테고리명은 포함하지 않음)
    const summaryMap = new Map<string, CategorySummary>();
    let totalExpense = 0;

    (data || []).forEach((transaction) => {
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
          categoryName: '', // UI layer에서 채워야 함
          totalAmount: amount,
          transactionCount: 1,
          percentage: 0,
        });
      }
    });

    // 퍼센트 계산
    const summaries = Array.from(summaryMap.values());
    summaries.forEach((summary) => {
      if (totalExpense > 0) {
        summary.percentage = (summary.totalAmount / totalExpense) * 100;
      }
    });

    return summaries.sort((a, b) => b.totalAmount - a.totalAmount);
  }
}
