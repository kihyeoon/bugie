import { useEffect, useRef } from 'react';
import { AppState, Keyboard, type AppStateStatus } from 'react-native';
import { supabase } from '../utils/supabase';
import { queryClient, queryKeys } from '../utils/queryClient';

export function useAppStateHandler() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background') {
          Keyboard.dismiss();
          supabase.auth.stopAutoRefresh();
        }

        if (
          nextState === 'active' &&
          appState.current === 'background'
        ) {
          supabase.auth.startAutoRefresh();
          // 켜 둔 채 며칠씩 쓰는 앱이라 복귀할 때마다 버전 정책을 다시 확인한다 (BGI-52)
          queryClient.invalidateQueries({ queryKey: queryKeys.updatePrompt });
        }

        appState.current = nextState;
      }
    );

    supabase.auth.startAutoRefresh();

    return () => sub.remove();
  }, []);
}
