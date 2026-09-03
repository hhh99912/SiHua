<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const busbarState = computed(() => {
  const { style } = props.component;
  const voltageLevel = style.voltageLevel || '10kV';
  
  let busColor = '#ef4444'; // 10kV default
  if (voltageLevel === '35kV') busColor = '#eab308';
  else if (voltageLevel === '110kV') busColor = '#f97316';
  else if (voltageLevel === '220kV') busColor = '#a855f7';
  else if (voltageLevel === '500kV') busColor = '#f43f5e';
  else if (voltageLevel === '0.4kV') busColor = '#06b6d4';

  if (style.stroke) busColor = style.stroke;

  return {
    busColor,
    height: style.strokeWidth || 6
  };
});
</script>

<template>
  <div class="w-full h-full flex items-center justify-center select-none relative overflow-visible pointer-events-none">
    <!-- Solid Clean SCADA Busbar Line -->
    <div 
      class="w-full rounded-xs transition-colors"
      :style="{
        backgroundColor: busbarState.busColor,
        height: `${Math.max(4, Math.min(component.height, busbarState.height))}px`
      }"
    />
  </div>
</template>
