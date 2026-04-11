import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // ESM-native — matches the project's "type": "module"
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
