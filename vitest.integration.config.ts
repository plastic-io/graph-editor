import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

/** Store-level integration tests: real Pinia stores, jsdom, fake providers. */
export default defineConfig({
  plugins: [vue()],
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
