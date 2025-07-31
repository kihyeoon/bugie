import type { SupabaseClient } from '@supabase/supabase-js';
import type { CategoryType, Transaction } from '@repo/types';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilter,
  MonthlySummary,
} from './types';
import type {
  TransactionWithDetails,
  CategorySummary,
} from '../shared/types';

export class TransactionService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 거래 내역 조회
   */
  async getTransactions(
    filter: TransactionFilter
  ): Promise<{ data: TransactionWithDetails[]; count: number | null }> {
    let query = this.supabase
      .from('active_transactions')
      .select('*', { count: 'exact' })
      .eq('ledger_id', filter.ledgerId);

    // 날짜 필터
    if (filter.startDate) {
      query = query.gte('transaction_date', filter.startDate);
    }
    if (filter.endDate) {
      query = query.lte('transaction_date', filter.endDate);
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
    return { data, count };
  }

  /**
   * 특정 거래 상세 조회
   */
  async getTransaction(transactionId: string): Promise<TransactionWithDetails> {
    const { data, error } = await this.supabase
      .from('active_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 새 거래 생성
   */
  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error('인증이 필요합니다.');

    const { data, error } = await this.supabase
      .from('transactions')
      .insert({
        ledger_id: input.ledgerId,
        category_id: input.categoryId,
        created_by: user.id,
        amount: input.amount,
        type: input.type,
        title: input.title,
        description: input.description,
        transaction_date:
          input.transactionDate || new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 거래 수정
   */
  async updateTransaction(
    transactionId: string,
    input: UpdateTransactionInput
  ): Promise<Transaction> {
    const updateData: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 거래 삭제 (Soft Delete)
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('transactions')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    if (error) throw error;
  }

  /**
   * 월별 요약 정보 조회
   */
  async getMonthlySummary(
    ledgerId: string,
    year: number,
    month: number
  ): Promise<MonthlySummary> {
    // 해당 월의 시작일과 종료일 계산
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // 해당 월의 모든 거래 조회
    const { data: transactions } = await this.getTransactions({
      ledgerId,
      startDate,
      endDate,
      limit: 1000, // 월별 최대 거래 수
    });

    if (!transactions) {
      return {
        year,
        month,
        totalIncome: 0,
        totalExpense: 0,
        netAmount: 0,
        transactionCount: 0,
        dailySummary: {},
      };
    }

    // 일별 집계
    const dailySummary: Record<string, { income: number; expense: number }> =
      {};
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((transaction: TransactionWithDetails) => {
      const date = transaction.transaction_date;

      if (!dailySummary[date]) {
        dailySummary[date] = { income: 0, expense: 0 };
      }

      if (transaction.type === 'income') {
        dailySummary[date].income += Number(transaction.amount);
        totalIncome += Number(transaction.amount);
      } else {
        dailySummary[date].expense += Number(transaction.amount);
        totalExpense += Number(transaction.amount);
      }
    });

    return {
      year,
      month,
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense,
      transactionCount: transactions.length,
      dailySummary,
    };
  }

  /**
   * 캘린더용 월별 요약 (일별 합계만)
   */
  async getCalendarSummary(
    ledgerId: string,
    year: number,
    month: number
  ): Promise<{
    dailySummary: Record<string, { income: number; expense: number }>;
    monthlyTotal: { income: number; expense: number; balance: number };
  }> {
    const summary = await this.getMonthlySummary(ledgerId, year, month);

    return {
      dailySummary: summary.dailySummary,
      monthlyTotal: {
        income: summary.totalIncome,
        expense: summary.totalExpense,
        balance: summary.netAmount,
      },
    };
  }

  /**
   * 카테고리별 월별 집계
   */
  async getCategoryMonthlySummary(
    ledgerId: string,
    year: number,
    month: number
  ): Promise<CategorySummary[]> {
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('active_transactions')
      .select(
        'category_id, category_name, category_color, category_icon, type, amount'
      )
      .eq('ledger_id', ledgerId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    if (error) throw error;

    // 카테고리별 집계
    const categorySummary = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        categoryColor: string;
        categoryIcon: string;
        type: CategoryType;
        totalAmount: number;
        transactionCount: number;
      }
    >();

    data.forEach(
      (transaction: {
        category_id: string;
        category_name: string;
        category_color: string;
        category_icon: string;
        type: CategoryType;
        amount: string | number;
      }) => {
        const key = transaction.category_id;
        const existing = categorySummary.get(key);

        if (existing) {
          existing.totalAmount += Number(transaction.amount);
          existing.transactionCount += 1;
        } else {
          categorySummary.set(key, {
            categoryId: transaction.category_id,
            categoryName: transaction.category_name,
            categoryColor: transaction.category_color,
            categoryIcon: transaction.category_icon,
            type: transaction.type,
            totalAmount: Number(transaction.amount),
            transactionCount: 1,
          });
        }
      }
    );

    return Array.from(categorySummary.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .map((item) => ({
        category_id: item.categoryId,
        category_name: item.categoryName,
        category_color: item.categoryColor,
        category_icon: item.categoryIcon,
        total_amount: item.totalAmount,
        transaction_count: item.transactionCount,
        percentage: 0, // 나중에 계산
      }));
  }

  /**
   * 최근 거래 내역 조회
   */
  async getRecentTransactions(
    ledgerId: string,
    limit: number = 10
  ): Promise<TransactionWithDetails[] | null> {
    const { data } = await this.getTransactions({
      ledgerId,
      limit,
    });

    return data;
  }
}
