import { createApp } from 'vue';
import App from './App.vue';
import './index.css';

// Suppress benign browser ResizeObserver loop informational notifications
window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (
    typeof msg === 'string' &&
    (msg.includes('ResizeObserver loop completed with undelivered notifications') ||
      msg.includes('ResizeObserver loop limit exceeded'))
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

import { initStayAwakeService } from './utils/stayAwake';

const app = createApp(App);

// Global v-focus directive
app.directive('focus', {
  mounted(el) {
    el.focus();
  }
});

app.mount('#app');

// 默认开启工业防熄屏与屏幕常亮守护
initStayAwakeService().catch(() => {});

// 消除白屏核心机制：在 Vue 挂载首帧完成且经由 requestAnimationFrame 准备提交后通知 Electron 主进程呼出窗口
if (typeof window !== 'undefined' && (window as any).electronAPI?.notifyAppReady) {
  requestAnimationFrame(() => {
    try {
      (window as any).electronAPI.notifyAppReady();
    } catch {}
  });
}
