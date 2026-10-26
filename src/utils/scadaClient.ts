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
  // 在 Linux 凝思系统打包运行 (file:// 协议) 且未手动配置时，自动兜底本机的 SCADA C++ 接口服务
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
    return DEFAULT_SCADA_API_URL;
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
              { id: 62000004, name: 'yc04', alias: 'F01.V10.S01.DL01.YC004', type: 0, type_name: '普通遥测', val: 120000, status: 0, status_name: '正常', if_yt: 0 },
              { id: 62000005, name: 'yc05', alias: 'F01.V10.S01.DL01.YC005', type: 0, type_name: '普通遥测', val: 0, status: 1, status_name: '无效', if_yt: 1 },
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
              { id: 62000070, name: 'yt_feedback_yc', alias: 'F01.V10.S01.DL02.YC_FB', type: 0, type_name: '调节反馈遥测', val: 9.0, status: 0, status_name: '正常', if_yt: 1 }
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
export const rawDdQuality = new Map<number, number>();

// ---------------------------------------------------------------------------
// 遥信状态 (行业标准定义) 与变位闪烁判定
// ---------------------------------------------------------------------------
export const STATE_YX = {
  NORMAL: 0,          // 正常
  INVALID: 1,         // 无效
  BAD_DATA: 2,        // 双位不一致(合)
  BAD_DATA_OFF: 3,    // 双位不一致(分)
  LOCK_ON: 4,         // 遥信封锁(合)
  LOCK_OFF: 5,        // 遥信封锁(分)
  SET: 6,             // 遥信人工置数
  BW_ON: 7,           // 遥信变位(合)
  BW_OFF: 8,          // 遥信变位(分)
  SGBW_ON: 9,         // 遥信事故变位(合)
  SGBW_OFF: 10,       // 遥信事故变位(分)
  SOE_ON: 11,         // 遥信SOE动作
  SOE_OFF: 12,        // 遥信SOE复归
  DISTURB: 13,        // 遥信扰动
  CHECK_REPARE: 14,   // 遥信检修
  PASSBY: 15          // 遥信被旁路
} as const;

/**
 * 判断遥信测点是否处于变位闪烁状态：
 * 严格依据行业标准与用户要求：只要变位，不管是什么变位，都要闪烁
 * 对应状态码：
 * 7:  STATE_YX_BW_ON       遥信变位(合)
 * 8:  STATE_YX_BW_OFF      遥信变位(分)
 * 9:  STATE_YX_SGBW_ON     遥信事故变位(合)
 * 10: STATE_YX_SGBW_OFF    遥信事故变位(分)
 * 11: STATE_YX_SOE_ON      遥信SOE动作
 * 12: STATE_YX_SOE_OFF     遥信SOE复归
 * 非变位状态（0 正常, 1 无效, 2~6, 13~15）绝不闪烁。
 */
export function isYxFlashingStatus(status: any, statusName?: string): boolean {
  if (status !== undefined && status !== null && status !== '') {
    const num = Number(status);
    if (!isNaN(num)) {
      if (num >= 7 && num <= 12) return true;
      if ((num >= 0 && num <= 6) || (num >= 13 && num <= 15)) return false;
    }
  }
  if (typeof statusName === 'string' && statusName) {
    if (statusName.includes('变位') || statusName.includes('SOE')) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 遥信变位闪烁状态集 (固定 1s 闪烁周期，支持画面清闪与全部清闪)
// ---------------------------------------------------------------------------
export const flashingYxPoints = ref<Set<number>>(new Set());
// 响应式版本号，每次闪烁点发生任何改变（包括新增、移除、清闪、后端推送），自增触发 Vue 视图重绘
export const flashingVersion = ref<number>(0);

// ---------------------------------------------------------------------------
// 400+ 测点精准局部响应式更新系统 (针对凝思 Linux 低性能硬件极致优化)
// 原理：每个测点拥有自身独立的浅层响应式 Ref，组件只订阅自身绑定的 PointId。
// 400 个测点刷新时，仅数值变动的个别测点通知组件重绘；未变动的 390+ 个测点 0 次 Vue diff、0 次计算！
// 彻底解决全局 scadaLiveTick 每秒强制触发 400+ 图元同时重新渲染导致的 150% CPU 跑满卡顿！
// ---------------------------------------------------------------------------
const pointReactiveRefs = new Map<number, any>();

/**
 * 获取指定测点的独立轻量响应式触发器 (按需懒创建，零内存浪费)
 */
export function getPointReactiveRef(pointId: number) {
  let r = pointReactiveRefs.get(pointId);
  if (!r) {
    const initVal = rawYcValues.get(pointId) ?? rawYxValues.get(pointId) ?? rawDdValues.get(pointId) ?? 0;
    r = shallowRef<number>(initVal);
    pointReactiveRefs.set(pointId, r);
  }
  return r;
}

/**
 * 触发指定测点局部更新 (仅当数值或品质发生实质性变化时调用)
 */
export function notifyPointChanged(pointId: number, newVal: number) {
  const r = pointReactiveRefs.get(pointId);
  if (r) {
    r.value = newVal;
  }
}

// Single reactive pulse ticker: 仅供无明确 pointId 的非标组件或首帧保底使用
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
          rawDdQuality.set(dd.id, dd.status ?? 0);
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
 * 快速获取测点质量状态 (0: 正常, 1: 质量差/无效)
 */
export function getScadaPointQuality(pointId: number): number {
  if (rawYcQuality.has(pointId)) return rawYcQuality.get(pointId)!;
  if (rawDdQuality.has(pointId)) return rawDdQuality.get(pointId)!;
  if (rawYxQuality.has(pointId)) return rawYxQuality.get(pointId)!;
  return 0;
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
              unit: String(yc.unit || ''),
              if_yt: yc.if_yt !== undefined ? Number(yc.if_yt) : (yc.id === 62000005 || yc.id === 62000070 ? 1 : 0)
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
    const electronScada = (typeof window !== 'undefined' && ((window as any).electronAPI?.scada || (window as any).electron?.scada));
    if (electronScada?.getConfigFile) {
      const res = await electronScada.getConfigFile();
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
          console.log('[SCADA] 成功从磁盘 data/scada_config.json 载入测点配置');
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

    const electronScada = (typeof window !== 'undefined' && ((window as any).electronAPI?.scada || (window as any).electron?.scada));
    if (electronScada?.saveConfigFile) {
      const res = await electronScada.saveConfigFile(jsonStr);
      if (res && res.success) {
        console.log('[SCADA] 成功将测点配置写入磁盘文件: data/scada_config.json');
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY_SCADA_CONFIG, jsonStr);
    }
    return true;
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
  let timeoutId: any = null;

  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => {
      try { controller.abort(); } catch {}
    }, 3500);

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

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const resJson: ScadaRealtimeResponse = await response.json();
    if (resJson && (resJson.code === 200 || (resJson as any).status === 'success') && resJson.data) {
      const { yc = [], yx = [], dd = [] } = resJson.data;

      // Update YC Cache with strict diff detection (400+ points optimization)
      for (let i = 0; i < yc.length; i++) {
        const item = yc[i];
        const val = item.val ?? 0;
        const oldVal = rawYcValues.get(item.id);
        const oldQuality = rawYcQuality.get(item.id);
        if (oldVal !== val || oldQuality !== item.status) {
          rawYcValues.set(item.id, val);
          if (item.status !== undefined) rawYcQuality.set(item.id, item.status);
          cachedRealtimeYc.set(item.id, item);
          notifyPointChanged(item.id, val);
        }
      }

      // Update YX Cache with strict diff detection and displacement (变位) tracking
      let yxFlashingUpdated = false;
      const nextFlashing = new Set<number>(flashingYxPoints.value);

      for (let i = 0; i < yx.length; i++) {
        const item = yx[i];
        const pointId = Number(item.id);
        if (isNaN(pointId) || pointId <= 0) continue;

        const val = item.val !== undefined ? Number(item.val) : (item.value !== undefined ? Number(item.value) : 0);
        const status = item.status !== undefined ? Number(item.status) : 0;
        const statusName = String(item.status_name || '');
        const oldVal = rawYxValues.get(pointId);
        const oldQuality = rawYxQuality.get(pointId);

        // 严格依据遥信信息中的 status 判断是否处于变位闪烁 (status 7~12 为变位闪烁，其余非变位不闪)
        const shouldFlash = isYxFlashingStatus(status, statusName);
        if (shouldFlash) {
          if (!nextFlashing.has(pointId)) {
            nextFlashing.add(pointId);
            yxFlashingUpdated = true;
          }
        } else {
          if (nextFlashing.has(pointId)) {
            nextFlashing.delete(pointId);
            yxFlashingUpdated = true;
          }
        }

        if (oldVal !== val || oldQuality !== status) {
          rawYxValues.set(pointId, val);
          rawYxQuality.set(pointId, status);
          cachedRealtimeYx.set(pointId, { ...item, id: pointId, val, value: val, status, status_name: statusName });
          notifyPointChanged(pointId, val);
        }
      }

      if (yxFlashingUpdated) {
        flashingYxPoints.value = nextFlashing;
        flashingVersion.value++;
      }

      // Update DD Cache with strict diff detection and quality tracking
      for (let i = 0; i < dd.length; i++) {
        const item = dd[i];
        const val = item.val ?? 0;
        const oldVal = rawDdValues.get(item.id);
        const oldQuality = rawDdQuality.get(item.id);
        if (oldVal !== val || oldQuality !== item.status) {
          rawDdValues.set(item.id, val);
          if (item.status !== undefined) rawDdQuality.set(item.id, item.status);
          cachedRealtimeDd.set(item.id, item);
          notifyPointChanged(item.id, val);
        }
      }

      // 核心防卡顿：仅在首帧无数据时触发一次初始化脉冲；后续由各测点精准 notifyPointChanged 独立驱动局部重绘，绝不无脑让全屏 200+ 图元每秒重绘
      if (scadaLiveTick.value === 0) {
        scadaLiveTick.value++;
      }

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
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
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

    // 1.1 标准工业区间数字段分类 (国标 SCADA: 61xxxxxx=遥信, 62xxxxxx=遥测, 35xxxxxx=电度)
    if (numId >= 61000000 && numId <= 61999999) {
      yxSet.add(numId);
      return;
    }
    if (numId >= 62000000 && numId <= 62999999) {
      ycSet.add(numId);
      return;
    }
    if (numId >= 35000000 && numId <= 35999999) {
      ddSet.add(numId);
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

    // B2. Realtime Multi-point Charts: points array in customProps or mapping
    const multiPoints = comp.customProps?.points || mapping.points;
    if (Array.isArray(multiPoints)) {
      for (let p = 0; p < multiPoints.length; p++) {
        const item = multiPoints[p];
        if (typeof item === 'number') {
          addPointByClassification(item);
        } else if (item && typeof item === 'object') {
          addPointByClassification(item.id || item.pointId, item.category || item.type);
        }
      }
    }
    const multiPointIds = comp.customProps?.pointIds || mapping.pointIds;
    if (Array.isArray(multiPointIds)) {
      for (let p = 0; p < multiPointIds.length; p++) {
        addPointByClassification(multiPointIds[p]);
      }
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

  // 4. Device and verification point association
  const yxPointId = Number(mapping.yx_id || (mapping.pointCategory === 'teleSignal' || mapping.pointCategory === 'yx' ? mapping.pointId : null));
  const ycPointId = Number(mapping.yc_id || (mapping.pointCategory === 'telemetry' || mapping.pointCategory === 'yc' ? mapping.pointId : null));
  const deviceId = mapping.deviceId || action?.deviceId || comp.customProps?.deviceId;

  if (yxPointId || ycPointId || deviceId) {
    const facs = scadaFacilities.value || [];
    for (let f = 0; f < facs.length; f++) {
      const fac = facs[f];
      for (let b = 0; b < (fac.bays || []).length; b++) {
        const bay = fac.bays[b];
        const devs = bay.devices || bay.cb_devices || [];
        for (let d = 0; d < devs.length; d++) {
          const dev = devs[d];
          const isTargetDev = deviceId && String(dev.dev_id || dev.id) === String(deviceId);

          // YK search
          const ykList = dev.yk_list || dev.yk_points || [];
          if (ykList.length > 0) {
            if (yxPointId) {
              const matchedYk = ykList.find((yk: any) => Number(yk.targetVerificationPointId) === yxPointId);
              if (matchedYk) {
                return {
                  isBound: true,
                  type: 'yk',
                  pointId: matchedYk.id,
                  targetVerificationPointId: yxPointId,
                  device: dev,
                  facility: fac,
                  bay
                };
              }
            }
            if (isTargetDev && ['elec-breaker', 'elec-disconnector', 'elec-handcart'].includes(comp.type)) {
              const yk = ykList[0];
              return {
                isBound: true,
                type: 'yk',
                pointId: yk.id,
                targetVerificationPointId: yk.targetVerificationPointId || yxPointId || undefined,
                device: dev,
                facility: fac,
                bay
              };
            }
          }

          // YT search
          const ytList = dev.yt_list || dev.yt_points || [];
          if (ytList.length > 0) {
            if (ycPointId) {
              const matchedYt = ytList.find((yt: any) => Number(yt.targetVerificationPointId) === ycPointId);
              if (matchedYt) {
                return {
                  isBound: true,
                  type: 'yt',
                  pointId: matchedYt.id,
                  targetVerificationPointId: ycPointId,
                  device: dev,
                  facility: fac,
                  bay
                };
              }
            }
            if (isTargetDev && ['elec-transformer', 'elec-transformer-3w', 'elec-transformer-tap'].includes(comp.type)) {
              const yt = ytList[0];
              return {
                isBound: true,
                type: 'yt',
                pointId: yt.id,
                targetVerificationPointId: yt.targetVerificationPointId || ycPointId || undefined,
                device: dev,
                facility: fac,
                bay
              };
            }
          }
        }
      }
    }
  }

  return { isBound: false };
}

/**
 * 下发标准变位清闪请求: POST /api/scada/control/unflash
 * 模式一：【画面清闪】 { "yx_ids": [52000001, 52000002] }
 * 模式二：【全部清闪】 { "all": true }
 */
export async function sendScadaUnflash(payload: { yx_ids?: number[]; all?: boolean }): Promise<{
  code: number;
  msg: string;
  cleared_count: number;
}> {
  const baseUrl = getScadaApiBaseUrl();
  const url = baseUrl ? `${baseUrl}/api/scada/control/unflash` : '/api/scada/control/unflash';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('[SCADA] 清闪请求异常:', err);
    return {
      code: 500,
      msg: err?.message || '清闪请求异常',
      cleared_count: 0
    };
  }
}

/**
 * 模式一：【画面清闪】（前端当前接线图画面打开时，收集本画面展示的所有遥信 ID，点击画面上的清闪按钮下发）
 */
export async function clearScreenFlash(pointIds: number[]): Promise<number> {
  if (!pointIds || pointIds.length === 0) return 0;

  // 1. 本地状态即时刷回 0，界面立即停止闪烁 (一次性清闪，后续变位推送 status 7~12 继续恢复闪烁)
  const next = new Set<number>(flashingYxPoints.value);
  for (let i = 0; i < pointIds.length; i++) {
    const id = Number(pointIds[i]);
    next.delete(id);
    rawYxQuality.set(id, 0);
    const cached = cachedRealtimeYx.get(id);
    if (cached) {
      cached.status = 0;
      cached.status_name = '正常';
    }
  }
  flashingYxPoints.value = next;
  flashingVersion.value++;

  // 2. 下发接口到共享内存/后端
  const res = await sendScadaUnflash({ yx_ids: pointIds });
  return res?.cleared_count ?? 0;
}

/**
 * 模式二：【全部清闪】（全站全局一键清闪，下发 { "all": true }）
 */
export async function clearAllFlash(): Promise<number> {
  // 1. 本地所有闪烁点状态刷回 0 (一次性清闪)
  flashingYxPoints.value.forEach((id) => {
    rawYxQuality.set(id, 0);
    const cached = cachedRealtimeYx.get(id);
    if (cached) {
      cached.status = 0;
      cached.status_name = '正常';
    }
  });
  flashingYxPoints.value = new Set<number>();
  flashingVersion.value++;

  // 2. 下发全局一键清闪接口
  const res = await sendScadaUnflash({ all: true });
  return res?.cleared_count ?? 0;
}

/**
 * 判断指定遥信测点当前是否处于变位闪烁中
 * 严格依据响应式 flashingYxPoints 与遥信 status (status 7~12 为变位闪烁，其余非变位不闪)
 */
export function isPointFlashing(pointId: number): boolean {
  const _ = flashingVersion.value; // 建立 Vue 响应式依赖追踪，确保任何闪烁状态变动立即重绘
  const numId = Number(pointId);
  if (isNaN(numId) || numId <= 0) return false;

  // 1. 响应式 Set 判断 (优先最准，包含所有当前被判定为变位闪烁的测点)
  if (flashingYxPoints.value.has(numId)) {
    return true;
  }

  // 2. 检查缓存状态保底 (首帧或未轮询前)
  const quality = rawYxQuality.get(numId);
  if (quality !== undefined && isYxFlashingStatus(quality)) {
    return true;
  }
  const cached = cachedRealtimeYx.get(numId);
  if (cached && isYxFlashingStatus(cached.status, cached.status_name)) {
    return true;
  }
  return false;
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

// ---------------------------------------------------------------------------
// 行业标准电力 SCADA 测点工程中文名称字典表 (南瑞/国电南自/许继工程规范)
// ---------------------------------------------------------------------------
export const SCADA_STANDARD_POINT_NAMES: Record<string, string> = {
  // 遥测 (YC)
  'yc01': 'A相母线电压 Ua',
  'yc02': 'B相母线电压 Ub',
  'yc03': 'C相母线电压 Uc',
  'yc04': 'AB相间线电压 Uab',
  'yc05': 'BC相间线电压 Ubc',
  'yc06': 'CA相间线电压 Uca',
  'yc07': 'A相进线电流 Ia',
  'yc08': 'B相进线电流 Ib',
  'yc09': 'C相进线电流 Ic',
  'yc10': '零序电流 I0',
  'yc11': '总有功功率 P',
  'yc12': '总无功功率 Q',
  'yc13': '视在功率 S',
  'yc14': '功率因数 cosΦ',
  'yc15': '电网频率 f',
  'yc16': '变压器油温',
  'yc17': '变压器绕组温',
  'yc18': '环境温度',
  'yc19': '母线有功总加',
  'yc20': '母线无功总加',
  'yc21': '正向有功需量',
  'yc22': '反向有功需量',
  'yc23': '谐波畸变率 THD',
  'yc24': '回路负荷率',
  // 遥信 (YX)
  'yx01': '断路器合闸位置',
  'yx02': '断路器分闸位置',
  'yx03': '隔离开关合位',
  'yx04': '隔离开关分位',
  'yx05': '接地刀闸分位',
  'yx06': '接地刀闸合位',
  'yx07': '弹簧未储能告警',
  'yx08': '控制回路断线',
  'yx09': '事故总信号(变位)',
  'yx10': '预告总信号',
  'yx11': '自动重合闸动作',
  'yx12': '过流I段速断动作',
  'yx13': '过流II段限时动作',
  'yx14': '零序过流保护动作',
  'yx15': '低周减载动作',
  'yx16': '保护装置自检告警',
  'yx17': '通信通信中断告警',
  // 电度 (DD)
  'dd01': '正向有功总电量',
  'dd02': '正向无功总电量',
  'dd03': '反向有功总电量',
  'dd04': '反向无功总电量'
};

/**
 * 解析并展示标准的测点工程名称 (确保测点名称清晰可读，不展示枯燥的物理ID)
 */
export function getScadaPointDisplayName(pt: any): string {
  if (!pt) return '未命名测点';
  const rawName = String(pt.name || '').trim();
  const lowerName = rawName.toLowerCase();

  // 1. 标准字典直查
  if (SCADA_STANDARD_POINT_NAMES[lowerName]) {
    return SCADA_STANDARD_POINT_NAMES[lowerName];
  }

  // 2. 规范化前缀数字 (如 yc1 -> yc01)
  const m = lowerName.match(/^(yc|yx|dd|yk|yt)[-_]?0*(\d+)$/i);
  if (m) {
    const normKey = `${m[1].toLowerCase()}${String(m[2]).padStart(2, '0')}`;
    if (SCADA_STANDARD_POINT_NAMES[normKey]) {
      return SCADA_STANDARD_POINT_NAMES[normKey];
    }
  }

  // 3. 自定义中文名称或长名称直接使用
  if (rawName && !/^yc\d+$/i.test(rawName) && !/^yx\d+$/i.test(rawName) && !/^dd\d+$/i.test(rawName)) {
    return rawName;
  }

  // 4. 别名与描述备选
  if (pt.desc || pt.description) {
    return String(pt.desc || pt.description);
  }
  if (pt.alias && !pt.alias.includes('.') && pt.alias.length > 2) {
    return pt.alias;
  }
  if (pt.type_name) {
    return `${pt.type_name}`;
  }

  return rawName || '测点';
}

// ============================================================================
// SCADA 监控系统 — 告警模块 HTTP API 客户端接口与状态中心
// ============================================================================

export interface ScadaWarnLevelItem {
  level: number;
  name: string;
  open_color: string;
  close_color: string;
}

export interface ScadaWarnTypeItem {
  type_id: number;
  name: string;
}

export interface ScadaWarnConfig {
  levels: ScadaWarnLevelItem[];
  types: ScadaWarnTypeItem[];
}

export interface ScadaRealtimeWarnItem {
  seq_id: number;
  time: string;
  timestamp: number;
  content: string;
  full_text?: string;
  level: number;
  level_name?: string;
  level_color?: string;
  type?: number;
  type_name?: string;
  is_examine?: boolean;
  is_revert?: boolean;
  tabs?: string[];
  fac_id?: number;
  fac_name?: string;
  bay_id?: number;
  bay_name?: string;
  dev_id?: number;
  dev_name?: string;
  key_id?: number;
  key_name?: string;
  val?: number;
  val_desc?: string;
  status?: number;
  status_desc?: string;
  confirm: number; // 0: 未确认 (闪烁/高亮), 1: 已确认
  confirm_desc?: string;
  selected?: boolean;
}

export interface ScadaHistoryWarnItem {
  time: string;
  timestamp: number;
  msec?: number;
  table_no: number;
  table_name: string;
  content: string;
  alias?: string;
  fac_id?: number;
  bay_id?: number;
  dev_id?: number;
  key_id?: number;
  status?: number;
  val?: number;
  host?: string;
  operator?: string;
}

export interface ScadaWarnReport {
  fac_name: string;
  bay_name: string;
  fault_type: string;
  detail: string;
  related_events: string[];
}

// 全局告警配置字典缓存 (严格对齐 SCADA 规范：提示 #67C23A, 告警 #E6A23C, 事故 #FF0000)
export const globalWarnLevels = ref<ScadaWarnLevelItem[]>([
  { level: 3, name: "事故信息", open_color: "#67C23A", close_color: "#FF0000" },
  { level: 2, name: "告警信息", open_color: "#67C23A", close_color: "#E6A23C" },
  { level: 1, name: "提示信息", open_color: "#67C23A", close_color: "#67C23A" },
  { level: 4, name: "操作记录", open_color: "#00FFFF", close_color: "#00FFFF" }
]);

export const globalWarnTypes = ref<ScadaWarnTypeItem[]>([
  { type_id: 1, name: "遥信变位" },
  { type_id: 2, name: "遥测越限" },
  { type_id: 3, name: "厂站工况" },
  { type_id: 4, name: "结点工况" },
  { type_id: 8, name: "遥控" },
  { type_id: 9, name: "人工操作" },
  { type_id: 10, name: "事件SOE" },
  { type_id: 28, name: "保护动作" }
]);

// 全局未确认告警数量 (响应式供给底栏、顶栏与图元，严格从实际现场接口获取，默认0)
export const globalUnconfirmedAlarmCount = ref<number>(0);

// 全局实时告警列表 (最新活跃队列)
export const globalRealtimeWarns = ref<ScadaRealtimeWarnItem[]>([]);

/**
 * 实时同步告警数据并更新未确认告警数量 (从现场实际接口获取，绝不虚构)
 */
export async function syncRealtimeAlarms(): Promise<void> {
  try {
    const res = await fetchScadaWarnRealtime({ limit: 100, after_seq: 0 });
    if (res.success && Array.isArray(res.data)) {
      globalRealtimeWarns.value = res.data;
      const unack = res.data.filter(a => a.confirm === 0).length;
      globalUnconfirmedAlarmCount.value = unack;
    }
  } catch {
    // 忽略网络通信偶发异常
  }
}

/**
 * 1. 获取告警元数据与配置字典: GET /api/scada/warn/config
 */
export async function fetchScadaWarnConfig(): Promise<{ success: boolean; data?: ScadaWarnConfig; error?: string }> {
  const baseUrl = getScadaApiBaseUrl().replace(/\/+$/, '');
  const url = baseUrl ? `${baseUrl}/api/scada/warn/config` : '/api/scada/warn/config';

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.code === 200 && json.data) {
      if (Array.isArray(json.data.levels)) globalWarnLevels.value = json.data.levels;
      if (Array.isArray(json.data.types)) globalWarnTypes.value = json.data.types;
      return { success: true, data: json.data };
    }
    return { success: false, error: json?.msg || '获取告警字典异常' };
  } catch (err: any) {
    return { success: false, error: err?.message || '网络连接异常' };
  }
}

/**
 * 2. 获取实时告警列表 (支持增量轮询): GET /api/scada/warn/realtime
 * - after_seq 为 0 时不带游标：默认倒序获取系统最新产生的 limit 条告警，按时间正序返回
 * - after_seq 大于 0 时：带游标增量拉取比该序号更新的记录
 */
export async function fetchScadaWarnRealtime(params?: { limit?: number; after_seq?: number }): Promise<{
  success: boolean;
  data?: ScadaRealtimeWarnItem[];
  total?: number;
  error?: string;
}> {
  const baseUrl = getScadaApiBaseUrl().replace(/\/+$/, '');
  const limit = params?.limit ?? 100;
  const afterSeq = params?.after_seq ?? 0;
  const queryStr = afterSeq > 0 ? `after_seq=${afterSeq}&limit=${limit}` : `limit=${limit}`;
  const url = baseUrl
    ? `${baseUrl}/api/scada/warn/realtime?${queryStr}`
    : `/api/scada/warn/realtime?${queryStr}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.code === 200) {
      return { success: true, data: json.data || [], total: json.total || 0 };
    }
    return { success: false, error: json?.msg || '获取实时告警异常' };
  } catch (err: any) {
    return { success: false, error: err?.message || '网络连接异常' };
  }
}

/**
 * 3. 单条/批量告警确认 (对位复归): POST /api/scada/warn/ack
 * - 单条确认：Body: { "seq_id": 1052 }
 * - 批量确认：Body: { "seq_ids": [1051, 1052] }
 */
export async function ackScadaWarn(params: {
  seq_id?: number;
  seq_ids?: number[];
  operator?: string;
}): Promise<{ success: boolean; cleared_count?: number; error?: string }> {
  const baseUrl = getScadaApiBaseUrl().replace(/\/+$/, '');
  const url = baseUrl ? `${baseUrl}/api/scada/warn/ack` : '/api/scada/warn/ack';

  try {
    const payload: any = {};
    if (params.seq_ids && params.seq_ids.length > 0) {
      payload.seq_ids = params.seq_ids;
    } else if (params.seq_id !== undefined) {
      payload.seq_id = params.seq_id;
    }
    if (params.operator) {
      payload.operator = params.operator;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.code === 200) {
      return { success: true, cleared_count: json.cleared_count ?? 0 };
    }
    return { success: false, error: json?.msg || '告警确认失败' };
  } catch (err: any) {
    return { success: false, error: err?.message || '网络连接异常' };
  }
}

/**
 * 4. 告警全量一键确认 (一键对位复归): POST /api/scada/warn/ack_all
 */
export async function ackAllScadaWarn(params?: { operator?: string }): Promise<{
  success: boolean;
  cleared_count?: number;
  error?: string;
}> {
  const baseUrl = getScadaApiBaseUrl().replace(/\/+$/, '');
  const url = baseUrl ? `${baseUrl}/api/scada/warn/ack_all` : '/api/scada/warn/ack_all';

  try {
    const payload = params?.operator ? { operator: params.operator } : {};
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.code === 200) {
      return { success: true, cleared_count: json.cleared_count ?? 0 };
    }
    return { success: false, error: json?.msg || '全量确认失败' };
  } catch (err: any) {
    return { success: false, error: err?.message || '网络连接异常' };
  }
}

/**
 * 5. 实时告警清屏: POST /api/scada/warn/clear
 */
export async function clearScadaWarnCache(): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getScadaApiBaseUrl().replace(/\/+$/, '');
  const url = baseUrl ? `${baseUrl}/api/scada/warn/clear` : '/api/scada/warn/clear';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({})
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.code === 200) {
      return { success: true };
    }
    return { success: false, error: json?.msg || '清屏失败' };
  } catch (err: any) {
    return { success: false, error: err?.message || '网络连接异常' };
  }
}

/**
 * 6. 历史告警综合检索: POST /api/scada/warn/history
 */
export async function queryScadaWarnHistory(params: {
  start_time?: number;
  end_time?: number;
  search_type?: number;
  select_all_fac?: boolean;
  fac_ids?: number[];
  select_all_bay?: boolean;
  bay_ids?: number[];
  select_all_dev?: boolean;
  dev_ids?: number[];
  select_all_level?: boolean;
  level_ids?: number[];
  table_options?: Array<{ table_no: number; status_mask: number }>;
  keyword?: string;
  limit?: number;
}): Promise<{ success: boolean; data?: ScadaHistoryWarnItem[]; total?: number; error?: string }> {
  const baseUrl = getScadaApiBaseUrl().replace(/\/+$/, '');
  const url = baseUrl ? `${baseUrl}/api/scada/warn/history` : '/api/scada/warn/history';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        start_time: params.start_time || 0,
        end_time: params.end_time || Math.floor(Date.now() / 1000),
        search_type: params.search_type ?? 0,
        select_all_fac: params.select_all_fac ?? true,
        fac_ids: params.fac_ids || [],
        select_all_bay: params.select_all_bay ?? true,
        bay_ids: params.bay_ids || [],
        select_all_dev: params.select_all_dev ?? true,
        dev_ids: params.dev_ids || [],
        select_all_level: params.select_all_level ?? true,
        level_ids: params.level_ids || [],
        table_options: params.table_options,
        keyword: params.keyword || '',
        limit: params.limit || 500
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.code === 200) {
      return { success: true, data: json.data || [], total: json.total || 0 };
    }
    return { success: false, error: json?.msg || '检索历史告警失败' };
  } catch (err: any) {
    return { success: false, error: err?.message || '网络连接异常' };
  }
}

/**
 * 7. 故障智能推理与诊断分析报告: GET /api/scada/warn/report?key_id=...&timestamp=...
 */
export async function fetchScadaWarnReport(
  key_id: number,
  timestamp: number
): Promise<{ success: boolean; data?: ScadaWarnReport; error?: string }> {
  const baseUrl = getScadaApiBaseUrl().replace(/\/+$/, '');
  const url = baseUrl
    ? `${baseUrl}/api/scada/warn/report?key_id=${key_id}&timestamp=${timestamp}`
    : `/api/scada/warn/report?key_id=${key_id}&timestamp=${timestamp}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.code === 200 && json.data) {
      return { success: true, data: json.data };
    }
    return { success: false, error: json?.msg || '获取故障诊断报告失败' };
  } catch (err: any) {
    return { success: false, error: err?.message || '网络连接异常' };
  }
}


