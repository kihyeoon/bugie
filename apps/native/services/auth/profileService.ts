import { supabase } from '../../utils/supabase';
import type { AuthProfile as Profile } from '@repo/types';

/**
 * 프로필 정보 가져오기
 */
export const fetchProfile = async (userId: string): Promise<Profile | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
};

/**
 * 프로필 완성 여부 확인
 */
export const isProfileComplete = (profile: Profile | null): boolean => {
  if (!profile) return false;
  return !!profile.full_name;
};

/**
 * 프로필 업데이트
 */
export const updateProfile = async (
  userId: string,
  data: Partial<Profile>
): Promise<{ data: Profile | null; error: Error | null }> => {
  try {
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: updatedProfile, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
};
