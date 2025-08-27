import { BusinessRuleViolationError } from '../shared/errors';

/**
 * 프로필 관련 비즈니스 규칙
 */
export class ProfileRules {
  /**
   * 닉네임 유효성 검사
   */
  static validateNickname(nickname: string): void {
    if (!nickname || nickname.trim().length === 0) {
      throw new BusinessRuleViolationError('닉네임은 필수 입력 항목입니다.');
    }

    const trimmedNickname = nickname.trim();

    // 길이 검사
    if (trimmedNickname.length < 2) {
      throw new BusinessRuleViolationError('닉네임은 최소 2자 이상이어야 합니다.');
    }

    if (trimmedNickname.length > 20) {
      throw new BusinessRuleViolationError('닉네임은 최대 20자까지 가능합니다.');
    }

    // 허용 문자 검사 (한글, 영문, 숫자, 공백만 허용)
    const nicknameRegex = /^[가-힣a-zA-Z0-9\s]+$/;
    if (!nicknameRegex.test(trimmedNickname)) {
      throw new BusinessRuleViolationError(
        '닉네임은 한글, 영문, 숫자, 공백만 사용 가능합니다.'
      );
    }

    // 연속 공백 검사
    if (/\s{2,}/.test(trimmedNickname)) {
      throw new BusinessRuleViolationError('연속된 공백은 사용할 수 없습니다.');
    }
  }

  /**
   * 통화 코드 유효성 검사
   */
  static validateCurrency(currency: string): void {
    const validCurrencies = ['KRW', 'USD', 'EUR', 'JPY', 'CNY'];
    
    if (!validCurrencies.includes(currency)) {
      throw new BusinessRuleViolationError(
        `지원하지 않는 통화입니다. 지원 통화: ${validCurrencies.join(', ')}`
      );
    }
  }

  /**
   * 타임존 유효성 검사
   */
  static validateTimezone(timezone: string): void {
    const validTimezones = [
      'Asia/Seoul',
      'Asia/Tokyo',
      'America/New_York',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
    ];

    if (!validTimezones.includes(timezone)) {
      throw new BusinessRuleViolationError('지원하지 않는 시간대입니다.');
    }
  }

  /**
   * 프로필 이미지 URL 유효성 검사
   */
  static validateAvatarUrl(url: string | null): void {
    if (!url) return; // null은 허용

    // URL 형식 검사
    try {
      new URL(url);
    } catch {
      throw new BusinessRuleViolationError('올바른 URL 형식이 아닙니다.');
    }

    // 허용된 도메인 검사 (Supabase Storage, Google, 등)
    const allowedDomains = [
      'supabase.co',
      'supabase.io',
      'googleusercontent.com',
      'githubusercontent.com',
    ];

    const urlObj = new URL(url);
    const isAllowed = allowedDomains.some(domain => 
      urlObj.hostname.includes(domain)
    );

    if (!isAllowed) {
      throw new BusinessRuleViolationError('허용되지 않은 이미지 도메인입니다.');
    }
  }

  /**
   * 회원 탈퇴 가능 여부 확인
   * @param userId - 사용자 ID
   * @param ownedLedgersWithOtherMembers - 다른 멤버가 있는 소유 가계부 수
   * @param sharedLedgerCount - 공유받은 가계부 수
   */
  static canDeleteAccount(
    userId: string,
    ownedLedgersWithOtherMembers: number,
    sharedLedgerCount: number
  ): void {
    if (ownedLedgersWithOtherMembers > 0) {
      throw new BusinessRuleViolationError(
        `다른 멤버가 참여 중인 가계부(${ownedLedgersWithOtherMembers}개)를 먼저 삭제하거나 다른 사용자에게 양도해주세요.`
      );
    }

    if (sharedLedgerCount > 0) {
      // 경고만 제공, 탈퇴는 가능
      console.warn(
        `공유된 가계부(${sharedLedgerCount}개)에서 자동으로 나가게 됩니다.`
      );
    }
  }
}