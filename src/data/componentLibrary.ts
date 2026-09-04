import { ComponentCategory, ComponentType, ScreenComponent, CustomSymbolStateDef } from '../types';

export interface ComponentDefinition {
  type: ComponentType;
  category: ComponentCategory;
  name: string;
  nameEn: string;
  iconName: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultStyle: ScreenComponent['style'];
  defaultAnimation?: ScreenComponent['animation'];
  defaultData: ScreenComponent['data'];
  defaultCustomProps?: Record<string, any>;
  states?: CustomSymbolStateDef[];
  children?: ScreenComponent[];
}

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  // ==========================================
  // 1. Basic Conventional Primitives & Controllers (常规基础图元与控制器)
  // ==========================================
  {
    type: 'draw-rect',
    category: 'basic',
    name: '矩形 / 科技底座',
    nameEn: 'Rectangle',
    iconName: 'Square',
    description: '基础矢量矩形与直角底座，支持描边、半透明背景与渐变填充',
    defaultWidth: 160,
    defaultHeight: 100,
    defaultStyle: {
      fill: '#00f2ff',
      fillOpacity: 0.15,
      stroke: '#00f2ff',
      strokeWidth: 2,
      borderRadius: 0
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-rounded-rect',
    category: 'basic',
    name: '圆角矩形',
    nameEn: 'Rounded Rectangle',
    iconName: 'Square',
    description: '带圆角半径的矩形底框，适用于科技面板、卡片容器与监控视窗',
    defaultWidth: 160,
    defaultHeight: 100,
    defaultStyle: {
      fill: '#00f2ff',
      fillOpacity: 0.15,
      stroke: '#00f2ff',
      strokeWidth: 2,
      borderRadius: 12
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-circle',
    category: 'basic',
    name: '正圆形',
    nameEn: 'Circle',
    iconName: 'Circle',
    description: '标准正圆形图元，适合用作测点标记、设备转子、状态点与节点徽章',
    defaultWidth: 120,
    defaultHeight: 120,
    defaultStyle: {
      fill: '#00e5a3',
      fillOpacity: 0.15,
      stroke: '#00e5a3',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-ellipse',
    category: 'basic',
    name: '椭圆形',
    nameEn: 'Ellipse',
    iconName: 'Circle',
    description: '矢量椭圆形，支持横向或纵向扁平展示，常用于工艺区域圈定与管道法兰',
    defaultWidth: 160,
    defaultHeight: 90,
    defaultStyle: {
      fill: '#38bdf8',
      fillOpacity: 0.15,
      stroke: '#38bdf8',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-triangle',
    category: 'basic',
    name: '正三角形 (向上)',
    nameEn: 'Triangle Up',
    iconName: 'Triangle',
    description: '向上正三角形，常用于上升趋势标记、主变绕组角接标识与警示符',
    defaultWidth: 120,
    defaultHeight: 110,
    defaultStyle: {
      fill: '#f59e0b',
      fillOpacity: 0.18,
      stroke: '#f59e0b',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-triangle-down',
    category: 'basic',
    name: '倒三角形 (向下)',
    nameEn: 'Triangle Down',
    iconName: 'Triangle',
    description: '向下三角形，常用于变电接地受电引下线、料仓下料口与下降标示',
    defaultWidth: 120,
    defaultHeight: 110,
    defaultStyle: {
      fill: '#ef4444',
      fillOpacity: 0.18,
      stroke: '#ef4444',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-triangle-right',
    category: 'basic',
    name: '向右三角形',
    nameEn: 'Triangle Right',
    iconName: 'Triangle',
    description: '向右三角形，常用于物料流向、流程图进入端口与播放指示',
    defaultWidth: 120,
    defaultHeight: 100,
    defaultStyle: {
      fill: '#00f2ff',
      fillOpacity: 0.18,
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-diamond',
    category: 'basic',
    name: '菱形 / 判定框',
    nameEn: 'Diamond / Rhombus',
    iconName: 'Diamond',
    description: '工业流程判定菱形，常用于逻辑决策节点、阀门开度与交直流转换标志',
    defaultWidth: 130,
    defaultHeight: 130,
    defaultStyle: {
      fill: '#a855f7',
      fillOpacity: 0.18,
      stroke: '#a855f7',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-pentagon',
    category: 'basic',
    name: '正五边形',
    nameEn: 'Pentagon',
    iconName: 'Hexagon',
    description: '正五边形几何图元，适用于特殊拓扑节点与工艺防护区域',
    defaultWidth: 120,
    defaultHeight: 120,
    defaultStyle: {
      fill: '#10b981',
      fillOpacity: 0.18,
      stroke: '#10b981',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-hexagon',
    category: 'basic',
    name: '正六边形 / 蜂巢',
    nameEn: 'Hexagon',
    iconName: 'Hexagon',
    description: '正六边形图元，可无缝拼接为蜂巢阵列，常用于多单元数据集成',
    defaultWidth: 130,
    defaultHeight: 120,
    defaultStyle: {
      fill: '#00f2ff',
      fillOpacity: 0.18,
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-octagon',
    category: 'basic',
    name: '正八边形',
    nameEn: 'Octagon',
    iconName: 'Hexagon',
    description: '正八边形几何图元，常用于工业停机标牌与安全联锁防护警示',
    defaultWidth: 120,
    defaultHeight: 120,
    defaultStyle: {
      fill: '#ef4444',
      fillOpacity: 0.18,
      stroke: '#ef4444',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-star',
    category: 'basic',
    name: '五角星',
    nameEn: '5-Point Star',
    iconName: 'Star',
    description: '标准五角星，常用于变电枢纽重点关注、特级负荷与标杆指标',
    defaultWidth: 120,
    defaultHeight: 120,
    defaultStyle: {
      fill: '#f59e0b',
      fillOpacity: 0.25,
      stroke: '#f59e0b',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-star4',
    category: 'basic',
    name: '四角芒星 / 光芒',
    nameEn: '4-Point Star',
    iconName: 'Sparkles',
    description: '四角芒星图元，常用于高亮告警闪烁点、母线故障放电与科技动效',
    defaultWidth: 110,
    defaultHeight: 110,
    defaultStyle: {
      fill: '#00f2ff',
      fillOpacity: 0.3,
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-trapezoid',
    category: 'basic',
    name: '等腰梯形',
    nameEn: 'Trapezoid',
    iconName: 'Square',
    description: '等腰梯形几何图元，适用于变压器箱体、漏斗料斗与通风管口',
    defaultWidth: 150,
    defaultHeight: 90,
    defaultStyle: {
      fill: '#38bdf8',
      fillOpacity: 0.18,
      stroke: '#38bdf8',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-parallelogram',
    category: 'basic',
    name: '平行四边形',
    nameEn: 'Parallelogram',
    iconName: 'Square',
    description: '平行四边形图元，常用于流程图输入输出块与倾斜传送带',
    defaultWidth: 150,
    defaultHeight: 90,
    defaultStyle: {
      fill: '#00e5a3',
      fillOpacity: 0.18,
      stroke: '#00e5a3',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-cross',
    category: 'basic',
    name: '十字形 / 加号',
    nameEn: 'Cross / Plus',
    iconName: 'Plus',
    description: '十字形几何图元，常用于安全应急标志、消防喷淋与配电交叉点',
    defaultWidth: 110,
    defaultHeight: 110,
    defaultStyle: {
      fill: '#ef4444',
      fillOpacity: 0.2,
      stroke: '#ef4444',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-ring',
    category: 'basic',
    name: '同心圆环',
    nameEn: 'Ring / Donut',
    iconName: 'Disc',
    description: '同心圆环图元，适用于中空法兰盘、轴承套圈与雷达同心圆刻度',
    defaultWidth: 120,
    defaultHeight: 120,
    defaultStyle: {
      fill: '#00f2ff',
      fillOpacity: 0.25,
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-sector',
    category: 'basic',
    name: '扇形 / 饼块',
    nameEn: 'Sector / Pie Slice',
    iconName: 'PieChart',
    description: '扇形圆弧切片，常用于阀门开度角度、风机叶片与仪表扫描扇区',
    defaultWidth: 120,
    defaultHeight: 120,
    defaultStyle: {
      fill: '#a855f7',
      fillOpacity: 0.2,
      stroke: '#a855f7',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-heart',
    category: 'basic',
    name: '心形',
    nameEn: 'Heart',
    iconName: 'Heart',
    description: '心形图元，适用于健康状态监测、生命体征与重点关怀设备',
    defaultWidth: 110,
    defaultHeight: 100,
    defaultStyle: {
      fill: '#f43f5e',
      fillOpacity: 0.2,
      stroke: '#f43f5e',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-bubble',
    category: 'basic',
    name: '对话气泡 / 标注框',
    nameEn: 'Speech Bubble',
    iconName: 'MessageSquare',
    description: '带尾巴的说明气泡框，常用于设备提示信息、报警引出说明与操作批注',
    defaultWidth: 160,
    defaultHeight: 110,
    defaultStyle: {
      fill: '#00f2ff',
      fillOpacity: 0.15,
      stroke: '#00f2ff',
      strokeWidth: 2,
      borderRadius: 8
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-cube',
    category: 'basic',
    name: '3D等轴立方体',
    nameEn: '3D Cube',
    iconName: 'Box',
    description: '3D轴测等轴立体箱体，具备顶面、左面、右面三层阴影立体质感',
    defaultWidth: 120,
    defaultHeight: 130,
    defaultStyle: {
      fill: '#38bdf8',
      fillOpacity: 0.25,
      stroke: '#38bdf8',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-cylinder',
    category: 'basic',
    name: '圆柱体 / 储罐几何',
    nameEn: 'Cylinder',
    iconName: 'Database',
    description: '立式圆柱体几何造型，适用于工业储气罐、油罐与化学反应釜底图',
    defaultWidth: 110,
    defaultHeight: 150,
    defaultStyle: {
      fill: '#00e5a3',
      fillOpacity: 0.2,
      stroke: '#00e5a3',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-arc',
    category: 'basic',
    name: '曲线弧线',
    nameEn: 'Arc Curve',
    iconName: 'Minus',
    description: '二次贝塞尔圆滑弧线，适用于管道弯曲流向、电力相量轨迹与连线',
    defaultWidth: 160,
    defaultHeight: 90,
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 3,
      lineStyle: 'solid'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-arrow',
    category: 'basic',
    name: '单向导向箭头',
    nameEn: 'Single Arrow',
    iconName: 'MoveRight',
    description: '单向实体指示箭头，常用于工艺物流方向、电力潮流流向与管网水流',
    defaultWidth: 150,
    defaultHeight: 50,
    defaultStyle: {
      fill: '#00f2ff',
      fillOpacity: 0.25,
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-double-arrow',
    category: 'basic',
    name: '双向导向箭头',
    nameEn: 'Double Arrow',
    iconName: 'ArrowLeftRight',
    description: '双向指示箭头，常用于双向通信总线、储能双向充放电与联络线',
    defaultWidth: 160,
    defaultHeight: 50,
    defaultStyle: {
      fill: '#f59e0b',
      fillOpacity: 0.25,
      stroke: '#f59e0b',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-elbow',
    category: 'basic',
    name: '直角弯头管',
    nameEn: 'Elbow Pipe',
    iconName: 'CornerDownRight',
    description: '90度直角弯头管，适用于工业流体转弯与电气电缆拐弯通道',
    defaultWidth: 110,
    defaultHeight: 110,
    defaultStyle: {
      fill: '#00f2ff',
      fillOpacity: 0.2,
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-line',
    category: 'basic',
    name: '直线 / 电气导线',
    nameEn: 'Straight Line / Wire',
    iconName: 'Minus',
    description: '基础直线与电气导线，支持实线/虚线、电压等级配色、端点箭头与动态能量粒子流光',
    defaultWidth: 240,
    defaultHeight: 24,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 3,
      lineStyle: 'solid',
      voltageLevel: '10kV'
    },
    defaultAnimation: {
      enable: true,
      speed: 1.8,
      type: 'flow'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-polyline',
    category: 'basic',
    name: '折线 / 直角绕线母线',
    nameEn: 'Orthogonal Polyline',
    iconName: 'Workflow',
    description: '直角折线与多段走线母线，支持L型/Z型阶梯拐角、电压等级配色与能量微粒流动',
    defaultWidth: 200,
    defaultHeight: 140,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 3,
      lineType: 'step-horizontal',
      voltageLevel: '10kV'
    },
    defaultAnimation: {
      enable: true,
      speed: 1.8,
      type: 'flow'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'draw-text',
    category: 'basic',
    name: '静态文本 / 工业标牌',
    nameEn: 'Text / Nameplate',
    iconName: 'Type',
    description: '工业矢量文本标牌与设备铭牌，支持字号、字体、荧光描边与发光效果',
    defaultWidth: 160,
    defaultHeight: 40,
    defaultStyle: {
      text: '10kV 配电室 #1 主变',
      fontSize: 16,
      fontWeight: 'bold',
      textColor: '#00f2ff'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'ctrl-button',
    category: 'basic',
    name: '工业控制按钮',
    nameEn: 'Industrial Control Button',
    iconName: 'ToggleRight',
    description: '工业级可交互控制按键，支持遥控分合闸下发、金属边框、指令触发与页面跳转',
    defaultWidth: 140,
    defaultHeight: 46,
    defaultStyle: {
      buttonText: '断路器合闸',
      buttonColorTheme: 'cyan',
      buttonVariant: 'solid',
      borderRadius: 8
    },
    defaultData: {
      action: {
        type: 'none',
        label: '按钮操作'
      },
      mapping: {}
    }
  },
  {
    type: 'ctrl-indicator',
    category: 'status',
    name: '金属高光圆信号灯',
    nameEn: 'Metallic Circle Status LED',
    iconName: 'CircleDot',
    description: '纯原子化工业金属外圈LED信号灯，0:绿(分闸/正常), 1:红(合闸/带电), 2:黄(故障)',
    defaultWidth: 40,
    defaultHeight: 40,
    defaultStyle: {
      indicatorShape: 'circle',
      indicatorState: 0,
      indicatorBlinkSpeed: 'none'
    },
    defaultCustomProps: {
      state: 0,
      indicatorStyle: 'bezel-circle'
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        statusKey: 'DEV_101_YX_1'
      }
    }
  },
  {
    type: 'ctrl-indicator',
    category: 'status',
    name: '科技脉冲光环状态点',
    nameEn: 'Pulse Radar Status Ring',
    iconName: 'Disc',
    description: '科技同心圆脉冲状态指示点，带虚线旋转环与发光晶核',
    defaultWidth: 40,
    defaultHeight: 40,
    defaultStyle: {
      indicatorShape: 'circle',
      indicatorState: 0
    },
    defaultCustomProps: {
      state: 0,
      indicatorStyle: 'ring-pulse'
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        statusKey: 'DEV_101_YX_1'
      }
    }
  },
  {
    type: 'ctrl-indicator',
    category: 'status',
    name: '菱形联锁工控状态灯',
    nameEn: 'Diamond Interlock LED',
    iconName: 'Diamond',
    description: '45°菱形多边形联锁逻辑信号灯，适用于重合闸与联锁状态',
    defaultWidth: 40,
    defaultHeight: 40,
    defaultStyle: {
      indicatorShape: 'diamond',
      indicatorState: 1
    },
    defaultCustomProps: {
      state: 1,
      indicatorStyle: 'diamond-badge'
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        statusKey: 'DEV_101_YX_1'
      }
    }
  },
  {
    type: 'ctrl-indicator',
    category: 'status',
    name: '蜂巢六角工控指示灯',
    nameEn: 'Hexagon Pilot Lamp',
    iconName: 'Hexagon',
    description: '正六边形机甲蜂巢指示灯，高密度工控状态监控',
    defaultWidth: 40,
    defaultHeight: 40,
    defaultStyle: {
      indicatorShape: 'hexagon',
      indicatorState: 0
    },
    defaultCustomProps: {
      state: 0,
      indicatorStyle: 'hexagon-pilot'
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        statusKey: 'DEV_101_YX_1'
      }
    }
  },
  {
    type: 'ctrl-indicator',
    category: 'status',
    name: '拓扑准星状态定位点',
    nameEn: 'Crosshair Topology Reticle',
    iconName: 'Crosshair',
    description: '配电拓扑接线节点准星定位点，十字发光刻度与核心状态指示',
    defaultWidth: 40,
    defaultHeight: 40,
    defaultStyle: {
      indicatorShape: 'crosshair',
      indicatorState: 1
    },
    defaultCustomProps: {
      state: 1,
      indicatorStyle: 'crosshair-target'
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        statusKey: 'DEV_101_YX_1'
      }
    }
  },
  {
    type: 'ctrl-indicator',
    category: 'status',
    name: '荧光微型高亮状态点',
    nameEn: 'Neon Dot Indicator',
    iconName: 'Dot',
    description: '无边框超高密度荧光发光微点，适合密布在主接线与工艺管路图',
    defaultWidth: 28,
    defaultHeight: 28,
    defaultStyle: {
      indicatorShape: 'dot',
      indicatorState: 0
    },
    defaultCustomProps: {
      state: 0,
      indicatorStyle: 'neon-dot'
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        statusKey: 'DEV_101_YX_1'
      }
    }
  },
  {
    type: 'ctrl-indicator',
    category: 'status',
    name: '工牌铭牌状态指示点',
    nameEn: 'Status Tag Plate',
    iconName: 'Tag',
    description: '微型状态工牌，带分合闸状态编码与双色指示灯',
    defaultWidth: 90,
    defaultHeight: 32,
    defaultStyle: {
      indicatorState: 1
    },
    defaultCustomProps: {
      state: 1,
      indicatorStyle: 'status-plate'
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        statusKey: 'DEV_101_YX_1'
      }
    }
  },
  {
    type: 'ctrl-indicator',
    category: 'status',
    name: '现代扁平高亮LED',
    nameEn: 'Flat High-Lumen LED',
    iconName: 'Circle',
    description: '扁平超高亮度发光二极管，带双重动态光晕',
    defaultWidth: 36,
    defaultHeight: 36,
    defaultStyle: {
      indicatorShape: 'circle',
      indicatorState: 1
    },
    defaultCustomProps: {
      state: 1,
      indicatorStyle: 'flat-led'
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        statusKey: 'DEV_101_YX_1'
      }
    }
  },
  {
    type: 'ctrl-indicator',
    category: 'status',
    name: '方型工业信号灯',
    nameEn: 'Square Pilot Lamp',
    iconName: 'Square',
    description: '经典工控方型信号灯，带斜切内凹发光灯芯',
    defaultWidth: 36,
    defaultHeight: 36,
    defaultStyle: {
      indicatorShape: 'square',
      indicatorState: 0
    },
    defaultCustomProps: {
      state: 0,
      indicatorStyle: 'square-lamp'
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        statusKey: 'DEV_101_YX_1'
      }
    }
  },
  {
    type: 'ctrl-indicator',
    category: 'status',
    name: '胶囊椭圆指示灯',
    nameEn: 'Pill Capsule Status Tag',
    iconName: 'ToggleRight',
    description: '胶囊条形指示灯，适合水平排布于机柜面板',
    defaultWidth: 54,
    defaultHeight: 28,
    defaultStyle: {
      indicatorShape: 'pill',
      indicatorState: 1
    },
    defaultCustomProps: {
      state: 1,
      indicatorStyle: 'pill-tag'
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        statusKey: 'DEV_101_YX_1'
      }
    }
  },
  {
    type: 'ind-matrix',
    category: 'status',
    name: '全站测点状态矩阵',
    nameEn: 'Full Station Status Matrix',
    iconName: 'Layers',
    description: '全站所有间隔遥信遥测运行状态矩阵看板',
    defaultWidth: 320,
    defaultHeight: 180,
    defaultStyle: {},
    defaultData: { mapping: {} }
  },

  // ==========================================
  // 2. Electrical Power System Primary Components (电力一次系统图元)
  // ==========================================
  {
    type: 'elec-breaker',
    category: 'electrical',
    name: '高压真空断路器 QF (0/1/2)',
    nameEn: 'HV Vacuum Circuit Breaker',
    iconName: 'Zap',
    description: '国标/IEC标准高压真空断路器，支持 0:分闸(断开/绿), 1:合闸(闭合/红), 2:故障(跳闸/黄)',
    defaultWidth: 70,
    defaultHeight: 90,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 2.5,
      breakerColorClosed: '#ef4444',
      breakerColorOpen: '#10b981'
    },
    defaultCustomProps: {
      state: 1 // 1: 合闸, 0: 分闸, 2: 故障
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        stateKey: 'DEV_101_YX_1'
      }
    }
  },
  {
    type: 'elec-handcart',
    category: 'electrical',
    name: '开关柜抽出式手车 (0/1/2)',
    nameEn: 'Switchgear Withdrawable Handcart',
    iconName: 'Layers',
    description: 'KYN28高压开关柜可抽出式断路器手车，支持 0:试验位置, 1:工作位置, 2:检修隔离',
    defaultWidth: 80,
    defaultHeight: 90,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    defaultCustomProps: {
      position: 1 // 1: 工作位置, 0: 试验位置, 2: 检修
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        stateKey: 'DEV_101_YX_2'
      }
    }
  },
  {
    type: 'elec-disconnector',
    category: 'electrical',
    name: '隔离开关 / 刀闸 QS (0/1/2)',
    nameEn: 'Isolator Switch / Disconnector',
    iconName: 'ZapOff',
    description: '电力隔离开关，支持 0:分闸(隔离), 1:合闸(导通), 2:故障',
    defaultWidth: 60,
    defaultHeight: 70,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 2.5
    },
    defaultCustomProps: {
      state: 1
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'elec-grounding',
    category: 'electrical',
    name: '接地刀闸 QE (0/1/2)',
    nameEn: 'Grounding Disconnector Switch',
    iconName: 'Minus',
    description: '高压出线/母线快速接地刀闸，支持 0:分闸, 1:合闸(接地导通), 2:故障',
    defaultWidth: 60,
    defaultHeight: 70,
    defaultStyle: {
      stroke: '#eab308',
      strokeWidth: 2.5
    },
    defaultCustomProps: {
      state: 0
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'elec-transformer',
    category: 'electrical',
    name: '电力主变压器 TM',
    nameEn: 'Power Transformer',
    iconName: 'Activity',
    description: '双绕组/三绕组电力变压器，双圆相交标准电力符号，带油温与瓦斯信号',
    defaultWidth: 100,
    defaultHeight: 130,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 2.5,
      voltageLevel: '10kV'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'elec-ct',
    category: 'electrical',
    name: '电流互感器 TA / CT',
    nameEn: 'Current Transformer',
    iconName: 'Circle',
    description: '高精度测量/保护用电流互感器，圆形同心电磁感应标准一次符号',
    defaultWidth: 50,
    defaultHeight: 60,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'elec-pt',
    category: 'electrical',
    name: '电压互感器 TV / PT',
    nameEn: 'Voltage Transformer',
    iconName: 'Circle',
    description: '母线三相电压测量用电磁式电压互感器，带一次熔断器符号',
    defaultWidth: 50,
    defaultHeight: 70,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'elec-arrester',
    category: 'electrical',
    name: '氧化锌避雷器 F',
    nameEn: 'Lightning Surge Arrester',
    iconName: 'Zap',
    description: '高压母线与线路防雷过电压保护用金属氧化物避雷器',
    defaultWidth: 50,
    defaultHeight: 70,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'elec-busbar',
    category: 'electrical',
    name: '高低压母线段 Busbar',
    nameEn: 'Power Distribution Busbar',
    iconName: 'Minus',
    description: '变电站高低压铜铝主母线段，支持电压等级色彩定制与能量粒子流',
    defaultWidth: 320,
    defaultHeight: 16,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 6,
      voltageLevel: '10kV'
    },
    defaultData: { mapping: {} }
  },

  // ==========================================
  // 3. Metrics & Live Telemetry (指标/遥测)
  // ==========================================
  {
    type: 'metric-float',
    category: 'metrics',
    name: '极简等宽遥测数值',
    nameEn: 'Pure Digital Telemetry Metric',
    iconName: 'Binary',
    description: '纯净浮点数遥测数值，零边距极简等宽数码呈现，支持小数位数、固定字号与测点映射',
    defaultWidth: 100,
    defaultHeight: 36,
    defaultStyle: {
      decimals: 2,
      trimZeros: true,
      fontSize: 22,
      textColor: '#00f2ff',
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 0,
      textAlign: 'center'
    },
    defaultCustomProps: {
      displayStyle: 'pure-digital',
      decimals: 2,
      trimZeros: true
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        valueKey: 'DEV_101_YC_1'
      }
    }
  },
  {
    type: 'metric-flipper',
    category: 'metrics',
    name: '翻牌式数字计数器',
    nameEn: 'Digital Flipper Counter',
    iconName: 'Binary',
    description: '工业电子LED数字数码管翻牌器，适用于累计发电量、运行时长与报警数',
    defaultWidth: 120,
    defaultHeight: 40,
    defaultStyle: {
      decimals: 0,
      fontSize: 24,
      textColor: '#00f2ff',
      fill: 'transparent',
      textAlign: 'center'
    },
    defaultData: {
      datasetId: 'ds-scada-station',
      mapping: {
        valueKey: 'DEV_101_DD_1'
      }
    }
  },
  {
    type: 'metric-clock-analog',
    category: 'metrics',
    name: '模拟表盘时钟',
    nameEn: 'Analog Dial Clock',
    iconName: 'Clock',
    description: '极简工控模拟圆形表盘时钟，秒针/分针/时针实时旋转，100%自适应贴合边界缩放',
    defaultWidth: 120,
    defaultHeight: 120,
    defaultStyle: {
      textColor: '#00f2ff',
      stroke: '#00f2ff',
      fill: '#040a18'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'metric-clock',
    category: 'metrics',
    name: '实时数字时钟',
    nameEn: 'Digital Clock',
    iconName: 'Clock',
    description: '纯净LED数字时钟，时分秒动态跳动，支持自由拉伸全比例自适应',
    defaultWidth: 160,
    defaultHeight: 44,
    defaultStyle: {
      textColor: '#00f2ff',
      fill: 'transparent'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'metric-time-banner',
    category: 'metrics',
    name: '日期星期显示',
    nameEn: 'Date & Week Display',
    iconName: 'Calendar',
    description: '纯净年月日及星期文本显示，自动同步系统日期',
    defaultWidth: 180,
    defaultHeight: 36,
    defaultStyle: {
      textColor: '#00f2ff',
      fill: 'transparent'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'metric-countdown',
    category: 'metrics',
    name: '安全运行时长计',
    nameEn: 'Runtime Counter',
    iconName: 'Timer',
    description: '纯净安全无故障累计运行天数与时钟显示',
    defaultWidth: 200,
    defaultHeight: 44,
    defaultStyle: {
      textColor: '#00f2ff',
      fill: 'transparent'
    },
    defaultData: { mapping: {} }
  },

  // ==========================================
  // 4. Industrial SCADA & Media (工控/SCADA)
  // ==========================================
  {
    type: 'ind-tank',
    category: 'industrial',
    name: '流体储罐与液位计',
    nameEn: 'Fluid Storage Tank',
    iconName: 'Database',
    description: '工业反应釜与液体储罐，支持波浪动效、百分比液位高度与颜色预警',
    defaultWidth: 140,
    defaultHeight: 180,
    defaultStyle: {
      stroke: '#00f2ff',
      fill: '#00f2ff'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'ind-pipe',
    category: 'industrial',
    name: '介质工艺管道与流动',
    nameEn: 'Industrial Medium Pipe',
    iconName: 'Workflow',
    description: '工业流体管道，支持流速、流动方向与介质状态颜色',
    defaultWidth: 220,
    defaultHeight: 24,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 6
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'ind-alarm-list',
    category: 'industrial',
    name: '实时告警事件滚屏',
    nameEn: 'Realtime SCADA Alarm Feed',
    iconName: 'AlertTriangle',
    description: '变电站与生产线实时SOE事件、事故跳闸与越限告警滚屏列表',
    defaultWidth: 320,
    defaultHeight: 200,
    defaultStyle: {
      stroke: '#ef4444',
      fill: 'rgba(15, 23, 42, 0.85)'
    },
    defaultData: { mapping: {} }
  },

  // ==========================================
  // 5. Visual Charts (可视化图表)
  // ==========================================
  {
    type: 'chart-line',
    category: 'charts',
    name: '实时负荷折线趋势图',
    nameEn: 'Live Load Trend Line Chart',
    iconName: 'LineChart',
    description: 'ECharts驱动的24小时有功/无功负荷实时曲线，支持平滑拟合与渐变面积',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#00f2ff'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'chart-bar',
    category: 'charts',
    name: '能耗分布柱状图',
    nameEn: 'Energy Bar Chart',
    iconName: 'BarChart3',
    description: '各回路分项用电量与峰平谷对比柱状图，支持立体柱体与多系列堆叠',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#00e5a3'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'chart-pie',
    category: 'charts',
    name: '负荷占比环形饼图',
    nameEn: 'Load Proportion Pie Chart',
    iconName: 'PieChart',
    description: '高精环形与玫瑰饼图，展示变压器负载率、动力照明空调能耗配比',
    defaultWidth: 300,
    defaultHeight: 220,
    defaultStyle: {},
    defaultData: { mapping: {} }
  },
  {
    type: 'chart-gauge',
    category: 'charts',
    name: '功率因数 / 频率仪表盘',
    nameEn: 'Power Factor Gauge',
    iconName: 'Gauge',
    description: '汽车仪表级指针仪表盘，刻度发光，精确监控电网频率与CosΦ',
    defaultWidth: 240,
    defaultHeight: 200,
    defaultStyle: {},
    defaultData: { mapping: {} }
  },

  // ==========================================
  // 6. Cyber Decorations & Borders (科技边框)
  // ==========================================
  {
    type: 'deco-border-minimal',
    category: 'decoration',
    name: '极简透明边框',
    nameEn: 'Minimalist Transparent Frame',
    iconName: 'Square',
    description: '没有任何文字特效的极简工控边框，内部完全透明，四角高精直角卡尺',
    defaultWidth: 1980,
    defaultHeight: 1100,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 2,
      fill: 'transparent'
    },
    defaultCustomProps: {
      borderStyle: 'deco-border-minimal',
      showTitle: false
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'deco-border-neon',
    category: 'decoration',
    name: '霓虹四角标科技框',
    nameEn: 'Cyber Neon Corner Border',
    iconName: 'Frame',
    description: '赛博朋克发光外边框，四角高亮直角括弧与中心微标',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#00f2ff'
    },
    defaultCustomProps: {
      borderStyle: 'deco-border-neon'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'deco-border-tech',
    category: 'decoration',
    name: '科技切角装甲框',
    nameEn: 'Tech Chamfer Armor Frame',
    iconName: 'ShieldAlert',
    description: '45° 精准矢量多边形切角装甲框，带上下科技标尺线',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#00f2ff'
    },
    defaultCustomProps: {
      borderStyle: 'deco-border-tech'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'deco-border-mech',
    category: 'decoration',
    name: '重装机甲铆钉边框',
    nameEn: 'Heavy Mech Rivet Plate',
    iconName: 'SquareCode',
    description: '工业沉头铆钉与深色防刮面板，重工业SCADA监控专享',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#38bdf8',
      fill: 'rgba(6, 14, 28, 0.75)'
    },
    defaultCustomProps: {
      borderStyle: 'deco-border-mech'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'deco-border-hud-double',
    category: 'decoration',
    name: '双线流光HUD科技框',
    nameEn: 'HUD Double Streamer Frame',
    iconName: 'Layers',
    description: '动态双层微框与四周刻度标尺，增强大屏纵深感',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#00f2ff'
    },
    defaultCustomProps: {
      borderStyle: 'deco-border-hud-double'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'deco-border-cyber-corner',
    category: 'decoration',
    name: '四角发光斜切微框',
    nameEn: 'Cyber Corner Cuts Border',
    iconName: 'Crosshair',
    description: '极简科技四角对角切痕与微弱虚线轮廓',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#00f2ff'
    },
    defaultCustomProps: {
      borderStyle: 'deco-border-cyber-corner'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'deco-border-gradient-pulse',
    category: 'decoration',
    name: '渐变律动发光科技框',
    nameEn: 'Gradient Pulse Cyber Frame',
    iconName: 'Sparkles',
    description: '全包围双色发光光晕与上下霓虹渐变发光柱',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#8b5cf6'
    },
    defaultCustomProps: {
      borderStyle: 'deco-border-gradient-pulse'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'deco-border-hazard',
    category: 'decoration',
    name: '工业警示斜纹边框',
    nameEn: 'Hazard Stripe Industrial Frame',
    iconName: 'AlertTriangle',
    description: '45° 工业防灾警示斜纹边框，适用于高危重工监控大屏',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#f59e0b'
    },
    defaultCustomProps: {
      borderStyle: 'deco-border-hazard'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'deco-border-bracket',
    category: 'decoration',
    name: '极简对角卡尺定位框',
    nameEn: 'Minimal Bracket Caliper',
    iconName: 'Box',
    description: '极简四角卡尺定位标记，无缝贴合大屏内部图表容器',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#38bdf8'
    },
    defaultCustomProps: {
      borderStyle: 'deco-border-bracket'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'deco-border-matrix-panel',
    category: 'decoration',
    name: '点阵发光机箱面板',
    nameEn: 'Dot Matrix Mesh Panel',
    iconName: 'Cpu',
    description: '密集透气孔点阵发光机箱外壳面板，自带系统铭牌标签',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#00f2ff'
    },
    defaultCustomProps: {
      borderStyle: 'deco-border-matrix-panel'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'deco-border-quantum-box',
    category: 'decoration',
    name: '量子悬浮光条框',
    nameEn: 'Quantum Levitation Box',
    iconName: 'Disc',
    description: '上下居中悬浮发光条与虚线微边框',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#06b6d4'
    },
    defaultCustomProps: {
      borderStyle: 'deco-border-quantum-box'
    },
    defaultData: { mapping: {} }
  },
  {
    type: 'deco-border-scada-card',
    category: 'decoration',
    name: 'SCADA标准工控外框',
    nameEn: 'SCADA Standard Card Frame',
    iconName: 'LayoutDashboard',
    description: '集控中心标准监视外框，带状态圆点与卡片抬头',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultStyle: {
      stroke: '#3b82f6'
    },
    defaultCustomProps: {
      borderStyle: 'deco-border-scada-card'
    },
    defaultData: { mapping: {} }
  }
];
