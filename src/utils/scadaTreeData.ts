/**
 * SCADA 厂站 - 间隔 - 装置 层级结构字典与多维过滤/屏蔽核心算法
 * 严格遵照工控电力规范及现场实测结构设计
 * 包含：
 * 1. 厂站/间隔/装置多级拓扑树
 * 2. 白名单 (筛选) 与 黑名单 (屏蔽) 判定器
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

// 现场实测标准拓扑树 (完美对接速利达光伏电站、东郊变电站、苏州晟高一体柜)
export const SCADA_STATION_TREE: ScadaStationMeta[] = [
  {
    id: 10001,
    name: '速利达光伏电站',
    alias: 'SLD_PV_01',
    bays: [
      {
        id: 20001,
        name: '公共间隔',
        devices: [
          { id: 30001, name: '公共测控装置', type: '测控' },
          { id: 30002, name: '全站时钟同步屏', type: '对时' },
          { id: 30003, name: '远动通信管理机', type: '通信' }
        ]
      },
      {
        id: 20002,
        name: '站用变间隔',
        devices: [
          { id: 30004, name: '站用变断路器', type: '开关' },
          { id: 30005, name: '站用变测控保护屏', type: '保护' }
        ]
      },
      {
        id: 20003,
        name: 'SVG间隔',
        devices: [
          { id: 30006, name: 'SVG无功补偿装置', type: '补偿' },
          { id: 30007, name: 'SVG并网断路器', type: '开关' },
          { id: 30008, name: 'SVG水冷监控屏', type: '辅控' }
        ]
      },
      {
        id: 20004,
        name: '防孤岛保护间隔',
        devices: [
          { id: 30009, name: '微机防孤岛保护测控装置', type: '保护' },
          { id: 30010, name: '防孤岛解列执行断路器', type: '开关' }
        ]
      },
      {
        id: 20005,
        name: '低频低压稳定控制间隔',
        devices: [
          { id: 30011, name: '稳控切机切负荷装置', type: '稳控' },
          { id: 30012, name: '低频低压测控单元', type: '测控' }
        ]
      },
      {
        id: 20006,
        name: '并网柜间隔',
        devices: [
          { id: 30013, name: '35kV主断路器101', type: '开关' },
          { id: 30014, name: '关口高精度计量表', type: '电度' },
          { id: 30015, name: '出线微机线路保护屏', type: '保护' }
        ]
      },
      {
        id: 20007,
        name: '1号逆变升压间隔',
        devices: [
          { id: 30016, name: '1号集中式逆变器', type: '逆变' },
          { id: 30017, name: '1号箱变高压侧真空断路器', type: '开关' }
        ]
      },
      {
        id: 20008,
        name: '2号逆变升压间隔',
        devices: [
          { id: 30018, name: '2号集中式逆变器', type: '逆变' },
          { id: 30019, name: '2号箱变高压侧真空断路器', type: '开关' }
        ]
      }
    ]
  },
  {
    id: 10002,
    name: '东郊变电站',
    alias: 'DJB_SUB_220',
    bays: [
      {
        id: 20011,
        name: '220kV第一线间隔',
        devices: [
          { id: 30021, name: '2211断路器', type: '开关' },
          { id: 30022, name: '22111隔离刀闸', type: '刀闸' },
          { id: 30023, name: '光纤电流差动保护装置', type: '保护' }
        ]
      },
      {
        id: 20012,
        name: '1号主变间隔',
        devices: [
          { id: 30024, name: '1号主变压器本体', type: '变压器' },
          { id: 30025, name: '1号主变保护测控屏', type: '保护' },
          { id: 30026, name: '主变冷却强油风冷电控柜', type: '辅控' }
        ]
      },
      {
        id: 20013,
        name: '2211出线间隔',
        devices: [
          { id: 30027, name: '2211出线断路器', type: '开关' },
          { id: 30028, name: '故障录波与测距装置', type: '录波' }
        ]
      },
      {
        id: 20014,
        name: '母联2200间隔',
        devices: [
          { id: 30029, name: '2200母联断路器', type: '开关' },
          { id: 30030, name: '220kV双母线微机微差保护屏', type: '保护' }
        ]
      }
    ]
  },
  {
    id: 10003,
    name: '苏州晟高',
    alias: 'SZSG_ESS_01',
    bays: [
      {
        id: 20021,
        name: '苏州晟高一体柜',
        devices: [
          { id: 30031, name: '6#断路器', type: '开关' },
          { id: 30032, name: '一体化储能PCS变流柜', type: '变流' },
          { id: 30033, name: 'BMS电池集装箱管理单元', type: '电池' }
        ]
      },
      {
        id: 20022,
        name: '储能并网间隔',
        devices: [
          { id: 30034, name: '储能总进线断路器', type: '开关' },
          { id: 30035, name: '高压隔离刀闸', type: '刀闸' }
        ]
      },
      {
        id: 20023,
        name: '逆变器升压间隔',
        devices: [
          { id: 30036, name: '升压隔离变压器', type: '变压器' },
          { id: 30037, name: '中性点接地电阻柜', type: '辅控' }
        ]
      }
    ]
  }
];

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
