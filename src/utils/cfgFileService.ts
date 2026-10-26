/**
 * 基础与系统配置服务 (读取 cfg/base.json)
 * 支持运行在 Electron (Linx凝思等工控机) 与 Web 浏览器端
 */

export interface ScadaBaseConfig {
  SAFE_DATA_START?: string;
  SCREEN_ORDER?: string[];
  description?: string;
  station_name?: string;
  [key: string]: any;
}

export const DEFAULT_SAFE_DATA_START = '2025-05-06';

/**
 * 跨平台读取磁盘上的 cfg/base.json
 */
export async function fetchBaseConfig(): Promise<ScadaBaseConfig> {
  // 1. Electron 桌面端通过 IPC 获取
  if (typeof window !== 'undefined' && (window as any).electronAPI?.cfg?.getBaseConfig) {
    try {
      const res = await (window as any).electronAPI.cfg.getBaseConfig();
      if (res && res.success && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn('[cfgFileService] Electron 读取 cfg/base.json 失败，尝试网络回退:', err);
    }
  }

  // 2. Web 开发或生产服务器通过 REST API 获取
  try {
    const res = await fetch('/api/cfg/base', {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const json = await res.json();
      if (json && (json.success || json.code === 200) && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[cfgFileService] 网络读取 /api/cfg/base 失败:', err);
  }

  // 3. 本地存储或保底默认值
  return {
    SAFE_DATA_START: DEFAULT_SAFE_DATA_START,
    SCREEN_ORDER: [],
    description: 'GE-SCADA 现场基础运行配置文件',
    station_name: '智能变电站'
  };
}

/**
 * 跨平台持久化写入磁盘上的 cfg/base.json
 */
export async function saveBaseConfig(patch: Partial<ScadaBaseConfig>): Promise<{ success: boolean; data?: any; error?: string }> {
  // 1. Electron 桌面端通过 IPC 写入
  if (typeof window !== 'undefined' && (window as any).electronAPI?.cfg?.saveBaseConfig) {
    try {
      const res = await (window as any).electronAPI.cfg.saveBaseConfig(patch);
      if (res && res.success) {
        return res;
      }
    } catch (err) {
      console.warn('[cfgFileService] Electron 写入 cfg/base.json 失败，尝试网络回退:', err);
    }
  }

  // 2. Web 开发或生产服务器通过 REST API 写入
  try {
    const res = await fetch('/api/cfg/base', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(patch)
    });
    if (res.ok) {
      const json = await res.json();
      return json;
    }
  } catch (err: any) {
    console.warn('[cfgFileService] 网络写入 /api/cfg/base 失败:', err);
    return { success: false, error: err?.message };
  }

  return { success: true };
}

/**
 * 将画面名称顺序列表持久化到 cfg/base.json 的 SCREEN_ORDER 条目
 */
export async function saveScreenOrder(screenNames: string[]): Promise<boolean> {
  try {
    const res = await saveBaseConfig({ SCREEN_ORDER: screenNames });
    return res.success;
  } catch (err) {
    console.warn('[cfgFileService] 持久化画面顺序失败:', err);
    return false;
  }
}

/**
 * 根据 SCREEN_ORDER 配置顺序对大屏列表进行重排
 * 在列表中排在前列，未记录的新大屏保持追加在后
 */
export function applyScreenOrder<T extends { name: string }>(screens: T[], screenOrder?: string[]): T[] {
  if (!Array.isArray(screens) || screens.length <= 1) return screens || [];
  if (!Array.isArray(screenOrder) || screenOrder.length === 0) return screens;

  const orderMap = new Map<string, number>();
  screenOrder.forEach((name, idx) => {
    if (typeof name === 'string' && name.trim()) {
      orderMap.set(name.trim().toLowerCase(), idx);
    }
  });

  return [...screens].sort((a, b) => {
    const aKey = (a.name || '').trim().toLowerCase();
    const bKey = (b.name || '').trim().toLowerCase();
    const aIdx = orderMap.has(aKey) ? orderMap.get(aKey)! : 999999;
    const bIdx = orderMap.has(bKey) ? orderMap.get(bKey)! : 999999;
    return aIdx - bIdx;
  });
}

/**
 * 根据起始日期字符串 (如 "2025-05-06") 精确计算连续安全运行天数
 * 严格基于日历天归零计算 (00:00:00 对齐)
 */
export function computeSafetyDays(startDateStr?: string): number {
  const dateStr = (startDateStr || DEFAULT_SAFE_DATA_START).trim();
  // 支持 "2025-05-06" 或 "2025/05/06"
  const parts = dateStr.split(/[-/]/).map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return 0;
  }

  const [year, month, day] = parts;
  const startDate = new Date(year, month - 1, day, 0, 0, 0);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const diffMs = todayMidnight.getTime() - startDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * 安排在每晚零点 (00:00:00) 准时执行回调 (检索磁盘配置条目并重新计算)
 * 返回清理定时器的注销函数
 */
export function scheduleMidnightTask(task: () => void): () => void {
  let timeoutId: any = null;
  let intervalId: any = null;

  const setupNextMidnight = () => {
    const now = new Date();
    // 目标时间：下一个凌晨 00:00:01 (留 1 秒缓冲以确保已跨过零点)
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      1
    );

    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

    timeoutId = setTimeout(() => {
      try {
        task();
      } catch (err) {
        console.warn('[scheduleMidnightTask] 执行零点任务异常:', err);
      }

      // 之后每 24 小时周期循环执行
      intervalId = setInterval(() => {
        try {
          task();
        } catch (err) {
          console.warn('[scheduleMidnightTask] 周期执行零点任务异常:', err);
        }
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  };

  setupNextMidnight();

  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (intervalId) clearInterval(intervalId);
  };
}
