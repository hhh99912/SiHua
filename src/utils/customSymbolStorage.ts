import { CustomSymbolDef, ScreenComponent } from '../types';

const STORAGE_KEY = 'ge_scada_custom_symbols_v4';

export const PRESET_CUSTOM_SYMBOLS: CustomSymbolDef[] = [
  // 1. 真空断路器手车 (KYN28高压手车 QF，多态多位置标准图元)
  {
    id: 'symbol-elec-handcart-breaker',
    name: 'KYN28 抽出式断路器手车 QF (4态)',
    category: 'electrical',
    iconName: 'Zap',
    description: '标准高压开关柜抽出式真空断路器手车，含动静插头触头与手车导向标，支持工作位置合闸/工作位置分闸/试验位置/检修隔离4态',
    defaultWidth: 100,
    defaultHeight: 140,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2,
      borderRadius: 6
    },
    states: [
      {
        id: '1',
        name: '工作位置 (合闸/带电)',
        matchValue: 'work_closed',
        children: [
          // 上静触头插座（母线侧）
          {
            id: 'hc-static-top',
            name: '上静触头插座',
            type: 'draw-rect',
            category: 'basic',
            x: 44,
            y: 4,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(239, 68, 68, 0.4)', stroke: '#ef4444', strokeWidth: 2, borderRadius: 2 }
          },
          // 上动触头插头（咬合）
          {
            id: 'hc-plug-top',
            name: '上动触头插头',
            type: 'draw-line',
            category: 'basic',
            x: 47,
            y: 12,
            width: 6,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 20 }] }
          },
          // 手车活动底盘框
          {
            id: 'hc-chassis',
            name: '手车推入底盘',
            type: 'draw-rect',
            category: 'basic',
            x: 20,
            y: 28,
            width: 60,
            height: 76,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(15, 23, 42, 0.75)', stroke: '#ef4444', strokeWidth: 1.5, strokeDasharray: '4,3', borderRadius: 4 }
          },
          // 断路器灭弧室主体
          {
            id: 'hc-brk-box',
            name: '真空灭弧室',
            type: 'draw-rect',
            category: 'basic',
            x: 32,
            y: 42,
            width: 36,
            height: 44,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', strokeWidth: 2.5, borderRadius: 4 }
          },
          // 合闸交叉符号
          {
            id: 'hc-brk-text',
            name: '合闸符号',
            type: 'draw-text',
            category: 'basic',
            x: 36,
            y: 52,
            width: 28,
            height: 24,
            rotation: 0,
            zIndex: 4,
            style: { fill: 'transparent', fontSize: 16, textColor: '#ef4444', fontWeight: 'bold' }
          },
          // 手车导向箭头 (表示在工作位置)
          {
            id: 'hc-tag-work',
            name: '工作位置标牌',
            type: 'draw-text',
            category: 'basic',
            x: 22,
            y: 30,
            width: 56,
            height: 12,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'transparent', fontSize: 9, textColor: '#ef4444', fontWeight: 'bold' }
          },
          // 下动触头插头（咬合）
          {
            id: 'hc-plug-bot',
            name: '下动触头插头',
            type: 'draw-line',
            category: 'basic',
            x: 47,
            y: 100,
            width: 6,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 20 }] }
          },
          // 下静触头插座（出线侧）
          {
            id: 'hc-static-bot',
            name: '下静触头插座',
            type: 'draw-rect',
            category: 'basic',
            x: 44,
            y: 118,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(239, 68, 68, 0.4)', stroke: '#ef4444', strokeWidth: 2, borderRadius: 2 }
          }
        ]
      },
      {
        id: '2',
        name: '工作位置 (分闸/备用)',
        matchValue: 'work_open',
        children: [
          {
            id: 'hc-static-top-2',
            name: '上静触头插座',
            type: 'draw-rect',
            category: 'basic',
            x: 44,
            y: 4,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(16, 185, 129, 0.3)', stroke: '#10b981', strokeWidth: 2, borderRadius: 2 }
          },
          {
            id: 'hc-plug-top-2',
            name: '上动触头插头',
            type: 'draw-line',
            category: 'basic',
            x: 47,
            y: 12,
            width: 6,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 20 }] }
          },
          {
            id: 'hc-chassis-2',
            name: '手车推入底盘',
            type: 'draw-rect',
            category: 'basic',
            x: 20,
            y: 28,
            width: 60,
            height: 76,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(15, 23, 42, 0.75)', stroke: '#10b981', strokeWidth: 1.5, strokeDasharray: '4,3', borderRadius: 4 }
          },
          {
            id: 'hc-brk-box-2',
            name: '真空灭弧室',
            type: 'draw-rect',
            category: 'basic',
            x: 32,
            y: 42,
            width: 36,
            height: 44,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', strokeWidth: 2, borderRadius: 4 }
          },
          {
            id: 'hc-brk-text-2',
            name: '分闸符号',
            type: 'draw-text',
            category: 'basic',
            x: 36,
            y: 52,
            width: 28,
            height: 24,
            rotation: 0,
            zIndex: 4,
            style: { fill: 'transparent', fontSize: 16, textColor: '#10b981', fontWeight: 'bold' }
          },
          {
            id: 'hc-tag-work-2',
            name: '工作位置标牌',
            type: 'draw-text',
            category: 'basic',
            x: 22,
            y: 30,
            width: 56,
            height: 12,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'transparent', fontSize: 9, textColor: '#10b981', fontWeight: 'bold' }
          },
          {
            id: 'hc-plug-bot-2',
            name: '下动触头插头',
            type: 'draw-line',
            category: 'basic',
            x: 47,
            y: 100,
            width: 6,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 20 }] }
          },
          {
            id: 'hc-static-bot-2',
            name: '下静触头插座',
            type: 'draw-rect',
            category: 'basic',
            x: 44,
            y: 118,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(16, 185, 129, 0.3)', stroke: '#10b981', strokeWidth: 2, borderRadius: 2 }
          }
        ]
      },
      {
        id: '3',
        name: '试验位置 (触头脱离)',
        matchValue: 'test',
        children: [
          // 上静触头（带电/黄）
          {
            id: 'hc-static-top-3',
            name: '上静触头插座',
            type: 'draw-rect',
            category: 'basic',
            x: 44,
            y: 4,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(234, 179, 8, 0.2)', stroke: '#eab308', strokeWidth: 2, borderRadius: 2 }
          },
          // 上动触头（拉开有明显断开间隙 12px）
          {
            id: 'hc-plug-top-3',
            name: '上动触头插头(脱离)',
            type: 'draw-line',
            category: 'basic',
            x: 47,
            y: 22,
            width: 6,
            height: 14,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#eab308', strokeWidth: 2.5 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 14 }] }
          },
          // 手车底盘向左退回
          {
            id: 'hc-chassis-3',
            name: '试验位置手车',
            type: 'draw-rect',
            category: 'basic',
            x: 20,
            y: 34,
            width: 60,
            height: 70,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(15, 23, 42, 0.85)', stroke: '#eab308', strokeWidth: 1.5, strokeDasharray: '4,3', borderRadius: 4 }
          },
          {
            id: 'hc-brk-box-3',
            name: '真空灭弧室',
            type: 'draw-rect',
            category: 'basic',
            x: 32,
            y: 46,
            width: 36,
            height: 44,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'rgba(234, 179, 8, 0.15)', stroke: '#eab308', strokeWidth: 2, borderRadius: 4 }
          },
          {
            id: 'hc-tag-test',
            name: '试验位置标牌',
            type: 'draw-text',
            category: 'basic',
            x: 22,
            y: 35,
            width: 56,
            height: 12,
            rotation: 0,
            zIndex: 4,
            style: { fill: 'transparent', fontSize: 9, textColor: '#eab308', fontWeight: 'bold' }
          },
          {
            id: 'hc-plug-bot-3',
            name: '下动触头插头(脱离)',
            type: 'draw-line',
            category: 'basic',
            x: 47,
            y: 98,
            width: 6,
            height: 14,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#eab308', strokeWidth: 2.5 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 14 }] }
          },
          {
            id: 'hc-static-bot-3',
            name: '下静触头插座',
            type: 'draw-rect',
            category: 'basic',
            x: 44,
            y: 118,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(234, 179, 8, 0.2)', stroke: '#eab308', strokeWidth: 2, borderRadius: 2 }
          }
        ]
      },
      {
        id: '4',
        name: '检修位置 (手车抽出柜外)',
        matchValue: 'isolated',
        children: [
          {
            id: 'hc-static-top-4',
            name: '上静触头插座(遮蔽)',
            type: 'draw-rect',
            category: 'basic',
            x: 44,
            y: 4,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(100, 116, 139, 0.3)', stroke: '#64748b', strokeWidth: 2, borderRadius: 2 }
          },
          {
            id: 'hc-tag-iso',
            name: '检修标牌',
            type: 'draw-text',
            category: 'basic',
            x: 20,
            y: 55,
            width: 60,
            height: 24,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'transparent', fontSize: 13, textColor: '#94a3b8', fontWeight: 'bold' }
          },
          {
            id: 'hc-static-bot-4',
            name: '下静触头插座(遮蔽)',
            type: 'draw-rect',
            category: 'basic',
            x: 44,
            y: 118,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(100, 116, 139, 0.3)', stroke: '#64748b', strokeWidth: 2, borderRadius: 2 }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['手车', '断路器手车', 'KYN28', 'QF', '高压开关', '电力一次'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 2. 隔离手车 / 联络手车
  {
    id: 'symbol-elec-handcart-isolation',
    name: '高压隔离/联络手车 (双态)',
    category: 'electrical',
    iconName: 'Layers',
    description: '标准母线分段与母联柜高压隔离手车，具备直通铜排与抽出动静插头',
    defaultWidth: 90,
    defaultHeight: 130,
    type: 'composite-symbol',
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    states: [
      {
        id: '1',
        name: '工作位置 (导通)',
        matchValue: 'work',
        children: [
          {
            id: 'iso-hc-top',
            name: '上静触头',
            type: 'draw-rect',
            category: 'basic',
            x: 39,
            y: 4,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(239, 68, 68, 0.4)', stroke: '#ef4444', strokeWidth: 2, borderRadius: 2 }
          },
          {
            id: 'iso-hc-chassis',
            name: '隔离手车小车框',
            type: 'draw-rect',
            category: 'basic',
            x: 20,
            y: 20,
            width: 50,
            height: 80,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(15, 23, 42, 0.75)', stroke: '#ef4444', strokeWidth: 1.5, strokeDasharray: '4,3', borderRadius: 4 }
          },
          {
            id: 'iso-hc-busbar',
            name: '直通短路母排',
            type: 'draw-line',
            category: 'basic',
            x: 42,
            y: 12,
            width: 6,
            height: 98,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#ef4444', strokeWidth: 4 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 98 }] }
          },
          {
            id: 'iso-hc-bot',
            name: '下静触头',
            type: 'draw-rect',
            category: 'basic',
            x: 39,
            y: 112,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(239, 68, 68, 0.4)', stroke: '#ef4444', strokeWidth: 2, borderRadius: 2 }
          }
        ]
      },
      {
        id: '2',
        name: '试验/检修位置 (隔离断开)',
        matchValue: 'test',
        children: [
          {
            id: 'iso-hc-top-2',
            name: '上静触头',
            type: 'draw-rect',
            category: 'basic',
            x: 39,
            y: 4,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(100, 116, 139, 0.3)', stroke: '#64748b', strokeWidth: 2, borderRadius: 2 }
          },
          {
            id: 'iso-hc-chassis-2',
            name: '隔离手车小车框',
            type: 'draw-rect',
            category: 'basic',
            x: 20,
            y: 30,
            width: 50,
            height: 70,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(15, 23, 42, 0.85)', stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '4,3', borderRadius: 4 }
          },
          {
            id: 'iso-hc-bot-2',
            name: '下静触头',
            type: 'draw-rect',
            category: 'basic',
            x: 39,
            y: 112,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(100, 116, 139, 0.3)', stroke: '#64748b', strokeWidth: 2, borderRadius: 2 }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['隔离手车', '母联手车', '电力一次'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 3. 电压互感器与避雷器手车 PT & Arrester Handcart
  {
    id: 'symbol-elec-handcart-pt',
    name: 'PT / 避雷器抽出式手车',
    category: 'electrical',
    iconName: 'Activity',
    description: '母线电压互感器与避雷器一体式手车，带高压熔断器FU与一次绕组接地',
    defaultWidth: 100,
    defaultHeight: 140,
    type: 'composite-symbol',
    defaultStyle: { fill: 'transparent', stroke: '#38bdf8', strokeWidth: 2 },
    states: [
      {
        id: '1',
        name: '工作运行中',
        matchValue: 'work',
        children: [
          {
            id: 'pt-hc-top',
            name: '进线触头',
            type: 'draw-rect',
            category: 'basic',
            x: 44,
            y: 4,
            width: 12,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(56, 189, 248, 0.4)', stroke: '#38bdf8', strokeWidth: 2, borderRadius: 2 }
          },
          {
            id: 'pt-hc-chassis',
            name: 'PT手车底盘',
            type: 'draw-rect',
            category: 'basic',
            x: 18,
            y: 20,
            width: 64,
            height: 96,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(15, 23, 42, 0.8)', stroke: '#38bdf8', strokeWidth: 1.5, strokeDasharray: '4,3', borderRadius: 4 }
          },
          {
            id: 'pt-fuse-box',
            name: '高压熔断器FU',
            type: 'draw-rect',
            category: 'basic',
            x: 40,
            y: 26,
            width: 20,
            height: 28,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(56, 189, 248, 0.2)', stroke: '#38bdf8', strokeWidth: 2, borderRadius: 2 }
          },
          {
            id: 'pt-coil-primary',
            name: 'PT一次线圈',
            type: 'draw-circle',
            category: 'basic',
            x: 34,
            y: 58,
            width: 32,
            height: 32,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(56, 189, 248, 0.2)', stroke: '#38bdf8', strokeWidth: 2 }
          },
          {
            id: 'pt-coil-sec',
            name: 'PT二次线圈',
            type: 'draw-circle',
            category: 'basic',
            x: 34,
            y: 78,
            width: 32,
            height: 32,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'rgba(0, 229, 163, 0.2)', stroke: '#00e5a3', strokeWidth: 2 }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['PT手车', '互感器', '避雷器', '电力系统'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 4. 三绕组高压电力主变压器 TM (Three-Winding Transformer)
  {
    id: 'symbol-elec-transformer-3w',
    name: '三绕组主变压器 TM (高/中/低压)',
    category: 'electrical',
    iconName: 'Cpu',
    description: '标准大型三绕组电力变压器，三个正交相交线圈配星形/角形接线符号Y/Y/Δ',
    defaultWidth: 100,
    defaultHeight: 160,
    type: 'composite-symbol',
    defaultStyle: { fill: 'transparent', stroke: '#3b82f6', strokeWidth: 2 },
    states: [
      {
        id: '1',
        name: '正常运行 (带电)',
        matchValue: 'running',
        children: [
          {
            id: 'tm3-top-wire',
            name: '高压进线',
            type: 'draw-line',
            category: 'basic',
            x: 47,
            y: 4,
            width: 6,
            height: 20,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 20 }] }
          },
          {
            id: 'tm3-coil-1',
            name: '高压侧绕组(Y)',
            type: 'draw-circle',
            category: 'basic',
            x: 28,
            y: 20,
            width: 44,
            height: 44,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(239, 68, 68, 0.15)', stroke: '#ef4444', strokeWidth: 2.5 }
          },
          {
            id: 'tm3-coil-2',
            name: '中压侧绕组(Y)',
            type: 'draw-circle',
            category: 'basic',
            x: 28,
            y: 56,
            width: 44,
            height: 44,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'rgba(234, 179, 8, 0.15)', stroke: '#eab308', strokeWidth: 2.5 }
          },
          {
            id: 'tm3-coil-3',
            name: '低压侧绕组(Δ)',
            type: 'draw-circle',
            category: 'basic',
            x: 28,
            y: 92,
            width: 44,
            height: 44,
            rotation: 0,
            zIndex: 4,
            style: { fill: 'rgba(0, 242, 255, 0.15)', stroke: '#00f2ff', strokeWidth: 2.5 }
          },
          {
            id: 'tm3-bot-wire',
            name: '低压出线',
            type: 'draw-line',
            category: 'basic',
            x: 47,
            y: 134,
            width: 6,
            height: 22,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#00f2ff', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 22 }] }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['三绕组变压器', 'TM', '主变', '变电站'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 5. 光伏逆变升压一体机 (PV Inverter-Transformer)
  {
    id: 'symbol-pv-inverter-unit',
    name: '光伏逆变升压一体机 (DC/AC)',
    category: 'electrical',
    iconName: 'Zap',
    description: '集中式光伏电站逆变升压一体机，集直流输入、DC/AC逆变桥、正弦滤波与箱式升压变',
    defaultWidth: 160,
    defaultHeight: 120,
    type: 'composite-symbol',
    defaultStyle: { fill: 'rgba(6, 16, 32, 0.9)', stroke: '#00f2ff', strokeWidth: 2, borderRadius: 8 },
    states: [
      {
        id: '1',
        name: '并网发电运行 (绿)',
        matchValue: 'running',
        children: [
          {
            id: 'pv-inv-box',
            name: '逆变器外壳',
            type: 'draw-rect',
            category: 'basic',
            x: 8,
            y: 14,
            width: 70,
            height: 90,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(0, 242, 255, 0.12)', stroke: '#00f2ff', strokeWidth: 2, borderRadius: 6 }
          },
          {
            id: 'pv-inv-txt1',
            name: 'DC/AC标牌',
            type: 'draw-text',
            category: 'basic',
            x: 12,
            y: 28,
            width: 62,
            height: 18,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'transparent', fontSize: 11, textColor: '#00f2ff', fontWeight: 'bold' }
          },
          {
            id: 'pv-tf-coil1',
            name: '升压变低压圆',
            type: 'draw-circle',
            category: 'basic',
            x: 95,
            y: 26,
            width: 44,
            height: 44,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(16, 185, 129, 0.2)', stroke: '#10b981', strokeWidth: 2 }
          },
          {
            id: 'pv-tf-coil2',
            name: '升压变高压圆',
            type: 'draw-circle',
            category: 'basic',
            x: 95,
            y: 52,
            width: 44,
            height: 44,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'rgba(239, 68, 68, 0.2)', stroke: '#ef4444', strokeWidth: 2 }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['光伏', '逆变器', '升压变', '一体机'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 6. 双向储能变流器 (BESS Storage PCS)
  {
    id: 'symbol-bess-pcs',
    name: '双向储能变流器 PCS (充/放/停)',
    category: 'electrical',
    iconName: 'Activity',
    description: '电化学储能电站核心双向变流器 PCS，支持双向能量流向显示、充电/放电/待机状态',
    defaultWidth: 150,
    defaultHeight: 110,
    type: 'composite-symbol',
    defaultStyle: { fill: 'rgba(6, 16, 32, 0.9)', stroke: '#10b981', strokeWidth: 2, borderRadius: 8 },
    states: [
      {
        id: '1',
        name: '放电状态 (向电网送电)',
        matchValue: 'discharge',
        children: [
          {
            id: 'pcs-body',
            name: 'PCS机柜',
            type: 'draw-rect',
            category: 'basic',
            x: 10,
            y: 10,
            width: 130,
            height: 90,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', strokeWidth: 2, borderRadius: 6 }
          },
          {
            id: 'pcs-txt',
            name: 'PCS标识',
            type: 'draw-text',
            category: 'basic',
            x: 20,
            y: 20,
            width: 110,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'transparent', fontSize: 13, textColor: '#10b981', fontWeight: 'bold' }
          },
          {
            id: 'pcs-arrow-right',
            name: '放电能量流向',
            type: 'draw-arrow',
            category: 'basic',
            x: 25,
            y: 52,
            width: 100,
            height: 28,
            rotation: 0,
            zIndex: 3,
            style: { fill: '#10b981', stroke: '#10b981', strokeWidth: 2 }
          }
        ]
      },
      {
        id: '2',
        name: '充电状态 (吸收电网电能)',
        matchValue: 'charge',
        children: [
          {
            id: 'pcs-body-2',
            name: 'PCS机柜',
            type: 'draw-rect',
            category: 'basic',
            x: 10,
            y: 10,
            width: 130,
            height: 90,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(56, 189, 248, 0.15)', stroke: '#38bdf8', strokeWidth: 2, borderRadius: 6 }
          },
          {
            id: 'pcs-arrow-left',
            name: '充电能量流向',
            type: 'draw-arrow',
            category: 'basic',
            x: 25,
            y: 52,
            width: 100,
            height: 28,
            rotation: 180,
            zIndex: 3,
            style: { fill: '#38bdf8', stroke: '#38bdf8', strokeWidth: 2 }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['储能', 'PCS', '变流器', '充放电'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 7. 真空断路器 QF (三态多状态图元)
  {
    id: 'symbol-elec-breaker',
    name: '真空断路器 QF (三态)',
    category: 'electrical',
    iconName: 'Zap',
    description: '工业级高压真空断路器，支持合闸(红)、分闸(绿)与故障跳闸(黄)三态',
    defaultWidth: 90,
    defaultHeight: 110,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2,
      borderRadius: 6
    },
    states: [
      {
        id: '1',
        name: '状态 1 (合闸 / 运行)',
        matchValue: 'closed',
        children: [
          // Top Lead Line
          {
            id: 'brk-line-top',
            name: '上引线',
            type: 'draw-line',
            category: 'basic',
            x: 42,
            y: 5,
            width: 6,
            height: 25,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 25 }] }
          },
          // Breaker Body Box
          {
            id: 'brk-box',
            name: '灭弧室主体',
            type: 'draw-rect',
            category: 'basic',
            x: 25,
            y: 30,
            width: 40,
            height: 44,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', strokeWidth: 2.5, borderRadius: 4 }
          },
          // Closed Cross / Contact inside
          {
            id: 'brk-text',
            name: '合闸符号',
            type: 'draw-text',
            category: 'basic',
            x: 31,
            y: 40,
            width: 28,
            height: 24,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'transparent', fontSize: 16, textColor: '#ef4444', fontWeight: 'bold' }
          },
          // Bottom Lead Line
          {
            id: 'brk-line-bot',
            name: '下引线',
            type: 'draw-line',
            category: 'basic',
            x: 42,
            y: 74,
            width: 6,
            height: 25,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 25 }] }
          }
        ]
      },
      {
        id: '2',
        name: '状态 2 (分闸 / 备用)',
        matchValue: 'open',
        children: [
          // Top Lead Line
          {
            id: 'brk-line-top-2',
            name: '上引线',
            type: 'draw-line',
            category: 'basic',
            x: 42,
            y: 5,
            width: 6,
            height: 25,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 25 }] }
          },
          // Breaker Body Box
          {
            id: 'brk-box-2',
            name: '灭弧室主体',
            type: 'draw-rect',
            category: 'basic',
            x: 25,
            y: 30,
            width: 40,
            height: 44,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', strokeWidth: 2, borderRadius: 4 }
          },
          // Open text
          {
            id: 'brk-text-2',
            name: '分闸符号',
            type: 'draw-text',
            category: 'basic',
            x: 31,
            y: 40,
            width: 28,
            height: 24,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'transparent', fontSize: 16, textColor: '#10b981', fontWeight: 'bold' }
          },
          // Bottom Lead Line
          {
            id: 'brk-line-bot-2',
            name: '下引线',
            type: 'draw-line',
            category: 'basic',
            x: 42,
            y: 74,
            width: 6,
            height: 25,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 25 }] }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['断路器', 'QF', '高压开关', '电力系统'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 2. 隔离开关 / 刀闸 QS
  {
    id: 'symbol-elec-disconnector',
    name: '隔离开关 / 刀闸 QS',
    category: 'electrical',
    iconName: 'ZapOff',
    description: '母线及出线高压隔离开关刀闸，支持合闸导通与分闸明显断开间隙',
    defaultWidth: 70,
    defaultHeight: 90,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '状态 1 (合闸 / 导通)',
        matchValue: 'closed',
        children: [
          // Top Wire
          {
            id: 'iso-top',
            name: '上导线',
            type: 'draw-line',
            category: 'basic',
            x: 32,
            y: 5,
            width: 6,
            height: 25,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 25 }] }
          },
          // Contact Point Top
          {
            id: 'iso-contact-top',
            name: '静触头',
            type: 'draw-circle',
            category: 'basic',
            x: 29,
            y: 28,
            width: 12,
            height: 12,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 2 }
          },
          // Closed Blade Line
          {
            id: 'iso-blade-closed',
            name: '合闸动触头',
            type: 'draw-line',
            category: 'basic',
            x: 32,
            y: 35,
            width: 6,
            height: 26,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 26 }] }
          },
          // Contact Point Bot
          {
            id: 'iso-contact-bot',
            name: '动触头轴',
            type: 'draw-circle',
            category: 'basic',
            x: 29,
            y: 58,
            width: 12,
            height: 12,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 2 }
          },
          // Bottom Wire
          {
            id: 'iso-bot',
            name: '下导线',
            type: 'draw-line',
            category: 'basic',
            x: 32,
            y: 65,
            width: 6,
            height: 20,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 20 }] }
          }
        ]
      },
      {
        id: '2',
        name: '状态 2 (分闸 / 断开)',
        matchValue: 'open',
        children: [
          // Top Wire
          {
            id: 'iso-top-2',
            name: '上导线',
            type: 'draw-line',
            category: 'basic',
            x: 32,
            y: 5,
            width: 6,
            height: 25,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 25 }] }
          },
          // Contact Point Top
          {
            id: 'iso-contact-top-2',
            name: '静触头',
            type: 'draw-circle',
            category: 'basic',
            x: 29,
            y: 28,
            width: 12,
            height: 12,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#10b981', stroke: '#10b981', strokeWidth: 2 }
          },
          // Open 45 deg Blade Line
          {
            id: 'iso-blade-open',
            name: '分闸刀闸(倾斜断开)',
            type: 'draw-line',
            category: 'basic',
            x: 33,
            y: 35,
            width: 25,
            height: 28,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 1, yRatio: 0, x: 25, y: 0 }, { xRatio: 0, yRatio: 1, x: 0, y: 28 }] }
          },
          // Contact Point Bot
          {
            id: 'iso-contact-bot-2',
            name: '动触头轴',
            type: 'draw-circle',
            category: 'basic',
            x: 29,
            y: 58,
            width: 12,
            height: 12,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#10b981', stroke: '#10b981', strokeWidth: 2 }
          },
          // Bottom Wire
          {
            id: 'iso-bot-2',
            name: '下导线',
            type: 'draw-line',
            category: 'basic',
            x: 32,
            y: 65,
            width: 6,
            height: 20,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 20 }] }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['隔离开关', '刀闸', 'QS', '电力系统'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 3. 快速接地刀闸 QE
  {
    id: 'symbol-elec-grounding',
    name: '快速接地刀闸 QE',
    category: 'electrical',
    iconName: 'Minus',
    description: '出线及检修接地开关刀闸，带三段分级接地符号',
    defaultWidth: 70,
    defaultHeight: 90,
    type: 'composite-symbol',
    defaultStyle: { fill: 'transparent', stroke: '#64748b', strokeWidth: 2 },
    states: [
      {
        id: '1',
        name: '状态 1 (分闸 / 隔离)',
        matchValue: 'open',
        children: [
          // Contact Point
          {
            id: 'gnd-contact',
            name: '触头',
            type: 'draw-circle',
            category: 'basic',
            x: 29,
            y: 10,
            width: 12,
            height: 12,
            rotation: 0,
            zIndex: 1,
            style: { fill: '#64748b', stroke: '#64748b', strokeWidth: 2 }
          },
          // Open Blade
          {
            id: 'gnd-blade-open',
            name: '分闸接地动触头',
            type: 'draw-line',
            category: 'basic',
            x: 33,
            y: 20,
            width: 24,
            height: 26,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#64748b', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 1, yRatio: 0, x: 24, y: 0 }, { xRatio: 0, yRatio: 1, x: 0, y: 26 }] }
          },
          // Ground Axis
          {
            id: 'gnd-axis',
            name: '接地轴点',
            type: 'draw-circle',
            category: 'basic',
            x: 29,
            y: 44,
            width: 12,
            height: 12,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#64748b', stroke: '#64748b', strokeWidth: 2 }
          },
          // Ground Bar 1
          {
            id: 'gnd-bar-1',
            name: '接地排1',
            type: 'draw-line',
            category: 'basic',
            x: 15,
            y: 58,
            width: 40,
            height: 6,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#64748b', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 3 }, { xRatio: 1, yRatio: 0.5, x: 40, y: 3 }] }
          },
          // Ground Bar 2
          {
            id: 'gnd-bar-2',
            name: '接地排2',
            type: 'draw-line',
            category: 'basic',
            x: 22,
            y: 67,
            width: 26,
            height: 6,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#64748b', strokeWidth: 2.5 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 3 }, { xRatio: 1, yRatio: 0.5, x: 26, y: 3 }] }
          },
          // Ground Bar 3
          {
            id: 'gnd-bar-3',
            name: '接地排3',
            type: 'draw-line',
            category: 'basic',
            x: 29,
            y: 75,
            width: 12,
            height: 6,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#64748b', strokeWidth: 2 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 3 }, { xRatio: 1, yRatio: 0.5, x: 12, y: 3 }] }
          }
        ]
      },
      {
        id: '2',
        name: '状态 2 (合闸接地 / 检修)',
        matchValue: 'closed',
        children: [
          // Contact Point
          {
            id: 'gnd-contact-2',
            name: '触头',
            type: 'draw-circle',
            category: 'basic',
            x: 29,
            y: 10,
            width: 12,
            height: 12,
            rotation: 0,
            zIndex: 1,
            style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 2 }
          },
          // Closed Blade
          {
            id: 'gnd-blade-closed',
            name: '合闸接地刀闸',
            type: 'draw-line',
            category: 'basic',
            x: 32,
            y: 18,
            width: 6,
            height: 30,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#ef4444', strokeWidth: 3.5 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 30 }] }
          },
          // Ground Bar 1
          {
            id: 'gnd-bar-1-c',
            name: '接地排1',
            type: 'draw-line',
            category: 'basic',
            x: 15,
            y: 58,
            width: 40,
            height: 6,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 3 }, { xRatio: 1, yRatio: 0.5, x: 40, y: 3 }] }
          },
          // Ground Bar 2
          {
            id: 'gnd-bar-2-c',
            name: '接地排2',
            type: 'draw-line',
            category: 'basic',
            x: 22,
            y: 67,
            width: 26,
            height: 6,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 2.5 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 3 }, { xRatio: 1, yRatio: 0.5, x: 26, y: 3 }] }
          },
          // Ground Bar 3
          {
            id: 'gnd-bar-3-c',
            name: '接地排3',
            type: 'draw-line',
            category: 'basic',
            x: 29,
            y: 75,
            width: 12,
            height: 6,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 2 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 3 }, { xRatio: 1, yRatio: 0.5, x: 12, y: 3 }] }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['接地开关', 'QE', '检修接地', '电力系统'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 4. 双绕组主电力变压器 TM
  {
    id: 'symbol-elec-transformer',
    name: '主变压器 TM (双绕组)',
    category: 'electrical',
    iconName: 'Cpu',
    description: '电力主变压器，由高低压交叠双圆与引线构成的标准电气符号',
    defaultWidth: 90,
    defaultHeight: 130,
    type: 'composite-symbol',
    defaultStyle: { fill: 'transparent', stroke: '#3b82f6', strokeWidth: 2 },
    states: [
      {
        id: '1',
        name: '状态 1 (正常运行)',
        children: [
          // Top Wire
          {
            id: 'tm-wire-top',
            name: '高压进线',
            type: 'draw-line',
            category: 'basic',
            x: 42,
            y: 5,
            width: 6,
            height: 25,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 25 }] }
          },
          // Primary Coil Top Circle
          {
            id: 'tm-coil-1',
            name: '一次侧绕组',
            type: 'draw-circle',
            category: 'basic',
            x: 23,
            y: 26,
            width: 44,
            height: 44,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(239, 68, 68, 0.15)', stroke: '#ef4444', strokeWidth: 2.5 }
          },
          // Secondary Coil Bottom Circle
          {
            id: 'tm-coil-2',
            name: '二次侧绕组',
            type: 'draw-circle',
            category: 'basic',
            x: 23,
            y: 56,
            width: 44,
            height: 44,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'rgba(0, 242, 255, 0.15)', stroke: '#00f2ff', strokeWidth: 2.5 }
          },
          // Bottom Wire
          {
            id: 'tm-wire-bot',
            name: '低压出线',
            type: 'draw-line',
            category: 'basic',
            x: 42,
            y: 98,
            width: 6,
            height: 25,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#00f2ff', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 25 }] }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['变压器', 'TM', '双绕组', '电力系统'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 5. 电流互感器 CT / TA
  {
    id: 'symbol-elec-ct',
    name: '电流互感器 CT / TA',
    category: 'electrical',
    iconName: 'CircleDot',
    description: '穿心式电流采样互感器，由母线导线穿过感应环构成',
    defaultWidth: 70,
    defaultHeight: 80,
    type: 'composite-symbol',
    defaultStyle: { fill: 'transparent', stroke: '#38bdf8', strokeWidth: 2 },
    states: [
      {
        id: '1',
        name: '状态 1 (采样测量中)',
        children: [
          // Pass-through Conductor
          {
            id: 'ct-line',
            name: '一次穿心导线',
            type: 'draw-line',
            category: 'basic',
            x: 32,
            y: 5,
            width: 6,
            height: 70,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 3.5 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 70 }] }
          },
          // Sensor Coil Ring
          {
            id: 'ct-ring',
            name: '采样线圈',
            type: 'draw-circle',
            category: 'basic',
            x: 18,
            y: 24,
            width: 34,
            height: 34,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(56, 189, 248, 0.25)', stroke: '#38bdf8', strokeWidth: 2.5 }
          },
          // Dot marker
          {
            id: 'ct-dot',
            name: '极性同名端',
            type: 'draw-circle',
            category: 'basic',
            x: 48,
            y: 26,
            width: 8,
            height: 8,
            rotation: 0,
            zIndex: 3,
            style: { fill: '#38bdf8', stroke: '#38bdf8', strokeWidth: 1 }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['电流互感器', 'CT', 'TA', '采样测量'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 6. 氧化锌避雷器 F
  {
    id: 'symbol-elec-arrester',
    name: '氧化锌避雷器 F',
    category: 'electrical',
    iconName: 'ZapOff',
    description: '防雷过电压保护避雷器，带非线性电阻箱与接地符号',
    defaultWidth: 70,
    defaultHeight: 90,
    type: 'composite-symbol',
    defaultStyle: { fill: 'transparent', stroke: '#f59e0b', strokeWidth: 2 },
    states: [
      {
        id: '1',
        name: '状态 1 (防护中)',
        children: [
          // Lead Top
          {
            id: 'arr-line-top',
            name: '进线',
            type: 'draw-line',
            category: 'basic',
            x: 32,
            y: 5,
            width: 6,
            height: 18,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#f59e0b', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 18 }] }
          },
          // Resistor Box
          {
            id: 'arr-box',
            name: '阀片电阻箱',
            type: 'draw-rect',
            category: 'basic',
            x: 20,
            y: 22,
            width: 30,
            height: 40,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(245, 158, 11, 0.2)', stroke: '#f59e0b', strokeWidth: 2, borderRadius: 3 }
          },
          // Zigzag line inside
          {
            id: 'arr-text',
            name: '避雷符号',
            type: 'draw-text',
            category: 'basic',
            x: 24,
            y: 28,
            width: 22,
            height: 24,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'transparent', fontSize: 16, textColor: '#f59e0b', fontWeight: 'bold' }
          },
          // Ground Bar
          {
            id: 'arr-gnd-1',
            name: '接地排',
            type: 'draw-line',
            category: 'basic',
            x: 18,
            y: 68,
            width: 34,
            height: 6,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#f59e0b', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 3 }, { xRatio: 1, yRatio: 0.5, x: 34, y: 3 }] }
          },
          {
            id: 'arr-gnd-2',
            name: '接地排2',
            type: 'draw-line',
            category: 'basic',
            x: 25,
            y: 76,
            width: 20,
            height: 6,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#f59e0b', strokeWidth: 2 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 3 }, { xRatio: 1, yRatio: 0.5, x: 20, y: 3 }] }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['避雷器', '过电压', '电力保护'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 7. 高低压主母线段 (Busbar)
  {
    id: 'symbol-elec-busbar',
    name: '高低压主母线段 (Busbar)',
    category: 'electrical',
    iconName: 'Minus',
    description: '工业铜排主母线，带高亮边缘与引线节点',
    defaultWidth: 260,
    defaultHeight: 40,
    type: 'composite-symbol',
    defaultStyle: { fill: 'transparent', stroke: '#ef4444', strokeWidth: 6 },
    states: [
      {
        id: '1',
        name: '状态 1 (带电运行)',
        children: [
          // Main thick busbar
          {
            id: 'bus-main-bar',
            name: '10kV I段母线排',
            type: 'draw-line',
            category: 'basic',
            x: 5,
            y: 12,
            width: 250,
            height: 12,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 6, lineStyle: 'solid' },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 6 }, { xRatio: 1, yRatio: 0.5, x: 250, y: 6 }] }
          },
          // Node 1
          {
            id: 'bus-node-1',
            name: '引出节点1',
            type: 'draw-circle',
            category: 'basic',
            x: 45,
            y: 11,
            width: 14,
            height: 14,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }
          },
          // Node 2
          {
            id: 'bus-node-2',
            name: '引出节点2',
            type: 'draw-circle',
            category: 'basic',
            x: 125,
            y: 11,
            width: 14,
            height: 14,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }
          },
          // Node 3
          {
            id: 'bus-node-3',
            name: '引出节点3',
            type: 'draw-circle',
            category: 'basic',
            x: 205,
            y: 11,
            width: 14,
            height: 14,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['母线', 'Busbar', '10kV', '电力系统'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 8. 工业储罐 (Fluid Storage Tank)
  {
    id: 'symbol-ind-tank',
    name: '工业储罐 / 储液槽',
    category: 'industrial',
    iconName: 'Database',
    description: '工业圆柱形储液罐，带封头弧线与液位指示',
    defaultWidth: 100,
    defaultHeight: 140,
    type: 'composite-symbol',
    defaultStyle: { fill: 'transparent', stroke: '#0284c7', strokeWidth: 2 },
    states: [
      {
        id: '1',
        name: '状态 1 (储液中)',
        children: [
          // Tank Base Rect
          {
            id: 'tank-body',
            name: '储罐主体',
            type: 'draw-rect',
            category: 'basic',
            x: 10,
            y: 20,
            width: 80,
            height: 100,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(14, 165, 233, 0.15)', stroke: '#0ea5e9', strokeWidth: 2, borderRadius: 12 }
          },
          // Fluid Level Fill
          {
            id: 'tank-fluid',
            name: '罐内液位',
            type: 'draw-rect',
            category: 'basic',
            x: 14,
            y: 55,
            width: 72,
            height: 60,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(14, 165, 233, 0.5)', stroke: '#38bdf8', strokeWidth: 1, borderRadius: 6 }
          },
          // Level Metric
          {
            id: 'tank-metric',
            name: '液位遥测',
            type: 'metric-float',
            category: 'metrics',
            x: 15,
            y: 65,
            width: 70,
            height: 24,
            rotation: 0,
            zIndex: 3,
            style: { textColor: '#ffffff', fontSize: 13, decimals: 1, suffix: 'm', fill: 'transparent' }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['储罐', '液位', '工业SCADA'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 9. 工业加压泵 (Pressure Pump / Motor)
  {
    id: 'symbol-ind-pump',
    name: '离心泵 / 加压泵',
    category: 'industrial',
    iconName: 'Activity',
    description: '工业离心泵符号，由圆形泵壳与切向出水口构成',
    defaultWidth: 90,
    defaultHeight: 90,
    type: 'composite-symbol',
    defaultStyle: { fill: 'transparent', stroke: '#10b981', strokeWidth: 2 },
    states: [
      {
        id: '1',
        name: '状态 1 (运行 / 绿色)',
        matchValue: 'running',
        children: [
          // Pump Casing Circle
          {
            id: 'pump-casing',
            name: '泵壳体',
            type: 'draw-circle',
            category: 'basic',
            x: 15,
            y: 20,
            width: 55,
            height: 55,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(16, 185, 129, 0.2)', stroke: '#10b981', strokeWidth: 2.5 }
          },
          // Discharge Nozzle
          {
            id: 'pump-nozzle',
            name: '切向出水口',
            type: 'draw-line',
            category: 'basic',
            x: 42,
            y: 6,
            width: 40,
            height: 18,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0, yRatio: 1, x: 0, y: 18 }, { xRatio: 1, yRatio: 0, x: 40, y: 0 }] }
          },
          // Center Impeller
          {
            id: 'pump-impeller',
            name: '叶轮中心',
            type: 'draw-circle',
            category: 'basic',
            x: 36,
            y: 41,
            width: 14,
            height: 14,
            rotation: 0,
            zIndex: 3,
            style: { fill: '#10b981', stroke: '#fff', strokeWidth: 1.5 }
          }
        ]
      },
      {
        id: '2',
        name: '状态 2 (停机 / 灰色)',
        matchValue: 'stopped',
        children: [
          {
            id: 'pump-casing-2',
            name: '泵壳体',
            type: 'draw-circle',
            category: 'basic',
            x: 15,
            y: 20,
            width: 55,
            height: 55,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(100, 116, 139, 0.2)', stroke: '#64748b', strokeWidth: 2 }
          },
          {
            id: 'pump-nozzle-2',
            name: '切向出水口',
            type: 'draw-line',
            category: 'basic',
            x: 42,
            y: 6,
            width: 40,
            height: 18,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#64748b', strokeWidth: 2.5 },
            customProps: { points: [{ xRatio: 0, yRatio: 1, x: 0, y: 18 }, { xRatio: 1, yRatio: 0, x: 40, y: 0 }] }
          },
          {
            id: 'pump-impeller-2',
            name: '叶轮中心',
            type: 'draw-circle',
            category: 'basic',
            x: 36,
            y: 41,
            width: 14,
            height: 14,
            rotation: 0,
            zIndex: 3,
            style: { fill: '#64748b', stroke: '#94a3b8', strokeWidth: 1 }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['水泵', '电机', '工业SCADA'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 10. 电动调节阀 (Control Valve)
  {
    id: 'symbol-ind-valve',
    name: '电动调节阀 / 蝶阀',
    category: 'industrial',
    iconName: 'ToggleRight',
    description: '标准双三角形对置调节阀门，带执行机构顶座',
    defaultWidth: 80,
    defaultHeight: 70,
    type: 'composite-symbol',
    defaultStyle: { fill: 'transparent', stroke: '#38bdf8', strokeWidth: 2 },
    states: [
      {
        id: '1',
        name: '状态 1 (开启 / 导通)',
        matchValue: 'open',
        children: [
          // Actuator Stem
          {
            id: 'valve-stem',
            name: '执行器立柱',
            type: 'draw-line',
            category: 'basic',
            x: 37,
            y: 10,
            width: 6,
            height: 24,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 24 }] }
          },
          // Actuator Top Box
          {
            id: 'valve-actuator',
            name: '电动执行器',
            type: 'draw-rect',
            category: 'basic',
            x: 26,
            y: 6,
            width: 28,
            height: 14,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(16, 185, 129, 0.3)', stroke: '#10b981', strokeWidth: 2, borderRadius: 2 }
          },
          // Left Triangle / Flange
          {
            id: 'valve-left-flange',
            name: '左阀芯',
            type: 'draw-polygon',
            category: 'basic',
            x: 10,
            y: 28,
            width: 30,
            height: 30,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(16, 185, 129, 0.25)', stroke: '#10b981', strokeWidth: 2 }
          },
          // Right Triangle / Flange
          {
            id: 'valve-right-flange',
            name: '右阀芯',
            type: 'draw-polygon',
            category: 'basic',
            x: 40,
            y: 28,
            width: 30,
            height: 30,
            rotation: 180,
            zIndex: 2,
            style: { fill: 'rgba(16, 185, 129, 0.25)', stroke: '#10b981', strokeWidth: 2 }
          }
        ]
      },
      {
        id: '2',
        name: '状态 2 (关闭 / 截断)',
        matchValue: 'closed',
        children: [
          // Actuator Stem
          {
            id: 'valve-stem-2',
            name: '执行器立柱',
            type: 'draw-line',
            category: 'basic',
            x: 37,
            y: 10,
            width: 6,
            height: 24,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 3, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 3, y: 24 }] }
          },
          // Actuator Top Box
          {
            id: 'valve-actuator-2',
            name: '电动执行器',
            type: 'draw-rect',
            category: 'basic',
            x: 26,
            y: 6,
            width: 28,
            height: 14,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444', strokeWidth: 2, borderRadius: 2 }
          },
          // Left Triangle
          {
            id: 'valve-left-flange-2',
            name: '左阀芯',
            type: 'draw-polygon',
            category: 'basic',
            x: 10,
            y: 28,
            width: 30,
            height: 30,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', strokeWidth: 2 }
          },
          // Right Triangle
          {
            id: 'valve-right-flange-2',
            name: '右阀芯',
            type: 'draw-polygon',
            category: 'basic',
            x: 40,
            y: 28,
            width: 30,
            height: 30,
            rotation: 180,
            zIndex: 2,
            style: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', strokeWidth: 2 }
          }
        ]
      }
    ],
    activeStateId: '1',
    tags: ['调节阀', '电动阀', '截断阀', '工业管道'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 11. 10kV 出线间隔综合图元 (组合图元)
  {
    id: 'symbol-scada-feeder-bay',
    name: '10kV 典型断路器出线间隔组合',
    category: 'custom',
    iconName: 'Zap',
    description: '由高压母线段、隔离开关、断路器、电流互感器、浮点数测控表及指示灯组合而成的纯图元组合体',
    defaultWidth: 220,
    defaultHeight: 340,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'rgba(6, 14, 28, 0.95)',
      stroke: '#00f2ff',
      strokeWidth: 1.5,
      borderRadius: 12
    },
    children: [
      {
        id: 'c-bus',
        name: '10kV母线段',
        type: 'draw-line',
        category: 'basic',
        x: 10,
        y: 15,
        width: 200,
        height: 12,
        rotation: 0,
        zIndex: 1,
        style: { stroke: '#ef4444', strokeWidth: 6 },
        customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 6 }, { xRatio: 1, yRatio: 0.5, x: 200, y: 6 }] }
      },
      {
        id: 'c-iso',
        name: '母线隔离开关 QS',
        type: 'draw-rect',
        category: 'basic',
        x: 75,
        y: 35,
        width: 70,
        height: 50,
        rotation: 0,
        zIndex: 2,
        style: { fill: 'rgba(239, 68, 68, 0.2)', stroke: '#ef4444', strokeWidth: 2, borderRadius: 4 }
      },
      {
        id: 'c-brk',
        name: '真空断路器 QF',
        type: 'draw-rect',
        category: 'basic',
        x: 55,
        y: 100,
        width: 110,
        height: 80,
        rotation: 0,
        zIndex: 3,
        style: { fill: 'rgba(0, 242, 255, 0.2)', stroke: '#00f2ff', strokeWidth: 2, borderRadius: 6 }
      },
      {
        id: 'c-ct',
        name: '互感采样 TA',
        type: 'draw-circle',
        category: 'basic',
        x: 88,
        y: 195,
        width: 44,
        height: 44,
        rotation: 0,
        zIndex: 4,
        style: { fill: 'rgba(56, 189, 248, 0.25)', stroke: '#38bdf8', strokeWidth: 2 }
      },
      {
        id: 'c-float-current',
        name: '出线电流表',
        type: 'metric-float',
        category: 'metrics',
        x: 20,
        y: 260,
        width: 180,
        height: 40,
        rotation: 0,
        zIndex: 5,
        style: { fill: 'rgba(4, 9, 20, 0.9)', textColor: '#00f2ff', suffix: ' A', decimals: 2 }
      }
    ],
    tags: ['组合图元', '10kV间隔', '断路器柜'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export function getCustomSymbols(): CustomSymbolDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveCustomSymbols(PRESET_CUSTOM_SYMBOLS);
      return PRESET_CUSTOM_SYMBOLS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : PRESET_CUSTOM_SYMBOLS;
  } catch (e) {
    console.error('Failed to load custom symbols:', e);
    return PRESET_CUSTOM_SYMBOLS;
  }
}

export function saveCustomSymbols(symbols: CustomSymbolDef[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scada:custom-symbols-updated'));
    }
  } catch (e) {
    console.error('Failed to save custom symbols:', e);
  }
}

export function addCustomSymbol(symbol: CustomSymbolDef): CustomSymbolDef[] {
  const list = getCustomSymbols();
  const existingIdx = list.findIndex(s => s.id === symbol.id);
  if (existingIdx !== -1) {
    list[existingIdx] = { ...symbol, updatedAt: new Date().toISOString() };
  } else {
    list.unshift({ ...symbol, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  saveCustomSymbols(list);
  return list;
}

export function updateCustomSymbol(symbol: CustomSymbolDef): CustomSymbolDef[] {
  return addCustomSymbol(symbol);
}

export function deleteCustomSymbol(id: string): CustomSymbolDef[] {
  const list = getCustomSymbols().filter(s => s.id !== id);
  saveCustomSymbols(list);
  return list;
}

export function removeCustomSymbol(id: string): CustomSymbolDef[] {
  return deleteCustomSymbol(id);
}

export function exportSymbolsAsJSON() {
  const data = getCustomSymbols();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scada-custom-symbols-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSymbolsFromJSON(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      saveCustomSymbols(parsed);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to import symbols:', e);
    return false;
  }
}

