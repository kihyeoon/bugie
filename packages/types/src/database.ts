// 열거형 타입
export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type CategoryType = 'income' | 'expense';
export type BudgetPeriod = 'monthly' | 'yearly';

// 프로필
export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// 가계부
export interface Ledger {
  id: string;
  name: string;
  description?: string;
  currency: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// 가계부 멤버
export interface LedgerMember {
  id: string;
  ledger_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  deleted_at?: string;
}

// 카테고리 템플릿
export interface CategoryTemplate {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// 카테고리
export interface Category {
  id: string;
  ledger_id: string;
  template_id?: string;
  name?: string;
  type: CategoryType;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// 거래
export interface Transaction {
  id: string;
  ledger_id: string;
  category_id: string;
  created_by: string;
  amount: number;
  type: CategoryType;
  title: string;
  description?: string;
  transaction_date: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// 예산
export interface Budget {
  id: string;
  ledger_id: string;
  category_id: string;
  amount: number;
  period: BudgetPeriod;
  year: number;
  month?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}
