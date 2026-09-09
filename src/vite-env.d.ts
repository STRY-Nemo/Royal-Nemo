/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the STRY alliance API (server/). Empty = local demo mode. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
