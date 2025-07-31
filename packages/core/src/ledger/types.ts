import type { MemberRole } from '@repo/types';

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