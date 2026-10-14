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
      '.agents/**',
      '.codex/**',
      '.aws/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.mjs', 'apps/backend/**/*.ts', 'apps/frontend/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/frontend/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
