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
  icon: string;
  subcategories?: {
    id: string;
    label: string;
    filter: (c: ComponentDefinition) => boolean;
  }[];
}

const treeCategories: TreeCategoryDef[] = [
  {
    id: 'electrical',
    category: 'electrical',
    label: '电力一次设备',
    code: 'PRIMARY',
    icon: '⚡',
    subcategories: [
      {
        id: 'switches',
        label: '开关刀闸类 (QF/QS/QE)',
        filter: c => ['breaker', 'disconnector', 'ground-switch', 'fuse'].includes(c.type) || c.name.includes('断路器') || c.name.includes('刀闸') || c.name.includes('开关')
      },
      {
        id: 'transformers',
        label: '变配电设备 (变压器/母线/避雷器)',
        filter: c => ['transformer', 'busbar', 'lightning-arrester', 'generator', 'reactor', 'capacitor', 'pt-cabinet'].includes(c.type) || c.name.includes('变压器') || c.name.includes('母线') || c.name.includes('避雷器') || c.name.includes('电抗器') || c.name.includes('电容器')
      }
    ]
  },
  {
    id: 'status',
    category: 'status',
    label: '遥信与状态图元',
    code: 'DIGITAL',
    icon: '🟢',
    subcategories: [
      {
        id: 'indicators',
        label: '状态指示灯与带电显示',
        filter: c => c.name.includes('指示灯') || c.name.includes('带电') || c.name.includes('双态') || c.type === 'status-indicator'
      },
      {
        id: 'alarms',
        label: '事故告警与事件牌',
        filter: c => c.name.includes('告警') || c.name.includes('事故') || c.name.includes('光字牌') || c.type === 'alarm-badge'
      }
    ]
  },
  {
    id: 'metrics',
    category: 'metrics',
    label: '遥测与测量仪表',
    code: 'ANALOG',
    icon: '🔢',
    subcategories: [
      {
        id: 'numeric',
        label: '遥测数字显示牌',
        filter: c => c.name.includes('数字') || c.name.includes('数值') || c.type === 'numeric-display' || c.type === 'text-label'
      },
      {
        id: 'dials',
        label: '指针仪表与刻度盘',
        filter: c => c.name.includes('指针') || c.name.includes('表盘') || c.type === 'gauge'
      }
    ]
  },
  {
    id: 'buttons',
    category: 'buttons',
    label: '控制与交互按钮',
    code: 'CONTROL',
    icon: '🔘'
  },
  {
    id: 'charts',
    category: 'charts',
    label: '负荷与统计图表',
    code: 'CHARTS',
    icon: '📊'
  },
  {
    id: 'basic',
    category: 'basic',
    label: '基础几何与标牌',
    code: 'GEOMETRY',
    icon: '📐',
    subcategories: [
      {
        id: 'shapes',
        label: '基础几何形状 (矩形/圆/三角)',
        filter: c => c.type.startsWith('draw-') || ['draw-rect', 'draw-circle', 'draw-triangle', 'draw-diamond', 'draw-ellipse', 'draw-rounded-rect'].includes(c.type)
      },
      {
        id: 'connectors',
        label: '连接导线与母线标牌',
        filter: c => ['draw-line', 'draw-polyline', 'draw-arrow', 'busbar-line', 'text-label'].includes(c.type) || c.name.includes('标牌') || c.name.includes('导线')
      }
    ]
  },
  {
    id: 'decoration',
    category: 'decoration',
    label: '屏柜与边框修饰',
    code: 'CABINET',
    icon: '✨'
  },
  {
    id: 'custom',
    category: 'electrical',
    label: '自定义组合图元',
    code: 'CUSTOM',
    icon: '🧩'
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
  'status-indicators': true,
  'status-alarms': false,
  metrics: false,
  'metrics-numeric': false,
  'metrics-dials': false,
  buttons: false,
  charts: false,
  basic: false,
  'basic-shapes': false,
  'basic-connectors': false,
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

// 过滤和分级构造树形数据
interface ProcessedLeafItem {
  def: ComponentDefinition;
  key: string;
}

interface ProcessedSubCategory {
  id: string;
  label: string;
  items: ProcessedLeafItem[];
}

interface ProcessedTreeBranch {
  id: string;
  category: ComponentCategory;
  label: string;
  code: string;
  icon: string;
  directItems: ProcessedLeafItem[];
  subcategories: ProcessedSubCategory[];
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

    const subcategories: ProcessedSubCategory[] = [];
    let directItems: ProcessedLeafItem[] = [];

    if (cat.subcategories && cat.subcategories.length > 0) {
      const assignedDefs = new Set<ComponentDefinition>();
      cat.subcategories.forEach(sub => {
        const matching = pool.filter(c => sub.filter(c));
        matching.forEach(c => assignedDefs.add(c));
        subcategories.push({
          id: `${cat.id}-${sub.id}`,
          label: sub.label,
          items: matching.map(c => ({
            def: c,
            key: `${c.type}-${c.name}-${c.defaultCustomProps?.symbolId || ''}`
          }))
        });
      });

      // 未归入子类的放入 directItems
      const leftovers = pool.filter(c => !assignedDefs.has(c));
      directItems = leftovers.map(c => ({
        def: c,
        key: `${c.type}-${c.name}-${c.defaultCustomProps?.symbolId || ''}`
      }));
    } else {
      directItems = pool.map(c => ({
        def: c,
        key: `${c.type}-${c.name}-${c.defaultCustomProps?.symbolId || ''}`
      }));
    }

    const totalCount = directItems.length + subcategories.reduce((acc, s) => acc + s.items.length, 0);

    return {
      id: cat.id,
      category: cat.category,
      label: cat.label,
      code: cat.code,
      icon: cat.icon,
      directItems,
      subcategories,
      totalCount
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
  <!-- GE-SCADA 标准图元浏览器 (纯白主题背景 + 经典 SCADA 树状层级列表，叶子节点独占单行) -->
  <aside class="w-80 shrink-0 h-full bg-white border-r border-slate-200 flex flex-col select-none z-30 shadow-xs overflow-hidden font-sans text-slate-800 tracking-wide">
    <!-- 1. 顶部标题栏：GE-SCADA 图元浏览器顶标与工坊入口 (纯白背景) -->
    <div class="px-3.5 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center font-bold text-xs shadow-2xs">
          <FolderTree class="w-4 h-4" />
        </div>
        <div class="text-sm font-bold text-slate-900 tracking-wide">
          图元浏览器
        </div>
      </div>

      <div class="flex items-center gap-1.5">
        <!-- 一键展开/折叠全部 -->
        <button
          @click="toggleAllNodes"
          class="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          title="全部展开 / 全部收起"
        >
          <ChevronsUpDown class="w-4 h-4" />
        </button>

        <!-- 自定义图元工坊 -->
        <button
          @click="emit('open:symbol-modal')"
          class="flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded cursor-pointer transition-colors shadow-2xs tracking-wide"
          title="打开图元微元工坊，制作与管理多态组合图元"
        >
          <FolderOpen class="w-3.5 h-3.5 text-sky-600" />
          <span>图元工坊</span>
        </button>
      </div>
    </div>

    <!-- 2. 图元搜索筛选框 (纯白底色) -->
    <div class="p-2.5 border-b border-slate-100 bg-slate-50/60 shrink-0">
      <div class="relative flex items-center">
        <Search class="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="按名称、测点类型搜索图元..."
          class="w-full bg-white border border-slate-200 rounded-md pl-8 pr-7 py-1.5 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-sky-500 transition-colors shadow-2xs tracking-wide"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- 3. 图元分级树形列表 (叶子节点独占一行，严格工业树控件布局) -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1.5 bg-white">
      <div 
        v-for="branch in filteredTreeData" 
        :key="branch.id" 
        class="border border-slate-200/90 rounded-lg overflow-hidden bg-white mb-1.5 shadow-2xs"
      >
        <!-- 根分类目录节点 (Level 1 Folder Node) -->
        <div 
          @click="toggleNode(branch.id)"
          class="w-full px-3 py-2 bg-slate-50 hover:bg-sky-50/60 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none transition-colors group"
        >
          <div class="flex items-center gap-2 min-w-0">
            <!-- 展开/折叠三角指示 -->
            <button class="text-slate-400 group-hover:text-sky-700 transition-transform duration-150">
              <ChevronDown 
                class="w-4 h-4 transition-transform duration-150" 
                :class="{ '-rotate-90': !expandedNodes[branch.id] }"
              />
            </button>
            <span class="text-sm shrink-0">{{ branch.icon }}</span>
            <span class="text-[13.5px] font-bold text-slate-800 group-hover:text-sky-900 truncate tracking-wide">
              {{ branch.label }}
            </span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[11px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              {{ branch.totalCount }}
            </span>
          </div>
        </div>

        <!-- 根分类内容展开区 -->
        <div v-show="expandedNodes[branch.id]" class="bg-white">
          <!-- A. 二级子分类 (Level 2 Subcategory Branches) -->
          <template v-if="branch.subcategories && branch.subcategories.length > 0">
            <div 
              v-for="sub in branch.subcategories" 
              :key="sub.id"
              class="border-b border-slate-100 last:border-b-0"
            >
              <!-- 二级目录条 -->
              <div 
                v-if="sub.items.length > 0"
                @click="toggleNode(sub.id)"
                class="pl-6 pr-3 py-1.5 bg-slate-50/40 hover:bg-slate-100/70 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none text-xs font-bold text-slate-700 transition-colors tracking-wide"
              >
                <div class="flex items-center gap-1.5 min-w-0">
                  <ChevronDown 
                    class="w-3.5 h-3.5 text-slate-400 transition-transform duration-150" 
                    :class="{ '-rotate-90': !expandedNodes[sub.id] }"
                  />
                  <Folder class="w-3.5 h-3.5 text-amber-500 fill-amber-100 shrink-0" />
                  <span class="truncate text-slate-800">{{ sub.label }}</span>
                </div>
                <span class="text-[10px] font-mono font-medium text-slate-400">
                  {{ sub.items.length }}
                </span>
              </div>

              <!-- 二级叶子节点列表 (叶子节点独占一行，单行整宽) -->
              <div v-show="expandedNodes[sub.id]" class="divide-y divide-slate-100">
                <div
                  v-for="item in sub.items"
                  :key="item.key"
                  draggable="true"
                  @dragstart="handleDragStart($event, item.def)"
                  @click="emit('add:component', item.def)"
                  class="group w-full pl-8 pr-3 py-2 bg-white hover:bg-sky-50/80 transition-colors cursor-pointer flex items-center justify-between gap-2.5 border-l-2 border-transparent hover:border-sky-500"
                  :title="`拖拽或双击添加「${item.def.name}」到当前接线图\n${item.def.description || ''}`"
                >
                  <!-- 左侧：图标 + 中文名称独占整行 -->
                  <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <div class="w-6 h-6 rounded bg-slate-50 group-hover:bg-white border border-slate-200 group-hover:border-sky-300 flex items-center justify-center text-sky-700 shrink-0 transition-colors shadow-2xs">
                      <component :is="getIcon(item.def.iconName)" class="w-3.5 h-3.5 stroke-[2]" />
                    </div>
                    <span class="text-[13px] font-medium text-slate-800 group-hover:text-sky-900 truncate tracking-wide">
                      {{ item.def.name }}
                    </span>
                  </div>

                  <!-- 右侧：型号代码与快捷添加按钮 -->
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span 
                      v-if="item.def.nameEn" 
                      class="text-[10px] font-mono text-slate-400 group-hover:text-slate-600 hidden group-hover:inline-block max-w-[80px] truncate"
                    >
                      {{ item.def.nameEn }}
                    </span>
                    <button
                      class="opacity-0 group-hover:opacity-100 p-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-700 transition-opacity cursor-pointer"
                      title="点击加入画布"
                    >
                      <Plus class="w-3.5 h-3.5" />
                    </button>
                    <GripVertical class="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-400 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- B. 直接挂在根分类下的叶子节点 (独占整行) -->
          <div v-if="branch.directItems.length > 0" class="divide-y divide-slate-100 border-t border-slate-100 first:border-t-0">
            <div
              v-for="item in branch.directItems"
              :key="item.key"
              draggable="true"
              @dragstart="handleDragStart($event, item.def)"
              @click="emit('add:component', item.def)"
              class="group w-full pl-6 pr-3 py-2 bg-white hover:bg-sky-50/80 transition-colors cursor-pointer flex items-center justify-between gap-2.5 border-l-2 border-transparent hover:border-sky-500"
              :title="`拖拽或双击添加「${item.def.name}」到当前接线图\n${item.def.description || ''}`"
            >
              <!-- 左侧：图标 + 名称 -->
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <div class="w-6 h-6 rounded bg-slate-50 group-hover:bg-white border border-slate-200 group-hover:border-sky-300 flex items-center justify-center text-sky-700 shrink-0 transition-colors shadow-2xs">
                  <component :is="getIcon(item.def.iconName)" class="w-3.5 h-3.5 stroke-[2]" />
                </div>
                <span class="text-[13px] font-medium text-slate-800 group-hover:text-sky-900 truncate tracking-wide">
                  {{ item.def.name }}
                </span>
              </div>

              <!-- 右侧：辅助标识与按钮 -->
              <div class="flex items-center gap-1.5 shrink-0">
                <span 
                  v-if="item.def.states?.length"
                  class="text-[10px] font-mono bg-sky-50 text-sky-700 border border-sky-200 px-1.5 rounded"
                >
                  {{ item.def.states.length }}态
                </span>
                <span 
                  v-else-if="item.def.nameEn" 
                  class="text-[10px] font-mono text-slate-400 group-hover:text-slate-600 hidden group-hover:inline-block max-w-[80px] truncate"
                >
                  {{ item.def.nameEn }}
                </span>
                <button
                  class="opacity-0 group-hover:opacity-100 p-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-700 transition-opacity cursor-pointer"
                  title="点击加入画布"
                >
                  <Plus class="w-3.5 h-3.5" />
                </button>
                <GripVertical class="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-400 shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空搜索结果提示 -->
      <div 
        v-if="filteredTreeData.length === 0" 
        class="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2"
      >
        <FolderTree class="w-8 h-8 text-slate-300 stroke-[1.2]" />
        <span>未找到与 "{{ searchQuery }}" 匹配的图元</span>
        <button 
          @click="searchQuery = ''"
          class="text-[11px] text-sky-600 hover:underline cursor-pointer"
        >
          清除搜索条件
        </button>
      </div>
    </div>

    <!-- 4. 底部图元统计与提示 (纯白背景) -->
    <div class="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono shrink-0">
      <div class="flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span>图元库已就绪</span>
      </div>
      <span>共 {{ allComponents.length }} 个组态元件</span>
    </div>
  </aside>
</template>
