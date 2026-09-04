import fs from 'fs';
import path from 'path';
import { ScreenItem } from '../types';
import { PRESET_MULTI_SCREENS } from '../data/presetMultiScreens';

/**
 * SCADA 大屏独立 JSON 文件磁盘存储引擎
 * 规则：
 * 1. 路径写死：放在可执行目录同级文件夹 graph 下
 * 2. 加载时进行合理性检测，只载入结构合理的 JSON 文件
 * 3. 每次启动确保 graph 下至少存在一个合理的 JSON 大屏
 * 4. 支持配置用户登录成功后的主索引大屏 (记录在 graph/.graph_config.json)
 * 5. 单屏保存：点击保存按钮时仅同步保存当前单个大屏
 */

// 可执行目录同级文件夹 graph
const getExecutableRootDir = (): string => {
  if (typeof process !== 'undefined') {
    // Electron 打包运行环境
    if ((process as any).versions?.electron && (global as any).app?.isPackaged) {
      return path.dirname(process.execPath);
    }
  }
  return process.cwd();
};

export const GRAPH_DIR = path.resolve(getExecutableRootDir(), 'graph');

// 登录主索引大屏配置文件路径
const GRAPH_CONFIG_FILE = path.join(GRAPH_DIR, '.graph_config.json');

/**
 * 获取固定存储目录并确保其存在，若为空则自动迁移历史文件或生成预设文件
 */
export function getStorageDirectory(): string {
  if (!fs.existsSync(GRAPH_DIR)) {
    fs.mkdirSync(GRAPH_DIR, { recursive: true });
  }

  // 若 graph 目录刚建立且为空，而旧目录 scada_screens 存在，自动同步迁移过去
  try {
    const currentFiles = fs.readdirSync(GRAPH_DIR).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
    if (currentFiles.length === 0) {
      const oldDir = path.resolve(getExecutableRootDir(), 'scada_screens');
      if (fs.existsSync(oldDir)) {
        const oldFiles = fs.readdirSync(oldDir).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
        for (const file of oldFiles) {
          try {
            fs.copyFileSync(path.join(oldDir, file), path.join(GRAPH_DIR, file));
            console.log(`[SCADA Storage] 已从历史目录迁移大屏文件到 graph/${file}`);
          } catch {}
        }
      }
    }
  } catch {}

  return GRAPH_DIR;
}

/**
 * 文件名非法字符过滤 (去除 Windows/Linux 文件系统保留字符)
 */
export function sanitizeScreenFilename(name: string): string {
  if (!name || typeof name !== 'string') return '未命名大屏';
  const sanitized = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return sanitized || '未命名大屏';
}

/**
 * JSON 合理性检测结果
 */
export interface ScreenValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * 大屏 JSON 合理性检测函数
 * 只载入合规合理的 SCADA 大屏 JSON，过滤损坏或无关文件
 */
export function validateScreenJson(parsed: any, filename: string): ScreenValidationResult {
  // 1. 必须是对象，不能是 null、数组或基础类型
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, reason: '文件内容不是合法的 JSON 对象' };
  }

  // 2. 忽略内部配置文件（如 .graph_config.json 等）
  if (filename.startsWith('.')) {
    return { valid: false, reason: '隐藏或内部配置文件' };
  }

  // 3. 必须包含 screen 对象或 components 数组
  const hasScreen = parsed.screen && typeof parsed.screen === 'object';
  const hasComponents = Array.isArray(parsed.components);

  if (!hasScreen && !hasComponents) {
    return { valid: false, reason: '缺少 screen 画布配置或 components 组件列表' };
  }

  // 4. 如果包含 screen 画布配置，检测尺寸合理性 (必须为数值且必须大于 0)
  if (hasScreen) {
    const w = parsed.screen.width;
    const h = parsed.screen.height;
    if (w !== undefined && (typeof w !== 'number' || isNaN(w) || w <= 0)) {
      return { valid: false, reason: `画布宽度异常: ${w}` };
    }
    if (h !== undefined && (typeof h !== 'number' || isNaN(h) || h <= 0)) {
      return { valid: false, reason: `画布高度异常: ${h}` };
    }
  }

  // 5. 校验 components 若存在必须是合法数组
  if (parsed.components !== undefined && !Array.isArray(parsed.components)) {
    return { valid: false, reason: 'components 必须为数组' };
  }

  // 6. 校验大屏名称非空
  const fallbackName = filename.replace(/\.json$/i, '');
  const screenName = (parsed.name || parsed.screen?.name || fallbackName).trim();
  if (!screenName) {
    return { valid: false, reason: '大屏名称为空' };
  }

  return { valid: true };
}

/**
 * 初始化写入至少一个合理的预设大屏到 graph 目录下
 * 确保每次启动或目录异常时 graph 下至少有一个合理的 JSON
 */
export function ensureAtLeastOneValidScreen(force = false): string[] {
  const dir = getStorageDirectory();
  const createdFiles: string[] = [];

  for (const preset of PRESET_MULTI_SCREENS) {
    const filename = `${sanitizeScreenFilename(preset.name)}.json`;
    const filePath = path.join(dir, filename);

    if (!fs.existsSync(filePath) || force) {
      const dataToSave = {
        id: preset.id,
        name: preset.name,
        description: preset.description || '',
        version: preset.screen?.version || '2.0.0',
        updatedAt: new Date().toISOString(),
        screen: {
          ...preset.screen,
          id: preset.id,
          name: preset.name
        },
        components: preset.components || []
      };

      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      createdFiles.push(filename);
      // 如果不是强制写入所有预设，写完第一个标准合理大屏即可返回
      if (!force) break;
    }
  }

  return createdFiles;
}

/**
 * 读取用户登录成功后的主索引大屏配置
 */
export function getIndexScreenConfig(): { indexScreenName: string; indexScreenId: string } {
  try {
    getStorageDirectory();
    if (fs.existsSync(GRAPH_CONFIG_FILE)) {
      const raw = fs.readFileSync(GRAPH_CONFIG_FILE, 'utf-8');
      const cfg = JSON.parse(raw);
      return {
        indexScreenName: typeof cfg.indexScreenName === 'string' ? cfg.indexScreenName : '',
        indexScreenId: typeof cfg.indexScreenId === 'string' ? cfg.indexScreenId : ''
      };
    }
  } catch (err) {
    console.warn('[SCADA Storage] 读取主索引大屏配置异常:', err);
  }
  return { indexScreenName: '', indexScreenId: '' };
}

/**
 * 保存用户登录成功后的主索引大屏配置
 */
export function setIndexScreenConfig(
  indexScreenName: string,
  indexScreenId: string
): { success: boolean; indexScreenName: string; indexScreenId: string; error?: string } {
  try {
    getStorageDirectory();
    const configData = {
      indexScreenName: indexScreenName.trim(),
      indexScreenId: indexScreenId.trim(),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(GRAPH_CONFIG_FILE, JSON.stringify(configData, null, 2), 'utf-8');
    return { success: true, indexScreenName: configData.indexScreenName, indexScreenId: configData.indexScreenId };
  } catch (err: any) {
    console.error('[SCADA Storage] 写入主索引大屏配置失败:', err);
    return { success: false, indexScreenName, indexScreenId, error: err?.message || '配置写入失败' };
  }
}

/**
 * 扫描并加载 graph 目录下的所有大屏 JSON 文件
 * 严格执行合理性检测，每次启动确保 graph 下至少有一个合理的 JSON
 */
export function loadAllScreensFromDisk(): {
  success: boolean;
  screens: ScreenItem[];
  storageDir: string;
  count: number;
  files: string[];
  skippedFiles: Array<{ filename: string; reason: string }>;
  indexScreen: { indexScreenName: string; indexScreenId: string };
} {
  const dir = getStorageDirectory();
  let entries: fs.Dirent[] = [];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.error('[SCADA Storage] 扫描 graph 目录失败:', err);
    ensureAtLeastOneValidScreen();
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      entries = [];
    }
  }

  // 筛选所有 .json 文件（排除隐藏文件）
  let jsonFiles = entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.json') && !e.name.startsWith('.'))
    .map(e => e.name);

  // 逐一进行合理性检测
  let loadedScreens: ScreenItem[] = [];
  let validFiles: string[] = [];
  let skippedFiles: Array<{ filename: string; reason: string }> = [];

  for (const filename of jsonFiles) {
    const filePath = path.join(dir, filename);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      // 合理性检测
      const check = validateScreenJson(parsed, filename);
      if (!check.valid) {
        console.warn(`[SCADA Storage] 跳过非合规或损坏的 JSON 文件「${filename}」: ${check.reason}`);
        skippedFiles.push({ filename, reason: check.reason || '不符合 SCADA 大屏 JSON 规范' });
        continue;
      }

      const fallbackName = filename.replace(/\.json$/i, '');
      const screenName = (parsed.name || parsed.screen?.name || fallbackName).trim();
      const screenId = parsed.id || parsed.screen?.id || `screen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const screenConfig = parsed.screen || {
        id: screenId,
        name: screenName,
        width: 1920,
        height: 1080,
        backgroundColor: '#040914',
        backgroundGrid: true,
        gridSize: 20,
        gridColor: 'rgba(0, 242, 255, 0.22)',
        theme: 'cyber-dark',
        version: '2.0.0',
        updatedAt: new Date().toISOString()
      };

      screenConfig.id = screenId;
      screenConfig.name = screenName;

      const screenItem: ScreenItem = {
        id: screenId,
        name: screenName,
        description: parsed.description || '',
        screen: screenConfig,
        components: Array.isArray(parsed.components) ? parsed.components : []
      };

      loadedScreens.push(screenItem);
      validFiles.push(filename);
    } catch (err: any) {
      console.warn(`[SCADA Storage] 解析文件「${filename}」格式失败:`, err?.message);
      skippedFiles.push({ filename, reason: `语法解析错误: ${err?.message || ''}` });
    }
  }

  // 关键规范：每次启动确保 graph 下至少有一个合理的 JSON 大屏！
  if (loadedScreens.length === 0) {
    console.log('[SCADA Storage] 目录下无可用合规大屏，正在写入保底标准预设大屏...');
    ensureAtLeastOneValidScreen(true);
    // 重新载入
    try {
      const reEntries = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
      for (const fn of reEntries) {
        const fp = path.join(dir, fn);
        try {
          const c = fs.readFileSync(fp, 'utf-8');
          const p = JSON.parse(c);
          if (validateScreenJson(p, fn).valid) {
            const sid = p.id || p.screen?.id || `screen-${Date.now()}`;
            const sname = (p.name || p.screen?.name || fn.replace(/\.json$/i, '')).trim();
            loadedScreens.push({
              id: sid,
              name: sname,
              description: p.description || '',
              screen: p.screen || { id: sid, name: sname, width: 1920, height: 1080 },
              components: p.components || []
            });
            validFiles.push(fn);
          }
        } catch {}
      }
    } catch {}
  }

  // 获取当前主索引大屏配置
  let indexConfig = getIndexScreenConfig();
  // 若未配置，默认以第一个合理的 JSON 大屏为主索引大屏
  if (!indexConfig.indexScreenName && loadedScreens.length > 0) {
    indexConfig = {
      indexScreenName: loadedScreens[0].name,
      indexScreenId: loadedScreens[0].id
    };
    setIndexScreenConfig(indexConfig.indexScreenName, indexConfig.indexScreenId);
  }

  return {
    success: true,
    screens: loadedScreens,
    storageDir: dir,
    count: loadedScreens.length,
    files: validFiles,
    skippedFiles,
    indexScreen: indexConfig
  };
}

/**
 * 仅保存当前选中的单个大屏到对应名称的 JSON 文件 (<screen.name>.json)
 * 点击保存按钮时才触发同步保存当前这一个大屏
 */
export function saveOneScreenToDisk(
  screenItem: ScreenItem,
  oldName?: string
): { success: boolean; filename: string; filePath: string; error?: string } {
  const dir = getStorageDirectory();

  try {
    const currentName = screenItem.name.trim();
    if (!currentName) {
      return { success: false, filename: '', filePath: '', error: '大屏名称不能为空' };
    }

    const newFilename = `${sanitizeScreenFilename(currentName)}.json`;
    const newFilePath = path.join(dir, newFilename);

    // 如果提供了旧名称，且旧文件名与新文件名不一致，清理旧名称文件
    if (oldName && oldName.trim() && oldName.trim() !== currentName) {
      const oldFilename = `${sanitizeScreenFilename(oldName.trim())}.json`;
      const oldFilePath = path.join(dir, oldFilename);
      if (fs.existsSync(oldFilePath) && oldFilePath !== newFilePath) {
        try {
          fs.unlinkSync(oldFilePath);
          console.log(`[SCADA Storage] 大屏重命名，删除旧文件: ${oldFilename}`);
        } catch (e) {
          console.warn(`[SCADA Storage] 删除旧文件失败:`, e);
        }
      }
    }

    const dataToSave = {
      id: screenItem.id,
      name: currentName,
      description: screenItem.description || '',
      version: screenItem.screen?.version || '2.0.0',
      updatedAt: new Date().toISOString(),
      screen: {
        ...screenItem.screen,
        id: screenItem.id,
        name: currentName
      },
      components: screenItem.components || []
    };

    fs.writeFileSync(newFilePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
    return { success: true, filename: newFilename, filePath: newFilePath };
  } catch (err: any) {
    console.error(`[SCADA Storage] 保存大屏「${screenItem.name}」失败:`, err);
    return { success: false, filename: '', filePath: '', error: err?.message || '保存大屏文件失败' };
  }
}

/**
 * 删除指定大屏名称对应的 JSON 文件
 */
export function deleteScreenFromDisk(screenName: string): { success: boolean; filename: string } {
  const dir = getStorageDirectory();
  const filename = `${sanitizeScreenFilename(screenName)}.json`;
  const filePath = path.join(dir, filename);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return { success: true, filename };
    } catch (err) {
      console.error(`[SCADA Storage] 删除文件「${filename}」失败:`, err);
    }
  }

  return { success: false, filename };
}

/**
 * 获取存储目录配置信息、文件清单及主索引配置
 */
export function getStorageConfig(): {
  storageDir: string;
  absolutePath: string;
  fileCount: number;
  files: Array<{ filename: string; screenName: string; sizeBytes: number; updatedAt: string; isValid: boolean; reason?: string }>;
  indexScreen: { indexScreenName: string; indexScreenId: string };
} {
  const dir = getStorageDirectory();
  let files: Array<{ filename: string; screenName: string; sizeBytes: number; updatedAt: string; isValid: boolean; reason?: string }> = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.json') && !entry.name.startsWith('.')) {
        const filePath = path.join(dir, entry.name);
        const stats = fs.statSync(filePath);
        const screenName = entry.name.replace(/\.json$/i, '');
        let isValid = false;
        let reason = '';
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(raw);
          const valRes = validateScreenJson(parsed, entry.name);
          isValid = valRes.valid;
          reason = valRes.reason || '';
        } catch (e: any) {
          isValid = false;
          reason = e?.message || 'JSON 解析失败';
        }

        files.push({
          filename: entry.name,
          screenName,
          sizeBytes: stats.size,
          updatedAt: stats.mtime.toISOString(),
          isValid,
          reason
        });
      }
    }
  } catch (err) {
    console.error('[SCADA Storage] 读取目录信息错误:', err);
  }

  return {
    storageDir: 'graph',
    absolutePath: dir,
    fileCount: files.filter(f => f.isValid).length,
    files,
    indexScreen: getIndexScreenConfig()
  };
}
