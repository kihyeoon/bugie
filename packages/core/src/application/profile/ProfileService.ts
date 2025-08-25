import type { ProfileRepository } from '../../domain/profile/types';
import type { LedgerRepository } from '../../domain/ledger/types';
import { ProfileRules } from '../../domain/profile/rules';
import {
  NotFoundError,
  UnauthorizedError,
  BusinessRuleViolationError,
} from '../../domain/shared/errors';
import type {
  UpdateProfileInput,
  DeleteAccountInput,
  ProfileDetail,
} from './types';
import { AuthService } from '../../domain/auth/types';

/**
 * 프로필 관련 비즈니스 로직을 처리하는 서비스
 */
export class ProfileService {
  constructor(
    private profileRepo: ProfileRepository,
    private ledgerRepo: LedgerRepository,
    private authService: AuthService
  ) {}

  /**
   * 현재 사용자의 프로필 조회
   */
  async getCurrentProfile(): Promise<ProfileDetail> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) {
      throw new UnauthorizedError('인증이 필요합니다.');
    }

    const profile = await this.profileRepo.findById(currentUser.id);
    if (!profile) {
      throw new NotFoundError('프로필을 찾을 수 없습니다.');
    }

    // 소유/공유 가계부 수 조회
    const ledgers = await this.ledgerRepo.findByUserIdWithMembers(
      currentUser.id
    );
    const ownedLedgerCount = ledgers.filter(
      ({ ledger }) => ledger.createdBy === currentUser.id
    ).length;
    const sharedLedgerCount = ledgers.length - ownedLedgerCount;

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      currency: profile.currency,
      timezone: profile.timezone,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      ownedLedgerCount,
      sharedLedgerCount,
    };
  }

  /**
   * 프로필 업데이트
   */
  async updateProfile(input: UpdateProfileInput): Promise<ProfileDetail> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) {
      throw new UnauthorizedError('인증이 필요합니다.');
    }

    // 유효성 검사
    if (input.fullName !== undefined) {
      ProfileRules.validateNickname(input.fullName);
    }

    if (input.currency !== undefined) {
      ProfileRules.validateCurrency(input.currency);
    }

    if (input.timezone !== undefined) {
      ProfileRules.validateTimezone(input.timezone);
    }

    if (input.avatarUrl !== undefined) {
      ProfileRules.validateAvatarUrl(input.avatarUrl);
    }

    // 프로필 업데이트
    await this.profileRepo.update(currentUser.id, {
      fullName: input.fullName,
      avatarUrl: input.avatarUrl,
      currency: input.currency,
      timezone: input.timezone,
    });

    // 업데이트된 프로필 상세 정보 반환
    return this.getCurrentProfile();
  }

  /**
   * 회원 탈퇴
   */
  async deleteAccount(input: DeleteAccountInput): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) {
      throw new UnauthorizedError('인증이 필요합니다.');
    }

    // 본인 확인
    if (currentUser.id !== input.userId) {
      throw new UnauthorizedError('본인의 계정만 탈퇴할 수 있습니다.');
    }

    // 확인 텍스트 검증 (선택사항)
    if (input.confirmText && input.confirmText !== '정말 탈퇴하시겠습니까?') {
      throw new BusinessRuleViolationError('확인 문구가 일치하지 않습니다.');
    }

    // 소유한 가계부 확인
    const ledgers = await this.ledgerRepo.findByUserIdWithMembers(
      currentUser.id
    );
    const ownedLedgers = ledgers.filter(
      ({ ledger }) => ledger.createdBy === currentUser.id
    );
    const sharedLedgers = ledgers.filter(
      ({ ledger }) => ledger.createdBy !== currentUser.id
    );

    // 탈퇴 가능 여부 확인
    ProfileRules.canDeleteAccount(
      currentUser.id,
      ownedLedgers.length,
      sharedLedgers.length
    );

    // 관련 데이터 정리
    await this.profileRepo.deleteUserData(currentUser.id);

    // 계정 삭제
    await this.authService.deleteAccount();
  }

  /**
   * 닉네임 중복 확인 (선택사항)
   */
  async checkNicknameAvailability(nickname: string): Promise<boolean> {
    // 유효성 검사
    ProfileRules.validateNickname(nickname);

    // 실제 중복 확인 로직은 필요에 따라 구현
    // 현재는 항상 사용 가능으로 반환
    return true;
  }
}
