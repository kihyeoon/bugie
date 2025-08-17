import type { EntityId, DomainDate } from '../shared/types';
import type { CategoryType } from '../ledger/types';

/**
 * 거래 도메인 타입
 */

/**
 * 거래 엔티티
 */
export interface TransactionEntity {
  id: EntityId;
  ledgerId: EntityId;
  categoryId: EntityId;
  createdBy: EntityId;
  amount: number;
  type: CategoryType;
  title: string;
  description?: string;
  transactionDate: DomainDate;
  createdAt: DomainDate;
  updatedAt: DomainDate;
  isDeleted: boolean;
}

// 커맨드 (도메인 입력)
export interface CreateTransactionCommand {
  ledgerId: EntityId;
  categoryId: EntityId;
  createdBy: EntityId;
  amount: number;
  type: CategoryType;
  title: string;
  description?: string;
  transactionDate?: DomainDate;
}

export interface UpdateTransactionCommand {
  id: EntityId;
  categoryId?: EntityId;
  amount?: number;
  type?: CategoryType;
  title?: string;
  description?: string;
  transactionDate?: DomainDate;
}

// 필터 및 집계
export interface TransactionFilter {
  ledgerId: EntityId;
  startDate?: DomainDate;
  endDate?: DomainDate;
  type?: CategoryType;
  categoryId?: EntityId;
  limit?: number;
  offset?: number;
}

export interface DailySummary {
  date: DomainDate;
  income: number;
  expense: number;
  transactionCount: number;
}

export interface MonthlySummary {
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  transactionCount: number;
  dailySummaries: DailySummary[];
}

export interface CategorySummary {
  categoryId: EntityId;
  categoryName: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

// 리포지토리 인터페이스
export interface TransactionRepository {
  findById(id: EntityId): Promise<TransactionEntity | null>;
  findByFilter(filter: TransactionFilter): Promise<{ data: TransactionEntity[]; total: number }>;
  create(transaction: Omit<TransactionEntity, 'id'>): Promise<EntityId>;
  update(transaction: TransactionEntity): Promise<void>;
  delete(id: EntityId): Promise<void>;
  
  // 카테고리 관련 메서드
  countByCategoryId(categoryId: EntityId): Promise<number>;
  updateCategoryBatch(fromCategoryId: EntityId, toCategoryId: EntityId): Promise<number>;
  
  // 집계 메서드
  getDailySummary(ledgerId: EntityId, date: DomainDate): Promise<DailySummary>;
  getMonthlySummary(ledgerId: EntityId, year: number, month: number): Promise<MonthlySummary>;
  getCategorySummary(ledgerId: EntityId, startDate: DomainDate, endDate: DomainDate): Promise<CategorySummary[]>;
}