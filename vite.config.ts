import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig } from 'vite';
import { scadaScreensPlugin } from './src/server/vitePluginScadaScreens';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [vue(), scadaScreensPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'chrome93', // 确保构建产物完全兼容 Electron 14 (Chromium 93)
      cssTarget: 'chrome93',
      minify: 'esbuild',
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

