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
  Unlock,
  BookmarkPlus,
  ShieldCheck,
  UserCheck,
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
  Palette,
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
  Power
} from 'lucide-vue-next';
import { ScreenConfig, ScreenComponent } from '../types';
import { detectPlatform, windowToggleFullscreen } from '../utils/platform';
import { currentUser } from '../utils/auth';

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
  isElectron: false
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
  { type: 'draw-rounded-rect', name: '圆角矩形', icon: Square, isRounded: true, desc: '圆角矩形卡片：确定起止点' },
  { type: 'draw-circle', name: '正圆形', icon: Circle, desc: '正圆形：确定起止点' },
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
</script>

<template>
  <!-- GE-SCADA 标准图形编辑界面顶部导航与菜单工具栏 (护眼暖白/米白主题背景) -->
  <header class="bg-[#f7f5ef] border-b border-[#e1ddd4] px-3 py-1 flex flex-col gap-1 select-none z-40 relative shadow-xs text-slate-800 font-sans">
    <!-- ========================================================================= -->
    <!-- Row 1: 系统标题、标准下拉菜单栏、当前大屏名称与运行控制 (柔和暖白) -->
    <!-- ========================================================================= -->
    <div class="flex items-center justify-between h-9.5 prs-menu-container">
      <!-- Left: KND科能达 品牌标识与标准顶级菜单行 (文件/编辑/视图/格式/图元/数据/运行/帮助) -->
      <div class="flex items-center gap-3">
        <!-- 品牌标识 (用户指定：(KND)科能达，红圈包裹更圆润) -->
        <div class="flex items-center gap-2 pr-3 border-r border-[#e1ddd4] select-none shrink-0">
          <div class="px-2 py-0.5 rounded-full bg-[#d81e06] text-white flex items-center justify-center font-black text-xs shadow-2xs tracking-wide">
            KND
          </div>
          <span class="text-[#d81e06] font-black tracking-wide text-base">
            科能达
          </span>
        </div>

        <!-- 当前窗口与画面指示标签 (无卡片包裹，纯净文本) -->
        <div class="hidden lg:flex items-center gap-1.5 text-xs text-slate-700 select-none tracking-wide">
          <PenTool class="w-3.5 h-3.5 text-sky-600" />
          <span>图形编辑</span>
          <span class="text-slate-300">·</span>
          <span class="text-slate-800 font-mono font-semibold truncate max-w-[140px]">{{ screen.name || '主接线图' }}</span>
        </div>

        <!-- 经典顶级下拉菜单列表 (删除英文后缀) -->
        <nav class="flex items-center gap-1 text-[13.5px] text-slate-800 font-bold relative tracking-wide">
          <!-- 1. 文件 -->
          <div class="relative">
            <button
              @click.stop="toggleMenu('file')"
              class="px-3 py-1.5 rounded hover:bg-[#efeae0] text-slate-800 transition-colors flex items-center gap-1 cursor-pointer tracking-wide"
              :class="{ 'bg-[#efeae0] text-sky-700 font-bold': activeMenu === 'file' }"
            >
              <span>文件</span>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
            </button>
            <div
              v-if="activeMenu === 'file'"
              class="absolute left-0 top-full mt-1 w-60 bg-[#faf8f5] border border-[#e2ddd4] rounded-lg shadow-xl py-1 z-50 text-[13px] text-slate-800 divide-y divide-[#eee9df] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="emit('save:screen'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span class="flex items-center gap-2.5">
                    <Save class="w-4 h-4 text-sky-600" />
                    <span>保存当前画面</span>
                  </span>
                  <span class="text-[11px] text-slate-400 font-mono">Ctrl+S</span>
                </button>
                <button
                  @click="emit('open:disk-storage'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span class="flex items-center gap-2.5">
                    <HardDrive class="w-4 h-4 text-sky-600" />
                    <span>磁盘大屏文件管理 (graph/)</span>
                  </span>
                </button>
              </div>
              <div class="py-1">
                <button
                  @click="emit('clear:canvas'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center justify-between cursor-pointer"
                >
                  <span class="flex items-center gap-2.5">
                    <Trash2 class="w-4 h-4 text-rose-500" />
                    <span>清空当前画布图元</span>
                  </span>
                </button>
                <button
                  @click="emit('exit:app'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-rose-50 text-rose-700 flex items-center justify-between cursor-pointer font-bold border-t border-slate-100"
                  title="安全退出程序"
                >
                  <span class="flex items-center gap-2.5">
                    <Power class="w-4 h-4 text-rose-600" />
                    <span>退出程序</span>
                  </span>
                  <span class="text-[11px] text-rose-400 font-mono">Alt+F4</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 2. 编辑 -->
          <div class="relative">
            <button
              @click.stop="toggleMenu('edit')"
              class="px-3 py-1.5 rounded hover:bg-slate-100 text-slate-800 transition-colors flex items-center gap-1 cursor-pointer tracking-wide"
              :class="{ 'bg-slate-100 text-sky-700 font-bold': activeMenu === 'edit' }"
            >
              <span>编辑</span>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
            </button>
            <div
              v-if="activeMenu === 'edit'"
              class="absolute left-0 top-full mt-1 w-56 bg-[#faf8f5] border border-[#e2ddd4] rounded-lg shadow-xl py-1 z-50 text-[13px] text-slate-800 divide-y divide-[#eee9df] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="emit('undo'); closeMenus();"
                  :disabled="!canUndo"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <span class="flex items-center gap-2.5"><Undo2 class="w-4 h-4 text-slate-500" />撤销</span>
                  <span class="text-[11px] text-slate-400 font-mono">Ctrl+Z</span>
                </button>
                <button
                  @click="emit('redo'); closeMenus();"
                  :disabled="!canRedo"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <span class="flex items-center gap-2.5"><Redo2 class="w-4 h-4 text-slate-500" />重做</span>
                  <span class="text-[11px] text-slate-400 font-mono">Ctrl+Y</span>
                </button>
              </div>
              <div class="py-1">
                <button
                  @click="emit('group'); closeMenus();"
                  :disabled="(selectedIds?.length || 0) < 2"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <span class="flex items-center gap-2.5"><Layers class="w-4 h-4 text-sky-600" />组合成图符</span>
                  <span class="text-[11px] text-slate-400 font-mono">Ctrl+G</span>
                </button>
                <button
                  @click="emit('ungroup'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span class="flex items-center gap-2.5"><Unlock class="w-4 h-4 text-amber-600" />取消组合</span>
                  <span class="text-[11px] text-slate-400 font-mono">Ctrl+U</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 3. 视图 -->
          <div class="relative">
            <button
              @click.stop="toggleMenu('view')"
              class="px-3 py-1.5 rounded hover:bg-[#efeae0] text-slate-800 transition-colors flex items-center gap-1 cursor-pointer tracking-wide"
              :class="{ 'bg-[#efeae0] text-sky-700 font-bold': activeMenu === 'view' }"
            >
              <span>视图</span>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
            </button>
            <div
              v-if="activeMenu === 'view'"
              class="absolute left-0 top-full mt-1 w-60 bg-[#faf8f5] border border-[#e2ddd4] rounded-lg shadow-xl py-1 z-50 text-[13px] text-slate-800 tracking-wide"
            >
              <button
                @click="emit('update:showGrid', !showGrid); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
              >
                <span class="flex items-center gap-2.5"><Grid class="w-4 h-4 text-slate-500" />显示网格底点</span>
                <Check v-if="showGrid" class="w-4 h-4 text-sky-600" />
              </button>
              <button
                @click="emit('update:snapToGrid', !snapToGrid); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
              >
                <span class="flex items-center gap-2.5"><Magnet class="w-4 h-4 text-slate-500" />磁性吸附网格</span>
                <Check v-if="snapToGrid" class="w-4 h-4 text-sky-600" />
              </button>
              <button
                @click="emit('update:showRuler', !showRuler); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
              >
                <span class="flex items-center gap-2.5"><RulerIcon class="w-4 h-4 text-slate-500" />显示像素标尺</span>
                <Check v-if="showRuler" class="w-4 h-4 text-sky-600" />
              </button>
              <button
                @click="emit('update:orthogonalLock', !orthogonalLock); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
              >
                <span class="flex items-center gap-2.5"><Maximize class="w-4 h-4 text-slate-500" />正交锁定走线</span>
                <Check v-if="orthogonalLock" class="w-4 h-4 text-sky-600" />
              </button>
              <div class="my-1 border-t border-[#eee9df]" />
              <button
                @click="emit('fit:screen'); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
              >
                <span class="flex items-center gap-2.5"><Crosshair class="w-4 h-4 text-sky-600" />适应屏幕居中</span>
              </button>
            </div>
          </div>

          <!-- 4. 排列对齐 -->
          <div class="relative">
            <button
              @click.stop="toggleMenu('align')"
              class="px-3 py-1.5 rounded hover:bg-[#efeae0] text-slate-800 transition-colors flex items-center gap-1 cursor-pointer tracking-wide"
              :class="{ 'bg-[#efeae0] text-sky-700 font-bold': activeMenu === 'align' }"
            >
              <span>排列</span>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
            </button>
            <div
              v-if="activeMenu === 'align'"
              class="absolute left-0 top-full mt-1 w-56 bg-[#faf8f5] border border-[#e2ddd4] rounded-lg shadow-xl py-1 z-50 text-[13px] text-slate-800 divide-y divide-[#eee9df] tracking-wide"
            >
              <div class="py-1">
                <button @click="emit('align', 'left'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignLeft class="w-4 h-4 text-slate-500" /><span>左对齐</span>
                </button>
                <button @click="emit('align', 'center'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignCenter class="w-4 h-4 text-slate-500" /><span>水平居中</span>
                </button>
                <button @click="emit('align', 'right'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignRight class="w-4 h-4 text-slate-500" /><span>右对齐</span>
                </button>
              </div>
              <div class="py-1">
                <button @click="emit('align', 'top'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignVerticalJustifyStart class="w-4 h-4 text-slate-500" /><span>顶对齐</span>
                </button>
                <button @click="emit('align', 'middle'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignVerticalJustifyCenter class="w-4 h-4 text-slate-500" /><span>垂直居中</span>
                </button>
                <button @click="emit('align', 'bottom'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignVerticalJustifyEnd class="w-4 h-4 text-slate-500" /><span>底对齐</span>
                </button>
              </div>
              <div class="py-1">
                <button @click="emit('align', 'distribute-h'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignHorizontalSpaceAround class="w-4 h-4 text-slate-500" /><span>水平均匀分布</span>
                </button>
                <button @click="emit('align', 'distribute-v'); closeMenus();" class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer">
                  <AlignVerticalSpaceAround class="w-4 h-4 text-slate-500" /><span>垂直均匀分布</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 5. 数据测点 -->
          <div class="relative">
            <button
              @click.stop="toggleMenu('data')"
              class="px-3 py-1.5 rounded hover:bg-[#efeae0] text-slate-800 transition-colors flex items-center gap-1 cursor-pointer tracking-wide"
              :class="{ 'bg-[#efeae0] text-sky-700 font-bold': activeMenu === 'data' }"
            >
              <span>数据与点位</span>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
            </button>
            <div
              v-if="activeMenu === 'data'"
              class="absolute left-0 top-full mt-1 w-60 bg-[#faf8f5] border border-[#e2ddd4] rounded-lg shadow-xl py-1 z-50 text-[13px] text-slate-800 tracking-wide"
            >
              <button
                @click="emit('open:datasets'); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
              >
                <Database class="w-4 h-4 text-sky-600" />
                <span>数据集与测点配置中心</span>
              </button>
              <button
                @click="emit('open:symbols'); closeMenus();"
                class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
              >
                <FolderOpen class="w-4 h-4 text-amber-600" />
                <span>自定义多态图元工坊</span>
              </button>
            </div>
          </div>

          <!-- 6. 窗口与组态 -->
          <div class="relative">
            <button
              @click.stop="toggleMenu('window')"
              class="px-3 py-1.5 rounded hover:bg-[#efeae0] text-slate-800 transition-colors flex items-center gap-1 cursor-pointer tracking-wide"
              :class="{ 'bg-[#efeae0] text-sky-700 font-bold': activeMenu === 'window' }"
            >
              <span>窗口与组态</span>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
            </button>
            <div
              v-if="activeMenu === 'window'"
              class="absolute left-0 top-full mt-1 w-68 bg-[#faf8f5] border border-[#e2ddd4] rounded-lg shadow-xl py-1 z-50 text-[13px] text-slate-800 divide-y divide-[#eee9df] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="emit('open:window', 'graphic-editor'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <PenTool class="w-4 h-4 text-sky-600" />
                  <span>图形编辑界面</span>
                </button>
                <button
                  @click="emit('open:window', 'symbol-editor'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <Box class="w-4 h-4 text-indigo-600" />
                  <span>图元编辑界面 (微元工坊)</span>
                </button>
                <button
                  @click="emit('open:window', 'monitor-screen'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer font-bold text-sky-700"
                >
                  <Zap class="w-4 h-4 text-amber-600" />
                  <span>实时监控主接线</span>
                </button>
                <button
                  @click="emit('open:window', 'alarm-window'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <Bell class="w-4 h-4 text-rose-600" />
                  <span>全站实时告警 / SOE</span>
                </button>
              </div>

              <!-- 窗口布局管理 -->
              <div class="py-1">
                <button
                  @click="emit('tile:windows'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <LayoutGrid class="w-4 h-4 text-sky-600" />
                  <span>平铺所有组态窗口</span>
                </button>
                <button
                  @click="emit('cascade:windows'); closeMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <Layers class="w-4 h-4 text-sky-600" />
                  <span>层叠所有组态窗口</span>
                </button>
              </div>
            </div>
          </div>
        </nav>
      </div>

      <!-- Right: 自定义画布背景色、当前大屏名称、用户信息与运行按钮 (全白设计) -->
      <div class="flex items-center gap-2">
        <!-- 核心：自定义编辑画布背景色快速工具 (满足用户 "还可以自定义背景色") -->
        <div class="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <Palette class="w-3.5 h-3.5 text-slate-500" />
          <span class="text-[11px] text-slate-600 font-medium hidden sm:inline">画布底色:</span>
          
          <!-- 快捷预设色块 -->
          <div class="flex items-center gap-1">
            <button
              v-for="bg in bgPresets"
              :key="bg.value"
              @click="handleSetBgColor(bg.value)"
              class="w-3.5 h-3.5 rounded-full border border-slate-300 transition-transform hover:scale-125 cursor-pointer relative"
              :style="{ backgroundColor: bg.value }"
              :title="`${bg.name} (${bg.value}) - ${bg.desc}`"
            >
              <span
                v-if="screen.backgroundColor === bg.value"
                class="absolute inset-0 m-auto w-1 h-1 rounded-full bg-sky-400 shadow-xs"
              />
            </button>
          </div>

          <!-- 自定义颜色拾色器 -->
          <label
            class="relative w-4 h-4 rounded-md border border-slate-300 overflow-hidden cursor-pointer flex items-center justify-center hover:border-sky-500"
            title="点击自定义拾色器，自由选择任何色值"
          >
            <input
              type="color"
              :value="screen.backgroundColor || '#080f1e'"
              @input="handleSetBgColor(($event.target as HTMLInputElement).value)"
              class="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            />
            <div
              class="w-full h-full rounded-sm"
              :style="{ backgroundColor: screen.backgroundColor || '#080f1e' }"
            />
          </label>
        </div>

        <!-- 当前编辑大屏分辨率标牌 -->
        <div class="hidden xl:flex items-center gap-1.5 text-[11px] text-slate-500 font-mono bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
          <span>{{ screen.width }} × {{ screen.height }}</span>
        </div>

        <!-- 登录用户信息 -->
        <button
          @click="emit('open:login')"
          class="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700 transition-colors cursor-pointer"
          :title="`当前登录: ${currentUser.name} (${currentUser.roleName}) - 点击切换`"
        >
          <ShieldCheck v-if="currentUser.role === 'system_admin'" class="w-3.5 h-3.5 text-sky-600" />
          <UserCheck v-else class="w-3.5 h-3.5 text-emerald-600" />
          <span class="max-w-[70px] truncate text-xs font-semibold text-slate-900">{{ currentUser.name }}</span>
        </button>

        <!-- 保存当前画面 -->
        <button
          @click="emit('save:screen')"
          class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 text-slate-900 text-[13px] font-bold tracking-wide transition-colors cursor-pointer shadow-2xs"
          title="保存画面到磁盘 graph/ (Ctrl+S)"
        >
          <Save class="w-4 h-4 text-sky-600 stroke-[2.2]" />
          <span>保存</span>
        </button>

        <!-- MDI / Electron 窗口管理控制按钮群 (最大化时无缝接管，平衡 Electron 窗口栏避免重叠) -->
        <div v-if="isMaximized || isElectron" class="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200 shrink-0">
          <button
            @click="emit('minimize:window')"
            class="w-7 h-7 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            title="最小化窗口到底部任务栏"
          >
            <Minus class="w-4 h-4" />
          </button>
          <button
            @click="emit('restore:window')"
            class="w-7 h-7 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            title="还原为自由拖拽窗口"
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
    <!-- Row 2: GE-SCADA 精准快捷工具栏 (护眼暖白/米白背景) -->
    <!-- ========================================================================= -->
    <div class="flex items-center justify-between bg-[#f4f1ea] border border-[#e2ddd4] px-2 py-1 rounded-lg text-[13px] select-none overflow-x-auto gap-2 tracking-wide">
      <!-- Left: 指针工具、几何绘图元、撤销重做、对齐与视图吸附 -->
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- 1. 交互指针模式 (选择 / 折线 / 导向箭头) -->
        <div class="flex items-center bg-[#faf8f5] p-0.5 rounded-md border border-[#e2ddd4] shadow-2xs gap-0.5">
          <button
            @click="emit('update:drawTool', 'select')"
            class="p-1.5 rounded transition-colors cursor-pointer"
            :class="drawTool === 'select' 
              ? 'bg-sky-100 text-sky-800 font-bold border border-sky-300' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-[#efeae0]'"
            title="选择指针 (V / ESC): 框选/平移/缩放图元"
          >
            <MousePointer class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('update:drawTool', 'draw-polyline')"
            class="p-1.5 rounded transition-colors cursor-pointer"
            :class="drawTool === 'draw-polyline' 
              ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-[#efeae0]'"
            title="绘制母线/折线 (L): 连续拐点，双击结束"
          >
            <Workflow class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('update:drawTool', 'draw-arrow')"
            class="p-1.5 rounded transition-colors cursor-pointer"
            :class="drawTool === 'draw-arrow' 
              ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-[#efeae0]'"
            title="绘制导向箭头: 起点到终点"
          >
            <MoveRight class="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        <div class="h-4 w-[1px] bg-[#e2ddd4] mx-0.5" />

        <!-- 2. 基础几何图元快捷按钮组 (矩形/正圆/三角/菱形等) -->
        <div class="flex items-center bg-[#faf8f5] p-0.5 rounded-md border border-[#e2ddd4] shadow-2xs gap-0.5">
          <button
            v-for="geo in basicGeometryTools"
            :key="geo.type"
            @click="emit('select:shape', geo.type)"
            class="p-1.5 rounded transition-colors cursor-pointer"
            :class="drawTool === 'place-component' && activeShapeType === geo.type
              ? 'bg-sky-100 text-sky-800 font-bold border border-sky-300' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-[#efeae0]'"
            :title="geo.desc"
          >
            <component 
              :is="geo.icon" 
              class="w-4 h-4 stroke-[1.8]" 
              :class="[
                geo.isDown ? 'rotate-180' : '',
                geo.isRounded ? 'rounded-xs' : ''
              ]" 
            />
          </button>
        </div>

        <div class="h-4 w-[1px] bg-[#e2ddd4] mx-0.5" />

        <!-- 3. 撤销 / 重做 -->
        <div class="flex items-center bg-[#faf8f5] p-0.5 rounded-md border border-[#e2ddd4] shadow-2xs gap-0.5">
          <button
            @click="emit('undo')"
            :disabled="!canUndo"
            class="p-1.5 rounded transition-colors"
            :class="canUndo ? 'text-slate-700 hover:bg-[#efeae0] cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 class="w-4 h-4 stroke-[2]" />
          </button>
          <button
            @click="emit('redo')"
            :disabled="!canRedo"
            class="p-1.5 rounded transition-colors"
            :class="canRedo ? 'text-slate-700 hover:bg-[#efeae0] cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="重做 (Ctrl+Y)"
          >
            <Redo2 class="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        <div class="h-4 w-[1px] bg-[#e2ddd4] mx-0.5" />

        <!-- 4. 标尺、网格底图与磁性吸附控制 -->
        <div class="flex items-center bg-[#faf8f5] p-0.5 rounded-md border border-[#e2ddd4] shadow-2xs gap-0.5">
          <button
            @click="emit('update:showRuler', !showRuler)"
            class="p-1.5 rounded cursor-pointer transition-colors"
            :class="showRuler ? 'bg-sky-100 text-sky-700 font-bold' : 'text-slate-600 hover:bg-[#efeae0]'"
            :title="showRuler ? '标尺: 已开启' : '标尺: 已关闭'"
          >
            <RulerIcon class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('update:showGrid', !showGrid)"
            class="p-1.5 rounded cursor-pointer transition-colors"
            :class="showGrid ? 'bg-sky-100 text-sky-700 font-bold' : 'text-slate-600 hover:bg-[#efeae0]'"
            title="切换网格底图"
          >
            <Grid class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('update:snapToGrid', !snapToGrid)"
            class="p-1.5 rounded cursor-pointer transition-colors"
            :class="snapToGrid ? 'bg-sky-100 text-sky-700 font-bold' : 'text-slate-600 hover:bg-[#efeae0]'"
            :title="snapToGrid ? '网格吸附: 已开启' : '网格吸附: 已关闭'"
          >
            <Magnet class="w-4 h-4 stroke-[2]" />
          </button>

          <!-- 网格步长下拉 -->
          <select 
            :value="gridSize"
            @change="emit('update:gridSize', Number(($event.target as HTMLSelectElement).value))"
            class="bg-[#faf8f5] border border-[#e2ddd4] rounded px-2 py-0.5 text-xs text-slate-800 font-bold focus:outline-hidden cursor-pointer"
            title="网格点格步进尺寸"
          >
            <option :value="10">10px</option>
            <option :value="20">20px</option>
            <option :value="30">30px</option>
            <option :value="40">40px (标准)</option>
            <option :value="50">50px</option>
            <option :value="60">60px</option>
            <option :value="80">80px</option>
            <option :value="100">100px</option>
          </select>

          <!-- 一键重新吸附全部图元 -->
          <button
            @click="emit('snap:all')"
            class="p-1.5 rounded text-slate-600 hover:bg-[#efeae0] cursor-pointer"
            title="一键将画布所有图元吸附对齐到最近网格点"
          >
            <Target class="w-4 h-4 text-sky-600 stroke-[2]" />
          </button>

          <!-- 正交锁定 -->
          <button
            @click="emit('update:orthogonalLock', !orthogonalLock)"
            class="p-1.5 rounded cursor-pointer transition-colors"
            :class="orthogonalLock ? 'bg-sky-100 text-sky-700 font-bold' : 'text-slate-600 hover:bg-[#efeae0]'"
            title="正交锁定：连线强制水平/垂直/45度"
          >
            <Maximize class="w-4 h-4 stroke-[2]" />
          </button>

          <!-- 一键原点自适应居中 -->
          <button
            @click="emit('center:all')"
            class="p-1.5 rounded text-slate-600 hover:bg-[#efeae0] cursor-pointer"
            title="画布原点复位自适应居中"
          >
            <Crosshair class="w-4 h-4 text-slate-700 stroke-[2]" />
          </button>
        </div>

        <div class="h-4 w-[1px] bg-[#e2ddd4] mx-0.5" />

        <!-- 5. 对齐工具 (选中 ≥2 个图元时激活) -->
        <div class="flex items-center bg-[#faf8f5] p-0.5 rounded-md border border-[#e2ddd4] shadow-2xs gap-0.5">
          <button
            @click="emit('align', 'left')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="左对齐 (≥2 个图元)"
          >
            <AlignLeft class="w-4 h-4 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'center')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="水平居中 (≥2 个图元)"
          >
            <AlignCenter class="w-4 h-4 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'right')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="右对齐 (≥2 个图元)"
          >
            <AlignRight class="w-4 h-4 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'top')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="顶对齐 (≥2 个图元)"
          >
            <AlignVerticalJustifyStart class="w-4 h-4 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'middle')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="垂直居中 (≥2 个图元)"
          >
            <AlignVerticalJustifyCenter class="w-4 h-4 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'bottom')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="底对齐 (≥2 个图元)"
          >
            <AlignVerticalJustifyEnd class="w-4 h-4 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'distribute-h')"
            :disabled="(selectedIds?.length || 0) < 3"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 3 ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="水平均匀分布 (≥3 个图元)"
          >
            <AlignHorizontalSpaceAround class="w-4 h-4 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'distribute-v')"
            :disabled="(selectedIds?.length || 0) < 3"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 3 ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="垂直均匀分布 (≥3 个图元)"
          >
            <AlignVerticalSpaceAround class="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        <div class="h-4 w-[1px] bg-[#e2ddd4] mx-0.5" />

        <!-- 6. 组合与解构图元 -->
        <div class="flex items-center bg-[#faf8f5] p-0.5 rounded-md border border-[#e2ddd4] shadow-2xs gap-0.5">
          <button
            @click="emit('group')"
            :disabled="(selectedIds?.length || 0) < 2"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) >= 2 ? 'text-sky-700 hover:bg-[#efeae0] cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="组合成群组图符 (Ctrl+G)"
          >
            <Layers class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('ungroup')"
            :disabled="(selectedIds?.length || 0) !== 1"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) === 1 ? 'text-amber-700 hover:bg-[#efeae0] cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="取消组合/解散 (Ctrl+U)"
          >
            <Unlock class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="emit('save:symbol')"
            :disabled="(selectedIds?.length || 0) === 0"
            class="p-1.5 rounded transition-colors"
            :class="(selectedIds?.length || 0) > 0 ? 'text-emerald-700 hover:bg-[#efeae0] cursor-pointer' : 'text-slate-300 cursor-not-allowed'"
            title="封装为自定义图元"
          >
            <BookmarkPlus class="w-4 h-4 stroke-[2]" />
          </button>
        </div>
      </div>

      <!-- Right: 缩放与全屏控制 -->
      <div class="flex items-center gap-1.5 shrink-0">
        <div class="flex items-center bg-[#faf8f5] p-0.5 rounded-md border border-[#e2ddd4] shadow-2xs text-[13px] font-mono gap-0.5">
          <button
            @click="emit('update:zoom', Math.max(0.1, Number((zoom - 0.1).toFixed(2))))"
            class="p-1.5 rounded hover:bg-[#efeae0] text-slate-700 cursor-pointer transition-colors"
            title="缩小画面"
          >
            <ZoomOut class="w-4 h-4 stroke-[2]" />
          </button>
          
          <span class="text-xs font-mono font-bold text-slate-900 bg-[#f4f1ea] border border-[#e2ddd4] rounded px-2 py-0.5 w-14 text-center tracking-wider">
            {{ Math.round(zoom * 100) }}%
          </span>
          
          <button
            @click="emit('update:zoom', Math.min(2.5, Number((zoom + 0.1).toFixed(2))))"
            class="p-1.5 rounded hover:bg-[#efeae0] text-slate-700 cursor-pointer transition-colors"
            title="放大画面"
          >
            <ZoomIn class="w-4 h-4 stroke-[2]" />
          </button>

          <button
            @click="handleFullscreenToggle"
            class="p-1.5 rounded cursor-pointer transition-colors ml-0.5"
            :class="isFullscreen ? 'bg-sky-100 text-sky-800 font-bold' : 'text-slate-700 hover:bg-[#efeae0]'"
            :title="isFullscreen ? '退出全屏 (ESC / F11)' : '全屏显示 (F11)'"
          >
            <Minimize2 v-if="isFullscreen" class="w-4 h-4 stroke-[2]" />
            <Maximize2 v-else class="w-4 h-4 stroke-[2]" />
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
