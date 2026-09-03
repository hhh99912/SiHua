<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const style = computed(() => props.component.style || {});
const type = computed(() => props.component.type);

const isCT = computed(() => type.value === 'elec-ct');
const isPT = computed(() => type.value === 'elec-pt');
const isArrester = computed(() => type.value === 'elec-arrester');

const strokeColor = computed(() => style.value.stroke || (isCT.value ? '#38bdf8' : (isPT.value ? '#a855f7' : '#f59e0b')));
const strokeWidth = computed(() => style.value.strokeWidth || 2);
</script>

<template>
  <div class="w-full h-full flex items-center justify-center select-none relative overflow-visible">
    <!-- 1. Current Transformer (CT / TA) -->
    <svg 
      v-if="isCT" 
      class="w-full h-full overflow-visible"
      viewBox="0 0 50 40" 
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Primary conductor line -->
      <line x1="2" y1="20" x2="48" y2="20" stroke="#ef4444" :stroke-width="strokeWidth + 1" stroke-linecap="round" />
      <!-- Secondary toroidal induction ring -->
      <circle cx="25" cy="20" r="11" fill="none" :stroke="strokeColor" :stroke-width="strokeWidth" />
      <!-- Secondary Leads -->
      <line x1="25" y1="31" x2="25" y2="38" :stroke="strokeColor" :stroke-width="strokeWidth" />
      <circle cx="25" cy="38" r="1.5" :fill="strokeColor" />
    </svg>

    <!-- 2. Voltage Transformer (PT / TV) -->
    <svg 
      v-else-if="isPT" 
      class="w-full h-full overflow-visible"
      viewBox="0 0 50 50" 
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Primary Top Terminal -->
      <line x1="25" y1="0" x2="25" y2="12" :stroke="strokeColor" :stroke-width="strokeWidth" />
      <circle cx="25" cy="20" r="9" fill="none" :stroke="strokeColor" :stroke-width="strokeWidth" />
      <!-- Secondary Winding -->
      <circle cx="25" cy="30" r="9" fill="none" :stroke="strokeColor" :stroke-width="strokeWidth" />
      <!-- Ground Lead -->
      <line x1="25" y1="39" x2="25" y2="45" stroke="#94a3b8" :stroke-width="strokeWidth" />
      <line x1="18" y1="45" x2="32" y2="45" stroke="#94a3b8" :stroke-width="strokeWidth" stroke-linecap="round" />
      <line x1="21" y1="49" x2="29" y2="49" stroke="#94a3b8" :stroke-width="strokeWidth - 0.5" stroke-linecap="round" />
    </svg>

    <!-- 3. Surge Arrester (避雷器) -->
    <svg 
      v-else 
      class="w-full h-full overflow-visible"
      viewBox="0 0 50 50" 
      preserveAspectRatio="xMidYMid meet"
    >
      <line x1="25" y1="0" x2="25" y2="10" :stroke="strokeColor" :stroke-width="strokeWidth" />
      <!-- Non-linear resistor symbol with arrow -->
      <rect x="16" y="10" width="18" height="24" rx="1" fill="none" :stroke="strokeColor" :stroke-width="strokeWidth" />
      <line x1="12" y1="36" x2="38" y2="8" :stroke="strokeColor" :stroke-width="strokeWidth" />
      <polygon points="38,8 32,8 38,14" :fill="strokeColor" />
      <!-- Ground Terminal -->
      <line x1="25" y1="34" x2="25" y2="42" stroke="#94a3b8" :stroke-width="strokeWidth" />
      <line x1="18" y1="42" x2="32" y2="42" stroke="#94a3b8" :stroke-width="strokeWidth" stroke-linecap="round" />
      <line x1="21" y1="46" x2="29" y2="46" stroke="#94a3b8" :stroke-width="strokeWidth - 0.5" stroke-linecap="round" />
    </svg>
  </div>
</template>
