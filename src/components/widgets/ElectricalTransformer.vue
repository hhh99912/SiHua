<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const style = computed(() => props.component.style || {});
const strokeColor = computed(() => style.value.stroke || '#00f2ff');
const strokeWidth = computed(() => style.value.strokeWidth || 2.5);
</script>

<template>
  <div class="w-full h-full flex items-center justify-center select-none relative overflow-visible">
    <!-- Standard Transformer Dual Intersecting Circles (双绕组主变 IEC 60617) -->
    <svg 
      class="w-full h-full overflow-visible"
      viewBox="0 0 60 90" 
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- High Voltage Top Bushing Lead -->
      <line x1="30" y1="0" x2="30" y2="20" :stroke="strokeColor" :stroke-width="strokeWidth" stroke-linecap="round" />

      <!-- Primary Winding Circle -->
      <circle cx="30" cy="35" r="16" fill="none" :stroke="strokeColor" :stroke-width="strokeWidth" />
      <!-- Star Y Symbol -->
      <path d="M30,26 L30,35 M30,35 L22,41 M30,35 L38,41" :stroke="strokeColor" stroke-width="1.8" stroke-linecap="round" />

      <!-- Secondary Winding Circle -->
      <circle cx="30" cy="55" r="16" fill="none" :stroke="strokeColor" :stroke-width="strokeWidth" />
      <!-- Delta Triangle Symbol -->
      <polygon points="30,47 22,61 38,61" fill="none" :stroke="strokeColor" stroke-width="1.8" stroke-linejoin="round" />

      <!-- Low Voltage Bottom Bushing Lead -->
      <line x1="30" y1="71" x2="30" y2="90" :stroke="strokeColor" :stroke-width="strokeWidth" stroke-linecap="round" />
    </svg>
  </div>
</template>
