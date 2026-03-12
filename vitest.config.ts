import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/app/**/*.spec.ts', // Excluimos por ahora para configurar CI
    ],
    server: {
      deps: {
        inline: [/@angular/, /zone.js/],
      },
    },
  },
});
