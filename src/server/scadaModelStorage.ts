import fs from 'fs';
import path from 'path';
import { PV_HIGH_VOLTAGE_TEMPLATE } from '../data/pvHighVoltageTemplate';
import { PRESET_TEMPLATES } from '../data/templates';
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
 * 模板独立存储目录：与 graph 同级的 model 目录
 */
export const MODEL_DIR = path.resolve(getExecutableRootDir(), 'model');

/**
 * 确保 model 目录存在，若为空则自动写入预设默认工业与电力模板
 */
export function ensureModelDirectory(force = false): string[] {
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  const createdFiles: string[] = [];

  try {
    const existing = fs.readdirSync(MODEL_DIR).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
    if (existing.length === 0 || force) {
      // 1. 写入 35kV高压光伏一次系统接线图 模板
      const pvTplName = '35kV高压光伏一次系统接线图';
      const pvFile = path.join(MODEL_DIR, `${sanitizeScreenFilename(pvTplName)}.json`);
      if (!fs.existsSync(pvFile) || force) {
        const pvData = {
          id: 'tpl-pv-high-voltage',
          name: pvTplName,
          description: PV_HIGH_VOLTAGE_TEMPLATE.description || '国标35kV/110kV光伏升压站一次接线图，100%采用基础几何与标准电气图元原子组装',
          category: '新能源电力',
          tags: ['35kV', '110kV', '光伏升压站', '一次系统图', '纯图元组装'],
          version: '2.0.0',
          updatedAt: new Date().toISOString(),
          screen: PV_HIGH_VOLTAGE_TEMPLATE.schema.screen,
          components: PV_HIGH_VOLTAGE_TEMPLATE.schema.components || []
        };
        fs.writeFileSync(pvFile, JSON.stringify(pvData, null, 2), 'utf-8');
        createdFiles.push(`${sanitizeScreenFilename(pvTplName)}.json`);
      }

      // 2. 写入 PRESET_TEMPLATES 中的其他模板
      for (const tpl of PRESET_TEMPLATES) {
        if (tpl.id === 'tpl-pv-high-voltage') continue;
        const fn = `${sanitizeScreenFilename(tpl.name)}.json`;
        const fPath = path.join(MODEL_DIR, fn);
        if (!fs.existsSync(fPath) || force) {
          const tplData = {
            id: tpl.id,
            name: tpl.name,
            description: tpl.description || '',
            category: tpl.category || '通用工业',
            tags: tpl.tags || [],
            version: '2.0.0',
            updatedAt: new Date().toISOString(),
            screen: tpl.schema?.screen || {
              id: `screen-${tpl.id}`,
              name: tpl.name,
              width: 1920,
              height: 1080,
              backgroundColor: '#070b14'
            },
            components: tpl.schema?.components || []
          };
          fs.writeFileSync(fPath, JSON.stringify(tplData, null, 2), 'utf-8');
          createdFiles.push(fn);
        }
      }
    }
  } catch (err) {
    console.error('[ModelStorage] 初始化 model 目录失败:', err);
  }

  return createdFiles;
}

export interface ModelItem {
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

/**
 * 扫描并加载 model/ 目录下的所有模板 JSON 文件
 */
export function loadAllModelsFromDisk(): {
  success: boolean;
  models: ModelItem[];
  storageDir: string;
  count: number;
  files: string[];
} {
  ensureModelDirectory();

  const models: ModelItem[] = [];
  const files: string[] = [];

  try {
    const list = fs.readdirSync(MODEL_DIR).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
    for (const filename of list) {
      const filePath = path.join(MODEL_DIR, filename);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const name = (parsed.name || parsed.screen?.name || filename.replace(/\.json$/i, '')).trim();
          const id = parsed.id || `model-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          models.push({
            id,
            name,
            description: parsed.description || '',
            category: parsed.category || '自定义模板',
            tags: Array.isArray(parsed.tags) ? parsed.tags : ['自定义模板'],
            version: parsed.version || '2.0.0',
            updatedAt: parsed.updatedAt || new Date().toISOString(),
            filename,
            screen: parsed.screen || {
              id: `screen-${id}`,
              name,
              width: 1920,
              height: 1080,
              backgroundColor: '#000000'
            },
            components: Array.isArray(parsed.components) ? parsed.components : [],
            datasets: Array.isArray(parsed.datasets) ? parsed.datasets : []
          });
          files.push(filename);
        }
      } catch (e) {
        console.warn(`[ModelStorage] 解析模板文件失败: ${filename}`, e);
      }
    }
  } catch (err) {
    console.error('[ModelStorage] 读取 model 目录失败:', err);
  }

  return {
    success: true,
    models,
    storageDir: 'model',
    count: models.length,
    files
  };
}

/**
 * 保存单个大屏为模板至 model/<name>.json
 */
export function saveModelToDisk(modelData: {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  screen: any;
  components: any[];
  datasets?: any[];
}): { success: boolean; filename?: string; name?: string; error?: string; model?: ModelItem } {
  try {
    ensureModelDirectory();

    const name = (modelData.name || '').trim();
    if (!name) {
      return { success: false, error: '模板名称不能为空' };
    }

    const filename = `${sanitizeScreenFilename(name)}.json`;
    const filePath = path.join(MODEL_DIR, filename);

    const modelToSave: ModelItem = {
      id: `model-${Date.now()}`,
      name,
      description: modelData.description || '用户自定义保存的画面模板',
      category: modelData.category || '自定义模板',
      tags: Array.isArray(modelData.tags) && modelData.tags.length > 0 ? modelData.tags : ['自定义模板'],
      version: '2.0.0',
      updatedAt: new Date().toISOString(),
      filename,
      screen: {
        ...(modelData.screen || {}),
        name
      },
      components: Array.isArray(modelData.components) ? modelData.components : [],
      datasets: Array.isArray(modelData.datasets) ? modelData.datasets : []
    };

    fs.writeFileSync(filePath, JSON.stringify(modelToSave, null, 2), 'utf-8');
    console.log(`[ModelStorage] 模板已成功保存至: model/${filename}`);

    return {
      success: true,
      filename,
      name,
      model: modelToSave
    };
  } catch (err: any) {
    console.error('[ModelStorage] 保存模板失败:', err);
    return { success: false, error: err?.message || '保存模板异常' };
  }
}

/**
 * 删除 model/ 目录下的指定模板
 */
export function deleteModelFromDisk(name: string): { success: boolean; error?: string } {
  try {
    const filename = `${sanitizeScreenFilename(name)}.json`;
    const filePath = path.join(MODEL_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[ModelStorage] 已删除模板: model/${filename}`);
      return { success: true };
    }
    return { success: false, error: `未找到模板文件: ${filename}` };
  } catch (err: any) {
    console.error('[ModelStorage] 删除模板失败:', err);
    return { success: false, error: err?.message || '删除模板异常' };
  }
}
