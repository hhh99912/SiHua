<script setup lang="ts">
import { ref } from 'vue';
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
  MoveVertical
} from 'lucide-vue-next';
import { ScreenConfig, ScreenComponent } from '../types';
import { templates } from '../data/templates';
import { detectPlatform } from '../utils/platform';
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
}

const props = withDefaults(defineProps<Props>(), {
  drawTool: 'select',
  activeShapeType: '',
  selectedIds: () => [],
  selectedComponents: () => [],
  showGrid: true,
  gridSize: 40,
  snapToGrid: true,
  orthogonalLock: false
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
  (e: 'toggle:streaming'): void;
  (e: 'save:screen'): void;
  (e: 'open:preview'): void;
  (e: 'open:datasets'): void;
  (e: 'open:control'): void;
  (e: 'open:json'): void;
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
}>();

const currentPlatform = detectPlatform();

const showResolutionMenu = ref(false);
const showTemplateMenu = ref(false);

const resolutionPresets = [
  { label: '标准大屏 (1980 × 1100)', w: 1980, h: 1100, tag: '推荐默认' },
  { label: '1080P 全高清 (1920 × 1080)', w: 1920, h: 1080, tag: '标准 16:9' },
  { label: '2K 工业宽屏 (2560 × 1440)', w: 2560, h: 1440, tag: '高分屏 16:9' },
  { label: '4K 超高清 (3840 × 2160)', w: 3840, h: 2160, tag: '4K 巨幕' },
  { label: '工控触控屏 (1366 × 768)', w: 1366, h: 768, tag: '嵌入式' },
  { label: '720P 标清 (1280 × 720)', w: 1280, h: 720, tag: '便携屏' },
  { label: '带鱼环幕屏 (3840 × 1080)', w: 3840, h: 1080, tag: '32:9 展厅' },
];

// Basic Geometric Primitives Toolbar Data (All compact icon buttons with rich tooltips)
const basicGeometryTools = [
  { type: 'draw-rect', name: '矩形 / 科技底座', icon: Square, desc: '矩形底座：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-rounded-rect', name: '圆角矩形', icon: Square, isRounded: true, desc: '圆角矩形卡片：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-circle', name: '正圆形', icon: Circle, desc: '正圆形：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-ellipse', name: '椭圆形', icon: CircleDot, desc: '椭圆形：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-triangle', name: '正三角形 (向上)', icon: Triangle, desc: '正三角形 (向上)：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-triangle-down', name: '倒三角形 (向下)', icon: Triangle, isDown: true, desc: '倒三角形 (向下)：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-triangle-right', name: '向右三角形', icon: Play, desc: '向右三角形 (物料流向)：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-diamond', name: '菱形 / 判定框', icon: Diamond, desc: '菱形判定框：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-pentagon', name: '正五边形', icon: Hexagon, desc: '正五边形：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-hexagon', name: '正六边形 / 蜂巢', icon: Hexagon, desc: '正六边形蜂巢：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-octagon', name: '正八边形', icon: Octagon, desc: '正八边形停机标牌：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-star', name: '五角星', icon: Star, desc: '五角星枢纽焦点：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-star4', name: '四角芒星 / 光芒', icon: Sparkles, desc: '四角芒星光芒点：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-trapezoid', name: '等腰梯形', icon: Layers, desc: '等腰梯形料斗：单击选中后在屏幕确定起始和终止点' },
  { type: 'draw-text', name: '文本标签 / 标牌', icon: Type, desc: '静态文本与标牌：单击选中后在屏幕确定起始和终止点' },
  { type: 'ctrl-button', name: '控制按钮', icon: ToggleRight, desc: '工业控制按钮：单击选中后在屏幕确定起始和终止点' }
];

const handleSelectResolution = (w: number, h: number) => {
  emit('update:screen', {
    ...props.screen,
    width: w,
    height: h
  });
  showResolutionMenu.value = false;
  emit('fit:screen');
};

const handleSelectTemplate = (id: string) => {
  emit('load:template', id);
  showTemplateMenu.value = false;
};
</script>

<template>
  <header class="bg-[#11233e] border-b border-cyan-500/30 px-3 py-1 flex flex-col gap-1 select-none z-40 relative shadow-md">
    <!-- Row 1: Brand, Template, Project Tools, Preview & User Switch -->
    <div class="flex items-center justify-between h-9">
      <!-- Left: Logo, Name & Screen Preset -->
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 flex items-center justify-center shadow-[0_0_12px_rgba(0,242,255,0.4)] border border-cyan-300/40">
            <Monitor class="w-3.5 h-3.5 text-slate-950 font-bold" />
          </div>
          <div class="flex items-center gap-1.5">
            <span class="font-mono font-black text-xs tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-100 to-blue-300">
              GE-SCADA
            </span>
            <span class="text-[9px] font-mono px-1 py-0.2 rounded bg-[#173055] border border-cyan-500/40 text-cyan-300 font-semibold">
              SCADA
            </span>
          </div>
        </div>

        <div class="h-4 w-[1px] bg-cyan-500/30 mx-1" />

        <!-- Resolution Selector Dropdown -->
        <div class="relative">
          <button
            @click="showResolutionMenu = !showResolutionMenu"
            class="flex items-center gap-1.5 px-2 py-1 rounded bg-[#173055] border border-cyan-400 hover:border-cyan-300 text-[11px] font-mono text-cyan-100 transition-all cursor-pointer shadow-[0_0_8px_rgba(0,242,255,0.15)]"
            title="选择预设画面分辨率"
          >
            <span class="text-cyan-300 font-light">尺寸:</span>
            <span class="font-normal text-white">{{ screen.width }}×{{ screen.height }}</span>
            <ChevronDown class="w-3 h-3 text-cyan-300" />
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="showResolutionMenu"
            class="absolute top-full left-0 mt-1 w-60 bg-[#132745] border border-cyan-400 rounded-xl shadow-2xl p-1 z-50 backdrop-blur-md"
          >
            <div class="text-[10px] font-mono text-cyan-300 font-light px-2 py-0.5 border-b border-cyan-500/30">
              SCADA 分辨率预设
            </div>
            <div class="space-y-0.5 mt-1">
              <button
                v-for="res in resolutionPresets"
                :key="res.label"
                @click="handleSelectResolution(res.w, res.h)"
                class="w-full flex items-center justify-between px-2 py-1 rounded text-xs font-mono font-light transition-colors text-left hover:bg-cyan-500/30 text-slate-100 cursor-pointer"
                :class="{ 'bg-cyan-600/30 text-cyan-200 font-normal border border-cyan-400': screen.width === res.w && screen.height === res.h }"
              >
                <div class="flex items-center gap-1">
                  <Check v-if="screen.width === res.w && screen.height === res.h" class="w-3 h-3 text-cyan-300" />
                  <span v-else class="w-3" />
                  <span>{{ res.w }} × {{ res.h }}</span>
                </div>
                <span class="text-[9px] px-1 py-0.2 rounded bg-[#173055] border border-cyan-500/40 text-cyan-200 font-mono font-light">
                  {{ res.tag }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Preset Template Switcher -->
        <div class="relative">
          <button
            @click="showTemplateMenu = !showTemplateMenu"
            class="flex items-center gap-1 px-2 py-1 rounded bg-[#173055] border border-cyan-400 hover:border-cyan-300 text-[11px] font-mono text-cyan-100 transition-all cursor-pointer shadow-[0_0_8px_rgba(0,242,255,0.15)]"
            title="载入官方 SCADA 工程预设"
          >
            <LayoutTemplate class="w-3 h-3 text-cyan-300" />
            <span class="font-light">模版</span>
            <ChevronDown class="w-3 h-3 text-cyan-300" />
          </button>

          <div
            v-if="showTemplateMenu"
            class="absolute top-full left-0 mt-1 w-64 bg-[#132745] border border-cyan-400 rounded-xl shadow-2xl p-1 z-50 backdrop-blur-md"
          >
            <div class="text-[10px] font-mono text-cyan-300 font-light px-2 py-0.5 border-b border-cyan-500/30">
              载入官方 SCADA 预设
            </div>
            <div class="space-y-0.5 mt-1">
              <button
                v-for="tpl in templates"
                :key="tpl.id"
                @click="handleSelectTemplate(tpl.id)"
                class="w-full flex items-start gap-1.5 p-1.5 rounded text-xs font-mono font-light transition-colors text-left hover:bg-cyan-500/30 text-slate-100 cursor-pointer"
              >
                <div class="w-1.5 h-1.5 rounded-full bg-cyan-300 mt-1 shrink-0" />
                <div>
                  <div class="font-normal text-cyan-100">{{ tpl.name }}</div>
                  <div class="text-[10px] text-cyan-300/80 line-clamp-1 font-light">{{ tpl.description }}</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Main Project Features, Auth & Big Screen Preview -->
      <div class="flex items-center gap-1.5">
        <!-- Real-time Simulation Switch -->
        <button
          @click="emit('toggle:streaming')"
          class="p-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border"
          :class="isStreaming 
            ? 'bg-emerald-950 border-emerald-400 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
            : 'bg-[#173055] border-cyan-500/60 text-cyan-200 hover:border-cyan-300 hover:text-white'"
          :title="isStreaming ? '数据流：运行中 (点击暂停)' : '数据流：已暂停 (点击运行)'"
        >
          <Pause v-if="isStreaming" class="w-3.5 h-3.5 text-emerald-300" />
          <Play v-else class="w-3.5 h-3.5 text-cyan-300" />
        </button>

        <!-- Dataset Manager -->
        <button
          @click="emit('open:datasets')"
          class="p-1.5 rounded-lg bg-[#173055] border border-cyan-400 hover:border-cyan-300 hover:text-white text-cyan-200 transition-all cursor-pointer shadow-[0_0_6px_rgba(0,242,255,0.2)]"
          title="数据集管理：配置测点、模拟点与装置阵列"
        >
          <Database class="w-3.5 h-3.5 text-cyan-300" />
        </button>

        <!-- SCADA Tele-Control Center (遥控遥调执行) -->
        <button
          @click="emit('open:control')"
          class="p-1.5 rounded-lg bg-amber-950/60 border border-amber-400 hover:border-amber-300 hover:bg-amber-900 text-amber-200 transition-all cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.25)]"
          title="SCADA 遥控分合闸与遥调指令中心 (YK / YT)"
        >
          <Radio class="w-3.5 h-3.5 text-amber-300" />
        </button>

        <!-- Custom Symbol Library Button -->
        <button
          @click="emit('open:symbols')"
          class="p-1.5 rounded-lg bg-[#173055] border border-cyan-400 hover:border-cyan-300 hover:text-white text-cyan-200 transition-all cursor-pointer shadow-[0_0_6px_rgba(0,242,255,0.2)]"
          title="图元资产库与微元组装工坊"
        >
          <FolderOpen class="w-3.5 h-3.5 text-cyan-300" />
        </button>

        <!-- JSON Schema Export / Import -->
        <button
          @click="emit('open:json')"
          class="p-1.5 rounded-lg bg-[#173055] border border-cyan-400 hover:border-cyan-300 hover:text-white text-cyan-200 transition-all cursor-pointer shadow-[0_0_6px_rgba(0,242,255,0.2)]"
          title="工程 JSON 架构导入与导出"
        >
          <Code class="w-3.5 h-3.5 text-cyan-300" />
        </button>

        <!-- Disk Storage Files per Screen -->
        <button
          @click="emit('open:disk-storage')"
          class="p-1.5 rounded-lg bg-[#173055] border border-cyan-400 hover:border-cyan-300 hover:text-white text-cyan-200 transition-all cursor-pointer shadow-[0_0_6px_rgba(0,242,255,0.2)]"
          title="磁盘大屏存储管理 (每个大屏独立存储为同名 JSON 文件)"
        >
          <HardDrive class="w-3.5 h-3.5 text-cyan-300" />
        </button>

        <!-- Multi-Platform Desktop & Packaging Hub -->
        <button
          @click="emit('open:platform')"
          class="p-1.5 rounded-lg bg-[#173055] border border-cyan-400 hover:border-cyan-300 hover:text-white text-cyan-200 transition-all cursor-pointer relative shadow-[0_0_6px_rgba(0,242,255,0.2)]"
          :title="`跨平台桌面端打包分发中心 (当前环境: ${currentPlatform.toUpperCase()})`"
        >
          <Laptop class="w-3.5 h-3.5 text-cyan-300" />
        </button>

        <!-- Clear Canvas -->
        <button
          @click="emit('clear:canvas')"
          class="p-1.5 rounded-lg bg-red-950/40 border border-red-400 hover:border-red-300 hover:bg-red-900/60 text-red-200 hover:text-white transition-colors cursor-pointer shadow-[0_0_6px_rgba(239,68,68,0.2)]"
          title="清空当前画布中所有元件"
        >
          <Trash2 class="w-3.5 h-3.5 text-red-300" />
        </button>

        <!-- User Auth Status / Switcher -->
        <button
          @click="emit('open:login')"
          class="flex items-center gap-1.5 px-2 py-1 rounded bg-[#173055] border border-cyan-400 hover:border-cyan-300 text-xs font-mono text-cyan-100 transition-all cursor-pointer shadow-[0_0_6px_rgba(0,242,255,0.2)]"
          :title="`当前登录: ${currentUser.name} (${currentUser.roleName}) - 点击切换用户`"
        >
          <ShieldCheck v-if="currentUser.role === 'system_admin'" class="w-3.5 h-3.5 text-cyan-300" />
          <UserCheck v-else class="w-3.5 h-3.5 text-emerald-300" />
          <span class="max-w-[70px] truncate text-[11px] font-light">{{ currentUser.name }}</span>
        </button>

        <!-- Save Current Screen to Disk (仅保存当前这一个大屏) -->
        <button
          @click="emit('save:screen')"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c3a66] hover:bg-cyan-600 hover:text-slate-950 border border-cyan-400 hover:border-cyan-300 text-cyan-100 font-mono text-xs shadow-[0_0_10px_rgba(0,242,255,0.25)] transition-all cursor-pointer"
          title="仅同步保存当前这一个大屏到 graph/ 对应名称的 JSON 文件中 (快捷键 Ctrl+S)"
        >
          <Save class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
          <span class="font-normal">保存</span>
        </button>

        <!-- SCADA Full Preview -->
        <button
          @click="emit('open:preview')"
          class="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-400 to-sky-500 hover:from-cyan-300 hover:to-sky-400 text-slate-950 font-bold text-xs font-mono shadow-[0_0_14px_rgba(0,242,255,0.5)] transition-all cursor-pointer"
          title="全屏运行 SCADA 组态与实时动态监控"
        >
          <Eye class="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
          <span>SCADA 预览</span>
        </button>
      </div>
    </div>

    <!-- Row 2: Condensed Canvas Editing Toolbar (All tools & basic geometric shapes with tooltips) -->
    <div class="flex items-center justify-between bg-[#1a3a68] border border-cyan-400/60 px-2 py-1 rounded-lg text-xs font-mono select-none shadow-md overflow-x-auto custom-scrollbar gap-2">
      <!-- Left: Tools, Basic Geometry Primitives & History -->
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Interactive Tool Switcher (选择 / 折线 / 箭头) -->
        <div class="flex items-center bg-[#152e52] p-0.5 rounded-md border border-cyan-500/40">
          <button
            @click="emit('update:drawTool', 'select')"
            class="p-1 rounded transition-all cursor-pointer"
            :class="drawTool === 'select' 
              ? 'bg-cyan-400 text-slate-950 font-bold shadow-[0_0_8px_rgba(0,242,255,0.5)]' 
              : 'text-cyan-300 hover:text-white hover:bg-cyan-900/60'"
            title="选择工具 (快捷键 V / ESC): 支持框选、多选平移、旋转与缩放"
          >
            <MousePointer class="w-3.5 h-3.5 stroke-[2]" />
          </button>

          <button
            @click="emit('update:drawTool', 'draw-polyline')"
            class="p-1 rounded transition-all cursor-pointer"
            :class="drawTool === 'draw-polyline' 
              ? 'bg-amber-400 text-slate-950 font-bold shadow-[0_0_8px_rgba(251,191,36,0.5)]' 
              : 'text-cyan-300 hover:text-white hover:bg-cyan-900/60'"
            title="折线连线绘制 (单击连续添加拐点，双击或回车结束，画完自动最小裁剪)"
          >
            <Workflow class="w-3.5 h-3.5 stroke-[2]" />
          </button>

          <button
            @click="emit('update:drawTool', 'draw-arrow')"
            class="p-1 rounded transition-all cursor-pointer"
            :class="drawTool === 'draw-arrow' 
              ? 'bg-emerald-400 text-slate-950 font-bold shadow-[0_0_8px_rgba(52,211,153,0.5)]' 
              : 'text-cyan-300 hover:text-white hover:bg-cyan-900/60'"
            title="导向箭头绘制 (单击起点在屏幕确定终点完成绘制，画完自动最小裁剪)"
          >
            <MoveRight class="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>

        <div class="h-3.5 w-[1px] bg-cyan-500/40 mx-0.5" />

        <!-- Basic Geometric Primitives Toolbar (基础几何图元工具栏，图标+悬浮解释) -->
        <div class="flex items-center bg-[#152e52] p-0.5 rounded-md border border-cyan-500/50 gap-0.5">
          <button
            v-for="geo in basicGeometryTools"
            :key="geo.type"
            @click="emit('select:shape', geo.type)"
            class="p-1 rounded transition-all cursor-pointer relative"
            :class="drawTool === 'place-component' && activeShapeType === geo.type
              ? 'bg-cyan-400 text-slate-950 font-bold shadow-[0_0_8px_rgba(0,242,255,0.5)] scale-105' 
              : 'text-cyan-200 hover:text-white hover:bg-cyan-900/60'"
            :title="geo.desc"
          >
            <component 
              :is="geo.icon" 
              class="w-3.5 h-3.5 stroke-[2]" 
              :class="[
                geo.isDown ? 'rotate-180' : '',
                geo.isRounded ? 'rounded-xs' : ''
              ]" 
            />
          </button>
        </div>

        <div class="h-3.5 w-[1px] bg-cyan-500/40 mx-0.5" />

        <!-- Undo / Redo -->
        <div class="flex items-center bg-[#152e52] p-0.5 rounded-md border border-cyan-500/50">
          <button
            @click="emit('undo')"
            :disabled="!canUndo"
            class="p-1 rounded transition-colors"
            :class="canUndo 
              ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' 
              : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 class="w-3.5 h-3.5 stroke-[2]" />
          </button>
          <button
            @click="emit('redo')"
            :disabled="!canRedo"
            class="p-1 rounded transition-colors"
            :class="canRedo 
              ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' 
              : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="重做 (Ctrl+Y)"
          >
            <Redo2 class="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>

        <div class="h-3.5 w-[1px] bg-cyan-500/40 mx-0.5" />

        <!-- Grid & Snapping Controls -->
        <div class="flex items-center bg-[#152e52] p-0.5 rounded-md border border-cyan-500/50 gap-1">
          <button
            @click="emit('update:showGrid', !showGrid)"
            class="p-1 rounded cursor-pointer transition-all"
            :class="showGrid ? 'bg-cyan-400 text-slate-950 font-bold shadow-[0_0_8px_rgba(0,242,255,0.4)]' : 'text-cyan-200 hover:text-white hover:bg-cyan-900/60'"
            title="显示/隐藏网格底图"
          >
            <Grid class="w-3.5 h-3.5 stroke-[2]" />
          </button>

          <button
            @click="emit('update:snapToGrid', !snapToGrid)"
            class="p-1 rounded cursor-pointer transition-all"
            :class="snapToGrid ? 'bg-cyan-400 text-slate-950 font-bold shadow-[0_0_8px_rgba(0,242,255,0.4)]' : 'text-cyan-200 hover:text-white hover:bg-cyan-900/60'"
            :title="snapToGrid ? '点格磁性吸附: 已开启' : '点格磁性吸附: 已关闭'"
          >
            <Magnet class="w-3.5 h-3.5 stroke-[2]" />
          </button>

          <!-- Grid Size Dropdown -->
          <select 
            :value="gridSize"
            @change="emit('update:gridSize', Number(($event.target as HTMLSelectElement).value))"
            class="bg-[#204576] border border-cyan-400 rounded px-1.5 py-0.5 text-[11px] text-cyan-100 font-medium focus:outline-hidden cursor-pointer"
            title="切换点格网格步进尺寸 (10px - 160px)"
          >
            <option :value="10">10px</option>
            <option :value="20">20px</option>
            <option :value="30">30px</option>
            <option :value="40">40px (默认)</option>
            <option :value="50">50px</option>
            <option :value="60">60px</option>
            <option :value="80">80px</option>
            <option :value="100">100px</option>
            <option :value="120">120px</option>
            <option :value="160">160px</option>
          </select>

          <!-- Re-snap All Components to Grid Nodes Button: Target Icon Only without text -->
          <button
            @click="emit('snap:all')"
            class="p-1 rounded bg-[#204576] hover:bg-cyan-500 hover:text-slate-950 border border-cyan-400 text-cyan-100 flex items-center justify-center cursor-pointer transition-all shadow-xs"
            title="网格重对齐：一键将画布所有图元重新吸附对齐到最近的网格点"
          >
            <Target class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
          </button>

          <button
            @click="emit('update:orthogonalLock', !orthogonalLock)"
            class="p-1 rounded cursor-pointer transition-all"
            :class="orthogonalLock ? 'bg-cyan-400 text-slate-950 font-bold shadow-[0_0_8px_rgba(0,242,255,0.4)]' : 'text-cyan-200 hover:text-white hover:bg-cyan-900/60'"
            title="正交锁定：绘制连线与走线时强制锁定水平、垂直与45度角"
          >
            <Maximize class="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>

        <div class="h-3.5 w-[1px] bg-cyan-500/40 mx-0.5" />

        <!-- Canvas Align Shortcuts -->
        <div class="flex items-center bg-[#152e52] p-0.5 rounded-md border border-cyan-500/50 gap-1">
          <button
            @click="emit('center:all')"
            class="p-1 rounded hover:bg-cyan-900/60 text-cyan-200 hover:text-white cursor-pointer transition-colors"
            title="一键居中：从原点 (0, 0) 开始自适应铺满编辑界面"
          >
            <Crosshair class="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>

        <div class="h-3.5 w-[1px] bg-cyan-500/40 mx-0.5" />

        <!-- Alignment Tools (Active when multiple components selected) -->
        <div class="flex items-center bg-[#152e52] p-0.5 rounded-md border border-cyan-500/50 gap-0.5">
          <button
            @click="emit('align', 'left')"
            :disabled="selectedIds.length < 2"
            class="p-1 rounded transition-colors"
            :class="selectedIds.length >= 2 ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="左对齐 (需选中 ≥2 个组件)"
          >
            <AlignLeft class="w-3.5 h-3.5 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'center')"
            :disabled="selectedIds.length < 2"
            class="p-1 rounded transition-colors"
            :class="selectedIds.length >= 2 ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="水平居中 (需选中 ≥2 个组件)"
          >
            <AlignCenter class="w-3.5 h-3.5 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'right')"
            :disabled="selectedIds.length < 2"
            class="p-1 rounded transition-colors"
            :class="selectedIds.length >= 2 ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="右对齐 (需选中 ≥2 个组件)"
          >
            <AlignRight class="w-3.5 h-3.5 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'top')"
            :disabled="selectedIds.length < 2"
            class="p-1 rounded transition-colors"
            :class="selectedIds.length >= 2 ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="顶对齐 (需选中 ≥2 个组件)"
          >
            <AlignVerticalJustifyStart class="w-3.5 h-3.5 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'middle')"
            :disabled="selectedIds.length < 2"
            class="p-1 rounded transition-colors"
            :class="selectedIds.length >= 2 ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="垂直居中 (需选中 ≥2 个组件)"
          >
            <AlignVerticalJustifyCenter class="w-3.5 h-3.5 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'bottom')"
            :disabled="selectedIds.length < 2"
            class="p-1 rounded transition-colors"
            :class="selectedIds.length >= 2 ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="底对齐 (需选中 ≥2 个组件)"
          >
            <AlignVerticalJustifyEnd class="w-3.5 h-3.5 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'distribute-h')"
            :disabled="selectedIds.length < 3"
            class="p-1 rounded transition-colors"
            :class="selectedIds.length >= 3 ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="水平均匀分布 (需选中 ≥3 个组件)"
          >
            <AlignHorizontalSpaceAround class="w-3.5 h-3.5 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'distribute-v')"
            :disabled="selectedIds.length < 3"
            class="p-1 rounded transition-colors"
            :class="selectedIds.length >= 3 ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="垂直均匀分布 (需选中 ≥3 个组件)"
          >
            <AlignVerticalSpaceAround class="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>

        <div class="h-3.5 w-[1px] bg-cyan-500/40 mx-0.5" />

        <!-- Equal Size Tools (Active when multiple components selected) -->
        <div class="flex items-center bg-[#152e52] p-0.5 rounded-md border border-cyan-500/50 gap-0.5">
          <button
            @click="emit('align', 'equal-width')"
            :disabled="selectedIds.length < 2"
            class="p-1 rounded transition-colors flex items-center gap-1"
            :class="selectedIds.length >= 2 ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="等宽 (所有选中组件宽度与首选一致)"
          >
            <MoveHorizontal class="w-3.5 h-3.5 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'equal-height')"
            :disabled="selectedIds.length < 2"
            class="p-1 rounded transition-colors flex items-center gap-1"
            :class="selectedIds.length >= 2 ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="等高 (所有选中组件高度与首选一致)"
          >
            <MoveVertical class="w-3.5 h-3.5 stroke-[2]" />
          </button>
          <button
            @click="emit('align', 'equal-size')"
            :disabled="selectedIds.length < 2"
            class="p-1 rounded transition-colors flex items-center gap-1"
            :class="selectedIds.length >= 2 ? 'text-cyan-200 hover:text-white hover:bg-cyan-500/40 cursor-pointer shadow-xs' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="完全等大小 (所有选中组件宽高统一)"
          >
            <Scaling class="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>

        <div class="h-3.5 w-[1px] bg-cyan-500/40 mx-0.5" />

        <!-- Group / Ungroup / Save Symbol -->
        <div class="flex items-center bg-[#152e52] p-0.5 rounded-md border border-cyan-500/50 gap-0.5">
          <button
            @click="emit('group')"
            :disabled="selectedIds.length < 2"
            class="p-1 rounded transition-colors"
            :class="selectedIds.length >= 2 ? 'text-cyan-100 hover:text-white hover:bg-cyan-900/80 cursor-pointer shadow-xs' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="组合为群组 (Ctrl+G)"
          >
            <Layers class="w-3.5 h-3.5 stroke-[2]" />
          </button>

          <button
            @click="emit('ungroup')"
            :disabled="selectedIds.length !== 1 || (!selectedComponents[0]?.children?.length && selectedComponents[0]?.type !== 'composite-symbol')"
            class="p-1 rounded transition-colors"
            :class="selectedIds.length === 1 && (selectedComponents[0]?.children?.length || selectedComponents[0]?.type === 'composite-symbol') ? 'text-amber-300 hover:text-white hover:bg-amber-950 cursor-pointer' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="取消群组/解构 (Ctrl+U)"
          >
            <Unlock class="w-3.5 h-3.5 stroke-[2]" />
          </button>

          <button
            @click="emit('save:symbol')"
            :disabled="selectedIds.length === 0"
            class="p-1 rounded transition-colors"
            :class="selectedIds.length > 0 ? 'text-emerald-300 hover:text-white hover:bg-emerald-950 cursor-pointer' : 'text-slate-400/40 cursor-default bg-[#152e52]'"
            title="将选中图元封装保存为自定义图元"
          >
            <BookmarkPlus class="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>
      </div>

      <!-- Right: Zoom Controls -->
      <div class="flex items-center gap-1.5 shrink-0">
        <div class="flex items-center bg-[#152e52] p-0.5 rounded-md border border-cyan-500/40 text-xs font-mono">
          <button
            @click="emit('update:zoom', Math.max(0.1, Number((zoom - 0.1).toFixed(2))))"
            class="p-1 rounded hover:bg-cyan-900/60 text-cyan-200 hover:text-white cursor-pointer transition-colors"
            title="缩小"
          >
            <ZoomOut class="w-3.5 h-3.5 stroke-[2]" />
          </button>
          <span class="text-[11px] font-mono font-light text-cyan-200 bg-[#204576] border border-cyan-400/80 rounded px-1.5 py-0.5 w-12 text-center">
            {{ Math.round(zoom * 100) }}%
          </span>
          <button
            @click="emit('update:zoom', Math.min(2.5, Number((zoom + 0.1).toFixed(2))))"
            class="p-1 rounded hover:bg-cyan-900/60 text-cyan-200 hover:text-white cursor-pointer transition-colors"
            title="放大"
          >
            <ZoomIn class="w-3.5 h-3.5 stroke-[2]" />
          </button>

          <button
            @click="emit('fit:screen')"
            class="p-1 rounded hover:bg-cyan-500/30 text-cyan-200 hover:text-white cursor-pointer transition-colors ml-0.5"
            title="一键居中：自适应缩放并从原点 (0, 0) 铺满编辑界面"
          >
            <Maximize2 class="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

