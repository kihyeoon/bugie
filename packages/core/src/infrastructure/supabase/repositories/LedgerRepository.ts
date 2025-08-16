import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  LedgerMember as DbLedgerMember
} from '@repo/types';
import type { 
  LedgerEntity, 
  LedgerRepository as ILedgerRepository,
  LedgerMemberEntity,
  LedgerMemberRepository as ILedgerMemberRepository,
  CategoryEntity,
  CategoryRepository as ICategoryRepository
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
      .select(`
        *,
        ledger_members!inner(
          user_id
        )
      `)
      .eq('ledger_members.user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(item => LedgerMapper.toDomain(item));
  }

  async findByUserIdWithMembers(userId: EntityId): Promise<Array<{
    ledger: LedgerEntity;
    members: LedgerMemberEntity[];
  }>> {
    const { data, error } = await this.supabase
      .from('ledgers')
      .select(`
        *,
        ledger_members!inner(*)
      `)
      .eq('ledger_members.user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group members by ledger
    return (data || []).map(item => ({
      ledger: LedgerMapper.toDomain(item),
      members: (item.ledger_members || []).map((m: DbLedgerMember) => 
        LedgerMemberMapper.toDomain(m)
      )
    }));
  }

  async findByIdWithMembers(id: EntityId): Promise<{
    ledger: LedgerEntity;
    members: Array<{
      member: LedgerMemberEntity;
      profile: { id: string; email: string; fullName?: string; avatarUrl?: string };
    }>;
  } | null> {
    const { data, error } = await this.supabase
      .from('ledgers')
      .select(`
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
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;

    return {
      ledger: LedgerMapper.toDomain(data),
      members: (data.ledger_members || []).map((m: any) => ({
        member: LedgerMemberMapper.toDomain(m),
        profile: {
          id: m.profiles.id,
          email: m.profiles.email,
          fullName: m.profiles.full_name || undefined,
          avatarUrl: m.profiles.avatar_url || undefined
        }
      }))
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
    const { error } = await this.supabase
      .from('ledgers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

}

/**
 * Supabase를 사용한 가계부 멤버 리포지토리 구현
 */
export class LedgerMemberRepository implements ILedgerMemberRepository {
  constructor(private supabase: SupabaseClient) {}

  async findByLedgerAndUser(ledgerId: EntityId, userId: EntityId): Promise<LedgerMemberEntity | null> {
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
    return (data || []).map(item => LedgerMemberMapper.toDomain(item));
  }

  async findUserByEmail(email: string): Promise<{ id: EntityId; email: string } | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;
    return data;
  }

  async save(member: LedgerMemberEntity): Promise<void> {
    const dbData = LedgerMemberMapper.toDb(member);
    
    const { error } = await this.supabase
      .from('ledger_members')
      .upsert(dbData);

    if (error) throw error;
  }

  async delete(ledgerId: EntityId, userId: EntityId): Promise<void> {
    const { error } = await this.supabase
      .from('ledger_members')
      .update({ deleted_at: new Date().toISOString() })
      .eq('ledger_id', ledgerId)
      .eq('user_id', userId);

    if (error) throw error;
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
    return (data || []).map(item => CategoryMapper.viewToDomain(item));
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

  async create(category: Omit<CategoryEntity, 'id'>): Promise<EntityId> {
    const dbData = CategoryMapper.toDbForCreate(category);
    
    const { data, error } = await this.supabase
      .from('categories')
      .insert(dbData)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async update(category: CategoryEntity): Promise<void> {
    const dbData = CategoryMapper.toDb(category);
    
    const { error } = await this.supabase
      .from('categories')
      .update(dbData)
      .eq('id', category.id);

    if (error) throw error;
  }

  async updatePartial(id: EntityId, updates: Partial<CategoryEntity>): Promise<void> {
    const updateData: any = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;
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
      category_id: id
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
    return (data || []).map(item => CategoryMapper.templateToGlobalDomain(item));
  }

  async activateDefaultCategories(ledgerId: EntityId): Promise<void> {
    // Get all templates
    const templates = await this.getTemplates();
    
    // Create categories referencing templates
    const categories = templates.map(template => ({
      ledger_id: ledgerId,
      template_id: template.id,
      type: template.type,
      is_active: true
    }));

    const { error } = await this.supabase
      .from('categories')
      .insert(categories);

    if (error) throw error;
  }

}