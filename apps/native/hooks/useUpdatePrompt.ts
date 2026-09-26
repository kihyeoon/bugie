import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
import type { UpdatePrompt } from '@repo/core';
import { useServices } from '../contexts/ServiceContext';
import { queryKeys } from '../utils/queryClient';

const NO_PROMPT: UpdatePrompt = { type: 'none' };

/**
 * 새 버전 안내 판정 (BGI-52)
 *
 * 루트 강제 게이트와 홈 권장 Alert가 같은 쿼리를 공유해 요청은 한 번만 나간다.
 * 앱을 켜 둔 채 며칠씩 쓰므로 포그라운드 복귀 때 useAppStateHandler가 무효화해 다시 받는다.
 * 확인하지 못하면(로딩·네트워크 오류) 막지 않는다 — 버전 확인 때문에 앱을 못 쓰면 안 된다.
 */
export function useUpdatePrompt(): UpdatePrompt {
  const { appVersionService } = useServices();

  const { data } = useQuery({
    queryKey: queryKeys.updatePrompt,
    queryFn: () =>
      appVersionService.getUpdatePrompt(
        Platform.OS,
        Constants.expoConfig?.version
      ),
    staleTime: Infinity,
  });

  return data ?? NO_PROMPT;
}
