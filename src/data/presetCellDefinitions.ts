import { CustomSymbolDef } from '../types';

/**
 * 规范化预设图元库 (PRESET_CELL_DEFINITIONS)
 * 规范要求：
 * 1. 100% 使用基础几何组件组装 (draw-rect, draw-line, draw-circle, draw-polygon, draw-text)
 * 2. 不要使用 Vue 代码自己实现，不要使用闸符 (无特殊字符/字体图标)
 * 3. 所有图元与边框边界距离都是 0 (上下左右无悬空边距，紧密包围盒)
 * 4. 存储于根目录 cell/<名称>.json，一个图元一个文件
 */
export const PRESET_CELL_DEFINITIONS: CustomSymbolDef[] = [
  // -------------------------------------------------------------
  // 1. 高压真空断路器 QF (三态: 1-合闸红, 0-分闸绿, 2-跳闸黄)
  // -------------------------------------------------------------
  {
    id: 'cell-elec-breaker',
    name: '高压真空断路器 QF',
    category: 'electrical',
    iconName: 'Zap',
    description: '标准国标高压断路器，采用矩形灭弧室与动触头纯几何拼接，支持合闸/分闸/故障3态，边界距离为0，无闸符',
    defaultWidth: 40,
    defaultHeight: 80,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '状态 1 (合闸 / 运行)',
        matchValue: '1',
        children: [
          // 顶部引线 (贴顶 y: 0)
          {
            id: 'brk-top-1',
            name: '上接线端',
            type: 'draw-line',
            category: 'basic',
            x: 18,
            y: 0,
            width: 4,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 20 }] }
          },
          // 灭弧室外壳 (左右贴紧 x: 0 到 40)
          {
            id: 'brk-box-1',
            name: '灭弧室主体',
            type: 'draw-rect',
            category: 'basic',
            x: 0,
            y: 20,
            width: 40,
            height: 40,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', strokeWidth: 2.5, borderRadius: 2 }
          },
          // 内部实心导通闭合线
          {
            id: 'brk-contact-1',
            name: '主导电触头',
            type: 'draw-line',
            category: 'basic',
            x: 18,
            y: 20,
            width: 4,
            height: 40,
            rotation: 0,
            zIndex: 3,
            style: { stroke: '#ef4444', strokeWidth: 4 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 40 }] }
          },
          // 底部出线 (贴底 y: 60 到 80)
          {
            id: 'brk-bot-1',
            name: '下接线端',
            type: 'draw-line',
            category: 'basic',
            x: 18,
            y: 60,
            width: 4,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 20 }] }
          }
        ]
      },
      {
        id: '0',
        name: '状态 0 (分闸 / 隔离)',
        matchValue: '0',
        children: [
          {
            id: 'brk-top-0',
            name: '上接线端',
            type: 'draw-line',
            category: 'basic',
            x: 18,
            y: 0,
            width: 4,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 20 }] }
          },
          {
            id: 'brk-box-0',
            name: '灭弧室主体',
            type: 'draw-rect',
            category: 'basic',
            x: 0,
            y: 20,
            width: 40,
            height: 40,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', strokeWidth: 2, borderRadius: 2 }
          },
          // 分闸断开动触头 (以斜线几何表示断开，无任何闸符)
          {
            id: 'brk-contact-0',
            name: '分闸断开动触刀',
            type: 'draw-line',
            category: 'basic',
            x: 10,
            y: 26,
            width: 20,
            height: 28,
            rotation: 0,
            zIndex: 3,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.9, yRatio: 0.1, x: 18, y: 2 }, { xRatio: 0.2, yRatio: 0.9, x: 4, y: 26 }] }
          },
          {
            id: 'brk-bot-0',
            name: '下接线端',
            type: 'draw-line',
            category: 'basic',
            x: 18,
            y: 60,
            width: 4,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 20 }] }
          }
        ]
      },
      {
        id: '2',
        name: '状态 2 (故障 / 跳闸)',
        matchValue: '2',
        children: [
          {
            id: 'brk-top-2',
            name: '上接线端',
            type: 'draw-line',
            category: 'basic',
            x: 18,
            y: 0,
            width: 4,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#f59e0b', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 20 }] }
          },
          {
            id: 'brk-box-2',
            name: '灭弧室主体',
            type: 'draw-rect',
            category: 'basic',
            x: 0,
            y: 20,
            width: 40,
            height: 40,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(245, 158, 11, 0.25)', stroke: '#f59e0b', strokeWidth: 2.5, borderRadius: 2 }
          },
          {
            id: 'brk-contact-2',
            name: '故障跳开触头',
            type: 'draw-line',
            category: 'basic',
            x: 8,
            y: 28,
            width: 24,
            height: 24,
            rotation: 0,
            zIndex: 3,
            style: { stroke: '#f59e0b', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.1, yRatio: 0.1, x: 2, y: 2 }, { xRatio: 0.9, yRatio: 0.9, x: 22, y: 22 }] }
          },
          {
            id: 'brk-bot-2',
            name: '下接线端',
            type: 'draw-line',
            category: 'basic',
            x: 18,
            y: 60,
            width: 4,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#f59e0b', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 20 }] }
          }
        ]
      }
    ],
    tags: ['一次系统', '断路器', 'QF', '高压开关']
  },

  // -------------------------------------------------------------
  // 2. 高压隔离开关 QS (双态: 1-合闸导通, 0-分闸隔离)
  // -------------------------------------------------------------
  {
    id: 'cell-elec-disconnector',
    name: '高压隔离开关 QS',
    category: 'electrical',
    iconName: 'ZapOff',
    description: '电力隔离开关，由上下圆形静触座与直线动触刀组装，不使用任何闸符，0边距贴边，支持分合双态',
    defaultWidth: 28,
    defaultHeight: 70,
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
        matchValue: '1',
        children: [
          // 顶部引线 (贴顶 y: 0)
          {
            id: 'qs-top-line-1',
            name: '上引线',
            type: 'draw-line',
            category: 'basic',
            x: 12,
            y: 0,
            width: 4,
            height: 18,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 18 }] }
          },
          // 上静触头圆
          {
            id: 'qs-top-circle-1',
            name: '上静触头',
            type: 'draw-circle',
            category: 'basic',
            x: 8,
            y: 18,
            width: 12,
            height: 12,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 }
          },
          // 合闸垂直主触刀 (两触头间直线连通)
          {
            id: 'qs-blade-1',
            name: '合闸动触刀',
            type: 'draw-line',
            category: 'basic',
            x: 12,
            y: 28,
            width: 4,
            height: 18,
            rotation: 0,
            zIndex: 3,
            style: { stroke: '#ef4444', strokeWidth: 4 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 18 }] }
          },
          // 下转轴触头圆
          {
            id: 'qs-bot-circle-1',
            name: '下轴端触头',
            type: 'draw-circle',
            category: 'basic',
            x: 8,
            y: 44,
            width: 12,
            height: 12,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 }
          },
          // 底部引线 (贴底 y: 54 到 70)
          {
            id: 'qs-bot-line-1',
            name: '下引线',
            type: 'draw-line',
            category: 'basic',
            x: 12,
            y: 54,
            width: 4,
            height: 16,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 16 }] }
          }
        ]
      },
      {
        id: '0',
        name: '状态 0 (分闸 / 隔离)',
        matchValue: '0',
        children: [
          {
            id: 'qs-top-line-0',
            name: '上引线',
            type: 'draw-line',
            category: 'basic',
            x: 12,
            y: 0,
            width: 4,
            height: 18,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 18 }] }
          },
          {
            id: 'qs-top-circle-0',
            name: '上静触头',
            type: 'draw-circle',
            category: 'basic',
            x: 8,
            y: 18,
            width: 12,
            height: 12,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'transparent', stroke: '#10b981', strokeWidth: 2 }
          },
          // 分闸刀闸倾斜拉开 (贴紧左边 x: 0)
          {
            id: 'qs-blade-0',
            name: '分闸倾斜触刀',
            type: 'draw-line',
            category: 'basic',
            x: 0,
            y: 26,
            width: 14,
            height: 22,
            rotation: 0,
            zIndex: 3,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0, yRatio: 0, x: 0, y: 0 }, { xRatio: 1, yRatio: 1, x: 14, y: 22 }] }
          },
          {
            id: 'qs-bot-circle-0',
            name: '下轴端触头',
            type: 'draw-circle',
            category: 'basic',
            x: 8,
            y: 44,
            width: 12,
            height: 12,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#10b981', stroke: '#10b981', strokeWidth: 1 }
          },
          {
            id: 'qs-bot-line-0',
            name: '下引线',
            type: 'draw-line',
            category: 'basic',
            x: 12,
            y: 54,
            width: 4,
            height: 16,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 16 }] }
          }
        ]
      }
    ],
    tags: ['一次系统', '隔离开关', '刀闸', 'QS']
  },

  // -------------------------------------------------------------
  // 3. 快速接地刀闸 QE (双态: 0-隔离绿, 1-合闸接地检修黄)
  // -------------------------------------------------------------
  {
    id: 'cell-elec-grounding',
    name: '快速接地刀闸 QE',
    category: 'electrical',
    iconName: 'ShieldAlert',
    description: '电力接地刀闸，由垂直触头与三道水平基础直线接地排组装，严禁使用闸符，0边距，支持检修接地多态',
    defaultWidth: 36,
    defaultHeight: 56,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '0',
        name: '状态 0 (分闸 / 隔离运行)',
        matchValue: '0',
        children: [
          // 上接线触头端点 (贴顶 y: 0)
          {
            id: 'qe-top-0',
            name: '接线触头',
            type: 'draw-circle',
            category: 'basic',
            x: 14,
            y: 0,
            width: 8,
            height: 8,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'transparent', stroke: '#10b981', strokeWidth: 2 }
          },
          // 倾斜分开的接地刀 (贴左 x: 0)
          {
            id: 'qe-blade-0',
            name: '分闸刀柄',
            type: 'draw-line',
            category: 'basic',
            x: 0,
            y: 8,
            width: 16,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#10b981', strokeWidth: 2.5 },
            customProps: { points: [{ xRatio: 0, yRatio: 0, x: 0, y: 0 }, { xRatio: 1, yRatio: 1, x: 16, y: 20 }] }
          },
          // 基础几何三道接地排 (最长一道贴左贴右 x: 0 到 36)
          {
            id: 'qe-gnd-1-0',
            name: '接地极长横线',
            type: 'draw-line',
            category: 'basic',
            x: 0,
            y: 34,
            width: 36,
            height: 4,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 2 }, { xRatio: 1, yRatio: 0.5, x: 36, y: 2 }] }
          },
          {
            id: 'qe-gnd-2-0',
            name: '接地极中横线',
            type: 'draw-line',
            category: 'basic',
            x: 7,
            y: 42,
            width: 22,
            height: 4,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 2 }, { xRatio: 1, yRatio: 0.5, x: 22, y: 2 }] }
          },
          {
            id: 'qe-gnd-3-0',
            name: '接地极短横线',
            type: 'draw-line',
            category: 'basic',
            x: 13,
            y: 50,
            width: 10,
            height: 6,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 3 }, { xRatio: 1, yRatio: 0.5, x: 10, y: 3 }] }
          }
        ]
      },
      {
        id: '1',
        name: '状态 1 (合闸 / 检修接地)',
        matchValue: '1',
        children: [
          {
            id: 'qe-top-1',
            name: '接线触头',
            type: 'draw-circle',
            category: 'basic',
            x: 14,
            y: 0,
            width: 8,
            height: 8,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#f59e0b', stroke: '#f59e0b', strokeWidth: 1 }
          },
          // 垂直闭合接地刀 (合闸)
          {
            id: 'qe-blade-1',
            name: '合闸接地刀',
            type: 'draw-line',
            category: 'basic',
            x: 16,
            y: 8,
            width: 4,
            height: 26,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#f59e0b', strokeWidth: 3.5 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 26 }] }
          },
          {
            id: 'qe-gnd-1-1',
            name: '接地极长横线',
            type: 'draw-line',
            category: 'basic',
            x: 0,
            y: 34,
            width: 36,
            height: 4,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#f59e0b', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 2 }, { xRatio: 1, yRatio: 0.5, x: 36, y: 2 }] }
          },
          {
            id: 'qe-gnd-2-1',
            name: '接地极中横线',
            type: 'draw-line',
            category: 'basic',
            x: 7,
            y: 42,
            width: 22,
            height: 4,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#f59e0b', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 2 }, { xRatio: 1, yRatio: 0.5, x: 22, y: 2 }] }
          },
          {
            id: 'qe-gnd-3-1',
            name: '接地极短横线',
            type: 'draw-line',
            category: 'basic',
            x: 13,
            y: 50,
            width: 10,
            height: 6,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#f59e0b', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 3 }, { xRatio: 1, yRatio: 0.5, x: 10, y: 3 }] }
          }
        ]
      }
    ],
    tags: ['一次系统', '接地刀闸', 'QE', '检修']
  },

  // -------------------------------------------------------------
  // 4. 双绕组电力变压器 TM (标准双圆相交，纯几何拼接)
  // -------------------------------------------------------------
  {
    id: 'cell-elec-transformer',
    name: '双绕组电力变压器 TM',
    category: 'electrical',
    iconName: 'Cpu',
    description: '电力主变压器，由高低压引线与两个基础正圆相交组装，严禁使用外部闸符，边界贴边0距离',
    defaultWidth: 40,
    defaultHeight: 80,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '状态 1 (带电运行)',
        matchValue: '1',
        children: [
          // 高压进线 (贴顶 y: 0)
          {
            id: 'trans-line-top',
            name: '高压引线',
            type: 'draw-line',
            category: 'basic',
            x: 18,
            y: 0,
            width: 4,
            height: 12,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 12 }] }
          },
          // 一次侧高压绕组圆 (贴左右 x: 0 到 40)
          {
            id: 'trans-circle-top',
            name: '一次侧绕组',
            type: 'draw-circle',
            category: 'basic',
            x: 0,
            y: 10,
            width: 40,
            height: 40,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(239, 68, 68, 0.1)', stroke: '#ef4444', strokeWidth: 2.5 }
          },
          // 二次侧低压绕组圆 (与一次圆相交 20px)
          {
            id: 'trans-circle-bot',
            name: '二次侧绕组',
            type: 'draw-circle',
            category: 'basic',
            x: 0,
            y: 30,
            width: 40,
            height: 40,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(0, 242, 255, 0.1)', stroke: '#00f2ff', strokeWidth: 2.5 }
          },
          // 低压出线 (贴底 y: 68 到 80)
          {
            id: 'trans-line-bot',
            name: '低压引线',
            type: 'draw-line',
            category: 'basic',
            x: 18,
            y: 68,
            width: 4,
            height: 12,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#00f2ff', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 12 }] }
          }
        ]
      }
    ],
    tags: ['变压器', '双绕组', 'TM', '升压变']
  },

  // -------------------------------------------------------------
  // 5. 电流互感器 CT / TA
  // -------------------------------------------------------------
  {
    id: 'cell-elec-ct',
    name: '电流互感器 CT',
    category: 'electrical',
    iconName: 'Activity',
    description: '电流互感器，由贯穿母线与穿心采样圆形线圈组装，0边距',
    defaultWidth: 30,
    defaultHeight: 50,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '正常采样运行',
        matchValue: '1',
        children: [
          // 一次贯穿垂直母线 (贴顶贴底 y: 0 到 50)
          {
            id: 'ct-line',
            name: '一次穿心母线',
            type: 'draw-line',
            category: 'basic',
            x: 13,
            y: 0,
            width: 4,
            height: 50,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#00f2ff', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 50 }] }
          },
          // 穿心采样圆形线圈 (贴左贴右 x: 0 到 30)
          {
            id: 'ct-circle',
            name: '采样线圈',
            type: 'draw-circle',
            category: 'basic',
            x: 0,
            y: 10,
            width: 30,
            height: 30,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(0, 242, 255, 0.15)', stroke: '#00f2ff', strokeWidth: 2 }
          },
          // 极性同名端标志点
          {
            id: 'ct-dot',
            name: '极性端点',
            type: 'draw-circle',
            category: 'basic',
            x: 6,
            y: 14,
            width: 4,
            height: 4,
            rotation: 0,
            zIndex: 3,
            style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 }
          }
        ]
      }
    ],
    tags: ['CT', 'TA', '互感器', '遥测采样']
  },

  // -------------------------------------------------------------
  // 6. 电压互感器 PT / TV
  // -------------------------------------------------------------
  {
    id: 'cell-elec-pt',
    name: '电压互感器 PT',
    category: 'electrical',
    iconName: 'Activity',
    description: '电压互感器，由高压侧引线、双绕组基础几何圆与接地极组合拼装，0边距',
    defaultWidth: 30,
    defaultHeight: 60,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '正常测压运行',
        matchValue: '1',
        children: [
          // 高压引线 (贴顶 y: 0)
          {
            id: 'pt-line-top',
            name: '高压进线',
            type: 'draw-line',
            category: 'basic',
            x: 13,
            y: 0,
            width: 4,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#00f2ff', strokeWidth: 2.5 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 10 }] }
          },
          // 一次圆 (贴左贴右 x: 3 到 27)
          {
            id: 'pt-circle-1',
            name: '一次线圈',
            type: 'draw-circle',
            category: 'basic',
            x: 3,
            y: 8,
            width: 24,
            height: 24,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(0, 242, 255, 0.1)', stroke: '#00f2ff', strokeWidth: 2 }
          },
          // 二次圆
          {
            id: 'pt-circle-2',
            name: '二次线圈',
            type: 'draw-circle',
            category: 'basic',
            x: 3,
            y: 22,
            width: 24,
            height: 24,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(16, 185, 129, 0.1)', stroke: '#10b981', strokeWidth: 2 }
          },
          // 接地极长横线 (贴左贴右 x: 0 到 30)
          {
            id: 'pt-gnd-1',
            name: '接地长横线',
            type: 'draw-line',
            category: 'basic',
            x: 0,
            y: 48,
            width: 30,
            height: 4,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 2 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 2 }, { xRatio: 1, yRatio: 0.5, x: 30, y: 2 }] }
          },
          // 接地极短横线 (贴底 y: 56 到 60)
          {
            id: 'pt-gnd-2',
            name: '接地短横线',
            type: 'draw-line',
            category: 'basic',
            x: 8,
            y: 56,
            width: 14,
            height: 4,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 2 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 2 }, { xRatio: 1, yRatio: 0.5, x: 14, y: 2 }] }
          }
        ]
      }
    ],
    tags: ['PT', 'TV', '互感器', '电压测量']
  },

  // -------------------------------------------------------------
  // 7. 氧化锌避雷器 F
  // -------------------------------------------------------------
  {
    id: 'cell-elec-arrester',
    name: '氧化锌避雷器 F',
    category: 'electrical',
    iconName: 'Zap',
    description: '高压避雷器，由顶部引线、非线性电阻矩形箱与基础直线接地排组装，严禁使用闸符，0边距',
    defaultWidth: 26,
    defaultHeight: 60,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '防护运行中',
        matchValue: '1',
        children: [
          // 顶部引线 (贴顶 y: 0)
          {
            id: 'arr-top-line',
            name: '进线端',
            type: 'draw-line',
            category: 'basic',
            x: 11,
            y: 0,
            width: 4,
            height: 12,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#00f2ff', strokeWidth: 2.5 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 12 }] }
          },
          // 阀片电阻箱 (贴左贴右 x: 3 到 23)
          {
            id: 'arr-box',
            name: '氧化锌阀片箱',
            type: 'draw-rect',
            category: 'basic',
            x: 3,
            y: 12,
            width: 20,
            height: 30,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(0, 242, 255, 0.15)', stroke: '#00f2ff', strokeWidth: 2, borderRadius: 1 }
          },
          // 内部折线标识 (用基础几何直线构成折角，绝无闸符)
          {
            id: 'arr-zigzag',
            name: '避雷几何折线',
            type: 'draw-line',
            category: 'basic',
            x: 6,
            y: 16,
            width: 14,
            height: 22,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#00f2ff', strokeWidth: 2 },
            customProps: { points: [{ xRatio: 0.2, yRatio: 0.1, x: 3, y: 2 }, { xRatio: 0.8, yRatio: 0.5, x: 11, y: 11 }, { xRatio: 0.2, yRatio: 0.9, x: 3, y: 20 }] }
          },
          // 接地排长横线 (贴左贴右 x: 0 到 26)
          {
            id: 'arr-gnd-1',
            name: '接地长横线',
            type: 'draw-line',
            category: 'basic',
            x: 0,
            y: 48,
            width: 26,
            height: 4,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 2.5 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 2 }, { xRatio: 1, yRatio: 0.5, x: 26, y: 2 }] }
          },
          // 接地排短横线 (贴底 y: 56 到 60)
          {
            id: 'arr-gnd-2',
            name: '接地短横线',
            type: 'draw-line',
            category: 'basic',
            x: 6,
            y: 56,
            width: 14,
            height: 4,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 2.5 },
            customProps: { points: [{ xRatio: 0, yRatio: 0.5, x: 0, y: 2 }, { xRatio: 1, yRatio: 0.5, x: 14, y: 2 }] }
          }
        ]
      }
    ],
    tags: ['避雷器', '过电压', 'F', '接地保护']
  },

  // -------------------------------------------------------------
  // 8. KYN28抽出式开关手车 QF (4态)
  // -------------------------------------------------------------
  {
    id: 'cell-elec-handcart',
    name: 'KYN28抽出式开关手车 QF',
    category: 'electrical',
    iconName: 'Layers',
    description: '标准高压抽出式断路器手车，含动静插头与灭弧箱体，严禁闸符，0边距贴边，支持工作合/工作分/试验/检修4态',
    defaultWidth: 60,
    defaultHeight: 100,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '工作位置 (合闸)',
        matchValue: '1',
        children: [
          // 上静触头插座 (贴顶 y: 0)
          {
            id: 'hc-top-sock-1',
            name: '上静触头',
            type: 'draw-rect',
            category: 'basic',
            x: 22,
            y: 0,
            width: 16,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(239, 68, 68, 0.4)', stroke: '#ef4444', strokeWidth: 2, borderRadius: 2 }
          },
          // 手车活动底盘框 (贴左贴右 x: 0 到 60)
          {
            id: 'hc-frame-1',
            name: '手车底盘',
            type: 'draw-rect',
            category: 'basic',
            x: 0,
            y: 12,
            width: 60,
            height: 76,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(15, 23, 42, 0.75)', stroke: '#ef4444', strokeWidth: 1.5, strokeDasharray: '4,3', borderRadius: 4 }
          },
          // 灭弧室外壳
          {
            id: 'hc-arc-box-1',
            name: '灭弧室主体',
            type: 'draw-rect',
            category: 'basic',
            x: 10,
            y: 26,
            width: 40,
            height: 48,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', strokeWidth: 2.5, borderRadius: 3 }
          },
          // 合闸实心垂直导线
          {
            id: 'hc-line-1',
            name: '主触头闭合线',
            type: 'draw-line',
            category: 'basic',
            x: 28,
            y: 8,
            width: 4,
            height: 84,
            rotation: 0,
            zIndex: 3,
            style: { stroke: '#ef4444', strokeWidth: 4 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 84 }] }
          },
          // 下静触头插座 (贴底 y: 90 到 100)
          {
            id: 'hc-bot-sock-1',
            name: '下静触头',
            type: 'draw-rect',
            category: 'basic',
            x: 22,
            y: 90,
            width: 16,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(239, 68, 68, 0.4)', stroke: '#ef4444', strokeWidth: 2, borderRadius: 2 }
          }
        ]
      },
      {
        id: '0',
        name: '工作位置 (分闸)',
        matchValue: '0',
        children: [
          {
            id: 'hc-top-sock-0',
            name: '上静触头',
            type: 'draw-rect',
            category: 'basic',
            x: 22,
            y: 0,
            width: 16,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(16, 185, 129, 0.3)', stroke: '#10b981', strokeWidth: 2, borderRadius: 2 }
          },
          {
            id: 'hc-frame-0',
            name: '手车底盘',
            type: 'draw-rect',
            category: 'basic',
            x: 0,
            y: 12,
            width: 60,
            height: 76,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(15, 23, 42, 0.75)', stroke: '#10b981', strokeWidth: 1.5, strokeDasharray: '4,3', borderRadius: 4 }
          },
          {
            id: 'hc-arc-box-0',
            name: '灭弧室主体',
            type: 'draw-rect',
            category: 'basic',
            x: 10,
            y: 26,
            width: 40,
            height: 48,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', strokeWidth: 2, borderRadius: 3 }
          },
          // 分闸倾斜断开动触头
          {
            id: 'hc-line-0',
            name: '分闸倾斜触头',
            type: 'draw-line',
            category: 'basic',
            x: 18,
            y: 34,
            width: 24,
            height: 32,
            rotation: 0,
            zIndex: 3,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.9, yRatio: 0.1, x: 22, y: 3 }, { xRatio: 0.1, yRatio: 0.9, x: 2, y: 29 }] }
          },
          {
            id: 'hc-bot-sock-0',
            name: '下静触头',
            type: 'draw-rect',
            category: 'basic',
            x: 22,
            y: 90,
            width: 16,
            height: 10,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(16, 185, 129, 0.3)', stroke: '#10b981', strokeWidth: 2, borderRadius: 2 }
          }
        ]
      }
    ],
    tags: ['手车', '开关柜', 'KYN28', '抽出式']
  },

  // -------------------------------------------------------------
  // 9. 三相交流感应电动机 M (双态: 1-运行绿, 0-停机灰)
  // -------------------------------------------------------------
  {
    id: 'cell-ind-motor',
    name: '三相交流感应电动机 M',
    category: 'industrial',
    iconName: 'Cpu',
    description: '工业驱动电机，由定子圆框、底座支撑与中心矢量代号组装，0边距紧致贴合',
    defaultWidth: 60,
    defaultHeight: 64,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '状态 1 (运行中)',
        matchValue: '1',
        children: [
          // 定子主圆 (贴顶贴左贴右 x: 0 到 60, y: 0 到 56)
          {
            id: 'motor-circle-1',
            name: '定子外圆',
            type: 'draw-circle',
            category: 'basic',
            x: 2,
            y: 0,
            width: 56,
            height: 56,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(0, 242, 255, 0.15)', stroke: '#00f2ff', strokeWidth: 2.5 }
          },
          // 铭牌文字标识 'M' (纯几何标识字符，非闸符)
          {
            id: 'motor-label-1',
            name: '电机铭牌',
            type: 'draw-text',
            category: 'basic',
            x: 18,
            y: 12,
            width: 24,
            height: 28,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'transparent', fontSize: 22, textColor: '#00f2ff', fontWeight: 'bold' },
            customProps: { text: 'M' }
          },
          // 安装底座横板 (贴底 y: 56 到 64, x: 0 到 60)
          {
            id: 'motor-base-1',
            name: '安装底座',
            type: 'draw-rect',
            category: 'basic',
            x: 0,
            y: 56,
            width: 60,
            height: 8,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(0, 242, 255, 0.4)', stroke: '#00f2ff', strokeWidth: 1.5, borderRadius: 2 }
          }
        ]
      },
      {
        id: '0',
        name: '状态 0 (停机备用)',
        matchValue: '0',
        children: [
          {
            id: 'motor-circle-0',
            name: '定子外圆',
            type: 'draw-circle',
            category: 'basic',
            x: 2,
            y: 0,
            width: 56,
            height: 56,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(100, 116, 139, 0.15)', stroke: '#64748b', strokeWidth: 2 }
          },
          {
            id: 'motor-label-0',
            name: '电机铭牌',
            type: 'draw-text',
            category: 'basic',
            x: 18,
            y: 12,
            width: 24,
            height: 28,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'transparent', fontSize: 22, textColor: '#64748b', fontWeight: 'bold' },
            customProps: { text: 'M' }
          },
          {
            id: 'motor-base-0',
            name: '安装底座',
            type: 'draw-rect',
            category: 'basic',
            x: 0,
            y: 56,
            width: 60,
            height: 8,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(100, 116, 139, 0.3)', stroke: '#64748b', strokeWidth: 1.5, borderRadius: 2 }
          }
        ]
      }
    ],
    tags: ['电机', '动力', '感应电机', 'M']
  },

  // -------------------------------------------------------------
  // 10. 离心泵与加压泵 P (双态: 1-运行绿, 0-停运灰)
  // -------------------------------------------------------------
  {
    id: 'cell-ind-pump',
    name: '离心泵与加压泵 P',
    category: 'industrial',
    iconName: 'Activity',
    description: '工业离心泵，由泵壳外圆、切向出水口矩形与内部中心动叶轮拼装而成，0边距贴合',
    defaultWidth: 60,
    defaultHeight: 60,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '状态 1 (运行中)',
        matchValue: '1',
        children: [
          // 蜗壳主圆 (贴左贴底 x: 0 到 50, y: 10 到 60)
          {
            id: 'pump-volute-1',
            name: '泵蜗壳',
            type: 'draw-circle',
            category: 'basic',
            x: 0,
            y: 10,
            width: 50,
            height: 50,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(16, 185, 129, 0.2)', stroke: '#10b981', strokeWidth: 2.5 }
          },
          // 切向出水口 (贴顶贴右 x: 30 到 60, y: 0 到 20)
          {
            id: 'pump-outlet-1',
            name: '切向出水口',
            type: 'draw-rect',
            category: 'basic',
            x: 30,
            y: 0,
            width: 30,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(16, 185, 129, 0.25)', stroke: '#10b981', strokeWidth: 2 }
          },
          // 内部叶轮中心轴点
          {
            id: 'pump-rotor-1',
            name: '叶轮中心轴',
            type: 'draw-circle',
            category: 'basic',
            x: 18,
            y: 28,
            width: 14,
            height: 14,
            rotation: 0,
            zIndex: 3,
            style: { fill: '#10b981', stroke: '#10b981', strokeWidth: 1 }
          }
        ]
      },
      {
        id: '0',
        name: '状态 0 (停机)',
        matchValue: '0',
        children: [
          {
            id: 'pump-volute-0',
            name: '泵蜗壳',
            type: 'draw-circle',
            category: 'basic',
            x: 0,
            y: 10,
            width: 50,
            height: 50,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(100, 116, 139, 0.15)', stroke: '#64748b', strokeWidth: 2 }
          },
          {
            id: 'pump-outlet-0',
            name: '切向出水口',
            type: 'draw-rect',
            category: 'basic',
            x: 30,
            y: 0,
            width: 30,
            height: 20,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(100, 116, 139, 0.2)', stroke: '#64748b', strokeWidth: 1.5 }
          },
          {
            id: 'pump-rotor-0',
            name: '叶轮中心轴',
            type: 'draw-circle',
            category: 'basic',
            x: 18,
            y: 28,
            width: 14,
            height: 14,
            rotation: 0,
            zIndex: 3,
            style: { fill: '#64748b', stroke: '#64748b', strokeWidth: 1 }
          }
        ]
      }
    ],
    tags: ['水泵', '离心泵', '给水', '加压']
  },

  // -------------------------------------------------------------
  // 11. 气动调节蝶阀与控制阀 (双态: 1-开阀绿, 0-关阀红)
  // -------------------------------------------------------------
  {
    id: 'cell-ind-valve',
    name: '气动调节蝶阀',
    category: 'industrial',
    iconName: 'ToggleRight',
    description: '流体控制调节阀，由执行机构顶框、驱动立柱与左右对置三角形几何阀体组装，无闸符，0边距',
    defaultWidth: 50,
    defaultHeight: 60,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '状态 1 (阀门开启)',
        matchValue: '1',
        children: [
          // 顶部气动/电动执行器 (贴顶 x: 10 到 40, y: 0 到 14)
          {
            id: 'valve-actuator-1',
            name: '气动执行器',
            type: 'draw-rect',
            category: 'basic',
            x: 10,
            y: 0,
            width: 30,
            height: 14,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(16, 185, 129, 0.3)', stroke: '#10b981', strokeWidth: 2, borderRadius: 3 }
          },
          // 传动立柱
          {
            id: 'valve-stem-1',
            name: '执行立柱',
            type: 'draw-line',
            category: 'basic',
            x: 23,
            y: 14,
            width: 4,
            height: 14,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#10b981', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 14 }] }
          },
          // 左三角流道阀体 (贴左贴底 x: 0 到 25, y: 28 到 60)
          {
            id: 'valve-left-1',
            name: '左侧阀芯',
            type: 'draw-polygon',
            category: 'basic',
            x: 0,
            y: 28,
            width: 25,
            height: 32,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(16, 185, 129, 0.25)', stroke: '#10b981', strokeWidth: 2 },
            customProps: { points: [{ x: 0, y: 0 }, { x: 25, y: 16 }, { x: 0, y: 32 }] }
          },
          // 右三角流道阀体 (贴右贴底 x: 25 到 50, y: 28 到 60)
          {
            id: 'valve-right-1',
            name: '右侧阀芯',
            type: 'draw-polygon',
            category: 'basic',
            x: 25,
            y: 28,
            width: 25,
            height: 32,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(16, 185, 129, 0.25)', stroke: '#10b981', strokeWidth: 2 },
            customProps: { points: [{ x: 25, y: 0 }, { x: 0, y: 16 }, { x: 25, y: 32 }] }
          }
        ]
      },
      {
        id: '0',
        name: '状态 0 (阀门关闭)',
        matchValue: '0',
        children: [
          {
            id: 'valve-actuator-0',
            name: '气动执行器',
            type: 'draw-rect',
            category: 'basic',
            x: 10,
            y: 0,
            width: 30,
            height: 14,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444', strokeWidth: 2, borderRadius: 3 }
          },
          {
            id: 'valve-stem-0',
            name: '执行立柱',
            type: 'draw-line',
            category: 'basic',
            x: 23,
            y: 14,
            width: 4,
            height: 14,
            rotation: 0,
            zIndex: 1,
            style: { stroke: '#ef4444', strokeWidth: 3 },
            customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 2, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 2, y: 14 }] }
          },
          {
            id: 'valve-left-0',
            name: '左侧阀芯',
            type: 'draw-polygon',
            category: 'basic',
            x: 0,
            y: 28,
            width: 25,
            height: 32,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', strokeWidth: 2 },
            customProps: { points: [{ x: 0, y: 0 }, { x: 25, y: 16 }, { x: 0, y: 32 }] }
          },
          {
            id: 'valve-right-0',
            name: '右侧阀芯',
            type: 'draw-polygon',
            category: 'basic',
            x: 25,
            y: 28,
            width: 25,
            height: 32,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', strokeWidth: 2 },
            customProps: { points: [{ x: 25, y: 0 }, { x: 0, y: 16 }, { x: 25, y: 32 }] }
          }
        ]
      }
    ],
    tags: ['阀门', '蝶阀', '调节阀', '管道']
  },

  // -------------------------------------------------------------
  // 12. 储能电池模组 BESS (多层电芯实心组装)
  // -------------------------------------------------------------
  {
    id: 'cell-ind-bess',
    name: '储能电池模组 BESS',
    category: 'industrial',
    iconName: 'Database',
    description: '电化学储能模组，包含集装箱框体、正负极极耳与内部多层电池电芯条纹，0边距',
    defaultWidth: 70,
    defaultHeight: 50,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '充放电运行中',
        matchValue: '1',
        children: [
          // 左正极极耳 (贴顶 x: 12 到 24, y: 0 到 6)
          {
            id: 'bess-pole-pos',
            name: '正极极耳',
            type: 'draw-rect',
            category: 'basic',
            x: 12,
            y: 0,
            width: 12,
            height: 6,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1, borderRadius: 1 }
          },
          // 右负极极耳 (贴顶 x: 46 到 58, y: 0 到 6)
          {
            id: 'bess-pole-neg',
            name: '负极极耳',
            type: 'draw-rect',
            category: 'basic',
            x: 46,
            y: 0,
            width: 12,
            height: 6,
            rotation: 0,
            zIndex: 2,
            style: { fill: '#3b82f6', stroke: '#3b82f6', strokeWidth: 1, borderRadius: 1 }
          },
          // 电池集装箱主体 (贴左贴右贴底 x: 0 到 70, y: 6 到 50)
          {
            id: 'bess-case',
            name: '模组外壳',
            type: 'draw-rect',
            category: 'basic',
            x: 0,
            y: 6,
            width: 70,
            height: 44,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(15, 23, 42, 0.85)', stroke: '#00f2ff', strokeWidth: 2, borderRadius: 4 }
          },
          // 内部多层电芯指示条
          {
            id: 'bess-cell-1',
            name: '电芯层1',
            type: 'draw-rect',
            category: 'basic',
            x: 8,
            y: 14,
            width: 54,
            height: 6,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(0, 242, 255, 0.5)', stroke: '#00f2ff', strokeWidth: 1 }
          },
          {
            id: 'bess-cell-2',
            name: '电芯层2',
            type: 'draw-rect',
            category: 'basic',
            x: 8,
            y: 24,
            width: 54,
            height: 6,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(0, 242, 255, 0.5)', stroke: '#00f2ff', strokeWidth: 1 }
          },
          {
            id: 'bess-cell-3',
            name: '电芯层3',
            type: 'draw-rect',
            category: 'basic',
            x: 8,
            y: 34,
            width: 54,
            height: 6,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(0, 242, 255, 0.5)', stroke: '#00f2ff', strokeWidth: 1 }
          }
        ]
      }
    ],
    tags: ['储能', '电池', 'BESS', '锂电']
  },

  // -------------------------------------------------------------
  // 13. 光伏逆变升压一体机 PCS
  // -------------------------------------------------------------
  {
    id: 'cell-elec-pcs',
    name: '光伏逆变升压一体机 PCS',
    category: 'electrical',
    iconName: 'Zap',
    description: '光伏电站集散式逆变一体机，由外壳、对角分割线与交直流标识组合，0边距贴边',
    defaultWidth: 80,
    defaultHeight: 50,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '发电并网中',
        matchValue: '1',
        children: [
          // 逆变外壳 (贴顶贴底贴左贴右 x: 0 到 80, y: 0 到 50)
          {
            id: 'pcs-case',
            name: '逆变器机壳',
            type: 'draw-rect',
            category: 'basic',
            x: 0,
            y: 0,
            width: 80,
            height: 50,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(15, 23, 42, 0.85)', stroke: '#10b981', strokeWidth: 2, borderRadius: 4 }
          },
          // 对角分割线
          {
            id: 'pcs-diag-line',
            name: '对角分割线',
            type: 'draw-line',
            category: 'basic',
            x: 0,
            y: 0,
            width: 80,
            height: 50,
            rotation: 0,
            zIndex: 2,
            style: { stroke: '#10b981', strokeWidth: 1.5 },
            customProps: { points: [{ xRatio: 0, yRatio: 1, x: 0, y: 50 }, { xRatio: 1, yRatio: 0, x: 80, y: 0 }] }
          },
          // 左下 DC 直流铭牌
          {
            id: 'pcs-text-dc',
            name: 'DC标识',
            type: 'draw-text',
            category: 'basic',
            x: 8,
            y: 24,
            width: 24,
            height: 18,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'transparent', fontSize: 13, textColor: '#10b981', fontWeight: 'bold' },
            customProps: { text: 'DC' }
          },
          // 右上 AC 交流铭牌
          {
            id: 'pcs-text-ac',
            name: 'AC标识',
            type: 'draw-text',
            category: 'basic',
            x: 48,
            y: 8,
            width: 24,
            height: 18,
            rotation: 0,
            zIndex: 3,
            style: { fill: 'transparent', fontSize: 13, textColor: '#10b981', fontWeight: 'bold' },
            customProps: { text: 'AC' }
          }
        ]
      }
    ],
    tags: ['光伏', '逆变器', 'PCS', '并网']
  },

  // -------------------------------------------------------------
  // 14. 工业储罐与液位槽
  // -------------------------------------------------------------
  {
    id: 'cell-ind-tank',
    name: '工业储罐与液位槽',
    category: 'industrial',
    iconName: 'Database',
    description: '工业储液罐，外壁大圆角几何框与罐内动液位，0边距',
    defaultWidth: 60,
    defaultHeight: 80,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2
    },
    states: [
      {
        id: '1',
        name: '储液工况',
        matchValue: '1',
        children: [
          // 储罐主体框 (贴顶贴底贴左贴右 x: 0 到 60, y: 0 到 80)
          {
            id: 'tank-body',
            name: '储罐外壁',
            type: 'draw-rect',
            category: 'basic',
            x: 0,
            y: 0,
            width: 60,
            height: 80,
            rotation: 0,
            zIndex: 1,
            style: { fill: 'rgba(15, 23, 42, 0.7)', stroke: '#00f2ff', strokeWidth: 2, borderRadius: 10 }
          },
          // 罐内液位
          {
            id: 'tank-liquid',
            name: '液体液面',
            type: 'draw-rect',
            category: 'basic',
            x: 4,
            y: 30,
            width: 52,
            height: 46,
            rotation: 0,
            zIndex: 2,
            style: { fill: 'rgba(0, 242, 255, 0.35)', stroke: '#00f2ff', strokeWidth: 1, borderRadius: 6 }
          }
        ]
      }
    ],
    tags: ['储罐', '液位', '油水罐', '化工']
  }
];
