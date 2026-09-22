import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * The shared CRDT package is a build for anyone who installs it and the source
 * for the editor it lives in (PB-120).  Without this alias the editor gets
 * both — half its files import it by name, half by path — and two copies of
 * the module mean two sets of Yjs types, which fails as "Unexpected content
 * type" the moment a document is decoded.
 */
const sharedPackage = { '@plastic-io/graph-crdt': resolve(__dirname, 'packages/GraphCrdt/main.ts') };
import vue from '@vitejs/plugin-vue';

/** Store-level integration tests: real Pinia stores, jsdom, fake providers. */
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: sharedPackage },
  test: {
    include: ['packages/**/__integration__/**/*.spec.ts'],
    environment: 'jsdom',
    server: {
      deps: {
        inline: ['vuetify'],
      },
    },
  },
});
