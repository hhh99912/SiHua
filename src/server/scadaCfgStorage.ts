import fs from 'fs';
import path from 'path';

/**
 * SCADA 基础与初始化配置文件磁盘存储引擎
 * 路径与 graph 同级：放置在 cfg/ 文件夹下，文件名为 base.json
 */

const getExecutableRootDir = (): string => {
  if (typeof process !== 'undefined') {
    // Electron 打包运行环境
    if ((process as any).versions?.electron && (global as any).app?.isPackaged) {
      return path.dirname(process.execPath);
    }
  }
  return process.cwd();
};

export const CFG_DIR = path.resolve(getExecutableRootDir(), 'cfg');
export const BASE_CFG_FILE = path.join(CFG_DIR, 'base.json');

export const DEFAULT_BASE_CONFIG = {
  SAFE_DATA_START: "2025-05-06",
  description: "GE-SCADA 现场基础运行配置文件 (支持工程师现场配置安全运行起始日期与站所基础参数)",
  station_name: "智能变电站"
};

/**
 * 确保 cfg 目录与 base.json 配置文件存在
 */
export function ensureCfgDirectory(): string {
  if (!fs.existsSync(CFG_DIR)) {
    try {
      fs.mkdirSync(CFG_DIR, { recursive: true });
    } catch (err) {
      console.warn('[SCADA Cfg Storage] 创建 cfg 目录失败:', err);
    }
  }

  if (!fs.existsSync(BASE_CFG_FILE)) {
    try {
      fs.writeFileSync(BASE_CFG_FILE, JSON.stringify(DEFAULT_BASE_CONFIG, null, 2), 'utf-8');
      console.log('[SCADA Cfg Storage] 已自动初始化创建 cfg/base.json 配置文件');
    } catch (err) {
      console.warn('[SCADA Cfg Storage] 初始化 base.json 失败:', err);
    }
  }

  return CFG_DIR;
}

/**
 * 读取磁盘上的 cfg/base.json
 */
export function getBaseConfig(): any {
  ensureCfgDirectory();
  try {
    if (fs.existsSync(BASE_CFG_FILE)) {
      const raw = fs.readFileSync(BASE_CFG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_BASE_CONFIG,
          ...parsed
        };
      }
    }
  } catch (err) {
    console.warn('[SCADA Cfg Storage] 读取 base.json 异常:', err);
  }
  return DEFAULT_BASE_CONFIG;
}

/**
 * 写入或保存 cfg/base.json
 */
export function saveBaseConfig(data: any): { success: boolean; data?: any; error?: string } {
  ensureCfgDirectory();
  try {
    let existing: any = DEFAULT_BASE_CONFIG;
    if (fs.existsSync(BASE_CFG_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(BASE_CFG_FILE, 'utf-8'));
      } catch {}
    }
    const merged = {
      ...DEFAULT_BASE_CONFIG,
      ...existing,
      ...data
    };
    fs.writeFileSync(BASE_CFG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    return { success: true, data: merged };
  } catch (err: any) {
    console.error('[SCADA Cfg Storage] 保存 base.json 失败:', err);
    return { success: false, error: err?.message || '写入 base.json 失败' };
  }
}
