const rootConfig = require('../../eslint.config.js');
const nextPlugin = require('@next/eslint-plugin-next');

module.exports = [
  // 루트 설정 상속
  ...rootConfig,

  // Next.js 전용 규칙
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // Next.js 특화 규칙
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-img-element': 'warn',

      // Server Components에서 console 허용
      'no-console': 'off',
    },
  },

  // Next.js 특화 ignore 패턴
  {
    ignores: ['.next/**', 'out/**', 'public/**'],
  },
];
