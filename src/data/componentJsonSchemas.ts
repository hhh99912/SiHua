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
 * Registry of component-specific JSON Schemas, Contracts and Standard Templates
 * 参考行业领先 SCADA & DataV 大屏数据架构，每类图元具备独立的契约结构
 */
export const COMPONENT_JSON_SCHEMAS: Record<string, ComponentJsonSchemaInfo> = {
  // 1. 状态图元 (指示灯 / 遥信状态码 / 运行指示牌)
  'status': {
    typeKey: 'status',
    title: '状态图元 (遥信/指示灯/状态码牌)',
    category: 'status',
    description: '标准遥信双态/多态 JSON 契约，以 0 (分闸/停止/绿色) 与 1 (合闸/运行/红色) 为核心状态区分。',
    fields: [
      { field: 'state', type: 'number (0 | 1 | 2)', description: '当前状态值：0=分闸/停止/正常, 1=合闸/运行/带电, 2=故障/报警', required: true, sample: 1 },
      { field: 'statusText', type: 'string', description: '状态文本描述 (如: 合闸 1, 运行中, 试验位)', required: false, sample: '合闸运行' },
      { field: 'pointCode', type: 'string', description: '关联现场四遥点号标识符 (如: DEV_101_YX_1)', required: false, sample: 'DEV_101_YX_1' },
      { field: 'timestamp', type: 'string', description: '遥信变位或最新采样时间戳', required: false, sample: '2026-08-31 21:35:00' },
      { field: 'quality', type: 'string', description: '通信质量码 (0x00: 优/正常, 0x01: 无效/故障)', required: false, sample: '0x00 (GOOD)' },
      { field: 'color0', type: 'string (hex)', description: '0 态显示颜色 (默认分闸绿 #00e676)', required: false, sample: '#00e676' },
      { field: 'color1', type: 'string (hex)', description: '1 态显示颜色 (默认合闸红 #ff2233)', required: false, sample: '#ff2233' },
      { field: 'blink', type: 'string (none|slow|fast|auto)', description: '闪烁动效策略', required: false, sample: 'none' }
    ],
    defaultPayload: {
      state: 1,
      statusText: "合闸 1 (运行带电)",
      pointCode: "DEV_101_YX_1",
      timestamp: "2026-08-31 21:35:00",
      quality: "0x00 (GOOD)",
      color0: "#00e676",
      color1: "#ff2233",
      blink: "none"
    },
    standardTemplates: [
      {
        id: 'status-state-1',
        name: '🔴 1 态：合闸 / 运行 / 带电 (红色高亮)',
        description: '断路器合闸闭合、电机运行中、回路带电标准状态',
        payload: { state: 1, statusText: "合闸 1", pointCode: "DEV_101_YX_1", timestamp: "2026-08-31 21:35:00", quality: "0x00", color0: "#00e676", color1: "#ff2233" }
      },
      {
        id: 'status-state-0',
        name: '🟢 0 态：分闸 / 停止 / 断电 (绿色就绪)',
        description: '断路器分闸断开、电机停止备用、回路断电标准状态',
        payload: { state: 0, statusText: "分闸 0", pointCode: "DEV_101_YX_1", timestamp: "2026-08-31 21:35:00", quality: "0x00", color0: "#00e676", color1: "#ff2233" }
      },
      {
        id: 'status-state-warning',
        name: '🟡 2 态：异常预警 / 闭锁中 (黄色告警)',
        description: '过负荷告警、机构闭锁、通信可疑状态',
        payload: { state: 2, statusText: "异常预警 2", pointCode: "DEV_101_YX_2", timestamp: "2026-08-31 21:35:00", quality: "0x00", color0: "#00e676", color1: "#ff2233" }
      }
    ]
  },

  // 2. 数值图元 (遥测 / 数码管 / 仪表盘 / 浮点标签)
  'metrics': {
    typeKey: 'metrics',
    title: '数值图元 (遥测/数码管/仪表盘)',
    category: 'metrics',
    description: '工业遥测实时模拟量与工程物理量 JSON 契约，支持量程判定、质量码、物理单位及时间戳。',
    fields: [
      { field: 'value', type: 'number', description: '当前遥测实测工程值', required: true, sample: 110.45 },
      { field: 'unit', type: 'string', description: '物理工程单位 (如: kV, A, MW, kvar, ℃, %)', required: false, sample: 'kV' },
      { field: 'label', type: 'string', description: '测点名称标签 (如: A相母线电压)', required: false, sample: '10kV母线A相电压' },
      { field: 'pointCode', type: 'string', description: '规约测点唯一编码 (如: DEV_101_YC_1)', required: false, sample: 'DEV_101_YC_1' },
      { field: 'timestamp', type: 'string', description: '采样时间戳', required: false, sample: '2026-08-31 21:35:00' },
      { field: 'quality', type: 'string', description: '质量码 (0x00: 优, 0x01: 溢出, 0x02: 超量程)', required: false, sample: '0x00 (GOOD)' },
      { field: 'min', type: 'number', description: '量程下限 (用于百分比光条与仪表度量)', required: false, sample: 0 },
      { field: 'max', type: 'number', description: '量程上限 (用于百分比光条与仪表度量)', required: false, sample: 220 },
      { field: 'status', type: 'number (0: 正常, 1: 越上限, 2: 越下限)', description: '越限报警状态', required: false, sample: 0 }
    ],
    defaultPayload: {
      value: 110.45,
      unit: "kV",
      label: "10kV母线A相电压",
      pointCode: "DEV_101_YC_1",
      timestamp: "2026-08-31 21:35:00",
      quality: "0x00 (GOOD)",
      min: 0,
      max: 150,
      status: 0
    },
    standardTemplates: [
      {
        id: 'metric-voltage',
        name: '⚡ 母线高压遥测 (110kV / 10kV)',
        description: '电力高压母线电压采样格式',
        payload: { value: 110.28, unit: "kV", label: "#1主变高压侧电压", pointCode: "DEV_101_YC_1", timestamp: "2026-08-31 21:35:00", quality: "0x00", min: 0, max: 130, status: 0 }
      },
      {
        id: 'metric-current',
        name: '🔌 负荷电流遥测 (425.6 A)',
        description: '出线回路线路电流采样格式',
        payload: { value: 425.60, unit: "A", label: "10kV线路1负荷电流", pointCode: "DEV_101_YC_2", timestamp: "2026-08-31 21:35:00", quality: "0x00", min: 0, max: 800, status: 0 }
      },
      {
        id: 'metric-power',
        name: '🔋 有功功率遥测 (85.32 MW)',
        description: '全站综合有功功率采样格式',
        payload: { value: 85.32, unit: "MW", label: "进线总有功功率 P", pointCode: "DEV_101_YC_3", timestamp: "2026-08-31 21:35:00", quality: "0x00", min: 0, max: 120, status: 0 }
      },
      {
        id: 'metric-temp',
        name: '🌡️ 变压器油温遥测 (48.5 ℃)',
        description: '设备热工温度采样格式',
        payload: { value: 48.50, unit: "℃", label: "#1主变顶层油温", pointCode: "DEV_102_YC_4", timestamp: "2026-08-31 21:35:00", quality: "0x00", min: 0, max: 100, status: 0 }
      }
    ]
  },

  // 3. 折线图 / 面积图 (时序负荷曲线)
  'chart-line': {
    typeKey: 'chart-line',
    title: '折线/面积图 (时序波形/多曲线)',
    category: 'charts',
    description: '24小时时序历史波形与多系列时序对比 JSON 契约。',
    fields: [
      { field: 'categories', type: 'string[]', description: 'X 轴时间刻度或离散类别标签数组', required: true, sample: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'] },
      { field: 'series', type: 'Array<{ name: string, data: number[], unit?: string, color?: string }>', description: '多曲线数据系列阵列', required: true, sample: [{ name: '有功功率', data: [35, 42, 78, 95, 88, 65, 40], unit: 'MW' }] },
      { field: 'timestamp', type: 'string', description: '数据生成与汇总时间戳', required: false, sample: '2026-08-31 21:35:00' }
    ],
    defaultPayload: {
      categories: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"],
      series: [
        {
          name: "进线有功功率",
          unit: "MW",
          color: "#00f2ff",
          data: [35.2, 42.1, 78.5, 95.3, 88.0, 65.4, 40.2]
        },
        {
          name: "进线无功功率",
          unit: "Mvar",
          color: "#3b82f6",
          data: [12.4, 15.1, 24.8, 30.2, 28.5, 20.1, 14.3]
        }
      ],
      timestamp: "2026-08-31 21:35:00"
    },
    standardTemplates: [
      {
        id: 'line-24h-load',
        name: '📈 24h 全站日负荷曲线',
        description: '典型电力日负荷双峰时序波形',
        payload: {
          categories: ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00", "24:00"],
          series: [
            { name: "实际负荷", unit: "MW", color: "#00f2ff", data: [45.2, 38.6, 42.1, 88.5, 96.2, 91.0, 98.4, 75.3, 52.0] },
            { name: "计划负荷", unit: "MW", color: "#64748b", data: [42.0, 40.0, 45.0, 85.0, 95.0, 90.0, 95.0, 72.0, 50.0] }
          ],
          timestamp: "2026-08-31 21:35:00"
        }
      },
      {
        id: 'line-three-phase-voltage',
        name: '📉 三相交流母线电压波动 (Ua/Ub/Uc)',
        description: '三相平衡电压连续采样',
        payload: {
          categories: ["10:00", "10:05", "10:10", "10:15", "10:20", "10:25", "10:30"],
          series: [
            { name: "A相电压 Ua", unit: "kV", color: "#eab308", data: [10.22, 10.25, 10.21, 10.28, 10.24, 10.23, 10.26] },
            { name: "B相电压 Ub", unit: "kV", color: "#22c55e", data: [10.20, 10.23, 10.19, 10.25, 10.22, 10.21, 10.24] },
            { name: "C相电压 Uc", unit: "kV", color: "#ef4444", data: [10.23, 10.26, 10.22, 10.29, 10.25, 10.24, 10.27] }
          ],
          timestamp: "2026-08-31 21:35:00"
        }
      }
    ]
  },

  // 4. 柱状图 (负荷对比 / 线路分布)
  'chart-bar': {
    typeKey: 'chart-bar',
    title: '柱状图 (装置负荷/线路对比)',
    category: 'charts',
    description: '各设备间隔负荷率、变压器容量占比柱状对比 JSON 契约。',
    fields: [
      { field: 'categories', type: 'string[]', description: 'X 轴各设备或馈线名称', required: true, sample: ['#1主变', '#2主变', '10kV出线1', '10kV出线2'] },
      { field: 'series', type: 'Array<{ name: string, data: number[], unit?: string }>', description: '柱状数据系列', required: true, sample: [{ name: '负荷率', data: [85.4, 72.1, 64.8, 91.2], unit: '%' }] }
    ],
    defaultPayload: {
      categories: ["#1主变", "#2主变", "10kV线路1", "10kV线路2", "10kV线路3", "站用变"],
      series: [
        {
          name: "实时负荷率",
          unit: "%",
          color: "#00f2ff",
          data: [85.4, 72.1, 64.8, 91.2, 45.0, 32.6]
        }
      ]
    },
    standardTemplates: [
      {
        id: 'bar-feeder-load',
        name: '📊 10kV 出线负荷对比',
        description: '各线路运行电流分布',
        payload: {
          categories: ["101进线", "102联络", "103工业线", "104商业线", "105居民线", "106备用线"],
          series: [
            { name: "运行电流", unit: "A", color: "#38bdf8", data: [420.5, 380.0, 290.4, 310.8, 260.2, 45.0] }
          ]
        }
      }
    ]
  },

  // 5. 饼图 / 环形图 (能源构成 / 负荷分布)
  'chart-pie': {
    typeKey: 'chart-pie',
    title: '饼图/环形图 (能源占比/容量分配)',
    category: 'charts',
    description: '多源互补能源结构、负荷分布占比 JSON 契约（支持数组或对象形式）。',
    fields: [
      { field: 'items', type: 'Array<{ name: string, value: number, unit?: string, color?: string }>', description: '各扇区分类项阵列', required: true, sample: [{ name: '火力发电', value: 450, unit: 'MW' }] }
    ],
    defaultPayload: [
      { name: "光伏发电", value: 280, unit: "MW", ratio: 35.0, color: "#eab308" },
      { name: "风力发电", value: 240, unit: "MW", ratio: 30.0, color: "#06b6d4" },
      { name: "火电调峰", value: 180, unit: "MW", ratio: 22.5, color: "#f97316" },
      { name: "储能放电", value: 100, unit: "MW", ratio: 12.5, color: "#10b981" }
    ],
    standardTemplates: [
      {
        id: 'pie-energy-mix',
        name: '🍩 厂区清洁能源供给占比',
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

  // 6. 告警事件列表 (实时事故/预警流)
  'ind-alarm-list': {
    typeKey: 'ind-alarm-list',
    title: '实时告警事件列表 (SCADA SOE/Alarm)',
    category: 'industrial',
    description: '集控中心实时告警流、跳闸事件、保护动作记录 JSON 契约。',
    fields: [
      { field: 'events', type: 'Array<{ id: string, time: string, deviceName: string, point: string, severity: string, message: string, state: number }>', description: '告警事件列表数组', required: true, sample: [] }
    ],
    defaultPayload: [
      { id: "ALM-101", time: "21:34:12", deviceName: "10kV进线断路器", point: "DEV_101_YX_1", severity: "CRITICAL", message: "过流Ⅰ段保护动作跳闸 (分闸)", state: 0 },
      { id: "ALM-102", time: "21:32:05", deviceName: "1号主变压器", point: "DEV_102_YC_3", severity: "WARNING", message: "变压器顶层油温越上限预警 (78.5℃)", state: 2 },
      { id: "ALM-103", time: "21:28:40", deviceName: "10kV母线段", point: "DEV_101_YC_1", severity: "INFO", message: "母线电压恢复额定范围 (10.25kV)", state: 1 }
    ],
    standardTemplates: [
      {
        id: 'alarm-critical-only',
        name: '🚨 紧急事故跳闸事件流',
        description: '仅严重事故报警',
        payload: [
          { id: "ALM-201", time: "21:35:00", deviceName: "10kV 101进线开关", point: "DEV_101_YX_1", severity: "CRITICAL", message: "零序过流保护动作分闸跳闸", state: 0 },
          { id: "ALM-202", time: "21:34:20", deviceName: "2号主变瓦斯继电器", point: "DEV_102_YX_4", severity: "CRITICAL", message: "重瓦斯保护跳闸动作", state: 0 }
        ]
      }
    ]
  },

  // 7. 电力一次设备 (断路器 / 隔离开关 / 变压器)
  'electrical': {
    typeKey: 'electrical',
    title: '电力一次设备 (断路器/变压器/开关)',
    category: 'electrical',
    description: '电力开关设备遥信分合与伴随电气遥测参数 JSON 契约。',
    fields: [
      { field: 'state', type: 'number (0:分闸, 1:合闸, 2:故障)', description: '开关位置遥信：0=分闸(绿), 1=合闸(红), 2=故障(黄)', required: true, sample: 1 },
      { field: 'voltage', type: 'number', description: '母线实时电压', required: false, sample: 10.25 },
      { field: 'current', type: 'number', description: '通过相电流', required: false, sample: 420.5 },
      { field: 'power', type: 'number', description: '有功功率', required: false, sample: 75.8 },
      { field: 'pointCode', type: 'string', description: '断路器规约测点号', required: false, sample: 'DEV_101_YX_1' },
      { field: 'timestamp', type: 'string', description: '最新变位时间', required: false, sample: '2026-08-31 21:35:00' }
    ],
    defaultPayload: {
      state: 1,
      voltage: 10.25,
      current: 420.5,
      power: 75.8,
      pointCode: "DEV_101_YX_1",
      timestamp: "2026-08-31 21:35:00",
      quality: "0x00 (GOOD)"
    },
    standardTemplates: [
      {
        id: 'breaker-closed',
        name: '🔴 断路器合闸带电态 (State: 1)',
        description: '开关处于合闸导通运行状态',
        payload: { state: 1, voltage: 10.25, current: 420.5, power: 75.8, pointCode: "DEV_101_YX_1", timestamp: "2026-08-31 21:35:00" }
      },
      {
        id: 'breaker-open',
        name: '🟢 断路器分闸断开态 (State: 0)',
        description: '开关处于分闸安全断开状态',
        payload: { state: 0, voltage: 0.0, current: 0.0, power: 0.0, pointCode: "DEV_101_YX_1", timestamp: "2026-08-31 21:35:00" }
      }
    ]
  },

  // 8. 状态矩阵 / 巡检板
  'ind-matrix': {
    typeKey: 'ind-matrix',
    title: '状态矩阵板 (多点运行巡检卡)',
    category: 'industrial',
    description: '全站多回路运行状态与关键遥测聚合矩阵 JSON 契约。',
    fields: [
      { field: 'points', type: 'Array<{ id: string, name: string, status: number, value: number, unit: string }>', description: '多状态点清单', required: true, sample: [] }
    ],
    defaultPayload: [
      { id: "101", name: "10kV 进线 101", status: 1, value: 425.6, unit: "A", category: "进线" },
      { id: "102", name: "10kV 联络 102", status: 0, value: 0.0, unit: "A", category: "联络" },
      { id: "103", name: "10kV 馈线 103", status: 1, value: 310.2, unit: "A", category: "馈线" },
      { id: "104", name: "10kV 馈线 104", status: 1, value: 280.5, unit: "A", category: "馈线" },
      { id: "105", name: "站用变馈线", status: 1, value: 45.0, unit: "A", category: "站用" },
      { id: "106", name: "电容器补偿", status: 0, value: 0.0, unit: "kvar", category: "补偿" }
    ]
  },

  // 9. 通用大屏数据契约 (Generic)
  'generic': {
    typeKey: 'generic',
    title: '标准通用大屏数据格式 (Generic DataV)',
    category: 'basic',
    description: '包含基础键值、时序数组及状态码的标准工业通用 JSON 框架。',
    fields: [
      { field: 'value', type: 'number | string', description: '核心数值或状态', required: true, sample: 125.6 },
      { field: 'unit', type: 'string', description: '单位', required: false, sample: 'kW' },
      { field: 'label', type: 'string', description: '标签说明', required: false, sample: '总有功功率' },
      { field: 'state', type: 'number', description: '0/1 状态码', required: false, sample: 1 },
      { field: 'timestamp', type: 'string', description: '时间戳', required: false, sample: '2026-08-31 21:35:00' }
    ],
    defaultPayload: {
      value: 125.6,
      unit: "kW",
      label: "实时负荷功率",
      state: 1,
      timestamp: "2026-08-31 21:35:00"
    }
  }
};

/**
 * 根据图元类型或分类获取最匹配的 JSON Schema 规范定义
 */
export function getComponentSchemaInfo(type: string, category: ComponentCategory): ComponentJsonSchemaInfo {
  if (type === 'ctrl-indicator' || category === 'status') {
    return COMPONENT_JSON_SCHEMAS['status'];
  }
  if (type.startsWith('metric-') || category === 'metrics' || type === 'digital-counter') {
    return COMPONENT_JSON_SCHEMAS['metrics'];
  }
  if (type === 'chart-line') {
    return COMPONENT_JSON_SCHEMAS['chart-line'];
  }
  if (type === 'chart-bar') {
    return COMPONENT_JSON_SCHEMAS['chart-bar'];
  }
  if (type === 'chart-pie' || type === 'chart-gauge') {
    return COMPONENT_JSON_SCHEMAS['chart-pie'];
  }
  if (type === 'ind-alarm-list') {
    return COMPONENT_JSON_SCHEMAS['ind-alarm-list'];
  }
  if (type === 'ind-matrix') {
    return COMPONENT_JSON_SCHEMAS['ind-matrix'];
  }
  if (type.startsWith('elec-') || category === 'electrical') {
    return COMPONENT_JSON_SCHEMAS['electrical'];
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
 * 智能注入四遥测点 (遥测 YC / 遥信 YX / 电度 DD / 遥控 YK) 到图元的 JSON 数据中
 */
export function injectScadaPointToJson(
  currentJson: any,
  point: DeviceTelemetryPoint | DeviceTeleSignalPoint | DeviceEnergyPoint | DeviceTeleControlPoint,
  category: 'yc' | 'yx' | 'dd' | 'yk' | 'yt',
  deviceId: string
): any {
  let result = { ...(typeof currentJson === 'object' && currentJson !== null && !Array.isArray(currentJson) ? currentJson : {}) };
  const pointCode = `${deviceId}_${category.toUpperCase()}_${point.pointId}`;
  const nowTime = getFormattedTimestamp();

  if (category === 'yx') {
    const yx = point as DeviceTeleSignalPoint;
    const numVal = yx.value ?? 1;
    result.state = numVal;
    result.statusText = yx.statusText || (numVal === 1 ? '合闸 1' : '分闸 0');
    result.pointCode = pointCode;
    result.pointName = yx.name;
    result.timestamp = nowTime;
    result.quality = "0x00 (GOOD)";
    result.color0 = result.color0 || "#00e676";
    result.color1 = result.color1 || "#ff2233";
  } else if (category === 'yc' || category === 'dd') {
    const yc = point as DeviceTelemetryPoint;
    result.value = yc.value;
    result.unit = yc.unit || result.unit || '';
    result.label = yc.name || result.label;
    result.pointCode = pointCode;
    result.timestamp = nowTime;
    result.quality = "0x00 (GOOD)";
    if (result.min === undefined) result.min = 0;
    if (result.max === undefined) result.max = Math.max(100, Math.round(yc.value * 1.5));
  } else if (category === 'yk') {
    const yk = point as DeviceTeleControlPoint;
    result.controlPoint = pointCode;
    result.pointName = yk.name;
    result.targetVerifyYx = `${deviceId}_YX_${yk.targetPointId || 1}`;
    result.state = 1;
    result.timestamp = nowTime;
  }

  return result;
}

/**
 * 注入最新时间戳到当前 JSON
 */
export function injectTimestampToJson(currentJson: any): any {
  const now = getFormattedTimestamp();
  if (Array.isArray(currentJson)) {
    return currentJson.map(item => typeof item === 'object' ? { ...item, timestamp: now, time: now.slice(11) } : item);
  }
  if (typeof currentJson === 'object' && currentJson !== null) {
    return {
      ...currentJson,
      timestamp: now,
      time: now.slice(11)
    };
  }
  return { value: currentJson, timestamp: now };
}

/**
 * 注入质量码到当前 JSON
 */
export function injectQualityToJson(currentJson: any, qualityCode: string = "0x00 (GOOD 优)"): any {
  if (Array.isArray(currentJson)) {
    return currentJson.map(item => typeof item === 'object' ? { ...item, quality: qualityCode } : item);
  }
  if (typeof currentJson === 'object' && currentJson !== null) {
    return {
      ...currentJson,
      quality: qualityCode
    };
  }
  return { value: currentJson, quality: qualityCode };
}

/**
 * 针对折线/图表注入真实 24 小时电力负荷/时序波形数据
 */
export function generate24hWaveformPayload(): any {
  const categories = ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "24:00"];
  // Realistic dual-peak daily load curve
  const baseCurve = [42.1, 38.5, 36.2, 45.0, 78.4, 96.2, 92.5, 88.0, 94.6, 99.2, 85.0, 62.1, 44.0];
  const reactiveCurve = baseCurve.map(v => Math.round(v * 0.28 * 10) / 10);
  
  return {
    categories,
    series: [
      { name: "有功功率 P", unit: "MW", color: "#00f2ff", data: baseCurve },
      { name: "无功功率 Q", unit: "Mvar", color: "#3b82f6", data: reactiveCurve }
    ],
    timestamp: getFormattedTimestamp()
  };
}

/**
 * 生成随机工况仿真数据并注入
 */
export function generateRandomSimulationData(type: string, category: ComponentCategory, currentJson: any): any {
  const now = getFormattedTimestamp();
  if (category === 'status' || type === 'ctrl-indicator' || type.startsWith('elec-')) {
    const newState = (currentJson?.state === 1) ? 0 : 1;
    return {
      ...(typeof currentJson === 'object' ? currentJson : {}),
      state: newState,
      statusText: newState === 1 ? "合闸 1 (带电运行)" : "分闸 0 (就绪分断)",
      timestamp: now,
      quality: "0x00 (GOOD)"
    };
  }

  if (category === 'metrics' || type.startsWith('metric-')) {
    const currentVal = typeof currentJson?.value === 'number' ? currentJson.value : 100;
    const delta = (Math.random() - 0.5) * (currentVal * 0.08);
    const newVal = Math.max(0, Math.round((currentVal + delta) * 100) / 100);
    return {
      ...(typeof currentJson === 'object' ? currentJson : {}),
      value: newVal,
      timestamp: now,
      quality: "0x00 (GOOD)"
    };
  }

  if (type === 'chart-line' || type === 'chart-bar') {
    return generate24hWaveformPayload();
  }

  return {
    ...(typeof currentJson === 'object' ? currentJson : {}),
    timestamp: now,
    quality: "0x00 (GOOD)"
  };
}
