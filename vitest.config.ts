import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // The server integration test boots wrangler; run it via `npm run test:server`.
    exclude: ['server/**', 'node_modules/**'],
  },
});
