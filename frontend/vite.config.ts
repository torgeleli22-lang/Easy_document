import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages는 https://<user>.github.io/<repo>/ 아래에 서빙되므로
// base를 저장소 이름으로 맞춰야 자산 경로가 깨지지 않습니다.
export default defineConfig({
  base: '/Easy_document/',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // shared/ 가 frontend/ 바깥에 있어 dev 서버에서 읽을 수 있게 허용합니다.
    fs: { allow: ['..'] },
  },
});
