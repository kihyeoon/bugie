import { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORE_URL } from '../constants/appStore';
import { useUpdatePrompt } from './useUpdatePrompt';

const LAST_PROMPTED_VERSION_KEY = '@bugie/last_recommended_update_version';
const DEFAULT_MESSAGE = '새로운 기능이 추가됐어요. 지금 업데이트해 보세요.';

/**
 * 권장 업데이트 Alert (BGI-52)
 *
 * 운영자가 recommended_version을 넣었을 때만 뜨고, 같은 버전에는 한 번만 띄운다.
 * 스플래시 위에 겹치지 않도록 화면이 준비된 뒤(ready)에만 띄운다.
 */
export function useRecommendedUpdateAlert(ready: boolean) {
  const prompt = useUpdatePrompt();
  // React Query의 구조적 공유 덕분에 값이 같으면 참조도 같아 effect가 다시 돌지 않는다
  const recommended = prompt.type === 'recommended' ? prompt : null;

  useEffect(() => {
    if (!ready || !recommended) {
      return;
    }
    const { version, message } = recommended;

    let cancelled = false;
    (async () => {
      try {
        const lastPrompted = await AsyncStorage.getItem(
          LAST_PROMPTED_VERSION_KEY
        );
        if (cancelled || lastPrompted === version) {
          return;
        }
        // 저장을 먼저 한다 — 답하기 전에 앱이 꺼져도 다시 조르지 않는다
        await AsyncStorage.setItem(LAST_PROMPTED_VERSION_KEY, version);
        Alert.alert('새 버전이 나왔어요', message ?? DEFAULT_MESSAGE, [
          { text: '나중에', style: 'cancel' },
          { text: '업데이트', onPress: () => Linking.openURL(APP_STORE_URL) },
        ]);
      } catch (e) {
        console.warn('Recommended update alert error:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, recommended]);
}
