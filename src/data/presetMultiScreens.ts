import { ScreenItem } from '../types';
import { PV_HIGH_VOLTAGE_TEMPLATE } from './pvHighVoltageTemplate';

export const PRESET_MULTI_SCREENS: ScreenItem[] = [
  // Screen 0: 35kV高压光伏一次系统图 (全新高压光伏电力系统模板)
  {
    id: PV_HIGH_VOLTAGE_TEMPLATE.schema.screen.id || 'screen-pv-high-voltage',
    name: PV_HIGH_VOLTAGE_TEMPLATE.name,
    description: PV_HIGH_VOLTAGE_TEMPLATE.description || '35kV高压光伏一次系统图',
    screen: PV_HIGH_VOLTAGE_TEMPLATE.schema.screen,
    components: PV_HIGH_VOLTAGE_TEMPLATE.schema.components
  },
  // Screen 1: 10kV配电室一次系统接线图
  {
    id: 'screen-10kv-main',
    name: '10kV配电室一次系统接线图',
    description: '10kV I段与II段单母线分段接线系统，含进线柜、主变柜、母联备自投柜与馈线出线柜',
    screen: {
      id: 'screen-10kv-main',
      name: '10kV配电室一次系统接线图',
      width: 1980,
      height: 1100,
      backgroundColor: '#0f223d',
      backgroundGrid: true,
      gridSize: 20,
      gridColor: 'rgba(0, 242, 255, 0.22)',
      theme: 'cyber-dark',
      version: '2.0.0',
      updatedAt: new Date().toISOString()
    },
    components: [
      // 1. Title & Header
      {
        id: 'comp-main-title',
        name: 'SCADA主标题',
        type: 'draw-text',
        category: 'basic',
        x: 600,
        y: 84,
        width: 720,
        height: 50,
        rotation: 0,
        zIndex: 2,
        style: {
          text: '智能变电站 10kV 一次系统接线总览图',
          fontSize: 26,
          fontWeight: 'bold',
          textColor: '#00f2ff',
          textAlign: 'center'
        },
        data: { mapping: {} }
      },

      // 3. 10kV I段主母线
      {
        id: 'comp-busbar-1',
        name: '10kV I段工作母线',
        type: 'elec-busbar',
        category: 'electrical',
        x: 100,
        y: 220,
        width: 800,
        height: 64,
        rotation: 0,
        zIndex: 3,
        style: {
          stroke: '#ef4444',
          voltageLevel: '10kV',
          feederName: '10kV I段工作母线 (10.25kV / 50.02Hz)'
        },
        customProps: {
          name: '10kV I段母线',
          voltage: '10.25 kV',
          frequency: '50.02 Hz',
          isEnergized: true
        },
        data: {
          datasetId: 'ds-scada-station',
          mapping: {
            voltageKey: 'DEV-101_YC_1',
            frequencyKey: 'DEV-101_YC_10'
          }
        }
      },

      // 4. 10kV II段主母线
      {
        id: 'comp-busbar-2',
        name: '10kV II段工作母线',
        type: 'elec-busbar',
        category: 'electrical',
        x: 1020,
        y: 220,
        width: 800,
        height: 64,
        rotation: 0,
        zIndex: 3,
        style: {
          stroke: '#ef4444',
          voltageLevel: '10kV',
          feederName: '10kV II段工作母线 (10.26kV / 50.02Hz)'
        },
        customProps: {
          name: '10kV II段母线',
          voltage: '10.26 kV',
          frequency: '50.02 Hz',
          isEnergized: true
        },
        data: {
          datasetId: 'ds-scada-station',
          mapping: {
            voltageKey: 'DEV-103_YC_3',
            frequencyKey: 'DEV-101_YC_10'
          }
        }
      },

      // 5. 101 进线断路器 (I段进线, 0: 分闸, 1: 合闸, 2: 故障)
      {
        id: 'comp-breaker-101',
        name: '101 进线断路器 QF (0/1/2)',
        type: 'elec-breaker',
        category: 'electrical',
        x: 120,
        y: 340,
        width: 170,
        height: 160,
        rotation: 0,
        zIndex: 4,
        style: {
          fill: 'rgba(6, 14, 28, 0.92)',
          stroke: '#00f2ff',
          voltageLevel: '10kV',
          feederName: '101 进线断路器'
        },
        customProps: {
          state: 1, // 1: 合闸, 0: 分闸, 2: 故障
          feederName: '101 进线柜',
          current: '428.6 A'
        },
        data: {
          datasetId: 'ds-scada-station',
          mapping: {
            stateKey: 'DEV-101_YX_1',
            currentKey: 'DEV-101_YC_4'
          },
          action: {
            type: 'jump-screen',
            targetScreenId: 'screen-transformer-detail',
            label: '跳转至主变压器测控大屏'
          }
        }
      },

      // 6. 101 测控遥测浮点读数
      {
        id: 'comp-meter-101',
        name: '101 进线有功功率 (P)',
        type: 'metric-float',
        category: 'metrics',
        x: 120,
        y: 530,
        width: 240,
        height: 80,
        rotation: 0,
        zIndex: 4,
        style: {
          fill: 'rgba(6, 14, 28, 0.92)',
          stroke: '#00f2ff'
        },
        data: {
          datasetId: 'ds-scada-station',
          mapping: {
            deviceId: 'DEV-101',
            pointCategory: 'telemetry',
            pointId: 7,
            valueKey: 'DEV-101_YC_7',
            unitKey: 'kW'
          }
        }
      },

      // 7. 101 状态指示灯 (0/1/2)
      {
        id: 'comp-ind-101',
        name: '101 回路运行状态指示灯',
        type: 'ctrl-indicator',
        category: 'basic',
        x: 310,
        y: 350,
        width: 140,
        height: 40,
        rotation: 0,
        zIndex: 5,
        style: {
          indicatorShape: 'circle',
          indicatorState: 'normal',
          indicatorLabel: '101 合闸运行'
        },
        data: {
          datasetId: 'ds-scada-station',
          mapping: {
            statusKey: 'DEV-101_YX_1'
          }
        }
      },

      // 8. 遥控合分闸测试按钮
      {
        id: 'comp-btn-101-control',
        name: '101 遥控操作按钮',
        type: 'ctrl-button',
        category: 'basic',
        x: 310,
        y: 410,
        width: 130,
        height: 42,
        rotation: 0,
        zIndex: 5,
        style: {
          buttonText: '101 遥控下发',
          buttonColorTheme: 'cyan',
          buttonVariant: 'solid',
          borderRadius: 8
        },
        data: { mapping: {} }
      },

      // 9. 100 母联断路器 (0/1/2)
      {
        id: 'comp-breaker-100',
        name: '100 母联断路器 QF (0/1/2)',
        type: 'elec-breaker',
        category: 'electrical',
        x: 910,
        y: 340,
        width: 170,
        height: 160,
        rotation: 0,
        zIndex: 4,
        style: {
          fill: 'rgba(6, 14, 28, 0.92)',
          stroke: '#00f2ff',
          voltageLevel: '10kV',
          feederName: '100 母联备自投'
        },
        customProps: {
          state: 0, // 0: 分闸备用
          feederName: '100 母联柜'
        },
        data: {
          datasetId: 'ds-scada-station',
          mapping: {
            stateKey: 'DEV-103_YX_1',
            currentKey: 'DEV-103_YC_1'
          }
        }
      },

      // 10. 基础矢量图元展示: 矩形底板
      {
        id: 'comp-draw-rect-plate',
        name: '变电一次监控区域底板',
        type: 'draw-rect',
        category: 'basic',
        x: 80,
        y: 190,
        width: 1760,
        height: 600,
        rotation: 0,
        zIndex: 1,
        style: {
          fill: '#00f2ff',
          fillOpacity: 0.03,
          stroke: '#00f2ff',
          strokeWidth: 1,
          borderRadius: 12
        },
        data: { mapping: {} }
      },

      // 11. 基础多边形图元: 状态星标
      {
        id: 'comp-draw-star-mark',
        name: '重点监控节点星标',
        type: 'draw-star',
        category: 'basic',
        x: 80,
        y: 140,
        width: 36,
        height: 36,
        rotation: 0,
        zIndex: 5,
        style: {
          fill: '#f59e0b',
          fillOpacity: 0.4,
          stroke: '#f59e0b',
          strokeWidth: 2
        },
        data: { mapping: {} }
      }
    ]
  },

  // Screen 2: #1 主变压器测控画面
  {
    id: 'screen-transformer-detail',
    name: '#1主变压器及测控画面',
    description: '110kV/10kV #1主变压器绕组温度、高低压侧负荷、油温及瓦斯信号',
    screen: {
      id: 'screen-transformer-detail',
      name: '#1主变压器及测控画面',
      width: 1980,
      height: 1100,
      backgroundColor: '#0f223d',
      backgroundGrid: true,
      gridSize: 20,
      gridColor: 'rgba(0, 242, 255, 0.22)',
      theme: 'cyber-dark',
      version: '2.0.0',
      updatedAt: new Date().toISOString()
    },
    components: [
      {
        id: 'comp-tf-main',
        name: '#1 主变压器双绕组',
        type: 'elec-transformer',
        category: 'electrical',
        x: 200,
        y: 250,
        width: 180,
        height: 220,
        rotation: 0,
        zIndex: 3,
        style: {
          stroke: '#00f2ff',
          strokeWidth: 3,
          voltageLevel: '10kV'
        },
        data: { mapping: {} }
      },
      {
        id: 'comp-tf-temp-metric',
        name: '主变顶层油温遥测',
        type: 'metric-float',
        category: 'metrics',
        x: 460,
        y: 250,
        width: 220,
        height: 90,
        rotation: 0,
        zIndex: 4,
        style: {
          decimals: 1,
          suffix: ' ℃',
          fontSize: 26,
          textColor: '#00f2ff',
          stroke: '#00f2ff',
          fill: 'rgba(0, 242, 255, 0.1)'
        },
        data: {
          datasetId: 'ds-scada-station',
          mapping: {
            valueKey: 'DEV-102_YC_3'
          }
        }
      },
      {
        id: 'comp-tf-load-metric',
        name: '主变实时负荷率',
        type: 'metric-float',
        category: 'metrics',
        x: 460,
        y: 360,
        width: 220,
        height: 90,
        rotation: 0,
        zIndex: 4,
        style: {
          decimals: 1,
          suffix: ' %',
          fontSize: 26,
          textColor: '#00e5a3',
          stroke: '#00e5a3',
          fill: 'rgba(0, 229, 163, 0.1)'
        },
        data: {
          datasetId: 'ds-scada-station',
          mapping: {
            valueKey: 'DEV-102_YC_5'
          }
        }
      }
    ]
  },

  // Screen 3: 0.4kV 低压综合配电画面
  {
    id: 'screen-low-voltage-04kv',
    name: '0.4kV低压配电画面',
    description: '0.4kV 综合智能配电进线、电容无功自动补偿及动力支路用电',
    screen: {
      id: 'screen-low-voltage-04kv',
      name: '0.4kV低压配电画面',
      width: 1980,
      height: 1100,
      backgroundColor: '#0f223d',
      backgroundGrid: true,
      gridSize: 20,
      gridColor: 'rgba(0, 242, 255, 0.22)',
      theme: 'cyber-dark',
      version: '2.0.0',
      updatedAt: new Date().toISOString()
    },
    components: [
      {
        id: 'comp-low-meter',
        name: '201 低压总进线总有功 (P)',
        type: 'metric-float',
        category: 'metrics',
        x: 120,
        y: 240,
        width: 240,
        height: 80,
        rotation: 0,
        zIndex: 3,
        style: {
          fill: 'rgba(6, 14, 28, 0.92)',
          stroke: '#00f2ff'
        },
        data: {
          datasetId: 'ds-scada-station',
          mapping: {
            deviceId: 'DEV-201',
            pointCategory: 'telemetry',
            pointId: 1,
            valueKey: 'DEV-201_YC_1',
            unitKey: 'kW'
          }
        }
      }
    ]
  },

  // Screen 4: 全站电力遥测与告警
  {
    id: 'screen-telemetry-scada',
    name: '全站电力遥测与告警',
    description: '全站负荷趋势、事件告警滚屏与微电网新能源指标监控',
    screen: {
      id: 'screen-telemetry-scada',
      name: '全站电力遥测与告警',
      width: 1980,
      height: 1100,
      backgroundColor: '#0f223d',
      backgroundGrid: true,
      gridSize: 20,
      gridColor: 'rgba(0, 242, 255, 0.22)',
      theme: 'cyber-dark',
      version: '2.0.0',
      updatedAt: new Date().toISOString()
    },
    components: [
      {
        id: 'comp-chart-load-line',
        name: '24小时总用电负荷趋势',
        type: 'chart-line',
        category: 'charts',
        x: 100,
        y: 200,
        width: 600,
        height: 360,
        rotation: 0,
        zIndex: 3,
        style: {
          stroke: '#00f2ff'
        },
        data: {
          datasetId: 'ds-scada-station',
          mapping: {}
        }
      }
    ]
  }
];
