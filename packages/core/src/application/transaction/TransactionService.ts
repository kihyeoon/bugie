import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilterInput,
} from './types';
import type {
  TransactionWithDetails,
  CategorySummary,
} from '../../shared/types';
import type {
  MonthlySummary,
  TransactionFilter,
  TransactionRepository,
} from '../../domain/transaction/types';
import type { LedgerMemberRepository } from '../../domain/ledger/types';
import type { AuthService } from '../../domain/auth/types';
import { TransactionRules } from '../../domain/transaction/rules';
import { TransactionRepository as TransactionRepoImpl } from '../../infrastructure/supabase/repositories/TransactionRepository';
import { UnauthorizedError, NotFoundError } from '../../domain/shared/errors';

export class TransactionService {
  constructor(
    private transactionRepo: TransactionRepository,
    private memberRepo: LedgerMemberRepository,
    private authService: AuthService,
    private transactionRepoImpl: TransactionRepoImpl // For view data access
  ) {}

  /**
   * 거래 내역 조회
   */
  async getTransactions(
    filter: TransactionFilterInput
  ): Promise<{ data: TransactionWithDetails[]; count: number | null }> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 권한 확인
    const member = await this.memberRepo.findByLedgerAndUser(
      filter.ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    // Convert to domain filter
    const domainFilter: TransactionFilter = {
      ledgerId: filter.ledgerId,
      startDate: filter.startDate ? new Date(filter.startDate) : undefined,
      endDate: filter.endDate ? new Date(filter.endDate) : undefined,
      type: filter.type,
      categoryId: filter.categoryId,
      limit: filter.limit,
      offset: filter.offset,
    };

    // Use view data for UI
    const result = await this.transactionRepoImpl.findWithDetails(domainFilter);

    return {
      data: result.data,
      count: result.total,
    };
  }

  /**
   * 특정 거래 상세 조회
   */
  async getTransaction(transactionId: string): Promise<TransactionWithDetails> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 거래 조회
    const transaction = await this.transactionRepo.findById(transactionId);
    if (!transaction || transaction.isDeleted) {
      throw new NotFoundError('거래를 찾을 수 없습니다.');
    }

    // 권한 확인
    const member = await this.memberRepo.findByLedgerAndUser(
      transaction.ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    // Get detailed view data
    const detailed =
      await this.transactionRepoImpl.findByIdWithDetails(transactionId);
    if (!detailed) {
      throw new NotFoundError('거래 상세 정보를 찾을 수 없습니다.');
    }

    return detailed;
  }

  /**
   * 새 거래 생성
   */
  async createTransaction(input: CreateTransactionInput): Promise<string> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 권한 확인
    const member = await this.memberRepo.findByLedgerAndUser(
      input.ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    // viewer는 생성 불가
    if (member.role === 'viewer') {
      throw new UnauthorizedError('거래를 생성할 권한이 없습니다.');
    }

    // 도메인 규칙으로 거래 생성
    const transaction = TransactionRules.createTransaction({
      ledgerId: input.ledgerId,
      categoryId: input.categoryId,
      createdBy: currentUser.id,
      amount: input.amount,
      type: input.type,
      title: input.title,
      description: input.description,
      transactionDate: input.transactionDate
        ? new Date(input.transactionDate)
        : undefined,
    });

    // 저장
    await this.transactionRepo.save(transaction);

    // Return transaction ID
    return transaction.id;
  }

  /**
   * 거래 수정
   */
  async updateTransaction(
    transactionId: string,
    input: UpdateTransactionInput
  ): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 기존 거래 조회
    const transaction = await this.transactionRepo.findById(transactionId);
    if (!transaction || transaction.isDeleted) {
      throw new NotFoundError('거래를 찾을 수 없습니다.');
    }

    // 권한 확인
    const member = await this.memberRepo.findByLedgerAndUser(
      transaction.ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    // viewer는 수정 불가
    if (member.role === 'viewer') {
      throw new UnauthorizedError('거래를 수정할 권한이 없습니다.');
    }

    // 업데이트
    const updatedTransaction = TransactionRules.updateTransaction(transaction, {
      id: transactionId,
      categoryId: input.categoryId,
      amount: input.amount,
      type: input.type,
      title: input.title,
      description: input.description,
      transactionDate: input.transactionDate
        ? new Date(input.transactionDate)
        : undefined,
    });

    await this.transactionRepo.save(updatedTransaction);
  }

  /**
   * 거래 삭제 (Soft Delete)
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 기존 거래 조회
    const transaction = await this.transactionRepo.findById(transactionId);
    if (!transaction || transaction.isDeleted) {
      throw new NotFoundError('거래를 찾을 수 없습니다.');
    }

    // 권한 확인
    const member = await this.memberRepo.findByLedgerAndUser(
      transaction.ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    // viewer는 삭제 불가
    if (member.role === 'viewer') {
      throw new UnauthorizedError('거래를 삭제할 권한이 없습니다.');
    }

    await this.transactionRepo.delete(transactionId);
  }

  /**
   * 월별 요약 정보 조회
   */
  async getMonthlySummary(
    ledgerId: string,
    year: number,
    month: number
  ): Promise<MonthlySummary> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 권한 확인
    const member = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    return await this.transactionRepo.getMonthlySummary(ledgerId, year, month);
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

    // Convert dailySummaries array back to object format for calendar UI
    const dailySummary: Record<string, { income: number; expense: number }> =
      {};
    summary.dailySummaries.forEach((day) => {
      const dateStr = day.date.toISOString().split('T')[0];
      dailySummary[dateStr] = {
        income: day.income,
        expense: day.expense,
      };
    });

    return {
      dailySummary,
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
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 권한 확인
    const member = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const categorySummaries = await this.transactionRepo.getCategorySummary(
      ledgerId,
      startDate,
      endDate
    );

    // Transform to UI format
    return categorySummaries.map((summary) => ({
      category_id: summary.categoryId,
      category_name: summary.categoryName,
      category_color: '', // Not available in domain model
      category_icon: '', // Not available in domain model
      total_amount: summary.totalAmount,
      transaction_count: summary.transactionCount,
      percentage: summary.percentage,
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
