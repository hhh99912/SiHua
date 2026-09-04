import { ElectronSystemInfo } from '../types/electron';

/**
 * Platform Detection & Compatibility Layer
 * Supports Web Browser, Windows Desktop, and Linux Desktop
 */

export const isElectron = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (window.electronAPI?.isElectron) return true;
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().includes('electron/')) {
    return true;
  }
  return false;
};

export const getSystemInfo = async (): Promise<ElectronSystemInfo | null> => {
  if (isElectron() && window.electronAPI) {
    try {
      return await window.electronAPI.getSystemInfo();
    } catch {
      return null;
    }
  }
  return null;
};

export type PlatformCategory = 'windows' | 'linux' | 'macos' | 'web';

export const detectPlatform = (): PlatformCategory => {
  if (isElectron()) {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('linux')) return 'linux';
    if (userAgent.includes('mac')) return 'macos';
  }
  return 'web';
};

/**
 * Universal Project Exporter (Cross-Platform)
 * Desktop (Win/Linux): Native Save Dialog with direct disk writing
 * Web: Browser Blob Download
 */
export const exportProjectFile = async (
  content: string, 
  defaultFilename: string = 'scada-bigscreen-project.json'
): Promise<{ success: boolean; path?: string; message?: string }> => {
  if (isElectron() && window.electronAPI) {
    try {
      const res = await window.electronAPI.saveFile({
        data: content,
        defaultName: defaultFilename,
        filters: [{ name: 'SCADA Project File (*.json)', extensions: ['json'] }]
      });
      if (res.success) {
        return { success: true, path: res.filePath, message: `已保存至本地: ${res.filePath}` };
      } else if (res.canceled) {
        return { success: false, message: '已取消保存' };
      } else {
        throw new Error(res.error || '保存失败');
      }
    } catch (e: any) {
      // Fallback to web download if IPC fails
      console.warn('Native save failed, falling back to browser download:', e);
    }
  }

  // Standard Web Download
  try {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, message: '已通过浏览器下载工程文件' };
  } catch (err: any) {
    return { success: false, message: err?.message || '下载失败' };
  }
};

/**
 * Universal Project Importer (Cross-Platform)
 * Desktop (Win/Linux): Native Open File Dialog
 * Web: HTML5 File Input
 */
export const importProjectFile = async (): Promise<{ success: boolean; data?: any; filename?: string; error?: string }> => {
  if (isElectron() && window.electronAPI) {
    try {
      const res = await window.electronAPI.openFile({
        filters: [{ name: 'SCADA Project (*.json)', extensions: ['json', 'txt'] }]
      });
      if (res.success && res.content) {
        const parsed = JSON.parse(res.content);
        return { success: true, data: parsed, filename: res.filePath };
      } else if (res.canceled) {
        return { success: false, error: '用户取消选择' };
      }
    } catch (e: any) {
      console.warn('Native open file failed, falling back to input:', e);
    }
  }

  // Web File Picker Fallback
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';

    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) {
        resolve({ success: false, error: '未选择任何文件' });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const raw = event.target?.result as string;
          const parsed = JSON.parse(raw);
          resolve({ success: true, data: parsed, filename: file.name });
        } catch (err: any) {
          resolve({ success: false, error: 'JSON 解析失败: ' + err.message });
        }
      };
      reader.onerror = () => {
        resolve({ success: false, error: '读取文件失败' });
      };
      reader.readAsText(file);
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
};

/**
 * Window Controls
 */
export const windowMinimize = async () => {
  if (isElectron() && window.electronAPI) {
    await window.electronAPI.minimize();
  }
};

export const windowMaximize = async () => {
  if (isElectron() && window.electronAPI) {
    await window.electronAPI.maximize();
  }
};

export const windowClose = async () => {
  if (isElectron() && window.electronAPI) {
    await window.electronAPI.close();
  }
};

export const windowToggleFullscreen = async (): Promise<boolean> => {
  if (isElectron() && window.electronAPI) {
    return await window.electronAPI.toggleFullscreen();
  } else {
    // Browser Fullscreen API
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      return true;
    } else {
      await document.exitFullscreen().catch(() => {});
      return false;
    }
  }
};
