import { CustomSymbolDef } from '../types';
import { fetchAllCellsFromDisk, saveCellToDisk, deleteCellFromDisk } from './cellFileService';

export const STORAGE_KEY = 'ge_scada_custom_cells_v5';

/**
 * 0 边距紧致裁剪与归一化函数：
 * 计算图元所有状态中子组件的紧致包围盒 (minX, minY, maxX, maxY)，
 * 将全部子组件平移 (-minX, -minY)，并重设 defaultWidth 与 defaultHeight，
 * 确保图元内部几何原语与外围虚线/实线边框间隙严格为 0，并且清除任何闸符。
 */
export function normalizeSymbolZeroMargin(symbol: CustomSymbolDef): CustomSymbolDef {
  if (!symbol) return symbol;
  const cloned: CustomSymbolDef = JSON.parse(JSON.stringify(symbol));

  const allChildren: any[] = [];
  if (Array.isArray(cloned.states)) {
    cloned.states.forEach(st => {
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
    // 彻底移除可能残留的闸符特殊字符
    if (c.type === 'draw-text' && c.customProps?.text) {
      c.customProps.text = String(c.customProps.text).replace(/[\u23DA-\u23FF\u2390-\u23CF]/g, '').trim();
    }
  };

  if (Array.isArray(cloned.states)) {
    cloned.states.forEach(st => {
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

// 内存中缓存的图元列表
let inMemorySymbols: CustomSymbolDef[] | null = null;
let isDiskFetching = false;

/**
 * 启动时自动从 cell/ 目录检索所有图元 JSON，并与本地状态同步
 * 若 cell 目录为空，则自定义图元库严格显示为空
 */
export async function refreshCustomSymbolsFromDisk(): Promise<CustomSymbolDef[]> {
  if (isDiskFetching) {
    return inMemorySymbols ?? getCustomSymbols();
  }
  isDiskFetching = true;
  try {
    const diskCells = await fetchAllCellsFromDisk();
    const normalized = Array.isArray(diskCells) ? diskCells.map(normalizeSymbolZeroMargin) : [];
    inMemorySymbols = normalized;
    saveLocalCache(normalized);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scada:custom-symbols-updated', { detail: normalized }));
    }
    return normalized;
  } catch (err) {
    console.warn('[CellStorage] 从磁盘检索图元失败:', err);
  } finally {
    isDiskFetching = false;
  }
  return inMemorySymbols ?? getCustomSymbols();
}

/**
 * 保存到 localStorage 辅助函数
 */
function saveLocalCache(symbols: CustomSymbolDef[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
    }
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

/**
 * 获取图元列表（严格由 cell 磁盘文件与同步状态驱动，若为空则返回空数组）
 */
export function getCustomSymbols(): CustomSymbolDef[] {
  if (inMemorySymbols !== null) {
    return inMemorySymbols;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          inMemorySymbols = parsed.map(normalizeSymbolZeroMargin);
          // 异步触发一次磁盘刷新
          refreshCustomSymbolsFromDisk().catch(() => {});
          return inMemorySymbols;
        }
      }
    }
  } catch (e) {
    console.error('Failed to load custom symbols from localStorage:', e);
  }

  // 严格纯磁盘化：无任何硬编码预设图元强制回退，若 cell/ 目录为空则显示为空
  inMemorySymbols = [];
  // 异步从服务端 cell/ 目录检索
  refreshCustomSymbolsFromDisk().catch(() => {});
  return [];
}

/**
 * 保存全部图元列表（同时同步至 localStorage 与服务端 cell/ 目录）
 */
export function saveCustomSymbols(symbols: CustomSymbolDef[]) {
  const normalizedList = symbols.map(normalizeSymbolZeroMargin);
  inMemorySymbols = normalizedList;
  saveLocalCache(normalizedList);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('scada:custom-symbols-updated', { detail: normalizedList }));
  }

  // 异步将每个图元保存到 cell/ 目录
  for (const sym of normalizedList) {
    saveCellToDisk(sym).catch(err => {
      console.warn(`[CellStorage] 异步持久化图元 ${sym.name} 失败:`, err);
    });
  }
}

/**
 * 新增或更新单个图元
 */
export function addCustomSymbol(symbol: CustomSymbolDef): CustomSymbolDef[] {
  const normalized = normalizeSymbolZeroMargin(symbol);
  const list = [...getCustomSymbols()];
  const existingIdx = list.findIndex(s => s.id === normalized.id || s.name === normalized.name);

  if (existingIdx !== -1) {
    list[existingIdx] = { ...normalized, updatedAt: new Date().toISOString() };
  } else {
    list.unshift({ ...normalized, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  saveCustomSymbols(list);
  // 单独即时保存到磁盘
  saveCellToDisk(normalized).catch(() => {});
  return list;
}

export function updateCustomSymbol(symbol: CustomSymbolDef): CustomSymbolDef[] {
  return addCustomSymbol(symbol);
}

/**
 * 同步删除图元（即时更新本地状态，并在后台触发磁盘删除）
 */
export function deleteCustomSymbol(idOrName: string): CustomSymbolDef[] {
  const currentList = getCustomSymbols();
  const target = currentList.find(s => s.id === idOrName || s.name === idOrName || (s as any).filename === idOrName);
  const list = currentList.filter(s => s.id !== idOrName && s.name !== idOrName && (s as any).filename !== idOrName);

  inMemorySymbols = list;
  saveLocalCache(list);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('scada:custom-symbols-updated', { detail: list }));
  }

  // 收集所有可能的标识符（名称、ID、文件名、传入参数）
  const toDelete = new Set<string>();
  if (target?.name) toDelete.add(target.name);
  if (target?.id) toDelete.add(target.id);
  if ((target as any)?.filename) toDelete.add((target as any).filename);
  if (idOrName) toDelete.add(idOrName);

  for (const name of toDelete) {
    deleteCellFromDisk(name).catch(err => {
      console.warn(`[CellStorage] 删除磁盘图元 ${name} 失败:`, err);
    });
  }
  return list;
}

/**
 * 异步删除图元（彻底等待磁盘删除完成并同步最新状态）
 */
export async function deleteCustomSymbolAsync(idOrName: string): Promise<CustomSymbolDef[]> {
  const currentList = getCustomSymbols();
  const target = currentList.find(s => s.id === idOrName || s.name === idOrName || (s as any).filename === idOrName);
  const list = currentList.filter(s => s.id !== idOrName && s.name !== idOrName && (s as any).filename !== idOrName);

  inMemorySymbols = list;
  saveLocalCache(list);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('scada:custom-symbols-updated', { detail: list }));
  }

  const toDelete = new Set<string>();
  if (target?.name) toDelete.add(target.name);
  if (target?.id) toDelete.add(target.id);
  if ((target as any)?.filename) toDelete.add((target as any).filename);
  if (idOrName) toDelete.add(idOrName);

  for (const name of toDelete) {
    try {
      await deleteCellFromDisk(name);
    } catch (err) {
      console.warn(`[CellStorage] 异步删除磁盘图元 ${name} 异常:`, err);
    }
  }

  // 刷新一次磁盘状态
  return await refreshCustomSymbolsFromDisk();
}

export function removeCustomSymbol(id: string): CustomSymbolDef[] {
  return deleteCustomSymbol(id);
}

/**
 * 导出图元为 JSON 文件
 */
export function exportSymbolsAsJSON() {
  const data = getCustomSymbols();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scada-custom-cells-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 从 JSON 文件批量导入图元
 */
export async function importSymbolsFromJSON(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      saveCustomSymbols(parsed);
      return true;
    } else if (parsed && parsed.name) {
      addCustomSymbol(parsed);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to import symbols:', e);
    return false;
  }
}

// 在模块加载时，自动触发一次检索
if (typeof window !== 'undefined') {
  refreshCustomSymbolsFromDisk().catch(() => {});
}
