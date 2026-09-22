/// <reference types="vite/client" />

/**
 * Vuetify ships this as an ESM module without declarations, and several
 * packages read the palette from it.
 */
declare module "vuetify/lib/util/colors" {
  const colors: Record<string, Record<string, string>>;
  export default colors;
}
