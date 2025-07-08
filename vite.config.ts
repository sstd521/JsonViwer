import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  //它告诉构建后的 HTML 文件，应该去 /JsonViwer/ 这个子目录里找 JS 和 CSS。
  base: '/JsonViwer/',
});
