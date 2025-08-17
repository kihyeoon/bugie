import type {
  LedgerEntity,
  LedgerRepository,
  LedgerMemberEntity,
  LedgerMemberRepository,
  CategoryRepository,
  MemberRole,
} from '../../domain/ledger/types';
import type {
  CategoryDetail,
  LedgerDetail,
  LedgerWithMembers,
} from '../../shared/types';
import { toCurrencyCode } from '../../domain/shared/utils';
import {
  LedgerRules,
  LedgerMemberRules,
  CategoryRules,
} from '../../domain/ledger/rules';
import type { SupabaseAuthService } from '../../infrastructure/supabase/auth/SupabaseAuthService';
import type {
  CreateLedgerInput,
  UpdateLedgerInput,
  InviteMemberInput,
  DeleteCategoryResult,
} from './types';
import type { TransactionRepository } from '../../domain/transaction/types';
import {
  NotFoundError,
  UnauthorizedError,
  BusinessRuleViolationError,
} from '../../domain/shared/errors';

/**
 * 가계부 관련 비즈니스 로직을 처리하는 서비스
 *
 * 설계 원칙:
 * - RLS(Row Level Security)가 기본 권한 체크 담당
 * - 서비스 레이어는 비즈니스 규칙과 사용자 경험에 집중
 * - 중복 권한 체크 최소화
 */
export class LedgerService {
  constructor(
    private ledgerRepo: LedgerRepository,
    private memberRepo: LedgerMemberRepository,
    private categoryRepo: CategoryRepository,
    private authService: SupabaseAuthService,
    private transactionRepo?: TransactionRepository
  ) {}

  /**
   * 현재 사용자의 가계부 목록 조회
   */
  async getUserLedgers(): Promise<LedgerWithMembers[]> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    const ledgersWithMembers = await this.ledgerRepo.findByUserIdWithMembers(
      currentUser.id
    );

    return ledgersWithMembers.map(({ ledger, members }) => ({
      id: ledger.id,
      name: ledger.name,
      description: ledger.description || null,
      currency: ledger.currency,
      created_by: ledger.createdBy,
      created_at: ledger.createdAt.toISOString(),
      updated_at: ledger.updatedAt.toISOString(),
      deleted_at: ledger.isDeleted ? new Date().toISOString() : null,
      ledger_members: members.map((m) => ({
        role: m.role,
        user_id: m.userId,
      })),
    }));
  }

  /**
   * 특정 가계부 상세 정보 조회
   */
  async getLedgerDetail(ledgerId: string): Promise<LedgerDetail | null> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    const result = await this.ledgerRepo.findByIdWithMembers(ledgerId);
    if (!result) return null;

    const { ledger, members } = result;

    return {
      id: ledger.id,
      name: ledger.name,
      description: ledger.description || null,
      currency: ledger.currency,
      created_by: ledger.createdBy,
      created_at: ledger.createdAt.toISOString(),
      updated_at: ledger.updatedAt.toISOString(),
      deleted_at: ledger.isDeleted ? new Date().toISOString() : null,
      ledger_members: members.map((m) => ({
        id: m.member.userId,
        ledger_id: m.member.ledgerId,
        user_id: m.member.userId,
        role: m.member.role,
        joined_at: m.member.joinedAt.toISOString(),
        deleted_at: m.member.isActive ? null : new Date().toISOString(),
        profiles: {
          id: m.profile.id,
          email: m.profile.email,
          full_name: m.profile.fullName || null,
          avatar_url: m.profile.avatarUrl || null,
        },
      })),
    };
  }

  /**
   * 새 가계부 생성
   */
  async createLedger(input: CreateLedgerInput): Promise<string> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    LedgerRules.validateName(input.name);

    const ledger = LedgerRules.createLedger({
      name: input.name,
      description: input.description,
      currency: toCurrencyCode(input.currency),
      createdBy: currentUser.id,
    });

    const ledgerId = await this.ledgerRepo.create(ledger);

    const ownerMember = LedgerMemberRules.createMember(
      ledgerId,
      currentUser.id,
      'owner'
    );
    await this.memberRepo.save(ownerMember);
    await this.categoryRepo.activateDefaultCategories(ledgerId);

    return ledgerId;
  }

  /**
   * 가계부 정보 수정
   */
  async updateLedger(input: UpdateLedgerInput): Promise<void> {
    const ledger = await this.ledgerRepo.findById(input.ledgerId);
    if (!ledger) {
      throw new NotFoundError('가계부를 찾을 수 없습니다.');
    }

    if (input.name) {
      LedgerRules.validateName(input.name);
    }

    const updatedLedger: LedgerEntity = {
      ...ledger,
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.currency && { currency: toCurrencyCode(input.currency) }),
    };
    await this.ledgerRepo.update(updatedLedger);
  }

  /**
   * 가계부 삭제
   */
  async deleteLedger(ledgerId: string): Promise<void> {
    await this.ledgerRepo.delete(ledgerId);
  }

  /**
   * 멤버 초대
   */
  async inviteMember(input: InviteMemberInput): Promise<void> {
    const targetUser = await this.memberRepo.findUserByEmail(input.userEmail);
    if (!targetUser) {
      throw new NotFoundError('사용자를 찾을 수 없습니다.');
    }

    const existingMember = await this.memberRepo.findByLedgerAndUser(
      input.ledgerId,
      targetUser.id
    );
    if (existingMember && existingMember.isActive) {
      throw new BusinessRuleViolationError('이미 가계부 멤버입니다.');
    }
    const newMember = LedgerMemberRules.createMember(
      input.ledgerId,
      targetUser.id,
      input.role || 'member'
    );

    await this.memberRepo.save(newMember);
  }

  /**
   * 멤버 권한 변경
   * 복잡한 권한 로직이므로 서비스에서 체크
   */
  async updateMemberRole(
    ledgerId: string,
    userId: string,
    role: MemberRole
  ): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    const [currentMember, targetMember] = await Promise.all([
      this.memberRepo.findByLedgerAndUser(ledgerId, currentUser.id),
      this.memberRepo.findByLedgerAndUser(ledgerId, userId),
    ]);

    if (!currentMember || !targetMember) {
      throw new NotFoundError('멤버를 찾을 수 없습니다.');
    }

    if (
      !LedgerMemberRules.canChangeRole(
        currentMember.role,
        targetMember.role,
        role
      )
    ) {
      throw new UnauthorizedError('권한을 변경할 수 없습니다.');
    }

    const updatedMember: LedgerMemberEntity = {
      ...targetMember,
      role,
    };
    await this.memberRepo.save(updatedMember);
  }

  /**
   * 멤버 제거
   */
  async removeMember(ledgerId: string, userId: string): Promise<void> {
    const targetMember = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      userId
    );
    if (!targetMember || !targetMember.isActive) {
      throw new NotFoundError('멤버를 찾을 수 없습니다.');
    }

    if (targetMember.role === 'owner') {
      throw new BusinessRuleViolationError('소유자는 제거할 수 없습니다.');
    }
    await this.memberRepo.delete(ledgerId, userId);
  }

  /**
   * 가계부 나가기
   */
  async leaveLedger(ledgerId: string): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    const member = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new NotFoundError('가계부 멤버가 아닙니다.');
    }

    if (member.role === 'owner') {
      throw new BusinessRuleViolationError(
        '소유자는 가계부를 나갈 수 없습니다.'
      );
    }

    await this.memberRepo.delete(ledgerId, currentUser.id);
  }

  /**
   * 카테고리 목록 조회
   */
  async getCategories(ledgerId: string): Promise<CategoryDetail[]> {
    const categories = await this.categoryRepo.findByLedger(ledgerId);

    return categories.map((cat) => ({
      id: cat.id,
      ledger_id: cat.ledgerId,
      template_id: cat.templateId ?? null,
      name: cat.name,
      type: cat.type,
      color: cat.color,
      icon: cat.icon,
      sort_order: cat.sortOrder,
      is_active: cat.isActive,
      source_type: cat.isTemplate ? ('template' as const) : ('custom' as const),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }));
  }

  /**
   * 커스텀 카테고리 추가
   */
  async addCustomCategory(
    ledgerId: string,
    name: string,
    type: 'income' | 'expense',
    color?: string,
    icon?: string
  ): Promise<string> {
    const category = CategoryRules.createCustomCategory({
      ledgerId,
      name,
      type,
      color,
      icon,
      sortOrder: 999,
    });
    const categoryId = await this.categoryRepo.create(category);
    return categoryId;
  }

  /**
   * 카테고리 수정
   */
  async updateCategory(
    categoryId: string,
    updates: {
      name?: string;
      color?: string;
      icon?: string;
    }
  ): Promise<void> {
    const category = await this.categoryRepo.findById(categoryId);
    if (!category) {
      throw new NotFoundError('카테고리를 찾을 수 없습니다.');
    }

    if (category.templateId) {
      throw new BusinessRuleViolationError(
        '기본 카테고리는 수정할 수 없습니다.'
      );
    }
    try {
      await this.categoryRepo.updatePartial(categoryId, updates);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === '42501') {
        throw new UnauthorizedError('카테고리를 수정할 권한이 없습니다.');
      }
      throw error;
    }
  }

  /**
   * 카테고리 삭제 (소프트 삭제)
   * 연결된 거래가 있으면 기본 카테고리로 이전
   */
  async deleteCategory(categoryId: string): Promise<DeleteCategoryResult> {
    const category = await this.categoryRepo.findById(categoryId);
    if (!category) {
      throw new NotFoundError('카테고리를 찾을 수 없습니다.');
    }

    if (category.templateId) {
      throw new BusinessRuleViolationError(
        '기본 카테고리는 삭제할 수 없습니다.'
      );
    }

    let movedTransactions = 0;
    let fallbackCategoryName: string | undefined;

    // 트랜잭션 리포지토리가 있으면 연결된 거래 처리
    if (this.transactionRepo) {
      // 연결된 거래 수 확인
      const transactionCount =
        await this.transactionRepo.countByCategoryId(categoryId);

      if (transactionCount > 0) {
        // 기본 카테고리 찾기
        const fallbackCategory = await this.categoryRepo.findFallbackCategory(
          category.ledgerId,
          category.type
        );

        if (!fallbackCategory) {
          // 기본 카테고리가 없으면 활성화
          await this.categoryRepo.activateDefaultCategories(category.ledgerId);

          // 다시 찾기
          const retryFallback = await this.categoryRepo.findFallbackCategory(
            category.ledgerId,
            category.type
          );

          if (!retryFallback) {
            throw new BusinessRuleViolationError(
              '기본 카테고리를 찾을 수 없습니다. 시스템 관리자에게 문의하세요.'
            );
          }

          // 모든 거래를 기본 카테고리로 이전
          movedTransactions = await this.transactionRepo.updateCategoryBatch(
            categoryId,
            retryFallback.id
          );
          fallbackCategoryName = retryFallback.name;
        } else {
          // 모든 거래를 기본 카테고리로 이전
          movedTransactions = await this.transactionRepo.updateCategoryBatch(
            categoryId,
            fallbackCategory.id
          );
          fallbackCategoryName = fallbackCategory.name;
        }
      }
    }

    try {
      await this.categoryRepo.softDelete(categoryId);

      return {
        deleted: true,
        movedTransactions,
        fallbackCategoryName,
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === '42501') {
        throw new UnauthorizedError('카테고리를 삭제할 권한이 없습니다.');
      }
      throw error;
    }
  }
}
