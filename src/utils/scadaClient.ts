import { ref, shallowRef } from 'vue';
import {
  ScadaFacilityNode,
  ScadaBayNode,
  ScadaDeviceNode,
  ScadaYcItem,
  ScadaYxItem,
  ScadaConfigResponse,
  ScadaRealtimeRequest,
  ScadaRealtimeResponse,
  ScadaRealtimeYcItem,
  ScadaRealtimeYxItem,
  DatasetItem,
  ScadaDeviceItem
} from '../types';

// Default SCADA Host & Port
const STORAGE_KEY_SCADA_API = 'scada_api_base_url';
const STORAGE_KEY_SCADA_CONFIG = 'scada_local_config_json';
export const DEFAULT_SCADA_API_URL = 'http://127.0.0.1:36581';

export function getScadaApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(STORAGE_KEY_SCADA_API);
    if (saved && saved.trim()) return saved.trim();
  }
  return DEFAULT_SCADA_API_URL;
}

export function setScadaApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY_SCADA_API, url.trim());
  }
}

// ---------------------------------------------------------------------------
// Standard SCADA Hierarchy Preset (Lightweight Structure without mock numbers)
// ---------------------------------------------------------------------------
export const PRESET_SCADA_FACILITIES: ScadaFacilityNode[] = [
  {
    fac_id: 4000003,
    fac_name: '苏州晟高',
    bays: [
      {
        bay_id: 430000001,
        bay_name: '苏州晟高一体柜',
        devices: [
          {
            dev_id: 7000001,
            dev_name: '6',
            cbty: 0,
            yc_list: [
              { id: 62000001, name: 'yc01', type: 0 },
              { id: 62000002, name: 'yc02', type: 0 },
              { id: 62000003, name: 'yc03', type: 0 },
              { id: 62000004, name: 'yc04', type: 0 },
              { id: 62000005, name: 'yc05', type: 0 },
              { id: 62000006, name: 'yc06', type: 0 },
              { id: 62000007, name: 'yc07', type: 0 },
              { id: 62000008, name: 'yc08', type: 0 },
              { id: 62000009, name: 'yc09', type: 0 },
              { id: 62000010, name: 'yc10', type: 0 },
              { id: 62000011, name: 'yc11', type: 0 },
              { id: 62000012, name: 'yc12', type: 0 },
              { id: 62000013, name: 'yc13', type: 0 },
              { id: 62000014, name: 'yc14', type: 0 },
              { id: 62000015, name: 'yc15', type: 0 },
              { id: 62000016, name: 'yc16', type: 0 },
              { id: 62000017, name: 'yc17', type: 0 },
              { id: 62000018, name: 'yc18', type: 0 },
              { id: 62000019, name: 'yc19', type: 0 },
              { id: 62000020, name: 'yc20', type: 0 },
              { id: 62000021, name: 'yc21', type: 0 },
              { id: 62000022, name: 'yc22', type: 0 },
              { id: 62000023, name: 'yc23', type: 0 },
              { id: 62000024, name: 'yc24', type: 0 }
            ],
            yx_list: [
              { id: 61000001, name: 'yx01', type: 0 },
              { id: 61000002, name: 'yx02', type: 0 },
              { id: 61000003, name: 'yx03', type: 0 },
              { id: 61000004, name: 'yx04', type: 0 },
              { id: 61000005, name: 'yx05', type: 0 },
              { id: 61000006, name: 'yx06', type: 0 },
              { id: 61000007, name: 'yx07', type: 0 },
              { id: 61000008, name: 'yx08', type: 0 },
              { id: 61000009, name: 'yx09', type: 0 },
              { id: 61000010, name: 'yx10', type: 0 },
              { id: 61000011, name: 'yx11', type: 0 },
              { id: 61000012, name: 'yx12', type: 0 },
              { id: 61000013, name: 'yx13', type: 0 },
              { id: 61000014, name: 'yx14', type: 0 },
              { id: 61000015, name: 'yx15', type: 0 },
              { id: 61000016, name: 'yx16', type: 0 },
              { id: 61000017, name: 'yx17', type: 0 },
              { id: 61000018, name: 'yx18', type: 0 },
              { id: 61000019, name: 'yx19', type: 0 },
              { id: 61000020, name: 'yx20', type: 0 },
              { id: 61000021, name: 'yx21', type: 0 },
              { id: 61000022, name: 'yx22', type: 0 },
              { id: 61000023, name: 'yx23', type: 0 },
              { id: 61000024, name: 'yx24', type: 0 }
            ]
          }
        ]
      }
    ]
  }
];

// ---------------------------------------------------------------------------
// High-Performance Primitive Raw Telemetry Storage (Zero Vue Proxy Overhead)
// ---------------------------------------------------------------------------
// Direct Map<number, number> provides 10-nanosecond O(1) lookups on weak CPUs
export const rawYcValues = new Map<number, number>();
export const rawYxValues = new Map<number, number>();
export const rawYcQuality = new Map<number, number>();
export const rawYxQuality = new Map<number, number>();

// Single reactive pulse ticker: triggers all 300+ canvas widgets in ONE single Vue tick
export const scadaLiveTick = ref<number>(0);

// Backward-compatible structures
export const cachedRealtimeYc = new Map<number, ScadaRealtimeYcItem>();
export const cachedRealtimeYx = new Map<number, ScadaRealtimeYxItem>();

// Initialize default zero points
PRESET_SCADA_FACILITIES.forEach(fac => {
  fac.bays?.forEach(bay => {
    bay.devices?.forEach(dev => {
      dev.yc_list?.forEach(yc => {
        rawYcValues.set(yc.id, 0);
        rawYcQuality.set(yc.id, 1);
        cachedRealtimeYc.set(yc.id, { id: yc.id, val: 0, status: 1 });
      });
      dev.yx_list?.forEach(yx => {
        rawYxValues.set(yx.id, 0);
        rawYxQuality.set(yx.id, 1);
        cachedRealtimeYx.set(yx.id, { id: yx.id, val: 0, status: 1, q: 0 });
      });
    });
  });
});

// Fast Getter Helpers (Zero GC, Zero String Allocation)
export function getFastLiveYc(pointId: number): number | undefined {
  return rawYcValues.get(pointId);
}

export function getFastLiveYx(pointId: number): number | undefined {
  return rawYxValues.get(pointId);
}

// Global SCADA Facilities State (ShallowRef to prevent deep proxy traversal)
export const scadaFacilities = shallowRef<ScadaFacilityNode[]>([...PRESET_SCADA_FACILITIES]);

// Request Status State
export const isConfigLoading = ref<boolean>(false);
export const isRealtimeLoading = ref<boolean>(false);
export const scadaApiConnStatus = ref<'connected' | 'disconnected' | 'idle'>('idle');
export const scadaApiErrorMessage = ref<string>('');
export const lastRealtimeSyncTime = ref<string>('');

/**
 * Sanitize facility tree to bare minimum lightweight objects
 */
export function sanitizeFacilities(rawList: any[]): ScadaFacilityNode[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.map(fac => ({
    fac_id: Number(fac.fac_id) || 0,
    fac_name: String(fac.fac_name || '未命名厂站'),
    bays: Array.isArray(fac.bays)
      ? fac.bays.map((bay: any) => ({
          bay_id: Number(bay.bay_id) || 0,
          bay_name: String(bay.bay_name || '未命名间隔'),
          devices: Array.isArray(bay.devices)
            ? bay.devices.map((dev: any) => ({
                dev_id: Number(dev.dev_id) || 0,
                dev_name: String(dev.dev_name || '未命名装置'),
                cbty: Number(dev.cbty ?? 0),
                yc_list: Array.isArray(dev.yc_list)
                  ? dev.yc_list.map((yc: any) => ({
                      id: Number(yc.id) || 0,
                      name: String(yc.name || ''),
                      type: Number(yc.type ?? 0)
                    }))
                  : [],
                yx_list: Array.isArray(dev.yx_list)
                  ? dev.yx_list.map((yx: any) => ({
                      id: Number(yx.id) || 0,
                      name: String(yx.name || ''),
                      type: Number(yx.type ?? 0)
                    }))
                  : []
              }))
            : []
        }))
      : []
  }));
}

/**
 * Load local scada_config.json on startup (Only once!)
 */
export async function loadLocalScadaConfigFile(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && (window as any).electron?.scada?.getConfigFile) {
      const res = await (window as any).electron.scada.getConfigFile();
      if (res && res.success && res.data) {
        let parsedData: any = null;
        if (typeof res.data === 'string') {
          parsedData = JSON.parse(res.data);
        } else if (Array.isArray(res.data)) {
          parsedData = res.data;
        } else if (res.data.data && Array.isArray(res.data.data)) {
          parsedData = res.data.data;
        }

        if (Array.isArray(parsedData) && parsedData.length > 0) {
          const cleanFacs = sanitizeFacilities(parsedData);
          scadaFacilities.value = cleanFacs;
          // Seed raw maps with 0
          cleanFacs.forEach(fac => {
            fac.bays?.forEach(bay => {
              bay.devices?.forEach(dev => {
                dev.yc_list?.forEach(yc => {
                  if (!rawYcValues.has(yc.id)) {
                    rawYcValues.set(yc.id, 0);
                    rawYcQuality.set(yc.id, 1);
                  }
                });
                dev.yx_list?.forEach(yx => {
                  if (!rawYxValues.has(yx.id)) {
                    rawYxValues.set(yx.id, 0);
                    rawYxQuality.set(yx.id, 1);
                  }
                });
              });
            });
          });
          return true;
        }
      }
    }

    // Fallback: localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedStr = window.localStorage.getItem(STORAGE_KEY_SCADA_CONFIG);
      if (savedStr) {
        const parsed = JSON.parse(savedStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          scadaFacilities.value = sanitizeFacilities(parsed);
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('[SCADA] 读取本地 scada_config.json 失败:', err);
  }
  return false;
}

/**
 * Persist config to local scada_config.json
 */
export async function saveLocalScadaConfigFile(facilities: ScadaFacilityNode[]): Promise<boolean> {
  try {
    const cleanData = sanitizeFacilities(facilities);
    const jsonStr = JSON.stringify(cleanData, null, 2);

    if (typeof window !== 'undefined' && (window as any).electron?.scada?.saveConfigFile) {
      const res = await (window as any).electron.scada.saveConfigFile(jsonStr);
      if (res && res.success) {
        return true;
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY_SCADA_CONFIG, jsonStr);
      return true;
    }
  } catch (err) {
    console.warn('[SCADA] 写入本地 scada_config.json 失败:', err);
  }
  return false;
}

/**
 * Fetch SCADA Config: GET /api/scada/config
 */
export async function fetchScadaConfig(apiUrl?: string): Promise<{
  success: boolean;
  data?: ScadaFacilityNode[];
  error?: string;
}> {
  const baseUrl = (apiUrl || getScadaApiBaseUrl()).replace(/\/+$/, '');
  const url = `${baseUrl}/api/scada/config`;

  isConfigLoading.value = true;
  scadaApiErrorMessage.value = '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const resJson: ScadaConfigResponse = await response.json();
    if (resJson && resJson.code === 200 && Array.isArray(resJson.data)) {
      const cleanList = sanitizeFacilities(resJson.data);
      scadaFacilities.value = cleanList;
      rebuildScadaPointLookupMap();

      cleanList.forEach(fac => {
        fac.bays?.forEach(bay => {
          bay.devices?.forEach(dev => {
            dev.yc_list?.forEach(yc => {
              if (!rawYcValues.has(yc.id)) {
                rawYcValues.set(yc.id, 0);
                rawYcQuality.set(yc.id, 1);
              }
            });
            dev.yx_list?.forEach(yx => {
              if (!rawYxValues.has(yx.id)) {
                rawYxValues.set(yx.id, 0);
                rawYxQuality.set(yx.id, 1);
              }
            });
          });
        });
      });

      // Synchronously write to local JSON file
      await saveLocalScadaConfigFile(cleanList);

      scadaApiConnStatus.value = 'connected';
      scadaApiErrorMessage.value = '';
      return { success: true, data: cleanList };
    } else {
      throw new Error(resJson?.msg || 'SCADA 配置返回格式错误');
    }
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? '请求配置超时' : (err?.message || '无法连接 SCADA 配置接口');
    scadaApiConnStatus.value = 'disconnected';
    scadaApiErrorMessage.value = msg;
    return { success: false, error: msg };
  } finally {
    isConfigLoading.value = false;
  }
}

/**
 * Fetch SCADA Realtime Data: POST /api/scada/realtime
 * High-performance batch update: directly mutates raw typed maps and fires a SINGLE reactive pulse tick.
 */
export async function fetchScadaRealtime(
  req: ScadaRealtimeRequest,
  apiUrl?: string
): Promise<{
  success: boolean;
  data?: { yc: ScadaRealtimeYcItem[]; yx: ScadaRealtimeYxItem[] };
  error?: string;
}> {
  const baseUrl = (apiUrl || getScadaApiBaseUrl()).replace(/\/+$/, '');
  const url = `${baseUrl}/api/scada/realtime`;

  isRealtimeLoading.value = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        yc_ids: req.yc_ids || [],
        yx_ids: req.yx_ids || []
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const resJson: ScadaRealtimeResponse = await response.json();
    if (resJson && resJson.code === 200 && resJson.data) {
      const { yc = [], yx = [] } = resJson.data;

      // Tight synchronous loop for maximum CPU cache locality & performance
      for (let i = 0; i < yc.length; i++) {
        const item = yc[i];
        const val = item.val ?? 0;
        rawYcValues.set(item.id, val);
        if (item.status !== undefined) rawYcQuality.set(item.id, item.status);
        cachedRealtimeYc.set(item.id, item);
      }

      for (let i = 0; i < yx.length; i++) {
        const item = yx[i];
        const val = item.val ?? 0;
        rawYxValues.set(item.id, val);
        if (item.status !== undefined) rawYxQuality.set(item.id, item.status);
        cachedRealtimeYx.set(item.id, item);
      }

      // Single batched tick to update all bound components at once
      scadaLiveTick.value++;

      lastRealtimeSyncTime.value = new Date().toLocaleTimeString();
      scadaApiConnStatus.value = 'connected';
      scadaApiErrorMessage.value = '';

      return { success: true, data: resJson.data };
    } else {
      throw new Error(resJson?.msg || '实时数据接口返回异常状态');
    }
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? '实时请求超时' : (err?.message || '无法获取实时数据');
    scadaApiConnStatus.value = 'disconnected';
    scadaApiErrorMessage.value = msg;
    return { success: false, error: msg };
  } finally {
    isRealtimeLoading.value = false;
  }
}

/**
 * Direct Point Lookup in Cache (defaults strictly to 0)
 */
export function getScadaPointLiveValue(pointId: number | string): {
  found: boolean;
  type: 'yc' | 'yx' | 'none';
  value: number;
  status: number;
  q?: number;
} {
  let numId = typeof pointId === 'number' ? pointId : -1;
  let category: 'yc' | 'yx' | 'none' = 'none';

  if (numId === -1 && typeof pointId === 'string') {
    const ycMatch = pointId.match(/(?:^|_)YC_(\d+)/i);
    if (ycMatch) {
      numId = parseInt(ycMatch[1], 10);
      category = 'yc';
    } else {
      const yxMatch = pointId.match(/(?:^|_)YX_(\d+)/i);
      if (yxMatch) {
        numId = parseInt(yxMatch[1], 10);
        category = 'yx';
      } else {
        const pureMatch = pointId.match(/^\d+$/) || pointId.match(/_(\d+)$/);
        if (pureMatch) {
          numId = parseInt(pureMatch[0].replace(/^_/, ''), 10);
        }
      }
    }
  }

  if (numId > 0) {
    if (category === 'yc') {
      if (rawYcValues.has(numId)) {
        return { found: true, type: 'yc', value: rawYcValues.get(numId) ?? 0, status: rawYcQuality.get(numId) ?? 1 };
      }
    } else if (category === 'yx') {
      if (rawYxValues.has(numId)) {
        return { found: true, type: 'yx', value: rawYxValues.get(numId) ?? 0, status: rawYxQuality.get(numId) ?? 0, q: 0 };
      }
    } else {
      if (rawYcValues.has(numId)) {
        return { found: true, type: 'yc', value: rawYcValues.get(numId) ?? 0, status: rawYcQuality.get(numId) ?? 1 };
      }
      if (rawYxValues.has(numId)) {
        return { found: true, type: 'yx', value: rawYxValues.get(numId) ?? 0, status: rawYxQuality.get(numId) ?? 0, q: 0 };
      }
    }
  }
  return { found: false, type: 'none', value: 0, status: 0 };
}

// ---------------------------------------------------------------------------
// High-Speed O(1) Point Lookup Hash Index
// ---------------------------------------------------------------------------
const scadaPointLookupMap = new Map<number, {
  facility: ScadaFacilityNode;
  bay: ScadaBayNode;
  device: ScadaDeviceNode;
  point: ScadaYcItem | ScadaYxItem;
  category: 'yc' | 'yx';
}>();

export function rebuildScadaPointLookupMap() {
  scadaPointLookupMap.clear();
  const facs = scadaFacilities.value || [];
  for (let f = 0; f < facs.length; f++) {
    const fac = facs[f];
    const bays = fac.bays || [];
    for (let b = 0; b < bays.length; b++) {
      const bay = bays[b];
      const devs = bay.devices || [];
      for (let d = 0; d < devs.length; d++) {
        const dev = devs[d];
        const ycs = dev.yc_list || [];
        for (let y = 0; y < ycs.length; y++) {
          const yc = ycs[y];
          if (typeof yc.id === 'number') {
            scadaPointLookupMap.set(yc.id, { facility: fac, bay, device: dev, point: yc, category: 'yc' });
          }
        }
        const yxs = dev.yx_list || [];
        for (let x = 0; x < yxs.length; x++) {
          const yx = yxs[x];
          if (typeof yx.id === 'number') {
            scadaPointLookupMap.set(yx.id, { facility: fac, bay, device: dev, point: yx, category: 'yx' });
          }
        }
      }
    }
  }
}

/**
 * Find point definition in loaded facilities with O(1) performance
 */
export function findScadaPointDef(pointId: number | string): {
  facility?: ScadaFacilityNode;
  bay?: ScadaBayNode;
  device?: ScadaDeviceNode;
  point?: ScadaYcItem | ScadaYxItem;
  category: 'yc' | 'yx' | 'none';
} {
  const numId = typeof pointId === 'number' ? pointId : parseInt(String(pointId).replace(/[^0-9]/g, ''), 10);
  if (isNaN(numId)) return { category: 'none' };

  if (scadaPointLookupMap.size === 0 && (scadaFacilities.value?.length || 0) > 0) {
    rebuildScadaPointLookupMap();
  }

  const found = scadaPointLookupMap.get(numId);
  if (found) {
    return found;
  }

  return { category: 'none' };
}

export function getAllPointIdsFromFacilities(facs: ScadaFacilityNode[] = scadaFacilities.value): {
  yc_ids: number[];
  yx_ids: number[];
} {
  const yc_ids: number[] = [];
  const yx_ids: number[] = [];

  facs.forEach(fac => {
    (fac.bays || []).forEach(bay => {
      (bay.devices || []).forEach(dev => {
        (dev.yc_list || []).forEach(yc => {
          if (typeof yc.id === 'number') yc_ids.push(yc.id);
        });
        (dev.yx_list || []).forEach(yx => {
          if (typeof yx.id === 'number') yx_ids.push(yx.id);
        });
      });
    });
  });

  return { yc_ids, yx_ids };
}

// Memoized associated point cache to prevent array scanning on every 1s tick
let cachedAssociatedResult: { yc_ids: number[]; yx_ids: number[] } | null = null;
let lastComponentsRef: any = null;

export function invalidateAssociatedPointsCache() {
  cachedAssociatedResult = null;
  lastComponentsRef = null;
}

/**
 * Extract all unique bound/associated YC and YX point IDs from ScreenComponents
 */
export function getAssociatedPointIdsFromComponents(
  components: any[] = [],
  extraScreens: any[] = []
): { yc_ids: number[]; yx_ids: number[] } {
  if (cachedAssociatedResult && components === lastComponentsRef) {
    return cachedAssociatedResult;
  }

  const ycSet = new Set<number>();
  const yxSet = new Set<number>();

  const allComps: any[] = [...(components || [])];
  if (Array.isArray(extraScreens) && extraScreens.length > 0) {
    for (let s = 0; s < extraScreens.length; s++) {
      const scr = extraScreens[s];
      if (Array.isArray(scr?.components)) {
        allComps.push(...scr.components);
      }
    }
  }

  const totalLen = allComps.length;
  for (let i = 0; i < totalLen; i++) {
    const comp = allComps[i];
    if (!comp) continue;
    const data = comp.data || {};
    const mapping = data.mapping || {};
    const bindings = data.bindings || {};

    // 1. Direct pointId
    if (mapping.pointId !== undefined && mapping.pointId !== null && mapping.pointId !== '') {
      const pid = Number(mapping.pointId);
      if (!isNaN(pid) && pid > 0) {
        if (
          mapping.pointCategory === 'teleSignal' ||
          mapping.pointCategory === 'yx' ||
          mapping.category === 'yx' ||
          ['elec-breaker', 'elec-disconnector', 'elec-grounding', 'elec-handcart', 'ctrl-indicator'].includes(comp.type) ||
          comp.category === 'status'
        ) {
          yxSet.add(pid);
        } else {
          ycSet.add(pid);
        }
      }
    }

    // 2. Bound key pattern matching
    const candidateStrings = [
      bindings.value,
      bindings.state,
      mapping.valueKey,
      mapping.stateKey,
      mapping.pointKey
    ];

    for (let s = 0; s < candidateStrings.length; s++) {
      const str = candidateStrings[s];
      if (typeof str === 'string' && str) {
        const ycMatch = str.match(/(?:^|_)YC_(\d+)/i);
        if (ycMatch && ycMatch[1]) {
          ycSet.add(Number(ycMatch[1]));
        }
        const yxMatch = str.match(/(?:^|_)YX_(\d+)/i);
        if (yxMatch && yxMatch[1]) {
          yxSet.add(Number(yxMatch[1]));
        }
        const numMatch = str.match(/(\d{6,})/);
        if (numMatch && numMatch[1]) {
          const numId = Number(numMatch[1]);
          if (!ycSet.has(numId) && !yxSet.has(numId)) {
            const def = findScadaPointDef(numId);
            if (def.category === 'yx') {
              yxSet.add(numId);
            } else if (def.category === 'yc') {
              ycSet.add(numId);
            } else {
              if (['elec-breaker', 'elec-disconnector', 'elec-grounding', 'elec-handcart', 'ctrl-indicator'].includes(comp.type)) {
                yxSet.add(numId);
              } else {
                ycSet.add(numId);
              }
            }
          }
        }
      }
    }
  }

  cachedAssociatedResult = {
    yc_ids: Array.from(ycSet),
    yx_ids: Array.from(yxSet)
  };
  lastComponentsRef = components;

  return cachedAssociatedResult;
}

/**
 * Bridge Adapter: converts ScadaFacilityNode[] to DatasetItem[] for backward compatibility
 */
export function convertFacilitiesToDatasets(facilities: ScadaFacilityNode[] = scadaFacilities.value): DatasetItem[] {
  return facilities.map(fac => {
    const devices: ScadaDeviceItem[] = [];

    fac.bays.forEach(bay => {
      bay.devices.forEach(dev => {
        const telemetries = (dev.yc_list || []).map(yc => {
          const val = rawYcValues.get(yc.id) ?? 0;
          return {
            pointId: yc.id,
            name: yc.name,
            factor: 1.0,
            unit: '',
            value: val
          };
        });

        const teleSignals = (dev.yx_list || []).map(yx => {
          const val = rawYxValues.get(yx.id) ?? 0;
          return {
            pointId: yx.id,
            name: yx.name,
            value: val,
            statusText: val === 1 ? '合闸 (1)' : (val === 2 ? '故障 (2)' : '分闸 (0)')
          };
        });

        devices.push({
          deviceId: String(dev.dev_id),
          deviceName: `${bay.bay_name} - ${dev.dev_name}`,
          deviceType: 'SCADA采集单元',
          commStatus: 1,
          telemetries,
          teleSignals,
          energies: [],
          teleControls: [],
          teleRegulations: []
        });
      });
    });

    return {
      id: `fac-${fac.fac_id}`,
      name: fac.fac_name,
      description: `厂站 ID: ${fac.fac_id}`,
      type: 'api',
      updateIntervalMs: 1000,
      apiUrl: `${getScadaApiBaseUrl()}/api/scada/config`,
      devices,
      data: {},
      fields: []
    };
  });
}
