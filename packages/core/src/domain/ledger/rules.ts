import type {
  LedgerEntity,
  LedgerMemberEntity,
  CreateLedgerCommand,
  UpdateLedgerCommand,
  MemberRole,
  CategoryEntity,
  CreateCategoryCommand,
} from './types';
import type { EntityId } from '../shared/types';
import { ValidationError, BusinessRuleViolationError } from '../shared/errors';
import {
  LEDGER_MAX_NAME_LENGTH,
  LEDGER_MIN_NAME_LENGTH,
  DEFAULT_CURRENCY,
  CATEGORY_MAX_NAME_LENGTH,
  CATEGORY_DEFAULT_COLOR,
  CATEGORY_DEFAULT_ICON,
  CATEGORY_DEFAULT_SORT_ORDER,
} from '../shared/constants';

/**
 * 가계부 비즈니스 규칙
 */
export const LedgerRules = {
  /**
   * 가계부 이름 검증
   */
  validateName(name: string): void {
    if (!name || name.trim().length < LEDGER_MIN_NAME_LENGTH) {
      throw new ValidationError('가계부 이름은 필수입니다');
    }

    if (name.length > LEDGER_MAX_NAME_LENGTH) {
      throw new ValidationError(
        `가계부 이름은 ${LEDGER_MAX_NAME_LENGTH}자를 초과할 수 없습니다`
      );
    }
  },

  /**
   * 가계부 생성 (ID는 DB에서 자동 생성)
   */
  createLedger(command: CreateLedgerCommand): Omit<LedgerEntity, 'id'> {
    this.validateName(command.name);

    return {
      name: command.name.trim(),
      description: command.description?.trim(),
      currency: command.currency || DEFAULT_CURRENCY,
      createdBy: command.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
    };
  },

  /**
   * 가계부 수정
   */
  updateLedger(
    ledger: LedgerEntity,
    command: UpdateLedgerCommand
  ): LedgerEntity {
    if (ledger.isDeleted) {
      throw new BusinessRuleViolationError(
        '삭제된 가계부는 수정할 수 없습니다'
      );
    }

    const updated = { ...ledger };

    if (command.name !== undefined) {
      this.validateName(command.name);
      updated.name = command.name.trim();
    }

    if (command.description !== undefined) {
      updated.description = command.description.trim();
    }

    if (command.currency !== undefined) {
      updated.currency = command.currency;
    }

    updated.updatedAt = new Date();

    return updated;
  },

  /**
   * 가계부 삭제 가능 여부 확인
   */
  canDelete(ledger: LedgerEntity, userId: EntityId): boolean {
    return ledger.createdBy === userId && !ledger.isDeleted;
  },

  /**
   * 가계부 소프트 삭제
   */
  deleteLedger(ledger: LedgerEntity): LedgerEntity {
    if (ledger.isDeleted) {
      throw new BusinessRuleViolationError('이미 삭제된 가계부입니다');
    }

    return {
      ...ledger,
      isDeleted: true,
      updatedAt: new Date(),
    };
  },
};

/**
 * 가계부 멤버 비즈니스 규칙
 */
export const LedgerMemberRules = {
  /**
   * 멤버 권한 확인
   */
  canInviteMember(memberRole: MemberRole): boolean {
    return memberRole === 'owner' || memberRole === 'admin';
  },

  canEditLedger(memberRole: MemberRole): boolean {
    return (
      memberRole === 'owner' ||
      memberRole === 'admin' ||
      memberRole === 'member'
    );
  },

  canDeleteLedger(memberRole: MemberRole): boolean {
    return memberRole === 'owner';
  },

  canViewLedger(_memberRole: MemberRole): boolean {
    return true; // 모든 멤버가 조회 가능
  },

  canManageMembers(memberRole: MemberRole): boolean {
    return memberRole === 'owner' || memberRole === 'admin';
  },

  /**
   * 멤버 생성
   */
  createMember(
    ledgerId: EntityId,
    userId: EntityId,
    role: MemberRole
  ): LedgerMemberEntity {
    return {
      ledgerId,
      userId,
      role,
      joinedAt: new Date(),
      isActive: true,
    };
  },

  /**
   * 소유자 멤버 생성
   */
  createOwner(ledgerId: EntityId, userId: EntityId): LedgerMemberEntity {
    return this.createMember(ledgerId, userId, 'owner');
  },

  /**
   * 권한 변경 가능 여부
   */
  canChangeRole(
    currentUserRole: MemberRole,
    targetUserRole: MemberRole,
    newRole: MemberRole
  ): boolean {
    // 소유자만 다른 사람을 소유자로 만들 수 있음
    if (newRole === 'owner' && currentUserRole !== 'owner') {
      return false;
    }

    // 소유자는 변경할 수 없음 (양도는 별도 프로세스)
    if (targetUserRole === 'owner') {
      return false;
    }

    // 관리자는 일반 멤버의 권한만 변경 가능
    if (currentUserRole === 'admin' && targetUserRole !== 'member') {
      return false;
    }

    return this.canManageMembers(currentUserRole);
  },
};

/**
 * 카테고리 비즈니스 규칙
 */
export const CategoryRules = {
  /**
   * 카테고리 이름 검증
   */
  validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('카테고리 이름은 필수입니다');
    }

    if (name.length > CATEGORY_MAX_NAME_LENGTH) {
      throw new ValidationError(
        `카테고리 이름은 ${CATEGORY_MAX_NAME_LENGTH}자를 초과할 수 없습니다`
      );
    }
  },

  /**
   * 커스텀 카테고리 생성 (ID는 DB에서 자동 생성)
   */
  createCustomCategory(
    command: CreateCategoryCommand
  ): Omit<CategoryEntity, 'id'> {
    this.validateName(command.name);

    return {
      ledgerId: command.ledgerId,
      name: command.name.trim(),
      type: command.type,
      color: command.color || CATEGORY_DEFAULT_COLOR,
      icon: command.icon || CATEGORY_DEFAULT_ICON,
      sortOrder: command.sortOrder ?? CATEGORY_DEFAULT_SORT_ORDER,
      isTemplate: false,
      isActive: true,
    };
  },

  /**
   * 템플릿 기반 카테고리 생성 (ID는 DB에서 자동 생성)
   */
  createFromTemplate(
    ledgerId: EntityId,
    template: CategoryEntity
  ): Omit<CategoryEntity, 'id'> {
    return {
      ledgerId,
      name: template.name,
      type: template.type,
      color: template.color,
      icon: template.icon,
      sortOrder: template.sortOrder,
      isTemplate: true,
      templateId: template.id,
      isActive: true,
    };
  },
};
