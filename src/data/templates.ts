import { ProjectSchema, ScreenComponent, ScreenConfig, TemplateMeta } from '../types';
import { INITIAL_DATASETS } from './presetDatasets';
import { PV_HIGH_VOLTAGE_TEMPLATE } from './pvHighVoltageTemplate';

export type { TemplateMeta };

// 1. Smart Factory Digital Twin Template (1920x1080)
const SMART_FACTORY_COMPONENTS: ScreenComponent[] = [
  // Title Banner
  {
    id: 'comp-title-01',
    name: 'SCADA主标题',
    type: 'metric-title',
    category: 'metrics',
    x: 480,
    y: 20,
    width: 960,
    height: 70,
    rotation: 0,
    zIndex: 10,
    style: {
      textColor: '#e2f1ff',
      fontSize: 28,
      fontWeight: 'bold',
      letterSpacing: 4
    },
    data: {
      datasetId: 'ds-factory-telemetry',
      mapping: {
        titleKey: '智能重工 · 超级智造数字化双碳管控平台'
      }
    }
  },
  // Hazard Warning stripe under title
  {
    id: 'comp-hazard-01',
    name: '顶部警示斑马条',
    type: 'deco-hazard-stripe',
    category: 'decoration',
    x: 560,
    y: 84,
    width: 800,
    height: 12,
    rotation: 0,
    zIndex: 5,
    style: {
      fill: '#f59e0b',
      opacity: 0.8
    },
    data: { mapping: {} }
  },

  // Top KPI Metrics
  {
    id: 'comp-kpi-01',
    name: '今日累计产量',
    type: 'metric-flipper',
    category: 'metrics',
    x: 30,
    y: 100,
    width: 280,
    height: 100,
    rotation: 0,
    zIndex: 5,
    style: {
      fill: 'rgba(10, 22, 38, 0.85)',
      stroke: '#00f2ff',
      strokeWidth: 1,
      textColor: '#00f2ff',
      themePreset: 'cyber-cyan'
    },
    data: {
      datasetId: 'ds-factory-telemetry',
      mapping: {
        titleKey: '今日累计产出 (PCS)',
        valueKey: 'daily_yield_units',
        unitKey: '件'
      }
    }
  },
  {
    id: 'comp-kpi-02',
    name: '综合稼动率 OEE',
    type: 'metric-float',
    category: 'metrics',
    x: 330,
    y: 100,
    width: 260,
    height: 100,
    rotation: 0,
    zIndex: 5,
    style: {
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidth: 0,
      textColor: '#00e5a3',
      fontSize: 28,
      decimals: 1,
      trimZeros: false
    },
    data: {
      datasetId: 'ds-factory-telemetry',
      mapping: {
        valueKey: 'oee_efficiency_pct'
      }
    }
  },
  {
    id: 'comp-kpi-03',
    name: '主轴功率与转速',
    type: 'metric-float',
    category: 'metrics',
    x: 1330,
    y: 100,
    width: 260,
    height: 100,
    rotation: 0,
    zIndex: 5,
    style: {
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidth: 0,
      textColor: '#f59e0b',
      fontSize: 28,
      decimals: 2,
      trimZeros: true
    },
    data: {
      datasetId: 'ds-factory-telemetry',
      mapping: {
        valueKey: 'power_consumption_kw'
      }
    }
  },
  {
    id: 'comp-kpi-04',
    name: '良品率指标',
    type: 'metric-float',
    category: 'metrics',
    x: 1610,
    y: 100,
    width: 280,
    height: 100,
    rotation: 0,
    zIndex: 5,
    style: {
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidth: 0,
      textColor: '#3b82f6',
      fontSize: 28,
      decimals: 1,
      trimZeros: false
    },
    data: {
      datasetId: 'ds-factory-telemetry',
      mapping: {
        valueKey: 'yield_rate_pct'
      }
    }
  },

  // Left Section - Telemetry Charts
  {
    id: 'comp-line-01',
    name: '实时功率/温度遥测折线',
    type: 'chart-line',
    category: 'charts',
    x: 30,
    y: 220,
    width: 560,
    height: 380,
    rotation: 0,
    zIndex: 4,
    style: {
      fill: 'rgba(12, 22, 37, 0.9)',
      stroke: '#00f2ff',
      strokeWidth: 1,
      borderRadius: 8
    },
    data: {
      datasetId: 'ds-factory-telemetry',
      mapping: {
        titleKey: '主轴功率动态变化 (kW)',
        categoriesKey: 'series_time',
        seriesKey: 'series_power',
        unitKey: 'kW',
        thresholdMax: 855
      }
    }
  },
  {
    id: 'comp-bar-01',
    name: '工序产出柱状图',
    type: 'chart-bar',
    category: 'charts',
    x: 30,
    y: 620,
    width: 560,
    height: 420,
    rotation: 0,
    zIndex: 4,
    style: {
      fill: 'rgba(12, 22, 37, 0.9)',
      stroke: '#00e5a3',
      strokeWidth: 1,
      borderRadius: 8
    },
    data: {
      datasetId: 'ds-factory-telemetry',
      mapping: {
        titleKey: '车间各工段实时产量分布',
        categoriesKey: 'series_categories',
        seriesKey: 'series_line_output',
        unitKey: '件'
      }
    }
  },

  // Center Area: SCADA Topology & Gauge
  {
    id: 'comp-border-center',
    name: '中控主透镜框',
    type: 'deco-border-neon',
    category: 'decoration',
    x: 610,
    y: 220,
    width: 700,
    height: 520,
    rotation: 0,
    zIndex: 1,
    style: {
      fill: 'rgba(8, 16, 30, 0.7)',
      stroke: '#00f2ff',
      strokeWidth: 1
    },
    data: {
      mapping: {
        titleKey: '车间主轴与核心流体动力拓扑'
      }
    }
  },
  {
    id: 'comp-gauge-01',
    name: '主轴转速工控表盘',
    type: 'chart-gauge',
    category: 'charts',
    x: 630,
    y: 270,
    width: 320,
    height: 260,
    rotation: 0,
    zIndex: 6,
    style: {
      fill: 'rgba(13, 27, 42, 0.8)',
      stroke: '#00f2ff',
      strokeWidth: 1,
      themePreset: 'cyber-cyan'
    },
    data: {
      datasetId: 'ds-factory-telemetry',
      mapping: {
        titleKey: '主轴转速',
        valueKey: 'spindle_speed_rpm',
        unitKey: 'RPM',
        thresholdMax: 4000
      }
    }
  },
  {
    id: 'comp-tank-01',
    name: '冷却液储罐液位',
    type: 'ind-tank',
    category: 'industrial',
    x: 980,
    y: 270,
    width: 300,
    height: 260,
    rotation: 0,
    zIndex: 6,
    style: {
      fill: 'rgba(10, 20, 35, 0.9)',
      stroke: '#00f2ff',
      strokeWidth: 1
    },
    data: {
      datasetId: 'ds-chemical-tanks',
      mapping: {
        titleKey: 'A-101冷却液储罐',
        valueKey: 'tank1_level_pct',
        unitKey: '%'
      }
    }
  },
  {
    id: 'comp-pipe-01',
    name: '主轴冷却回路管道',
    type: 'ind-pipe',
    category: 'industrial',
    x: 650,
    y: 560,
    width: 620,
    height: 50,
    rotation: 0,
    zIndex: 6,
    style: {
      fill: '#132338',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    animation: {
      enable: true,
      type: 'flow',
      speed: 2,
      direction: 'forward',
      loop: true
    },
    data: {
      datasetId: 'ds-chemical-tanks',
      mapping: {
        titleKey: '循环冷却进水主回路',
        valueKey: 'flow_rate_lpm',
        unitKey: 'L/min'
      }
    }
  },
  {
    id: 'comp-matrix-01',
    name: '机床状态点阵',
    type: 'ind-matrix',
    category: 'industrial',
    x: 610,
    y: 760,
    width: 700,
    height: 280,
    rotation: 0,
    zIndex: 4,
    style: {
      fill: 'rgba(12, 22, 37, 0.9)',
      stroke: '#00f2ff',
      strokeWidth: 1
    },
    data: {
      datasetId: 'ds-factory-telemetry',
      mapping: {
        titleKey: '全厂 12 个智能工段执行状态监测'
      }
    }
  },

  // Right Section - Alarms and Pie
  {
    id: 'comp-pie-01',
    name: '能源占比环形图',
    type: 'chart-pie',
    category: 'charts',
    x: 1330,
    y: 220,
    width: 560,
    height: 380,
    rotation: 0,
    zIndex: 4,
    style: {
      fill: 'rgba(12, 22, 37, 0.9)',
      stroke: '#f59e0b',
      strokeWidth: 1,
      borderRadius: 8
    },
    data: {
      datasetId: 'ds-energy-grid',
      mapping: {
        titleKey: '厂区能耗构成与峰谷分布',
        categoriesKey: 'series_tank_names',
        seriesKey: 'series_tank_compare',
        unitKey: '%'
      }
    }
  },
  {
    id: 'comp-alarm-01',
    name: '实时遥测与工况统计',
    type: 'chart-bar',
    category: 'charts',
    x: 1330,
    y: 620,
    width: 560,
    height: 420,
    rotation: 0,
    zIndex: 4,
    style: {
      fill: 'rgba(12, 22, 37, 0.9)',
      stroke: '#00f2ff',
      strokeWidth: 1,
      borderRadius: 8
    },
    data: {
      datasetId: 'ds-energy-grid',
      mapping: {
        titleKey: '工控系统运行负荷分布',
        categoriesKey: 'series_tank_names',
        seriesKey: 'series_tank_compare',
        unitKey: '%'
      }
    }
  }
];

const DEFAULT_SCREEN_CONFIG: ScreenConfig = {
  id: 'screen-smart-factory-01',
  name: '智能工厂数字化大屏 (Smart Factory DataV)',
  description: '1920x1080 工业风深色大屏，集成实时遥测、流体管道拓扑与机床状态矩阵',
  width: 1920,
  height: 1080,
  backgroundColor: '#070b14',
  backgroundGrid: true,
  gridSize: 20,
  gridColor: 'rgba(0, 242, 255, 0.22)',
  theme: 'cyber-dark',
  version: '2.0.0',
  updatedAt: new Date().toISOString()
};

export const PRESET_TEMPLATES: TemplateMeta[] = [
  PV_HIGH_VOLTAGE_TEMPLATE,
  {
    id: 'tpl-smart-factory',
    name: '智能工厂车间数字孪生大屏',
    nameEn: 'Smart Factory Digital Twin',
    description: '工业制造、数控机床、OEE稼动率、功率遥测与告警流水线一体化',
    category: '智能制造',
    tags: ['OEE', 'PLC遥测', '机床矩阵', '工况告警'],
    thumbnailGradient: 'from-cyan-950 via-slate-900 to-blue-950',
    schema: {
      version: '2.0.0',
      screen: DEFAULT_SCREEN_CONFIG,
      datasets: INITIAL_DATASETS,
      components: SMART_FACTORY_COMPONENTS
    }
  },
  {
    id: 'tpl-chemical-tank',
    name: '石化储罐与管道流体SCADA',
    nameEn: 'Petrochemical Tank SCADA',
    description: '高精反应釜动态波浪液位、阀门开度、管线粒子流速与防爆安全指数',
    category: '能源化工',
    tags: ['储罐液位', '流体管线', '安全指数', '阀门控制'],
    thumbnailGradient: 'from-amber-950 via-zinc-900 to-slate-950',
    schema: {
      version: '2.0.0',
      screen: {
        ...DEFAULT_SCREEN_CONFIG,
        id: 'screen-chemical-02',
        name: '石化储罐与管道SCADA总控大屏',
        theme: 'industrial-steel',
        backgroundColor: '#090d16'
      },
      datasets: INITIAL_DATASETS,
      components: [
        {
          id: 'chem-title',
          name: '大屏科幻标题',
          type: 'metric-title',
          category: 'metrics',
          x: 480,
          y: 25,
          width: 960,
          height: 70,
          rotation: 0,
          zIndex: 10,
          style: { textColor: '#fef08a', fontSize: 28, fontWeight: 'bold' },
          data: { datasetId: 'ds-chemical-tanks', mapping: { titleKey: '国家级石化新材料园区 · 储运与反应釜SCADA监控中心' } }
        },
        {
          id: 'chem-tank-1',
          name: 'A-101 储罐',
          type: 'ind-tank',
          category: 'industrial',
          x: 100,
          y: 160,
          width: 320,
          height: 380,
          rotation: 0,
          zIndex: 5,
          style: { fill: 'rgba(15, 23, 42, 0.9)', stroke: '#00f2ff', strokeWidth: 2 },
          data: { datasetId: 'ds-chemical-tanks', mapping: { titleKey: 'A-101 乙烯原料储罐', valueKey: 'tank1_level_pct', unitKey: '%' } }
        },
        {
          id: 'chem-tank-2',
          name: 'A-102 储罐',
          type: 'ind-tank',
          category: 'industrial',
          x: 460,
          y: 160,
          width: 320,
          height: 380,
          rotation: 0,
          zIndex: 5,
          style: { fill: 'rgba(15, 23, 42, 0.9)', stroke: '#f59e0b', strokeWidth: 2 },
          data: { datasetId: 'ds-chemical-tanks', mapping: { titleKey: 'A-102 聚合反应釜', valueKey: 'tank2_level_pct', unitKey: '%' } }
        },
        {
          id: 'chem-pipe-flow',
          name: '主物料输送管道',
          type: 'ind-pipe',
          category: 'industrial',
          x: 100,
          y: 580,
          width: 680,
          height: 60,
          rotation: 0,
          zIndex: 5,
          style: { stroke: '#00f2ff', strokeWidth: 3 },
          animation: { enable: true, type: 'flow', speed: 2, loop: true },
          data: { datasetId: 'ds-chemical-tanks', mapping: { titleKey: '输料主干管流速', valueKey: 'flow_rate_lpm', unitKey: 'L/min' } }
        },
        {
          id: 'chem-flow-chart',
          name: '瞬时流量时序折线',
          type: 'chart-line',
          category: 'charts',
          x: 820,
          y: 160,
          width: 1000,
          height: 480,
          rotation: 0,
          zIndex: 4,
          style: { fill: 'rgba(15, 23, 42, 0.9)', stroke: '#38bdf8', strokeWidth: 1 },
          data: {
            datasetId: 'ds-chemical-tanks',
            mapping: {
              titleKey: '主管网实时流速时序图 (L/min)',
              categoriesKey: 'series_flow',
              seriesKey: 'series_flow',
              unitKey: 'L/min'
            }
          }
        },
        {
          id: 'chem-alarms',
          name: '储运实时监测数据走势',
          type: 'chart-line',
          category: 'charts',
          x: 100,
          y: 670,
          width: 1720,
          height: 360,
          rotation: 0,
          zIndex: 4,
          style: { fill: 'rgba(15, 23, 42, 0.95)', stroke: '#00f2ff', strokeWidth: 1 },
          data: {
            datasetId: 'ds-energy-grid',
            mapping: {
              titleKey: '危化品储运安全实时压力走势',
              categoriesKey: 'series_time',
              seriesKey: 'series_flow',
              unitKey: 'MPa'
            }
          }
        }
      ]
    }
  },
  {
    id: 'tpl-energy-grid',
    name: '新能源微电网与负荷枢纽',
    nameEn: 'Renewable Microgrid Hub',
    description: '光伏并网发电、储能SOC电量、厂区负荷率及碳排放减量指标',
    category: '绿色微电网',
    tags: ['光伏出力', '储能SOC', '负荷预测', '绿电消纳'],
    thumbnailGradient: 'from-emerald-950 via-slate-900 to-teal-950',
    schema: {
      version: '2.0.0',
      screen: {
        ...DEFAULT_SCREEN_CONFIG,
        id: 'screen-energy-03',
        name: '绿色低碳微电网控制中心',
        theme: 'carbon-matrix',
        backgroundColor: '#061014'
      },
      datasets: INITIAL_DATASETS,
      components: [
        {
          id: 'eng-title',
          name: '大屏主标题',
          type: 'metric-title',
          category: 'metrics',
          x: 480,
          y: 20,
          width: 960,
          height: 70,
          rotation: 0,
          zIndex: 10,
          style: { textColor: '#6ee7b7', fontSize: 28, fontWeight: 'bold' },
          data: { datasetId: 'ds-energy-grid', mapping: { titleKey: '零碳智慧园区 · 储能与多能互补微网调控中心' } }
        },
        {
          id: 'eng-kpi-solar',
          name: '光伏实时出力',
          type: 'metric-flipper',
          category: 'metrics',
          x: 60,
          y: 120,
          width: 320,
          height: 120,
          rotation: 0,
          zIndex: 5,
          style: { fill: 'rgba(6, 20, 24, 0.9)', stroke: '#10b981', textColor: '#10b981' },
          data: { datasetId: 'ds-energy-grid', mapping: { titleKey: '光伏实时出力 (kW)', valueKey: 'solar_power_kw', unitKey: 'kW' } }
        },
        {
          id: 'eng-kpi-soc',
          name: '储能电池SOC',
          type: 'metric-float',
          category: 'metrics',
          x: 410,
          y: 120,
          width: 320,
          height: 120,
          rotation: 0,
          zIndex: 5,
          style: { fill: 'transparent', stroke: 'transparent', textColor: '#06b6d4', fontSize: 32 },
          data: { datasetId: 'ds-energy-grid', mapping: { valueKey: 'battery_soc_pct' } }
        },
        {
          id: 'eng-chart-solar',
          name: '光伏与用电负荷对比',
          type: 'chart-line',
          category: 'charts',
          x: 60,
          y: 270,
          width: 860,
          height: 420,
          rotation: 0,
          zIndex: 4,
          style: { fill: 'rgba(6, 20, 24, 0.9)', stroke: '#10b981' },
          data: {
            datasetId: 'ds-energy-grid',
            mapping: {
              titleKey: '光伏出力 (kW) 与全厂用电负荷动态曲线',
              seriesKey: 'series_solar',
              categoriesKey: 'series_load',
              unitKey: 'kW'
            }
          }
        },
        {
          id: 'eng-pie-sources',
          name: '供电结构分布',
          type: 'chart-pie',
          category: 'charts',
          x: 950,
          y: 270,
          width: 900,
          height: 420,
          rotation: 0,
          zIndex: 4,
          style: { fill: 'rgba(6, 20, 24, 0.9)', stroke: '#06b6d4' },
          data: {
            datasetId: 'ds-energy-grid',
            mapping: {
              titleKey: '园区绿电与市网消纳配比',
              categoriesKey: 'series_tank_names',
              seriesKey: 'series_tank_compare',
              unitKey: '%'
            }
          }
        }
      ]
    }
  }
];

export const templates = PRESET_TEMPLATES.map(t => ({
  id: t.id,
  name: t.name,
  nameEn: t.nameEn,
  description: t.description,
  category: t.category,
  tags: t.tags,
  thumbnailGradient: t.thumbnailGradient,
  screen: t.schema.screen,
  components: t.schema.components,
  datasets: t.schema.datasets
}));

export const getTemplateById = (id: string) => {
  return templates.find(t => t.id === id);
};
