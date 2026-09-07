import { DatasetItem } from '../types';
import { isElectron } from './platform';
import { INITIAL_DATASETS } from '../data/presetDatasets';

export interface DatasetDiskResponse {
  success: boolean;
  datasets: DatasetItem[];
  files: string[];
  storageDir?: string;
  error?: string;
}

export interface SaveDatasetResponse {
  success: boolean;
  filename?: string;
  dataset?: DatasetItem;
  error?: string;
}

/**
 * 启动时与运行时：从 data 目录下检索并读取所有数据集 JSON 文件
 */
export async function fetchAllDatasetsFromDisk(): Promise<DatasetItem[]> {
  // 1. Electron 桌面环境：直接通过 IPC 读取 data/ 目录
  if (isElectron()) {
    if ((window as any).electronAPI?.datasets?.loadAll) {
      try {
        const res = await (window as any).electronAPI.datasets.loadAll();
        if (res && res.success && Array.isArray(res.datasets) && res.datasets.length > 0) {
          return res.datasets;
        }
      } catch (err) {
        console.warn('[DatasetService] Electron 读取 data/ 目录异常:', err);
      }
    }
  }

  // 2. Web 开发与云端服务模式：请求 /api/data 接口
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const data: DatasetDiskResponse = await res.json();
      if (data.success && Array.isArray(data.datasets) && data.datasets.length > 0) {
        return data.datasets;
      }
    }
  } catch (err) {
    console.warn('[DatasetService] 请求 /api/data 异常:', err);
  }

  return [...INITIAL_DATASETS];
}

/**
 * 保存单个数据集至 data/<name>.json 文件
 */
export async function saveDatasetToDisk(dataset: DatasetItem): Promise<SaveDatasetResponse> {
  // 1. Electron 环境
  if (isElectron()) {
    if ((window as any).electronAPI?.datasets?.saveOne) {
      try {
        const res = await (window as any).electronAPI.datasets.saveOne(dataset);
        if (res && res.success) {
          return res;
        }
      } catch (err: any) {
        console.warn('[DatasetService] Electron 保存数据集异常:', err);
      }
    }
  }

  // 2. Web 接口
  try {
    const res = await fetch('/api/data/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataset)
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message || '保存数据集失败' };
  }
}

/**
 * 删除指定的数据集文件
 */
export async function deleteDatasetFromDisk(identifier: string): Promise<{ success: boolean; error?: string }> {
  if (isElectron()) {
    if ((window as any).electronAPI?.datasets?.deleteOne) {
      try {
        return await (window as any).electronAPI.datasets.deleteOne(identifier);
      } catch (err: any) {
        return { success: false, error: err.message || '删除数据集异常' };
      }
    }
  }

  try {
    const res = await fetch(`/api/data/${encodeURIComponent(identifier)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      return await res.json();
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message || '删除数据集异常' };
  }
}
