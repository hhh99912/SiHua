import { ref } from 'vue';
import { isElectron } from './platform';

/**
 * SCADA 工业大屏常亮与防熄屏控制器
 * 专治：
 * 1. 凝思安全系统 (Linx OS 4.9.x) X11 DPMS 硬件空闲超时黑屏 (即使系统设为永不休眠仍会关屏)
 * 2. Chromium / Web 端长时间无键鼠交互导致的屏幕睡眠 (Screen WakeLock API)
 * 3. 现场无人值守监控台长时间监视保障
 */
export const isStayAwakeActive = ref<boolean>(true);
export const stayAwakeMessage = ref<string>('常亮防护已激活 (永不熄屏 / 防DPMS)');

let wakeLockSentinel: any = null;

// 请求 Web Screen WakeLock
export async function requestWebWakeLock(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        // 如果被意外释放且状态仍为开启，在下个微任务尝试重新获取
        if (isStayAwakeActive.value) {
          setTimeout(requestWebWakeLock, 1000);
        }
      });
      isStayAwakeActive.value = true;
      stayAwakeMessage.value = '工业常亮防护中 (Web WakeLock 已锁定)';
      return true;
    } catch (err: any) {
      console.warn('[SCADA StayAwake] Web WakeLock 请求失败或不受支持:', err?.message);
    }
  }
  return false;
}

// 释放 Web Screen WakeLock
export async function releaseWebWakeLock(): Promise<void> {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {}
    wakeLockSentinel = null;
  }
}

// 初始化全局常亮守护服务
export async function initStayAwakeService(): Promise<void> {
  // 1. Electron 桌面端原生 powerSaveBlocker 与 Linux X11 DPMS 禁用
  if (isElectron() && (window as any).electronAPI?.power) {
    try {
      const res = await (window as any).electronAPI.power.getStayAwake();
      if (res?.success) {
        isStayAwakeActive.value = res.stayAwake;
        stayAwakeMessage.value = res.isLinxLinux
          ? '凝思工业常亮锁定中 (已禁DPMS与X11熄屏)'
          : '桌面常亮保护已激活 (powerSaveBlocker)';
      }
    } catch (e) {
      console.warn('[SCADA StayAwake] 查询 Electron 常亮状态异常:', e);
    }
  }

  // 2. 浏览器 Web WakeLock API 保底
  await requestWebWakeLock();

  // 3. 页面可见性改变（如窗口最小化恢复或切回）时自动重新申请常亮锁
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isStayAwakeActive.value) {
        requestWebWakeLock();
      }
    });
  }
}

// 手动切换常亮开关
export async function toggleStayAwake(): Promise<boolean> {
  const nextState = !isStayAwakeActive.value;
  isStayAwakeActive.value = nextState;

  if (isElectron() && (window as any).electronAPI?.power) {
    try {
      const res = await (window as any).electronAPI.power.setStayAwake(nextState);
      if (res?.success) {
        isStayAwakeActive.value = res.stayAwake;
      }
    } catch (e) {
      console.warn('[SCADA StayAwake] 设置 Electron 常亮状态失败:', e);
    }
  }

  if (nextState) {
    await requestWebWakeLock();
    stayAwakeMessage.value = '常亮防护已激活 (永不熄屏 / 防DPMS)';
  } else {
    await releaseWebWakeLock();
    stayAwakeMessage.value = '常亮保护已停用 (遵循系统默认节能策略)';
  }

  return isStayAwakeActive.value;
}
