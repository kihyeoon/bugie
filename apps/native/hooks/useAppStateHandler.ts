import { useEffect, useRef } from 'react';
import { AppState, Keyboard, type AppStateStatus } from 'react-native';
import { supabase } from '../utils/supabase';

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
        }

        appState.current = nextState;
      }
    );

    supabase.auth.startAutoRefresh();

    return () => sub.remove();
  }, []);
}
