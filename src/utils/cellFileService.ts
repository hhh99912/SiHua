import { CustomSymbolDef } from '../types';

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
 * 从服务端 /api/cells 接口检索所有图元 JSON 文件
 */
export async function fetchAllCellsFromDisk(): Promise<CustomSymbolDef[]> {
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
 * 保存单个图元至服务端 cell/<name>.json 文件
 */
export async function saveCellToDisk(cell: CustomSymbolDef): Promise<SaveCellResponse> {
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
