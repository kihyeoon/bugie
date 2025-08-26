/**
 * 프로필 관련 상수
 */

/**
 * 회원 탈퇴 관련 상수
 */
export const DELETE_ACCOUNT = {
  // 확인 문구 (사용자 의사 표현 방식)
  CONFIRM_TEXT: '탈퇴하겠습니다.',

  // 에러 메시지
  ERRORS: {
    CONFIRM_TEXT_MISMATCH: '확인 문구가 일치하지 않습니다.',
    HAS_OWNED_LEDGERS: '소유한 가계부가 있어 탈퇴할 수 없습니다.',
    UNAUTHORIZED: '본인의 계정만 탈퇴할 수 있습니다.',
    GENERIC: '회원 탈퇴 중 오류가 발생했습니다.',
  },

  // 안내 메시지
  MESSAGES: {
    GRACE_PERIOD: '탈퇴 후 30일 이내 재로그인 시 자동 복구됩니다',
    PERMANENT_DELETE: '30일이 지나면 모든 데이터가 영구 삭제됩니다',
    LEAVE_LEDGERS: '참여 중인 가계부에서 자동으로 나가게 됩니다',
    OWNED_LEDGERS_WARNING: (count: number) =>
      `소유한 가계부가 ${count}개 있습니다.`,
    TRANSFER_REQUIRED:
      '탈퇴하려면 먼저 가계부를 삭제하거나 다른 사용자에게 양도해주세요.',
  },

  // UI 텍스트
  UI: {
    TITLE: '회원 탈퇴',
    WARNING_TITLE: '회원 탈퇴 시 다음 사항을 확인해주세요:',
    FINAL_CONFIRM_TITLE: '최종 확인',
    FINAL_CONFIRM_QUESTION: '정말로 탈퇴를 진행하시겠습니까?',
    INPUT_INSTRUCTION: '탈퇴하시려면 아래 문구를 입력해주세요:',
    BUTTON_NEXT: '다음',
    BUTTON_PREVIOUS: '이전',
    BUTTON_DELETE: '탈퇴하기',
    BUTTON_CANCEL: '취소',
  },
} as const;
