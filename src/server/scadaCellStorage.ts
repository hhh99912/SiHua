import fs from 'fs';
import path from 'path';
import { sanitizeScreenFilename } from './scadaScreenStorage';
import { PRESET_CELL_DEFINITIONS } from '../data/presetCellDefinitions';

/**
 * 获取可执行根目录（支持 Electron 与 Node/Web 环境）
 */
const getExecutableRootDir = (): string => {
  if (typeof process !== 'undefined') {
    if ((process as any).versions?.electron && (global as any).app?.isPackaged) {
      return path.dirname(process.execPath);
    }
  }
  return process.cwd();
};

/**
 * 图元独立存储目录：与 graph、model 同级的 cell 目录
 */
export const CELL_DIR = path.resolve(getExecutableRootDir(), 'cell');

/**
 * 0边距紧致裁剪函数：确保所有子组件与外边框距离为 0
 */
export function normalizeSymbolZeroMargin(symbol: any): any {
  if (!symbol) return symbol;
  const cloned = JSON.parse(JSON.stringify(symbol));

  const allChildren: any[] = [];
  if (Array.isArray(cloned.states)) {
    cloned.states.forEach((st: any) => {
      if (Array.isArray(st.children)) {
        allChildren.push(...st.children);
      }
    });
  }
  if (Array.isArray(cloned.children)) {
    allChildren.push(...cloned.children);
  }

  if (allChildren.length === 0) {
    return cloned;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const c of allChildren) {
    const x = typeof c.x === 'number' ? c.x : 0;
    const y = typeof c.y === 'number' ? c.y : 0;
    const w = typeof c.width === 'number' ? c.width : 10;
    const h = typeof c.height === 'number' ? c.height : 10;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  }

  if (minX === Infinity || maxX === -Infinity) return cloned;

  const symbolWidth = Math.max(10, Math.round(maxX - minX));
  const symbolHeight = Math.max(10, Math.round(maxY - minY));

  const shiftChild = (c: any) => {
    c.x = Math.round((c.x || 0) - minX);
    c.y = Math.round((c.y || 0) - minY);
    // 彻底清除任何可能残留的特殊闸符字符
    if (c.type === 'draw-text' && c.customProps?.text) {
      c.customProps.text = String(c.customProps.text).replace(/[\u23DA-\u23FF\u2390-\u23CF]/g, '').trim();
    }
  };

  if (Array.isArray(cloned.states)) {
    cloned.states.forEach((st: any) => {
      if (Array.isArray(st.children)) {
        st.children.forEach(shiftChild);
      }
    });
  }
  if (Array.isArray(cloned.children)) {
    cloned.children.forEach(shiftChild);
  }

  cloned.defaultWidth = symbolWidth;
  cloned.defaultHeight = symbolHeight;
  cloned.type = 'composite-symbol';

  return cloned;
}

/**
 * 确保 cell 目录存在，并在为空或强制模式下写入规范化预设图元
 */
export function ensureCellDirectory(force = false): string[] {
  if (!fs.existsSync(CELL_DIR)) {
    fs.mkdirSync(CELL_DIR, { recursive: true });
  }

  const createdFiles: string[] = [];

  try {
    const existing = fs.readdirSync(CELL_DIR).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
    if (existing.length === 0 || force) {
      for (const rawDef of PRESET_CELL_DEFINITIONS) {
        // 对每个图元执行严格的 0 边距归一化处理
        const def = normalizeSymbolZeroMargin(rawDef);
        const filename = `${sanitizeScreenFilename(def.name)}.json`;
        const filePath = path.join(CELL_DIR, filename);

        if (!fs.existsSync(filePath) || force) {
          const fileData = {
            ...def,
            filename,
            updatedAt: new Date().toISOString()
          };
          fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf-8');
          createdFiles.push(filename);
        }
      }
      console.log(`[CellStorage] 成功在 ${CELL_DIR} 初始化 ${createdFiles.length} 个规范化图元文件`);
    }
  } catch (err) {
    console.error('[CellStorage] 初始化 cell 目录失败:', err);
  }

  return createdFiles;
}

/**
 * 从 cell 目录检索所有图元 JSON
 */
export function loadAllCellsFromDisk(): {
  success: boolean;
  cells: any[];
  count: number;
  storageDir: string;
  error?: string;
} {
  ensureCellDirectory(false);

  try {
    if (!fs.existsSync(CELL_DIR)) {
      return { success: true, cells: [], count: 0, storageDir: CELL_DIR };
    }

    const files = fs.readdirSync(CELL_DIR).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
    const cells: any[] = [];

    for (const filename of files) {
      const fullPath = path.join(CELL_DIR, filename);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed && (parsed.id || parsed.name)) {
          // 读取时确保 0 边距规范化
          const normalized = normalizeSymbolZeroMargin(parsed);
          normalized.filename = filename;
          cells.push(normalized);
        }
      } catch (e: any) {
        console.warn(`[CellStorage] 读取图元文件失败: ${filename}`, e.message);
      }
    }

    // 按类别和名称排序
    cells.sort((a, b) => {
      const catOrder = (cat?: string) => {
        if (cat === 'electrical') return 1;
        if (cat === 'industrial') return 2;
        if (cat === 'basic') return 3;
        return 4;
      };
      const diff = catOrder(a.category) - catOrder(b.category);
      if (diff !== 0) return diff;
      return (a.name || '').localeCompare(b.name || '', 'zh-CN');
    });

    return {
      success: true,
      cells,
      count: cells.length,
      storageDir: CELL_DIR
    };
  } catch (err: any) {
    console.error('[CellStorage] 加载 cell 目录失败:', err);
    return {
      success: false,
      cells: [],
      count: 0,
      storageDir: CELL_DIR,
      error: err.message || '加载图元失败'
    };
  }
}

/**
 * 保存单个图元到 cell/<name>.json
 */
export function saveCellToDisk(cellData: any): {
  success: boolean;
  filename?: string;
  error?: string;
} {
  if (!cellData || !cellData.name) {
    return { success: false, error: '图元名称不能为空' };
  }

  try {
    ensureCellDirectory(false);

    // 0边距归一化
    const normalized = normalizeSymbolZeroMargin(cellData);
    const filename = `${sanitizeScreenFilename(normalized.name.trim())}.json`;
    const fullPath = path.join(CELL_DIR, filename);

    const payloadToSave = {
      ...normalized,
      id: normalized.id || `cell-${Date.now()}`,
      filename,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(fullPath, JSON.stringify(payloadToSave, null, 2), 'utf-8');
    return { success: true, filename };
  } catch (err: any) {
    console.error('[CellStorage] 保存图元失败:', err);
    return { success: false, error: err.message || '保存图元失败' };
  }
}

/**
 * 删除指定的图元文件
 */
export function deleteCellFromDisk(cellName: string): {
  success: boolean;
  error?: string;
} {
  if (!cellName) {
    return { success: false, error: '未指定图元名称' };
  }

  try {
    const filename = cellName.toLowerCase().endsWith('.json') 
      ? sanitizeScreenFilename(cellName.slice(0, -5)) + '.json'
      : `${sanitizeScreenFilename(cellName)}.json`;

    const fullPath = path.join(CELL_DIR, filename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return { success: true };
    }
    return { success: false, error: `图元文件未找到: ${filename}` };
  } catch (err: any) {
    console.error('[CellStorage] 删除图元失败:', err);
    return { success: false, error: err.message || '删除图元失败' };
  }
}
