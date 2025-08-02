import type { 
  Transaction as DbTransaction,
  CategoryType as DbCategoryType 
} from '@repo/types';
import type { 
  TransactionEntity 
} from '../../../domain/transaction/types';
import type { CategoryType } from '../../../domain/ledger/types';

/**
 * 거래 DB ↔ Domain 매핑
 */
export class TransactionMapper {
  /**
   * DB → Domain 변환
   */
  static toDomain(db: DbTransaction): TransactionEntity {
    return {
      id: db.id,
      ledgerId: db.ledger_id,
      categoryId: db.category_id,
      createdBy: db.created_by,
      amount: db.amount,
      type: db.type as CategoryType,
      title: db.title,
      description: db.description ?? undefined,
      transactionDate: new Date(db.transaction_date),
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at),
      isDeleted: db.deleted_at !== null
    };
  }

  /**
   * Domain → DB 변환
   */
  static toDb(domain: TransactionEntity): Partial<DbTransaction> {
    return {
      id: domain.id,
      ledger_id: domain.ledgerId,
      category_id: domain.categoryId,
      created_by: domain.createdBy,
      amount: domain.amount,
      type: domain.type as DbCategoryType,
      title: domain.title,
      description: domain.description ?? undefined,
      transaction_date: domain.transactionDate.toISOString().split('T')[0], // YYYY-MM-DD format
      created_at: domain.createdAt.toISOString(),
      updated_at: domain.updatedAt.toISOString(),
      ...(domain.isDeleted && { deleted_at: new Date().toISOString() })
    };
  }
}