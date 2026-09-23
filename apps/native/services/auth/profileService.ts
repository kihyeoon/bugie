import { ProfileRules } from '@repo/core';
import { supabase } from '../../utils/supabase';
import type { AuthProfile as Profile } from '@repo/types';
import type { User } from '@supabase/supabase-js';

/**
 * 사용자 메타데이터에서 프로필 정보 추출
 */
export const extractUserMetadata = (
  user?: User | null
): {
  fullName?: string;
  avatarUrl?: string;
} => {
  if (!user?.user_metadata) return {};

  const metadata = user.user_metadata;
  return {
    fullName: metadata.full_name || metadata.name,
    avatarUrl: metadata.avatar_url || metadata.picture,
  };
};

interface RestoreAccountResult {
  success: boolean;
  message?: string;
  days_since_deletion?: number;
}

/**
 * 타입 가드: RPC 응답이 RestoreAccountResult 구조인지 검증
 */
function isRestoreAccountResult(data: unknown): data is RestoreAccountResult {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  return 'success' in obj && typeof obj.success === 'boolean';
}

/**
 * 삭제된 계정 복구 시도
 */
export const restoreDeletedAccount = async (
  userId: string
): Promise<{
  success: boolean;
  message?: string;
  daysSinceDeletion?: number;
}> => {
  try {
    const { data, error } = await supabase.rpc('restore_deleted_account', {
      target_user_id: userId,
    });

    if (error) {
      console.error('Account restoration check error:', error);
      return { success: false };
    }

    if (data && isRestoreAccountResult(data)) {
      return {
        success: data.success,
        message: data.message,
        daysSinceDeletion: data.days_since_deletion ?? undefined,
      };
    }

    return { success: false };
  } catch (error) {
    console.error('Error restoring account:', error);
    return { success: false };
  }
};

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
      // 프로필이 없는 것은 에러가 아님
      if (error.code === 'PGRST116') {
        return null;
      }
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
 * 프로필을 직접 DB에 생성 (RPC 함수 대신)
 */
const createProfileDirectly = async (
  userId: string,
  email: string,
  userData?: {
    fullName?: string;
    avatarUrl?: string;
  }
): Promise<{ data: Profile | null; error: Error | null }> => {
  const { data: profileData, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      email: email,
      full_name: userData?.fullName || email.split('@')[0],
      avatar_url: userData?.avatarUrl || null,
      currency: 'KRW',
      timezone: 'Asia/Seoul',
    })
    .select()
    .single();

  if (insertError) {
    return { data: null, error: new Error(insertError.message) };
  }

  // 기본 가계부 생성 시도 (선택사항)
  await createDefaultLedger(userId, profileData.full_name || '사용자');

  return { data: profileData, error: null };
};

/**
 * 프로필 생성 (신규 가입 시)
 * 트리거 대신 애플리케이션 레벨에서 명시적으로 생성
 */
export const createProfile = async (
  userId: string,
  email: string,
  userData?: {
    fullName?: string;
    avatarUrl?: string;
  }
): Promise<{ data: Profile | null; error: Error | null }> => {
  try {
    // 이미 프로필이 있는지 확인
    const existing = await fetchProfile(userId);
    if (existing) {
      return { data: existing, error: null };
    }

    // RPC 함수를 사용하여 프로필과 기본 가계부 생성
    const { data: success, error } = await supabase.rpc('create_user_profile', {
      p_user_id: userId,
      p_email: email,
      p_full_name: userData?.fullName ?? undefined,
      p_avatar_url: userData?.avatarUrl ?? undefined,
    });

    // 1. RPC 함수가 없는 경우 (function does not exist) - 직접 생성 시도
    if (error && 'code' in error && error.code === '42883') {
      console.log('RPC function not found, creating profile directly');
      return await createProfileDirectly(userId, email, userData);
    }

    // 2. 다른 에러가 발생한 경우
    if (error) {
      console.error('Profile creation error:', error);
      const errorMessage =
        typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Profile creation failed';
      return { data: null, error: new Error(errorMessage) };
    }

    // 3. 에러는 없지만 success가 false인 경우 - 직접 생성 시도
    if (!success) {
      console.log('RPC returned false, creating profile directly');
      return await createProfileDirectly(userId, email, userData);
    }

    // 4. 성공한 경우 - 생성된 프로필 조회
    const newProfile = await fetchProfile(userId);
    return { data: newProfile, error: null };
  } catch (error) {
    console.error('Error creating profile:', error);
    return {
      data: null,
      error:
        error instanceof Error ? error : new Error('Profile creation failed'),
    };
  }
};

/**
 * 프로필 확인 및 자동 생성
 * 프로필이 없으면 자동으로 생성하고, 삭제된 계정은 복구 시도
 */
export const ensureProfile = async (
  userId: string,
  email?: string | null,
  user?: User | null,
  userData?: {
    fullName?: string;
    avatarUrl?: string;
  }
): Promise<Profile | null> => {
  try {
    // 1. 기존 프로필 조회
    let profile = await fetchProfile(userId);

    // 2. 프로필이 없으면 복구 시도 후 생성
    if (!profile) {
      // 탈퇴한 계정일 수 있으므로 복구 시도
      const restoreResult = await restoreDeletedAccount(userId);
      if (restoreResult.success) {
        console.log('탈퇴한 계정이 자동으로 복구되었습니다.');
        if (restoreResult.daysSinceDeletion) {
          console.log(
            `복구 정보: 탈퇴 후 ${restoreResult.daysSinceDeletion}일 경과`
          );
        }
        // 복구 후 프로필 다시 조회
        profile = await fetchProfile(userId);
      }
    }

    // 3. 여전히 프로필이 없으면 신규 생성
    if (!profile && email) {
      console.log('Profile not found, creating new profile...');

      // 사용자 메타데이터 추출 (전달된 userData 우선 사용)
      const metadataFromUser = user ? extractUserMetadata(user) : undefined;
      const finalUserData = {
        fullName: userData?.fullName || metadataFromUser?.fullName,
        avatarUrl: userData?.avatarUrl || metadataFromUser?.avatarUrl,
      };

      const { data: newProfile, error } = await createProfile(
        userId,
        email,
        finalUserData
      );

      if (error) {
        console.error('Failed to create profile:', error);
        return null;
      }

      console.log('Profile created successfully');
      profile = newProfile;
    }

    return profile;
  } catch (error) {
    console.error('Error ensuring profile:', error);
    return null;
  }
};

/**
 * 기본 가계부 생성 (프로필 생성 시 옵션)
 */
const createDefaultLedger = async (
  userId: string,
  userName: string
): Promise<void> => {
  try {
    // setup_new_user 함수가 있으면 호출
    const { error } = await supabase.rpc('setup_new_user', {
      user_uuid: userId,
      user_email: '', // 이미 프로필에 있음
      user_name: userName,
    });

    if (error) {
      // 실패해도 프로필 생성은 성공으로 처리
      console.warn('Failed to create default ledger:', error);
    }
  } catch (error) {
    console.warn('Error creating default ledger:', error);
  }
};

/**
 * 닉네임 화면을 보여줘야 하는지 판정한다.
 *
 * onboarded_at 컬럼이 생기기 전에 저장된 프로필 캐시에는 키가 없다(undefined). 이를 미완료로 보면 업데이트 직후
 * 기존 사용자 전원이 닉네임 화면으로 튕기므로, 서버가 준 null만 미완료로 본다.
 * 프로필을 불러오지 못했으면 이전처럼 설정 화면으로 보낸다.
 */
export const needsOnboarding = (profile: Profile | null): boolean =>
  !profile || profile.onboarded_at === null;

/** 닉네임 규칙 위반 메시지. 규칙에 맞으면 null. */
export const nicknameError = (nickname: string): string | null => {
  try {
    ProfileRules.validateNickname(nickname);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : '사용할 수 없는 닉네임입니다.';
  }
};

/**
 * 닉네임 입력칸의 기본값. 애플·구글이 준 이름은 규칙에 맞지 않을 수 있어(`Gil-dong Hong`, `O'Brien`)
 * 허용하지 않는 문자를 빼고 20자로 자른다. 이메일 앞부분(제공자 이름이 없을 때의 폴백)이거나
 * 정리해도 규칙에 맞지 않으면 빈칸으로 둔다.
 */
export const toNicknameDraft = (
  name: string | null | undefined,
  email: string | null | undefined
): string => {
  if (!name || name === email?.split('@')[0]) return '';

  const draft = name
    .normalize('NFC')
    .replace(/[^가-힣a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20)
    .trim();
  return nicknameError(draft) ? '' : draft;
};

/** 가입 때 setup_new_user가 만드는 기본 가계부 이름 */
export const defaultLedgerName = (name: string) => `${name}의 가계부`;

/**
 * 가입 때 만들어진 기본 가계부를 찾는다. 표시는 없으므로 "내가 만들었고 이름이 자동으로 붙은 형식 그대로"인
 * 가계부로 본다. 사용자가 이름을 바꾼 가계부는 걸리지 않는다.
 */
export const findDefaultLedger = <T extends { name: string; created_by: string }>(
  ledgers: T[],
  userId: string | undefined,
  currentName: string | null | undefined
): T | undefined => {
  if (!userId || !currentName) return undefined;
  return ledgers.find(
    (ledger) =>
      ledger.created_by === userId &&
      ledger.name === defaultLedgerName(currentName)
  );
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
