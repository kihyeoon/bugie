import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ProfileEntity,
  ProfileRepository,
} from '../../../domain/profile/types';
import type { EntityId } from '../../../domain/shared/types';
import { NotFoundError } from '../../../domain/shared/errors';

/**
 * Supabase를 사용한 프로필 리포지토리 구현
 */
export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * ID로 프로필 조회
   */
  async findById(id: EntityId): Promise<ProfileEntity | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * 프로필 업데이트
   */
  async update(
    id: EntityId,
    data: Partial<ProfileEntity>
  ): Promise<ProfileEntity> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.fullName !== undefined) {
      updateData.full_name = data.fullName;
    }
    if (data.avatarUrl !== undefined) {
      updateData.avatar_url = data.avatarUrl;
    }
    if (data.currency !== undefined) {
      updateData.currency = data.currency;
    }
    if (data.timezone !== undefined) {
      updateData.timezone = data.timezone;
    }

    const { data: updatedData, error } = await this.supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !updatedData) {
      throw new NotFoundError(`프로필 업데이트 실패: ${error?.message}`);
    }

    return this.mapToEntity(updatedData);
  }

  /**
   * 프로필 삭제 (Soft Delete)
   */
  async delete(id: EntityId): Promise<void> {
    const { error } = await this.supabase
      .from('profiles')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`프로필 삭제 실패: ${error.message}`);
    }
  }

  /**
   * 회원 탈퇴 시 사용자 데이터 정리
   */
  async deleteUserData(userId: EntityId): Promise<void> {
    // 1. 모든 공유 가계부에서 멤버 제거
    const { error: memberError } = await this.supabase
      .from('ledger_members')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (memberError) {
      throw new Error(`멤버 데이터 정리 실패: ${memberError.message}`);
    }

    // 2. 소유한 가계부 soft delete
    const { error: ledgerError } = await this.supabase
      .from('ledgers')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('created_by', userId);

    if (ledgerError) {
      throw new Error(`가계부 데이터 정리 실패: ${ledgerError.message}`);
    }

    // 3. 프로필 soft delete
    await this.delete(userId);
  }

  /**
   * DB 데이터를 엔티티로 매핑
   */
  private mapToEntity(data: Record<string, unknown>): ProfileEntity {
    return {
      id: data.id as string,
      email: (data.email as string) || '',
      fullName: data.full_name as string | null,
      avatarUrl: data.avatar_url as string | null,
      currency: (data.currency as string) || 'KRW',
      timezone: (data.timezone as string) || 'Asia/Seoul',
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
      isDeleted: !!data.deleted_at,
    };
  }
}
