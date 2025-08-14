import type { 
  Ledger as DbLedger, 
  LedgerMember as DbLedgerMember,
  MemberRole as DbMemberRole 
} from '@repo/types';
import type { 
  LedgerEntity,
  LedgerMemberEntity,
  MemberRole
} from '../../../domain/ledger/types';
import type { CurrencyCode } from '../../../domain/shared/types';

/**
 * 가계부 DB ↔ Domain 매핑
 */
export class LedgerMapper {
  /**
   * DB → Domain 변환
   */
  static toDomain(db: DbLedger): LedgerEntity {
    return {
      id: db.id,
      name: db.name,
      description: db.description ?? undefined,
      currency: (db.currency || 'KRW') as CurrencyCode,
      createdBy: db.created_by,
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at),
      isDeleted: db.deleted_at !== null
    };
  }

  /**
   * Domain → DB 변환 (업데이트용)
   */
  static toDb(domain: LedgerEntity): Partial<DbLedger> {
    return {
      id: domain.id,
      name: domain.name,
      description: domain.description ?? undefined,
      currency: domain.currency,
      created_by: domain.createdBy,
      updated_at: new Date().toISOString(),
      // deleted_at은 soft delete 시에만 설정
      ...(domain.isDeleted && { deleted_at: new Date().toISOString() })
    };
  }

  /**
   * Domain → DB 변환 (생성용, ID 제외)
   */
  static toDbForCreate(domain: Omit<LedgerEntity, 'id'>): Partial<DbLedger> {
    return {
      name: domain.name,
      description: domain.description ?? undefined,
      currency: domain.currency,
      created_by: domain.createdBy,
      created_at: domain.createdAt.toISOString(),
      updated_at: domain.updatedAt.toISOString()
    };
  }
}

/**
 * 가계부 멤버 DB ↔ Domain 매핑
 */
export class LedgerMemberMapper {
  /**
   * DB → Domain 변환
   */
  static toDomain(db: DbLedgerMember): LedgerMemberEntity {
    return {
      userId: db.user_id,
      ledgerId: db.ledger_id,
      role: this.mapRole(db.role),
      joinedAt: new Date(db.joined_at),
      isActive: db.deleted_at === null
    };
  }

  /**
   * Domain → DB 변환
   */
  static toDb(domain: LedgerMemberEntity): Partial<DbLedgerMember> {
    return {
      user_id: domain.userId,
      ledger_id: domain.ledgerId,
      role: domain.role as DbMemberRole,
      joined_at: domain.joinedAt.toISOString(),
      ...(domain.isActive === false && { deleted_at: new Date().toISOString() })
    };
  }

  /**
   * DB role → Domain role 매핑
   * 실제로는 같은 값이지만 타입이 다름
   */
  private static mapRole(dbRole: DbMemberRole): MemberRole {
    // Type assertion으로 변환
    return dbRole as unknown as MemberRole;
  }
}