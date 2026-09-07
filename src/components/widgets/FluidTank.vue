<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { resolveComponentDynamicData, parseStrictNumber } from '../../utils/scadaResolver';
import { withAlpha } from '../../utils/color';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const tankState = computed(() => {
  const { style, customProps } = props.component;
  const dynamic = resolveComponentDynamicData(props.component, props.datasets);

  const rawLevel = dynamic.level ?? dynamic.value ?? customProps?.level ?? 68;
  const level = parseStrictNumber(rawLevel, 68);

  const capacity = parseStrictNumber(dynamic.capacity ?? customProps?.capacity ?? 10000, 10000);
  const currentVolume = Math.round((Math.max(0, Math.min(100, level)) / 100) * capacity);
  const themeColor = style.fill || style.stroke || '#00f2ff';

  const isWarning = level > 85 || level < 15;
  const liquidColor = isWarning ? '#ef4444' : themeColor;

  return {
    level: Math.max(0, Math.min(100, Math.round(level))),
    capacity,
    currentVolume,
    themeColor,
    isWarning,
    liquidColor
  };
});
</script>

<template>
  <!-- Pure Fluid Tank - Tightly fills 100% of bounding box -->
  <div 
    class="w-full h-full relative select-none rounded-lg border-2 bg-slate-950 overflow-hidden flex flex-col justify-end shadow-inner"
    :style="{ 
      borderColor: tankState.liquidColor,
      backgroundColor: component.style?.fill || '#060b14'
    }"
  >
    <!-- Graduated Ruler Ticks on side -->
    <div class="absolute top-1 left-1 bottom-1 w-3.5 flex flex-col justify-between pointer-events-none z-20">
      <div v-for="tick in [100, 75, 50, 25, 0]" :key="tick" class="flex items-center gap-0.5">
        <div class="w-2.5 h-[1px] bg-slate-400/70" />
        <span class="text-[8px] font-mono text-slate-400 leading-none">{{ tick }}</span>
      </div>
    </div>

    <!-- Fluid Liquid Level Column -->
    <div 
      class="w-full relative transition-all duration-700 ease-out"
      :style="{
        height: `${tankState.level}%`,
        backgroundColor: withAlpha(tankState.liquidColor, 0.25),
        borderTop: `2px solid ${tankState.liquidColor}`,
        boxShadow: `0 0 16px ${withAlpha(tankState.liquidColor, 0.4)}`
      }"
    >
      <!-- Liquid Gradient -->
      <div 
        class="absolute inset-0 opacity-50"
        :style="{
          backgroundImage: `linear-gradient(to bottom, ${tankState.liquidColor}, transparent)`
        }"
      />
    </div>

    <!-- Center Digital Overlay -->
    <div class="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none drop-shadow-md">
      <div 
        class="text-xl font-mono font-black tracking-tight"
        :style="{ color: tankState.liquidColor, textShadow: `0 0 8px ${tankState.liquidColor}` }"
      >
        {{ tankState.level }}%
      </div>
    </div>
  </div>
</template>
