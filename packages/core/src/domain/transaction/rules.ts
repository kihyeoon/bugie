import type {
  TransactionEntity,
  CreateTransactionCommand,
  UpdateTransactionCommand,
  DailySummary,
  MonthlySummary
} from './types';
import type { CategoryType, CategoryEntity } from '../ledger/types';
import { ValidationError, BusinessRuleViolationError } from '../shared/errors';

/**
 * 거래 비즈니스 규칙
 */
export const TransactionRules = {
  // 상수
  MIN_AMOUNT: 0,
  MAX_AMOUNT: 999999999999, // 9,999억
  MAX_TITLE_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  
  /**
   * 금액 검증
   */
  validateAmount(amount: number): void {
    if (amount <= this.MIN_AMOUNT) {
      throw new ValidationError('금액은 0보다 커야 합니다');
    }
    
    if (amount > this.MAX_AMOUNT) {
      throw new ValidationError(`금액은 ${this.MAX_AMOUNT.toLocaleString()}원을 초과할 수 없습니다`);
    }
    
    if (!Number.isFinite(amount)) {
      throw new ValidationError('올바른 금액을 입력해주세요');
    }
  },

  /**
   * 제목 검증
   */
  validateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new ValidationError('거래 내용은 필수입니다');
    }
    
    if (title.length > this.MAX_TITLE_LENGTH) {
      throw new ValidationError(`거래 내용은 ${this.MAX_TITLE_LENGTH}자를 초과할 수 없습니다`);
    }
  },

  /**
   * 설명 검증
   */
  validateDescription(description?: string): void {
    if (description && description.length > this.MAX_DESCRIPTION_LENGTH) {
      throw new ValidationError(`설명은 ${this.MAX_DESCRIPTION_LENGTH}자를 초과할 수 없습니다`);
    }
  },

  /**
   * 거래 날짜 검증
   */
  validateTransactionDate(date: Date): void {
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(now.getFullYear() + 1);
    
    if (date > oneYearFromNow) {
      throw new ValidationError('거래 날짜는 1년 이후로 설정할 수 없습니다');
    }
  },

  /**
   * 거래 타입과 카테고리 타입 일치 검증
   */
  validateCategoryType(transactionType: CategoryType, category: CategoryEntity): void {
    if (transactionType !== category.type) {
      throw new BusinessRuleViolationError(
        `거래 유형(${transactionType === 'income' ? '수입' : '지출'})과 ` +
        `카테고리 유형(${category.type === 'income' ? '수입' : '지출'})이 일치하지 않습니다`
      );
    }
  },

  /**
   * 거래 생성 (ID는 DB에서 자동 생성)
   */
  createTransaction(command: CreateTransactionCommand): Omit<TransactionEntity, 'id'> {
    this.validateAmount(command.amount);
    this.validateTitle(command.title);
    this.validateDescription(command.description);
    
    const transactionDate = command.transactionDate || new Date();
    this.validateTransactionDate(transactionDate);
    
    return {
      ledgerId: command.ledgerId,
      categoryId: command.categoryId,
      createdBy: command.createdBy,
      amount: Math.round(command.amount), // 소수점 제거
      type: command.type,
      title: command.title.trim(),
      description: command.description?.trim(),
      transactionDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    };
  },

  /**
   * 거래 수정
   */
  updateTransaction(transaction: TransactionEntity, command: UpdateTransactionCommand): TransactionEntity {
    if (transaction.isDeleted) {
      throw new BusinessRuleViolationError('삭제된 거래는 수정할 수 없습니다');
    }

    const updated = { ...transaction };
    
    if (command.amount !== undefined) {
      this.validateAmount(command.amount);
      updated.amount = Math.round(command.amount);
    }
    
    if (command.title !== undefined) {
      this.validateTitle(command.title);
      updated.title = command.title.trim();
    }
    
    if (command.description !== undefined) {
      this.validateDescription(command.description);
      updated.description = command.description?.trim();
    }
    
    if (command.transactionDate !== undefined) {
      this.validateTransactionDate(command.transactionDate);
      updated.transactionDate = command.transactionDate;
    }
    
    if (command.categoryId !== undefined) {
      updated.categoryId = command.categoryId;
    }
    
    if (command.type !== undefined) {
      updated.type = command.type;
    }
    
    updated.updatedAt = new Date();
    
    return updated;
  },

  /**
   * 거래 삭제
   */
  deleteTransaction(transaction: TransactionEntity): TransactionEntity {
    if (transaction.isDeleted) {
      throw new BusinessRuleViolationError('이미 삭제된 거래입니다');
    }
    
    return {
      ...transaction,
      isDeleted: true,
      updatedAt: new Date()
    };
  },

  /**
   * 일별 요약 계산
   */
  calculateDailySummary(transactions: TransactionEntity[]): DailySummary[] {
    const summaryMap = new Map<string, DailySummary>();
    
    transactions.forEach(transaction => {
      if (transaction.isDeleted) return;
      
      const dateKey = transaction.transactionDate.toISOString().split('T')[0];
      const existing = summaryMap.get(dateKey) || {
        date: transaction.transactionDate,
        income: 0,
        expense: 0,
        transactionCount: 0
      };
      
      if (transaction.type === 'income') {
        existing.income += transaction.amount;
      } else {
        existing.expense += transaction.amount;
      }
      
      existing.transactionCount += 1;
      summaryMap.set(dateKey, existing);
    });
    
    return Array.from(summaryMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  },

  /**
   * 월별 요약 계산
   */
  calculateMonthlySummary(year: number, month: number, dailySummaries: DailySummary[]): MonthlySummary {
    let totalIncome = 0;
    let totalExpense = 0;
    let transactionCount = 0;
    
    dailySummaries.forEach(summary => {
      totalIncome += summary.income;
      totalExpense += summary.expense;
      transactionCount += summary.transactionCount;
    });
    
    return {
      year,
      month,
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense,
      transactionCount,
      dailySummaries
    };
  }
};