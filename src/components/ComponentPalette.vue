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
  Search,
  Plus,
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
  Radio
} from 'lucide-vue-next';
import { ComponentCategory, ComponentType, CustomSymbolDef } from '../types';
import { COMPONENT_DEFINITIONS, ComponentDefinition } from '../data/componentLibrary';
import { getCustomSymbols } from '../utils/customSymbolStorage';

const emit = defineEmits<{
  (e: 'add:component', def: any): void;
  (e: 'open:symbol-modal'): void;
}>();

const activeCategory = ref<ComponentCategory | 'all'>('all');
const searchQuery = ref('');
const customSymbols = ref<CustomSymbolDef[]>([]);

const refreshCustomSymbols = () => {
  customSymbols.value = getCustomSymbols();
};

onMounted(() => {
  refreshCustomSymbols();
  window.addEventListener('scada:custom-symbols-updated', refreshCustomSymbols);
});

const categories: { id: ComponentCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'status', label: '🟢 状态图元/遥信' },
  { id: 'metrics', label: '🔢 数值图元/遥测' },
  { id: 'electrical', label: '⚡ 电力一次系统' },
  { id: 'industrial', label: '🏭 工业管网/设备' },
  { id: 'charts', label: '📊 统计图表/曲线' },
  { id: 'decoration', label: '✨ 科技边框/修饰' },
  { id: 'basic', label: '📐 基础几何/按键' },
  { id: 'custom', label: '🧩 复合自定义图元' },
];

const iconMap: Record<string, any> = {
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
  Radio
};

const getIcon = (iconName?: string) => {
  if (iconName && iconMap[iconName]) {
    return iconMap[iconName];
  }
  return Layers;
};

// Merge static component definitions with custom symbols dynamically
const allComponents = computed<ComponentDefinition[]>(() => {
  // Convert custom symbols into ComponentDefinition format
  const symbolDefs: ComponentDefinition[] = customSymbols.value.map(sym => ({
    type: 'composite-symbol' as ComponentType,
    category: (sym.category || 'custom') as ComponentCategory,
    name: sym.name,
    nameEn: sym.id,
    iconName: sym.category === 'electrical' ? 'Zap' : (sym.category === 'industrial' ? 'Activity' : 'Box'),
    description: sym.description || `${sym.states?.length || 1}态自定义组合图元`,
    defaultWidth: sym.defaultWidth || 160,
    defaultHeight: sym.defaultHeight || 160,
    defaultStyle: sym.defaultStyle || { fill: 'transparent', stroke: '#00f2ff', strokeWidth: 1.5 },
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

const filteredComponents = computed(() => {
  return allComponents.value.filter(c => {
    let matchCategory = false;
    if (activeCategory.value === 'all') {
      matchCategory = true;
    } else {
      matchCategory = c.category === activeCategory.value;
    }

    const matchSearch = !searchQuery.value || 
      c.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      c.nameEn.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.value.toLowerCase());
    return matchCategory && matchSearch;
  });
});

// Native Drag Start for drag-and-drop onto canvas
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
  <aside class="w-60 shrink-0 h-full bg-[#060b17] border-r border-cyan-500/30 flex flex-col select-none z-30 shadow-2xl overflow-hidden font-sans">
    <!-- Header -->
    <div class="p-2.5 border-b border-cyan-500/20 bg-[#040812]">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5 font-mono font-bold text-xs text-cyan-200">
          <Sparkles class="w-3.5 h-3.5 text-cyan-400" />
          <span>组件物料库</span>
        </div>
        <button
          @click="emit('open:symbol-modal')"
          class="flex items-center gap-1 text-[10px] font-mono text-cyan-200 bg-cyan-950 hover:bg-cyan-900 border border-cyan-400/60 px-2 py-0.5 rounded cursor-pointer transition-all shadow-xs"
          title="管理与制作自定义图元工坊"
        >
          <FolderOpen class="w-3 h-3 text-cyan-300" />
          <span>图元工坊</span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索刀闸、断路器、仪表..."
          class="w-full pl-7 pr-3 py-1.5 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-400 outline-hidden transition-all shadow-inner"
        />
        <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
      </div>
    </div>

    <!-- Category Tabs Filter -->
    <div class="px-2 py-1.5 border-b border-slate-800/80 flex items-center gap-1 overflow-x-auto custom-scrollbar bg-[#050914]">
      <button
        v-for="cat in categories"
        :key="cat.id"
        @click="activeCategory = cat.id"
        class="px-2 py-1 rounded-md text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer"
        :class="activeCategory === cat.id 
          ? 'bg-cyan-500/25 text-cyan-200 font-bold border border-cyan-400 shadow-xs' 
          : 'text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent'"
      >
        {{ cat.label }}
      </button>
    </div>

    <!-- Component Item Cards List -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
      <div
        v-for="item in filteredComponents"
        :key="item.type + item.name + (item.defaultCustomProps?.symbolId || '')"
        draggable="true"
        @dragstart="handleDragStart($event, item)"
        @click="emit('add:component', item)"
        class="group p-2 rounded-xl bg-slate-900/90 hover:bg-[#0c1930] border border-slate-700/80 hover:border-cyan-400 transition-all cursor-grab active:cursor-grabbing hover:shadow-[0_0_12px_rgba(0,242,255,0.25)] flex items-start gap-2.5 relative"
      >
        <!-- Icon preview badge -->
        <div class="w-9 h-9 rounded-lg bg-[#040812] border border-cyan-500/40 group-hover:border-cyan-300 flex items-center justify-center text-cyan-300 group-hover:text-cyan-200 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
          <component :is="getIcon(item.iconName)" class="w-4 h-4 stroke-[2]" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-mono font-bold text-slate-100 group-hover:text-cyan-200 transition-colors truncate">
              {{ item.name }}
            </h4>
            <Plus class="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <!-- High-contrast Dimensions Badge & Category -->
          <div class="flex items-center gap-1.5 mt-1 text-[10px] font-mono">
            <span class="px-1.5 py-0.2 rounded bg-slate-950 text-cyan-300 font-bold border border-slate-700 text-[9px]">
              {{ item.defaultWidth }} × {{ item.defaultHeight }}
            </span>
            <span class="text-slate-400 text-[9px] uppercase font-semibold">{{ item.category }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Drag Hint -->
    <div class="p-2 border-t border-slate-700/80 text-[10px] font-mono text-slate-300 text-center bg-slate-950">
      💡 支持点击添加 或 拖拽放入画布
    </div>
  </aside>
</template>
