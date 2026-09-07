<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { ChevronRight, Layers } from 'lucide-vue-next';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
  previewMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  previewMode: false
});
const emit = defineEmits<{
  (e: 'jump:screen', screenId: string): void;
}>();

const navItems = computed(() => {
  const customItems = props.component.customProps?.screens || [
    { id: 'screen-10kv-main', name: '10kV一次系统接线图', icon: 'Zap' },
    { id: 'screen-transformer-detail', name: '#1主变压器及测控画面', icon: 'Activity' },
    { id: 'screen-low-voltage-04kv', name: '0.4kV低压配电画面', icon: 'Cpu' },
    { id: 'screen-telemetry-scada', name: '全站电力遥测与告警', icon: 'LayoutDashboard' }
  ];
  return customItems;
});

const currentActiveId = computed(() => {
  return props.component.customProps?.activeScreenId || navItems.value[0]?.id || '';
});

const handleNavClick = (screenId: string) => {
  if (props.previewMode) {
    emit('jump:screen', screenId);
  }
};
</script>

<template>
  <div 
    class="w-full h-full p-1 rounded-xl border border-cyan-400/60 bg-[#060e22] flex items-center justify-between gap-2 select-none shadow-[0_4px_20px_rgba(0,0,0,0.8)] backdrop-blur-md relative overflow-hidden"
    :style="{
      borderColor: component.style?.stroke || '#00f2ff',
      backgroundColor: component.style?.fill || '#060e22',
      borderRadius: component.style?.borderRadius !== undefined ? `${component.style.borderRadius}px` : '10px'
    }"
  >
    <!-- Navigation Tabs List (Fit 100% width and height, crystal clear text & bright icons) -->
    <div class="w-full h-full flex items-stretch gap-1.5 overflow-x-auto custom-scrollbar">
      <button
        v-for="(item, idx) in navItems"
        :key="item.id || idx"
        @click="handleNavClick(item.id)"
        class="flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-1 rounded-lg border transition-all duration-150 cursor-pointer whitespace-nowrap"
        :class="[
          item.id === currentActiveId
            ? 'bg-cyan-950/90 border-cyan-300 text-white shadow-[0_0_12px_rgba(0,242,255,0.4)] ring-1 ring-cyan-300'
            : 'bg-slate-900 border-slate-700 hover:border-cyan-400 text-slate-100 hover:text-white'
        ]"
      >
        <!-- Tab Index Pill -->
        <span 
          class="w-5 h-5 rounded flex items-center justify-center text-xs font-mono font-black shrink-0"
          :class="item.id === currentActiveId ? 'bg-cyan-400 text-slate-950 shadow-[0_0_8px_#00f2ff]' : 'bg-slate-800 text-cyan-300'"
        >
          {{ idx + 1 }}
        </span>

        <!-- Screen Name -->
        <span class="font-bold tracking-wide text-xs sm:text-sm truncate">
          {{ item.name }}
        </span>

        <!-- Active Luminous Pip -->
        <span 
          v-if="item.id === currentActiveId"
          class="w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#00f2ff] shrink-0"
        />
      </button>
    </div>
  </div>
</template>
