/// <reference types="vite/client" />

/**
 * Vuetify ships this as an ESM module without declarations, and several
 * packages read the palette from it.
 */
declare module "vuetify/lib/util/colors" {
  const colors: Record<string, Record<string, string>>;
  export default colors;
}

/**
 * Loaded from a script tag in index.html, not from the bundle, so it exists
 * as a global rather than as an import.
 */
declare const JSZip: any;

/**
 * bezier-js ships no declarations of its own.
 */
declare module "bezier-js" {
  const Bezier: any;
  export {Bezier};
  export default Bezier;
}

interface Window {
  /** The editor hands the running graph its own handle on this. */
  plastic: any;
}

/** Values are fixed by the provider build configuration. */
declare const __AUTH_CONFIG__: Record<string, any>;
declare module '@graph/auth-provider' {
  const Provider: new (config: Record<string, any>, app: any, router: any) => any;
  export default Provider;
}

declare const __DEPLOYMENT_CONFIG__: Record<string, any>;
