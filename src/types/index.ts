export type ComponentCategory = 
  | 'status'       // 🟢 状态图元 (遥信/指示灯/状态码/拓扑状态点)
  | 'metrics'      // 🔢 数值图元 (遥测/数码管/仪表盘/计数器)
  | 'electrical'   // ⚡ 电力一次系统图元 (断路器/手车/隔离开关/主变/互感器/避雷器/母线/电表)
  | 'industrial'   // 🏭 工业SCADA与流体 (储罐/管道/泵阀/电机/矩阵/报警)
  | 'charts'       // 📊 统计图表与监控仪表 (ECharts/折线/柱状/饼图/雷达)
  | 'decoration'   // ✨ 科技边框与修饰
  | 'basic'        // 📐 基础几何图元与控制器 (矩形/圆形/多边形/文本/按钮等)
  | 'custom'       // 🧩 复合组合图元与自定义资产
  | 'drawing'      // 矢量绘制
  | 'media';

export type ComponentType = 
  // 1. All Conventional Basic Primitives (常规基础图元与控制器)
  | 'draw-rect'             // 矩形 / 科技卡片底座
  | 'draw-rounded-rect'     // 圆角矩形
  | 'draw-circle'           // 正圆形 / 节点
  | 'draw-ellipse'          // 椭圆形
  | 'draw-triangle'         // 正三角形 (向上)
  | 'draw-triangle-down'    // 倒三角形 (向下)
  | 'draw-triangle-right'   // 向右三角形
  | 'draw-diamond'          // 菱形 / 判定框
  | 'draw-pentagon'         // 正五边形
  | 'draw-hexagon'          // 正六边形 / 蜂窝
  | 'draw-polygon'          // 多边形
  | 'draw-octagon'          // 正八边形
  | 'draw-star'             // 五角星
  | 'draw-star4'            // 四角星 / 光芒星
  | 'draw-trapezoid'        // 等腰梯形
  | 'draw-parallelogram'    // 平行四边形
  | 'draw-cross'            // 十字形 / 加号
  | 'draw-ring'             // 同心圆环
  | 'draw-sector'           // 扇形 / 饼块
  | 'draw-heart'            // 心形
  | 'draw-bubble'           // 对话气泡 / 标注框
  | 'draw-cube'             // 立方体 / 3D等轴块
  | 'draw-cylinder'         // 圆柱体 / 储液桶
  | 'draw-arc'              // 弧线 / 曲线
  | 'draw-line'             // 直线 / 电气导线
  | 'draw-polyline'         // 折线 / 直角走线
  | 'draw-arrow'            // 单向导向箭头
  | 'draw-double-arrow'     // 双向导向箭头
  | 'draw-elbow'            // 直角弯头管
  | 'draw-text'             // 静态文本 / 工业标牌
  | 'ctrl-button'           // 工业控制按钮 (支持下发遥控)
  | 'ctrl-indicator'        // 状态指示灯 (0: 停止/分闸, 1: 运行/合闸, 2: 故障/告警)
  | 'draw-pipe'             // 介质管道
  
  // 2. Electrical Power System Primary Components (电力一次系统图元)
  | 'elec-breaker'          // 高压/真空断路器 QF (0: 分闸, 1: 合闸, 2: 故障)
  | 'elec-handcart'         // 开关柜可抽出式手车 (0: 试验位, 1: 工作位, 2: 故障)
  | 'elec-disconnector'     // 隔离开关 / 隔离刀闸 QS (0: 分闸, 1: 合闸, 2: 故障)
  | 'elec-grounding'        // 接地刀闸 QE (0: 分闸, 1: 合闸, 2: 故障)
  | 'elec-transformer'      // 电力主变压器 TM
  | 'elec-ct'               // 电流互感器 TA / CT
  | 'elec-pt'               // 电压互感器 TV / PT
  | 'elec-arrester'         // 氧化锌避雷器 F
  | 'elec-busbar'           // 高低压母线段 Busbar

  // 3. Composite Symbols
  | 'composite-symbol'      // 复合组合图元
  
  // 4. Charts
  | 'chart-line'
  | 'chart-bar'
  | 'chart-pie'
  | 'chart-gauge'
  | 'chart-radar'
  | 'chart-scatter'

  // 5. Industrial
  | 'ind-tank'
  | 'ind-pipe'
  | 'ind-valve'
  | 'ind-motor'
  | 'ind-alarm-list'
  | 'ind-matrix'

  // 6. Metrics & Time Widgets
  | 'metric-float'
  | 'metric-flipper'
  | 'metric-card'
  | 'metric-title'
  | 'metric-progress'
  | 'metric-clock'
  | 'metric-time-banner'
  | 'metric-clock-analog'
  | 'metric-countdown'

  // 7. Navigation
  | 'nav-tabs'

  // 8. Custom
  | 'custom-svg'
  | 'custom-html'

  // 9. Decorations (丰富科技边框)
  | 'deco-border-minimal'
  | 'deco-border-neon'
  | 'deco-border-tech'
  | 'deco-border-mech'
  | 'deco-border-hud-double'
  | 'deco-border-cyber-corner'
  | 'deco-border-gradient-pulse'
  | 'deco-border-hazard'
  | 'deco-border-bracket'
  | 'deco-border-matrix-panel'
  | 'deco-border-quantum-box'
  | 'deco-border-scada-card'
  | 'deco-border-industrial'
  | 'deco-tech-plate'
  | 'deco-corner-bracket'
  | 'deco-hazard-stripe'
  | 'deco-glow-ring'
  | 'deco-line-glow'
  | 'deco-target-reticle'

  // 10. Vector Pen Drawing
  | 'draw-pen-path'
  | 'draw-svg-icon';

export interface StyleConfig {
  fill?: string;
  fillOpacity?: number;
  gradient?: {
    type: 'linear' | 'radial';
    colors: string[];
    angle?: number;
  };
  stroke?: string;
  strokeWidth?: number;
  strokeDash?: number[];
  strokeDasharray?: string;
  strokeLinecap?: 'round' | 'square' | 'butt';
  strokeLinejoin?: 'round' | 'bevel' | 'miter';
  borderRadius?: number;
  opacity?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  fontSize?: number;
  fontWeight?: string | number;
  fontFamily?: string;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  letterSpacing?: number;
  text?: string;
  glowColor?: string;
  glowBlur?: number;
  themePreset?: 'cyber-cyan' | 'industrial-amber' | 'hazard-yellow' | 'tech-emerald' | 'crimson-alert' | 'slate-steel';
  customSvgPath?: string;
  customSvgCode?: string;
  customHtmlCode?: string;
  decimals?: number;
  trimZeros?: boolean;
  prefix?: string;
  suffix?: string;
  [key: string]: any;
  
  // Streamer Glow
  streamer?: {
    active?: boolean;
    color?: string;
    speed?: number;
    type?: 'laser' | 'pulse' | 'dots';
    direction?: 'forward' | 'reverse';
    width?: number;
  };

  // State Value: Integer Enum (0, 1, 2, 3, 4...) or string
  stateBindingValue?: number | string;
  
  // Electrical styles
  breakerColorClosed?: string; // 1 (合闸色，默认红)
  breakerColorOpen?: string;   // 0 (分闸色，默认绿)
  voltageLevel?: '500kV' | '220kV' | '110kV' | '35kV' | '10kV' | '0.4kV' | 'DC';
  feederName?: string;
  showLabels?: boolean;

  // Line
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  lineType?: 'straight' | 'step-horizontal' | 'step-vertical' | 'multi-step';
  startArrow?: boolean;
  endArrow?: boolean;
  jointRadius?: number;
  points?: Array<{ x: number; y: number }>;

  // Button
  buttonText?: string;
  buttonVariant?: 'solid' | 'outline' | 'glass' | 'metallic' | 'emergency-stop';
  buttonColorTheme?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate';
  buttonIcon?: string;
  isPressed?: boolean;

  // Status Indicator
  indicatorShape?: 'circle' | 'square' | 'ring' | 'pill' | 'diamond' | 'hexagon' | 'crosshair' | 'dot' | 'status-plate' | string;
  indicatorStyle?: 'bezel-circle' | 'flat-led' | 'square-lamp' | 'pill-tag' | 'ring-pulse' | 'diamond-badge' | 'hexagon-pilot' | 'crosshair-target' | 'neon-dot' | 'status-plate' | string;
  indicatorState?: 'normal' | 'alarm' | 'warning' | 'standby' | 'offline' | number | string;
  indicatorColor?: string;
  indicatorBlinkSpeed?: 'none' | 'slow' | 'fast' | 'auto';
  indicatorLabel?: string;
  displayStyle?: 'pure-digital' | 'cyber-badge' | 'led-segment' | 'neon-glow' | 'industrial-tag' | 'progress-bar' | 'meter-box' | string;
  metricStyle?: string;
}

export interface AnimationConfig {
  enable?: boolean;
  type?: 'flow' | 'rotate' | 'blink' | 'pulse' | 'wave' | 'counter-up';
  speed?: number;
  direction?: 'forward' | 'backward' | 'clockwise' | 'counter-clockwise';
  loop?: boolean;
}

// -------------------------------------------------------------
// SCADA & Power Dispatching Device-Centric Dataset Data Models
// (以装置号为初始单位，下挂遥测、遥信、电度、遥控、遥调)
// -------------------------------------------------------------

// 1. 遥测 (YC / Telemetry - Analog): 点号, 系数, 单位, 数值等
export interface DeviceTelemetryPoint {
  pointId: number | string; // 点号 (Point ID)
  name: string;             // 遥测名称 (如 'A相电压 Ua', '有功功率 P')
  factor: number;           // 系数 (如 1.0, 0.1, 0.01)
  unit: string;             // 单位 (如 'kV', 'V', 'A', 'kW', '℃')
  rawValue?: number;        // 原始采集值
  value: number;            // 实际工程值 (rawValue * factor)
  description?: string;
}

// 2. 遥信 (YX / Tele-signal - Status): 点号, 整数枚举数值
export interface DeviceTeleSignalPoint {
  pointId: number | string; // 点号 (Point ID)
  name: string;             // 遥信名称 (如 '断路器位置', '手车工作位置')
  value: number;            // 状态整数枚举值: 如 0 (分闸/停), 1 (合闸/运), 2 (故障/跳闸), 3 (试验位), 4 (工作位) 等任意枚举整数
  statusText?: string;      // 状态文本说明 (如 '分闸', '合闸', '故障', '试验位')
  enumMapping?: Record<number, string>; // 状态枚举映射字典
  description?: string;
}

// 3. 电度 (DD / Energy - Metering): 点号, 系数, 单位, 数值等
export interface DeviceEnergyPoint {
  pointId: number | string; // 点号 (Point ID)
  name: string;             // 电度名称 (如 '正向有功总电能', '今日用电量')
  factor: number;           // 系数 (如 0.01, 1.0)
  unit: string;             // 单位 (如 'kWh', 'MWh', 'kvarh')
  value: number;            // 累计电度数值
  description?: string;
}

// 4. 遥控 (YK / Tele-control): 挂在装置下，一个遥控点关联一个遥信点 (targetPointId)
export interface DeviceTeleControlPoint {
  pointId: number | string; // 点号 (Point ID)
  name: string;             // 遥控名称 (如 '断路器合分遥控')
  targetPointId?: number | string; // 关键：关联闭环校验的遥信点号 (如 1)
  options: Array<{ label: string; value: number }>; // e.g. [{ label: '分闸指令 (0)', value: 0 }, { label: '合闸指令 (1)', value: 1 }]
  lastExecutedValue?: number;
  lastExecutedTime?: string;
  lastVerifiedResult?: 'verified_success' | 'verified_failed' | 'timeout';
  description?: string;
}

// 5. 遥调 (YT / Tele-regulation): 挂在装置下，一个遥调点可关联一个反馈遥测点 (targetYcPointId)
export interface DeviceTeleRegulationPoint {
  pointId: number | string; // 点号 (Point ID)
  name: string;             // 遥调名称 (如 '变压器有载分接头档位 / 电压基准调节')
  unit: string;             // 单位 (如 'V', 'kV', '%', '档', 'A')
  min: number;
  max: number;
  step: number;
  value: number;            // 当前定值/设定值
  targetYcPointId?: number | string; // 关联反馈闭环校验的遥测点号
  tolerance?: number;       // 校验容差
  lastExecutedTime?: string;
  lastVerifiedResult?: 'verified_success' | 'verified_failed' | 'timeout';
  description?: string;
}

// 装置 (Device / Unit): 以装置号为初始单位
export interface ScadaDeviceItem {
  deviceId: string;         // 装置号 (如 'DEV-101', '101')
  deviceName: string;       // 装置名 (如 '10kV 进线 101 测控保护装置')
  deviceType?: string;      // 装置类型 (如 '线路保护测控', '主变保护', '电能质量')
  commStatus: number;       // 通信状态: 1 在线, 0 离线, 2 异常
  ipAddress?: string;       // 通信IP/地址
  telemetries: DeviceTelemetryPoint[];          // 遥测列表 (YC)
  teleSignals: DeviceTeleSignalPoint[];          // 遥信列表 (YX - 整数枚举)
  energies: DeviceEnergyPoint[];                 // 电度列表 (DD)
  teleControls: DeviceTeleControlPoint[];        // 遥控列表 (YK)
  teleRegulations: DeviceTeleRegulationPoint[];  // 遥调列表 (YT)
}

export interface DataFieldMapping {
  // SCADA 4-Remote Single Point Mapping (四遥单点关联)
  deviceId?: string;        // 装置号
  deviceName?: string;      // 装置名称
  pointCategory?: 'telemetry' | 'teleSignal' | 'energy' | 'teleControl' | 'teleRegulation'; // 遥测/遥信/电度/遥控/遥调
  pointId?: string | number;// 装置下挂点号
  pointName?: string;       // 测点中文名
  valueKey?: string;
  titleKey?: string;
  unitKey?: string;
  seriesKey?: string;
  categoriesKey?: string;
  statusKey?: string;
  stateKey?: string;        // for breaker/switch state
  voltageKey?: string;
  currentKey?: string;
  powerKey?: string;
  frequencyKey?: string;
  powerFactorKey?: string;
  temperatureKey?: string;
  timestampKey?: string;
  thresholdMax?: number;
  thresholdMin?: number;
  alertLevelKey?: string;
  targetYxPointId?: number;
  targetYcPointId?: number;
  ykPointId?: number;
  ytPointId?: number;

  // DataV Structured JSON Dataset Mapping (结构化/复合数据集关联)
  datasetMode?: 'scada-point' | 'json-dataset';
  xField?: string;
  yField?: string;
  timeField?: string;
  groupField?: string;
  seriesList?: Array<{
    name: string;
    key?: string;
    field?: string;
    color?: string;
    strokeWidth?: number;
    data?: number[];
  }>;
  dataFilter?: string; // JavaScript Filter function code
}

export interface ComponentAction {
  type: 'none' | 'jump-screen' | 'tele-control' | 'tele-regulation' | 'open-modal' | 'external-link';
  targetScreenId?: string;
  deviceId?: string;
  pointId?: string | number;
  controlValue?: number;
  regulationValue?: number;
  url?: string;
  label?: string;
}

export interface ComponentDataConfig {
  datasetId?: string;
  useStatic?: boolean;
  staticData?: any;
  bindings?: Record<string, string>; // Dynamic property-to-point bindings (e.g. { "value": "DEV-101_YC_1", "state": "DEV-101_YX_1" })
  mapping: DataFieldMapping;
  autoRefreshInterval?: number;
  action?: ComponentAction;
}

export interface CustomSymbolStateDef {
  id: string; // "0", "1", "2"
  name: string; // e.g. "状态 0 (分闸)", "状态 1 (合闸)", "状态 2 (故障)"
  matchValue?: 0 | 1 | 2 | string | number;
  stateValue?: number; // Unique integer for SCADA telemetry state mapping
  description?: string;
  children: ScreenComponent[];
  style?: StyleConfig;
  customProps?: Record<string, any>;
}

export type SymbolState = CustomSymbolStateDef;

export interface ScreenComponent {
  id: string;
  name: string;
  type: ComponentType;
  category: ComponentCategory;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked?: boolean;
  visible?: boolean;
  style: StyleConfig;
  animation?: AnimationConfig;
  data?: ComponentDataConfig;
  customProps?: Record<string, any>;
  children?: ScreenComponent[];
  isGroup?: boolean;
  symbolId?: string;
  states?: CustomSymbolStateDef[];
  activeState?: 0 | 1 | 2 | string | number; // e.g. 0, 1, 2
}

export interface DatasetField {
  name: string;
  type: 'string' | 'number' | 'array' | 'boolean';
  label: string;
  sample: any;
}

export interface DatasetItem {
  id: string;
  name: string;
  description: string;
  type: 'mock' | 'static' | 'api';
  updateIntervalMs: number;
  apiUrl?: string;
  headers?: Record<string, string>;
  devices: ScadaDeviceItem[]; // 以装置号为初始单位的设备阵列
  data: any;                  // 扁平化兼容字段映射
  fields: DatasetField[];
  isStreaming?: boolean;
}

export interface ScreenConfig {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage?: string;
  backgroundGrid: boolean;
  gridSize: number;
  gridColor: string;
  theme: 'cyber-dark' | 'industrial-steel' | 'carbon-matrix' | 'deep-abyss';
  version: string;
  updatedAt: string;
}

export interface CustomSymbolDef {
  id: string;
  name: string;
  category: string;
  iconName: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  type: ComponentType;
  defaultStyle: StyleConfig;
  defaultData?: ComponentDataConfig;
  defaultCustomProps?: Record<string, any>;
  children?: ScreenComponent[];
  states?: CustomSymbolStateDef[];
  activeStateId?: string;
  customSvgCode?: string;
  customHtmlCode?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ScreenItem {
  id: string;
  name: string;
  description?: string;
  screen: ScreenConfig;
  components: ScreenComponent[];
}

export interface MultiScreenProjectSchema {
  version: string;
  projectName?: string;
  activeScreenId: string;
  screens: ScreenItem[];
  datasets: DatasetItem[];
  customSymbols: CustomSymbolDef[];
  updatedAt: string;
}

export interface ProjectSchema {
  version: string;
  screen: ScreenConfig;
  datasets: DatasetItem[];
  components: ScreenComponent[];
  customSymbols?: CustomSymbolDef[];
  screens?: ScreenItem[];
  activeScreenId?: string;
}

export interface HistorySnapshot {
  screen: ScreenConfig;
  components: ScreenComponent[];
  datasets: DatasetItem[];
  selectedIds: string[];
}

export type UserRole = 'system_admin' | 'viewer';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  roleName: string;
  description: string;
  permissions: string[];
}
