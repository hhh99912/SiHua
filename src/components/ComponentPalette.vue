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

const refreshCustomSymbols = () => {
  customSymbols.value = getCustomSymbols();
};

onMounted(() => {
  refreshCustomSymbols();
  refreshCustomSymbolsFromDisk().then(refreshCustomSymbols).catch(() => {});
  window.addEventListener('scada:custom-symbols-updated', refreshCustomSymbols);
});

const categories: { id: ComponentCategory; label: string; icon: string }[] = [
  { id: 'electrical', label: '电力一次系统', icon: '⚡' },
  { id: 'status', label: '状态图元/遥信', icon: '🟢' },
  { id: 'metrics', label: '数值图元/遥测', icon: '🔢' },
  { id: 'buttons', label: '交互控制/按钮', icon: '🔘' },
  { id: 'media', label: '多媒体/图片素材', icon: '🖼️' },
  { id: 'charts', label: '统计图表/曲线', icon: '📊' },
  { id: 'decoration', label: '科技边框/修饰', icon: '✨' },
  { id: 'basic', label: '基础几何图元', icon: '📐' },
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

// Merge static component definitions with custom symbols dynamically
const allComponents = computed<ComponentDefinition[]>(() => {
  // Convert custom symbols into ComponentDefinition format (All directly in electrical category)
  const symbolDefs: ComponentDefinition[] = customSymbols.value.map(sym => ({
    type: 'composite-symbol' as ComponentType,
    category: 'electrical' as ComponentCategory,
    name: sym.name,
    nameEn: sym.id,
    iconName: 'Zap',
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

const matchItemCategory = (c: ComponentDefinition, catId: ComponentCategory): boolean => {
  if (catId === 'electrical') {
    return c.category === 'electrical' || c.type === 'composite-symbol' || Boolean(c.defaultCustomProps?.isCustomSymbol);
  }
  if (catId === 'buttons') {
    return c.category === 'buttons' || c.type === 'ctrl-button';
  }
  if (catId === 'basic') {
    return c.category === 'basic' && c.type !== 'ctrl-button';
  }
  return c.category === catId;
};

// 折叠展开设计：默认全部折叠 (expandedSections 初始为空对象，所有分类均为 false)
const expandedSections = ref<Record<string, boolean>>({});

const toggleSection = (catId: string) => {
  expandedSections.value[catId] = !expandedSections.value[catId];
};

const groupedComponents = computed(() => {
  return categories
    .map(cat => ({
      id: cat.id,
      label: cat.label,
      icon: cat.icon,
      items: allComponents.value.filter(c => matchItemCategory(c, cat.id))
    }))
    .filter(g => g.items.length > 0);
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
  <aside class="w-72 shrink-0 h-full bg-[#0c1424] border-r border-slate-800 flex flex-col select-none z-30 shadow-xl overflow-hidden font-sans">
    <!-- Header: Title & Custom Symbol Workshop -->
    <div class="px-3.5 py-3 border-b border-slate-800 bg-[#101c33] flex items-center justify-between">
      <div class="flex items-center gap-2 font-sans font-bold text-base text-slate-100">
        <Sparkles class="w-4.5 h-4.5 text-cyan-400" />
        <span class="tracking-wide">组件物料库</span>
      </div>
      <button
        @click="emit('open:symbol-modal')"
        class="flex items-center gap-1.5 text-xs font-bold text-cyan-400 bg-cyan-950/80 hover:bg-cyan-400 hover:text-slate-950 border border-cyan-500/50 hover:border-cyan-300 px-2.5 py-1 rounded-lg cursor-pointer transition-all shadow-xs"
        title="管理与制作自定义图元工坊"
      >
        <FolderOpen class="w-3.5 h-3.5" />
        <span>图元工坊</span>
      </button>
    </div>

    <!-- Component Item Cards List: Collapsible Accordion Sections (Default All Collapsed) -->
    <div class="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
      <div 
        v-for="catGroup in groupedComponents" 
        :key="catGroup.id" 
        class="rounded-xl bg-[#111d35] border border-slate-700/60 overflow-hidden transition-colors"
      >
        <!-- Category Section Header: Click to expand / collapse -->
        <div 
          @click="toggleSection(catGroup.id)"
          class="flex items-center justify-between px-3 py-2.5 bg-[#152340] hover:bg-[#1a2d50] text-sm font-bold text-slate-100 cursor-pointer select-none transition-colors sticky top-0 z-10"
        >
          <div class="flex items-center gap-2">
            <span>{{ catGroup.icon }}</span>
            <span class="text-slate-100 font-bold text-sm">{{ catGroup.label }}</span>
            <span class="text-xs font-mono text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/50 font-bold">({{ catGroup.items.length }})</span>
          </div>
          <ChevronDown 
            class="w-4 h-4 text-slate-400 transition-transform duration-200" 
            :class="{ '-rotate-90': !expandedSections[catGroup.id] }"
          />
        </div>

        <!-- Category Section Items (Collapsed by default, shown when expanded) -->
        <div v-show="expandedSections[catGroup.id]" class="p-2 space-y-1.5 border-t border-slate-800 bg-[#0b1322]">
          <div
            v-for="item in catGroup.items"
            :key="item.type + item.name + (item.defaultCustomProps?.symbolId || '')"
            draggable="true"
            @dragstart="handleDragStart($event, item)"
            @click="emit('add:component', item)"
            class="group p-2.5 rounded-lg bg-[#13203a] hover:bg-[#1a2c4e] border border-slate-700/70 hover:border-cyan-400 transition-colors cursor-pointer flex items-center gap-3 relative"
            :title="`拖拽或点击添加「${item.name}」到画布`"
          >
            <!-- Icon preview badge -->
            <div class="w-8 h-8 rounded-lg bg-[#0d1627] border border-slate-700 group-hover:border-cyan-400/80 flex items-center justify-center text-cyan-400 group-hover:text-cyan-300 shrink-0 transition-colors">
              <component :is="getIcon(item.iconName)" class="w-4.5 h-4.5 stroke-[1.8]" />
            </div>

            <div class="flex-1 min-w-0 flex items-center justify-between">
              <h4 class="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors truncate tracking-wide">
                {{ item.name }}
              </h4>
              <Plus class="w-4 h-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
