import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: '/static/react/',
  build: {outDir: 'dist', emptyOutDir: true},
  test: {environment: 'jsdom', restoreMocks: true, include: ['src/tests/**/*.test.tsx'], exclude: ['playwright/**']}
});
