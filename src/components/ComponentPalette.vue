<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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
import { ComponentCategory, ComponentType, CustomSymbolDef } from '../types';
import { COMPONENT_DEFINITIONS, ComponentDefinition } from '../data/componentLibrary';
import { getCustomSymbols, refreshCustomSymbolsFromDisk } from '../utils/customSymbolStorage';

const emit = defineEmits<{
  (e: 'add:component', def: any): void;
  (e: 'open:symbol-modal'): void;
}>();

const customSymbols = ref<CustomSymbolDef[]>([]);
const searchQuery = ref('');

const refreshCustomSymbols = () => {
  customSymbols.value = getCustomSymbols();
};

onMounted(() => {
  refreshCustomSymbols();
  refreshCustomSymbolsFromDisk().then(refreshCustomSymbols).catch(() => {});
  window.addEventListener('scada:custom-symbols-updated', refreshCustomSymbols);
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

// 动态合并预设图元与自定义多态图元
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

  return [...COMPONENT_DEFINITIONS, ...symbolDefs];
});

// 分级展开状态控制 (默认展开一次设备与遥信)
const expandedNodes = ref<Record<string, boolean>>({
  electrical: true,
  'electrical-switches': true,
  'electrical-transformers': false,
  status: true,
  metrics: true,
  buttons: false,
  charts: false,
  basic: false,
  decoration: false,
  custom: true
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

// 过滤和分级构造树形数据 (仅两级级联：一级分类 -> 二级具体图元)
interface ProcessedLeafItem {
  def: ComponentDefinition;
  key: string;
}

interface ProcessedTreeBranch {
  id: string;
  category: ComponentCategory;
  label: string;
  code: string;
  items: ProcessedLeafItem[];
  totalCount: number;
}

const filteredTreeData = computed<ProcessedTreeBranch[]>(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return treeCategories.map(cat => {
    let pool: ComponentDefinition[] = [];
    if (cat.id === 'custom') {
      pool = allComponents.value.filter(c => c.type === 'composite-symbol' || Boolean(c.defaultCustomProps?.isCustomSymbol));
    } else if (cat.id === 'electrical') {
      pool = allComponents.value.filter(c => c.category === 'electrical' && c.type !== 'composite-symbol' && !c.defaultCustomProps?.isCustomSymbol);
    } else if (cat.id === 'buttons') {
      pool = allComponents.value.filter(c => c.category === 'buttons' || c.type === 'ctrl-button');
    } else if (cat.id === 'basic') {
      pool = allComponents.value.filter(c => c.category === 'basic' && c.type !== 'ctrl-button');
    } else {
      pool = allComponents.value.filter(c => c.category === cat.category);
    }

    if (query) {
      pool = pool.filter(c => 
        c.name.toLowerCase().includes(query) || 
        (c.nameEn && c.nameEn.toLowerCase().includes(query)) ||
        (c.description && c.description.toLowerCase().includes(query))
      );
    }

    const items: ProcessedLeafItem[] = pool.map(c => ({
      def: c,
      key: `${c.type}-${c.name}-${c.defaultCustomProps?.symbolId || ''}`
    }));

    return {
      id: cat.id,
      category: cat.category,
      label: cat.label,
      code: cat.code,
      items,
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

    <!-- 3. 图元分级列表 (标准两级级联：一级分类 -> 二级具体图元，明显导引线缩进) -->
    <div class="flex-1 overflow-y-auto bg-[#ebe4d4]">
      <div 
        v-for="branch in filteredTreeData" 
        :key="branch.id" 
        class="border-b border-[#ded5bf]"
      >
        <!-- 一级分类目录节点 (Level 1: 简洁专业，折叠小箭头，中文大类名称，数量角标) -->
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
            <span class="text-[14px] font-semibold text-slate-800 group-hover:text-sky-900 truncate tracking-wide">
              {{ branch.label }}
            </span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-xs font-mono font-normal text-slate-500 bg-[#e4dcce] px-2 py-0.5 rounded">
              {{ branch.totalCount }}
            </span>
          </div>
        </div>

        <!-- 二级图元直属列表 (Level 2: 明显缩进，带树形竖导引线，层级一目了然) -->
        <div v-show="expandedNodes[branch.id]" class="bg-[#ebe4d4] pb-1.5">
          <div class="ml-6 pl-4 border-l-2 border-[#cfc5b0]/70 space-y-0.5 my-1 mr-2">
            <div
              v-for="item in branch.items"
              :key="item.key"
              draggable="true"
              @dragstart="handleDragStart($event, item.def)"
              @click="emit('add:component', item.def)"
              class="group w-full px-2.5 py-1.5 hover:bg-[#e4dcce] rounded transition-colors cursor-pointer flex items-center justify-between gap-2"
              :title="item.def.description || item.def.name"
            >
              <!-- 左侧：图元纯中文名称 -->
              <div class="flex items-center min-w-0 flex-1">
                <span class="text-[13.5px] font-normal text-slate-800 group-hover:text-sky-800 truncate tracking-wide">
                  {{ item.def.name }}
                </span>
              </div>

              <!-- 右侧：简洁快捷添加图标与拖拽手柄 -->
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
</template>
