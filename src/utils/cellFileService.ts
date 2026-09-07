import { CustomSymbolDef } from '../types';
import { isElectron } from './platform';

export interface CellDiskResponse {
  success: boolean;
  cells: CustomSymbolDef[];
  count: number;
  storageDir?: string;
  error?: string;
}

export interface SaveCellResponse {
  success: boolean;
  filename?: string;
  error?: string;
}

/**
 * 检索所有图元 JSON 文件（支持 Electron 原生磁盘读取与 Web API 接口）
 */
export async function fetchAllCellsFromDisk(): Promise<CustomSymbolDef[]> {
  // 1. Electron 桌面环境：直接调用 IPC 读取 cell/ 目录
  if (isElectron()) {
    if ((window as any).electronAPI?.cells?.loadAll) {
      try {
        const res = await (window as any).electronAPI.cells.loadAll();
        if (res && res.success && Array.isArray(res.cells)) {
          return res.cells;
        }
      } catch (err) {
        console.warn('[CellService] Electron 读取 cell/ 目录异常:', err);
      }
    }
  }

  // 2. Web 开发/服务端模式
  try {
    const res = await fetch('/api/cells');
    if (!res.ok) {
      console.warn(`[CellService] 获取图元列表失败 HTTP ${res.status}`);
      return [];
    }
    const data: CellDiskResponse = await res.json();
    if (data.success && Array.isArray(data.cells)) {
      return data.cells;
    }
    return [];
  } catch (err) {
    console.warn('[CellService] 请求 /api/cells 异常:', err);
    return [];
  }
}

/**
 * 保存单个图元至 cell/<name>.json 文件
 */
export async function saveCellToDisk(cell: CustomSymbolDef): Promise<SaveCellResponse> {
  // 1. Electron 桌面环境：直接通过 IPC 写入本地文件
  if (isElectron()) {
    if ((window as any).electronAPI?.cells?.saveOne) {
      try {
        const res = await (window as any).electronAPI.cells.saveOne(cell);
        if (res && res.success) {
          return res;
        }
      } catch (err: any) {
        console.warn('[CellService] Electron 保存图元异常:', err);
      }
    }
  }

  // 2. Web 服务端环境
  try {
    const res = await fetch('/api/cells/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cell)
    });
    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || '网络请求失败' };
  }
}

/**
 * 删除指定的图元文件
 */
export async function deleteCellFromDisk(cellName: string): Promise<{ success: boolean; error?: string }> {
  // 1. Electron 桌面环境：直接通过 IPC 删除文件
  if (isElectron()) {
    if ((window as any).electronAPI?.cells?.deleteOne) {
      try {
        const res = await (window as any).electronAPI.cells.deleteOne(cellName);
        if (res && res.success) {
          return res;
        }
      } catch (err: any) {
        console.warn('[CellService] Electron 删除图元异常:', err);
      }
    }
  }

  // 2. Web 服务端环境
  try {
    const res = await fetch(`/api/cells?name=${encodeURIComponent(cellName)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || '网络请求失败' };
  }
}
