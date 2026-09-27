/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 서버(Lambda Function URL) 주소. 비어 있으면 목업으로 동작합니다 */
  readonly VITE_API_URL?: string;
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
