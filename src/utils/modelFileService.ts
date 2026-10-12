import { isElectron } from './platform';

export interface DiskModelItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  version?: string;
  updatedAt?: string;
  filename?: string;
  screen: any;
  components: any[];
  datasets?: any[];
}

const LOCAL_STORAGE_MODELS_CACHE = 'ge_scada_models_cache_v2';

function saveToLocalCache(models: DiskModelItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_MODELS_CACHE, JSON.stringify(models));
  } catch {}
}

function getLocalCacheModels(): DiskModelItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MODELS_CACHE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}
  return [];
}

/**
 * 项目启动或需要时：检索并加载 model/ 目录下的所有模板 JSON 文件
 * 严格依据 model/ 目录磁盘文件，空目录时返回空列表
 */
export async function loadTemplatesFromDisk(): Promise<{
  success: boolean;
  models: DiskModelItem[];
  storageDir: string;
  count: number;
  files: string[];
  source: 'electron' | 'server' | 'local_fallback';
  error?: string;
}> {
  // 1. Electron 桌面环境
  if (isElectron()) {
    const electronModels = (typeof window !== 'undefined' && ((window as any).electronAPI?.models || (window as any).electron?.models));
    if (electronModels?.loadAll) {
      try {
        const res = await electronModels.loadAll();
        if (res && res.success && Array.isArray(res.models)) {
          saveToLocalCache(res.models);
          return {
            success: true,
            models: res.models,
            storageDir: res.storageDir || 'model',
            count: res.models.length,
            files: res.files || [],
            source: 'electron'
          };
        }
      } catch (err) {
        console.warn('[ModelFileService] Electron 读取 model 目录异常:', err);
      }
    }
  }

  // 2. Web 开发/服务器环境：请求后端接口 /api/templates
  try {
    const response = await fetch('/api/templates', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.success && Array.isArray(data.models)) {
        saveToLocalCache(data.models);
        return {
          success: true,
          models: data.models,
          storageDir: data.storageDir || 'model',
          count: data.models.length,
          files: data.files || [],
          source: 'server'
        };
      }
    }
  } catch (err) {
    console.warn('[ModelFileService] 请求 /api/templates 失败:', err);
  }

  // 3. 兜底本地缓存或空列表（完全依据实际 model 存储，无虚构模板）
  const cached = getLocalCacheModels();
  return {
    success: true,
    models: cached,
    storageDir: 'model',
    count: cached.length,
    files: cached.map(m => m.filename || `${m.name}.json`),
    source: 'local_fallback'
  };
}

/**
 * 将某个画面作为模板保存到 model/<name>.json
 */
export async function saveTemplateToDisk(templateData: {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  screen: any;
  components: any[];
  datasets?: any[];
}): Promise<{
  success: boolean;
  filename?: string;
  name?: string;
  model?: DiskModelItem;
  error?: string;
}> {
  const trimmedName = (templateData.name || '').trim();
  if (!trimmedName) {
    return { success: false, error: '模板名称不能为空' };
  }

  // 1. Electron 原生环境
  if (isElectron()) {
    if ((window as any).electronAPI?.models?.saveOne) {
      try {
        const res = await (window as any).electronAPI.models.saveOne(templateData);
        if (res && res.success) {
          return res;
        }
      } catch (err: any) {
        console.warn('[ModelFileService] Electron 保存模板失败:', err);
      }
    }
  }

  // 2. Web 环境通过后端 /api/templates/save 写入
  try {
    const response = await fetch('/api/templates/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData)
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.success) {
        return data;
      }
      return { success: false, error: data?.error || '服务端保存模板失败' };
    }
    const errText = await response.text();
    return { success: false, error: `保存模板失败 (${response.status}): ${errText}` };
  } catch (err: any) {
    console.warn('[ModelFileService] 请求 /api/templates/save 失败:', err);
    // 离线更新本地缓存
    const list = getLocalCacheModels().filter(m => m.name !== trimmedName);
    const newModel: DiskModelItem = {
      id: `model-${Date.now()}`,
      name: trimmedName,
      description: templateData.description || '自定义模板',
      category: templateData.category || '自定义模板',
      tags: templateData.tags || ['自定义模板'],
      version: '2.0.0',
      updatedAt: new Date().toISOString(),
      filename: `${trimmedName}.json`,
      screen: templateData.screen,
      components: templateData.components || []
    };
    list.unshift(newModel);
    saveToLocalCache(list);
    return { success: true, name: trimmedName, filename: `${trimmedName}.json`, model: newModel };
  }
}

/**
 * 删除 model/ 目录下的指定模板
 */
export async function deleteTemplateFromDisk(name: string): Promise<{ success: boolean; error?: string }> {
  // 1. Electron 原生环境
  if (isElectron()) {
    if ((window as any).electronAPI?.models?.deleteOne) {
      try {
        const res = await (window as any).electronAPI.models.deleteOne(name);
        if (res && res.success) {
          return res;
        }
      } catch (err: any) {
        console.warn('[ModelFileService] Electron 删除模板失败:', err);
      }
    }
  }

  // 2. Web 环境通过后端 /api/templates 删除
  try {
    const response = await fetch(`/api/templates?name=${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return { success: false, error: `删除失败 (${response.status})` };
  } catch (err: any) {
    return { success: false, error: err?.message || '删除模板异常' };
  }
}
