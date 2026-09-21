import { ref, reactive, shallowRef } from 'vue';
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

/**
 * Sanitizes facilities to the most lightweight structure:
 * Keeps only essential fields to ensure 60FPS fluid UI interaction and minimal memory usage.
 */
export function sanitizeFacilities(rawFacs: any[]): ScadaFacilityNode[] {
  if (!Array.isArray(rawFacs)) return PRESET_SCADA_FACILITIES;
  return rawFacs.map(fac => ({
    fac_id: fac.fac_id,
    fac_name: fac.fac_name || `厂站 ${fac.fac_id}`,
    bays: (fac.bays || []).map((bay: any) => ({
      bay_id: bay.bay_id,
      bay_name: bay.bay_name || `间隔 ${bay.bay_id}`,
      devices: (bay.devices || []).map((dev: any) => ({
        dev_id: dev.dev_id,
        dev_name: dev.dev_name || `装置 ${dev.dev_id}`,
        cbty: dev.cbty ?? 0,
        yc_list: (dev.yc_list || []).map((yc: any) => ({
          id: yc.id,
          name: yc.name || `yc_${yc.id}`,
          type: yc.type ?? 0
        })),
        yx_list: (dev.yx_list || []).map((yx: any) => ({
          id: yx.id,
          name: yx.name || `yx_${yx.id}`,
          type: yx.type ?? 0
        }))
      }))
    }))
  }));
}

// Global SCADA Facilities State
export const scadaFacilities = ref<ScadaFacilityNode[]>(PRESET_SCADA_FACILITIES);
export const cachedRealtimeYc = reactive<Map<number, ScadaRealtimeYcItem>>(new Map());
export const cachedRealtimeYx = reactive<Map<number, ScadaRealtimeYxItem>>(new Map());

export const isConfigLoading = ref(false);
export const isRealtimeLoading = ref(false);
export const lastRealtimeSyncTime = ref<string>('');
export const scadaApiConnStatus = ref<'connected' | 'disconnected' | 'idle'>('idle');
export const scadaApiErrorMessage = ref<string>('');

/**
 * Load local scada_config.json once at application startup.
 */
export async function loadLocalScadaConfigFile(): Promise<boolean> {
  // 1. In Electron environment: load via IPC from data/scada_config.json
  const electronApi = (window as any).electronAPI;
  if (electronApi?.scada?.getConfigFile) {
    try {
      const res = await electronApi.scada.getConfigFile();
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        scadaFacilities.value = sanitizeFacilities(res.data);
        syncPointCacheDefaults();
        return true;
      }
    } catch (err) {
      console.warn('[SCADA Client] Failed to load local scada_config.json via Electron IPC:', err);
    }
  }

  // 2. In Browser environment: try localStorage or static /data/scada_config.json
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(STORAGE_KEY_SCADA_CONFIG);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          scadaFacilities.value = sanitizeFacilities(parsed);
          syncPointCacheDefaults();
          return true;
        }
      } catch {}
    }
  }

  // Fallback: try fetching /data/scada_config.json
  try {
    const res = await fetch('/data/scada_config.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        scadaFacilities.value = sanitizeFacilities(data);
        syncPointCacheDefaults();
        return true;
      }
    }
  } catch {}

  // Fallback: sync preset
  syncPointCacheDefaults();
  return false;
}

/**
 * Persist scada_config.json to local disk (Electron) and localStorage (Browser).
 */
export async function saveLocalScadaConfigFile(data: ScadaFacilityNode[]): Promise<boolean> {
  const sanitized = sanitizeFacilities(data);
  const jsonStr = JSON.stringify(sanitized, null, 2);

  // 1. In Electron environment
  const electronApi = (window as any).electronAPI;
  if (electronApi?.scada?.saveConfigFile) {
    try {
      await electronApi.scada.saveConfigFile({ data: sanitized });
    } catch (err) {
      console.error('[SCADA Client] Failed to save scada_config.json via Electron IPC:', err);
    }
  }

  // 2. In Browser environment
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY_SCADA_CONFIG, jsonStr);
    } catch {}
  }

  return true;
}

/**
 * Reset all cached points to default 0 state (No mock numbers)
 */
function syncPointCacheDefaults(): void {
  scadaFacilities.value.forEach(fac => {
    (fac.bays || []).forEach(bay => {
      (bay.devices || []).forEach(dev => {
        (dev.yc_list || []).forEach(yc => {
          if (!cachedRealtimeYc.has(yc.id)) {
            cachedRealtimeYc.set(yc.id, {
              id: yc.id,
              status: 1,
              val: 0
            });
          }
        });
        (dev.yx_list || []).forEach(yx => {
          if (!cachedRealtimeYx.has(yx.id)) {
            cachedRealtimeYx.set(yx.id, {
              id: yx.id,
              q: 0,
              status: 0,
              val: 0
            });
          }
        });
      });
    });
  });
}

// Initial sync
syncPointCacheDefaults();

/**
 * Fetch SCADA Configuration Hierarchy: GET /api/scada/config
 * After fetching, automatically writes to local scada_config.json!
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
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const resJson: ScadaConfigResponse = await response.json();
    if (resJson && resJson.code === 200 && Array.isArray(resJson.data)) {
      const sanitized = sanitizeFacilities(resJson.data);
      scadaFacilities.value = sanitized;
      syncPointCacheDefaults();

      // Automatically sync and persist to local scada_config.json file
      await saveLocalScadaConfigFile(sanitized);

      scadaApiConnStatus.value = 'connected';
      scadaApiErrorMessage.value = '';

      return { success: true, data: sanitized };
    } else {
      throw new Error(resJson?.msg || 'SCADA 接口返回异常状态码');
    }
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? '请求超时 (6秒)' : (err?.message || '无法连接到 SCADA 接口');
    scadaApiConnStatus.value = 'disconnected';
    scadaApiErrorMessage.value = msg;
    return { success: false, error: msg };
  } finally {
    isConfigLoading.value = false;
  }
}

/**
 * Fetch SCADA Realtime Data: POST /api/scada/realtime
 * Request: { yc_ids: number[], yx_ids: number[] }
 * Response: { code: 200, msg: "success", data: { yc: [...], yx: [...] } }
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
    const timeoutId = setTimeout(() => controller.abort(), 4000);

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

      // Update cached maps
      yc.forEach(item => {
        cachedRealtimeYc.set(item.id, item);
      });
      yx.forEach(item => {
        cachedRealtimeYx.set(item.id, item);
      });

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
  const numId = typeof pointId === 'number' ? pointId : parseInt(String(pointId).replace(/[^0-9]/g, ''), 10);
  if (!isNaN(numId)) {
    if (cachedRealtimeYc.has(numId)) {
      const pt = cachedRealtimeYc.get(numId)!;
      return { found: true, type: 'yc', value: pt.val ?? 0, status: pt.status ?? 1 };
    }
    if (cachedRealtimeYx.has(numId)) {
      const pt = cachedRealtimeYx.get(numId)!;
      return { found: true, type: 'yx', value: pt.val ?? 0, status: pt.status ?? 0, q: pt.q ?? 0 };
    }
  }
  return { found: false, type: 'none', value: 0, status: 0 };
}

/**
 * Find point definition in loaded facilities
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

  for (const fac of scadaFacilities.value) {
    for (const bay of fac.bays || []) {
      for (const dev of bay.devices || []) {
        const yc = (dev.yc_list || []).find(p => p.id === numId);
        if (yc) {
          return { facility: fac, bay, device: dev, point: yc, category: 'yc' };
        }
        const yx = (dev.yx_list || []).find(p => p.id === numId);
        if (yx) {
          return { facility: fac, bay, device: dev, point: yx, category: 'yx' };
        }
      }
    }
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

/**
 * Extract all unique bound/associated YC and YX point IDs from ScreenComponents
 * Only returns points that are actively associated/bound with components on the screen!
 */
export function getAssociatedPointIdsFromComponents(
  components: any[] = [],
  extraScreens: any[] = []
): { yc_ids: number[]; yx_ids: number[] } {
  const ycSet = new Set<number>();
  const yxSet = new Set<number>();

  const allComps: any[] = [...(components || [])];
  if (Array.isArray(extraScreens)) {
    for (const scr of extraScreens) {
      if (Array.isArray(scr?.components)) {
        allComps.push(...scr.components);
      }
    }
  }

  for (const comp of allComps) {
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

    for (const str of candidateStrings) {
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

  return {
    yc_ids: Array.from(ycSet),
    yx_ids: Array.from(yxSet)
  };
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
          const live = cachedRealtimeYc.get(yc.id);
          return {
            pointId: yc.id,
            name: yc.name,
            factor: 1.0,
            unit: '',
            value: live ? live.val : 0
          };
        });

        const teleSignals = (dev.yx_list || []).map(yx => {
          const live = cachedRealtimeYx.get(yx.id);
          const val = live ? live.val : 0;
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
