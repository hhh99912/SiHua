import { ComponentDefinition } from './componentLibrary';

export interface MicroPartDefinition {
  type: string;
  category: 'basic' | 'electrical';
  subCategory?: string;
  name: string;
  nameEn: string;
  iconName: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultStyle: any;
  defaultCustomProps?: any;
}

export const ELECTRICAL_MICRO_PARTS: MicroPartDefinition[] = [
  {
    type: 'draw-rect',
    category: 'electrical',
    subCategory: 'chassis',
    name: 'KYN28手车活动底盘框',
    nameEn: 'Handcart Chassis Frame',
    iconName: 'Square',
    description: '标准抽出式手车活动双轨底盘框，用于断路器/PT/隔离手车承载',
    defaultWidth: 80,
    defaultHeight: 90,
    defaultStyle: {
      fill: 'rgba(15, 23, 42, 0.75)',
      stroke: '#00f2ff',
      strokeWidth: 1.5,
      strokeDasharray: '4,3',
      borderRadius: 4
    }
  },
  {
    type: 'draw-line',
    category: 'electrical',
    subCategory: 'contacts',
    name: '动触头滑动插头',
    nameEn: 'Moving Contact Plug',
    iconName: 'Minus',
    description: '手车进出线动插头导电杆，用于对插进出线套管',
    defaultWidth: 6,
    defaultHeight: 24,
    defaultStyle: {
      stroke: '#ef4444',
      strokeWidth: 4
    },
    defaultCustomProps: {
      points: [
        { xRatio: 0.5, yRatio: 0, x: 3, y: 0 },
        { xRatio: 0.5, yRatio: 1, x: 3, y: 24 }
      ]
    }
  },
  {
    type: 'draw-rect',
    category: 'electrical',
    subCategory: 'contacts',
    name: '静触头插头套管(插座)',
    nameEn: 'Fixed Contact Bushing Socket',
    iconName: 'Square',
    description: '开关柜母线侧/电缆侧固定梅花触头盒套管',
    defaultWidth: 16,
    defaultHeight: 12,
    defaultStyle: {
      fill: 'rgba(239, 68, 68, 0.35)',
      stroke: '#ef4444',
      strokeWidth: 2,
      borderRadius: 2
    }
  },
  {
    type: 'draw-rect',
    category: 'electrical',
    subCategory: 'breaker-unit',
    name: '真空灭弧室灭弧筒',
    nameEn: 'Vacuum Interrupter Chamber',
    iconName: 'Square',
    description: '真空断路器核心陶瓷灭弧室，带内嵌灭弧栅符号',
    defaultWidth: 40,
    defaultHeight: 50,
    defaultStyle: {
      fill: 'rgba(239, 68, 68, 0.2)',
      stroke: '#ef4444',
      strokeWidth: 2,
      borderRadius: 4
    }
  },
  {
    type: 'draw-line',
    category: 'electrical',
    subCategory: 'disconnector',
    name: '动触刀(合闸位置)',
    nameEn: 'Moving Blade (Closed)',
    iconName: 'Minus',
    description: '隔离开关/接地刀处于闭合导通状态的动触刀',
    defaultWidth: 6,
    defaultHeight: 40,
    defaultStyle: {
      stroke: '#ef4444',
      strokeWidth: 3.5
    },
    defaultCustomProps: {
      points: [
        { xRatio: 0.5, yRatio: 0, x: 3, y: 0 },
        { xRatio: 0.5, yRatio: 1, x: 3, y: 40 }
      ]
    }
  },
  {
    type: 'draw-line',
    category: 'electrical',
    subCategory: 'disconnector',
    name: '动触刀(分闸45°斜刀)',
    nameEn: 'Moving Blade (Open 45deg)',
    iconName: 'Minus',
    description: '隔离开关处于断开45度安全隔离断口状态的动触刀',
    defaultWidth: 30,
    defaultHeight: 30,
    defaultStyle: {
      stroke: '#10b981',
      strokeWidth: 3.5
    },
    defaultCustomProps: {
      points: [
        { xRatio: 0, yRatio: 1, x: 0, y: 30 },
        { xRatio: 1, yRatio: 0, x: 30, y: 0 }
      ]
    }
  },
  {
    type: 'draw-polyline',
    category: 'electrical',
    subCategory: 'grounding',
    name: '三阶接地开关刀排',
    nameEn: 'Three-Stage Grounding Bar',
    iconName: 'Workflow',
    description: '符合国标的三阶递减高压接地极铜排',
    defaultWidth: 32,
    defaultHeight: 28,
    defaultStyle: {
      stroke: '#10b981',
      strokeWidth: 2.5,
      lineType: 'step-horizontal'
    },
    defaultCustomProps: {
      points: [
        { xRatio: 0.5, yRatio: 0, x: 16, y: 0 },
        { xRatio: 0.5, yRatio: 0.4, x: 16, y: 11 },
        { xRatio: 0, yRatio: 0.4, x: 0, y: 11 },
        { xRatio: 1, yRatio: 0.4, x: 32, y: 11 },
        { xRatio: 0.5, yRatio: 0.7, x: 16, y: 20 },
        { xRatio: 0.2, yRatio: 0.7, x: 6, y: 20 },
        { xRatio: 0.8, yRatio: 0.7, x: 26, y: 20 },
        { xRatio: 0.5, yRatio: 1, x: 16, y: 28 },
        { xRatio: 0.35, yRatio: 1, x: 11, y: 28 },
        { xRatio: 0.65, yRatio: 1, x: 21, y: 28 }
      ]
    }
  },
  {
    type: 'draw-rect',
    category: 'electrical',
    subCategory: 'fuse',
    name: 'PT高压熔断器FU',
    nameEn: 'PT HV Fuse FU',
    iconName: 'Square',
    description: '电压互感器一次高压限流熔断器FU保护管',
    defaultWidth: 16,
    defaultHeight: 44,
    defaultStyle: {
      fill: 'rgba(245, 158, 11, 0.25)',
      stroke: '#f59e0b',
      strokeWidth: 2,
      borderRadius: 3
    }
  },
  {
    type: 'draw-circle',
    category: 'electrical',
    subCategory: 'transformer',
    name: '变压器绕组线圈',
    nameEn: 'Transformer Winding Coil',
    iconName: 'Circle',
    description: '标准相交变压器绕组圆圈，可多个正交相扣组合三绕组',
    defaultWidth: 40,
    defaultHeight: 40,
    defaultStyle: {
      fill: 'rgba(0, 242, 255, 0.1)',
      stroke: '#00f2ff',
      strokeWidth: 2.5
    }
  },
  {
    type: 'draw-line',
    category: 'electrical',
    subCategory: 'busbar',
    name: '标准贯通母排(横)',
    nameEn: 'Busbar Horizontal',
    iconName: 'Minus',
    description: '主回路加粗一次贯通铜母排(横向)',
    defaultWidth: 120,
    defaultHeight: 6,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 4
    },
    defaultCustomProps: {
      points: [
        { xRatio: 0, yRatio: 0.5, x: 0, y: 3 },
        { xRatio: 1, yRatio: 0.5, x: 120, y: 3 }
      ]
    }
  },
  {
    type: 'draw-line',
    category: 'electrical',
    subCategory: 'busbar',
    name: '标准贯通母排(竖)',
    nameEn: 'Busbar Vertical',
    iconName: 'Minus',
    description: '主回路加粗一次贯通铜母排(纵向引下线)',
    defaultWidth: 6,
    defaultHeight: 100,
    defaultStyle: {
      stroke: '#00f2ff',
      strokeWidth: 4
    },
    defaultCustomProps: {
      points: [
        { xRatio: 0.5, yRatio: 0, x: 3, y: 0 },
        { xRatio: 0.5, yRatio: 1, x: 3, y: 100 }
      ]
    }
  }
];
