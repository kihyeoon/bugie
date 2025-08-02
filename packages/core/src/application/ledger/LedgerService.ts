import type { MemberRole } from '../../domain/ledger/types';
import type {
  CreateLedgerInput,
  UpdateLedgerInput,
  InviteMemberInput,
} from './types';
import type {
  LedgerWithMembers,
  LedgerDetail,
  CategoryDetail,
} from '../../shared/types';
import type {
  LedgerRepository,
  LedgerMemberRepository,
  CategoryRepository,
} from '../../domain/ledger/types';
import type { AuthService } from '../../domain/auth/types';
import {
  LedgerRules,
  LedgerMemberRules,
  CategoryRules,
} from '../../domain/ledger/rules';
import { UnauthorizedError, NotFoundError } from '../../domain/shared/errors';

export class LedgerService {
  constructor(
    private ledgerRepo: LedgerRepository,
    private memberRepo: LedgerMemberRepository,
    private categoryRepo: CategoryRepository,
    private authService: AuthService
  ) {}

  /**
   * 사용자가 속한 모든 가계부 목록 조회
   */
  async getUserLedgers(): Promise<LedgerWithMembers[]> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    const ledgersWithMembers = await this.ledgerRepo.findByUserIdWithMembers(
      currentUser.id
    );

    // Transform to UI format
    return ledgersWithMembers.map(({ ledger, members }) => ({
      id: ledger.id,
      name: ledger.name,
      description: ledger.description ?? null,
      currency: ledger.currency,
      created_by: ledger.createdBy,
      created_at: ledger.createdAt.toISOString(),
      updated_at: ledger.updatedAt.toISOString(),
      deleted_at: null,
      ledger_members: members
        .filter((m) => m.userId === currentUser.id)
        .map((m) => ({
          role: m.role,
          user_id: m.userId,
        })),
    }));
  }

  /**
   * 특정 가계부 상세 정보 조회
   */
  async getLedger(ledgerId: string): Promise<LedgerDetail> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 권한 확인
    const memberEntity = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      currentUser.id
    );
    if (!memberEntity || !memberEntity.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    const result = await this.ledgerRepo.findByIdWithMembers(ledgerId);
    if (!result) {
      throw new NotFoundError('가계부를 찾을 수 없습니다.');
    }

    // Transform to UI format
    return {
      id: result.ledger.id,
      name: result.ledger.name,
      description: result.ledger.description ?? null,
      currency: result.ledger.currency,
      created_by: result.ledger.createdBy,
      created_at: result.ledger.createdAt.toISOString(),
      updated_at: result.ledger.updatedAt.toISOString(),
      deleted_at: null,
      ledger_members: result.members.map(({ member, profile }) => ({
        id: `${member.ledgerId}-${member.userId}`, // Composite ID
        ledger_id: member.ledgerId,
        user_id: member.userId,
        role: member.role,
        joined_at: member.joinedAt.toISOString(),
        deleted_at: member.isActive ? null : new Date().toISOString(),
        profiles: {
          id: profile.id,
          email: profile.email,
          full_name: profile.fullName ?? null,
          avatar_url: profile.avatarUrl ?? null,
        },
      })),
    };
  }

  /**
   * 새 가계부 생성
   */
  async createLedger(
    input: CreateLedgerInput
  ): Promise<{ id: string; name: string; currency: string }> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 도메인 규칙으로 가계부 생성
    const ledgerEntity = LedgerRules.createLedger({
      name: input.name,
      description: input.description,
      currency: (input.currency || 'KRW') as any, // CurrencyCode type from domain
      createdBy: currentUser.id,
    });

    // 저장
    const ledgerId = await this.ledgerRepo.save(ledgerEntity);

    // 생성자를 owner로 추가
    const memberEntity = LedgerMemberRules.createMember(
      ledgerId,
      currentUser.id,
      'owner'
    );
    await this.memberRepo.save(memberEntity);

    // 기본 카테고리 활성화
    await this.categoryRepo.activateDefaultCategories(ledgerId);

    return {
      id: ledgerId,
      name: ledgerEntity.name,
      currency: ledgerEntity.currency,
    };
  }

  /**
   * 가계부 정보 수정
   */
  async updateLedger(
    ledgerId: string,
    input: UpdateLedgerInput
  ): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 권한 확인
    const memberEntity = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      currentUser.id
    );
    if (!memberEntity || !memberEntity.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    LedgerMemberRules.canEditLedger(memberEntity.role);

    // 기존 가계부 조회
    const ledgerEntity = await this.ledgerRepo.findById(ledgerId);
    if (!ledgerEntity) {
      throw new NotFoundError('가계부를 찾을 수 없습니다.');
    }

    // 업데이트
    const updatedLedger = LedgerRules.updateLedger(ledgerEntity, {
      id: ledgerId,
      name: input.name,
      description: input.description,
      currency: input.currency as any,
    });

    await this.ledgerRepo.save(updatedLedger);
  }

  /**
   * 가계부 삭제 (Soft Delete)
   */
  async deleteLedger(ledgerId: string): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 권한 확인
    const memberEntity = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      currentUser.id
    );
    if (!memberEntity || !memberEntity.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    LedgerMemberRules.canDeleteLedger(memberEntity.role);

    await this.ledgerRepo.delete(ledgerId);
  }

  /**
   * 가계부 멤버 초대
   */
  async inviteMember(input: InviteMemberInput): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 권한 확인
    const memberEntity = await this.memberRepo.findByLedgerAndUser(
      input.ledgerId,
      currentUser.id
    );
    if (!memberEntity || !memberEntity.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    LedgerMemberRules.canInviteMember(memberEntity.role);

    // 초대할 사용자 찾기
    const targetUser = await this.memberRepo.findUserByEmail(input.userEmail);
    if (!targetUser) {
      throw new NotFoundError('사용자를 찾을 수 없습니다.');
    }

    // 이미 멤버인지 확인
    const existingMember = await this.memberRepo.findByLedgerAndUser(
      input.ledgerId,
      targetUser.id
    );
    if (existingMember && existingMember.isActive) {
      throw new Error('이미 가계부 멤버입니다.');
    }

    // 멤버 추가
    const newMember = LedgerMemberRules.createMember(
      input.ledgerId,
      targetUser.id,
      input.role || 'member'
    );

    await this.memberRepo.save(newMember);
  }

  /**
   * 멤버 권한 변경
   */
  async updateMemberRole(
    ledgerId: string,
    userId: string,
    role: MemberRole
  ): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 현재 사용자 권한 확인
    const currentMember = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      currentUser.id
    );
    if (!currentMember || !currentMember.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    // 대상 멤버 확인
    const targetMember = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      userId
    );
    if (!targetMember || !targetMember.isActive) {
      throw new NotFoundError('멤버를 찾을 수 없습니다.');
    }

    // 권한 변경 가능 여부 확인
    if (
      !LedgerMemberRules.canChangeRole(
        currentMember.role,
        targetMember.role,
        role
      )
    ) {
      throw new UnauthorizedError('권한을 변경할 수 없습니다.');
    }

    // 권한 변경
    const updatedMember: typeof targetMember = {
      ...targetMember,
      role,
    };
    await this.memberRepo.save(updatedMember);
  }

  /**
   * 멤버 제거
   */
  async removeMember(ledgerId: string, userId: string): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 현재 사용자 권한 확인
    const currentMember = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      currentUser.id
    );
    if (!currentMember || !currentMember.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    // 대상 멤버 확인
    const targetMember = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      userId
    );
    if (!targetMember || !targetMember.isActive) {
      throw new NotFoundError('멤버를 찾을 수 없습니다.');
    }

    // 제거 가능 여부 확인
    if (!LedgerMemberRules.canManageMembers(currentMember.role)) {
      throw new UnauthorizedError('멤버를 제거할 권한이 없습니다.');
    }

    // owner는 제거할 수 없음
    if (targetMember.role === 'owner') {
      throw new Error('소유자는 제거할 수 없습니다.');
    }

    // 멤버 제거
    await this.memberRepo.delete(ledgerId, userId);
  }

  /**
   * 가계부 나가기
   */
  async leaveLedger(ledgerId: string): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    // 멤버인지 확인
    const member = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new NotFoundError('가계부 멤버가 아닙니다.');
    }

    // owner는 나갈 수 없음
    if (member.role === 'owner') {
      throw new Error('소유자는 가계부를 나갈 수 없습니다.');
    }

    await this.memberRepo.delete(ledgerId, currentUser.id);
  }

  /**
   * 가계부의 카테고리 목록 조회
   */
  async getCategories(ledgerId: string): Promise<CategoryDetail[]> {
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

    const categories = await this.categoryRepo.findByLedger(ledgerId);

    // Transform to UI format
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

    LedgerMemberRules.canEditLedger(member.role);

    // 카테고리 생성
    const category = CategoryRules.createCustomCategory({
      ledgerId,
      name,
      type,
      color,
      icon,
      sortOrder: 999,
    });

    const categoryId = await this.categoryRepo.save(category);
    return categoryId;
  }
}
