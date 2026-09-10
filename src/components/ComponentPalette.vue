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
  Image as ImageIcon,
  Video
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
  { id: 'media', label: '多媒体/视频监控', icon: '🎬' },
  { id: 'industrial', label: '工业管网/设备', icon: '🏭' },
  { id: 'charts', label: '统计图表/曲线', icon: '📊' },
  { id: 'decoration', label: '科技边框/修饰', icon: '✨' },
  { id: 'basic', label: '基础几何图元', icon: '📐' },
  { id: 'custom', label: '复合自定义图元', icon: '🧩' },
];

const iconMap: Record<string, any> = {
  Image: ImageIcon,
  Video,
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

const matchItemCategory = (c: ComponentDefinition, catId: ComponentCategory): boolean => {
  if (catId === 'custom') {
    return c.category === 'custom' || c.type === 'composite-symbol' || Boolean(c.defaultCustomProps?.isCustomSymbol);
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
  <aside class="w-64 shrink-0 h-full bg-[#10213b] border-r border-cyan-400/50 flex flex-col select-none z-30 shadow-xl overflow-hidden font-sans">
    <!-- Header: Title & Custom Symbol Workshop -->
    <div class="px-2.5 py-2 border-b border-cyan-500/30 bg-[#142c4e] flex items-center justify-between">
      <div class="flex items-center gap-1.5 font-mono font-medium text-xs text-cyan-200">
        <Sparkles class="w-3.5 h-3.5 text-cyan-300" />
        <span class="font-normal tracking-wide">组件物料库</span>
      </div>
      <button
        @click="emit('open:symbol-modal')"
        class="flex items-center gap-1 text-[10px] font-mono text-cyan-200 bg-[#1c3e6c] hover:bg-cyan-600 hover:text-slate-950 border border-cyan-400/80 px-2 py-0.5 rounded cursor-pointer transition-all shadow-xs"
        title="管理与制作自定义图元工坊"
      >
        <FolderOpen class="w-3 h-3 text-cyan-300" />
        <span class="font-light">图元工坊</span>
      </button>
    </div>

    <!-- Component Item Cards List: Collapsible Accordion Sections (Default All Collapsed) -->
    <div class="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
      <div 
        v-for="catGroup in groupedComponents" 
        :key="catGroup.id" 
        class="rounded-lg bg-[#142c4e]/50 border border-cyan-500/25 overflow-hidden transition-colors"
      >
        <!-- Category Section Header: Click to expand / collapse -->
        <div 
          @click="toggleSection(catGroup.id)"
          class="flex items-center justify-between px-3 py-2 bg-[#163056] hover:bg-[#1a3864] text-xs font-mono text-cyan-200 cursor-pointer select-none transition-colors sticky top-0 z-10"
        >
          <div class="flex items-center gap-2">
            <span>{{ catGroup.icon }}</span>
            <span class="font-normal">{{ catGroup.label }}</span>
            <span class="text-[10px] text-cyan-300/70 font-light">({{ catGroup.items.length }})</span>
          </div>
          <ChevronDown 
            class="w-3.5 h-3.5 text-cyan-300 transition-transform duration-200" 
            :class="{ '-rotate-90': !expandedSections[catGroup.id] }"
          />
        </div>

        <!-- Category Section Items (Collapsed by default, shown when expanded) -->
        <div v-show="expandedSections[catGroup.id]" class="p-2 space-y-1.5 border-t border-cyan-500/20 bg-[#0e1e36]/60">
          <div
            v-for="item in catGroup.items"
            :key="item.type + item.name + (item.defaultCustomProps?.symbolId || '')"
            draggable="true"
            @dragstart="handleDragStart($event, item)"
            @click="emit('add:component', item)"
            class="group p-2 rounded-xl bg-[#142c4e] hover:bg-[#183761] border border-cyan-500/40 hover:border-cyan-300 transition-all cursor-pointer hover:shadow-[0_0_14px_rgba(0,242,255,0.35)] flex items-start gap-2.5 relative"
            :title="`拖拽或点击添加「${item.name}」到画布`"
          >
            <!-- Icon preview badge -->
            <div class="w-9 h-9 rounded-lg bg-[#10213b] border border-cyan-400/60 group-hover:border-cyan-300 flex items-center justify-center text-cyan-300 group-hover:text-cyan-100 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
              <component :is="getIcon(item.iconName)" class="w-4 h-4 stroke-[2]" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-mono font-light text-cyan-100 group-hover:text-cyan-200 transition-colors truncate tracking-wide">
                  {{ item.name }}
                </h4>
                <Plus class="w-3.5 h-3.5 text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <!-- High-contrast Dimensions Badge & Category -->
              <div class="flex items-center gap-1.5 mt-1 text-[10px] font-mono">
                <span class="px-1.5 py-0.2 rounded bg-[#10213b] text-cyan-300 font-light border border-cyan-500/40 text-[9px]">
                  {{ item.defaultWidth }} × {{ item.defaultHeight }}
                </span>
                <span class="text-cyan-300/80 text-[9px] uppercase font-light">{{ item.category }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
