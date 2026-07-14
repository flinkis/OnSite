/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_MODE?: string;
  readonly VITE_VERCEL_TARGET_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
