import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AppVersionPolicy,
  AppVersionPolicyRepository,
} from '../../../domain/app-version/types';

export class SupabaseAppVersionPolicyRepository
  implements AppVersionPolicyRepository
{
  constructor(private supabase: SupabaseClient) {}

  async findByPlatform(platform: string): Promise<AppVersionPolicy | null> {
    const { data, error } = await this.supabase
      .from('app_versions')
      .select('recommended_version, recommended_message, min_supported_version')
      .eq('platform', platform)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }

    return {
      recommendedVersion: data.recommended_version,
      recommendedMessage: data.recommended_message,
      minSupportedVersion: data.min_supported_version,
    };
  }
}
