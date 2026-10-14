import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '.npm-cache/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '.agents/**',
      '.codex/**',
      '.aws/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: [
      '**/*.mjs',
      'apps/backend/**/*.ts',
      'apps/frontend/vite.config.ts',
      'e2e/**/*.ts',
      'playwright.config.ts',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
    },
  },
  {
    files: ['docker/mongodb/*.js'],
    languageOptions: { globals: { ...globals.node, db: 'readonly' } },
  },
  {
    files: ['apps/frontend/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
