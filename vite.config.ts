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
    rollupOptions: {
      external: ['jszip']
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
        /**
         * The shared package is a build for anyone who installs it and the
         * source for the editor it lives in (PB-120).  Without this alias the
         * editor gets both — half its files import it by name and half by
         * path — and two copies of the CRDT module mean two sets of Yjs types,
         * which fails as "Unexpected content type" the moment a document is
         * decoded.
         */
        '@plastic-io/graph-crdt': resolve(__dirname, 'packages/GraphCrdt/main.ts'),

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
