import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

/**
 * 마운트 시 네이티브 스플래시를 숨긴다.
 *
 * 루트 _layout.tsx가 preventAutoHideAsync()로 자동 숨김을 전역으로 끄므로,
 * 앱의 첫 화면이 될 수 있는 라우트는 스플래시를 직접 숨겨야 한다.
 * 특히 딥링크(bugie://<route>) 콜드 스타트는 그 화면이 초기 라우트가 되어
 * app/index.tsx를 거치지 않는다 — 숨기지 않으면 스플래시가 영원히 남는다.
 *
 * 홈처럼 데이터 준비까지 스플래시를 유지하는 화면은 이 훅 대신
 * 자체 조건부 로직을 쓴다 ((tabs)/index.tsx, app/index.tsx).
 */
export function useHideSplashOnMount() {
  useEffect(() => {
    SplashScreen.hideAsync().catch((e) =>
      console.warn('SplashScreen hide error:', e)
    );
  }, []);
}
