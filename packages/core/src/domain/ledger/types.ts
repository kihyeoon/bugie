import type { EntityId, DomainDate, CurrencyCode } from '../shared/types';

/**
 * 가계부 도메인 타입
 */

// 멤버 권한
export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';

// 카테고리 타입
export type CategoryType = 'income' | 'expense';

/**
 * 가계부 엔티티
 */
export interface LedgerEntity {
  id: EntityId;
  name: string;
  description?: string;
  currency: CurrencyCode;
  createdBy: EntityId;
  createdAt: DomainDate;
  updatedAt: DomainDate;
  isDeleted: boolean;
}

/**
 * 가계부 멤버 엔티티
 */
export interface LedgerMemberEntity {
  userId: EntityId;
  ledgerId: EntityId;
  role: MemberRole;
  joinedAt: DomainDate;
  isActive: boolean;
}

/**
 * 카테고리 엔티티
 */
export interface CategoryEntity {
  id: EntityId;
  ledgerId: EntityId;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  sortOrder: number;
  isTemplate: boolean;
  templateId?: EntityId;
  isActive: boolean;
}

// 커맨드 (도메인 입력)
export interface CreateLedgerCommand {
  name: string;
  description?: string;
  currency?: CurrencyCode;
  createdBy: EntityId;
}

export interface UpdateLedgerCommand {
  id: EntityId;
  name?: string;
  description?: string;
  currency?: CurrencyCode;
}

export interface InviteMemberCommand {
  ledgerId: EntityId;
  invitedBy: EntityId;
  userEmail: string;
  role: MemberRole;
}

export interface CreateCategoryCommand {
  ledgerId: EntityId;
  name: string;
  type: CategoryType;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

// 리포지토리 인터페이스 (의존성 역전)
export interface LedgerRepository {
  findById(id: EntityId): Promise<LedgerEntity | null>;
  findByUserId(userId: EntityId): Promise<LedgerEntity[]>;
  findByUserIdWithMembers(userId: EntityId): Promise<Array<{
    ledger: LedgerEntity;
    members: LedgerMemberEntity[];
  }>>;
  findByIdWithMembers(id: EntityId): Promise<{
    ledger: LedgerEntity;
    members: Array<{
      member: LedgerMemberEntity;
      profile: { id: string; email: string; fullName?: string; avatarUrl?: string };
    }>;
  } | null>;
  save(ledger: LedgerEntity): Promise<EntityId>;
  delete(id: EntityId): Promise<void>;
}

export interface LedgerMemberRepository {
  findByLedgerAndUser(ledgerId: EntityId, userId: EntityId): Promise<LedgerMemberEntity | null>;
  findByLedger(ledgerId: EntityId): Promise<LedgerMemberEntity[]>;
  findUserByEmail(email: string): Promise<{ id: EntityId; email: string } | null>;
  save(member: LedgerMemberEntity): Promise<void>;
  delete(ledgerId: EntityId, userId: EntityId): Promise<void>;
}

export interface CategoryRepository {
  findByLedger(ledgerId: EntityId): Promise<CategoryEntity[]>;
  findById(id: EntityId): Promise<CategoryEntity | null>;
  save(category: CategoryEntity): Promise<EntityId>;
  delete(id: EntityId): Promise<void>;
  getTemplates(): Promise<CategoryEntity[]>;
  activateDefaultCategories(ledgerId: EntityId): Promise<void>;
}