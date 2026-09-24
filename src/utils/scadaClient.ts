import { ref, shallowRef } from 'vue';
import {
  ScadaFacilityNode,
  ScadaBayNode,
  ScadaDeviceNode,
  ScadaYcItem,
  ScadaYxItem,
  ScadaYkItem,
  ScadaYtItem,
  ScadaDdItem,
  ScadaConfigResponse,
  ScadaRealtimeRequest,
  ScadaRealtimeResponse,
  ScadaRealtimeYcItem,
  ScadaRealtimeYxItem,
  ScadaRealtimeDdItem,
  DatasetItem,
  ScadaDeviceItem,
  ScreenComponent
} from '../types';

// ============================================================================
// 字典表与枚举常量 (附录：状态码与枚举字典表)
// ============================================================================
export const YX_STATUS_DICT: Record<number, string> = {
  0: '正常',
  1: '无效',
  2: '双位不一致(合)',
  3: '双位不一致(分)',
  4: '封锁(合)',
  5: '封锁(分)',
  6: '人工置数',
  7: '变位(合)',
  8: '变位(分)'
};

export const YC_STATUS_DICT: Record<number, string> = {
  0: '正常',
  1: '无效',
  2: '坏数据',
  3: '封锁',
  4: '工况退出',
  5: '人工置数',
  6: '越下限',
  7: '越下下限',
  8: '越上限',
  9: '越上上限'
};

export const CB_DEVICE_TYPE_DICT: Record<number, string> = {
  0: '开关 / 断路器',
  1: '刀闸 / 隔离开关',
  2: '地刀',
  3: '接地桩',
  5: '压板',
  6: '空开',
  10: '手车'
};

export const YK_STATE_OPTIONS = [
  { label: '合闸 (close)', value: 'close', targetState: 1 },
  { label: '分闸 (open)', value: 'open', targetState: 0 },
  { label: '同期合 (tqh)', value: 'tqh', targetState: 1 },
  { label: '有压合 (yyh)', value: 'yyh', targetState: 1 },
  { label: '无压合 (wyh)', value: 'wyh', targetState: 1 },
  { label: '合环合 (hhh)', value: 'hhh', targetState: 1 },
  { label: '试验合 (tsh)', value: 'tsh', targetState: 1 },
  { label: '复归 (fg)', value: 'fg', targetState: 0 },
  { label: '试跳 (st)', value: 'st', targetState: 0 }
];

export const YT_OPER_OPTIONS = [
  { label: '设值 (adjust)', value: 'adjust' },
  { label: '升档 (up)', value: 'up' },
  { label: '降档 (down)', value: 'down' },
  { label: '急停 (stop)', value: 'stop' }
];

// Default SCADA Host & Port
const STORAGE_KEY_SCADA_API = 'scada_api_base_url';
const STORAGE_KEY_SCADA_CONFIG = 'scada_local_config_json';
export const DEFAULT_SCADA_API_URL = 'http://127.0.0.1:36581';

export function getScadaApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(STORAGE_KEY_SCADA_API);
    if (saved && saved.trim()) return saved.trim();
  }
  return ''; // default relative '/api/scada' if on same host, or fallback
}

export function setScadaApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY_SCADA_API, url.trim());
  }
}

// ---------------------------------------------------------------------------
// Standard SCADA Hierarchy Preset (Lightweight Structure matching /api/scada/config)
// ---------------------------------------------------------------------------
export const PRESET_SCADA_FACILITIES: ScadaFacilityNode[] = [
  {
    id: 4000003,
    fac_id: 4000003,
    name: '苏州晟高',
    fac_name: '苏州晟高',
    alias: 'F01',
    bays: [
      {
        id: 430000001,
        bay_id: 430000001,
        name: '苏州晟高一体柜',
        bay_name: '苏州晟高一体柜',
        alias: 'F01.V10.S01',
        devices: [
          {
            id: 7000001,
            dev_id: 7000001,
            name: '6',
            dev_name: '6',
            alias: 'F01.V10.S01.DL01',
            cbty: 0,
            cbty_name: '开关',
            state: 1,
            status: 7,
            yc_list: [
              { id: 62000001, name: 'yc01', alias: 'F01.V10.S01.DL01.YC001', type: 0, type_name: '普通遥测', val: 2432747, status: 0, status_name: '正常' },
              { id: 62000002, name: 'yc02', alias: 'F01.V10.S01.DL01.YC002', type: 0, type_name: '普通遥测', val: 24000, status: 0, status_name: '正常' },
              { id: 62000003, name: 'yc03', alias: 'F01.V10.S01.DL01.YC003', type: 0, type_name: '普通遥测', val: 120000, status: 0, status_name: '正常' },
              { id: 62000004, name: 'yc04', alias: 'F01.V10.S01.DL01.YC004', type: 0, type_name: '普通遥测', val: 120000, status: 0, status_name: '正常' },
              { id: 62000005, name: 'yc05', alias: 'F01.V10.S01.DL01.YC005', type: 0, type_name: '普通遥测', val: 6.6, status: 0, status_name: '正常' },
              { id: 62000006, name: 'yc06', alias: 'F01.V10.S01.DL01.YC006', type: 0, type_name: '普通遥测', val: 0, status: 1, status_name: '无效' },
              { id: 62000007, name: 'yc07', alias: 'F01.V10.S01.DL01.YC007', type: 0, type_name: '普通遥测', val: 0, status: 1, status_name: '无效' },
              { id: 62000008, name: 'yc08', alias: 'F01.V10.S01.DL01.YC008', type: 0, type_name: '普通遥测', val: 0, status: 1, status_name: '无效' },
              { id: 62000009, name: 'yc09', alias: 'F01.V10.S01.DL01.YC009', type: 0, type_name: '普通遥测', val: 0, status: 1, status_name: '无效' },
              { id: 62000010, name: 'yc10', alias: 'F01.V10.S01.DL01.YC010', type: 0, type_name: '普通遥测', val: 0, status: 1, status_name: '无效' },
              { id: 62000011, name: 'yc11', alias: 'F01.V10.S01.DL01.YC011', type: 0, type_name: '普通遥测', val: 0, status: 1, status_name: '无效' },
              { id: 62000012, name: 'yc12', alias: 'F01.V10.S01.DL01.YC012', type: 0, type_name: '普通遥测', val: 0, status: 1, status_name: '无效' },
              { id: 62000013, name: 'yc13', alias: 'F01.V10.S01.DL01.YC013', type: 0, type_name: '普通遥测', val: 0, status: 1, status_name: '无效' },
              { id: 62000014, name: 'yc14', alias: 'F01.V10.S01.DL01.YC014', type: 0, type_name: '普通遥测', val: 220.5, status: 0, status_name: '正常' },
              { id: 62000015, name: 'yc15', alias: 'F01.V10.S01.DL01.YC015', type: 0, type_name: '普通遥测', val: 220.1, status: 0, status_name: '正常' },
              { id: 62000016, name: 'yc16', alias: 'F01.V10.S01.DL01.YC016', type: 0, type_name: '普通遥测', val: 220.8, status: 0, status_name: '正常' },
              { id: 62000017, name: 'yc17', alias: 'F01.V10.S01.DL01.YC017', type: 0, type_name: '普通遥测', val: 12.4, status: 0, status_name: '正常' },
              { id: 62000018, name: 'yc18', alias: 'F01.V10.S01.DL01.YC018', type: 0, type_name: '普通遥测', val: 12.3, status: 0, status_name: '正常' },
              { id: 62000019, name: 'yc19', alias: 'F01.V10.S01.DL01.YC019', type: 0, type_name: '普通遥测', val: 12.5, status: 0, status_name: '正常' },
              { id: 62000020, name: 'yc20', alias: 'F01.V10.S01.DL01.YC020', type: 0, type_name: '普通遥测', val: 50.01, status: 0, status_name: '正常' },
              { id: 62000021, name: 'yc21', alias: 'F01.V10.S01.DL01.YC021', type: 0, type_name: '普通遥测', val: 0.98, status: 0, status_name: '正常' },
              { id: 62000022, name: 'yc22', alias: 'F01.V10.S01.DL01.YC022', type: 0, type_name: '普通遥测', val: 35.2, status: 0, status_name: '正常' },
              { id: 62000023, name: 'yc23', alias: 'F01.V10.S01.DL01.YC023', type: 0, type_name: '普通遥测', val: 36.1, status: 0, status_name: '正常' },
              { id: 62000024, name: 'yc24', alias: 'F01.V10.S01.DL01.YC024', type: 0, type_name: '普通遥测', val: 34.8, status: 0, status_name: '正常' }
            ],
            yx_list: [
              { id: 61000006, name: 'yx06', alias: 'F01.V10.S01.DL01.POS_OPN', type: 1, type_name: '开关位置', val: 1, value: 1, status: 7, status_name: '变位(合)', q: 0 },
              { id: 61000002, name: 'yx02', alias: 'F01.V10.S01.DL01.YX002', type: 0, type_name: '普通遥信', val: 1, value: 1, status: 7, status_name: '变位(合)', q: 0 },
              { id: 61000003, name: 'yx03', alias: 'F01.V10.S01.DL01.YX003', type: 0, type_name: '普通遥信', val: 1, value: 1, status: 7, status_name: '变位(合)', q: 0 },
              { id: 61000004, name: 'yx04', alias: 'F01.V10.S01.DL01.YX004', type: 0, type_name: '普通遥信', val: 1, value: 1, status: 7, status_name: '变位(合)', q: 0 },
              { id: 61000005, name: 'yx05003', alias: 'F01.V10.S01.DL01.YX005', type: 0, type_name: '普通遥信', val: 0, value: 0, status: 1, status_name: '无效', q: 2 },
              { id: 61000007, name: 'yx07', alias: 'F01.V10.S01.DL01.YX007', type: 0, type_name: '普通遥信', val: 0, value: 0, status: 1, status_name: '无效', q: 2 },
              { id: 61000008, name: 'yx08', alias: 'F01.V10.S01.DL01.YX008', type: 0, type_name: '普通遥信', val: 0, value: 0, status: 1, status_name: '无效', q: 2 }
            ],
            yk_list: [
              {
                id: 54000003,
                name: '6遥控666',
                alias: 'F01.V10.S01.DL01.YK01',
                type: 0,
                type_name: '有监护遥控',
                channel: 0,
                targetVerificationPointId: 61000006
              }
            ],
            yt_list: [],
            dd_list: [
              { id: 35000001, name: '电度01', alias: 'F01.V10.S01.DL01.ZP001', type: 1, type_name: '硬电度', val: 1258.4, value: 1258.4, status: 0, status_name: '正常' },
              { id: 35000002, name: '电度02', alias: 'F01.V10.S01.DL01.ZP002', type: 2, type_name: '软电度', val: 3482.1, value: 3482.1, status: 0, status_name: '正常' }
            ]
          },
          {
            id: 7000003,
            dev_id: 7000003,
            name: '6YT',
            dev_name: '6YT',
            alias: 'F01.V10.S01.DL02',
            cbty: 0,
            cbty_name: '开关',
            state: 1,
            status: 0,
            yc_list: [
              { id: 62000070, name: 'yt_feedback_yc', alias: 'F01.V10.S01.DL02.YC_FB', type: 0, type_name: '调节反馈遥测', val: 9.0, status: 0, status_name: '正常' }
            ],
            yx_list: [
              { id: 61000001, name: 'yx01', alias: 'F01.V10.S01.DL02.POS_OPN', type: 1, type_name: '开关位置', val: 1, value: 1, status: 0, status_name: '正常', q: 0 }
            ],
            yk_list: [],
            yt_list: [
              {
                id: 54000004,
                name: 'YC5Yt',
                alias: 'F01.V10.S01.DL02.YT01',
                type: 1,
                type_name: '有监护遥调',
                channel: 0,
                targetVerificationPointId: 62000070
              }
            ],
            dd_list: []
          }
        ]
      },
      {
        id: 430000002,
        bay_id: 430000002,
        name: '柜子2',
        bay_name: '柜子2',
        alias: 'F01.V10.L01',
        devices: [
          {
            id: 7000002,
            dev_id: 7000002,
            name: '7',
            dev_name: '7',
            alias: 'F01.V10.L01.DL02',
            cbty: 0,
            cbty_name: '开关',
            state: 0,
            status: 0,
            yc_list: [
              { id: 62000061, name: '7yc001', alias: 'F01.V10.L01.DL02.YC010', type: 0, type_name: '普通遥测', val: 221.3, status: 0, status_name: '正常' }
            ],
            yx_list: [
              { id: 61000061, name: '7yx0166', alias: 'F01.V10.L01.DL02.YX001', type: 0, type_name: '普通遥信', val: 0, value: 0, status: 0, status_name: '正常', q: 0 }
            ],
            yk_list: [],
            yt_list: [],
            dd_list: []
          }
        ]
      }
    ]
  }
];

// ---------------------------------------------------------------------------
// High-Performance Primitive Raw Telemetry Storage (Zero Vue Proxy Overhead)
// ---------------------------------------------------------------------------
export const rawYcValues = new Map<number, number>();
export const rawYxValues = new Map<number, number>();
export const rawDdValues = new Map<number, number>();
export const rawYcQuality = new Map<number, number>();
export const rawYxQuality = new Map<number, number>();

// Single reactive pulse ticker: triggers all 300+ canvas widgets in ONE single Vue tick
export const scadaLiveTick = ref<number>(0);

// Backward-compatible structures
export const cachedRealtimeYc = new Map<number, ScadaRealtimeYcItem>();
export const cachedRealtimeYx = new Map<number, ScadaRealtimeYxItem>();
export const cachedRealtimeDd = new Map<number, ScadaRealtimeDdItem>();

// Global SCADA Facilities State (ShallowRef to prevent deep proxy traversal)
export const scadaFacilities = shallowRef<ScadaFacilityNode[]>([...PRESET_SCADA_FACILITIES]);

// Request Status State
export const isConfigLoading = ref<boolean>(false);
export const isRealtimeLoading = ref<boolean>(false);
export const scadaApiConnStatus = ref<'connected' | 'disconnected' | 'idle'>('idle');
export const scadaApiErrorMessage = ref<string>('');
export const lastRealtimeSyncTime = ref<string>('');

// Initialize default raw point cache
function seedRawCache(facilities: ScadaFacilityNode[]) {
  facilities.forEach(fac => {
    (fac.bays || []).forEach(bay => {
      (bay.devices || bay.cb_devices || []).forEach(dev => {
        (dev.yc_list || dev.yc_points || []).forEach(yc => {
          rawYcValues.set(yc.id, yc.val ?? yc.value ?? 0);
          rawYcQuality.set(yc.id, yc.status ?? 0);
          cachedRealtimeYc.set(yc.id, { id: yc.id, val: yc.val ?? yc.value ?? 0, status: yc.status ?? 0 });
        });
        (dev.yx_list || dev.yx_points || []).forEach(yx => {
          rawYxValues.set(yx.id, yx.val ?? yx.value ?? 0);
          rawYxQuality.set(yx.id, yx.status ?? 0);
          cachedRealtimeYx.set(yx.id, { id: yx.id, val: yx.val ?? yx.value ?? 0, status: yx.status ?? 0, q: yx.q ?? 0 });
        });
        (dev.dd_list || dev.dd_points || []).forEach(dd => {
          rawDdValues.set(dd.id, dd.val ?? dd.value ?? 0);
          cachedRealtimeDd.set(dd.id, { id: dd.id, val: dd.val ?? dd.value ?? 0, status: dd.status ?? 0 });
        });
      });
    });
  });
}

seedRawCache(PRESET_SCADA_FACILITIES);

// Fast Getter Helpers
export function getFastLiveYc(pointId: number): number | undefined {
  return rawYcValues.get(pointId);
}

export function getFastLiveYx(pointId: number): number | undefined {
  return rawYxValues.get(pointId);
}

export function getFastLiveDd(pointId: number): number | undefined {
  return rawDdValues.get(pointId);
}

/**
 * Sanitize facility tree to standard ScadaFacilityNode[]
 * Fully supports both `cb_devices` and `devices`, and `yc_points`, `yx_points`, `yk_points`, `yt_points`, `dd_points`
 */
export function sanitizeFacilities(rawList: any[]): ScadaFacilityNode[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.map(fac => {
    const facId = Number(fac.id ?? fac.fac_id) || 0;
    const facName = String(fac.name || fac.fac_name || '未命名厂站');
    const facAlias = String(fac.alias || '');

    const bays = Array.isArray(fac.bays)
      ? fac.bays.map((bay: any) => {
          const bayId = Number(bay.id ?? bay.bay_id) || 0;
          const bayName = String(bay.name || bay.bay_name || '未命名间隔');
          const bayAlias = String(bay.alias || '');

          const rawDevs = Array.isArray(bay.cb_devices) ? bay.cb_devices : (Array.isArray(bay.devices) ? bay.devices : []);
          const devices: ScadaDeviceNode[] = rawDevs.map((dev: any) => {
            const devId = Number(dev.id ?? dev.dev_id) || 0;
            const devName = String(dev.name || dev.dev_name || '未命名装置');
            const devAlias = String(dev.alias || '');
            const cbty = Number(dev.cbty ?? 0);
            const cbtyName = String(dev.cbty_name || CB_DEVICE_TYPE_DICT[cbty] || '开关');

            const rawYcs = Array.isArray(dev.yc_points) ? dev.yc_points : (Array.isArray(dev.yc_list) ? dev.yc_list : []);
            const yc_list: ScadaYcItem[] = rawYcs.map((yc: any) => ({
              id: Number(yc.id) || 0,
              name: String(yc.name || ''),
              alias: String(yc.alias || ''),
              type: Number(yc.type ?? 0),
              type_name: String(yc.type_name || '普通遥测'),
              val: Number(yc.val ?? yc.value ?? 0),
              value: Number(yc.val ?? yc.value ?? 0),
              status: Number(yc.status ?? 0),
              status_name: String(yc.status_name || YC_STATUS_DICT[Number(yc.status ?? 0)] || '正常'),
              unit: String(yc.unit || '')
            }));

            const rawYxs = Array.isArray(dev.yx_points) ? dev.yx_points : (Array.isArray(dev.yx_list) ? dev.yx_list : []);
            const yx_list: ScadaYxItem[] = rawYxs.map((yx: any) => ({
              id: Number(yx.id) || 0,
              name: String(yx.name || ''),
              alias: String(yx.alias || ''),
              type: Number(yx.type ?? 0),
              type_name: String(yx.type_name || (yx.type === 1 ? '开关位置' : '普通遥信')),
              val: Number(yx.val ?? yx.value ?? 0),
              value: Number(yx.val ?? yx.value ?? 0),
              status: Number(yx.status ?? 0),
              status_name: String(yx.status_name || YX_STATUS_DICT[Number(yx.status ?? 0)] || '正常'),
              q: Number(yx.q ?? 0),
              statusText: Number(yx.val ?? yx.value ?? 0) === 1 ? '变位(合)' : '变位(分)'
            }));

            const rawYks = Array.isArray(dev.yk_points) ? dev.yk_points : (Array.isArray(dev.yk_list) ? dev.yk_list : []);
            const yk_list: ScadaYkItem[] = rawYks.map((yk: any) => ({
              id: Number(yk.id) || 0,
              name: String(yk.name || '遥控点'),
              alias: String(yk.alias || ''),
              type: Number(yk.type ?? 0),
              type_name: String(yk.type_name || '有监护遥控'),
              channel: Number(yk.channel ?? 0),
              targetVerificationPointId: Number(yk.targetVerificationPointId) || yx_list.find(x => x.type === 1 || x.alias?.includes('POS'))?.id || yx_list[0]?.id
            }));

            const rawYts = Array.isArray(dev.yt_points) ? dev.yt_points : (Array.isArray(dev.yt_list) ? dev.yt_list : []);
            const yt_list: ScadaYtItem[] = rawYts.map((yt: any) => ({
              id: Number(yt.id) || 0,
              name: String(yt.name || '遥调点'),
              alias: String(yt.alias || ''),
              type: Number(yt.type ?? 1),
              type_name: String(yt.type_name || '有监护遥调'),
              channel: Number(yt.channel ?? 0),
              targetVerificationPointId: Number(yt.targetVerificationPointId) || yc_list[0]?.id,
              min: Number(yt.min ?? 0),
              max: Number(yt.max ?? 100),
              step: Number(yt.step ?? 1),
              unit: String(yt.unit || '档')
            }));

            const rawDds = Array.isArray(dev.dd_points) ? dev.dd_points : (Array.isArray(dev.dd_list) ? dev.dd_list : []);
            const dd_list: ScadaDdItem[] = rawDds.map((dd: any) => ({
              id: Number(dd.id) || 0,
              name: String(dd.name || '电度点'),
              alias: String(dd.alias || ''),
              type: Number(dd.type ?? 1),
              type_name: String(dd.type_name || (dd.type === 1 ? '硬电度' : '软电度')),
              val: Number(dd.val ?? dd.value ?? 0),
              value: Number(dd.val ?? dd.value ?? 0),
              status: Number(dd.status ?? 0),
              status_name: String(dd.status_name || '正常'),
              unit: String(dd.unit || 'kWh')
            }));

            return {
              id: devId,
              dev_id: devId,
              name: devName,
              dev_name: devName,
              alias: devAlias,
              cbty,
              cbty_name: cbtyName,
              state: Number(dev.state ?? 0),
              status: Number(dev.status ?? 0),
              yc_list,
              yx_list,
              yk_list,
              yt_list,
              dd_list,
              yc_points: yc_list,
              yx_points: yx_list,
              yk_points: yk_list,
              yt_points: yt_list,
              dd_points: dd_list
            };
          });

          return {
            id: bayId,
            bay_id: bayId,
            name: bayName,
            bay_name: bayName,
            alias: bayAlias,
            type: Number(bay.type ?? 4),
            devices,
            cb_devices: devices
          };
        })
      : [];

    return {
      id: facId,
      fac_id: facId,
      name: facName,
      fac_name: facName,
      alias: facAlias,
      bays
    };
  });
}

/**
 * Load local scada_config.json on startup
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
        } else if (res.data.facilities && Array.isArray(res.data.facilities)) {
          parsedData = res.data.facilities;
        } else if (res.data.data && Array.isArray(res.data.data)) {
          parsedData = res.data.data;
        }

        if (Array.isArray(parsedData) && parsedData.length > 0) {
          const cleanFacs = sanitizeFacilities(parsedData);
          scadaFacilities.value = cleanFacs;
          seedRawCache(cleanFacs);
          rebuildScadaPointLookupMap();
          return true;
        }
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const savedStr = window.localStorage.getItem(STORAGE_KEY_SCADA_CONFIG);
      if (savedStr) {
        const parsed = JSON.parse(savedStr);
        const list = Array.isArray(parsed) ? parsed : (parsed.facilities || parsed.data);
        if (Array.isArray(list) && list.length > 0) {
          const cleanFacs = sanitizeFacilities(list);
          scadaFacilities.value = cleanFacs;
          seedRawCache(cleanFacs);
          rebuildScadaPointLookupMap();
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
  const url = baseUrl ? `${baseUrl}/api/scada/config?pretty=1` : '/api/scada/config?pretty=1';

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

    const resJson: any = await response.json();
    const rawFacs = resJson?.facilities || resJson?.data || (Array.isArray(resJson) ? resJson : []);

    if (Array.isArray(rawFacs) && rawFacs.length > 0) {
      const cleanList = sanitizeFacilities(rawFacs);
      scadaFacilities.value = cleanList;
      seedRawCache(cleanList);
      rebuildScadaPointLookupMap();

      await saveLocalScadaConfigFile(cleanList);

      scadaApiConnStatus.value = 'connected';
      scadaApiErrorMessage.value = '';
      return { success: true, data: cleanList };
    } else {
      throw new Error(resJson?.msg || 'SCADA 配置返回为空或格式异常');
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
 */
export async function fetchScadaRealtime(
  req: ScadaRealtimeRequest,
  apiUrl?: string
): Promise<{
  success: boolean;
  data?: { yc?: ScadaRealtimeYcItem[]; yx?: ScadaRealtimeYxItem[]; dd?: ScadaRealtimeDdItem[] };
  error?: string;
}> {
  const baseUrl = (apiUrl || getScadaApiBaseUrl()).replace(/\/+$/, '');
  const url = baseUrl ? `${baseUrl}/api/scada/realtime` : '/api/scada/realtime';

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
        yx_ids: req.yx_ids || [],
        dd_ids: req.dd_ids || []
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const resJson: ScadaRealtimeResponse = await response.json();
    if (resJson && (resJson.code === 200 || (resJson as any).status === 'success') && resJson.data) {
      const { yc = [], yx = [], dd = [] } = resJson.data;

      // Update YC Cache
      for (let i = 0; i < yc.length; i++) {
        const item = yc[i];
        const val = item.val ?? 0;
        rawYcValues.set(item.id, val);
        if (item.status !== undefined) rawYcQuality.set(item.id, item.status);
        cachedRealtimeYc.set(item.id, item);
      }

      // Update YX Cache
      for (let i = 0; i < yx.length; i++) {
        const item = yx[i];
        const val = item.val ?? 0;
        rawYxValues.set(item.id, val);
        if (item.status !== undefined) rawYxQuality.set(item.id, item.status);
        cachedRealtimeYx.set(item.id, item);
      }

      // Update DD Cache
      for (let i = 0; i < dd.length; i++) {
        const item = dd[i];
        const val = item.val ?? 0;
        rawDdValues.set(item.id, val);
        cachedRealtimeDd.set(item.id, item);
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

// ---------------------------------------------------------------------------
// SCADA 遥控 (YK) 与 遥调 (YT) 接口调用
// ---------------------------------------------------------------------------

/**
 * 遥控操作 (YK)
 * POST /api/scada/control/yk
 */
export async function sendScadaYk(params: {
  yk_id: number;
  action: 'prev' | 'exec' | 'cancel' | 'direct';
  state: 'close' | 'open' | 'tqh' | 'yyh' | 'wyh' | 'hhh' | 'tsh' | 'fg' | 'st' | string;
  apiUrl?: string;
}): Promise<{ success: boolean; code?: number; msg?: string; error?: string }> {
  const baseUrl = (params.apiUrl || getScadaApiBaseUrl()).replace(/\/+$/, '');
  const url = baseUrl ? `${baseUrl}/api/scada/control/yk` : '/api/scada/control/yk';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        yk_id: Number(params.yk_id),
        action: params.action,
        state: params.state
      })
    });

    const resJson = await res.json();
    if (res.ok && resJson && resJson.code === 200) {
      return { success: true, code: 200, msg: resJson.msg || 'YK command sent successfully' };
    } else {
      return { success: false, code: resJson?.code || res.status, error: resJson?.msg || '遥控指令下发失败' };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || '网络通信异常' };
  }
}

/**
 * 遥调操作 (YT)
 * POST /api/scada/control/yt
 */
export async function sendScadaYt(params: {
  yt_id: number;
  action: 'prev' | 'exec' | 'cancel' | 'direct';
  oper: 'adjust' | 'up' | 'down' | 'stop' | string;
  val: number;
  old_val?: number;
  oper_name?: string;
  apiUrl?: string;
}): Promise<{ success: boolean; code?: number; msg?: string; error?: string }> {
  const baseUrl = (params.apiUrl || getScadaApiBaseUrl()).replace(/\/+$/, '');
  const url = baseUrl ? `${baseUrl}/api/scada/control/yt` : '/api/scada/control/yt';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        yt_id: Number(params.yt_id),
        action: params.action,
        oper: params.oper || 'adjust',
        val: Number(params.val),
        old_val: params.old_val !== undefined ? Number(params.old_val) : 0,
        oper_name: params.oper_name || 'http_admin'
      })
    });

    const resJson = await res.json();
    if (res.ok && resJson && resJson.code === 200) {
      return { success: true, code: 200, msg: resJson.msg || 'YT command sent successfully' };
    } else {
      return { success: false, code: resJson?.code || res.status, error: resJson?.msg || '遥调指令下发失败' };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || '网络通信异常' };
  }
}

/**
 * 标准带闭环返校校验的控制执行器 (Closed-Loop Control with Verification)
 * 在设定时间内循环轮询校验点变位，判断成功还是超时失败
 */
export async function executeClosedLoopControl(options: {
  type: 'yk' | 'yt';
  pointId: number;
  action?: 'prev-exec' | 'direct'; // 默认标准两步法: 预置 -> 执行
  ykState?: string; // 'close' | 'open' | ...
  ytOper?: string; // 'adjust'
  ytVal?: number;
  ytOldVal?: number;
  oper_name?: string;
  targetVerificationPointId?: number; // 关联返校校验点
  targetVerificationType?: 'yx' | 'yc'; // 返校点类型
  verificationTimeoutMs?: number; // 校验超时时间毫秒 (默认 30000ms)
  onProgress?: (info: { step: string; elapsedMs: number; remainingSeconds: number; currentVal?: any }) => void;
}): Promise<{
  success: boolean;
  verified: boolean;
  elapsedMs: number;
  message: string;
  finalValue?: any;
}> {
  const startTime = Date.now();
  const timeoutMs = options.verificationTimeoutMs || 30000;
  const isYk = options.type === 'yk';

  // 1. 下发预置 (prev) 如果是标准两步法
  if (options.action !== 'direct') {
    options.onProgress?.({ step: '正在下发预置指令 (prev)...', elapsedMs: 0, remainingSeconds: Math.ceil(timeoutMs / 1000) });
    if (isYk) {
      const prevRes = await sendScadaYk({
        yk_id: options.pointId,
        action: 'prev',
        state: options.ykState || 'close'
      });
      if (!prevRes.success) {
        return { success: false, verified: false, elapsedMs: Date.now() - startTime, message: `预置失败: ${prevRes.error}` };
      }
    } else {
      const prevRes = await sendScadaYt({
        yt_id: options.pointId,
        action: 'prev',
        oper: options.ytOper || 'adjust',
        val: options.ytVal ?? 0,
        old_val: options.ytOldVal,
        oper_name: options.oper_name || 'http_admin'
      });
      if (!prevRes.success) {
        return { success: false, verified: false, elapsedMs: Date.now() - startTime, message: `预置失败: ${prevRes.error}` };
      }
    }
  }

  // 2. 下发执行 (SCADA 后端严格要求 action 为 'exec')
  options.onProgress?.({ step: '预置成功，正在下发执行指令 (action: exec)...', elapsedMs: Date.now() - startTime, remainingSeconds: Math.ceil(timeoutMs / 1000) });

  if (isYk) {
    const execRes = await sendScadaYk({
      yk_id: options.pointId,
      action: 'exec',
      state: options.ykState || 'close'
    });
    if (!execRes.success) {
      return { success: false, verified: false, elapsedMs: Date.now() - startTime, message: `执行失败: ${execRes.error}` };
    }
  } else {
    const execRes = await sendScadaYt({
      yt_id: options.pointId,
      action: 'exec',
      oper: options.ytOper || 'adjust',
      val: options.ytVal ?? 0,
      old_val: options.ytOldVal,
      oper_name: options.oper_name || 'http_admin'
    });
    if (!execRes.success) {
      return { success: false, verified: false, elapsedMs: Date.now() - startTime, message: `执行失败: ${execRes.error}` };
    }
  }

  // 3. 如果没有指定返校校验点，则指令发送成功即返回
  const vPointId = options.targetVerificationPointId;
  if (!vPointId) {
    return {
      success: true,
      verified: true,
      elapsedMs: Date.now() - startTime,
      message: '控制指令已成功下发 (未配置返校校验点)'
    };
  }

  // 4. 启动返校校验轮询
  const vType = options.targetVerificationType || (isYk ? 'yx' : 'yc');
  const expectedYxValue = ['close', 'tqh', 'yyh', 'wyh', 'hhh', 'tsh'].includes(options.ykState || '') ? 1 : 0;
  const targetYtVal = options.ytVal ?? 0;

  const pollIntervalMs = 250;
  while (Date.now() - startTime < timeoutMs) {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
    
    // Poll target verification point realtime data
    if (vType === 'yx') {
      await fetchScadaRealtime({ yx_ids: [vPointId] });
      const currentYxVal = rawYxValues.get(vPointId);
      options.onProgress?.({
        step: `指令已下发，正在等待返校遥信 [YX_${vPointId}] 变位确认...`,
        elapsedMs: elapsed,
        remainingSeconds: remaining,
        currentVal: currentYxVal
      });

      if (currentYxVal === expectedYxValue) {
        return {
          success: true,
          verified: true,
          elapsedMs: elapsed,
          message: `返校确认成功！遥信测点 [YX_${vPointId}] 变位为 ${expectedYxValue === 1 ? '合闸 (1)' : '分闸 (0)'}，耗时 ${(elapsed / 1000).toFixed(1)}s`,
          finalValue: currentYxVal
        };
      }
    } else {
      await fetchScadaRealtime({ yc_ids: [vPointId] });
      const currentYcVal = rawYcValues.get(vPointId);
      options.onProgress?.({
        step: `指令已下发，正在等待返校遥测 [YC_${vPointId}] 达到设定值 (${targetYtVal})...`,
        elapsedMs: elapsed,
        remainingSeconds: remaining,
        currentVal: currentYcVal
      });

      if (currentYcVal !== undefined && Math.abs(currentYcVal - targetYtVal) < 0.01) {
        return {
          success: true,
          verified: true,
          elapsedMs: elapsed,
          message: `返校确认成功！遥测测点 [YC_${vPointId}] 达到目标值 ${currentYcVal}，耗时 ${(elapsed / 1000).toFixed(1)}s`,
          finalValue: currentYcVal
        };
      }
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  // 超时未变位
  return {
    success: false,
    verified: false,
    elapsedMs: timeoutMs,
    message: `控制超时/返校失败：返校测点在 ${Math.round(timeoutMs / 1000)} 秒内未反馈变位！`
  };
}

// ---------------------------------------------------------------------------
// High-Speed O(1) Point Lookup Hash Index
// ---------------------------------------------------------------------------
const scadaPointLookupMap = new Map<number, {
  facility: ScadaFacilityNode;
  bay: ScadaBayNode;
  device: ScadaDeviceNode;
  point: ScadaYcItem | ScadaYxItem | ScadaYkItem | ScadaYtItem | ScadaDdItem;
  category: 'yc' | 'yx' | 'yk' | 'yt' | 'dd';
}>();

export function rebuildScadaPointLookupMap() {
  scadaPointLookupMap.clear();
  const facs = scadaFacilities.value || [];
  for (let f = 0; f < facs.length; f++) {
    const fac = facs[f];
    const bays = fac.bays || [];
    for (let b = 0; b < bays.length; b++) {
      const bay = bays[b];
      const devs = bay.devices || bay.cb_devices || [];
      for (let d = 0; d < devs.length; d++) {
        const dev = devs[d];
        (dev.yc_list || dev.yc_points || []).forEach(yc => {
          if (typeof yc.id === 'number') scadaPointLookupMap.set(yc.id, { facility: fac, bay, device: dev, point: yc, category: 'yc' });
        });
        (dev.yx_list || dev.yx_points || []).forEach(yx => {
          if (typeof yx.id === 'number') scadaPointLookupMap.set(yx.id, { facility: fac, bay, device: dev, point: yx, category: 'yx' });
        });
        (dev.yk_list || dev.yk_points || []).forEach(yk => {
          if (typeof yk.id === 'number') scadaPointLookupMap.set(yk.id, { facility: fac, bay, device: dev, point: yk, category: 'yk' });
        });
        (dev.yt_list || dev.yt_points || []).forEach(yt => {
          if (typeof yt.id === 'number') scadaPointLookupMap.set(yt.id, { facility: fac, bay, device: dev, point: yt, category: 'yt' });
        });
        (dev.dd_list || dev.dd_points || []).forEach(dd => {
          if (typeof dd.id === 'number') scadaPointLookupMap.set(dd.id, { facility: fac, bay, device: dev, point: dd, category: 'dd' });
        });
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
  point?: any;
  category: 'yc' | 'yx' | 'yk' | 'yt' | 'dd' | 'none';
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
  dd_ids: number[];
} {
  const yc_ids: number[] = [];
  const yx_ids: number[] = [];
  const dd_ids: number[] = [];

  facs.forEach(fac => {
    (fac.bays || []).forEach(bay => {
      (bay.devices || bay.cb_devices || []).forEach(dev => {
        (dev.yc_list || dev.yc_points || []).forEach(yc => {
          if (typeof yc.id === 'number') yc_ids.push(yc.id);
        });
        (dev.yx_list || dev.yx_points || []).forEach(yx => {
          if (typeof yx.id === 'number') yx_ids.push(yx.id);
        });
        (dev.dd_list || dev.dd_points || []).forEach(dd => {
          if (typeof dd.id === 'number') dd_ids.push(dd.id);
        });
      });
    });
  });

  return { yc_ids, yx_ids, dd_ids };
}

// Memoized associated point cache
let cachedAssociatedResult: { yc_ids: number[]; yx_ids: number[]; dd_ids: number[] } | null = null;
let lastComponentsRef: any = null;

export function invalidateAssociatedPointsCache() {
  cachedAssociatedResult = null;
  lastComponentsRef = null;
}

/**
 * Extract all unique bound/associated YC, YX, DD point IDs from ScreenComponents
 * Note: YK and YT are control/regulation command channels and are NOT queried directly;
 * only their associated closed-loop feedback verification points (返校测点) are queried.
 */
export function getAssociatedPointIdsFromComponents(
  components: any[] = [],
  extraScreens: any[] = []
): { yc_ids: number[]; yx_ids: number[]; dd_ids: number[] } {
  if (cachedAssociatedResult && components === lastComponentsRef) {
    return cachedAssociatedResult;
  }

  const ycSet = new Set<number>();
  const yxSet = new Set<number>();
  const ddSet = new Set<number>();

  const allComps: any[] = [...(components || [])];
  if (Array.isArray(extraScreens) && extraScreens.length > 0) {
    for (let s = 0; s < extraScreens.length; s++) {
      const scr = extraScreens[s];
      if (Array.isArray(scr?.components)) {
        allComps.push(...scr.components);
      }
    }
  }

  const addPointByClassification = (rawId: any, categoryHint?: string) => {
    if (rawId === undefined || rawId === null || rawId === '') return;
    const numId = typeof rawId === 'number' ? rawId : Number(String(rawId).replace(/[^0-9]/g, ''));
    if (isNaN(numId) || numId <= 0) return;

    // 1. Check exact catalog point definition
    const def = findScadaPointDef(numId);
    if (def.category === 'dd') {
      ddSet.add(numId);
      return;
    }
    if (def.category === 'yx') {
      yxSet.add(numId);
      return;
    }
    if (def.category === 'yc') {
      ycSet.add(numId);
      return;
    }
    if (def.category === 'yk') {
      // YK command point: DO NOT add to realtime query sets!
      // Add its verification point if configured
      const vId = def.point?.targetVerificationPointId || def.point?.targetYxPointId;
      if (vId && Number(vId) > 0) yxSet.add(Number(vId));
      return;
    }
    if (def.category === 'yt') {
      // YT command point: DO NOT add to realtime query sets!
      // Add its verification point if configured
      const vId = def.point?.targetVerificationPointId || def.point?.targetYcPointId;
      if (vId && Number(vId) > 0) ycSet.add(Number(vId));
      return;
    }

    // 2. Fallback using hint/category
    const hint = (categoryHint || '').toLowerCase();
    if (hint === 'dd' || hint === 'energy') {
      ddSet.add(numId);
    } else if (hint === 'yx' || hint === 'telesignal') {
      yxSet.add(numId);
    } else if (hint === 'yk' || hint === 'telecontrol') {
      // Do not add YK itself
    } else if (hint === 'yt' || hint === 'teleregulation') {
      // Do not add YT itself
    } else if (hint === 'yc' || hint === 'telemetry') {
      ycSet.add(numId);
    }
  };

  const totalLen = allComps.length;
  for (let i = 0; i < totalLen; i++) {
    const comp = allComps[i];
    if (!comp) continue;
    const data = comp.data || {};
    const mapping = data.mapping || {};
    const bindings = data.bindings || {};
    const action = data.action;

    // A. Explicit DD point fields
    if (mapping.dd_id || mapping.ddPointId || mapping.energyPointId) {
      addPointByClassification(mapping.dd_id || mapping.ddPointId || mapping.energyPointId, 'dd');
    }
    // Explicit YC point fields
    if (mapping.yc_id || mapping.ycPointId) {
      addPointByClassification(mapping.yc_id || mapping.ycPointId, 'yc');
    }
    // Explicit YX point fields
    if (mapping.yx_id || mapping.yxPointId) {
      addPointByClassification(mapping.yx_id || mapping.yxPointId, 'yx');
    }

    // B. Direct mapping.pointId
    if (mapping.pointId !== undefined && mapping.pointId !== null && mapping.pointId !== '') {
      const cat = mapping.pointCategory || (comp.type.startsWith('elec-') && comp.type !== 'elec-multimeter' ? 'teleSignal' : 'telemetry');
      addPointByClassification(mapping.pointId, cat);
    }

    // C. Target Return Verification points for Control (YK) / Regulation (YT)
    const targetV = mapping.targetVerificationPointId || mapping.targetYcPointId || mapping.targetYxPointId || action?.targetVerificationPointId || action?.targetPointId;
    if (targetV !== undefined && targetV !== null && targetV !== '') {
      const vId = Number(targetV);
      if (!isNaN(vId) && vId > 0) {
        const isRegulation = mapping.pointCategory === 'teleRegulation' || action?.type === 'tele-regulation' || mapping.ytPointId || mapping.yt_id;
        if (isRegulation) {
          ycSet.add(vId);
        } else {
          yxSet.add(vId);
        }
      }
    }

    // D. Return verification points from point catalog defaults
    if (mapping.pointCategory === 'teleRegulation' || mapping.yt_id || mapping.ytPointId || action?.type === 'tele-regulation') {
      const ytId = Number(mapping.pointId || mapping.yt_id || mapping.ytPointId || action?.pointId || action?.yt_id);
      if (!isNaN(ytId) && ytId > 0) {
        const pDef = findScadaPointDef(ytId);
        if (pDef.point?.targetVerificationPointId) {
          const vId = Number(pDef.point.targetVerificationPointId);
          if (!isNaN(vId) && vId > 0) ycSet.add(vId);
        }
      }
    } else if (mapping.pointCategory === 'teleControl' || mapping.yk_id || mapping.ykPointId || action?.type === 'tele-control') {
      const ykId = Number(mapping.pointId || mapping.yk_id || mapping.ykPointId || action?.pointId || action?.yk_id);
      if (!isNaN(ykId) && ykId > 0) {
        const pDef = findScadaPointDef(ykId);
        if (pDef.point?.targetVerificationPointId) {
          const vId = Number(pDef.point.targetVerificationPointId);
          if (!isNaN(vId) && vId > 0) yxSet.add(vId);
        }
      }
    }

    // E. Bound Key pattern matching
    const candidateStrings = [
      bindings.value,
      bindings.state,
      bindings.energy,
      mapping.valueKey,
      mapping.stateKey,
      mapping.pointKey,
      mapping.statusKey,
      comp.customProps?.pointKey
    ];

    for (let s = 0; s < candidateStrings.length; s++) {
      const str = candidateStrings[s];
      if (typeof str === 'string' && str) {
        const ddMatch = str.match(/(?:^|_)DD_(\d+)/i);
        if (ddMatch && ddMatch[1]) {
          ddSet.add(Number(ddMatch[1]));
          continue;
        }

        const yxMatch = str.match(/(?:^|_)YX_(\d+)/i);
        if (yxMatch && yxMatch[1]) {
          yxSet.add(Number(yxMatch[1]));
          continue;
        }

        const ycMatch = str.match(/(?:^|_)YC_(\d+)/i);
        if (ycMatch && ycMatch[1]) {
          ycSet.add(Number(ycMatch[1]));
          continue;
        }

        // Check if string contains raw 6+ digit ID without _YK_ / _YT_
        if (!str.includes('_YK_') && !str.includes('_YT_')) {
          const numMatch = str.match(/(\d{6,})/);
          if (numMatch && numMatch[1]) {
            addPointByClassification(Number(numMatch[1]), mapping.pointCategory);
          }
        }
      }
    }
  }

  cachedAssociatedResult = {
    yc_ids: Array.from(ycSet),
    yx_ids: Array.from(yxSet),
    dd_ids: Array.from(ddSet)
  };
  lastComponentsRef = components;

  return cachedAssociatedResult;
}

/**
 * Check if a component is associated with YK (遥控) or YT (遥调)
 */
export function isComponentBoundToControlOrRegulation(comp: ScreenComponent | null | undefined): {
  isBound: boolean;
  type?: 'yk' | 'yt';
  pointId?: number;
  targetVerificationPointId?: number;
  device?: ScadaDeviceNode | any;
  facility?: ScadaFacilityNode | any;
  bay?: ScadaBayNode | any;
} {
  if (!comp) return { isBound: false };

  const data: any = comp.data || {};
  const mapping = data.mapping || {};
  const action = data.action;

  // 1. Direct YK mapping
  if (mapping.yk_id || mapping.ykPointId || (mapping.pointCategory === 'teleControl' && mapping.pointId)) {
    const ykId = Number(mapping.yk_id || mapping.ykPointId || mapping.pointId);
    const def = findScadaPointDef(ykId);
    const rawV = mapping.targetVerificationPointId || def.point?.targetVerificationPointId;
    const vId = rawV !== undefined && rawV !== null && rawV !== '' ? Number(rawV) : undefined;
    const dev = def.device || (mapping.deviceId ? { dev_id: mapping.deviceId, id: mapping.deviceId, dev_name: mapping.deviceName || '' } : undefined);
    return {
      isBound: true,
      type: 'yk',
      pointId: !isNaN(ykId) ? ykId : undefined,
      targetVerificationPointId: vId && !isNaN(vId) ? vId : undefined,
      device: dev,
      facility: def.facility,
      bay: def.bay
    };
  }

  // 2. Direct YT mapping
  if (mapping.yt_id || mapping.ytPointId || (mapping.pointCategory === 'teleRegulation' && mapping.pointId)) {
    const ytId = Number(mapping.yt_id || mapping.ytPointId || mapping.pointId);
    const def = findScadaPointDef(ytId);
    const rawV = mapping.targetVerificationPointId || mapping.targetYcPointId || def.point?.targetVerificationPointId;
    const vId = rawV !== undefined && rawV !== null && rawV !== '' ? Number(rawV) : undefined;
    const dev = def.device || (mapping.deviceId ? { dev_id: mapping.deviceId, id: mapping.deviceId, dev_name: mapping.deviceName || '' } : undefined);
    return {
      isBound: true,
      type: 'yt',
      pointId: !isNaN(ytId) ? ytId : undefined,
      targetVerificationPointId: vId && !isNaN(vId) ? vId : undefined,
      device: dev,
      facility: def.facility,
      bay: def.bay
    };
  }

  // 3. Action type
  if (action?.type === 'tele-control' && (action.yk_id || action.pointId)) {
    const ykId = Number(action.yk_id || action.pointId);
    const def = findScadaPointDef(ykId);
    const rawV = action.targetVerificationPointId || action.targetPointId || mapping.targetVerificationPointId || def.point?.targetVerificationPointId;
    const vId = rawV !== undefined && rawV !== null && rawV !== '' ? Number(rawV) : undefined;
    const dev = def.device || ((action.deviceId || mapping.deviceId) ? { dev_id: action.deviceId || mapping.deviceId, id: action.deviceId || mapping.deviceId, dev_name: mapping.deviceName || '' } : undefined);
    return {
      isBound: true,
      type: 'yk',
      pointId: !isNaN(ykId) ? ykId : undefined,
      targetVerificationPointId: vId && !isNaN(vId) ? vId : undefined,
      device: dev,
      facility: def.facility,
      bay: def.bay
    };
  }

  if (action?.type === 'tele-regulation' && (action.yt_id || action.pointId)) {
    const ytId = Number(action.yt_id || action.pointId);
    const def = findScadaPointDef(ytId);
    const rawV = action.targetVerificationPointId || action.targetPointId || mapping.targetVerificationPointId || mapping.targetYcPointId || def.point?.targetVerificationPointId;
    const vId = rawV !== undefined && rawV !== null && rawV !== '' ? Number(rawV) : undefined;
    const dev = def.device || ((action.deviceId || mapping.deviceId) ? { dev_id: action.deviceId || mapping.deviceId, id: action.deviceId || mapping.deviceId, dev_name: mapping.deviceName || '' } : undefined);
    return {
      isBound: true,
      type: 'yt',
      pointId: !isNaN(ytId) ? ytId : undefined,
      targetVerificationPointId: vId && !isNaN(vId) ? vId : undefined,
      device: dev,
      facility: def.facility,
      bay: def.bay
    };
  }

  return { isBound: false };
}

/**
 * Get live value of SCADA point from raw memory caches
 */
export function getScadaPointLiveValue(pointId: number | string, category: 'yc' | 'yx' | 'dd' = 'yc'): number {
  const numId = Number(pointId);
  if (category === 'yx') {
    return rawYxValues.get(numId) ?? 0;
  }
  return rawYcValues.get(numId) ?? 0;
}

/**
 * Convert facility tree to standard DatasetItem[] structure for backward compatibility
 */
export function convertFacilitiesToDatasets(facilities: ScadaFacilityNode[] = scadaFacilities.value): DatasetItem[] {
  const devices: ScadaDeviceItem[] = [];
  const flatData: Record<string, any> = {};

  facilities.forEach(fac => {
    (fac.bays || []).forEach(bay => {
      (bay.devices || bay.cb_devices || []).forEach(dev => {
        const devId = String(dev.dev_id || dev.id);
        const devName = dev.dev_name || dev.name || '未命名装置';
        devices.push({
          deviceId: devId,
          deviceName: devName,
          deviceType: dev.cbty_name || '开关',
          commStatus: 1,
          telemetries: (dev.yc_list || dev.yc_points || []).map(yc => {
            flatData[`${devId}_YC_${yc.id}`] = yc.val ?? yc.value ?? 0;
            return {
              pointId: yc.id,
              name: yc.name,
              alias: yc.alias,
              factor: 1,
              unit: yc.unit || 'V',
              value: yc.val ?? yc.value ?? 0
            };
          }),
          teleSignals: (dev.yx_list || dev.yx_points || []).map(yx => {
            flatData[`${devId}_YX_${yx.id}`] = yx.val ?? yx.value ?? 0;
            return {
              pointId: yx.id,
              name: yx.name,
              alias: yx.alias,
              value: yx.val ?? yx.value ?? 0,
              statusText: (yx.val ?? yx.value ?? 0) === 1 ? '变位(合)' : '变位(分)'
            };
          }),
          energies: (dev.dd_list || dev.dd_points || []).map(dd => {
            flatData[`${devId}_DD_${dd.id}`] = dd.val ?? dd.value ?? 0;
            return {
              pointId: dd.id,
              name: dd.name,
              alias: dd.alias,
              factor: 1,
              unit: dd.unit || 'kWh',
              value: dd.val ?? dd.value ?? 0
            };
          }),
          teleControls: (dev.yk_list || dev.yk_points || []).map(yk => ({
            pointId: yk.id,
            name: yk.name,
            alias: yk.alias,
            targetPointId: yk.targetVerificationPointId,
            options: [
              { label: '合闸指令', value: 1 },
              { label: '分闸指令', value: 0 }
            ]
          })),
          teleRegulations: (dev.yt_list || dev.yt_points || []).map(yt => ({
            pointId: yt.id,
            name: yt.name,
            alias: yt.alias,
            unit: yt.unit || '档',
            min: yt.min ?? 0,
            max: yt.max ?? 100,
            step: yt.step ?? 1,
            value: 0,
            targetYcPointId: yt.targetVerificationPointId
          }))
        });
      });
    });
  });

  return [
    {
      id: 'ds-scada-main',
      name: 'SCADA 实时测控数据库',
      description: 'SCADA 厂站/间隔/装置/四遥测控全量数据表',
      type: 'mock',
      updateIntervalMs: 1000,
      devices,
      data: flatData,
      fields: []
    }
  ];
}
