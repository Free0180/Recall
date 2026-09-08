/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_PET_E2E_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css" {}
declare module "@fontsource-variable/inter" {}
declare module "@fontsource-variable/plus-jakarta-sans" {}
declare module "@fontsource-variable/jetbrains-mono" {}
