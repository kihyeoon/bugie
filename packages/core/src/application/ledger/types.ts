import type { MemberRole } from '../../domain/ledger/types';

/**
 * 애플리케이션 레이어 입력 타입
 */

export interface CreateLedgerInput {
  name: string;
  description?: string;
  currency?: string;
}

export interface UpdateLedgerInput {
  name?: string;
  description?: string;
  currency?: string;
}

export interface InviteMemberInput {
  ledgerId: string;
  userEmail: string;
  role?: MemberRole;
}