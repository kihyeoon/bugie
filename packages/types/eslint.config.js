const rootConfig = require('../../eslint.config.js');

module.exports = [
  // 루트 설정 상속
  ...rootConfig,

  // 타입 패키지 특화 규칙
  {
    files: ['**/*.ts'],
    rules: {
      // 타입 정의 파일에서는 사용하지 않는 변수 허용
      '@typescript-eslint/no-unused-vars': 'off',

      // 인터페이스 선호
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

      // 타입 import 사용
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          disallowTypeAnnotations: true,
        },
      ],
    },
  },
];
