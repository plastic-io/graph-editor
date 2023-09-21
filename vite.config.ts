import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify';
import { resolve } from 'path';

export default defineConfig((mode) => {
  return {
    base: '/graph-editor/',
    server: {
      port: 8080,
    },
    plugins: [
      vue({
        template: { transformAssetUrls },
      }),
      vuetify(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        './runtimeConfig': './runtimeConfig.browser',
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      coverage: {
        all: true,
        provider: 'c8',
        exclude: [
          '**/node_modules/**', // Exclude files in the 'node_modules' directory
          '**/coverage/**', // Exclude files in the 'coverage' directory
          '**/__mocks__/**', // Exclude files in mocks directory
          '**/__tests__/**', // Exclude files in mocks directory
          '**/*.config.{js,jsx,ts,tsx}', // Exclude config files
          '**/dist/**', // Exclude dist files
          '**/src/plugins/**', // Exclude vendor plugin files
          '.eslintrc.cjs', // eslint files
        ],
      },
    },
  };
});
