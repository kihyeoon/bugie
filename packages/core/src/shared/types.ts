import type { MemberRole, CategoryType } from '../domain/ledger/types';

// 가계부 관련 응답 타입
export interface LedgerWithMembers {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  ledger_members: Array<{
    role: MemberRole;
    user_id: string;
    full_name: string | null;
  }>;
}

export interface LedgerDetail {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  ledger_members: Array<{
    id: string;
    ledger_id: string;
    user_id: string;
    role: MemberRole;
    joined_at: string;
    deleted_at: string | null;
    profiles: {
      id: string;
      email: string;
      full_name: string | null;
      avatar_url: string | null;
    };
  }>;
}

// 카테고리 관련 응답 타입
export interface CategoryDetail {
  id: string;
  ledger_id: string;
  template_id: string | null;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  source_type: 'template' | 'custom';
}

// 거래 관련 응답 타입
export interface TransactionWithDetails {
  id: string;
  ledger_id: string;
  category_id: string;
  created_by: string;
  paid_by: string | null;
  amount: string | number;
  type: CategoryType;
  title: string;
  description: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  category_name: string;
  category_color: string;
  category_icon: string;
  category_source: 'template' | 'custom';
  ledger_name: string;
  created_by_name: string | null; // 탈퇴한 사용자는 null
  paid_by_name: string | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
  payment_method_icon: string | null;
  payment_method_is_shared: boolean | null;
}

export interface CalendarDayData {
  income: number;
  expense: number;
}

export interface CalendarData {
  [date: string]: CalendarDayData;
}

export interface CategorySummary {
  category_id: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  total_amount: number;
  transaction_count: number;
  percentage: number;
}

export interface DailySummary {
  date: string;
  income: number;
  expense: number;
  transactions: TransactionWithDetails[];
}

// 초대 링크 + 그 링크로 들어온 사람들 (가계부 설정의 초대 관리 화면용)
export interface LedgerInviteDetail {
  id: string;
  ledger_id: string;
  inviter_id: string | null;
  code: string;
  role: MemberRole;
  status: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string;
  created_at: string;
  ledger_invite_acceptances: Array<{
    id: string;
    user_id: string;
    accepted_at: string;
    profiles: {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  }>;
}
