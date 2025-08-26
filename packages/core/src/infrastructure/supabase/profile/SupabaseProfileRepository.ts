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
   * 프로필 soft delete (회원 탈퇴 시)
   *
   * RPC 함수 사용 (SECURITY DEFINER로 RLS 우회)
   */
  async softDelete(_userId: EntityId): Promise<void> {
    const { error } = await this.supabase.rpc('soft_delete_profile');

    if (error) {
      throw new Error(`프로필 soft delete 실패: ${error.message}`);
    }
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
