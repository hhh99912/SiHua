<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import {
  Monitor,
  Play,
  Pause,
  Database,
  Code,
  Eye,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Trash2,
  LayoutTemplate,
  ChevronDown,
  Check,
  FolderOpen,
  MousePointer,
  Workflow,
  Laptop,
  Radio,
  Grid,
  Magnet,
  Maximize,
  Crop,
  Crosshair,
  Grid3X3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Layers,
  Lock,
  Unlock,
  BookmarkPlus,
  MoveRight,
  Target,
  HardDrive,
  Save,
  Square,
  Circle,
  Triangle,
  Hexagon,
  Star,
  Diamond,
  Sparkles,
  Type,
  ToggleRight,
  CircleDot,
  Octagon,
  Scaling,
  MoveHorizontal,
  MoveVertical,
  FilePlus,
  FolderSync,
  LogOut,
  HelpCircle,
  Clock,
  Zap,
  Sliders,
  TrendingUp,
  Bell,
  Lightbulb,
  Network,
  PenTool,
  LayoutGrid,
  Ruler as RulerIcon,
  Minus,
  Copy,
  X,
  Power,
  LineChart,
  History,
  FileSpreadsheet
} from 'lucide-vue-next';
import { ScreenConfig, ScreenComponent } from '../types';
import { detectPlatform, windowToggleFullscreen } from '../utils/platform';

interface Props {
  screen: ScreenConfig;
  zoom: number;
  isStreaming: boolean;
  canUndo: boolean;
  canRedo: boolean;
  drawTool?: string;
  activeShapeType?: string;
  selectedIds?: string[];
  selectedComponents?: ScreenComponent[];
  showGrid?: boolean;
  gridSize?: number;
  snapToGrid?: boolean;
  orthogonalLock?: boolean;
  showRuler?: boolean;
  isMaximized?: boolean;
  windowTitle?: string;
  isElectron?: boolean;
  drawingPreset?: {
    stroke: string;
    fill: string;
    fillOpacity?: number;
    strokeWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

const props = withDefaults(defineProps<Props>(), {
  drawTool: 'select',
  activeShapeType: '',
  selectedIds: () => [],
  selectedComponents: () => [],
  showGrid: true,
  gridSize: 40,
  snapToGrid: false,
  orthogonalLock: false,
  showRuler: false,
  isMaximized: true,
  windowTitle: '图形编辑界面 (SCADA Studio)',
  isElectron: false,
  drawingPreset: () => ({
    stroke: '#00f2ff',
    fill: 'transparent',
    fillOpacity: 1,
    strokeWidth: 2,
    lineStyle: 'solid',
    fontSize: 14,
    fontWeight: 'bold'
  })
});

const emit = defineEmits<{
  (e: 'update:screen', value: ScreenConfig): void;
  (e: 'update:zoom', value: number): void;
  (e: 'update:drawTool', tool: string): void;
  (e: 'select:shape', shapeType: string): void;
  (e: 'update:showGrid', value: boolean): void;
  (e: 'update:gridSize', value: number): void;
  (e: 'update:snapToGrid', value: boolean): void;
  (e: 'update:orthogonalLock', value: boolean): void;
  (e: 'update:showRuler', value: boolean): void;
  (e: 'toggle:streaming'): void;
  (e: 'save:screen'): void;
  (e: 'open:preview'): void;
  (e: 'open:datasets'): void;
  (e: 'open:control'): void;
  (e: 'open:disk-storage'): void;
  (e: 'open:symbols'): void;
  (e: 'open:platform'): void;
  (e: 'open:login'): void;
  (e: 'load:template', templateId: string): void;
  (e: 'clear:canvas'): void;
  (e: 'fit:screen'): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'align', direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v' | 'equal-width' | 'equal-height' | 'equal-size' | 'equal-max-size' | 'equal-min-size' | 'make-square'): void;
  (e: 'group'): void;
  (e: 'ungroup'): void;
  (e: 'lock'): void;
  (e: 'unlock'): void;
  (e: 'save:symbol'): void;
  (e: 'center:all'): void;
  (e: 'snap:all'): void;
  (e: 'open:window', id: string): void;
  (e: 'tile:windows'): void;
  (e: 'cascade:windows'): void;
  (e: 'minimize:window'): void;
  (e: 'restore:window'): void;
  (e: 'maximize:window'): void;
  (e: 'close:window'): void;
  (e: 'exit:app'): void;
  (e: 'update:drawing-style', payload: {
    key: 'stroke' | 'fill' | 'fillOpacity' | 'strokeWidth' | 'lineStyle' | 'fontSize' | 'fontWeight';
    value: any;
  }): void;
}>();

const currentPlatform = detectPlatform();

// Active dropdown state for classic menu bar
const activeMenu = ref<string | null>(null);

const toggleMenu = (menuKey: string) => {
  activeMenu.value = activeMenu.value === menuKey ? null : menuKey;
};

const closeMenus = () => {
  activeMenu.value = null;
};

// Canvas Background Presets
const bgPresets = [
  { name: '电力深蓝', value: '#080f1e', desc: '经典调度电网主接线深蓝底色' },
  { name: '工业纯黑', value: '#000000', desc: '高对比度 SCADA 工业黑' },
  { name: '科技深灰', value: '#111827', desc: '现代变电站暗色高反差背景' },
  { name: '工程灰蓝', value: '#0f223d', desc: '传统综自系统工程灰蓝背景' },
  { name: '浅灰图纸', value: '#f8fafc', desc: '日间明亮模式/电气打印底色' },
  { name: '纯白底图', value: '#ffffff', desc: 'CAD标准纯白图纸' },
];

const handleSetBgColor = (color: string) => {
  emit('update:screen', {
    ...props.screen,
    backgroundColor: color
  });
};

// Basic Geometric Primitives Toolbar Data (GE-SCADA Clean CAD Style)
const basicGeometryTools = [
  { type: 'draw-rect', name: '矩形底座', icon: Square, desc: '矩形底座：单击选中后在屏幕拖拽确定起止点' },
  { type: 'draw-square', name: '正方形', icon: Square, desc: '正方形：等宽高 1:1 绘制' },
  { type: 'draw-rounded-rect', name: '圆角矩形', icon: Square, isRounded: true, desc: '圆角矩形卡片：确定起止点' },
  { type: 'draw-circle', name: '正圆形', icon: Circle, desc: '正圆形：等宽高 1:1 绘制' },
  { type: 'draw-ellipse', name: '椭圆形', icon: CircleDot, desc: '椭圆形：确定起止点' },
  { type: 'draw-triangle', name: '正三角形', icon: Triangle, desc: '正三角形：确定起止点' },
  { type: 'draw-triangle-down', name: '倒三角形', icon: Triangle, isDown: true, desc: '倒三角形：确定起止点' },
  { type: 'draw-triangle-right', name: '向右三角形', icon: Play, desc: '向右三角形(流向)：确定起止点' },
  { type: 'draw-diamond', name: '菱形判定框', icon: Diamond, desc: '菱形：确定起止点' },
  { type: 'draw-pentagon', name: '正五边形', icon: Hexagon, desc: '五边形：确定起止点' },
  { type: 'draw-hexagon', name: '六边形蜂巢', icon: Hexagon, desc: '六边形：确定起止点' },
  { type: 'draw-octagon', name: '八边形', icon: Octagon, desc: '八边形：确定起止点' },
  { type: 'draw-star', name: '五角星', icon: Star, desc: '五角星：确定起止点' },
  { type: 'draw-star4', name: '四角芒星', icon: Sparkles, desc: '四角芒星：确定起止点' },
  { type: 'draw-trapezoid', name: '等腰梯形', icon: Layers, desc: '等腰梯形：确定起止点' },
  { type: 'draw-text', name: '静态文本', icon: Type, desc: '静态文字标牌：确定起止点' },
  { type: 'ctrl-button', name: '控制按钮', icon: ToggleRight, desc: '工业控制按钮：确定起止点' }
];

// Fullscreen Control
const isFullscreen = ref(typeof document !== 'undefined' && Boolean(document.fullscreenElement));

const handleFullscreenToggle = async () => {
  const state = await windowToggleFullscreen();
  isFullscreen.value = typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : state;
};

const handleFullscreenChange = () => {
  if (typeof document !== 'undefined') {
    isFullscreen.value = Boolean(document.fullscreenElement);
  }
};

const handleGlobalClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.prs-menu-container')) {
    closeMenus();
  }
};

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  window.addEventListener('click', handleGlobalClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
  window.removeEventListener('click', handleGlobalClick);
});

// =========================================================================
// 顶栏动态属性工具条 (常规绘图样式与预设/选中双模式)
// =========================================================================
const isSelectionMode = computed(() => (props.selectedIds?.length || 0) > 0);

const activeDrawingStyle = computed(() => {
  if (props.selectedComponents && props.selectedComponents.length >= 1) {
    const c = props.selectedComponents[0];
    const st = c.style || {};
    return {
      stroke: st.stroke || st.borderColor || props.drawingPreset?.stroke || '#00f2ff',
      fill: st.fill || st.bgColor || props.drawingPreset?.fill || 'transparent',
      fillOpacity: st.fillOpacity !== undefined ? Number(st.fillOpacity) : (props.drawingPreset?.fillOpacity !== undefined ? Number(props.drawingPreset.fillOpacity) : 1),
      strokeWidth: typeof st.strokeWidth === 'number' ? st.strokeWidth : (typeof st.borderWidth === 'number' ? st.borderWidth : (props.drawingPreset?.strokeWidth || 2)),
      lineStyle: (st.lineStyle as 'solid' | 'dashed' | 'dotted') || props.drawingPreset?.lineStyle || 'solid',
      fontSize: typeof st.fontSize === 'number' && st.fontSize > 0 ? st.fontSize : (props.drawingPreset?.fontSize || 14),
      fontWeight: (st.fontWeight as 'normal' | 'bold') || props.drawingPreset?.fontWeight || 'bold'
    };
  }
  return {
    stroke: props.drawingPreset?.stroke || '#00f2ff',
    fill: props.drawingPreset?.fill || 'transparent',
    fillOpacity: props.drawingPreset?.fillOpacity !== undefined ? Number(props.drawingPreset.fillOpacity) : 1,
    strokeWidth: props.drawingPreset?.strokeWidth || 2,
    lineStyle: props.drawingPreset?.lineStyle || 'solid',
    fontSize: props.drawingPreset?.fontSize || 14,
    fontWeight: props.drawingPreset?.fontWeight || 'bold'
  };
});

const handleStyleChange = (key: 'stroke' | 'fill' | 'fillOpacity' | 'strokeWidth' | 'lineStyle' | 'fontSize' | 'fontWeight', value: any) => {
  emit('update:drawing-style', { key, value });
};

const standardPalette = [
  '#00f2ff', // 工业青
  '#00e5a3', // 电力绿
  '#eab308', // 调度黄
  '#ef4444', // 警示红
  '#ffffff', // 纯白
  '#94a3b8', // 灰度
  '#1e293b', // 暗蓝
  '#000000'  // 纯黑
];
</script>

<template>
  <!-- GE-SCADA 标准图形编辑界面顶部导航与菜单工具栏 (护眼暖白/米白主题背景) -->
  <header class="bg-[#ebe4d4] border-b border-[#cfc5b0] px-3 py-1 flex flex-col gap-1 select-none z-40 relative shadow-xs text-slate-800 font-sans">
    <!-- ========================================================================= -->
    <!-- Row 1: 系统标题、标准下拉菜单栏、当前大屏名称与运行控制 (柔和暖白) -->
    <!-- ========================================================================= -->
    <div class="flex items-center justify-between h-11 prs-menu-container">
      <!-- Left: KND科能达 品牌标识与标准顶级菜单行 (文件/编辑/视图/格式/图元/数据/运行/帮助) -->
      <div class="flex items-center gap-3">
        <!-- 品牌标识 (用户指定：(KND)科能达，红圈包裹更圆润) -->
        <div class="flex items-center gap-2 pr-3 border-r border-[#cfc5b0] select-none shrink-0">
          <div class="px-2 py-0.5 rounded-full bg-[#d81e06] text-white flex items-center justify-center font-bold text-xs shadow-2xs tracking-wide">
            KND
          </div>
          <span class="text-[#d81e06] font-bold tracking-wide text-[17px]">
            科能达
          </span>
        </div>

        <!-- 经典顶级下拉菜单列表 (删除英文后缀) -->
        <nav class="flex items-center gap-1 text-[15px] text-slate-800 font-medium relative tracking-wide">
          <!-- 1. 文件 -->
          <div class="relative">
            <button
              @click.stop="toggleMenu('file')"
              class="px-3 py-1.5 rounded hover:bg-[#e4dcce] text-slate-800 transition-colors flex items-center gap-1 cursor-pointer tracking-wide"
              :class="{ 'bg-[#e4dcce] text-sky-700': activeMenu === 'file' }"
            >
              <span>文件</span>
              <ChevronDown class="w-4 h-4 text-slate-400" />
            </button>
            <div
              v-if="activeMenu === 'file'"
              class="absolute left-0 top-full mt-1 w-64 bg-[#f2eee3] border border-[#cfc5b0] rounded-lg shadow-xl py-1 z-50 text-[14px] text-slate-800 divide-y divide-[#ded5bf] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="emit('save:screen'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span class="flex items-center gap-2.5">
                    <Save class="w-4.5 h-4.5 text-sky-600" />
                    <span>保存当前画面</span>
                  </span>
                  <span class="text-xs text-slate-400 font-mono">Ctrl+S</span>
                </button>
                <button
                  @click="emit('open:disk-storage'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span class="flex items-center gap-2.5">
                    <HardDrive class="w-4.5 h-4.5 text-sky-600" />
                    <span>磁盘文件管理 (graph/)</span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- 2. 编辑 -->
          <div class="relative">
            <button
              @click.stop="toggleMenu('edit')"
              class="px-3 py-1.5 rounded hover:bg-[#e4dcce] text-slate-800 transition-colors flex items-center gap-1 cursor-pointer tracking-wide"
              :class="{ 'bg-[#e4dcce] text-sky-700': activeMenu === 'edit' }"
            >
              <span>编辑</span>
              <ChevronDown class="w-4 h-4 text-slate-400" />
            </button>
            <div
              v-if="activeMenu === 'edit'"
              class="absolute left-0 top-full mt-1 w-60 bg-[#f2eee3] border border-[#cfc5b0] rounded-lg shadow-xl py-1 z-50 text-[14px] text-slate-800 divide-y divide-[#ded5bf] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="emit('undo'); closeMenus();"
                  :disabled="!canUndo"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <span class="flex items-center gap-2.5"><Undo2 class="w-4.5 h-4.5 text-slate-500" />撤销</span>
                  <span class="text-xs text-slate-400 font-mono">Ctrl+Z</span>
                </button>
                <button
                  @click="emit('redo'); closeMenus();"
                  :disabled="!canRedo"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <span class="flex items-center gap-2.5"><Redo2 class="w-4.5 h-4.5 text-slate-500" />重做</span>
                  <span class="text-xs text-slate-400 font-mono">Ctrl+Y</span>
                </button>
              </div>
              <div class="py-1">
                <button
                  @click="emit('group'); closeMenus();"
                  :disabled="(selectedIds?.length || 0) < 2"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <span class="flex items-center gap-2.5"><Layers class="w-4.5 h-4.5 text-sky-600" />组合成图符</span>
                  <span class="text-xs text-slate-400 font-mono">Ctrl+G</span>
                </button>
                <button
                  @click="emit('ungroup'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span class="flex items-center gap-2.5"><Unlock class="w-4.5 h-4.5 text-amber-600" />取消组合</span>
                  <span class="text-xs text-slate-400 font-mono">Ctrl+U</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 3. 视图 -->
          <div class="relative">
            <button
              @click.stop="toggleMenu('view')"
              class="px-3 py-1.5 rounded hover:bg-[#e4dcce] text-slate-800 transition-colors flex items-center gap-1 cursor-pointer tracking-wide"
              :class="{ 'bg-[#e4dcce] text-sky-700': activeMenu === 'view' }"
            >
              <span>视图</span>
              <ChevronDown class="w-4 h-4 text-slate-400" />
            </button>
            <div
              v-if="activeMenu === 'view'"
              class="absolute left-0 top-full mt-1 w-64 bg-[#f2eee3] border border-[#cfc5b0] rounded-lg shadow-xl py-1 z-50 text-[14px] text-slate-800 tracking-wide"
            >
              <button
                @click="emit('update:showGrid', !showGrid); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
              >
                <span class="flex items-center gap-2.5"><Grid class="w-4.5 h-4.5 text-slate-500" />显示网格底点</span>
                <Check v-if="showGrid" class="w-4.5 h-4.5 text-sky-600" />
              </button>
              <button
                @click="emit('update:snapToGrid', !snapToGrid); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
              >
                <span class="flex items-center gap-2.5"><Magnet class="w-4.5 h-4.5 text-slate-500" />磁性吸附网格</span>
                <Check v-if="snapToGrid" class="w-4.5 h-4.5 text-sky-600" />
              </button>
              <button
                @click="emit('update:showRuler', !showRuler); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
              >
                <span class="flex items-center gap-2.5"><RulerIcon class="w-4.5 h-4.5 text-slate-500" />显示像素标尺</span>
                <Check v-if="showRuler" class="w-4.5 h-4.5 text-sky-600" />
              </button>
              <button
                @click="emit('update:orthogonalLock', !orthogonalLock); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
              >
                <span class="flex items-center gap-2.5"><Maximize class="w-4.5 h-4.5 text-slate-500" />正交锁定走线</span>
                <Check v-if="orthogonalLock" class="w-4.5 h-4.5 text-sky-600" />
              </button>
              <div class="my-1 border-t border-[#ded5bf]" />
              <button
                @click="emit('fit:screen'); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
              >
                <span class="flex items-center gap-2.5"><Crosshair class="w-4.5 h-4.5 text-sky-600" />适应屏幕居中</span>
              </button>
            </div>
          </div>

          <!-- 4. 排列对齐 -->
          <div class="relative">
            <button
              @click.stop="toggleMenu('align')"
              class="px-3 py-1.5 rounded hover:bg-[#e4dcce] text-slate-800 transition-colors flex items-center gap-1 cursor-pointer tracking-wide"
              :class="{ 'bg-[#e4dcce] text-sky-700': activeMenu === 'align' }"
            >
              <span>排列</span>
              <ChevronDown class="w-4 h-4 text-slate-400" />
            </button>
            <div
              v-if="activeMenu === 'align'"
              class="absolute left-0 top-full mt-1 w-60 bg-[#f2eee3] border border-[#cfc5b0] rounded-lg shadow-xl py-1 z-50 text-[14px] text-slate-800 divide-y divide-[#ded5bf] tracking-wide"
            >
              <div class="py-1">
                <button @click="emit('align', 'left'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignLeft class="w-4.5 h-4.5 text-slate-500" /><span>左对齐</span>
                </button>
                <button @click="emit('align', 'center'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignCenter class="w-4.5 h-4.5 text-slate-500" /><span>水平居中</span>
                </button>
                <button @click="emit('align', 'right'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignRight class="w-4.5 h-4.5 text-slate-500" /><span>右对齐</span>
                </button>
              </div>
              <div class="py-1">
                <button @click="emit('align', 'top'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignVerticalJustifyStart class="w-4.5 h-4.5 text-slate-500" /><span>顶对齐</span>
                </button>
                <button @click="emit('align', 'middle'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignVerticalJustifyCenter class="w-4.5 h-4.5 text-slate-500" /><span>垂直居中</span>
                </button>
                <button @click="emit('align', 'bottom'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignVerticalJustifyEnd class="w-4.5 h-4.5 text-slate-500" /><span>底对齐</span>
                </button>
              </div>
              <div class="py-1">
                <button @click="emit('align', 'distribute-h'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignHorizontalSpaceAround class="w-4.5 h-4.5 text-slate-500" /><span>水平均匀分布</span>
                </button>
                <button @click="emit('align', 'distribute-v'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignVerticalSpaceAround class="w-4.5 h-4.5 text-slate-500" /><span>垂直均匀分布</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 5. 数据测点 -->
          <div class="relative">
            <button
              @click.stop="toggleMenu('data')"
              class="px-3 py-1.5 rounded hover:bg-[#e4dcce] text-slate-800 transition-colors flex items-center gap-1 cursor-pointer tracking-wide"
              :class="{ 'bg-[#e4dcce] text-sky-700': activeMenu === 'data' }"
            >
              <span>数据与点位</span>
              <ChevronDown class="w-4 h-4 text-slate-400" />
            </button>
            <div
              v-if="activeMenu === 'data'"
              class="absolute left-0 top-full mt-1 w-64 bg-[#f2eee3] border border-[#cfc5b0] rounded-lg shadow-xl py-1 z-50 text-[14px] text-slate-800 tracking-wide"
            >
              <button
                @click="emit('open:datasets'); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
              >
                <Database class="w-4.5 h-4.5 text-sky-600" />
                <span>数据集与测点配置中心</span>
              </button>
              <button
                @click="emit('open:symbols'); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
              >
                <FolderOpen class="w-4.5 h-4.5 text-amber-600" />
                <span>自定义多态图元工坊</span>
              </button>
            </div>
          </div>

          <!-- 6. 窗口与组态 -->
          <div class="relative">
            <button
              @click.stop="toggleMenu('window')"
              class="px-3 py-1.5 rounded hover:bg-[#e4dcce] text-slate-800 transition-colors flex items-center gap-1 cursor-pointer tracking-wide"
              :class="{ 'bg-[#e4dcce] text-sky-700': activeMenu === 'window' }"
            >
              <span>窗口与组态</span>
              <ChevronDown class="w-4 h-4 text-slate-400" />
            </button>
            <div
              v-if="activeMenu === 'window'"
              class="absolute left-0 top-full mt-1 w-72 bg-[#f2eee3] border border-[#cfc5b0] rounded-lg shadow-xl py-1 z-50 text-[14px] text-slate-800 divide-y divide-[#ded5bf] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="emit('open:window', 'graphic-editor'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <PenTool class="w-4.5 h-4.5 text-sky-600" />
                  <span>图形编辑界面</span>
                </button>
                <button
                  @click="emit('open:window', 'monitor-screen'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer text-sky-700 font-medium"
                >
                  <Zap class="w-4.5 h-4.5 text-amber-600" />
                  <span>实时监控主接线</span>
                </button>
                <button
                  @click="emit('open:window', 'alarm-window'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <Bell class="w-4.5 h-4.5 text-rose-600" />
                  <span>全站实时告警 / SOE</span>
                </button>
                <button
                  @click="emit('open:window', 'history-curve'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <LineChart class="w-4.5 h-4.5 text-indigo-600" />
                  <span>历史曲线分析</span>
                </button>
                <button
                  @click="emit('open:window', 'history-alarm'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <History class="w-4.5 h-4.5 text-orange-500" />
                  <span>历史告警记录</span>
                </button>
                <button
                  @click="emit('open:window', 'report-window'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <FileSpreadsheet class="w-4.5 h-4.5 text-emerald-600" />
                  <span>综合运行报表</span>
                </button>
              </div>

              <!-- 窗口布局管理 -->
              <div class="py-1">
                <button
                  @click="emit('tile:windows'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <LayoutGrid class="w-4.5 h-4.5 text-sky-600" />
                  <span>平铺所有组态窗口</span>
                </button>
                <button
                  @click="emit('cascade:windows'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <Layers class="w-4.5 h-4.5 text-sky-600" />
                  <span>层叠所有组态窗口</span>
                </button>
              </div>
            </div>
          </div>
        </nav>
      </div>

      <!-- Right: 当前大屏名称与运行控制 -->
      <div class="flex items-center gap-2.5 shrink-0">
        <!-- 保存当前画面 -->
        <button
          @click="emit('save:screen')"
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#ded5bf] hover:bg-[#d4caaf] hover:text-sky-800 border border-[#cfc5b0] text-slate-800 text-[13px] font-bold tracking-wide transition-colors cursor-pointer shadow-2xs"
          title="保存当前画面到磁盘 graph/ (Ctrl+S)"
        >
          <Save class="w-4 h-4 text-sky-700 stroke-[2]" />
          <span>保存</span>
        </button>

        <!-- 运行监控模式大按钮 -->
        <button
          @click="emit('open:preview')"
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#00e5a3] hover:bg-[#00c88f] text-slate-950 font-bold text-[13px] tracking-wide transition-colors cursor-pointer shadow-sm shadow-emerald-500/20 active:translate-y-0.5"
          title="退出图形编辑，进入实时电网监控主站运行环境"
        >
          <Play class="w-4 h-4 fill-slate-950" />
          <span>进入监控运行</span>
        </button>

        <!-- MDI / Electron 窗口管理控制按钮群 -->
        <div v-if="isMaximized || isElectron" class="flex items-center gap-0.5 pl-1.5 border-l border-[#cfc5b0] shrink-0">
          <button
            @click="emit('minimize:window')"
            class="w-7 h-7 rounded hover:bg-[#d4caaf] text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            title="最小化窗口"
          >
            <Minus class="w-4 h-4" />
          </button>
          <button
            @click="emit('restore:window')"
            class="w-7 h-7 rounded hover:bg-[#d4caaf] text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            title="还原窗口"
          >
            <Copy class="w-4 h-4" />
          </button>
          <button
            @click="emit('close:window')"
            class="w-7 h-7 rounded hover:bg-rose-500 hover:text-white text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            title="关闭图形编辑窗口"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Row 2: 通用功能快捷工具栏 (撤销/重做、网格/标尺/正交/居中、排列对齐、组合/锁定、画布底色、缩放全屏) -->
    <!-- ========================================================================= -->
    <div class="flex items-center justify-between bg-[#dfd6bf] border border-[#cfc5b0] px-2 py-1 rounded-md text-[13px] select-none overflow-x-auto gap-2 tracking-wide">
      <!-- Left: 通用功能快捷工具条 -->
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- 1. 撤销 / 重做 -->
        <div class="flex items-center bg-[#f2eee3] p-0.5 rounded-md border border-[#cfc5b0] shadow-2xs gap-0.5">
          <button
            @click="emit('undo')"
            :disabled="!canUndo"
            class="p-1.5 rounded transition-colors"
            :class="canUndo ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 class="w-4 h-4 stroke-[2]" />
          </button>
          <button
            @click="emit('redo')"
            :disabled="!canRedo"
            class="p-1.5 rounded transition-colors"
            :class="canRedo ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="重做 (Ctrl+Y)"
          >
            <Redo2 class="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        <div class="h-4 w-[1px] bg-[#cfc5b0] mx-0.5" />

        <!-- 2. 标尺、网格底图、磁吸吸附、网格间距下拉(多选项)、正交与适应居中 -->
        <div class="flex items-center bg-[#f2eee3] p-0.5 rounded-md border border-[#cfc5b0] shadow-2xs gap-0.5">
          <button
            @click="emit('update:showRuler', !showRuler)"
            class="p-1.5 rounded cursor-pointer transition-colors"
            :class="showRuler ? 'bg-sky-100 text-sky-800 font-medium border border-sky-300' : 'text-slate-800 hover:bg-[#e4dcce]'"
            :title="showRuler ? '标尺: 已开启' : '标尺: 已关闭'"
          >
            <RulerIcon class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('update:showGrid', !showGrid)"
            class="p-1.5 rounded cursor-pointer transition-colors"
            :class="showGrid ? 'bg-sky-100 text-sky-800 font-medium border border-sky-300' : 'text-slate-800 hover:bg-[#e4dcce]'"
            title="切换网格底图"
          >
            <Grid class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('update:snapToGrid', !snapToGrid)"
            class="p-1.5 rounded cursor-pointer transition-colors"
            :class="snapToGrid ? 'bg-sky-100 text-sky-800 font-medium border border-sky-300' : 'text-slate-800 hover:bg-[#e4dcce]'"
            :title="snapToGrid ? '网格吸附: 已开启' : '网格吸附: 已关闭'"
          >
            <Magnet class="w-4 h-4 stroke-[2]" />
          </button>

          <!-- 网格步长下拉 (丰富选项) -->
          <select 
            :value="gridSize" 
            @change="emit('update:gridSize', Number(($event.target as HTMLSelectElement).value))"
            class="bg-[#f8f5ee] hover:bg-[#f0ebe0] border border-[#cfc5b0] text-[11px] font-mono rounded px-1.5 py-0.5 text-slate-800 cursor-pointer focus:outline-hidden"
            title="网格对齐栅格像素步长 (Grid Size)"
          >
            <option :value="2">2px (精细)</option>
            <option :value="4">4px</option>
            <option :value="5">5px</option>
            <option :value="8">8px</option>
            <option :value="10">10px</option>
            <option :value="12">12px</option>
            <option :value="15">15px</option>
            <option :value="16">16px</option>
            <option :value="20">20px (常用)</option>
            <option :value="25">25px</option>
            <option :value="30">30px</option>
            <option :value="40">40px (标准)</option>
            <option :value="50">50px (宽松)</option>
          </select>

          <button
            @click="emit('update:orthogonalLock', !orthogonalLock)"
            class="p-1.5 rounded cursor-pointer transition-colors ml-0.5"
            :class="orthogonalLock ? 'bg-amber-100 text-amber-800 font-medium border border-amber-300' : 'text-slate-800 hover:bg-[#e4dcce]'"
            :title="orthogonalLock ? '正交走线锁定: 开启 (0°/90°/180°)' : '正交走线锁定: 关闭 (自由角走线)'"
          >
            <Maximize class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('fit:screen')"
            class="p-1.5 rounded cursor-pointer transition-colors text-slate-800 hover:bg-[#e4dcce]"
            title="适应屏幕并居中显示全图"
          >
            <Crosshair class="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        <div class="h-4 w-[1px] bg-[#cfc5b0] mx-0.5" />

        <!-- 3. 排列对齐工具组 (左/中/右/顶/居中/底/水平均布/垂直均布/等宽/等高) -->
        <div class="flex items-center bg-[#f2eee3] p-0.5 rounded-md border border-[#cfc5b0] shadow-2xs gap-0.5">
          <button
            @click="emit('align', 'left')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="左对齐 (至少选中2个图元)"
          >
            <AlignLeft class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('align', 'center')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="水平居中对齐"
          >
            <AlignCenter class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('align', 'right')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="右对齐"
          >
            <AlignRight class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('align', 'top')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="顶对齐"
          >
            <AlignVerticalJustifyStart class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('align', 'middle')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="垂直居中对齐"
          >
            <AlignVerticalJustifyCenter class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('align', 'bottom')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="底对齐"
          >
            <AlignVerticalJustifyEnd class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('align', 'distribute-h')"
            :disabled="(selectedIds?.length || 0) < 3"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 3 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="水平间距均布 (至少选中3个图元)"
          >
            <AlignHorizontalSpaceAround class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('align', 'distribute-v')"
            :disabled="(selectedIds?.length || 0) < 3"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 3 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="垂直间距均布 (至少选中3个图元)"
          >
            <AlignVerticalSpaceAround class="w-4 h-4 stroke-[2]" />
          </button>

          <!-- 等宽 & 等高 -->
          <button
            @click="emit('align', 'equal-width')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="统一等宽 (以首个选中的图元为基准)"
          >
            <MoveHorizontal class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('align', 'equal-height')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="统一等高 (以首个选中的图元为基准)"
          >
            <MoveVertical class="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        <div class="h-4 w-[1px] bg-[#cfc5b0] mx-0.5" />

        <!-- 4. 组合 / 取消组合、锁定 / 解锁 -->
        <div class="flex items-center bg-[#f2eee3] p-0.5 rounded-md border border-[#cfc5b0] shadow-2xs gap-0.5">
          <button
            @click="emit('group')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="成组组合 (Ctrl+G)"
          >
            <Layers class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('ungroup')"
            class="p-1.5 rounded text-slate-800 hover:bg-[#e4dcce] transition-colors cursor-pointer"
            title="取消成组 (Ctrl+U)"
          >
            <Unlock class="w-4 h-4 stroke-[2]" />
          </button>

          <div class="h-3 w-[1px] bg-[#cfc5b0] mx-0.5" />

          <!-- 锁定 / 解锁 -->
          <button
            @click="emit('lock')"
            :disabled="(selectedIds?.length || 0) === 0"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) > 0 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="锁定选中的图元 (防止误触移位)"
          >
            <Lock class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('unlock')"
            :disabled="(selectedIds?.length || 0) === 0"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) > 0 ? 'text-slate-800 hover:bg-[#e4dcce] cursor-pointer' : 'text-slate-400 cursor-not-allowed'"
            title="解锁选中的图元"
          >
            <Unlock class="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        <div class="h-4 w-[1px] bg-[#cfc5b0] mx-0.5" />

        <!-- 画布底色快速工具卡片 (放置在解锁选中图元功能键后面，卡片大小与文字大小保持统一) -->
        <div class="flex items-center bg-[#f2eee3] px-2 py-0.5 rounded-md border border-[#cfc5b0] shadow-2xs gap-1.5 h-[29px] shrink-0">
          <span class="text-[12px] text-slate-800 font-medium whitespace-nowrap">画布底色:</span>
          
          <!-- 实时拾色器 -->
          <input
            type="color"
            :value="screen.backgroundColor || '#080f1e'"
            @input="handleSetBgColor(($event.target as HTMLInputElement).value)"
            class="w-4.5 h-4.5 rounded cursor-pointer border border-[#cfc5b0] p-0 bg-transparent shrink-0"
            title="自定义画布背景颜色"
          />

          <!-- 快速推荐预设色块 -->
          <div class="flex items-center gap-1 ml-0.5">
            <button
              v-for="bg in bgPresets"
              :key="bg.value"
              @click="handleSetBgColor(bg.value)"
              class="w-3.5 h-3.5 rounded border border-black/30 hover:scale-125 transition-transform cursor-pointer shrink-0"
              :style="{ backgroundColor: bg.value }"
              :title="bg.name + ' - ' + bg.desc"
            />
          </div>
        </div>
      </div>

      <!-- Right: 缩放与全屏控制 (从第三行移到第二行) -->
      <div class="flex items-center gap-1.5 shrink-0">
        <div class="flex items-center bg-[#f2eee3] p-0.5 rounded-md border border-[#cfc5b0] shadow-2xs text-[13px] font-mono gap-0.5">
          <button
            @click="emit('update:zoom', Math.max(0.1, Number((zoom - 0.1).toFixed(2))))"
            class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-700 cursor-pointer transition-colors"
            title="缩小画面"
          >
            <ZoomOut class="w-4 h-4 stroke-[2]" />
          </button>
          
          <span class="text-xs font-mono font-medium text-slate-900 bg-[#e5decb] border border-[#cfc5b0] rounded px-2 py-0.5 w-14 text-center tracking-wider">
            {{ Math.round(zoom * 100) }}%
          </span>
          
          <button
            @click="emit('update:zoom', Math.min(2.5, Number((zoom + 0.1).toFixed(2))))"
            class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-700 cursor-pointer transition-colors"
            title="放大画面"
          >
            <ZoomIn class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="handleFullscreenToggle"
            class="p-1.5 rounded cursor-pointer transition-colors ml-0.5"
            :class="isFullscreen ? 'bg-sky-100 text-sky-800 font-medium' : 'text-slate-700 hover:bg-[#e4dcce]'"
            :title="isFullscreen ? '退出全屏 (ESC / F11)' : '全屏显示 (F11)'"
          >
            <Minimize2 v-if="isFullscreen" class="w-4 h-4 stroke-[2]" />
            <Maximize2 v-else class="w-4 h-4 stroke-[2]" />
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- Row 3: 绘图图元工具与动态属性样式工具条 (全部左对齐，紧挨在基础图元后面，字体放大放粗) -->
    <!-- ========================================================================= -->
    <div class="flex items-center justify-start bg-[#e5decb] border border-[#cfc5b0] px-2.5 py-1.5 rounded-lg text-[13px] select-none overflow-x-auto gap-2 tracking-wide">
      <!-- 1. 交互指针模式 (选择 / 折线 / 导向箭头) -->
      <div class="flex items-center bg-[#f2eee3] p-0.5 rounded-md border border-[#cfc5b0] shadow-2xs gap-0.5 shrink-0">
        <button
          @click="emit('update:drawTool', 'select')"
          class="p-1.5 rounded transition-colors cursor-pointer"
          :class="drawTool === 'select' 
            ? 'bg-sky-100 text-sky-800 font-bold border border-sky-300' 
            : 'text-slate-600 hover:text-slate-900 hover:bg-[#e4dcce]'"
          title="选择指针 (V / ESC): 框选/平移/缩放图元"
        >
          <MousePointer class="w-4.5 h-4.5 stroke-[2.2]" />
        </button>

        <button
          @click="emit('update:drawTool', 'draw-polyline')"
          class="p-1.5 rounded transition-colors cursor-pointer"
          :class="drawTool === 'draw-polyline' 
            ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300' 
            : 'text-slate-600 hover:text-slate-900 hover:bg-[#e4dcce]'"
          title="绘制母线/折线 (L): 连续拐点，双击结束"
        >
          <Workflow class="w-4.5 h-4.5 stroke-[2.2]" />
        </button>

        <button
          @click="emit('update:drawTool', 'draw-arrow')"
          class="p-1.5 rounded transition-colors cursor-pointer"
          :class="drawTool === 'draw-arrow' 
            ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300' 
            : 'text-slate-600 hover:text-slate-900 hover:bg-[#e4dcce]'"
          title="绘制导向箭头: 起点到终点"
        >
          <MoveRight class="w-4.5 h-4.5 stroke-[2.2]" />
        </button>
      </div>

      <div class="h-4 w-[1px] bg-[#cfc5b0] mx-0.5 shrink-0" />

      <!-- 2. 基础几何图元快捷按钮组 (矩形/正方形/正圆/椭圆/三角/菱形等) -->
      <div class="flex items-center bg-[#f2eee3] p-0.5 rounded-md border border-[#cfc5b0] shadow-2xs gap-0.5 shrink-0">
        <button
          v-for="geo in basicGeometryTools"
          :key="geo.type"
          @click="emit('select:shape', geo.type)"
          class="p-1.5 rounded transition-colors cursor-pointer"
          :class="drawTool === 'place-component' && activeShapeType === geo.type
            ? 'bg-sky-100 text-sky-800 font-bold border border-sky-300' 
            : 'text-slate-600 hover:text-slate-900 hover:bg-[#e4dcce]'"
          :title="geo.desc"
        >
          <component 
            :is="geo.icon" 
            class="w-4 h-4 stroke-[2.2]" 
            :class="{ 
              'rounded-xs': geo.isRounded, 
              'rotate-180': geo.isDown,
              'rotate-90': geo.type === 'draw-triangle-right'
            }" 
          />
        </button>
      </div>

      <div class="h-4 w-[1px] bg-[#cfc5b0] mx-0.5 shrink-0" />

      <!-- 3. 动态画笔与图元样式属性工具条 (紧挨在基础图元后面，左对齐，删掉选中同步字样，字体放大放粗) -->
      <div class="flex items-center shrink-0">
        <div class="flex items-center bg-[#f2eee3] px-2.5 py-1 rounded-md border border-[#cfc5b0] shadow-2xs gap-2.5">
          <!-- A. 线条颜色 (Stroke Color) -->
          <div class="flex items-center gap-1.5" title="线条颜色 (多选/单选一键同步)">
            <span class="text-[13px] text-slate-800 font-bold tracking-wide">线色:</span>
            <input
              type="color"
              :value="activeDrawingStyle.stroke"
              @input="handleStyleChange('stroke', ($event.target as HTMLInputElement).value)"
              class="w-5.5 h-5.5 rounded cursor-pointer border border-[#cfc5b0] p-0 bg-transparent"
              title="拾取线条颜色"
            />
            <div class="flex items-center gap-1">
              <button
                v-for="color in standardPalette"
                :key="'stk-' + color"
                @click="handleStyleChange('stroke', color)"
                class="w-4 h-4 rounded-full border border-black/20 cursor-pointer transition-transform hover:scale-125"
                :style="{ backgroundColor: color }"
                :title="color"
              />
            </div>
          </div>

          <!-- B. 填充底色 (Fill Color 含透明切换) -->
          <div class="flex items-center gap-1.5 pl-1.5 border-l border-[#cfc5b0]" title="填充底色 (含透明切换)">
            <span class="text-[13px] text-slate-800 font-bold tracking-wide">底色:</span>
            <!-- 透明按钮 -->
            <button
              @click="handleStyleChange('fill', 'transparent')"
              class="px-2 py-0.5 rounded text-[12px] font-bold border transition-colors cursor-pointer"
              :class="activeDrawingStyle.fill === 'transparent' || activeDrawingStyle.fill === 'none'
                ? 'bg-sky-200 text-sky-900 border-sky-400 font-bold' 
                : 'bg-[#f8f5ee] text-slate-800 border-[#cfc5b0] hover:bg-[#eae2d3]'"
              title="切换为无填充底色 (透明)"
            >
              透明
            </button>
            <input
              type="color"
              :value="activeDrawingStyle.fill === 'transparent' ? '#00f2ff' : activeDrawingStyle.fill"
              @input="handleStyleChange('fill', ($event.target as HTMLInputElement).value)"
              class="w-5.5 h-5.5 rounded cursor-pointer border border-[#cfc5b0] p-0 bg-transparent"
              title="选择填充底色"
            />
          </div>

          <!-- C. 底色不透明度调节 (可调至 100% 完全不透明) -->
          <div class="flex items-center gap-1.5 pl-1.5 border-l border-[#cfc5b0]" title="填充底色不透明度 (0% 透明 ~ 100% 完全不透明)">
            <span class="text-[13px] text-slate-800 font-bold tracking-wide">不透明度:</span>
            <select
              :value="Math.round((activeDrawingStyle.fillOpacity !== undefined ? activeDrawingStyle.fillOpacity : 1) * 100)"
              @change="handleStyleChange('fillOpacity', Number(($event.target as HTMLSelectElement).value) / 100)"
              class="bg-[#f8f5ee] hover:bg-[#f0ebe0] border border-[#cfc5b0] rounded px-2 py-0.5 text-[13px] text-slate-900 font-bold focus:outline-hidden cursor-pointer"
            >
              <option :value="0">0% (全透)</option>
              <option :value="10">10%</option>
              <option :value="20">20%</option>
              <option :value="35">35%</option>
              <option :value="50">50% (半透)</option>
              <option :value="65">65%</option>
              <option :value="80">80%</option>
              <option :value="90">90%</option>
              <option :value="100">100% (完全不透)</option>
            </select>
            <button
              @click="handleStyleChange('fillOpacity', 1)"
              class="px-2 py-0.5 rounded text-[12px] font-bold border transition-colors cursor-pointer"
              :class="activeDrawingStyle.fillOpacity >= 0.99
                ? 'bg-emerald-200 text-emerald-900 border-emerald-400 font-bold' 
                : 'bg-[#f8f5ee] text-slate-800 border-[#cfc5b0] hover:bg-[#eae2d3]'"
              title="一键设为 100% 完全不透明"
            >
              不透
            </button>
          </div>

          <!-- D. 线条线宽 (丰富下拉选项) -->
          <div class="flex items-center gap-1.5 pl-1.5 border-l border-[#cfc5b0]" title="线条粗细线宽 (0.5px ~ 10px)">
            <span class="text-[13px] text-slate-800 font-bold tracking-wide">线宽:</span>
            <select
              :value="activeDrawingStyle.strokeWidth"
              @change="handleStyleChange('strokeWidth', Number(($event.target as HTMLSelectElement).value))"
              class="bg-[#f8f5ee] hover:bg-[#f0ebe0] border border-[#cfc5b0] rounded px-2 py-0.5 text-[13px] text-slate-900 font-bold focus:outline-hidden cursor-pointer"
            >
              <option :value="0.5">0.5px (极细)</option>
              <option :value="1">1px (细线)</option>
              <option :value="1.5">1.5px</option>
              <option :value="2">2px (标准)</option>
              <option :value="2.5">2.5px</option>
              <option :value="3">3px (加粗)</option>
              <option :value="4">4px (母线)</option>
              <option :value="5">5px</option>
              <option :value="6">6px (特粗)</option>
              <option :value="8">8px (重型母线)</option>
              <option :value="10">10px (特高压)</option>
            </select>
          </div>

          <!-- E. 线型 (实线/虚线/点线) -->
          <div class="flex items-center gap-1.5 pl-1.5 border-l border-[#cfc5b0]" title="线型虚实 (实线/虚线/点线)">
            <span class="text-[13px] text-slate-800 font-bold tracking-wide">线型:</span>
            <select
              :value="activeDrawingStyle.lineStyle"
              @change="handleStyleChange('lineStyle', ($event.target as HTMLSelectElement).value)"
              class="bg-[#f8f5ee] hover:bg-[#f0ebe0] border border-[#cfc5b0] rounded px-2 py-0.5 text-[13px] text-slate-900 font-bold focus:outline-hidden cursor-pointer"
            >
              <option value="solid">—— 实线</option>
              <option value="dashed">-- 虚线</option>
              <option value="dotted">·· 点线</option>
            </select>
          </div>

          <!-- F. 文字字号与粗细 (丰富字号选项) -->
          <div class="flex items-center gap-1.5 pl-1.5 border-l border-[#cfc5b0]" title="文字字号与加粗">
            <span class="text-[13px] text-slate-800 font-bold tracking-wide">字号:</span>
            <select
              :value="activeDrawingStyle.fontSize"
              @change="handleStyleChange('fontSize', Number(($event.target as HTMLSelectElement).value))"
              class="bg-[#f8f5ee] hover:bg-[#f0ebe0] border border-[#cfc5b0] rounded px-2 py-0.5 text-[13px] text-slate-900 font-bold focus:outline-hidden cursor-pointer"
            >
              <option :value="8">8px</option>
              <option :value="9">9px</option>
              <option :value="10">10px</option>
              <option :value="11">11px</option>
              <option :value="12">12px</option>
              <option :value="13">13px</option>
              <option :value="14">14px (默认)</option>
              <option :value="15">15px</option>
              <option :value="16">16px</option>
              <option :value="18">18px</option>
              <option :value="20">20px</option>
              <option :value="22">22px</option>
              <option :value="24">24px</option>
              <option :value="26">26px</option>
              <option :value="28">28px</option>
              <option :value="32">32px</option>
              <option :value="36">36px</option>
              <option :value="42">42px</option>
              <option :value="48">48px</option>
              <option :value="56">56px</option>
              <option :value="64">64px</option>
              <option :value="72">72px</option>
            </select>
            <!-- 加粗切换 -->
            <button
              @click="handleStyleChange('fontWeight', activeDrawingStyle.fontWeight === 'bold' ? 'normal' : 'bold')"
              class="w-6.5 h-6.5 rounded flex items-center justify-center border transition-colors cursor-pointer text-[13px] font-bold font-serif"
              :class="activeDrawingStyle.fontWeight === 'bold'
                ? 'bg-sky-200 text-sky-900 border-sky-400 font-bold' 
                : 'bg-[#f8f5ee] text-slate-800 border-[#cfc5b0] hover:bg-[#eae2d3]'"
              title="切换粗体 / 常规体"
            >
              B
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
