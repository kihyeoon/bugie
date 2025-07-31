import type {
  Ledger,
  LedgerMember,
  Profile,
  Category,
  Transaction,
} from '@repo/types';

// 가계부 관련 응답 타입
export interface LedgerWithMembers extends Ledger {
  ledger_members: Array<{
    role: LedgerMember['role'];
    user_id: string;
  }>;
}

export interface LedgerDetail extends Ledger {
  ledger_members: Array<
    LedgerMember & {
      profiles: Pick<Profile, 'id' | 'email' | 'full_name' | 'avatar_url'>;
    }
  >;
}

// 카테고리 관련 응답 타입
export interface CategoryDetail
  extends Omit<Category, 'name' | 'color' | 'icon'> {
  name: string;
  color: string;
  icon: string;
  source_type: 'template' | 'custom';
}

// 거래 관련 응답 타입
export interface TransactionWithDetails extends Transaction {
  category_name: string;
  category_color: string;
  category_icon: string;
  category_source: 'template' | 'custom';
  ledger_name: string;
  created_by_name: string;
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
