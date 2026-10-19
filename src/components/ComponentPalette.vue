<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  LineChart,
  BarChart3,
  PieChart,
  Gauge,
  Database,
  Workflow,
  AlertTriangle,
  Cpu,
  Binary,
  TrendingUp,
  Heading,
  Frame,
  SquareCode,
  ShieldAlert,
  Crosshair,
  Square,
  Circle,
  Hexagon,
  MoveRight,
  Type,
  Layers,
  Sparkles,
  Plus,
  ChevronDown,
  ChevronRight,
  Code,
  CodeXml,
  Zap,
  ToggleRight,
  CircleDot,
  Activity,
  ZapOff,
  Minus,
  LayoutDashboard,
  FolderOpen,
  Box,
  Triangle,
  Star,
  Diamond,
  Heart,
  MessageSquare,
  Disc,
  ArrowLeftRight,
  CornerDownRight,
  Clock,
  Calendar,
  Timer,
  Radio,
  Lock,
  Key,
  RotateCw,
  Sliders,
  Users,
  Power,
  Search,
  X,
  ChevronsUpDown,
  FolderTree,
  Folder,
  SlidersHorizontal,
  GripVertical,
  Image as ImageIcon
} from 'lucide-vue-next';
import { ScreenComponent, ComponentCategory, ComponentType, CustomSymbolDef } from '../types';
import { COMPONENT_DEFINITIONS, ComponentDefinition } from '../data/componentLibrary';
import { GB_STANDARD_SYMBOLS } from '../data/gbStandardSymbols';
import { getCustomSymbols, refreshCustomSymbolsFromDisk } from '../utils/customSymbolStorage';
import WidgetRenderer from './widgets/WidgetRenderer.vue';

const emit = defineEmits<{
  (e: 'add:component', def: any): void;
  (e: 'open:symbol-modal'): void;
}>();

const customSymbols = ref<CustomSymbolDef[]>([]);
const searchQuery = ref('');

// 鼠标悬浮预览状态 (悬浮在图元上时在右侧弹出图形预览，仅显示图形)
const previewModal = ref<{
  visible: boolean;
  def: ComponentDefinition | null;
  top: number;
}>({
  visible: false,
  def: null,
  top: 100
});

let hoverTimer: any = null;

const handleItemMouseEnter = (e: MouseEvent, def: ComponentDefinition) => {
  clearTimeout(hoverTimer);
  const target = e.currentTarget as HTMLElement | null;
  const rect = target?.getBoundingClientRect();
  const clickTop = rect ? rect.top : e.clientY;
  const clampedTop = Math.max(70, Math.min(window.innerHeight - 340, clickTop - 110));

  previewModal.value = {
    visible: true,
    def,
    top: clampedTop
  };
};

const handleItemMouseLeave = () => {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    previewModal.value.visible = false;
    previewModal.value.def = null;
  }, 100);
};

const handleItemClick = (def: ComponentDefinition) => {
  emit('add:component', def);
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && previewModal.value.visible) {
    previewModal.value.visible = false;
    previewModal.value.def = null;
  }
};

const refreshCustomSymbols = () => {
  customSymbols.value = getCustomSymbols();
};

onMounted(() => {
  refreshCustomSymbols();
  refreshCustomSymbolsFromDisk().then(refreshCustomSymbols).catch(() => {});
  window.addEventListener('scada:custom-symbols-updated', refreshCustomSymbols);
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  clearTimeout(hoverTimer);
  window.removeEventListener('scada:custom-symbols-updated', refreshCustomSymbols);
  window.removeEventListener('keydown', handleKeyDown);
});

// GE-SCADA 图元分类结构体系 (树形目录)
interface TreeCategoryDef {
  id: string;
  category: ComponentCategory;
  label: string;
  code: string;
  icon?: string;
}

const treeCategories: TreeCategoryDef[] = [
  {
    id: 'gb-standard',
    category: 'gb-standard',
    label: '国标图元',
    code: 'GB-STD'
  },
  {
    id: 'electrical',
    category: 'electrical',
    label: '电力一次设备',
    code: 'PRIMARY'
  },
  {
    id: 'status',
    category: 'status',
    label: '遥信与状态图元',
    code: 'DIGITAL'
  },
  {
    id: 'metrics',
    category: 'metrics',
    label: '遥测与测量仪表',
    code: 'ANALOG'
  },
  {
    id: 'buttons',
    category: 'buttons',
    label: '控制与交互按钮',
    code: 'CONTROL'
  },
  {
    id: 'charts',
    category: 'charts',
    label: '负荷与统计图表',
    code: 'CHARTS'
  },
  {
    id: 'basic',
    category: 'basic',
    label: '基础几何与标牌',
    code: 'GEOMETRY'
  },
  {
    id: 'decoration',
    category: 'decoration',
    label: '屏柜与边框修饰',
    code: 'CABINET'
  },
  {
    id: 'custom',
    category: 'electrical',
    label: '自定义组合图元',
    code: 'CUSTOM'
  }
];

const iconMap: Record<string, any> = {
  Image: ImageIcon,
  LineChart,
  BarChart3,
  PieChart,
  Gauge,
  Database,
  Workflow,
  AlertTriangle,
  Cpu,
  Binary,
  TrendingUp,
  Heading,
  Frame,
  SquareCode,
  ShieldAlert,
  Crosshair,
  Square,
  Circle,
  Hexagon,
  MoveRight,
  Type,
  Code,
  CodeXml,
  Zap,
  ToggleRight,
  CircleDot,
  Activity,
  ZapOff,
  Minus,
  LayoutDashboard,
  Box,
  Triangle,
  Star,
  Diamond,
  Heart,
  MessageSquare,
  Disc,
  ArrowLeftRight,
  CornerDownRight,
  Sparkles,
  Plus,
  Clock,
  Calendar,
  Timer,
  Radio,
  Lock,
  Key,
  RotateCw,
  Sliders,
  Users,
  Power
};

const getIcon = (iconName?: string) => {
  if (iconName && iconMap[iconName]) {
    return iconMap[iconName];
  }
  return Layers;
};

// 动态合并国标图元、预设图元与自定义多态图元
const allComponents = computed<ComponentDefinition[]>(() => {
  const symbolDefs: ComponentDefinition[] = customSymbols.value.map(sym => ({
    type: 'composite-symbol' as ComponentType,
    category: 'electrical' as ComponentCategory,
    name: sym.name,
    nameEn: sym.id,
    iconName: 'Zap',
    description: sym.description || `${sym.states?.length || 1}态用户自定义微元`,
    defaultWidth: sym.defaultWidth || 160,
    defaultHeight: sym.defaultHeight || 160,
    defaultStyle: sym.defaultStyle || { fill: 'transparent', stroke: '#0284c7', strokeWidth: 1.5 },
    defaultCustomProps: {
      isCustomSymbol: true,
      symbolId: sym.id,
      states: sym.states,
      children: sym.states?.[0]?.children || sym.children || []
    },
    states: sym.states,
    children: sym.states?.[0]?.children || sym.children || []
  }));

  return [...GB_STANDARD_SYMBOLS, ...COMPONENT_DEFINITIONS, ...symbolDefs];
});

// 分级展开状态控制 (默认展开国标图元)
const expandedNodes = ref<Record<string, boolean>>({
  'gb-standard': true,
  'gb-standard-sub-开关与控制设备': true,
  'gb-standard-sub-变压与变换设备': true,
  'gb-standard-sub-互感与测量保护': false,
  'gb-standard-sub-旋转电机与新能源': false,
  'gb-standard-sub-无功补偿与电抗': false,
  'gb-standard-sub-线路母线与接地': false,
  electrical: false,
  'electrical-switches': false,
  'electrical-transformers': false,
  status: false,
  metrics: false,
  buttons: false,
  charts: false,
  basic: false,
  decoration: false,
  custom: false
});

const toggleNode = (nodeKey: string) => {
  expandedNodes.value[nodeKey] = !expandedNodes.value[nodeKey];
};

const toggleAllNodes = () => {
  const currentStates = Object.values(expandedNodes.value);
  const nextState = !currentStates.every(v => v);
  Object.keys(expandedNodes.value).forEach(k => {
    expandedNodes.value[k] = nextState;
  });
};

// 过滤和分级构造树形数据
interface ProcessedLeafItem {
  def: ComponentDefinition;
  key: string;
}

interface ProcessedSubGroup {
  id: string;
  name: string;
  items: ProcessedLeafItem[];
}

interface ProcessedTreeBranch {
  id: string;
  category: ComponentCategory;
  label: string;
  code: string;
  items: ProcessedLeafItem[];
  subGroups?: ProcessedSubGroup[];
  totalCount: number;
}

const filteredTreeData = computed<ProcessedTreeBranch[]>(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return treeCategories.map(cat => {
    let pool: ComponentDefinition[] = [];
    if (cat.id === 'gb-standard') {
      pool = allComponents.value.filter(c => c.category === 'gb-standard' || Boolean(c.defaultCustomProps?.isGbStandard));
    } else if (cat.id === 'custom') {
      pool = allComponents.value.filter(c => (c.type === 'composite-symbol' || Boolean(c.defaultCustomProps?.isCustomSymbol)) && c.category !== 'gb-standard' && !c.defaultCustomProps?.isGbStandard);
    } else if (cat.id === 'electrical') {
      pool = allComponents.value.filter(c => c.category === 'electrical' && c.type !== 'composite-symbol' && !c.defaultCustomProps?.isCustomSymbol && !c.defaultCustomProps?.isGbStandard);
    } else if (cat.id === 'buttons') {
      pool = allComponents.value.filter(c => (c.category === 'buttons' || c.type === 'ctrl-button') && c.category !== 'gb-standard' && !c.defaultCustomProps?.isGbStandard);
    } else if (cat.id === 'basic') {
      pool = allComponents.value.filter(c => c.category === 'basic' && c.type !== 'ctrl-button' && c.category !== 'gb-standard' && !c.defaultCustomProps?.isGbStandard);
    } else {
      pool = allComponents.value.filter(c => c.category === cat.category && !c.defaultCustomProps?.isGbStandard);
    }

    if (query) {
      pool = pool.filter(c => 
        c.name.toLowerCase().includes(query) || 
        (c.nameEn && c.nameEn.toLowerCase().includes(query)) ||
        (c.description && c.description.toLowerCase().includes(query)) ||
        (c.subCategory && c.subCategory.toLowerCase().includes(query))
      );
    }

    const items: ProcessedLeafItem[] = pool.map(c => ({
      def: c,
      key: `${c.type}-${c.name}-${c.defaultCustomProps?.symbolId || ''}-${c.subCategory || ''}`
    }));

    // 为国标图元构造二级分组体系 (做好分类)
    let subGroups: ProcessedSubGroup[] | undefined = undefined;
    if (cat.id === 'gb-standard') {
      const standardOrder = [
        '开关与控制设备',
        '变压与变换设备',
        '互感与测量保护',
        '旋转电机与新能源',
        '无功补偿与电抗',
        '线路母线与接地'
      ];

      subGroups = [];
      standardOrder.forEach(subName => {
        const subItems = items.filter(it => it.def.subCategory === subName);
        if (subItems.length > 0) {
          subGroups!.push({
            id: `gb-standard-sub-${subName}`,
            name: subName,
            items: subItems
          });
        }
      });

      const otherItems = items.filter(it => !it.def.subCategory || !standardOrder.includes(it.def.subCategory));
      if (otherItems.length > 0) {
        subGroups.push({
          id: 'gb-standard-sub-其他国标图元',
          name: '其他国标图元',
          items: otherItems
        });
      }
    }

    return {
      id: cat.id,
      category: cat.category,
      label: cat.label,
      code: cat.code,
      items,
      subGroups,
      totalCount: items.length
    };
  }).filter(branch => branch.totalCount > 0);
});

// 拖拽图元至画布
const handleDragStart = (e: DragEvent, def: ComponentDefinition) => {
  if (e.dataTransfer) {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: def.type,
      category: def.category,
      name: def.name,
      width: def.defaultWidth,
      height: def.defaultHeight,
      style: def.defaultStyle,
      animation: def.defaultAnimation,
      data: def.defaultData,
      customProps: def.defaultCustomProps,
      states: def.states,
      children: def.children
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }
};

// 构造纯图形预览组件对象
const previewScale = computed(() => {
  if (!previewModal.value.def) return 1;
  const def = previewModal.value.def;
  const maxDim = Math.max(def.defaultWidth || 40, def.defaultHeight || 40);
  const targetDim = 190;
  return Math.min(3.5, Math.max(1, targetDim / maxDim));
});

const previewSize = computed(() => {
  if (!previewModal.value.def) return { width: 140, height: 140 };
  const def = previewModal.value.def;
  const scale = previewScale.value;
  return {
    width: Math.round((def.defaultWidth || 40) * scale),
    height: Math.round((def.defaultHeight || 40) * scale)
  };
});

const previewComponent = computed<ScreenComponent | null>(() => {
  if (!previewModal.value.def) return null;
  const def = previewModal.value.def;
  const scale = previewScale.value;
  const targetW = Math.round((def.defaultWidth || 40) * scale);
  const targetH = Math.round((def.defaultHeight || 40) * scale);

  return {
    id: 'preview-comp-temp',
    type: def.type,
    category: def.category,
    name: def.name,
    x: 0,
    y: 0,
    width: targetW,
    height: targetH,
    rotation: 0,
    zIndex: 1,
    visible: true,
    locked: false,
    style: {
      ...def.defaultStyle,
      fill: def.defaultStyle?.fill || 'transparent',
      stroke: def.defaultStyle?.stroke || '#00f2ff'
    },
    data: def.defaultData || { mapping: {} },
    customProps: def.defaultCustomProps,
    states: def.states,
    children: def.states?.[0]?.children || def.children || []
  };
});
</script>

<template>
  <!-- GE-SCADA 标准图元浏览器 (暖白/米白背景色，两级级联树，明显缩进) -->
  <aside class="w-80 shrink-0 h-full bg-[#ebe4d4] border-r border-[#cfc5b0] flex flex-col select-none z-30 overflow-hidden font-sans text-slate-800 tracking-wide">
    <!-- 1. 顶部标题栏：GE-SCADA 图元浏览器顶标与工坊入口 -->
    <div class="px-3.5 py-2.5 border-b border-[#cfc5b0] bg-[#ebe4d4] flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded bg-[#e4dcce] text-sky-700 border border-[#cfc5b0] flex items-center justify-center font-medium text-xs shadow-2xs">
          <FolderTree class="w-4.5 h-4.5" />
        </div>
        <div class="text-[14px] font-medium text-slate-800 tracking-wide">
          图元浏览器
        </div>
      </div>

      <div class="flex items-center gap-1.5">
        <!-- 一键展开/折叠全部 -->
        <button
          @click="toggleAllNodes"
          class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          title="全部展开 / 全部收起"
        >
          <ChevronsUpDown class="w-4 h-4" />
        </button>

        <!-- 自定义图元工坊 -->
        <button
          @click="emit('open:symbol-modal')"
          class="flex items-center gap-1.5 text-[13px] font-medium text-sky-700 bg-[#e4dcce] hover:bg-[#ded5bf] border border-[#cfc5b0] px-2.5 py-1 rounded cursor-pointer transition-colors shadow-2xs tracking-wide"
          title="打开图元工坊"
        >
          <FolderOpen class="w-4 h-4 text-sky-600" />
          <span>图元工坊</span>
        </button>
      </div>
    </div>

    <!-- 2. 图元搜索筛选框 -->
    <div class="p-2.5 border-b border-[#cfc5b0] bg-[#ebe4d4] shrink-0">
      <div class="relative flex items-center">
        <Search class="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索图元名称..."
          class="w-full bg-[#f2eee3] border border-[#cfc5b0] rounded pl-8 pr-7 py-1.5 text-[14px] text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-sky-500 transition-colors tracking-wide font-normal"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- 3. 图元分级列表 -->
    <div class="flex-1 overflow-y-auto bg-[#ebe4d4]">
      <div 
        v-for="branch in filteredTreeData" 
        :key="branch.id" 
        class="border-b border-[#ded5bf]"
      >
        <!-- 一级分类目录节点 (Level 1) -->
        <div 
          @click="toggleNode(branch.id)"
          class="w-full px-3.5 py-2.5 hover:bg-[#e4dcce] flex items-center justify-between cursor-pointer select-none transition-colors group"
        >
          <div class="flex items-center gap-2 min-w-0">
            <!-- 展开/折叠三角指示 -->
            <button class="text-slate-400 group-hover:text-sky-700 transition-transform duration-150">
              <ChevronDown 
                class="w-4 h-4 transition-transform duration-150" 
                :class="{ '-rotate-90': !expandedNodes[branch.id] }"
              />
            </button>
            <span class="text-[14px] font-semibold text-slate-800 group-hover:text-sky-900 truncate tracking-wide flex items-center gap-1.5">
              <span>{{ branch.label }}</span>
              <span v-if="branch.id === 'gb-standard'" class="text-[10px] bg-red-600/10 text-red-600 px-1 py-0.2 rounded font-mono font-medium border border-red-500/20">
                GB
              </span>
            </span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-xs font-mono font-normal text-slate-500 bg-[#e4dcce] px-2 py-0.5 rounded">
              {{ branch.totalCount }}
            </span>
          </div>
        </div>

        <!-- 二级图元直属列表 / 子分类分组列表 -->
        <div v-show="expandedNodes[branch.id]" class="bg-[#ebe4d4] pb-1.5">
          <!-- A. 国标图元带标准子分类结构 (做好分类) -->
          <template v-if="branch.subGroups && branch.subGroups.length > 0">
            <div 
              v-for="sub in branch.subGroups" 
              :key="sub.id" 
              class="ml-3 my-1"
            >
              <!-- 子分类小标题 (可独立折叠) -->
              <div 
                @click="toggleNode(sub.id)"
                class="px-3 py-1.5 hover:bg-[#ded5bf] rounded flex items-center justify-between cursor-pointer text-slate-700 select-none transition-colors mr-2 group/sub"
              >
                <div class="flex items-center gap-1.5 min-w-0">
                  <ChevronDown 
                    class="w-3.5 h-3.5 text-slate-400 group-hover/sub:text-sky-700 transition-transform duration-150"
                    :class="{ '-rotate-90': expandedNodes[sub.id] === false }"
                  />
                  <span class="text-[13px] font-semibold text-slate-700 group-hover/sub:text-sky-900 tracking-wide">
                    {{ sub.name }}
                  </span>
                </div>
                <span class="text-[11px] font-mono text-slate-400">
                  {{ sub.items.length }}
                </span>
              </div>

              <!-- 子分类下的图元列表 (鼠标悬浮即时显示右侧纯图形预览) -->
              <div 
                v-show="expandedNodes[sub.id] !== false"
                class="ml-4 pl-3 border-l-2 border-[#cfc5b0]/60 space-y-0.5 my-1 mr-2"
              >
                <div
                  v-for="item in sub.items"
                  :key="item.key"
                  draggable="true"
                  @dragstart="handleDragStart($event, item.def)"
                  @mouseenter="handleItemMouseEnter($event, item.def)"
                  @mouseleave="handleItemMouseLeave"
                  @click="handleItemClick(item.def)"
                  class="group w-full px-2 py-1.5 hover:bg-[#ded5bf] rounded transition-colors cursor-pointer flex items-center justify-between gap-2"
                  :class="{ 'bg-[#ded5bf] text-sky-800 font-medium': previewModal.visible && previewModal.def?.name === item.def.name }"
                  :title="item.def.description || item.def.name"
                >
                  <div class="flex items-center min-w-0 flex-1">
                    <span class="text-[13px] font-normal text-slate-800 group-hover:text-sky-800 truncate tracking-wide">
                      {{ item.def.name }}
                    </span>
                  </div>

                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#cfc5b0] text-sky-700 transition-opacity cursor-pointer"
                      title="点击直接添加至画布中央"
                    >
                      <Plus class="w-3.5 h-3.5" />
                    </button>
                    <GripVertical class="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- B. 常规未分二级子组列表 (同样支持鼠标悬浮预览) -->
          <template v-else>
            <div class="ml-6 pl-4 border-l-2 border-[#cfc5b0]/70 space-y-0.5 my-1 mr-2">
              <div
                v-for="item in branch.items"
                :key="item.key"
                draggable="true"
                @dragstart="handleDragStart($event, item.def)"
                @mouseenter="handleItemMouseEnter($event, item.def)"
                @mouseleave="handleItemMouseLeave"
                @click="handleItemClick(item.def)"
                class="group w-full px-2.5 py-1.5 hover:bg-[#e4dcce] rounded transition-colors cursor-pointer flex items-center justify-between gap-2"
                :class="{ 'bg-[#e4dcce] text-sky-800 font-medium': previewModal.visible && previewModal.def?.name === item.def.name }"
                :title="item.def.description || item.def.name"
              >
                <!-- 左侧：图元名称 -->
                <div class="flex items-center min-w-0 flex-1">
                  <span class="text-[13.5px] font-normal text-slate-800 group-hover:text-sky-800 truncate tracking-wide">
                    {{ item.def.name }}
                  </span>
                </div>

                <!-- 右侧：快捷添加与拖拽手柄 -->
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#ded5bf] text-sky-700 transition-opacity cursor-pointer"
                    title="点击直接添加至画布中央"
                  >
                    <Plus class="w-3.5 h-3.5" />
                  </button>
                  <GripVertical class="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0" />
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 空搜索结果提示 -->
      <div 
        v-if="filteredTreeData.length === 0" 
        class="py-8 text-center text-slate-400 text-[13px] flex flex-col items-center justify-center gap-2"
      >
        <FolderTree class="w-8 h-8 text-slate-300 stroke-[1.2]" />
        <span>未找到与 "{{ searchQuery }}" 匹配的图元</span>
        <button 
          @click="searchQuery = ''"
          class="text-xs text-sky-600 hover:underline cursor-pointer"
        >
          清除搜索条件
        </button>
      </div>
    </div>

    <!-- 4. 底部图元统计与提示 -->
    <div class="px-3.5 py-2 bg-[#ebe4d4] border-t border-[#cfc5b0] flex items-center justify-between text-[12px] text-slate-500 font-mono shrink-0">
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-500" />
        <span>图元库已就绪</span>
      </div>
      <span>共 {{ allComponents.length }} 个元件</span>
    </div>
  </aside>

  <!-- 5. 鼠标悬浮纯图形预览弹框 (右侧轻量浮动展示，仅显示纯图形，不要做任何多余解释，pointer-events-none零阻碍) -->
  <teleport to="body">
    <div 
      v-if="previewModal.visible && previewModal.def" 
      class="fixed pointer-events-none z-50 transition-all duration-75"
      :style="{
        left: '326px',
        top: previewModal.top + 'px'
      }"
    >
      <div 
        class="w-[280px] h-[280px] bg-[#0c1322]/95 border-2 border-cyan-500/80 rounded-xl shadow-2xl shadow-cyan-950/90 flex flex-col items-center justify-center p-4 select-none overflow-hidden backdrop-blur-md"
        :style="{
          backgroundImage: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 1px, transparent 1px)',
          backgroundSize: '16px 16px'
        }"
      >
        <!-- 纯图形预览区域 (只显示图形，没有任何多余解释或文字) -->
        <div class="w-full h-full flex items-center justify-center relative overflow-hidden">
          <div 
            class="relative flex items-center justify-center"
            :style="{
              width: previewSize.width + 'px',
              height: previewSize.height + 'px'
            }"
          >
            <WidgetRenderer 
              v-if="previewComponent"
              :component="previewComponent"
              :preview-mode="true"
            />
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>
