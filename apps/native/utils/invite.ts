/**
 * 초대 코드 표기/정규화 유틸 (BGI-22)
 *
 * DB에는 하이픈 없이 대문자 12자로 저장한다. 사람에게 보여줄 때만 4자씩 끊어 표기한다.
 * 서버(accept_ledger_invite)도 같은 정규화를 하므로 표기형을 그대로 붙여넣어도 동작하지만,
 * 앱에서도 정리해 보내 불필요한 실패 시도(rate limit 소모)를 줄인다.
 */

/** 표기형(ABCD-EFGH-IJKL) → 저장형(ABCDEFGHIJKL) */
export function normalizeInviteCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** 저장형 → 표기형. 4자씩 하이픈으로 끊는다. */
export function formatInviteCode(code: string): string {
  const normalized = normalizeInviteCode(code);
  return normalized.replace(/(.{4})(?=.)/g, '$1-');
}

/** 초대 코드로 딥링크 URL 생성 */
export function buildInviteUrl(code: string): string {
  return `bugie://invite?code=${normalizeInviteCode(code)}`;
}

/** 공유 시트에 넣을 메시지 */
export function buildInviteMessage(ledgerName: string, code: string): string {
  return [
    `'${ledgerName}' 가계부에 초대합니다.`,
    '',
    `초대 코드: ${formatInviteCode(code)}`,
    '',
    'Bugie 앱에서 코드를 입력하면 참여할 수 있어요.',
    buildInviteUrl(code),
  ].join('\n');
}
