import { ComponentType, ComponentCategory, DeviceTelemetryPoint, DeviceTeleSignalPoint, DeviceEnergyPoint, DeviceTeleControlPoint } from '../types';

export interface JsonSchemaFieldDef {
  field: string;
  type: string;
  description: string;
  required: boolean;
  sample: any;
}

export interface ComponentJsonSchemaInfo {
  typeKey: string;
  title: string;
  category: ComponentCategory;
  description: string;
  fields: JsonSchemaFieldDef[];
  defaultPayload: any;
  standardTemplates?: Array<{
    name: string;
    id: string;
    description: string;
    payload: any;
  }>;
}

/**
 * Registry of component-specific JSON Schemas
 * 遥测遥信及自定义图元组件数据结构极简统一：仅保存 value (浮点数/数值) 和 quality (0 或 1)
 * 仅图表曲线类组件支持自定义复杂多曲线 JSON
 */
export const COMPONENT_JSON_SCHEMAS: Record<string, ComponentJsonSchemaInfo> = {
  // 1. 遥信状态图元 (状态指示灯 / 开关遥信 / 状态码牌)
  'status': {
    typeKey: 'status',
    title: '遥信状态数据格式 (标准契约)',
    category: 'status',
    description: '遥信图元极简数据契约：仅保留状态数值 value 与通信品质码 quality (0: 无效/未连通, 1: 正常)。',
    fields: [
      { field: 'value', type: 'number', description: '遥信状态数值 (0:分闸/停止/断开, 1:合闸/运行/导通, 2:故障/告警)', required: true, sample: 1 },
      { field: 'quality', type: 'integer (0/1)', description: '数据通信品质码 (1: 良好在线, 0: 未连通/无效, 系统维护不可编辑)', required: true, sample: 1 }
    ],
    defaultPayload: {
      value: 1,
      quality: 1
    }
  },

  // 2. 遥测数值图元 (遥测 / 数码管 / 仪表盘)
  'metrics': {
    typeKey: 'metrics',
    title: '遥测模拟量数据格式 (浮点数契约)',
    category: 'metrics',
    description: '遥测图元极简数据契约：仅保留测量浮点数值 value 与通信品质码 quality (0: 无效/未连通, 1: 正常)。',
    fields: [
      { field: 'value', type: 'number (浮点数)', description: '遥测工程浮点数值 (如 220.5, 10.35, 380.0, 49.98)', required: true, sample: 220.5 },
      { field: 'quality', type: 'integer (0/1)', description: '数据通信品质码 (1: 良好在线, 0: 未连通/无效, 系统维护不可编辑)', required: true, sample: 1 }
    ],
    defaultPayload: {
      value: 220.5,
      quality: 1
    }
  },

  // 3. 自定义图元组件 (设备图元 / 组合多态图元)
  'custom': {
    typeKey: 'custom',
    title: '自定义图元数据格式 (标准契约)',
    category: 'custom',
    description: '自定义图元组件极简数据契约：仅保留状态匹配数值/浮点值 value 与品质码 quality (0 或 1)。',
    fields: [
      { field: 'value', type: 'number', description: '自定义图元当前状态数值或测量值 (与各状态 matchValue / id 对应)', required: true, sample: 1 },
      { field: 'quality', type: 'integer (0/1)', description: '数据通信品质码 (1: 良好在线, 0: 未连通/无效, 系统维护不可编辑)', required: true, sample: 1 }
    ],
    defaultPayload: {
      value: 1,
      quality: 1
    }
  },

  // 4. 折线图 / 面积图 (支持自定义 JSON 时序多曲线)
  'chart-line': {
    typeKey: 'chart-line',
    title: '折线/时序曲线图 (自定义 JSON)',
    category: 'charts',
    description: '图表曲线类组件支持完整自定义 JSON 契约：包含 X 轴时序刻度与多系列曲线数据。',
    fields: [
      { field: 'categories', type: 'string[]', description: 'X 轴时间刻度或离散类别标签数组', required: true, sample: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'] },
      { field: 'series', type: 'Array<{ name: string, data: number[], unit?: string, color?: string }>', description: '多曲线数据系列阵列', required: true, sample: [{ name: '有功功率', data: [35, 42, 78, 95, 88, 65, 40], unit: 'MW' }] }
    ],
    defaultPayload: {
      categories: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"],
      series: [
        {
          name: "进线有功功率",
          unit: "MW",
          color: "#00f2ff",
          data: [35, 42, 78, 95, 88, 65, 40]
        },
        {
          name: "进线无功功率",
          unit: "Mvar",
          color: "#3b82f6",
          data: [12, 15, 25, 30, 28, 20, 14]
        }
      ]
    },
    standardTemplates: [
      {
        id: 'line-24h-load',
        name: '📈 24h 全站日负荷曲线',
        description: '电力日负荷时序双曲线',
        payload: {
          categories: ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00", "24:00"],
          series: [
            { name: "实际负荷", unit: "MW", color: "#00f2ff", data: [45, 38, 42, 88, 96, 91, 98, 75, 52] },
            { name: "计划负荷", unit: "MW", color: "#64748b", data: [42, 40, 45, 85, 95, 90, 95, 72, 50] }
          ]
        }
      },
      {
        id: 'line-three-phase-voltage',
        name: '📉 三相母线电压曲线 (Ua/Ub/Uc)',
        description: '三相电压连续采样波形',
        payload: {
          categories: ["10:00", "10:05", "10:10", "10:15", "10:20", "10:25", "10:30"],
          series: [
            { name: "A相电压 Ua", unit: "kV", color: "#eab308", data: [10, 10, 10, 11, 10, 10, 10] },
            { name: "B相电压 Ub", unit: "kV", color: "#22c55e", data: [10, 10, 10, 10, 10, 10, 10] },
            { name: "C相电压 Uc", unit: "kV", color: "#ef4444", data: [10, 10, 10, 11, 10, 10, 10] }
          ]
        }
      }
    ]
  },

  // 5. 柱状图 (支持自定义 JSON 柱状分布)
  'chart-bar': {
    typeKey: 'chart-bar',
    title: '柱状图 (自定义 JSON)',
    category: 'charts',
    description: '柱状图组件支持自定义 JSON 契约：包含分类项与数值系列。',
    fields: [
      { field: 'categories', type: 'string[]', description: 'X 轴各设备或馈线名称', required: true, sample: ['#1主变', '#2主变', '出线1', '出线2'] },
      { field: 'series', type: 'Array<{ name: string, data: number[], unit?: string }>', description: '柱状数据系列', required: true, sample: [{ name: '负荷率', data: [85, 72, 65, 91], unit: '%' }] }
    ],
    defaultPayload: {
      categories: ["#1主变", "#2主变", "10kV线路1", "10kV线路2", "10kV线路3", "站用变"],
      series: [
        {
          name: "实时负荷率",
          unit: "%",
          color: "#00f2ff",
          data: [85, 72, 65, 91, 45, 33]
        }
      ]
    },
    standardTemplates: [
      {
        id: 'bar-feeder-load',
        name: '📊 出线负荷对比',
        description: '各线路运行负荷分布',
        payload: {
          categories: ["101进线", "102联络", "103工业线", "104商业线", "105居民线", "106备用线"],
          series: [
            { name: "运行电流", unit: "A", color: "#38bdf8", data: [420, 380, 290, 310, 260, 45] }
          ]
        }
      }
    ]
  },

  // 6. 饼图 / 环形图 (支持自定义 JSON 占比分布)
  'chart-pie': {
    typeKey: 'chart-pie',
    title: '饼图/环形图 (自定义 JSON)',
    category: 'charts',
    description: '饼图/环形图组件支持自定义 JSON 契约：各扇区分类项与数值。',
    fields: [
      { field: 'items', type: 'Array<{ name: string, value: number, unit?: string, color?: string }>', description: '各扇区分类项阵列', required: true, sample: [{ name: '光伏发电', value: 280, unit: 'MW' }] }
    ],
    defaultPayload: [
      { name: "光伏发电", value: 280, unit: "MW", color: "#eab308" },
      { name: "风力发电", value: 240, unit: "MW", color: "#06b6d4" },
      { name: "火电调峰", value: 180, unit: "MW", color: "#f97316" },
      { name: "储能放电", value: 100, unit: "MW", color: "#10b981" }
    ],
    standardTemplates: [
      {
        id: 'pie-energy-mix',
        name: '🍩 清洁能源供给占比',
        description: '光伏、风电、储能多源供电结构',
        payload: [
          { name: "光伏发电", value: 350, unit: "kW", color: "#eab308" },
          { name: "风力发电", value: 250, unit: "kW", color: "#00f2ff" },
          { name: "电网受电", value: 200, unit: "kW", color: "#3b82f6" },
          { name: "储能支撑", value: 120, unit: "kW", color: "#10b981" }
        ]
      }
    ]
  },

  // 7. 通用图元 (标准契约)
  'generic': {
    typeKey: 'generic',
    title: '通用图元数据格式 (标准契约)',
    category: 'basic',
    description: '极简标准契约：仅包含数值/浮点值 value 与品质码 quality (0/1)。',
    fields: [
      { field: 'value', type: 'number', description: '浮点工程数值或状态值', required: true, sample: 1.0 },
      { field: 'quality', type: 'integer (0/1)', description: '通信品质码 (1: 良好, 0: 未连通)', required: true, sample: 1 }
    ],
    defaultPayload: {
      value: 1.0,
      quality: 1
    }
  }
};

/**
 * 根据图元类型或分类获取最匹配的 JSON Schema 规范定义
 */
export function getComponentSchemaInfo(type: string, category: ComponentCategory): ComponentJsonSchemaInfo {
  if (type === 'chart-line') {
    return COMPONENT_JSON_SCHEMAS['chart-line'];
  }
  if (type === 'chart-bar') {
    return COMPONENT_JSON_SCHEMAS['chart-bar'];
  }
  if (type === 'chart-pie' || type === 'chart-gauge' || type === 'chart-radar') {
    return COMPONENT_JSON_SCHEMAS['chart-pie'];
  }
  if (category === 'status' || type === 'ctrl-indicator' || type.startsWith('elec-')) {
    return COMPONENT_JSON_SCHEMAS['status'];
  }
  if (category === 'metrics' || type.startsWith('metric-') || type === 'digital-counter' || type === 'float-metric') {
    return COMPONENT_JSON_SCHEMAS['metrics'];
  }
  if (category === 'custom' || type === 'custom-symbol' || type === 'composite-symbol' || type.startsWith('cell') || type.startsWith('device-')) {
    return COMPONENT_JSON_SCHEMAS['custom'];
  }
  return COMPONENT_JSON_SCHEMAS['generic'];
}

/**
 * 格式化当前时间为工控标准时间戳 YYYY-MM-DD HH:mm:ss
 */
export function getFormattedTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 智能注入四遥测点到图元的 JSON 数据中 (遥测/遥信/自定义图元仅保留 value (浮点数/数值) 与 quality (0/1))
 */
export function injectScadaPointToJson(
  currentJson: any,
  point: DeviceTelemetryPoint | DeviceTeleSignalPoint | DeviceEnergyPoint | DeviceTeleControlPoint,
  category: 'yc' | 'yx' | 'dd' | 'yk' | 'yt',
  deviceId: string
): any {
  if (category === 'yx') {
    const yx = point as DeviceTeleSignalPoint;
    const numVal = typeof yx.value === 'number' ? yx.value : (parseFloat(String(yx.value)) || 0);
    return {
      value: isNaN(numVal) ? 1 : numVal,
      quality: 1
    };
  }
  
  if (category === 'yc' || category === 'dd') {
    const yc = point as DeviceTelemetryPoint;
    const numVal = typeof yc.value === 'number' ? yc.value : (parseFloat(String(yc.value)) || 0);
    return {
      value: isNaN(numVal) ? 0 : numVal,
      quality: 1
    };
  }

  const rawVal = Number((point as any).value ?? 1);
  return {
    value: isNaN(rawVal) ? 1 : rawVal,
    quality: 1
  };
}

/**
 * 注入时间戳 (保留向后兼容)
 */
export function injectTimestampToJson(currentJson: any): any {
  if (typeof currentJson === 'object' && currentJson !== null && !Array.isArray(currentJson)) {
    return {
      ...currentJson
    };
  }
  return { value: 1, quality: 1 };
}

/**
 * 注入品质码 (严格保证 0 或 1，保留浮点数 value)
 */
export function injectQualityToJson(currentJson: any, qualityCode: number | string = 1): any {
  const qualityInt = (qualityCode === 0 || qualityCode === '0' || String(qualityCode).includes('BAD') || String(qualityCode).includes('无效')) ? 0 : 1;
  if (typeof currentJson === 'object' && currentJson !== null && !Array.isArray(currentJson)) {
    const valNum = typeof currentJson.value === 'number' ? currentJson.value : (parseFloat(String(currentJson.value)) || 0);
    return {
      value: valNum,
      quality: qualityInt
    };
  }
  return { value: 1, quality: qualityInt };
}

/**
 * 针对折线/图表生成 24 小时时序曲线数据 (图表专用)
 */
export function generate24hWaveformPayload(): any {
  const categories = ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "24:00"];
  const baseCurve = [42, 38, 36, 45, 78, 96, 92, 88, 94, 99, 85, 62, 44];
  const reactiveCurve = [12, 11, 10, 13, 22, 27, 26, 25, 26, 28, 24, 17, 12];
  
  return {
    categories,
    series: [
      { name: "有功功率 P", unit: "MW", color: "#00f2ff", data: baseCurve },
      { name: "无功功率 Q", unit: "Mvar", color: "#3b82f6", data: reactiveCurve }
    ]
  };
}

/**
 * 生成随机仿真数据并注入 (遥测/遥信/自定义图元输出浮点数/数值 value 和 0/1 quality)
 */
export function generateRandomSimulationData(type: string, category: ComponentCategory, currentJson: any): any {
  if (type === 'chart-line' || type === 'chart-bar' || type === 'chart-pie') {
    return generate24hWaveformPayload();
  }

  if (category === 'status' || type === 'ctrl-indicator' || type.startsWith('elec-') || category === 'custom') {
    const currentVal = typeof currentJson?.value === 'number' ? currentJson.value : (currentJson?.state ?? 1);
    const newVal = currentVal === 1 ? 0 : 1;
    return {
      value: newVal,
      quality: 1
    };
  }

  if (category === 'metrics' || type.startsWith('metric-')) {
    const currentVal = typeof currentJson?.value === 'number' ? currentJson.value : 100.0;
    const delta = (Math.random() - 0.5) * 20;
    const newVal = parseFloat((Math.max(0, currentVal + delta)).toFixed(2));
    return {
      value: newVal,
      quality: 1
    };
  }

  return {
    value: 1,
    quality: 1
  };
}
