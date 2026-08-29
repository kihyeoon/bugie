import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * RN 0.86의 ColorSchemeName은 'light' | 'dark' | 'unspecified' | null 이다.
 * 앱 팔레트(Colors)는 light/dark만 가지므로 여기서 좁혀서 반환한다.
 */
export function useColorScheme(): 'light' | 'dark' {
  return useRNColorScheme() === 'dark' ? 'dark' : 'light';
}
