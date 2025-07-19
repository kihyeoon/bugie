const rootConfig = require('../../eslint.config.js');

module.exports = [
  // 루트 설정 상속
  ...rootConfig,

  // UI 컴포넌트 특화 규칙
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // 컴포넌트는 export 필수
      'import/prefer-default-export': 'off',

      // Props 인터페이스 네이밍
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: {
            regex: '^I[A-Z]',
            match: false,
          },
        },
      ],
    },
  },
];
