import { DatasetItem, ScreenComponent, ScadaDeviceItem } from '../types';

/**
 * Smart Component & Asset Unique Duplicate Name Generator (智能唯一去重与自动递增命名)
 * 彻底消除重复追加 "(副本)" 导致的长名称问题，智能识别并递增序号:
 * 例: "遥测数值" -> "遥测数值_1" -> "遥测数值_2" -> ...
 * 例: "断路器_1" -> "断路器_2"
 * 例: "开关 (副本)" -> "开关_1" (自动清洗历史副本后缀并重置为整洁编号)
 */
export function generateUniqueDuplicateName(
  originalName: string,
  existingNames: string[] = [],
  fallbackBase: string = '组件'
): string {
  const cleanOriginal = (originalName || '').trim() || fallbackBase;

  // 1. 彻底清洗所有历史堆叠的 "(副本)", "（副本）", " (副本 2)", "_copy", " - 副本"
  let base = cleanOriginal
    .replace(/(?:[\s\-_]*[\(（]?(?:副本|copy)[\)）]?[\s\-_]*\d*)+$/gi, '')
    .trim();

  if (!base) {
    base = fallbackBase;
  }

  // 2. 检查名称末尾是否已自带编号规则 (如 `_1`, `_01`, ` 1`, `(1)`, `（1）`, `#1`)
  let separator = '_';
  let hasExistingIndex = false;
  let baseRoot = base;
  let startNumber = 1;

  const indexMatch = base.match(/^(.*?)([_#\s\-\(（])(\d+)[\)）]?$/);
  if (indexMatch && indexMatch[1] && indexMatch[3]) {
    baseRoot = indexMatch[1].trim() || base;
    separator = indexMatch[2] === '（' || indexMatch[2] === '(' ? '_' : indexMatch[2];
    hasExistingIndex = true;
    startNumber = parseInt(indexMatch[3], 10) + 1;
  }

  const existingSet = new Set(existingNames.map(n => (n || '').trim().toLowerCase()));

  // 3. 寻找下一个未占用的序号
  let index = hasExistingIndex ? startNumber : 1;
  let candidate = `${baseRoot}${separator}${index}`;

  while (existingSet.has(candidate.toLowerCase())) {
    index++;
    candidate = `${baseRoot}${separator}${index}`;
  }

  return candidate;
}

/**
 * Direct Truncation Number Formatter (向零直接截断指定小数位数，绝不四舍五入)
 * 例: 0.98 保留 1 位小数 => 0.9
 * @param num 输入数值
 * @param decimals 最大保留小数位数 (0-6)
 * @param trimZeros 是否自动去除末尾无效 0 (默认 true)
 */
export function formatTruncatedNumber(num: number, decimals: number, trimZeros: boolean = true): string {
  if (isNaN(num) || !isFinite(num)) return '0';
  
  const clampedDecimals = Math.max(0, Math.min(6, decimals));
  
  if (clampedDecimals === 0) {
    const intVal = Math.trunc(num);
    return Object.is(intVal, -0) ? '0' : String(intVal);
  }

  // 转换为字符串进行直接截断，避免浮点数乘除精度误差
  const str = String(num);
  
  // 检查是否包含科学计数法 (如 1e-7)
  if (str.includes('e') || str.includes('E')) {
    const factor = Math.pow(10, clampedDecimals);
    const truncated = Math.trunc(num * factor) / factor;
    const s = String(truncated);
    if (!trimZeros) {
      const parts = s.split('.');
      const dec = (parts[1] || '').padEnd(clampedDecimals, '0');
      return `${parts[0]}.${dec}`;
    }
    return s;
  }

  const dotIndex = str.indexOf('.');
  if (dotIndex === -1) {
    if (trimZeros) {
      return str;
    }
    return `${str}.${'0'.repeat(clampedDecimals)}`;
  }

  const intPart = str.slice(0, dotIndex);
  // 直接截取指定长度的小数位，不做任何四舍五入
  const rawDecPart = str.slice(dotIndex + 1, dotIndex + 1 + clampedDecimals);

  if (trimZeros) {
    const trimmedDec = rawDecPart.replace(/0+$/, '');
    return trimmedDec.length > 0 ? `${intPart}.${trimmedDec}` : intPart;
  } else {
    const paddedDec = rawDecPart.padEnd(clampedDecimals, '0');
    return `${intPart}.${paddedDec}`;
  }
}

/**
 * Strict Numeric Sanitizer & Parser
 * Enforces pure numeric parsing for all numeric components and fields.
 * Strictly strips any text/letters/symbols (except minus sign and decimal dot).
 */
export function parseStrictNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val;
  }
  if (typeof val === 'boolean') {
    return val ? 1 : 0;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return fallback;
    // Fast path: if already pure numeric string, use native parseFloat
    const parsedDirect = Number(trimmed);
    if (!isNaN(parsedDirect)) return parsedDirect;

    // Strip everything except digits, negative sign, and decimal point
    const sanitized = trimmed.replace(/[^0-9.-]/g, '');
    if (!sanitized || sanitized === '-' || sanitized === '.') return fallback;
    const parsed = parseFloat(sanitized);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

/**
 * Global High-Performance SCADA Point Hash Cache (O(1) Direct Lookup)
 * Eliminates repeated O(N) array traversals across hundreds of devices & components.
 */
const globalPointIndex = new Map<string, any>();
let lastIndexedDatasetsRef: DatasetItem[] | null = null;
let lastIndexedTimestamp = 0;

/**
 * Indexes datasets into a flat O(1) point map if dataset reference changed
 */
export function syncDatasetFastIndex(datasets?: DatasetItem[]) {
  if (!datasets || datasets.length === 0) return;
  // If same array reference and not invalidated, skip indexing
  if (datasets === lastIndexedDatasetsRef && Date.now() - lastIndexedTimestamp < 200) {
    return;
  }

  lastIndexedDatasetsRef = datasets;
  lastIndexedTimestamp = Date.now();

  for (let i = 0; i < datasets.length; i++) {
    const ds = datasets[i];
    if (!ds) continue;
    
    // Index flat data
    if (ds.data) {
      const dataKeys = Object.keys(ds.data);
      for (let k = 0; k < dataKeys.length; k++) {
        const key = dataKeys[k];
        globalPointIndex.set(key, ds.data[key]);
      }
    }

    // Index device points directly
    if (Array.isArray(ds.devices)) {
      for (let d = 0; d < ds.devices.length; d++) {
        const dev = ds.devices[d];
        const devId = dev.deviceId;

        // Telemetries
        if (dev.telemetries) {
          for (let p = 0; p < dev.telemetries.length; p++) {
            const pt = dev.telemetries[p];
            globalPointIndex.set(`${devId}_YC_${pt.pointId}`, pt.value);
          }
        }
        // TeleSignals
        if (dev.teleSignals) {
          for (let p = 0; p < dev.teleSignals.length; p++) {
            const pt = dev.teleSignals[p];
            globalPointIndex.set(`${devId}_YX_${pt.pointId}`, pt.value);
          }
        }
        // Energies
        if (dev.energies) {
          for (let p = 0; p < dev.energies.length; p++) {
            const pt = dev.energies[p];
            globalPointIndex.set(`${devId}_DD_${pt.pointId}`, pt.value);
          }
        }
        // Regulations
        if (dev.teleRegulations) {
          for (let p = 0; p < dev.teleRegulations.length; p++) {
            const pt = dev.teleRegulations[p];
            globalPointIndex.set(`${devId}_YT_${pt.pointId}`, pt.value);
          }
        }
      }
    }
  }
}

/**
 * Resolves a telemetry/tele-signal/energy value from bound dataset or point key.
 * Features O(1) high-speed lookup, expression unwrapping, and fallback handling.
 */
export function resolveDataPointValue(
  datasets: DatasetItem[] | undefined,
  datasetId: string | undefined,
  keyOrExpr: string | undefined,
  fallbackVal: any = undefined
): any {
  if (!keyOrExpr) {
    return fallbackVal;
  }

  // Extract clean point key from expression if wrapped in {{...}} or $bind(...)
  let cleanKey = typeof keyOrExpr === 'string' ? keyOrExpr.trim() : String(keyOrExpr);
  if (cleanKey.charCodeAt(0) === 36 /* '$' */ && cleanKey.startsWith('$bind(') && cleanKey.endsWith(')')) {
    cleanKey = cleanKey.slice(6, -1).trim();
  } else if (cleanKey.charCodeAt(0) === 123 /* '{' */ && cleanKey.startsWith('{{') && cleanKey.endsWith('}}')) {
    cleanKey = cleanKey.slice(2, -2).trim();
  }

  // Fast O(1) hash map lookup
  if (globalPointIndex.has(cleanKey)) {
    return globalPointIndex.get(cleanKey);
  }

  // If not yet indexed, update index now
  if (datasets) {
    syncDatasetFastIndex(datasets);
    if (globalPointIndex.has(cleanKey)) {
      return globalPointIndex.get(cleanKey);
    }
  }

  if (!datasets) return fallbackVal;

  const effectiveDatasetId = datasetId || datasets[0]?.id;
  const ds = datasets.find(d => d.id === effectiveDatasetId) || datasets[0];
  if (!ds) return fallbackVal;

  // Direct match in dataset.data
  if (ds.data && ds.data[cleanKey] !== undefined) {
    globalPointIndex.set(cleanKey, ds.data[cleanKey]);
    return ds.data[cleanKey];
  }

  return fallbackVal;
}

/**
 * Recursively resolves an object by injecting dynamic live data into bound fields or {{expressions}}.
 * Optimized to avoid unnecessary object cloning.
 */
function resolveDynamicObjectValues(
  obj: any,
  bindings: Record<string, string> | undefined,
  datasets: DatasetItem[] | undefined,
  datasetId: string | undefined
): any {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => resolveDynamicObjectValues(item, bindings, datasets, datasetId));
  }

  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const val = obj[key];
      // 1. Check if direct property binding exists in bindings
      if (bindings && bindings[key]) {
        const boundKey = bindings[key];
        const liveVal = resolveDataPointValue(datasets, datasetId, boundKey, val);
        result[key] = liveVal !== undefined ? liveVal : val;
      } else if (typeof val === 'string') {
        // 2. Check if string contains template expressions like {{DEV-101_YC_1}} or $bind(...)
        if (val.startsWith('$bind(') && val.endsWith(')')) {
          const pointKey = val.slice(6, -1).trim();
          result[key] = resolveDataPointValue(datasets, datasetId, pointKey, val);
        } else if (val.includes('{{') && val.includes('}}')) {
          const resolvedStr = val.replace(/\{\{([^}]+)\}\}/g, (_, pointKey) => {
            const resolved = resolveDataPointValue(datasets, datasetId, pointKey.trim(), pointKey);
            return resolved !== undefined ? String(resolved) : '';
          });
          if (/^\{\{[^}]+\}\}$/.test(val)) {
            const pointKey = val.slice(2, -2).trim();
            const resolvedNum = resolveDataPointValue(datasets, datasetId, pointKey, undefined);
            if (typeof resolvedNum === 'number') {
              result[key] = resolvedNum;
              continue;
            }
          }
          result[key] = resolvedStr;
        } else {
          result[key] = val;
        }
      } else if (typeof val === 'object') {
        result[key] = resolveDynamicObjectValues(val, bindings, datasets, datasetId);
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  return obj;
}

/**
 * Unified Component Dynamic Data Resolver
 * High-performance resolution with zero-allocation fast path for standard telemetry & metrics.
 */
export function resolveComponentDynamicData(
  component: ScreenComponent,
  datasets?: DatasetItem[]
): Record<string, any> {
  if (datasets) {
    syncDatasetFastIndex(datasets);
  }

  const dataConfig = component.data;
  const datasetId = dataConfig?.datasetId;
  const mapping = dataConfig?.mapping || ({} as any);
  const bindings = dataConfig?.bindings;

  // Ultra-Fast Path for standard SCADA telemetry components without complex static JSON trees
  if (!dataConfig?.staticData) {
    const valueKey = bindings?.value || mapping.valueKey;
    const stateKey = bindings?.state || mapping.stateKey;
    const unitKey = bindings?.unit || mapping.unitKey;

    let value = component.customProps?.value ?? 0;
    let state = component.customProps?.state ?? 0;
    let unit = component.customProps?.unit || component.style?.unit || '';
    let label = component.customProps?.label || component.name || '';

    if (valueKey) {
      const resolved = resolveDataPointValue(datasets, datasetId, valueKey, undefined);
      if (resolved !== undefined) value = resolved;
    }
    if (stateKey) {
      const resolved = resolveDataPointValue(datasets, datasetId, stateKey, undefined);
      if (resolved !== undefined) state = resolved;
    }
    if (unitKey) {
      const resolved = resolveDataPointValue(datasets, datasetId, unitKey, undefined);
      if (resolved !== undefined) unit = resolved;
    }

    return {
      value,
      state,
      unit,
      label
    };
  }

  // Fallback for complex structured staticData objects
  const combinedBindings: Record<string, string> = { ...(bindings || {}) };
  if (mapping.valueKey && !combinedBindings.value) combinedBindings.value = mapping.valueKey;
  if (mapping.stateKey && !combinedBindings.state) combinedBindings.state = mapping.stateKey;
  if (mapping.unitKey && !combinedBindings.unit) combinedBindings.unit = mapping.unitKey;

  const baseData = typeof dataConfig.staticData === 'object' 
    ? (Array.isArray(dataConfig.staticData) ? [...dataConfig.staticData] : { ...dataConfig.staticData }) 
    : { value: dataConfig.staticData };

  const resolved = resolveDynamicObjectValues(baseData, combinedBindings, datasets, datasetId);

  if (mapping.valueKey && resolved.value === undefined) {
    resolved.value = resolveDataPointValue(datasets, datasetId, mapping.valueKey, component.customProps?.value ?? 0);
  }
  if (mapping.stateKey && resolved.state === undefined) {
    resolved.state = resolveDataPointValue(datasets, datasetId, mapping.stateKey, component.customProps?.state ?? 0);
  }

  return resolved;
}

/**
 * Strict Live Numeric Extractor for Numeric Components
 * Guarantees that only pure numeric values are returned with direct O(1) point resolution.
 */
export function getComponentLiveNumericValue(
  component: ScreenComponent,
  datasets?: DatasetItem[],
  fallback = 0
): number {
  if (datasets) {
    syncDatasetFastIndex(datasets);
  }

  // Fast direct resolution without building any intermediate objects
  const valueKey = component.data?.bindings?.value || component.data?.mapping?.valueKey;
  if (valueKey) {
    const liveVal = resolveDataPointValue(datasets, component.data?.datasetId, valueKey, undefined);
    if (liveVal !== undefined) {
      return parseStrictNumber(liveVal, fallback);
    }
  }

  const customPropVal = component.customProps?.value;
  if (customPropVal !== undefined) {
    return parseStrictNumber(customPropVal, fallback);
  }

  if (component.data?.staticData !== undefined && typeof component.data.staticData !== 'object') {
    return parseStrictNumber(component.data.staticData, fallback);
  }

  return fallback;
}

/**
 * Resolves device tele-signal (YX) state with strict numeric enum conversion
 */
export function resolveTeleSignalState(
  datasets: DatasetItem[] | undefined,
  datasetId: string | undefined,
  stateKey: string | undefined,
  defaultVal: number | string = 0
): {
  numericValue: number;
  statusText: string;
  isClosed: boolean;
  isOpen: boolean;
  isFault: boolean;
  isTest: boolean;
  isWorking: boolean;
  color: string;
} {
  const raw = resolveDataPointValue(datasets, datasetId, stateKey, defaultVal);
  let num = 0;
  if (typeof raw === 'number') {
    num = isNaN(raw) ? 0 : raw;
  } else if (typeof raw === 'boolean') {
    num = raw ? 1 : 0;
  } else if (typeof raw === 'string') {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      num = parsed;
    } else {
      const lower = raw.toLowerCase();
      if (lower.includes('合') || lower.includes('close') || lower.includes('run') || lower === 'on') num = 1;
      else if (lower.includes('分') || lower.includes('open') || lower.includes('stop') || lower === 'off') num = 0;
      else if (lower.includes('障') || lower.includes('fault') || lower.includes('trip') || lower.includes('err')) num = 2;
      else if (lower.includes('试') || lower.includes('test')) num = 3;
      else if (lower.includes('工') || lower.includes('work')) num = 4;
    }
  }

  let statusText = `状态 (${num})`;
  let isClosed = num === 1;
  let isOpen = num === 0;
  let isFault = num === 2;
  let isTest = num === 3;
  let isWorking = num === 4 || num === 1;

  let color = '#10b981'; // Green for normal/open/0 state
  if (isClosed || isWorking) {
    color = '#ef4444'; // Red for energized/closed/1 state
  } else if (isFault) {
    color = '#f59e0b'; // Amber for fault/alarm
  } else if (isTest) {
    color = '#3b82f6'; // Blue for test position
  }

  if (num === 0) statusText = '分闸 (0)';
  else if (num === 1) statusText = '合闸 (1)';
  else if (num === 2) statusText = '故障 (2)';
  else if (num === 3) statusText = '试验位 (3)';
  else if (num === 4) statusText = '工作位 (4)';

  return {
    numericValue: num,
    statusText,
    isClosed,
    isOpen,
    isFault,
    isTest,
    isWorking,
    color
  };
}
