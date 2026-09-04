import { ScreenItem } from '../types';
import { isElectron } from './platform';

export interface DiskFileInfo {
  filename: string;
  screenName: string;
  sizeBytes: number;
  updatedAt: string;
  isValid?: boolean;
  reason?: string;
}

export interface DiskStorageConfig {
  storageDir: string;
  absolutePath: string;
  fileCount: number;
  files: DiskFileInfo[];
  indexScreen?: {
    indexScreenName: string;
    indexScreenId: string;
  };
}

const LOCAL_STORAGE_CACHE_KEY = 'ge_scada_screens_cache_v3';

/**
 * 客户端大屏文件存储服务 (目录固定在可执行目录同级文件夹 graph 下)
 * 跨平台支持：
 * 1. Electron 桌面端原生文件系统读写
 * 2. Web 开发/生产环境基于后端 /api/screens 磁盘文件操作
 * 3. 离线/只读环境兜底降级到 localStorage
 */

/**
 * 每次启动/刷新时调用：从 graph 磁盘路径读取所有合理的大屏 JSON 文件
 */
export async function loadScreensFromDisk(): Promise<{
  success: boolean;
  screens: ScreenItem[];
  storageDir: string;
  count: number;
  files: string[];
  source: 'electron' | 'server' | 'local_fallback';
  indexScreen?: { indexScreenName: string; indexScreenId: string };
  error?: string;
}> {
  // 1. Electron 桌面环境：通过 IPC 直接调用主进程读取本地系统路径
  if (isElectron()) {
    if (window.electronAPI?.screens?.loadAll) {
      try {
        const res = await window.electronAPI.screens.loadAll();
        if (res && res.success && Array.isArray(res.screens) && res.screens.length > 0) {
          saveToLocalCache(res.screens);
          let indexScreen = { indexScreenName: '', indexScreenId: '' };
          try {
            if (window.electronAPI?.screens?.getIndexScreen) {
              indexScreen = await window.electronAPI.screens.getIndexScreen();
            }
          } catch {}
          return {
            success: true,
            screens: res.screens,
            storageDir: res.storageDir || 'graph',
            count: res.screens.length,
            files: res.files || [],
            source: 'electron',
            indexScreen
          };
        }
      } catch (err: any) {
        console.warn('[ScreenFileService] Electron 读取 graph 目录异常，尝试回退到本地缓存:', err);
      }
    }
    // Electron 环境下不向相对路径 /api/screens 发起网络请求（避免 file:/// 协议报错）
  } else {
    // 2. Web 浏览器/服务器环境：请求后端磁盘存储接口 /api/screens
    try {
      const response = await fetch('/api/screens', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.success && Array.isArray(data.screens) && data.screens.length > 0) {
          saveToLocalCache(data.screens);
          return {
            success: true,
            screens: data.screens,
            storageDir: data.storageDir || 'graph',
            count: data.screens.length,
            files: data.files || [],
            source: 'server',
            indexScreen: data.indexScreen
          };
        }
      }
    } catch (err: any) {
      console.warn('[ScreenFileService] 请求服务端大屏接口失败，将使用本地缓存:', err);
    }
  }

  // 3. 兜底回退：尝试从本地 localStorage 缓存中恢复
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          success: true,
          screens: parsed,
          storageDir: 'graph (本地离线缓存)',
          count: parsed.length,
          files: parsed.map(s => `${s.name}.json`),
          source: 'local_fallback'
        };
      }
    }
  } catch {}

  return {
    success: false,
    screens: [],
    storageDir: 'graph',
    count: 0,
    files: [],
    source: 'local_fallback',
    error: '未能从 graph 目录读取到有效大屏文件'
  };
}

/**
 * 获取用户登录成功后的主索引大屏配置
 */
export async function getIndexScreen(): Promise<{ indexScreenName: string; indexScreenId: string }> {
  if (isElectron()) {
    if (window.electronAPI?.screens?.getIndexScreen) {
      try {
        const res = await window.electronAPI.screens.getIndexScreen();
        if (res) return res;
      } catch {}
    }
    return { indexScreenName: '', indexScreenId: '' };
  }

  try {
    const res = await fetch('/api/screens/index-screen');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return {
          indexScreenName: data.indexScreenName || '',
          indexScreenId: data.indexScreenId || ''
        };
      }
    }
  } catch {}

  return { indexScreenName: '', indexScreenId: '' };
}

/**
 * 设置用户登录成功后的主索引大屏配置
 */
export async function setIndexScreen(
  indexScreenName: string,
  indexScreenId: string
): Promise<{ success: boolean; error?: string }> {
  if (isElectron()) {
    if (window.electronAPI?.screens?.setIndexScreen) {
      try {
        const payload = JSON.parse(JSON.stringify({ indexScreenName, indexScreenId }));
        return await window.electronAPI.screens.setIndexScreen(payload);
      } catch (e: any) {
        return { success: false, error: e?.message };
      }
    }
    return { success: false, error: 'Electron 环境未找到配置接口' };
  }

  try {
    const res = await fetch('/api/screens/index-screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indexScreenName, indexScreenId })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err: any) {
    return { success: false, error: err?.message };
  }

  return { success: false, error: '设置主索引大屏失败' };
}

/**
 * 仅保存当前选中的单个大屏到对应名称的 JSON 文件 (graph/<大屏名>.json)
 * 点击保存按钮时才触发同步保存当前这一个大屏
 */
export async function saveScreenToDisk(
  screen: ScreenItem,
  oldName?: string
): Promise<{ success: boolean; filename?: string; storageDir?: string; error?: string }> {
  if (!screen || !screen.name) {
    return { success: false, error: '大屏数据不完整' };
  }

  // 1. 消除 Vue 3 响应式 Proxy 和非克隆属性（彻底解决 Electron 结构化克隆 An object could not be cloned 异常）
  let cleanScreen: ScreenItem;
  let screenJsonStr = '';
  try {
    screenJsonStr = JSON.stringify(screen);
    cleanScreen = JSON.parse(screenJsonStr);
  } catch (err: any) {
    console.error('[ScreenFileService] 序列化大屏对象失败:', err);
    return { success: false, error: '大屏数据无法序列化为 JSON: ' + (err?.message || err) };
  }

  // 2. Electron 桌面环境：调用原生 IPC 写入文件系统
  if (isElectron()) {
    if (window.electronAPI?.screens?.saveOne) {
      try {
        const res = await window.electronAPI.screens.saveOne({
          screen: cleanScreen,
          screenJson: screenJsonStr,
          oldName: oldName ? String(oldName) : undefined
        });
        if (res && res.success) {
          return res;
        }
        return {
          success: false,
          error: res?.error || 'Electron 保存单屏失败'
        };
      } catch (err: any) {
        console.error('[ScreenFileService] Electron 保存单屏失败:', err);
        return {
          success: false,
          error: 'Electron 保存失败: ' + (err?.message || err)
        };
      }
    }
    return { success: false, error: '未找到 Electron 保存接口' };
  }

  // 3. Web 服务端环境 (浏览器开发/生产部署)
  try {
    const response = await fetch('/api/screens/save-one', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen: cleanScreen, oldName })
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
    const errText = await response.text().catch(() => '');
    return { success: false, error: `服务端保存失败: ${response.status} ${errText}` };
  } catch (err: any) {
    console.warn('[ScreenFileService] 服务端保存单屏请求失败:', err);
    return { success: false, error: '保存请求失败: ' + (err?.message || err) };
  }
}

/**
 * 删除指定大屏名称对应的 JSON 文件
 */
export async function deleteScreenFromDisk(
  screenName: string
): Promise<{ success: boolean; filename?: string; error?: string }> {
  if (!screenName) return { success: false };

  // 1. Electron 桌面环境
  if (isElectron()) {
    if (window.electronAPI?.screens?.deleteOne) {
      try {
        return await window.electronAPI.screens.deleteOne(String(screenName));
      } catch (e: any) {
        return { success: false, error: e?.message };
      }
    }
    return { success: false, error: 'Electron 删除接口未找到' };
  }

  // 2. Web 服务端环境
  try {
    const response = await fetch(`/api/screens?name=${encodeURIComponent(screenName)}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      return await response.json();
    }
  } catch {}

  return { success: false };
}

/**
 * 获取系统当前存储路径与大屏文件列表信息
 */
export async function getDiskStorageConfig(): Promise<DiskStorageConfig> {
  // 1. Electron
  if (isElectron()) {
    if (window.electronAPI?.screens?.getConfig) {
      try {
        const res = await window.electronAPI.screens.getConfig();
        if (res) return res;
      } catch {}
    }
    return {
      storageDir: 'graph',
      absolutePath: 'graph',
      fileCount: 0,
      files: []
    };
  }

  // 2. Web 服务端
  try {
    const res = await fetch('/api/screens/config');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return {
          storageDir: data.storageDir || 'graph',
          absolutePath: data.absolutePath || 'graph',
          fileCount: data.fileCount || 0,
          files: data.files || [],
          indexScreen: data.indexScreen
        };
      }
    }
  } catch {}

  return {
    storageDir: 'graph',
    absolutePath: 'graph',
    fileCount: 0,
    files: []
  };
}

/**
 * 在系统文件资源管理器中打开存储目录 (Electron 专属)
 */
export async function openDiskStorageDir(): Promise<boolean> {
  if (isElectron() && window.electronAPI?.screens?.openDir) {
    const res = await window.electronAPI.screens.openDir();
    return !!res.success;
  }
  return false;
}

/**
 * 强制重置/写入预设大屏文件
 */
export async function resetPresetScreensOnDisk(): Promise<{ success: boolean; screens: ScreenItem[] }> {
  try {
    const res = await fetch('/api/screens/reset-presets', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      return { success: true, screens: data.screens || [] };
    }
  } catch {}
  return { success: false, screens: [] };
}

function saveToLocalCache(screens: ScreenItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(screens));
  } catch {}
}
