import { ComponentDefinition } from './componentLibrary';

/**
 * 🇨🇳 国标电力自动化 SCADA 图元库 (GB_STANDARD_SYMBOLS)
 * 严格遵循四大电力国家与行业标准：
 * 1. GB/T 43259.556-2024（CIM/G）【SCADA 画面交换，第一优先】
 * 2. GB/T 4728.7/8-2022 【电气简图用图形符号：开关、测量、控制、保护】
 * 3. GB/T 44627-2024 【状态表达辅助：合闸红/分闸绿/告警黄/冷备灰】
 * 4. Q/GDW 11162 【国网智能变电站 SCADA 监控一次接线图元规范】
 * 
 * 规范约束：
 * - 100% 采用严格矢量几何图元精准组装 (draw-rect, draw-line, draw-circle, draw-polygon, draw-arc, draw-text)
 * - 0 悬空外边距，图元边界完全紧密贴合外接框 (紧密包围盒)
 * - 无任何不可靠外部闸符或第三方字体，跨端原生矢量渲染
 */

export const GB_STANDARD_SYMBOLS: ComponentDefinition[] = [
  // =========================================================================
  // 1. 开关与控制设备 (GB/T 4728.7-2022 / CIM/G)
  // =========================================================================
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '开关与控制设备',
    name: '高压真空断路器 QF',
    nameEn: 'Vacuum Circuit Breaker',
    iconName: 'Zap',
    description: 'GB/T 4728.7-2022 / GB/T 43259.556-2024 真空灭弧室加动触头，三态标准色标',
    defaultWidth: 40,
    defaultHeight: 80,
    defaultStyle: { fill: 'transparent', stroke: '#ef4444', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.7-2022' },
    states: [
      {
        id: '1',
        name: '合闸 / 运行',
        matchValue: '1',
        children: [
          { id: 'qf-top-1', name: '上接线端', type: 'draw-line', category: 'basic', x: 18, y: 0, width: 4, height: 20, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'qf-box-1', name: '灭弧室外壳', type: 'draw-rect', category: 'basic', x: 0, y: 20, width: 40, height: 40, rotation: 0, zIndex: 1, style: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', strokeWidth: 2.5, borderRadius: 2 } },
          { id: 'qf-blade-1', name: '合闸触头', type: 'draw-line', category: 'basic', x: 18, y: 20, width: 4, height: 40, rotation: 0, zIndex: 3, style: { stroke: '#ef4444', strokeWidth: 4 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 40, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'qf-bot-1', name: '下接线端', type: 'draw-line', category: 'basic', x: 18, y: 60, width: 4, height: 20, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } }
        ]
      },
      {
        id: '0',
        name: '分闸 / 隔离',
        matchValue: '0',
        children: [
          { id: 'qf-top-0', name: '上接线端', type: 'draw-line', category: 'basic', x: 18, y: 0, width: 4, height: 20, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'qf-box-0', name: '灭弧室外壳', type: 'draw-rect', category: 'basic', x: 0, y: 20, width: 40, height: 40, rotation: 0, zIndex: 1, style: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', strokeWidth: 2, borderRadius: 2 } },
          { id: 'qf-blade-0', name: '分闸开断触头', type: 'draw-line', category: 'basic', x: 6, y: 26, width: 28, height: 28, rotation: 0, zIndex: 3, style: { stroke: '#10b981', strokeWidth: 3.5 }, customProps: { points: [{ x: 6, y: 6, xRatio: 0.2, yRatio: 0.2 }, { x: 24, y: 24, xRatio: 0.8, yRatio: 0.8 }] } },
          { id: 'qf-bot-0', name: '下接线端', type: 'draw-line', category: 'basic', x: 18, y: 60, width: 4, height: 20, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } }
        ]
      }
    ],
    children: [
      { id: 'qf-top-d', name: '上接线端', type: 'draw-line', category: 'basic', x: 18, y: 0, width: 4, height: 20, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'qf-box-d', name: '灭弧室外壳', type: 'draw-rect', category: 'basic', x: 0, y: 20, width: 40, height: 40, rotation: 0, zIndex: 1, style: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', strokeWidth: 2.5, borderRadius: 2 } },
      { id: 'qf-blade-d', name: '合闸触头', type: 'draw-line', category: 'basic', x: 18, y: 20, width: 4, height: 40, rotation: 0, zIndex: 3, style: { stroke: '#ef4444', strokeWidth: 4 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 40, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'qf-bot-d', name: '下接线端', type: 'draw-line', category: 'basic', x: 18, y: 60, width: 4, height: 20, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '开关与控制设备',
    name: 'SF6 六氟化硫断路器',
    nameEn: 'SF6 Circuit Breaker',
    iconName: 'ShieldAlert',
    description: 'GB/T 43259.556-2024 六氟化硫气体绝缘断路器，带六边形气体绝缘符号',
    defaultWidth: 44,
    defaultHeight: 84,
    defaultStyle: { fill: 'transparent', stroke: '#ef4444', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 43259.556-2024' },
    states: [
      {
        id: '1',
        name: '合闸 / 运行',
        matchValue: '1',
        children: [
          { id: 'sf6-top-1', name: '上引线', type: 'draw-line', category: 'basic', x: 20, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'sf6-gas-1', name: 'SF6气室外壳', type: 'draw-polygon', category: 'basic', x: 0, y: 18, width: 44, height: 48, rotation: 0, zIndex: 2, style: { fill: 'rgba(239, 68, 68, 0.2)', stroke: '#ef4444', strokeWidth: 2.5 } },
          { id: 'sf6-contact-1', name: '灭弧动触头', type: 'draw-line', category: 'basic', x: 20, y: 18, width: 4, height: 48, rotation: 0, zIndex: 3, style: { stroke: '#ef4444', strokeWidth: 4 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 48, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'sf6-bot-1', name: '下引线', type: 'draw-line', category: 'basic', x: 20, y: 66, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } }
        ]
      },
      {
        id: '0',
        name: '分闸 / 隔离',
        matchValue: '0',
        children: [
          { id: 'sf6-top-0', name: '上引线', type: 'draw-line', category: 'basic', x: 20, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'sf6-gas-0', name: 'SF6气室外壳', type: 'draw-polygon', category: 'basic', x: 0, y: 18, width: 44, height: 48, rotation: 0, zIndex: 2, style: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', strokeWidth: 2 } },
          { id: 'sf6-contact-0', name: '灭弧动触头', type: 'draw-line', category: 'basic', x: 10, y: 24, width: 24, height: 36, rotation: 0, zIndex: 3, style: { stroke: '#10b981', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 32, xRatio: 0.1, yRatio: 0.9 }, { x: 22, y: 4, xRatio: 0.9, yRatio: 0.1 }] } },
          { id: 'sf6-bot-0', name: '下引线', type: 'draw-line', category: 'basic', x: 20, y: 66, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } }
        ]
      }
    ],
    children: [
      { id: 'sf6-top', name: '上引线', type: 'draw-line', category: 'basic', x: 20, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'sf6-gas', name: 'SF6气室外壳', type: 'draw-polygon', category: 'basic', x: 0, y: 18, width: 44, height: 48, rotation: 0, zIndex: 2, style: { fill: 'rgba(239, 68, 68, 0.2)', stroke: '#ef4444', strokeWidth: 2.5 } },
      { id: 'sf6-contact', name: '灭弧动触头', type: 'draw-line', category: 'basic', x: 20, y: 18, width: 4, height: 48, rotation: 0, zIndex: 3, style: { stroke: '#ef4444', strokeWidth: 4 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 48, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'sf6-bot', name: '下引线', type: 'draw-line', category: 'basic', x: 20, y: 66, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '开关与控制设备',
    name: '抽出式手车断路器',
    nameEn: 'Withdrawable Handcart Breaker',
    iconName: 'Box',
    description: 'GB/T 4728.7 手车式开关，含活动导轨框、进出线滑动动插头与断路器本体',
    defaultWidth: 54,
    defaultHeight: 96,
    defaultStyle: { fill: 'transparent', stroke: '#ef4444', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.7-2022' },
    states: [
      {
        id: '1',
        name: '工作位置 / 合闸',
        matchValue: '1',
        children: [
          { id: 'hc-rail-1', name: '手车活动框', type: 'draw-rect', category: 'basic', x: 0, y: 12, width: 54, height: 72, rotation: 0, zIndex: 1, style: { fill: 'rgba(15, 23, 42, 0.65)', stroke: '#38bdf8', strokeWidth: 1.5, strokeDasharray: '4 3', borderRadius: 4 } },
          { id: 'hc-plug-t-1', name: '上动触头插座', type: 'draw-line', category: 'basic', x: 25, y: 0, width: 4, height: 16, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'hc-body-1', name: '断路器灭弧本体', type: 'draw-rect', category: 'basic', x: 11, y: 32, width: 32, height: 32, rotation: 0, zIndex: 3, style: { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444', strokeWidth: 2.5, borderRadius: 2 } },
          { id: 'hc-contact-1', name: '导电直通杆', type: 'draw-line', category: 'basic', x: 25, y: 16, width: 4, height: 64, rotation: 0, zIndex: 4, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 64, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'hc-plug-b-1', name: '下动触头插座', type: 'draw-line', category: 'basic', x: 25, y: 80, width: 4, height: 16, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } }
        ]
      },
      {
        id: '0',
        name: '试验位置 / 分闸',
        matchValue: '0',
        children: [
          { id: 'hc-rail-0', name: '手车活动框', type: 'draw-rect', category: 'basic', x: 0, y: 12, width: 54, height: 72, rotation: 0, zIndex: 1, style: { fill: 'rgba(15, 23, 42, 0.65)', stroke: '#38bdf8', strokeWidth: 1.5, strokeDasharray: '4 3', borderRadius: 4 } },
          { id: 'hc-plug-t-0', name: '上动触头插座', type: 'draw-line', category: 'basic', x: 25, y: 0, width: 4, height: 12, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 12, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'hc-body-0', name: '断路器灭弧本体', type: 'draw-rect', category: 'basic', x: 11, y: 32, width: 32, height: 32, rotation: 0, zIndex: 3, style: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', strokeWidth: 2, borderRadius: 2 } },
          { id: 'hc-contact-0', name: '隔离分闸触头', type: 'draw-line', category: 'basic', x: 15, y: 36, width: 24, height: 24, rotation: 0, zIndex: 4, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 4, y: 20, xRatio: 0.2, yRatio: 0.8 }, { x: 20, y: 4, xRatio: 0.8, yRatio: 0.2 }] } },
          { id: 'hc-plug-b-0', name: '下动触头插座', type: 'draw-line', category: 'basic', x: 25, y: 84, width: 4, height: 12, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 12, xRatio: 0.5, yRatio: 1 }] } }
        ]
      },
      {
        id: '2',
        name: '检修抽出',
        matchValue: '2',
        children: [
          { id: 'hc-rail-2', name: '手车活动框', type: 'draw-rect', category: 'basic', x: 0, y: 12, width: 54, height: 72, rotation: 0, zIndex: 1, style: { fill: 'rgba(15, 23, 42, 0.4)', stroke: '#f59e0b', strokeWidth: 1.5, strokeDasharray: '4 3', borderRadius: 4 } },
          { id: 'hc-body-2', name: '手车抽出本体', type: 'draw-rect', category: 'basic', x: 11, y: 46, width: 32, height: 32, rotation: 0, zIndex: 3, style: { fill: 'rgba(245, 158, 11, 0.2)', stroke: '#f59e0b', strokeWidth: 2, borderRadius: 2 } },
          { id: 'hc-contact-2', name: '抽出标记', type: 'draw-line', category: 'basic', x: 25, y: 52, width: 4, height: 20, rotation: 0, zIndex: 4, style: { stroke: '#f59e0b', strokeWidth: 2.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } }
        ]
      }
    ],
    children: [
      { id: 'hc-rail', name: '手车活动框', type: 'draw-rect', category: 'basic', x: 0, y: 12, width: 54, height: 72, rotation: 0, zIndex: 1, style: { fill: 'rgba(15, 23, 42, 0.65)', stroke: '#38bdf8', strokeWidth: 1.5, strokeDasharray: '4 3', borderRadius: 4 } },
      { id: 'hc-plug-t', name: '上动触头插座', type: 'draw-line', category: 'basic', x: 25, y: 0, width: 4, height: 16, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'hc-body', name: '断路器灭弧本体', type: 'draw-rect', category: 'basic', x: 11, y: 32, width: 32, height: 32, rotation: 0, zIndex: 3, style: { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444', strokeWidth: 2.5, borderRadius: 2 } },
      { id: 'hc-contact', name: '导电直通杆', type: 'draw-line', category: 'basic', x: 25, y: 16, width: 4, height: 64, rotation: 0, zIndex: 4, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 64, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'hc-plug-b', name: '下动触头插座', type: 'draw-line', category: 'basic', x: 25, y: 80, width: 4, height: 16, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '开关与控制设备',
    name: '高压隔离开关 QS',
    nameEn: 'Disconnector',
    iconName: 'ZapOff',
    description: 'GB/T 4728.7-2022 双静触头圆座与旋转动触刀',
    defaultWidth: 28,
    defaultHeight: 70,
    defaultStyle: { fill: 'transparent', stroke: '#ef4444', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.7-2022' },
    states: [
      {
        id: '1',
        name: '合闸 / 导通',
        matchValue: '1',
        children: [
          { id: 'qs-top-1', name: '上引线', type: 'draw-line', category: 'basic', x: 12, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'qs-c1-1', name: '上静触点', type: 'draw-circle', category: 'basic', x: 8, y: 18, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } },
          { id: 'qs-blade-1', name: '动触刀', type: 'draw-line', category: 'basic', x: 12, y: 28, width: 4, height: 18, rotation: 0, zIndex: 3, style: { stroke: '#ef4444', strokeWidth: 4 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'qs-c2-1', name: '下轴承座', type: 'draw-circle', category: 'basic', x: 8, y: 44, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } },
          { id: 'qs-bot-1', name: '下引线', type: 'draw-line', category: 'basic', x: 12, y: 54, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } }
        ]
      },
      {
        id: '0',
        name: '分闸 / 隔离',
        matchValue: '0',
        children: [
          { id: 'qs-top-0', name: '上引线', type: 'draw-line', category: 'basic', x: 12, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'qs-c1-0', name: '上静触点', type: 'draw-circle', category: 'basic', x: 8, y: 18, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#10b981', stroke: '#10b981', strokeWidth: 1 } },
          { id: 'qs-blade-0', name: '斜断开触刀', type: 'draw-line', category: 'basic', x: 8, y: 26, width: 18, height: 20, rotation: 0, zIndex: 3, style: { stroke: '#10b981', strokeWidth: 3.5 }, customProps: { points: [{ x: 4, y: 18, xRatio: 0.2, yRatio: 0.9 }, { x: 16, y: 2, xRatio: 0.9, yRatio: 0.1 }] } },
          { id: 'qs-c2-0', name: '下轴承座', type: 'draw-circle', category: 'basic', x: 8, y: 44, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#10b981', stroke: '#10b981', strokeWidth: 1 } },
          { id: 'qs-bot-0', name: '下引线', type: 'draw-line', category: 'basic', x: 12, y: 54, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } }
        ]
      }
    ],
    children: [
      { id: 'qs-top', name: '上引线', type: 'draw-line', category: 'basic', x: 12, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'qs-c1', name: '上静触点', type: 'draw-circle', category: 'basic', x: 8, y: 18, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } },
      { id: 'qs-blade', name: '动触刀', type: 'draw-line', category: 'basic', x: 12, y: 28, width: 4, height: 18, rotation: 0, zIndex: 3, style: { stroke: '#ef4444', strokeWidth: 4 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'qs-c2', name: '下轴承座', type: 'draw-circle', category: 'basic', x: 8, y: 44, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } },
      { id: 'qs-bot', name: '下引线', type: 'draw-line', category: 'basic', x: 12, y: 54, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '开关与控制设备',
    name: '快速接地刀闸 QE',
    nameEn: 'Earthing Switch',
    iconName: 'Activity',
    description: 'GB/T 4728.7-2022 / GB/T 43259 隔离开关带三级接地栅格符号',
    defaultWidth: 36,
    defaultHeight: 70,
    defaultStyle: { fill: 'transparent', stroke: '#10b981', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.7-2022' },
    states: [
      {
        id: '0',
        name: '分闸 / 释放',
        matchValue: '0',
        children: [
          { id: 'qe-top-0', name: '主线接入引线', type: 'draw-line', category: 'basic', x: 16, y: 0, width: 4, height: 20, rotation: 0, zIndex: 1, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'qe-c-0', name: '上触头圆', type: 'draw-circle', category: 'basic', x: 12, y: 20, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#10b981', stroke: '#10b981', strokeWidth: 1 } },
          { id: 'qe-blade-0', name: '接地倾斜动刀', type: 'draw-line', category: 'basic', x: 4, y: 26, width: 22, height: 22, rotation: 0, zIndex: 3, style: { stroke: '#10b981', strokeWidth: 3.5 }, customProps: { points: [{ x: 20, y: 4, xRatio: 0.9, yRatio: 0.2 }, { x: 4, y: 20, xRatio: 0.2, yRatio: 0.9 }] } },
          { id: 'qe-g1-0', name: '第一接地横杠', type: 'draw-line', category: 'basic', x: 0, y: 50, width: 36, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 36, y: 2, xRatio: 1, yRatio: 0.5 }] } },
          { id: 'qe-g2-0', name: '第二接地横杠', type: 'draw-line', category: 'basic', x: 6, y: 58, width: 24, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 2.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 24, y: 2, xRatio: 1, yRatio: 0.5 }] } },
          { id: 'qe-g3-0', name: '第三接地横杠', type: 'draw-line', category: 'basic', x: 12, y: 66, width: 12, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 2 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 12, y: 2, xRatio: 1, yRatio: 0.5 }] } }
        ]
      },
      {
        id: '1',
        name: '接地合闸',
        matchValue: '1',
        children: [
          { id: 'qe-top-1', name: '主线接入引线', type: 'draw-line', category: 'basic', x: 16, y: 0, width: 4, height: 20, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'qe-c-1', name: '上触头圆', type: 'draw-circle', category: 'basic', x: 12, y: 20, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } },
          { id: 'qe-blade-1', name: '接地闭合垂直动刀', type: 'draw-line', category: 'basic', x: 16, y: 26, width: 4, height: 24, rotation: 0, zIndex: 3, style: { stroke: '#ef4444', strokeWidth: 4 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 24, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'qe-g1-1', name: '第一接地横杠', type: 'draw-line', category: 'basic', x: 0, y: 50, width: 36, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 36, y: 2, xRatio: 1, yRatio: 0.5 }] } },
          { id: 'qe-g2-1', name: '第二接地横杠', type: 'draw-line', category: 'basic', x: 6, y: 58, width: 24, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 24, y: 2, xRatio: 1, yRatio: 0.5 }] } },
          { id: 'qe-g3-1', name: '第三接地横杠', type: 'draw-line', category: 'basic', x: 12, y: 66, width: 12, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 2.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 12, y: 2, xRatio: 1, yRatio: 0.5 }] } }
        ]
      }
    ],
    children: [
      { id: 'qe-top', name: '主线接入引线', type: 'draw-line', category: 'basic', x: 16, y: 0, width: 4, height: 20, rotation: 0, zIndex: 1, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'qe-c', name: '上触头圆', type: 'draw-circle', category: 'basic', x: 12, y: 20, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#10b981', stroke: '#10b981', strokeWidth: 1 } },
      { id: 'qe-blade', name: '接地倾斜动刀', type: 'draw-line', category: 'basic', x: 4, y: 26, width: 22, height: 22, rotation: 0, zIndex: 3, style: { stroke: '#10b981', strokeWidth: 3.5 }, customProps: { points: [{ x: 20, y: 4, xRatio: 0.9, yRatio: 0.2 }, { x: 4, y: 20, xRatio: 0.2, yRatio: 0.9 }] } },
      { id: 'qe-g1', name: '第一接地横杠', type: 'draw-line', category: 'basic', x: 0, y: 50, width: 36, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 36, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'qe-g2', name: '第二接地横杠', type: 'draw-line', category: 'basic', x: 6, y: 58, width: 24, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 2.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 24, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'qe-g3', name: '第三接地横杠', type: 'draw-line', category: 'basic', x: 12, y: 66, width: 12, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 2 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 12, y: 2, xRatio: 1, yRatio: 0.5 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '开关与控制设备',
    name: '高压负荷开关 QL',
    nameEn: 'Load Break Switch',
    iconName: 'ToggleRight',
    description: 'GB/T 4728.7 带简易负荷灭弧室与隔离触头的开断元件',
    defaultWidth: 32,
    defaultHeight: 74,
    defaultStyle: { fill: 'transparent', stroke: '#ef4444', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.7-2022' },
    states: [
      {
        id: '1',
        name: '合闸 / 运行',
        matchValue: '1',
        children: [
          { id: 'ql-top-1', name: '上引线', type: 'draw-line', category: 'basic', x: 14, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'ql-arc-1', name: '负荷灭弧三角标', type: 'draw-triangle-down', category: 'basic', x: 8, y: 18, width: 16, height: 14, rotation: 0, zIndex: 2, style: { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444', strokeWidth: 2 } },
          { id: 'ql-contact-1', name: '主触刀', type: 'draw-line', category: 'basic', x: 14, y: 32, width: 4, height: 22, rotation: 0, zIndex: 3, style: { stroke: '#ef4444', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 22, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'ql-c-1', name: '触头转轴', type: 'draw-circle', category: 'basic', x: 10, y: 52, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } },
          { id: 'ql-bot-1', name: '下引线', type: 'draw-line', category: 'basic', x: 14, y: 62, width: 4, height: 12, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 12, xRatio: 0.5, yRatio: 1 }] } }
        ]
      },
      {
        id: '0',
        name: '分闸 / 隔离',
        matchValue: '0',
        children: [
          { id: 'ql-top-0', name: '上引线', type: 'draw-line', category: 'basic', x: 14, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
          { id: 'ql-arc-0', name: '负荷灭弧三角标', type: 'draw-triangle-down', category: 'basic', x: 8, y: 18, width: 16, height: 14, rotation: 0, zIndex: 2, style: { fill: 'rgba(16, 185, 129, 0.2)', stroke: '#10b981', strokeWidth: 2 } },
          { id: 'ql-contact-0', name: '分闸开断触刀', type: 'draw-line', category: 'basic', x: 8, y: 32, width: 18, height: 22, rotation: 0, zIndex: 3, style: { stroke: '#10b981', strokeWidth: 3.5 }, customProps: { points: [{ x: 4, y: 20, xRatio: 0.2, yRatio: 0.9 }, { x: 16, y: 2, xRatio: 0.9, yRatio: 0.1 }] } },
          { id: 'ql-c-0', name: '触头转轴', type: 'draw-circle', category: 'basic', x: 10, y: 52, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#10b981', stroke: '#10b981', strokeWidth: 1 } },
          { id: 'ql-bot-0', name: '下引线', type: 'draw-line', category: 'basic', x: 14, y: 62, width: 4, height: 12, rotation: 0, zIndex: 1, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 12, xRatio: 0.5, yRatio: 1 }] } }
        ]
      }
    ],
    children: [
      { id: 'ql-top', name: '上引线', type: 'draw-line', category: 'basic', x: 14, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'ql-arc', name: '负荷灭弧三角标', type: 'draw-triangle-down', category: 'basic', x: 8, y: 18, width: 16, height: 14, rotation: 0, zIndex: 2, style: { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444', strokeWidth: 2 } },
      { id: 'ql-contact', name: '主触刀', type: 'draw-line', category: 'basic', x: 14, y: 32, width: 4, height: 22, rotation: 0, zIndex: 3, style: { stroke: '#ef4444', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 22, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'ql-c', name: '触头转轴', type: 'draw-circle', category: 'basic', x: 10, y: 52, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } },
      { id: 'ql-bot', name: '下引线', type: 'draw-line', category: 'basic', x: 14, y: 62, width: 4, height: 12, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 12, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '开关与控制设备',
    name: '高压跌落式熔断器 FU',
    nameEn: 'Drop-out Fuse',
    iconName: 'Minus',
    description: 'GB/T 4728.7 贯穿细长熔断体与鸭嘴触头支架',
    defaultWidth: 28,
    defaultHeight: 76,
    defaultStyle: { fill: 'transparent', stroke: '#f59e0b', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.7-2022' },
    children: [
      { id: 'fu-top', name: '上接线', type: 'draw-line', category: 'basic', x: 12, y: 0, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#f59e0b', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'fu-box', name: '熔管框体', type: 'draw-rect', category: 'basic', x: 4, y: 16, width: 20, height: 44, rotation: 0, zIndex: 2, style: { fill: 'rgba(245, 158, 11, 0.2)', stroke: '#f59e0b', strokeWidth: 2 } },
      { id: 'fu-wire', name: '中心熔丝线', type: 'draw-line', category: 'basic', x: 12, y: 12, width: 4, height: 52, rotation: 0, zIndex: 3, style: { stroke: '#f59e0b', strokeWidth: 2.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 52, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'fu-bot', name: '下接线', type: 'draw-line', category: 'basic', x: 12, y: 60, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#f59e0b', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '开关与控制设备',
    name: '交流接触器 KM',
    nameEn: 'AC Contactor',
    iconName: 'ToggleRight',
    description: 'GB/T 4728.7 电磁线圈驱动触点闭合控制器件',
    defaultWidth: 36,
    defaultHeight: 74,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.7-2022' },
    children: [
      { id: 'km-top', name: '上引线', type: 'draw-line', category: 'basic', x: 16, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#00f2ff', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'km-coil', name: '接触器半圆触头', type: 'draw-circle', category: 'basic', x: 10, y: 18, width: 16, height: 16, rotation: 0, zIndex: 2, style: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2.5 } },
      { id: 'km-bar', name: '联锁主触刀', type: 'draw-line', category: 'basic', x: 16, y: 34, width: 4, height: 22, rotation: 0, zIndex: 3, style: { stroke: '#00f2ff', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 22, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'km-bot', name: '下引线', type: 'draw-line', category: 'basic', x: 16, y: 56, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#00f2ff', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '开关与控制设备',
    name: '低压塑壳空气断路器 QA',
    nameEn: 'Molded Case Breaker',
    iconName: 'Zap',
    description: 'GB/T 4728.7 低压配电自动空气开关，含热磁脱扣叉符号',
    defaultWidth: 40,
    defaultHeight: 74,
    defaultStyle: { fill: 'transparent', stroke: '#ef4444', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.7-2022' },
    children: [
      { id: 'qa-top', name: '上引线', type: 'draw-line', category: 'basic', x: 18, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'qa-box', name: '脱扣灭弧框', type: 'draw-rect', category: 'basic', x: 4, y: 18, width: 32, height: 36, rotation: 0, zIndex: 2, style: { fill: 'rgba(239, 68, 68, 0.2)', stroke: '#ef4444', strokeWidth: 2 } },
      { id: 'qa-cross', name: 'X形脱扣标', type: 'draw-line', category: 'basic', x: 10, y: 24, width: 20, height: 24, rotation: 0, zIndex: 3, style: { stroke: '#ef4444', strokeWidth: 2.5 }, customProps: { points: [{ x: 2, y: 2, xRatio: 0.1, yRatio: 0.1 }, { x: 18, y: 22, xRatio: 0.9, yRatio: 0.9 }] } },
      { id: 'qa-bot', name: '下引线', type: 'draw-line', category: 'basic', x: 18, y: 54, width: 4, height: 20, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },

  // =========================================================================
  // 2. 变压与变换设备 (GB/T 4728.6-2022 / CIM/G)
  // =========================================================================
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '变压与变换设备',
    name: '双绕组电力变压器 TM',
    nameEn: 'Two-Winding Power Transformer',
    iconName: 'Workflow',
    description: 'GB/T 4728.6-2022 / CIM/G 经典上下交叠双圆绕组',
    defaultWidth: 48,
    defaultHeight: 88,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.6-2022' },
    children: [
      { id: 'tm-top-line', name: '高压侧引线', type: 'draw-line', category: 'basic', x: 22, y: 0, width: 4, height: 14, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 14, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'tm-c1', name: '高压一次绕组', type: 'draw-circle', category: 'basic', x: 4, y: 14, width: 40, height: 40, rotation: 0, zIndex: 2, style: { fill: 'rgba(239, 68, 68, 0.15)', stroke: '#ef4444', strokeWidth: 2.5 } },
      { id: 'tm-c2', name: '低压二次绕组', type: 'draw-circle', category: 'basic', x: 4, y: 34, width: 40, height: 40, rotation: 0, zIndex: 3, style: { fill: 'rgba(0, 242, 255, 0.15)', stroke: '#00f2ff', strokeWidth: 2.5 } },
      { id: 'tm-bot-line', name: '低压侧引线', type: 'draw-line', category: 'basic', x: 22, y: 74, width: 4, height: 14, rotation: 0, zIndex: 1, style: { stroke: '#00f2ff', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 14, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '变压与变换设备',
    name: '三绕组电力变压器 TM3',
    nameEn: 'Three-Winding Transformer',
    iconName: 'Layers',
    description: 'GB/T 4728.6 经典倒品字三绕组交叠结构',
    defaultWidth: 72,
    defaultHeight: 96,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.6-2022' },
    children: [
      { id: 'tm3s-top-l', name: '高压引线', type: 'draw-line', category: 'basic', x: 34, y: 0, width: 4, height: 14, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 14, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'tm3s-c1', name: '高压一次绕组', type: 'draw-circle', category: 'basic', x: 18, y: 14, width: 36, height: 36, rotation: 0, zIndex: 2, style: { fill: 'rgba(239, 68, 68, 0.15)', stroke: '#ef4444', strokeWidth: 2.5 } },
      { id: 'tm3s-c2', name: '中压二次绕组', type: 'draw-circle', category: 'basic', x: 0, y: 44, width: 36, height: 36, rotation: 0, zIndex: 2, style: { fill: 'rgba(245, 158, 11, 0.15)', stroke: '#f59e0b', strokeWidth: 2.5 } },
      { id: 'tm3s-c3', name: '低压三次绕组', type: 'draw-circle', category: 'basic', x: 36, y: 44, width: 36, height: 36, rotation: 0, zIndex: 2, style: { fill: 'rgba(0, 242, 255, 0.15)', stroke: '#00f2ff', strokeWidth: 2.5 } },
      { id: 'tm3s-bot-l1', name: '中压引下线', type: 'draw-line', category: 'basic', x: 16, y: 80, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#f59e0b', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'tm3s-bot-l2', name: '低压引下线', type: 'draw-line', category: 'basic', x: 52, y: 80, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#00f2ff', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '变压与变换设备',
    name: '三绕组有载调压变压器 TM3-OLTC',
    nameEn: 'Three-Winding OLTC Transformer',
    iconName: 'Sliders',
    description: 'GB/T 4728.6 倒品字三绕组交叠结构，带对角有载调压调节箭头',
    defaultWidth: 72,
    defaultHeight: 96,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.6-2022' },
    children: [
      { id: 'tm3-top-l', name: '高压引线', type: 'draw-line', category: 'basic', x: 34, y: 0, width: 4, height: 14, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 14, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'tm3-c1', name: '高压一次绕组', type: 'draw-circle', category: 'basic', x: 18, y: 14, width: 36, height: 36, rotation: 0, zIndex: 2, style: { fill: 'rgba(239, 68, 68, 0.15)', stroke: '#ef4444', strokeWidth: 2.5 } },
      { id: 'tm3-c2', name: '中压二次绕组', type: 'draw-circle', category: 'basic', x: 0, y: 44, width: 36, height: 36, rotation: 0, zIndex: 2, style: { fill: 'rgba(245, 158, 11, 0.15)', stroke: '#f59e0b', strokeWidth: 2.5 } },
      { id: 'tm3-c3', name: '低压三次绕组', type: 'draw-circle', category: 'basic', x: 36, y: 44, width: 36, height: 36, rotation: 0, zIndex: 2, style: { fill: 'rgba(0, 242, 255, 0.15)', stroke: '#00f2ff', strokeWidth: 2.5 } },
      { id: 'tm3-arrow', name: '有载调压倾斜箭头', type: 'draw-line', category: 'basic', x: 10, y: 78, width: 52, height: 4, rotation: -30, zIndex: 4, style: { stroke: '#fbbf24', strokeWidth: 2.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 52, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'tm3-bot-l1', name: '中压引下线', type: 'draw-line', category: 'basic', x: 16, y: 80, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#f59e0b', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'tm3-bot-l2', name: '低压引下线', type: 'draw-line', category: 'basic', x: 52, y: 80, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#00f2ff', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '变压与变换设备',
    name: '自耦变压器 AT',
    nameEn: 'Autotransformer',
    iconName: 'Workflow',
    description: 'GB/T 4728.6 具有公共绕组和串联绕组单圆内切变压器',
    defaultWidth: 48,
    defaultHeight: 84,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.6-2022' },
    children: [
      { id: 'at-top', name: '高压出线', type: 'draw-line', category: 'basic', x: 22, y: 0, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'at-ring-out', name: '公共绕组外圆', type: 'draw-circle', category: 'basic', x: 2, y: 16, width: 44, height: 44, rotation: 0, zIndex: 2, style: { fill: 'rgba(2, 132, 199, 0.2)', stroke: '#38bdf8', strokeWidth: 2.5 } },
      { id: 'at-tap', name: '抽头侧水平引出线', type: 'draw-line', category: 'basic', x: 24, y: 36, width: 24, height: 4, rotation: 0, zIndex: 3, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 24, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'at-bot', name: '中性点接地线', type: 'draw-line', category: 'basic', x: 22, y: 60, width: 4, height: 24, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 24, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '变压与变换设备',
    name: '消弧线圈 / 接地变',
    nameEn: 'Arc Suppression Coil',
    iconName: 'Sliders',
    description: 'GB/T 4728.6 电感线圈带斜向调节箭头，用于变电站中性点谐振接地',
    defaultWidth: 42,
    defaultHeight: 80,
    defaultStyle: { fill: 'transparent', stroke: '#10b981', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.6-2022' },
    children: [
      { id: 'arc-top', name: '中性点引线', type: 'draw-line', category: 'basic', x: 19, y: 0, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'arc-core', name: '磁芯电感框', type: 'draw-rect', category: 'basic', x: 6, y: 16, width: 30, height: 38, rotation: 0, zIndex: 2, style: { fill: 'rgba(16, 185, 129, 0.2)', stroke: '#10b981', strokeWidth: 2.5 } },
      { id: 'arc-adj', name: '调节箭头斜线', type: 'draw-line', category: 'basic', x: 2, y: 20, width: 38, height: 30, rotation: 0, zIndex: 4, style: { stroke: '#fbbf24', strokeWidth: 2.5 }, customProps: { points: [{ x: 4, y: 26, xRatio: 0.1, yRatio: 0.85 }, { x: 34, y: 4, xRatio: 0.9, yRatio: 0.15 }] } },
      { id: 'arc-g1', name: '接地基准线', type: 'draw-line', category: 'basic', x: 5, y: 64, width: 32, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 32, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'arc-g2', name: '接地二级线', type: 'draw-line', category: 'basic', x: 11, y: 72, width: 20, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 2.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 20, y: 2, xRatio: 1, yRatio: 0.5 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '变压与变换设备',
    name: '预装式箱式变电站',
    nameEn: 'Box-Type Substation',
    iconName: 'Box',
    description: 'Q/GDW 11162 箱变外罩虚线框与内置双绕组变压器集成图元',
    defaultWidth: 64,
    defaultHeight: 88,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'Q/GDW 11162' },
    children: [
      { id: 'box-shelter', name: '箱体外罩', type: 'draw-rect', category: 'basic', x: 0, y: 10, width: 64, height: 68, rotation: 0, zIndex: 1, style: { fill: 'rgba(15, 23, 42, 0.7)', stroke: '#38bdf8', strokeWidth: 1.5, strokeDasharray: '4 3', borderRadius: 4 } },
      { id: 'box-top-l', name: '高压进线', type: 'draw-line', category: 'basic', x: 30, y: 0, width: 4, height: 16, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'box-c1', name: '高压绕组', type: 'draw-circle', category: 'basic', x: 17, y: 16, width: 30, height: 30, rotation: 0, zIndex: 3, style: { fill: 'rgba(239, 68, 68, 0.2)', stroke: '#ef4444', strokeWidth: 2 } },
      { id: 'box-c2', name: '低压绕组', type: 'draw-circle', category: 'basic', x: 17, y: 36, width: 30, height: 30, rotation: 0, zIndex: 4, style: { fill: 'rgba(0, 242, 255, 0.2)', stroke: '#00f2ff', strokeWidth: 2 } },
      { id: 'box-bot-l', name: '低压出线', type: 'draw-line', category: 'basic', x: 30, y: 72, width: 4, height: 16, rotation: 0, zIndex: 2, style: { stroke: '#00f2ff', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },

  // =========================================================================
  // 3. 互感与测量保护 (GB/T 4728.8-2022 / CIM/G)
  // =========================================================================
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '互感与测量保护',
    name: '电流互感器 CT / TA',
    nameEn: 'Current Transformer',
    iconName: 'Circle',
    description: 'GB/T 4728.8 穿心一次主导线贯穿圆形二次测量线圈',
    defaultWidth: 36,
    defaultHeight: 64,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.8-2022' },
    children: [
      { id: 'ct-main-wire', name: '一次主母线', type: 'draw-line', category: 'basic', x: 16, y: 0, width: 4, height: 64, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 4 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 64, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'ct-circle', name: '二次感应绕组', type: 'draw-circle', category: 'basic', x: 2, y: 16, width: 32, height: 32, rotation: 0, zIndex: 2, style: { fill: 'rgba(56, 189, 248, 0.25)', stroke: '#00f2ff', strokeWidth: 2.5 } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '互感与测量保护',
    name: '双二次绕组电流互感器 2CT',
    nameEn: 'Dual-Winding Current Transformer',
    iconName: 'CircleDot',
    description: 'GB/T 4728.8 测量与保护级独立双圆穿心电流互感器',
    defaultWidth: 36,
    defaultHeight: 84,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.8-2022' },
    children: [
      { id: '2ct-line', name: '贯穿母线', type: 'draw-line', category: 'basic', x: 16, y: 0, width: 4, height: 84, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 4 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 84, xRatio: 0.5, yRatio: 1 }] } },
      { id: '2ct-c1', name: '测量级圆圈', type: 'draw-circle', category: 'basic', x: 4, y: 12, width: 28, height: 28, rotation: 0, zIndex: 2, style: { fill: 'rgba(0, 242, 255, 0.2)', stroke: '#00f2ff', strokeWidth: 2.5 } },
      { id: '2ct-c2', name: '保护级圆圈', type: 'draw-circle', category: 'basic', x: 4, y: 44, width: 28, height: 28, rotation: 0, zIndex: 3, style: { fill: 'rgba(245, 158, 11, 0.2)', stroke: '#f59e0b', strokeWidth: 2.5 } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '互感与测量保护',
    name: '电压互感器 PT / TV',
    nameEn: 'Potential Transformer',
    iconName: 'CircleDot',
    description: 'GB/T 4728.8 两个相切圆圈与接地端子，用于母线电压采集',
    defaultWidth: 44,
    defaultHeight: 80,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.8-2022' },
    children: [
      { id: 'pt-top', name: '一次高压引线', type: 'draw-line', category: 'basic', x: 20, y: 0, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'pt-c1', name: '一次高压圆圈', type: 'draw-circle', category: 'basic', x: 7, y: 16, width: 30, height: 30, rotation: 0, zIndex: 2, style: { fill: 'rgba(239, 68, 68, 0.2)', stroke: '#ef4444', strokeWidth: 2 } },
      { id: 'pt-c2', name: '二次低压圆圈', type: 'draw-circle', category: 'basic', x: 7, y: 38, width: 30, height: 30, rotation: 0, zIndex: 3, style: { fill: 'rgba(0, 242, 255, 0.2)', stroke: '#00f2ff', strokeWidth: 2 } },
      { id: 'pt-g1', name: '二次接地端子', type: 'draw-line', category: 'basic', x: 10, y: 72, width: 24, height: 4, rotation: 0, zIndex: 1, style: { stroke: '#00f2ff', strokeWidth: 2.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 24, y: 2, xRatio: 1, yRatio: 0.5 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '互感与测量保护',
    name: '零序电流互感器 ZCT',
    nameEn: 'Zero-Sequence Current Transformer',
    iconName: 'Circle',
    description: 'GB/T 4728.8 三相电缆穿心式零序接地保护互感器',
    defaultWidth: 44,
    defaultHeight: 56,
    defaultStyle: { fill: 'transparent', stroke: '#a855f7', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.8-2022' },
    children: [
      { id: 'zct-cable', name: '电缆贯穿线', type: 'draw-line', category: 'basic', x: 20, y: 0, width: 4, height: 56, rotation: 0, zIndex: 1, style: { stroke: '#c084fc', strokeWidth: 5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 56, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'zct-toroid', name: '环形磁芯环', type: 'draw-circle', category: 'basic', x: 2, y: 8, width: 40, height: 40, rotation: 0, zIndex: 2, style: { fill: 'rgba(168, 85, 247, 0.2)', stroke: '#a855f7', strokeWidth: 3 } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '互感与测量保护',
    name: '金属氧化物避雷器 F',
    nameEn: 'Surge Arrester',
    iconName: 'ShieldAlert',
    description: 'GB/T 4728.8 矩形非线性电阻阀片与接地端',
    defaultWidth: 36,
    defaultHeight: 74,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.8-2022' },
    children: [
      { id: 'arr-top', name: '上接线', type: 'draw-line', category: 'basic', x: 16, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#00f2ff', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'arr-block', name: '阀片矩形', type: 'draw-rect', category: 'basic', x: 6, y: 18, width: 24, height: 36, rotation: 0, zIndex: 2, style: { fill: 'rgba(0, 242, 255, 0.2)', stroke: '#00f2ff', strokeWidth: 2.5 } },
      { id: 'arr-spark', name: '内嵌放电闪电标', type: 'draw-line', category: 'basic', x: 12, y: 22, width: 12, height: 28, rotation: 0, zIndex: 3, style: { stroke: '#fbbf24', strokeWidth: 2.5 }, customProps: { points: [{ x: 10, y: 0, xRatio: 0.8, yRatio: 0 }, { x: 2, y: 14, xRatio: 0.2, yRatio: 0.5 }, { x: 8, y: 14, xRatio: 0.6, yRatio: 0.5 }, { x: 0, y: 28, xRatio: 0, yRatio: 1 }] } },
      { id: 'arr-g', name: '接地横杠', type: 'draw-line', category: 'basic', x: 4, y: 64, width: 28, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#00f2ff', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 28, y: 2, xRatio: 1, yRatio: 0.5 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '互感与测量保护',
    name: '线路高频阻波器 LWF',
    nameEn: 'Line Wave Trap',
    iconName: 'Radio',
    description: 'GB/T 4728.8 串接于超高压输电线路的高频载波谐振阻抗线圈',
    defaultWidth: 38,
    defaultHeight: 64,
    defaultStyle: { fill: 'transparent', stroke: '#38bdf8', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.8-2022' },
    children: [
      { id: 'lwf-top', name: '线路进端', type: 'draw-line', category: 'basic', x: 17, y: 0, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'lwf-coil', name: '双圆交织滤波圈', type: 'draw-rect', category: 'basic', x: 4, y: 16, width: 30, height: 32, rotation: 0, zIndex: 2, style: { fill: 'rgba(56, 189, 248, 0.2)', stroke: '#38bdf8', strokeWidth: 2.5, borderRadius: 15 } },
      { id: 'lwf-bot', name: '线路出端', type: 'draw-line', category: 'basic', x: 17, y: 48, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },

  // =========================================================================
  // 4. 旋转电机与新能源 (GB/T 43259 / GB/T 4728.6)
  // =========================================================================
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '旋转电机与新能源',
    name: '三相交流发电机 G',
    nameEn: 'Synchronous Generator',
    iconName: 'Zap',
    description: 'GB/T 4728.6 标准发电机符号，圆圈标注G与三相正弦波交流标',
    defaultWidth: 54,
    defaultHeight: 74,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.6-2022' },
    children: [
      { id: 'gen-top', name: '机端引线', type: 'draw-line', category: 'basic', x: 25, y: 0, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'gen-c', name: '电机定子圆圈', type: 'draw-circle', category: 'basic', x: 2, y: 16, width: 50, height: 50, rotation: 0, zIndex: 2, style: { fill: 'rgba(2, 132, 199, 0.25)', stroke: '#38bdf8', strokeWidth: 2.5 } },
      { id: 'gen-txt', name: '发电机代号 G', type: 'draw-text', category: 'basic', x: 17, y: 24, width: 20, height: 20, rotation: 0, zIndex: 3, style: { fontSize: 16, fontWeight: 'bold', stroke: '#ffffff', textColor: '#ffffff' }, customProps: { text: 'G' } },
      { id: 'gen-wave', name: '三相正弦标识', type: 'draw-text', category: 'basic', x: 17, y: 44, width: 20, height: 16, rotation: 0, zIndex: 3, style: { fontSize: 13, fontWeight: 'bold', stroke: '#38bdf8', textColor: '#38bdf8' }, customProps: { text: '3~' } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '旋转电机与新能源',
    name: '三相异步电动机 M',
    nameEn: 'Induction Motor',
    iconName: 'Cpu',
    description: 'GB/T 4728.6 电机定子圆圈标注 M 与 3~',
    defaultWidth: 54,
    defaultHeight: 74,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.6-2022' },
    children: [
      { id: 'mot-top', name: '动力进线', type: 'draw-line', category: 'basic', x: 25, y: 0, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'mot-c', name: '电机机壳圆', type: 'draw-circle', category: 'basic', x: 2, y: 16, width: 50, height: 50, rotation: 0, zIndex: 2, style: { fill: 'rgba(16, 185, 129, 0.25)', stroke: '#10b981', strokeWidth: 2.5 } },
      { id: 'mot-txt', name: '电动机代号 M', type: 'draw-text', category: 'basic', x: 17, y: 24, width: 20, height: 20, rotation: 0, zIndex: 3, style: { fontSize: 16, fontWeight: 'bold', stroke: '#ffffff', textColor: '#ffffff' }, customProps: { text: 'M' } },
      { id: 'mot-wave', name: '三相标识', type: 'draw-text', category: 'basic', x: 17, y: 44, width: 20, height: 16, rotation: 0, zIndex: 3, style: { fontSize: 13, fontWeight: 'bold', stroke: '#10b981', textColor: '#10b981' }, customProps: { text: '3~' } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '旋转电机与新能源',
    name: '光伏组件发电方阵',
    nameEn: 'PV Solar Array',
    iconName: 'Sparkles',
    description: 'GB/T 43259 CIM/G 新能源太阳能光伏阵列单元',
    defaultWidth: 60,
    defaultHeight: 54,
    defaultStyle: { fill: 'transparent', stroke: '#38bdf8', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 43259.556-2024' },
    children: [
      { id: 'pv-panel', name: '光伏斜面底板', type: 'draw-polygon', category: 'basic', x: 0, y: 0, width: 60, height: 42, rotation: 0, zIndex: 1, style: { fill: 'rgba(56, 189, 248, 0.25)', stroke: '#38bdf8', strokeWidth: 2 } },
      { id: 'pv-grid-v1', name: '晶硅栅格线1', type: 'draw-line', category: 'basic', x: 20, y: 4, width: 4, height: 34, rotation: 0, zIndex: 2, style: { stroke: '#38bdf8', strokeWidth: 1.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 34, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'pv-grid-v2', name: '晶硅栅格线2', type: 'draw-line', category: 'basic', x: 40, y: 4, width: 4, height: 34, rotation: 0, zIndex: 2, style: { stroke: '#38bdf8', strokeWidth: 1.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 34, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'pv-pole', name: '支架接地柱', type: 'draw-line', category: 'basic', x: 28, y: 42, width: 4, height: 12, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 12, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '旋转电机与新能源',
    name: '光伏并网逆变器 PV',
    nameEn: 'PV Grid Inverter',
    iconName: 'Zap',
    description: 'GB/T 43259 CIM/G 标准对角线直交转换逆变单元',
    defaultWidth: 54,
    defaultHeight: 54,
    defaultStyle: { fill: 'transparent', stroke: '#f59e0b', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 43259.556-2024' },
    children: [
      { id: 'pvi-box', name: '逆变器外框', type: 'draw-rect', category: 'basic', x: 0, y: 0, width: 54, height: 54, rotation: 0, zIndex: 1, style: { fill: 'rgba(245, 158, 11, 0.2)', stroke: '#f59e0b', strokeWidth: 2, borderRadius: 2 } },
      { id: 'pvi-diag', name: '对角分割线', type: 'draw-line', category: 'basic', x: 0, y: 0, width: 54, height: 54, rotation: 0, zIndex: 2, style: { stroke: '#f59e0b', strokeWidth: 2 }, customProps: { points: [{ x: 0, y: 54, xRatio: 0, yRatio: 1 }, { x: 54, y: 0, xRatio: 1, yRatio: 0 }] } },
      { id: 'pvi-dc', name: '直流符号 =', type: 'draw-text', category: 'basic', x: 6, y: 6, width: 18, height: 18, rotation: 0, zIndex: 3, style: { fontSize: 14, fontWeight: 'bold', stroke: '#f59e0b', textColor: '#f59e0b' }, customProps: { text: '=' } },
      { id: 'pvi-ac', name: '交流符号 ~', type: 'draw-text', category: 'basic', x: 30, y: 30, width: 18, height: 18, rotation: 0, zIndex: 3, style: { fontSize: 14, fontWeight: 'bold', stroke: '#38bdf8', textColor: '#38bdf8' }, customProps: { text: '~' } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '旋转电机与新能源',
    name: '储能变流器 PCS',
    nameEn: 'Power Conversion System (PCS)',
    iconName: 'Database',
    description: 'GB/T 43259 CIM/G 双向能量流动 AC/DC 变流器',
    defaultWidth: 54,
    defaultHeight: 54,
    defaultStyle: { fill: 'transparent', stroke: '#10b981', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 43259.556-2024' },
    children: [
      { id: 'pcs-box', name: '变流器外框', type: 'draw-rect', category: 'basic', x: 0, y: 0, width: 54, height: 54, rotation: 0, zIndex: 1, style: { fill: 'rgba(16, 185, 129, 0.2)', stroke: '#10b981', strokeWidth: 2, borderRadius: 2 } },
      { id: 'pcs-diag', name: '双向对角分割线', type: 'draw-line', category: 'basic', x: 0, y: 0, width: 54, height: 54, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 2 }, customProps: { points: [{ x: 0, y: 54, xRatio: 0, yRatio: 1 }, { x: 54, y: 0, xRatio: 1, yRatio: 0 }] } },
      { id: 'pcs-txt', name: '双向标示', type: 'draw-text', category: 'basic', x: 6, y: 26, width: 42, height: 20, rotation: 0, zIndex: 3, style: { fontSize: 11, fontWeight: 'bold', stroke: '#ffffff', textColor: '#ffffff' }, customProps: { text: '= / ~' } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '旋转电机与新能源',
    name: '储能电池组 BESS',
    nameEn: 'Battery Storage',
    iconName: 'Database',
    description: 'GB/T 4728.6 多组高低长短平行极板电池组符号',
    defaultWidth: 48,
    defaultHeight: 64,
    defaultStyle: { fill: 'transparent', stroke: '#10b981', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.6-2022' },
    children: [
      { id: 'bat-top', name: '正极引线', type: 'draw-line', category: 'basic', x: 22, y: 0, width: 4, height: 14, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 14, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'bat-p1', name: '长极板1(+)', type: 'draw-line', category: 'basic', x: 4, y: 14, width: 40, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 40, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'bat-p2', name: '短极板1(-)', type: 'draw-line', category: 'basic', x: 12, y: 24, width: 24, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#38bdf8', strokeWidth: 4 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 24, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'bat-p3', name: '长极板2(+)', type: 'draw-line', category: 'basic', x: 4, y: 34, width: 40, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#ef4444', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 40, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'bat-p4', name: '短极板2(-)', type: 'draw-line', category: 'basic', x: 12, y: 44, width: 24, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#38bdf8', strokeWidth: 4 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 24, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'bat-bot', name: '负极引线', type: 'draw-line', category: 'basic', x: 22, y: 48, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '旋转电机与新能源',
    name: '风力发电机组 WTG',
    nameEn: 'Wind Turbine Generator',
    iconName: 'RotateCw',
    description: 'GB/T 43259 三叶片风轮轮毂与机舱塔架符号',
    defaultWidth: 54,
    defaultHeight: 74,
    defaultStyle: { fill: 'transparent', stroke: '#38bdf8', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 43259.556-2024' },
    children: [
      { id: 'wtg-hub', name: '风机轮毂', type: 'draw-circle', category: 'basic', x: 21, y: 14, width: 12, height: 12, rotation: 0, zIndex: 3, style: { fill: '#38bdf8', stroke: '#38bdf8', strokeWidth: 1 } },
      { id: 'wtg-b1', name: '叶片1(垂直)', type: 'draw-line', category: 'basic', x: 25, y: 0, width: 4, height: 16, rotation: 0, zIndex: 2, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 16, xRatio: 0.5, yRatio: 1 }, { x: 2, y: 0, xRatio: 0.5, yRatio: 0 }] } },
      { id: 'wtg-b2', name: '叶片2(右斜下)', type: 'draw-line', category: 'basic', x: 30, y: 22, width: 20, height: 14, rotation: 0, zIndex: 2, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 0, xRatio: 0, yRatio: 0 }, { x: 20, y: 14, xRatio: 1, yRatio: 1 }] } },
      { id: 'wtg-b3', name: '叶片3(左斜下)', type: 'draw-line', category: 'basic', x: 4, y: 22, width: 20, height: 14, rotation: 0, zIndex: 2, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 20, y: 0, xRatio: 1, yRatio: 0 }, { x: 0, y: 14, xRatio: 0, yRatio: 1 }] } },
      { id: 'wtg-tower', name: '机舱塔筒', type: 'draw-line', category: 'basic', x: 25, y: 24, width: 4, height: 50, rotation: 0, zIndex: 1, style: { stroke: '#94a3b8', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 50, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '旋转电机与新能源',
    name: '交流综合电力负荷 Load',
    nameEn: 'AC Comprehensive Load',
    iconName: 'MoveRight',
    description: 'GB/T 4728.3 变电站出线侧受电箭头负荷标准符号',
    defaultWidth: 40,
    defaultHeight: 64,
    defaultStyle: { fill: 'transparent', stroke: '#38bdf8', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.3-2022' },
    children: [
      { id: 'load-top', name: '接入引下线', type: 'draw-line', category: 'basic', x: 18, y: 0, width: 4, height: 32, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 32, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'load-arrow', name: '受电下三角标', type: 'draw-triangle-down', category: 'basic', x: 8, y: 32, width: 24, height: 24, rotation: 0, zIndex: 2, style: { fill: '#38bdf8', stroke: '#38bdf8', strokeWidth: 1 } }
    ]
  },

  // =========================================================================
  // 5. 无功补偿与电抗设备 (GB/T 43259 / Q/GDW 11162)
  // =========================================================================
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '无功补偿与电抗',
    name: '并联电容器组 C',
    nameEn: 'Shunt Capacitor Bank',
    iconName: 'ToggleRight',
    description: 'GB/T 4728.4 / CIM/G 并联无功补偿双极板电容器',
    defaultWidth: 40,
    defaultHeight: 70,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.4-2022' },
    children: [
      { id: 'cap-top', name: '电容引线', type: 'draw-line', category: 'basic', x: 18, y: 0, width: 4, height: 22, rotation: 0, zIndex: 1, style: { stroke: '#00f2ff', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 22, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'cap-p1', name: '上平行极板', type: 'draw-line', category: 'basic', x: 2, y: 22, width: 36, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#00f2ff', strokeWidth: 3.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 36, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'cap-p2', name: '下平行极板', type: 'draw-line', category: 'basic', x: 2, y: 34, width: 36, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#00f2ff', strokeWidth: 3.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 36, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'cap-bot', name: '接地引下线', type: 'draw-line', category: 'basic', x: 18, y: 38, width: 4, height: 22, rotation: 0, zIndex: 1, style: { stroke: '#00f2ff', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 22, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'cap-g', name: '接地极板', type: 'draw-line', category: 'basic', x: 8, y: 60, width: 24, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#00f2ff', strokeWidth: 2.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 24, y: 2, xRatio: 1, yRatio: 0.5 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '无功补偿与电抗',
    name: '并联电抗器 L',
    nameEn: 'Shunt Reactor',
    iconName: 'Workflow',
    description: 'GB/T 4728.4 抑制母线工频过电压的并联铁芯电抗器',
    defaultWidth: 36,
    defaultHeight: 70,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.4-2022' },
    children: [
      { id: 'rea-top', name: '电抗引线', type: 'draw-line', category: 'basic', x: 16, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'rea-core', name: '铁芯电抗矩形框', type: 'draw-rect', category: 'basic', x: 4, y: 18, width: 28, height: 32, rotation: 0, zIndex: 2, style: { fill: 'rgba(56, 189, 248, 0.2)', stroke: '#38bdf8', strokeWidth: 2.5 } },
      { id: 'rea-bot', name: '接地引下线', type: 'draw-line', category: 'basic', x: 16, y: 50, width: 4, height: 16, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 16, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'rea-g', name: '接地短横线', type: 'draw-line', category: 'basic', x: 8, y: 66, width: 20, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#38bdf8', strokeWidth: 2.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 20, y: 2, xRatio: 1, yRatio: 0.5 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '无功补偿与电抗',
    name: '串联限流电抗器 SR',
    nameEn: 'Series Current-Limiting Reactor',
    iconName: 'Workflow',
    description: 'GB/T 4728.4 串联于母线限制短路电流的电抗器',
    defaultWidth: 36,
    defaultHeight: 74,
    defaultStyle: { fill: 'transparent', stroke: '#38bdf8', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.4-2022' },
    children: [
      { id: 'sr-top', name: '上母线接入', type: 'draw-line', category: 'basic', x: 16, y: 0, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'sr-box', name: '串联空心电抗框', type: 'draw-rect', category: 'basic', x: 4, y: 18, width: 28, height: 38, rotation: 0, zIndex: 2, style: { fill: 'rgba(56, 189, 248, 0.2)', stroke: '#38bdf8', strokeWidth: 2.5 } },
      { id: 'sr-bot', name: '下母线出线', type: 'draw-line', category: 'basic', x: 16, y: 56, width: 4, height: 18, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 18, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '无功补偿与电抗',
    name: '静止无功发生器 SVG',
    nameEn: 'Static Var Generator (SVG)',
    iconName: 'Zap',
    description: 'Q/GDW 11162 / CIM/G 动态高响应自换相无功发生装置',
    defaultWidth: 54,
    defaultHeight: 64,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'Q/GDW 11162' },
    children: [
      { id: 'svg-top', name: '母线接入线', type: 'draw-line', category: 'basic', x: 25, y: 0, width: 4, height: 14, rotation: 0, zIndex: 1, style: { stroke: '#00f2ff', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 14, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'svg-box', name: 'SVG本体屏柜', type: 'draw-rect', category: 'basic', x: 0, y: 14, width: 54, height: 50, rotation: 0, zIndex: 2, style: { fill: 'rgba(2, 132, 199, 0.25)', stroke: '#00f2ff', strokeWidth: 2, borderRadius: 2 } },
      { id: 'svg-txt', name: 'SVG字符标', type: 'draw-text', category: 'basic', x: 6, y: 28, width: 42, height: 22, rotation: 0, zIndex: 3, style: { fontSize: 13, fontWeight: 'bold', stroke: '#ffffff', textColor: '#ffffff' }, customProps: { text: 'SVG' } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '无功补偿与电抗',
    name: '静止无功补偿器 SVC',
    nameEn: 'Static Var Compensator (SVC)',
    iconName: 'Zap',
    description: 'GB/T 43259 CIM/G 晶闸管控制无功补偿单元 TCR+FC',
    defaultWidth: 54,
    defaultHeight: 64,
    defaultStyle: { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 43259.556-2024' },
    children: [
      { id: 'svc-top', name: '母线引线', type: 'draw-line', category: 'basic', x: 25, y: 0, width: 4, height: 14, rotation: 0, zIndex: 1, style: { stroke: '#00f2ff', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 14, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'svc-box', name: 'SVC柜体', type: 'draw-rect', category: 'basic', x: 0, y: 14, width: 54, height: 50, rotation: 0, zIndex: 2, style: { fill: 'rgba(2, 132, 199, 0.25)', stroke: '#38bdf8', strokeWidth: 2, borderRadius: 2 } },
      { id: 'svc-txt', name: 'SVC字符标', type: 'draw-text', category: 'basic', x: 6, y: 28, width: 42, height: 22, rotation: 0, zIndex: 3, style: { fontSize: 13, fontWeight: 'bold', stroke: '#ffffff', textColor: '#ffffff' }, customProps: { text: 'SVC' } }
    ]
  },

  // =========================================================================
  // 6. 线路母线与接地 (GB/T 4728.3 / CIM/G)
  // =========================================================================
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '线路母线与接地',
    name: '高压单母线段 Busbar',
    nameEn: 'Busbar Segment',
    iconName: 'Minus',
    description: 'GB/T 4728.3 变电站高压主母线段，粗实线带三相支路引下点',
    defaultWidth: 100,
    defaultHeight: 24,
    defaultStyle: { fill: 'transparent', stroke: '#ef4444', strokeWidth: 5 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.3-2022' },
    children: [
      { id: 'bus-main', name: '主母线骨干', type: 'draw-line', category: 'basic', x: 0, y: 10, width: 100, height: 4, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 6 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 100, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'bus-p1', name: '端点1', type: 'draw-circle', category: 'basic', x: 18, y: 6, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } },
      { id: 'bus-p2', name: '端点2', type: 'draw-circle', category: 'basic', x: 44, y: 6, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } },
      { id: 'bus-p3', name: '端点3', type: 'draw-circle', category: 'basic', x: 70, y: 6, width: 12, height: 12, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '线路母线与接地',
    name: '母线分段联络单元',
    nameEn: 'Bus Tie Unit',
    iconName: 'ArrowLeftRight',
    description: 'GB/T 43259 CIM/G 两段母线之间的隔离开关分段联络',
    defaultWidth: 80,
    defaultHeight: 32,
    defaultStyle: { fill: 'transparent', stroke: '#ef4444', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 43259.556-2024' },
    children: [
      { id: 'bt-l1', name: '左段母线', type: 'draw-line', category: 'basic', x: 0, y: 14, width: 26, height: 4, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 26, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'bt-c1', name: '左触头', type: 'draw-circle', category: 'basic', x: 24, y: 11, width: 10, height: 10, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } },
      { id: 'bt-blade', name: '联络闸刀', type: 'draw-line', category: 'basic', x: 30, y: 6, width: 20, height: 16, rotation: 0, zIndex: 3, style: { stroke: '#ef4444', strokeWidth: 3.5 }, customProps: { points: [{ x: 0, y: 10, xRatio: 0, yRatio: 0.6 }, { x: 20, y: 2, xRatio: 1, yRatio: 0.1 }] } },
      { id: 'bt-c2', name: '右触头', type: 'draw-circle', category: 'basic', x: 48, y: 11, width: 10, height: 10, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } },
      { id: 'bt-l2', name: '右段母线', type: 'draw-line', category: 'basic', x: 54, y: 14, width: 26, height: 4, rotation: 0, zIndex: 1, style: { stroke: '#ef4444', strokeWidth: 5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 26, y: 2, xRatio: 1, yRatio: 0.5 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '线路母线与接地',
    name: '电缆终端出线头',
    nameEn: 'Cable Pothead Terminal',
    iconName: 'Triangle',
    description: 'GB/T 4728.3 封闭式电缆终端头倒三角导引头',
    defaultWidth: 28,
    defaultHeight: 50,
    defaultStyle: { fill: 'transparent', stroke: '#38bdf8', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.3-2022' },
    children: [
      { id: 'cbl-in', name: '导线进线', type: 'draw-line', category: 'basic', x: 12, y: 0, width: 4, height: 20, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'cbl-tri', name: '终端倒三角', type: 'draw-triangle-down', category: 'basic', x: 2, y: 20, width: 24, height: 20, rotation: 0, zIndex: 2, style: { fill: '#38bdf8', stroke: '#38bdf8', strokeWidth: 1 } },
      { id: 'cbl-out', name: '出线引脚', type: 'draw-line', category: 'basic', x: 12, y: 40, width: 4, height: 10, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 10, xRatio: 0.5, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '线路母线与接地',
    name: '架空线路出线终端',
    nameEn: 'Overhead Line Terminal',
    iconName: 'MoveRight',
    description: 'GB/T 4728.3 变电站高压架空输电线路出线悬垂线夹标',
    defaultWidth: 44,
    defaultHeight: 36,
    defaultStyle: { fill: 'transparent', stroke: '#38bdf8', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.3-2022' },
    children: [
      { id: 'oh-in', name: '引出导线', type: 'draw-line', category: 'basic', x: 0, y: 16, width: 24, height: 4, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 24, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'oh-arrow', name: '架空出线右箭头', type: 'draw-line', category: 'basic', x: 24, y: 6, width: 18, height: 24, rotation: 0, zIndex: 2, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 0, xRatio: 0, yRatio: 0 }, { x: 18, y: 12, xRatio: 1, yRatio: 0.5 }, { x: 0, y: 24, xRatio: 0, yRatio: 1 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '线路母线与接地',
    name: '系统安全保护接地 PE',
    nameEn: 'Protective Earth',
    iconName: 'Activity',
    description: 'GB/T 4728.2 变电站标准安全保护接地符号',
    defaultWidth: 36,
    defaultHeight: 44,
    defaultStyle: { fill: 'transparent', stroke: '#10b981', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.2-2022' },
    children: [
      { id: 'pe-top', name: '接地引下导线', type: 'draw-line', category: 'basic', x: 16, y: 0, width: 4, height: 20, rotation: 0, zIndex: 1, style: { stroke: '#10b981', strokeWidth: 3.5 }, customProps: { points: [{ x: 2, y: 0, xRatio: 0.5, yRatio: 0 }, { x: 2, y: 20, xRatio: 0.5, yRatio: 1 }] } },
      { id: 'pe-g1', name: '第一接地极板', type: 'draw-line', category: 'basic', x: 0, y: 20, width: 36, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 36, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'pe-g2', name: '第二接地极板', type: 'draw-line', category: 'basic', x: 6, y: 28, width: 24, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 2.5 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 24, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'pe-g3', name: '第三接地极板', type: 'draw-line', category: 'basic', x: 12, y: 36, width: 12, height: 4, rotation: 0, zIndex: 2, style: { stroke: '#10b981', strokeWidth: 2 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 12, y: 2, xRatio: 1, yRatio: 0.5 }] } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '线路母线与接地',
    name: '母线 T 接铜端子',
    nameEn: 'Busbar T-Node',
    iconName: 'Circle',
    description: 'GB/T 4728.3 母线支路引下固定式铜接线端子节点',
    defaultWidth: 16,
    defaultHeight: 16,
    defaultStyle: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.3-2022' },
    children: [
      { id: 'node-c', name: '实心接点', type: 'draw-circle', category: 'basic', x: 0, y: 0, width: 16, height: 16, rotation: 0, zIndex: 2, style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 } }
    ]
  },
  {
    type: 'composite-symbol',
    category: 'gb-standard',
    subCategory: '线路母线与接地',
    name: '线路跨接跳线',
    nameEn: 'Wire Jumper Bridge',
    iconName: 'Workflow',
    description: 'GB/T 4728.3 变电站线路无电气连接立体跨接半圆弧',
    defaultWidth: 40,
    defaultHeight: 24,
    defaultStyle: { fill: 'transparent', stroke: '#38bdf8', strokeWidth: 2 },
    defaultCustomProps: { isGbStandard: true, standard: 'GB/T 4728.3-2022' },
    children: [
      { id: 'jmp-l1', name: '左直通线', type: 'draw-line', category: 'basic', x: 0, y: 10, width: 10, height: 4, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 10, y: 2, xRatio: 1, yRatio: 0.5 }] } },
      { id: 'jmp-arc', name: '跨接半圆弧', type: 'draw-arc', category: 'basic', x: 10, y: 0, width: 20, height: 20, rotation: 0, zIndex: 2, style: { stroke: '#38bdf8', strokeWidth: 3 } },
      { id: 'jmp-l2', name: '右直通线', type: 'draw-line', category: 'basic', x: 30, y: 10, width: 10, height: 4, rotation: 0, zIndex: 1, style: { stroke: '#38bdf8', strokeWidth: 3 }, customProps: { points: [{ x: 0, y: 2, xRatio: 0, yRatio: 0.5 }, { x: 10, y: 2, xRatio: 1, yRatio: 0.5 }] } }
    ]
  }
];
