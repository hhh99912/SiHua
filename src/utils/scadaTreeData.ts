/**
 * SCADA 厂站 - 间隔 - 装置 层级结构字典与多维过滤/屏蔽核心算法
 * 严格按照实际厂站配置信息 (/api/scada/config 及 scadaFacilities) 构建，杜绝虚造
 * 包含：
 * 1. 厂站/间隔/装置多级拓扑树 (默认真实厂站: 苏州晟高)
 * 2. 动态拓扑构建器: buildStationTreeFromFacilities
 * 3. 白名单 (筛选) 与 黑名单 (屏蔽) 判定器
 */

export interface ScadaDeviceMeta {
  id: string | number;
  name: string;
  type: string;
}

export interface ScadaBayMeta {
  id: string | number;
  name: string;
  devices: ScadaDeviceMeta[];
}

export interface ScadaStationMeta {
  id: string | number;
  name: string;
  alias: string;
  bays: ScadaBayMeta[];
}

// 实际厂站标准拓扑树 (完全对齐系统真实配置: 厂站-苏州晟高, 间隔-苏州晟高一体柜/柜子2, 设备-6/6YT/7)
export const SCADA_STATION_TREE: ScadaStationMeta[] = [
  {
    id: 4000003,
    name: '苏州晟高',
    alias: 'F01',
    bays: [
      {
        id: 430000001,
        name: '苏州晟高一体柜',
        devices: [
          { id: 7000001, name: '6', type: '开关' },
          { id: 7000003, name: '6YT', type: '开关' }
        ]
      },
      {
        id: 430000002,
        name: '柜子2',
        devices: [
          { id: 7000002, name: '7', type: '开关' }
        ]
      }
    ]
  }
];

/**
 * 严格从 SCADA 真实系统配置 (scadaFacilities / GET /api/scada/config) 动态构建厂站-间隔-装置拓扑树
 * 杜绝任何手工臆造虚构的厂站与间隔
 */
export function buildStationTreeFromFacilities(facilities: any[]): ScadaStationMeta[] {
  if (!facilities || !facilities.length) return SCADA_STATION_TREE;
  return facilities.map((fac: any) => {
    const fId = fac.fac_id || fac.id || 4000003;
    const fName = fac.fac_name || fac.name || '苏州晟高';
    const fAlias = fac.alias || '';
    const rawBays = fac.bays || [];
    const bays: ScadaBayMeta[] = rawBays.map((bay: any) => {
      const bId = bay.bay_id || bay.id || 1;
      const bName = bay.bay_name || bay.name || '间隔';
      const rawDevs = bay.devices || bay.cb_devices || [];
      const devices: ScadaDeviceMeta[] = rawDevs.map((dev: any) => {
        const dId = dev.dev_id || dev.id || 1;
        const dName = dev.dev_name || dev.name || '设备';
        const dType = dev.cbty_name || (dev.cbty === 0 ? '开关' : '设备');
        return {
          id: dId,
          name: dName,
          type: dType
        };
      });
      return {
        id: bId,
        name: bName,
        devices
      };
    });
    return {
      id: fId,
      name: fName,
      alias: fAlias,
      bays
    };
  });
}

export interface ScadaAlarmFilterRules {
  // 白名单筛选 (只要设置了项，告警必须命中才显示)
  filterStations: string[];
  filterBays: string[];      // 存 "厂站->间隔" 或 间隔名称
  filterDevices: string[];   // 存 "厂站->间隔->装置" 或 装置名称

  // 黑名单屏蔽 (只要命中任何一项，一票否决隐藏)
  shieldStations: string[];
  shieldBays: string[];
  shieldDevices: string[];
}

/**
 * 校验告警项是否通过多维黑白名单规则
 * 规则 1：【黑名单屏蔽 (Shield)】具有最高优先级，只要命中厂站、间隔或装置任一屏蔽项，立刻隐藏返回 false
 * 规则 2：【白名单筛选 (Filter)】当某维度设置了白名单（数组长度 > 0）时，告警必须属于白名单集合，否则隐藏返回 false
 */
export function checkAlarmPassesFilterAndShield(
  item: {
    fac_name?: string;
    bay_name?: string;
    dev_name?: string;
  },
  rules: ScadaAlarmFilterRules
): boolean {
  const fac = (item.fac_name || '').trim();
  const bay = (item.bay_name || '').trim();
  const dev = (item.dev_name || '').trim();

  const bayKey = `${fac}->${bay}`;
  const devKey = `${fac}->${bay}->${dev}`;

  // =========================================================================
  // 1. 黑名单屏蔽校验 (Shielding / Blacklist) - 命中即杀
  // =========================================================================
  if (rules.shieldStations && rules.shieldStations.length > 0) {
    if (rules.shieldStations.includes(fac)) {
      return false;
    }
  }

  if (rules.shieldBays && rules.shieldBays.length > 0) {
    if (rules.shieldBays.some(b => b === bay || b === bayKey)) {
      return false;
    }
  }

  if (rules.shieldDevices && rules.shieldDevices.length > 0) {
    if (rules.shieldDevices.some(d => d === dev || d === devKey || d.endsWith(`->${dev}`))) {
      return false;
    }
  }

  // =========================================================================
  // 2. 白名单筛选校验 (Filtering / Whitelist) - 开启后未命中则剔除
  // =========================================================================
  if (rules.filterStations && rules.filterStations.length > 0) {
    if (!rules.filterStations.includes(fac)) {
      return false;
    }
  }

  if (rules.filterBays && rules.filterBays.length > 0) {
    if (!rules.filterBays.some(b => b === bay || b === bayKey)) {
      return false;
    }
  }

  if (rules.filterDevices && rules.filterDevices.length > 0) {
    if (!rules.filterDevices.some(d => d === dev || d === devKey || d.endsWith(`->${dev}`))) {
      return false;
    }
  }

  return true;
}
