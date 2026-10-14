import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['test/integration/*.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 25000,
  },
});
