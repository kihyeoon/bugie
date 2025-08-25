import type { SupabaseClient } from '@supabase/supabase-js';
import type { LedgerMember as DbLedgerMember } from '@repo/types';
import type {
  LedgerEntity,
  LedgerRepository as ILedgerRepository,
  LedgerMemberEntity,
  LedgerMemberRepository as ILedgerMemberRepository,
  CategoryEntity,
  CategoryRepository as ICategoryRepository,
  CategoryType,
  MemberRole,
} from '../../../domain/ledger/types';
import type { EntityId } from '../../../domain/shared/types';
import { LedgerMapper, LedgerMemberMapper } from '../mappers/LedgerMapper';
import { CategoryMapper } from '../mappers/CategoryMapper';

/**
 * Supabase를 사용한 가계부 리포지토리 구현
 */
export class LedgerRepository implements ILedgerRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: EntityId): Promise<LedgerEntity | null> {
    const { data, error } = await this.supabase
      .from('ledgers')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;
    return LedgerMapper.toDomain(data);
  }

  async findByUserId(userId: EntityId): Promise<LedgerEntity[]> {
    const { data, error } = await this.supabase
      .from('ledgers')
      .select(
        `
        *,
        ledger_members!inner(
          user_id
        )
      `
      )
      .eq('ledger_members.user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((item) => LedgerMapper.toDomain(item));
  }

  async findByUserIdWithMembers(userId: EntityId): Promise<
    Array<{
      ledger: LedgerEntity;
      members: LedgerMemberEntity[];
    }>
  > {
    // Step 1: 사용자가 속한 가계부 ID 목록 가져오기
    const { data: userMemberships, error: memberError } = await this.supabase
      .from('ledger_members')
      .select('ledger_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (memberError) throw memberError;
    if (!userMemberships || userMemberships.length === 0) return [];

    const ledgerIds = userMemberships.map((m) => m.ledger_id);

    // Step 2: 해당 가계부들과 모든 멤버 정보 가져오기
    const { data, error } = await this.supabase
      .from('ledgers')
      .select(
        `
        *,
        ledger_members(*)
      `
      )
      .in('id', ledgerIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group members by ledger
    return (data || []).map((item) => ({
      ledger: LedgerMapper.toDomain(item),
      members: (item.ledger_members || []).map((m: DbLedgerMember) =>
        LedgerMemberMapper.toDomain(m)
      ),
    }));
  }

  async findByIdWithMembers(id: EntityId): Promise<{
    ledger: LedgerEntity;
    members: Array<{
      member: LedgerMemberEntity;
      profile: {
        id: string;
        email: string;
        fullName?: string;
        avatarUrl?: string;
      };
    }>;
  } | null> {
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
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;

    return {
      ledger: LedgerMapper.toDomain(data),
      members: (data.ledger_members || []).map(
        (
          m: DbLedgerMember & {
            profiles: {
              id: string;
              email: string;
              full_name?: string;
              avatar_url?: string;
            };
          }
        ) => ({
          member: LedgerMemberMapper.toDomain(m),
          profile: {
            id: m.profiles.id,
            email: m.profiles.email,
            fullName: m.profiles.full_name || undefined,
            avatarUrl: m.profiles.avatar_url || undefined,
          },
        })
      ),
    };
  }

  async create(ledger: Omit<LedgerEntity, 'id'>): Promise<EntityId> {
    const dbData = LedgerMapper.toDbForCreate(ledger);

    const { data, error } = await this.supabase
      .from('ledgers')
      .insert(dbData)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async update(ledger: LedgerEntity): Promise<void> {
    const dbData = LedgerMapper.toDb(ledger);

    const { error } = await this.supabase
      .from('ledgers')
      .update(dbData)
      .eq('id', ledger.id);

    if (error) throw error;
  }

  async delete(id: EntityId): Promise<void> {
    // RLS 정책과 RETURNING 절 충돌을 피하기 위해 RPC 함수 사용
    const { error } = await this.supabase.rpc('soft_delete_ledger', {
      ledger_id: id,
    });

    if (error) throw error;
  }
}

/**
 * Supabase를 사용한 가계부 멤버 리포지토리 구현
 */
export class LedgerMemberRepository implements ILedgerMemberRepository {
  constructor(private supabase: SupabaseClient) {}

  async findByLedgerAndUser(
    ledgerId: EntityId,
    userId: EntityId
  ): Promise<LedgerMemberEntity | null> {
    const { data, error } = await this.supabase
      .from('ledger_members')
      .select('*')
      .eq('ledger_id', ledgerId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;
    return LedgerMemberMapper.toDomain(data);
  }

  async findByLedger(ledgerId: EntityId): Promise<LedgerMemberEntity[]> {
    const { data, error } = await this.supabase
      .from('ledger_members')
      .select('*')
      .eq('ledger_id', ledgerId)
      .is('deleted_at', null)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return (data || []).map((item) => LedgerMemberMapper.toDomain(item));
  }

  /**
   * RPC 함수를 통한 멤버 초대 (SECURITY DEFINER로 RLS 우회)
   * - 사용자 조회, 권한 검증, 멤버 추가를 원자적으로 처리
   * - 데이터베이스 함수가 모든 검증 수행
   */
  async inviteMemberByEmail(
    ledgerId: EntityId,
    userEmail: string,
    role: MemberRole
  ): Promise<void> {
    const { error } = await this.supabase.rpc('invite_member_to_ledger', {
      target_ledger_id: ledgerId,
      target_user_email: userEmail,
      member_role: role,
    });

    if (error) {
      // 데이터베이스 함수의 구체적인 에러 메시지 활용
      if (error.message.includes('사용자를 찾을 수 없습니다')) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }
      if (error.message.includes('권한이 없습니다')) {
        throw new Error('멤버를 초대할 권한이 없습니다.');
      }
      if (error.message.includes('이미 가계부 멤버입니다')) {
        throw new Error('이미 가계부 멤버입니다.');
      }
      throw error;
    }
  }

  async save(member: LedgerMemberEntity): Promise<void> {
    const dbData = LedgerMemberMapper.toDb(member);

    const { error } = await this.supabase.from('ledger_members').upsert(dbData);

    if (error) throw error;
  }

  async delete(ledgerId: EntityId, userId: EntityId): Promise<void> {
    const { error } = await this.supabase
      .from('ledger_members')
      .delete() // Hard delete 사용
      .eq('ledger_id', ledgerId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * 사용자를 모든 가계부에서 제거 (회원 탈퇴 시)
   * 주의: ledger_members는 하드 삭제 사용
   */
  async removeUserFromAllLedgers(userId: EntityId): Promise<void> {
    const { error } = await this.supabase
      .from('ledger_members')
      .delete()  // 하드 삭제
      .eq('user_id', userId);

    if (error) {
      throw new Error(`가계부 멤버십 제거 실패: ${error.message}`);
    }
  }
}

/**
 * Supabase를 사용한 카테고리 리포지토리 구현
 */
export class CategoryRepository implements ICategoryRepository {
  constructor(private supabase: SupabaseClient) {}

  async findByLedger(ledgerId: EntityId): Promise<CategoryEntity[]> {
    const { data, error } = await this.supabase
      .from('category_details')
      .select('*')
      .eq('ledger_id', ledgerId)
      .order('sort_order')
      .order('name');

    if (error) throw error;
    return (data || []).map((item) => CategoryMapper.viewToDomain(item));
  }

  async findById(id: EntityId): Promise<CategoryEntity | null> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;
    return CategoryMapper.toDomain(data);
  }

  async findFallbackCategory(
    ledgerId: EntityId,
    type: CategoryType
  ): Promise<CategoryEntity | null> {
    // "기타수입" 또는 "기타지출" 템플릿의 ID를 찾기
    const fallbackName = type === 'income' ? '기타수입' : '기타지출';

    // 먼저 템플릿 ID 찾기
    const { data: template } = await this.supabase
      .from('category_templates')
      .select('id')
      .eq('name', fallbackName)
      .eq('type', type)
      .single();

    if (!template) return null;

    // 해당 가계부에서 이 템플릿을 참조하는 카테고리 찾기
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('ledger_id', ledgerId)
      .eq('template_id', template.id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;
    return CategoryMapper.toDomain(data);
  }

  async create(category: Omit<CategoryEntity, 'id'>): Promise<EntityId> {
    const dbData = CategoryMapper.toDbForCreate(category);

    const { data, error } = await this.supabase
      .from('categories')
      .insert(dbData)
      .select('id')
      .single();

    if (error) {
      // PostgreSQL unique constraint 위반 시 더 명확한 에러 메시지 제공
      if (
        error.code === '23505' &&
        error.message?.includes('unique_active_ledger_custom_name')
      ) {
        const categoryName = dbData.name || '해당';
        throw new Error(
          `이미 "${categoryName}" 카테고리가 존재합니다. 다른 이름을 사용해주세요.`
        );
      }
      throw error;
    }
    return data.id;
  }

  async update(category: CategoryEntity): Promise<void> {
    const dbData = CategoryMapper.toDb(category);

    const { error } = await this.supabase
      .from('categories')
      .update(dbData)
      .eq('id', category.id);

    if (error) {
      // PostgreSQL unique constraint 위반 시 더 명확한 에러 메시지 제공
      if (
        error.code === '23505' &&
        error.message?.includes('unique_active_ledger_custom_name')
      ) {
        const categoryName = dbData.name || '해당';
        throw new Error(
          `이미 "${categoryName}" 카테고리가 존재합니다. 다른 이름을 사용해주세요.`
        );
      }
      throw error;
    }
  }

  async updatePartial(
    id: EntityId,
    updates: Partial<CategoryEntity>
  ): Promise<void> {
    const updateData: Record<string, string | number | boolean> = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.sortOrder !== undefined)
      updateData.sort_order = updates.sortOrder;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    updateData.updated_at = new Date().toISOString();

    const { error } = await this.supabase
      .from('categories')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  }

  async delete(id: EntityId): Promise<void> {
    const { error } = await this.supabase
      .from('categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  async softDelete(id: EntityId): Promise<void> {
    // RPC 함수를 사용하여 soft delete 수행 (RLS 문제 우회)
    const { error } = await this.supabase.rpc('soft_delete_category', {
      category_id: id,
    });

    if (error) throw error;
  }

  async getTemplates(): Promise<CategoryEntity[]> {
    const { data, error } = await this.supabase
      .from('category_templates')
      .select('*')
      .order('sort_order')
      .order('name');

    if (error) throw error;
    return (data || []).map((item) =>
      CategoryMapper.templateToGlobalDomain(item)
    );
  }

  async activateDefaultCategories(ledgerId: EntityId): Promise<void> {
    // Get all templates
    const templates = await this.getTemplates();

    // Create categories referencing templates
    const categories = templates.map((template) => ({
      ledger_id: ledgerId,
      template_id: template.id,
      type: template.type,
      is_active: true,
    }));

    const { error } = await this.supabase.from('categories').insert(categories);

    if (error) throw error;
  }
}
