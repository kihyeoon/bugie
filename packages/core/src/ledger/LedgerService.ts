import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemberRole, Ledger, CategoryTemplate } from '@repo/types';
import type {
  CreateLedgerInput,
  UpdateLedgerInput,
  InviteMemberInput,
} from './types';
import type {
  LedgerWithMembers,
  LedgerDetail,
  CategoryDetail,
} from '../shared/types';

export class LedgerService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 사용자가 속한 모든 가계부 목록 조회
   */
  async getUserLedgers(): Promise<LedgerWithMembers[]> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error('인증이 필요합니다.');

    const { data, error } = await this.supabase
      .from('ledgers')
      .select(
        `
        *,
        ledger_members!inner(
          role,
          user_id
        )
      `
      )
      .eq('ledger_members.user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * 특정 가계부 상세 정보 조회
   */
  async getLedger(ledgerId: string): Promise<LedgerDetail> {
    const { data, error } = await this.supabase
      .from('ledgers')
      .select(
        `
        *,
        ledger_members(
          *,
          profiles(
            id,
            email,
            full_name,
            avatar_url
          )
        )
      `
      )
      .eq('id', ledgerId)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 새 가계부 생성
   */
  async createLedger(input: CreateLedgerInput): Promise<Ledger> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error('인증이 필요합니다.');

    // 트랜잭션으로 가계부 생성 + 멤버 추가 + 기본 카테고리 활성화
    const { data: ledger, error: ledgerError } = await this.supabase
      .from('ledgers')
      .insert({
        name: input.name,
        description: input.description,
        currency: input.currency || 'KRW',
        created_by: user.id,
      })
      .select()
      .single();

    if (ledgerError) throw ledgerError;

    // 생성자를 owner로 추가
    const { error: memberError } = await this.supabase
      .from('ledger_members')
      .insert({
        ledger_id: ledger.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) {
      // 가계부 삭제 (롤백)
      await this.supabase.from('ledgers').delete().eq('id', ledger.id);
      throw memberError;
    }

    // 기본 카테고리 활성화
    await this.activateDefaultCategories(ledger.id);

    return ledger;
  }

  /**
   * 가계부 정보 수정
   */
  async updateLedger(
    ledgerId: string,
    input: UpdateLedgerInput
  ): Promise<Ledger> {
    const { data, error } = await this.supabase
      .from('ledgers')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ledgerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 가계부 삭제 (Soft Delete)
   */
  async deleteLedger(ledgerId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ledgers')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', ledgerId);

    if (error) throw error;
  }

  /**
   * 가계부 멤버 초대
   */
  async inviteMember(input: InviteMemberInput): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('invite_member_to_ledger', {
      target_ledger_id: input.ledgerId,
      target_user_email: input.userEmail,
      member_role: input.role || 'member',
    });

    if (error) throw error;
    return data;
  }

  /**
   * 멤버 권한 변경
   */
  async updateMemberRole(
    ledgerId: string,
    userId: string,
    role: MemberRole
  ): Promise<void> {
    const { error } = await this.supabase
      .from('ledger_members')
      .update({ role })
      .eq('ledger_id', ledgerId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * 멤버 제거
   */
  async removeMember(ledgerId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ledger_members')
      .update({ deleted_at: new Date().toISOString() })
      .eq('ledger_id', ledgerId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * 가계부 나가기
   */
  async leaveLedger(ledgerId: string): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error('인증이 필요합니다.');

    await this.removeMember(ledgerId, user.id);
  }

  /**
   * 가계부의 카테고리 목록 조회
   */
  async getCategories(ledgerId: string): Promise<CategoryDetail[]> {
    const { data, error } = await this.supabase
      .from('category_details')
      .select('*')
      .eq('ledger_id', ledgerId)
      .order('sort_order')
      .order('name');

    if (error) throw error;
    return data;
  }

  /**
   * 커스텀 카테고리 추가
   */
  async addCustomCategory(
    ledgerId: string,
    name: string,
    type: 'income' | 'expense',
    color?: string,
    icon?: string
  ): Promise<string> {
    const { data, error } = await this.supabase.rpc('add_custom_category', {
      target_ledger_id: ledgerId,
      category_name: name,
      category_type: type,
      category_color: color || '#6B7280',
      category_icon: icon || 'tag',
      category_sort_order: 999,
    });

    if (error) throw error;
    return data;
  }

  /**
   * 기본 카테고리 활성화 (내부 함수)
   */
  private async activateDefaultCategories(ledgerId: string): Promise<void> {
    // 모든 카테고리 템플릿 가져오기
    const { data: templates, error: templatesError } = await this.supabase
      .from('category_templates')
      .select('*')
      .order('sort_order');

    if (templatesError) throw templatesError;

    // 템플릿을 참조하는 카테고리 생성
    const categories = templates.map((template: CategoryTemplate) => ({
      ledger_id: ledgerId,
      template_id: template.id,
      type: template.type,
    }));

    const { error } = await this.supabase.from('categories').insert(categories);

    if (error) throw error;
  }
}
