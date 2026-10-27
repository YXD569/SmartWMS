import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 项目根：smartwms/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    open: false,
    // 所有 /api 请求代理到本机 mock 服务（server/index.js，端口 48081）
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:48081',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        // 按生态拆包，避免单 chunk 过大
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          element: ['element-plus', '@element-plus/icons-vue'],
          echarts: ['echarts'],
          markdown: ['markdown-it', 'highlight.js']
        }
      }
    }
  }
})
