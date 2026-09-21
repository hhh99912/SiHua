import { DatasetItem, ScreenComponent, ScadaDeviceItem } from '../types';
import {
  scadaFacilities,
  rawYcValues,
  rawYxValues,
  rawYcQuality,
  rawYxQuality,
  scadaLiveTick,
  cachedRealtimeYc,
  cachedRealtimeYx,
  getScadaPointLiveValue
} from './scadaClient';

export { scadaLiveTick };

/**
 * Smart Component & Asset Unique Duplicate Name Generator
 */
export function generateUniqueDuplicateName(
  originalName: string,
  existingNames: string[] = [],
  fallbackBase: string = '组件'
): string {
  const cleanOriginal = (originalName || '').trim() || fallbackBase;

  let base = cleanOriginal
    .replace(/(?:[\s\-_]*[\(（]?(?:副本|copy)[\)）]?[\s\-_]*\d*)+$/gi, '')
    .trim();

  if (!base) {
    base = fallbackBase;
  }

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

  let index = hasExistingIndex ? startNumber : 1;
  let candidate = `${baseRoot}${separator}${index}`;

  while (existingSet.has(candidate.toLowerCase())) {
    index++;
    candidate = `${baseRoot}${separator}${index}`;
  }

  return candidate;
}

/**
 * Direct Truncation Number Formatter (Direct Truncation without rounding)
 */
export function formatTruncatedNumber(num: number, decimals: number, trimZeros: boolean = true): string {
  if (isNaN(num) || !isFinite(num)) return '0';
  
  const clampedDecimals = Math.max(0, Math.min(6, decimals));
  
  if (clampedDecimals === 0) {
    const intVal = Math.trunc(num);
    return Object.is(intVal, -0) ? '0' : String(intVal);
  }

  const str = String(num);
  
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
    const parsedDirect = Number(trimmed);
    if (!isNaN(parsedDirect)) return parsedDirect;

    const sanitized = trimmed.replace(/[^0-9.-]/g, '');
    if (!sanitized || sanitized === '-' || sanitized === '.') return fallback;
    const parsed = parseFloat(sanitized);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

/**
 * Global High-Performance SCADA Point Hash Cache (O(1) Direct Lookup)
 */
const globalPointIndex = new Map<string, any>();
let lastIndexedDatasetsRef: DatasetItem[] | null = null;
let lastIndexedTimestamp = 0;

/**
 * Universal ultra-fast SCADA point key parser.
 * Handles all point key variations accurately without regex false-matches on device IDs:
 * - "7000001_YC_62000001" -> pointId: 62000001, category: 'yc'
 * - "7000001_YX_61000001" -> pointId: 61000001, category: 'yx'
 * - "DEV-101_YC_1" -> pointId: 1, category: 'yc'
 * - "DEV-101_YX_2" -> pointId: 2, category: 'yx'
 * - "$bind(7000001_YC_62000001)" -> pointId: 62000001, category: 'yc'
 * - "{{7000001_YC_62000001}}" -> pointId: 62000001, category: 'yc'
 * - "62000001" -> pointId: 62000001, category: 'none'
 */
export function parseScadaPointKey(keyOrId: any): {
  pointId: number;
  category: 'yc' | 'yx' | 'dd' | 'yt' | 'none';
  rawKey: string;
} {
  if (keyOrId === null || keyOrId === undefined) {
    return { pointId: -1, category: 'none', rawKey: '' };
  }
  if (typeof keyOrId === 'number') {
    return { pointId: keyOrId, category: 'none', rawKey: String(keyOrId) };
  }

  let str = String(keyOrId).trim();
  if (str.charCodeAt(0) === 36 /* '$' */ && str.startsWith('$bind(') && str.endsWith(')')) {
    str = str.slice(6, -1).trim();
  } else if (str.charCodeAt(0) === 123 /* '{' */ && str.startsWith('{{') && str.endsWith('}}')) {
    str = str.slice(2, -2).trim();
  }

  const ycMatch = str.match(/(?:^|_)YC_(\d+)/i);
  if (ycMatch && ycMatch[1]) {
    return { pointId: parseInt(ycMatch[1], 10), category: 'yc', rawKey: str };
  }
  const yxMatch = str.match(/(?:^|_)YX_(\d+)/i);
  if (yxMatch && yxMatch[1]) {
    return { pointId: parseInt(yxMatch[1], 10), category: 'yx', rawKey: str };
  }
  const ddMatch = str.match(/(?:^|_)DD_(\d+)/i);
  if (ddMatch && ddMatch[1]) {
    return { pointId: parseInt(ddMatch[1], 10), category: 'dd', rawKey: str };
  }
  const ytMatch = str.match(/(?:^|_)YT_(\d+)/i);
  if (ytMatch && ytMatch[1]) {
    return { pointId: parseInt(ytMatch[1], 10), category: 'yt', rawKey: str };
  }

  if (/^\d+$/.test(str)) {
    return { pointId: parseInt(str, 10), category: 'none', rawKey: str };
  }

  const tailMatch = str.match(/_(\d+)$/);
  if (tailMatch && tailMatch[1]) {
    return { pointId: parseInt(tailMatch[1], 10), category: 'none', rawKey: str };
  }

  return { pointId: -1, category: 'none', rawKey: str };
}

/**
 * Indexes datasets into a flat O(1) point map and populates raw memory maps
 */
export function syncDatasetFastIndex(datasets?: DatasetItem[]) {
  if (datasets && datasets === lastIndexedDatasetsRef && Date.now() - lastIndexedTimestamp < 400) {
    return;
  }

  if (datasets && datasets.length > 0) {
    lastIndexedDatasetsRef = datasets;
    lastIndexedTimestamp = Date.now();

    for (let i = 0; i < datasets.length; i++) {
      const ds = datasets[i];
      if (!ds) continue;
      
      if (ds.data) {
        const dataKeys = Object.keys(ds.data);
        for (let k = 0; k < dataKeys.length; k++) {
          const key = dataKeys[k];
          const val = ds.data[key];
          globalPointIndex.set(key, val);
          const parsed = parseScadaPointKey(key);
          if (parsed.pointId > 0 && typeof val === 'number') {
            if (parsed.category === 'yx') {
              rawYxValues.set(parsed.pointId, val);
            } else {
              rawYcValues.set(parsed.pointId, val);
            }
          }
        }
      }

      if (Array.isArray(ds.devices)) {
        for (let d = 0; d < ds.devices.length; d++) {
          const dev = ds.devices[d];
          const devId = dev.deviceId;

          if (dev.telemetries) {
            for (let p = 0; p < dev.telemetries.length; p++) {
              const pt = dev.telemetries[p];
              const ptId = Number(pt.pointId);
              const numVal = Number(pt.value) || 0;
              globalPointIndex.set(`${devId}_YC_${pt.pointId}`, numVal);
              globalPointIndex.set(String(pt.pointId), numVal);
              if (!isNaN(ptId) && ptId > 0) {
                rawYcValues.set(ptId, numVal);
                rawYcQuality.set(ptId, 1);
              }
            }
          }
          if (dev.teleSignals) {
            for (let p = 0; p < dev.teleSignals.length; p++) {
              const pt = dev.teleSignals[p];
              const ptId = Number(pt.pointId);
              const numVal = Number(pt.value) || 0;
              globalPointIndex.set(`${devId}_YX_${pt.pointId}`, numVal);
              globalPointIndex.set(String(pt.pointId), numVal);
              if (!isNaN(ptId) && ptId > 0) {
                rawYxValues.set(ptId, numVal);
                rawYxQuality.set(ptId, 1);
              }
            }
          }
          if (dev.energies) {
            for (let p = 0; p < dev.energies.length; p++) {
              const pt = dev.energies[p];
              const ptId = Number(pt.pointId);
              const numVal = Number(pt.value) || 0;
              globalPointIndex.set(`${devId}_DD_${pt.pointId}`, numVal);
              if (!isNaN(ptId) && ptId > 0) {
                rawYcValues.set(ptId, numVal);
              }
            }
          }
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
}

/**
 * Resolves a telemetry/tele-signal/energy value from bound dataset or point key.
 */
export function resolveDataPointValue(
  datasets: DatasetItem[] | undefined,
  datasetId: string | undefined,
  keyOrExpr: string | undefined,
  fallbackVal: any = undefined
): any {
  if (keyOrExpr === null || keyOrExpr === undefined || keyOrExpr === '') {
    return fallbackVal;
  }

  const parsed = parseScadaPointKey(keyOrExpr);
  const cleanKey = parsed.rawKey;

  // 1. Fast direct integer lookup in raw memory maps (<10ns)
  if (parsed.pointId > 0) {
    if (parsed.category === 'yc') {
      const v = rawYcValues.get(parsed.pointId);
      if (v !== undefined) return v;
    } else if (parsed.category === 'yx') {
      const v = rawYxValues.get(parsed.pointId);
      if (v !== undefined) return v;
    } else if (parsed.category === 'dd') {
      const v = rawYcValues.get(parsed.pointId);
      if (v !== undefined) return v;
    } else {
      if (rawYcValues.has(parsed.pointId)) {
        return rawYcValues.get(parsed.pointId);
      }
      if (rawYxValues.has(parsed.pointId)) {
        return rawYxValues.get(parsed.pointId);
      }
    }
  }

  // 2. Fast O(1) hash map lookup
  if (cleanKey && globalPointIndex.has(cleanKey)) {
    return globalPointIndex.get(cleanKey);
  }

  // 3. Search in datasets
  if (datasets && datasets.length > 0) {
    const primaryDs = datasetId ? datasets.find(d => d.id === datasetId || String(d.id).includes(datasetId)) : datasets[0];
    const searchOrder = primaryDs ? [primaryDs, ...datasets.filter(d => d !== primaryDs)] : datasets;

    for (let i = 0; i < searchOrder.length; i++) {
      const ds = searchOrder[i];
      if (!ds) continue;

      if (ds.data && ds.data[cleanKey] !== undefined) {
        globalPointIndex.set(cleanKey, ds.data[cleanKey]);
        return ds.data[cleanKey];
      }

      if (Array.isArray(ds.devices)) {
        for (let d = 0; d < ds.devices.length; d++) {
          const dev = ds.devices[d];
          const devId = dev.deviceId;

          if (dev.telemetries) {
            for (let p = 0; p < dev.telemetries.length; p++) {
              const yc = dev.telemetries[p];
              if (
                cleanKey === `${devId}_YC_${yc.pointId}` ||
                cleanKey === String(yc.pointId) ||
                (parsed.pointId > 0 && yc.pointId === parsed.pointId)
              ) {
                globalPointIndex.set(cleanKey, yc.value);
                return yc.value;
              }
            }
          }

          if (dev.teleSignals) {
            for (let p = 0; p < dev.teleSignals.length; p++) {
              const yx = dev.teleSignals[p];
              if (
                cleanKey === `${devId}_YX_${yx.pointId}` ||
                cleanKey === String(yx.pointId) ||
                (parsed.pointId > 0 && yx.pointId === parsed.pointId)
              ) {
                globalPointIndex.set(cleanKey, yx.value);
                return yx.value;
              }
            }
          }

          if (dev.energies) {
            for (let p = 0; p < dev.energies.length; p++) {
              const dd = dev.energies[p];
              if (
                cleanKey === `${devId}_DD_${dd.pointId}` ||
                cleanKey === String(dd.pointId) ||
                (parsed.pointId > 0 && dd.pointId === parsed.pointId)
              ) {
                globalPointIndex.set(cleanKey, dd.value);
                return dd.value;
              }
            }
          }
        }
      }
    }
  }

  return fallbackVal;
}

/**
 * Updates a point in datasets
 */
export function updateScadaPointTelemetry(
  datasets: DatasetItem[] | undefined,
  datasetId: string | undefined,
  pointKey: string,
  newValue: any
): boolean {
  if (!datasets || !pointKey) return false;
  let updated = false;

  const parsed = parseScadaPointKey(pointKey);
  if (parsed.pointId > 0) {
    const numVal = Number(newValue) || 0;
    if (parsed.category === 'yx') {
      rawYxValues.set(parsed.pointId, numVal);
    } else {
      rawYcValues.set(parsed.pointId, numVal);
    }
  }

  globalPointIndex.set(pointKey, newValue);

  datasets.forEach(ds => {
    if (!datasetId || ds.id === datasetId) {
      if (ds.data && ds.data[pointKey] !== undefined) {
        ds.data[pointKey] = newValue;
        updated = true;
      }
      if (Array.isArray(ds.devices)) {
        ds.devices.forEach(dev => {
          (dev.telemetries || []).forEach(yc => {
            if (String(yc.pointId) === pointKey || `${dev.deviceId}_YC_${yc.pointId}` === pointKey) {
              yc.value = newValue;
              updated = true;
            }
          });
          (dev.teleSignals || []).forEach(yx => {
            if (String(yx.pointId) === pointKey || `${dev.deviceId}_YX_${yx.pointId}` === pointKey) {
              yx.value = newValue;
              yx.statusText = newValue === 1 ? '合闸 (1)' : (newValue === 2 ? '故障 (2)' : '分闸 (0)');
              updated = true;
            }
          });
        });
      }
    }
  });

  return updated;
}

/**
 * Evaluates safe dynamic math/status expressions
 */
export function evaluateDynamicExpression(
  expression: string,
  datasets: DatasetItem[] | undefined,
  datasetId?: string,
  fallbackVal: any = undefined
): any {
  if (!expression || typeof expression !== 'string') return fallbackVal;

  const trimmed = expression.trim();
  if (trimmed.startsWith('$bind(') && trimmed.endsWith(')')) {
    const key = trimmed.slice(6, -1).trim();
    return resolveDataPointValue(datasets, datasetId, key, fallbackVal);
  }

  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
    const key = trimmed.slice(2, -2).trim();
    return resolveDataPointValue(datasets, datasetId, key, fallbackVal);
  }

  return resolveDataPointValue(datasets, datasetId, trimmed, fallbackVal);
}

/**
 * Resolves a dynamic object with property bindings
 */
export function resolveDynamicObjectValues(
  baseObject: any,
  bindings: Record<string, string> | undefined,
  datasets: DatasetItem[] | undefined,
  datasetId?: string
): any {
  if (!baseObject || typeof baseObject !== 'object') {
    return baseObject;
  }

  const result = Array.isArray(baseObject) ? [...baseObject] : { ...baseObject };

  if (bindings && typeof bindings === 'object') {
    Object.keys(bindings).forEach(propPath => {
      const bindingExpr = bindings[propPath];
      if (bindingExpr) {
        const resolvedVal = evaluateDynamicExpression(bindingExpr, datasets, datasetId, undefined);
        if (resolvedVal !== undefined) {
          result[propPath] = resolvedVal;
        }
      }
    });
  }

  return result;
}

/**
 * Comprehensive Component Live Value Resolver
 */
export function getComponentLiveValue(
  component: ScreenComponent,
  datasets?: DatasetItem[]
): any {
  const _tick = scadaLiveTick.value;
  if (!component) return { value: 0, state: 0, unit: '', label: '', quality: 0 };

  const dataConfig = component.data;
  const mapping = dataConfig?.mapping || {};
  const bindings = dataConfig?.bindings || {};
  const datasetId = dataConfig?.datasetId;

  const valueKey = bindings.value || mapping.valueKey || (mapping.pointCategory === 'telemetry' ? mapping.pointId : undefined);
  const stateKey = bindings.state || mapping.stateKey || (mapping.pointCategory === 'teleSignal' ? mapping.pointId : undefined);
  const unit = (mapping as any).unit || component.customProps?.unit || '';
  const label = mapping.pointName || mapping.deviceName || component.name || '';

  let value: any = undefined;
  let state: any = undefined;

  if (valueKey !== undefined && valueKey !== null && valueKey !== '') {
    value = resolveDataPointValue(datasets, datasetId, String(valueKey), undefined);
  }
  if (stateKey !== undefined && stateKey !== null && stateKey !== '') {
    state = resolveDataPointValue(datasets, datasetId, String(stateKey), undefined);
  }

  if (value === undefined && component.customProps?.value !== undefined) {
    value = component.customProps.value;
  }
  if (state === undefined && component.customProps?.state !== undefined) {
    state = component.customProps.state;
  }

  if (value === undefined && state === undefined && dataConfig?.staticData !== undefined) {
    if (typeof dataConfig.staticData === 'object' && dataConfig.staticData !== null) {
      value = dataConfig.staticData.value;
      state = dataConfig.staticData.state;
    } else {
      value = dataConfig.staticData;
    }
  }

  if (value === undefined) value = 0;
  if (state === undefined) state = value;

  const isChart = ['chart-line', 'chart-bar', 'chart-pie', 'chart-gauge', 'chart-radar', 'gauge-dashboard'].includes(component.type);
  if (!isChart) {
    const hasBinding = !!(valueKey || stateKey);
    const floatVal = typeof value === 'number' ? (isNaN(value) ? 0 : value) : (parseFloat(String(value)) || 0);
    const numState = typeof state === 'number' ? (isNaN(state) ? 0 : state) : (parseFloat(String(state)) || 0);
    const quality = hasBinding ? 1 : 0;
    return {
      value: stateKey && !valueKey ? numState : floatVal,
      state: numState,
      unit,
      label,
      quality
    };
  }

  return {
    value,
    state,
    unit,
    label
  };
}

/**
 * Alias for getComponentLiveValue
 */
export const resolveComponentDynamicData = getComponentLiveValue;

/**
 * Ultra-Fast Direct Numeric Extractor for Numeric Components
 * Guarantees direct O(1) integer lookup in raw memory with seamless fallback to dataset lookup.
 */
export function getComponentLiveNumericValue(
  component: ScreenComponent,
  datasets?: DatasetItem[],
  fallback = 0
): number {
  const _tick = scadaLiveTick.value;
  if (!component) return fallback;

  // 1. If static override mode is explicitly set
  if (component.data?.useStatic === true) {
    if (component.data.staticData !== undefined) {
      if (typeof component.data.staticData === 'object' && component.data.staticData !== null) {
        return parseStrictNumber(component.data.staticData.value ?? component.data.staticData.state, fallback);
      }
      return parseStrictNumber(component.data.staticData, fallback);
    }
    if (component.customProps?.value !== undefined) {
      return parseStrictNumber(component.customProps.value, fallback);
    }
  }

  // 2. Check for dynamic data bindings / mapping keys
  const valKey = component.data?.bindings?.value ||
                 component.data?.mapping?.valueKey ||
                 component.data?.mapping?.pointId ||
                 component.data?.bindings?.state ||
                 component.data?.mapping?.stateKey;
  const datasetId = component.data?.datasetId;

  if (valKey !== undefined && valKey !== null && valKey !== '') {
    // Fast path A: if numeric pointId is stored directly in mapping
    if (component.data?.mapping?.pointId !== undefined && component.data?.mapping?.pointId !== null && component.data.mapping.pointId !== '') {
      const pid = Number(component.data.mapping.pointId);
      if (!isNaN(pid) && pid > 0) {
        if (rawYcValues.has(pid)) {
          return rawYcValues.get(pid)!;
        }
        if (rawYxValues.has(pid)) {
          return rawYxValues.get(pid)!;
        }
      }
    }

    // Fast path B: resolve via resolveDataPointValue
    const resolved = resolveDataPointValue(datasets, datasetId, String(valKey), undefined);
    if (resolved !== undefined && resolved !== null) {
      return parseStrictNumber(resolved, fallback);
    }
  }

  // 3. Fallback: staticData / customProps / component.data.value
  if (component.data?.staticData !== undefined && component.data?.staticData !== null) {
    if (typeof component.data.staticData === 'object') {
      if (component.data.staticData.value !== undefined) {
        return parseStrictNumber(component.data.staticData.value, fallback);
      }
      if (component.data.staticData.state !== undefined) {
        return parseStrictNumber(component.data.staticData.state, fallback);
      }
    } else {
      return parseStrictNumber(component.data.staticData, fallback);
    }
  }

  if (component.customProps?.value !== undefined) {
    return parseStrictNumber(component.customProps.value, fallback);
  }

  if ((component.data as any)?.value !== undefined) {
    return parseStrictNumber((component.data as any).value, fallback);
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
  defaultVal: number | string = 0,
  component?: ScreenComponent
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
  const _tick = scadaLiveTick.value;
  let num: number | undefined = undefined;

  const effStateKey = stateKey ||
                      component?.data?.bindings?.state ||
                      component?.data?.mapping?.stateKey ||
                      component?.data?.mapping?.pointId ||
                      component?.data?.bindings?.value ||
                      component?.data?.mapping?.valueKey;
  const effDatasetId = datasetId || component?.data?.datasetId;

  // 1. Direct pointId check from component mapping
  if (component?.data?.mapping?.pointId !== undefined && component?.data?.mapping?.pointId !== null && component.data.mapping.pointId !== '') {
    const pid = Number(component.data.mapping.pointId);
    if (!isNaN(pid) && pid > 0) {
      if (rawYxValues.has(pid)) {
        num = rawYxValues.get(pid);
      } else if (rawYcValues.has(pid)) {
        num = rawYcValues.get(pid);
      }
    }
  }

  // 2. Resolve through resolveDataPointValue if not yet resolved
  if (num === undefined && effStateKey) {
    const raw = resolveDataPointValue(datasets, effDatasetId, String(effStateKey), undefined);
    if (raw !== undefined && raw !== null) {
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
    }
  }

  // 3. Fallback to customProps / staticData / defaultVal
  if (num === undefined) {
    const fallbackRaw = component?.customProps?.state ??
                        component?.customProps?.value ??
                        component?.data?.staticData?.state ??
                        component?.data?.staticData?.value ??
                        defaultVal;
    if (typeof fallbackRaw === 'number') {
      num = isNaN(fallbackRaw) ? 0 : fallbackRaw;
    } else if (typeof fallbackRaw === 'boolean') {
      num = fallbackRaw ? 1 : 0;
    } else {
      const parsed = parseInt(String(fallbackRaw), 10);
      num = isNaN(parsed) ? 0 : parsed;
    }
  }

  let statusText = `状态 (${num})`;
  const isClosed = num === 1;
  const isOpen = num === 0;
  const isFault = num === 2;
  const isTest = num === 3;
  const isWorking = num === 4 || num === 1;

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
