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
