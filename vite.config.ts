import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [angular(), tsConfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    pool: 'forks',
    include: ['src/**/*.spec.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/app/**/*.spec.ts', // Excluimos por ahora mientras se definen los providers de cada componente
    ],
  },
});
