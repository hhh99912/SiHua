import fs from 'fs';
import path from 'path';
import { INITIAL_DATASETS, STATION_DEVICES, syncFlatDataFromDevices } from '../data/presetDatasets';
import { sanitizeScreenFilename } from './scadaScreenStorage';

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
 * 数据集与点表独立存储目录：与 graph、model、cell 同级的 data 目录
 */
export const DATA_DIR = path.resolve(getExecutableRootDir(), 'data');

/**
 * 确保 data 目录存在，若为空则自动写入初始智能变电站装置点表数据集 JSON
 */
export function ensureDataDirectory(force = false): string[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const createdFiles: string[] = [];

  try {
    const existing = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
    if (existing.length === 0 || force) {
      for (const ds of INITIAL_DATASETS) {
        const fn = `${sanitizeScreenFilename(ds.name || ds.id)}.json`;
        const fPath = path.join(DATA_DIR, fn);
        if (!fs.existsSync(fPath) || force) {
          const synced = syncFlatDataFromDevices(ds.devices || STATION_DEVICES);
          const dsData = {
            id: ds.id || 'ds-scada-station',
            name: ds.name || '110kV/10kV 智能变电站 SCADA 集控数据集 (装置级)',
            description: ds.description || '以装置号为初始单位，涵盖各馈线与主变测控装置的遥测、遥信、电度、遥控与遥调',
            type: ds.type || 'mock',
            updateIntervalMs: ds.updateIntervalMs || 2000,
            isStreaming: ds.isStreaming ?? true,
            updatedAt: new Date().toISOString(),
            devices: ds.devices || STATION_DEVICES,
            data: synced.data,
            fields: synced.fields
          };
          fs.writeFileSync(fPath, JSON.stringify(dsData, null, 2), 'utf-8');
          createdFiles.push(fn);
        }
      }
    }
  } catch (err) {
    console.error('[DataStorage] 初始化 data 目录失败:', err);
  }

  return createdFiles;
}

/**
 * 从 data 目录下读取所有数据集 JSON 文件
 */
export function loadAllDatasetsFromDisk(): {
  success: boolean;
  datasets: any[];
  storageDir: string;
  files: string[];
  error?: string;
} {
  ensureDataDirectory(false);

  const datasets: any[] = [];
  const validFiles: string[] = [];

  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));

    for (const filename of files) {
      const fullPath = path.join(DATA_DIR, filename);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed && (parsed.id || parsed.name || Array.isArray(parsed.devices))) {
          parsed.filename = filename;
          // 若缺少扁平化字段，自动依据 devices 进行补全
          if ((!parsed.data || !parsed.fields) && Array.isArray(parsed.devices)) {
            const synced = syncFlatDataFromDevices(parsed.devices);
            parsed.data = parsed.data || synced.data;
            parsed.fields = parsed.fields || synced.fields;
          }
          datasets.push(parsed);
          validFiles.push(filename);
        }
      } catch (fileErr) {
        console.warn(`[DataStorage] 解析数据集文件 ${filename} 失败:`, fileErr);
      }
    }

    // 若无任何有效数据集，则自动生成初始数据集
    if (datasets.length === 0) {
      ensureDataDirectory(true);
      return loadAllDatasetsFromDisk();
    }

    return {
      success: true,
      datasets,
      storageDir: DATA_DIR,
      files: validFiles
    };
  } catch (err: any) {
    console.error('[DataStorage] 读取 data 目录失败:', err);
    return {
      success: false,
      datasets: INITIAL_DATASETS,
      storageDir: DATA_DIR,
      files: [],
      error: err.message || '读取数据集失败'
    };
  }
}

/**
 * 保存单个数据集至 data/<name>.json
 */
export function saveDatasetToDisk(datasetData: any): {
  success: boolean;
  filename?: string;
  dataset?: any;
  error?: string;
} {
  try {
    ensureDataDirectory(false);

    if (!datasetData || typeof datasetData !== 'object') {
      return { success: false, error: '数据集数据无效' };
    }

    const dsName = (datasetData.name || datasetData.id || '新建数据集').trim();
    const safeName = sanitizeScreenFilename(dsName);
    const filename = `${safeName}.json`;
    const fullPath = path.join(DATA_DIR, filename);

    // 如果指定了旧文件名且与当前安全文件名不同，重命名旧文件
    if (datasetData.oldFilename && datasetData.oldFilename !== filename) {
      const oldPath = path.join(DATA_DIR, datasetData.oldFilename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {}
      }
    }

    const devices = Array.isArray(datasetData.devices) ? datasetData.devices : [];
    const synced = syncFlatDataFromDevices(devices);

    const payloadToSave = {
      id: datasetData.id || `ds-${Date.now()}`,
      name: dsName,
      description: datasetData.description || '',
      type: datasetData.type || 'mock',
      apiUrl: datasetData.apiUrl || '',
      wsUrl: datasetData.wsUrl || '',
      updateIntervalMs: datasetData.updateIntervalMs || 2000,
      isStreaming: datasetData.isStreaming ?? true,
      updatedAt: new Date().toISOString(),
      devices,
      data: datasetData.data || synced.data,
      fields: datasetData.fields || synced.fields
    };

    fs.writeFileSync(fullPath, JSON.stringify(payloadToSave, null, 2), 'utf-8');

    return {
      success: true,
      filename,
      dataset: {
        ...payloadToSave,
        filename
      }
    };
  } catch (err: any) {
    console.error('[DataStorage] 保存数据集失败:', err);
    return { success: false, error: err.message || '保存数据集失败' };
  }
}

/**
 * 删除指定的数据集文件
 */
export function deleteDatasetFromDisk(identifier: string): {
  success: boolean;
  error?: string;
  filename?: string;
} {
  if (!identifier) {
    return { success: false, error: '未指定数据集标识' };
  }

  try {
    ensureDataDirectory(false);
    if (!fs.existsSync(DATA_DIR)) {
      return { success: true };
    }

    const trimmed = String(identifier).trim();
    const candidateFilenames = [
      trimmed,
      trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`,
      trimmed.toLowerCase().endsWith('.json')
        ? `${sanitizeScreenFilename(trimmed.slice(0, -5))}.json`
        : `${sanitizeScreenFilename(trimmed)}.json`
    ];

    for (const fn of candidateFilenames) {
      const fullPath = path.join(DATA_DIR, fn);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return { success: true, filename: fn };
      }
    }

    // 遍历匹配 JSON 内部 id 或 name
    const files = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
    for (const file of files) {
      const fullPath = path.join(DATA_DIR, file);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.id === trimmed || parsed.name === trimmed || file.replace(/\.json$/i, '') === trimmed) {
          fs.unlinkSync(fullPath);
          return { success: true, filename: file };
        }
      } catch (e) {}
    }

    return { success: true };
  } catch (err: any) {
    console.error('[DataStorage] 删除数据集失败:', err);
    return { success: false, error: err.message || '删除数据集失败' };
  }
}
