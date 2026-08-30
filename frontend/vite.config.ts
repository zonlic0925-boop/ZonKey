import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    // 手机兼容：老内核（微信 X5、旧 WebView）不支持 <script type="module">，
    // legacy 产物提供 SystemJS + core-js 回退；modernPolyfills 补齐
    // Chrome 80~118 时代内核缺失的运行时 API（Promise.withResolvers 等）。
    legacy({
      targets: ['chrome >= 61', 'edge >= 79', 'firefox >= 60', 'safari >= 11', 'ios_saf >= 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      modernPolyfills: [
        'es.promise.with-resolvers',
        'es.array.at',
        'es.object.has-own',
        'es.string.replace-all',
        'es.array.flat',
        'es.array.flat-map',
        'es.object.from-entries',
        'es.global-this',
      ],
      renderLegacyChunks: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: '../dist_web',
    emptyOutDir: true,
    target: 'es2018',
  }
})
