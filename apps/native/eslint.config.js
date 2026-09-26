const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  // Expo 설정 추가
  ...expoConfig,

  // React Native 특화 규칙
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      // React Native에서는 console 사용이 일반적
      'no-console': 'off',

      // React Native 특화 규칙
      'react-native/no-inline-styles': 'off', // 인라인 스타일 허용
      'react-native/no-unused-styles': 'off',
      
      // TypeScript 규칙
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // React Compiler 전용 규칙 (eslint-plugin-react-hooks 7) — 컴파일러를 켜지 않아 경고로 둔다.
  // 기존 위반(대부분 useRef(new Animated.Value()) 패턴)은 BGI-51에서 정리한다.
  {
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },

  // Expo 특화 ignore 패턴
  {
    ignores: ['dist/**', '.expo/**', 'android/**', 'ios/**'],
  },
];
