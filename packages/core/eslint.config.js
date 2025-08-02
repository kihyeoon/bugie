import rootConfig from '../../eslint.config.js';

export default [
  // 루트 설정 상속
  ...rootConfig,

  // 서비스 패키지 특화 규칙
  {
    files: ['**/*.ts'],
    rules: {
      // 서비스 클래스는 의존성 주입 패턴 사용
      '@typescript-eslint/no-explicit-any': 'warn',

      // 비즈니스 로직 메서드는 반환 타입 명시
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
    },
  },
];
