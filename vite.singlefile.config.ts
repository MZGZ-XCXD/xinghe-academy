import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/**
 * 单文件打包配置：产出一个不含任何外部资源的 HTML（JS / CSS 全部内联）。
 * 这样可以直接双击打开（file:// 协议），也可以拷到 U 盘、发给自己。
 */
export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2019',
    outDir: 'dist-single',
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        // 关键：用 IIFE 而不是 ES module，file:// 下不会被 CORS 拦掉
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
})
