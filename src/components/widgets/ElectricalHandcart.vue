<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { resolveTeleSignalState } from '../../utils/scadaResolver';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const handcartState = computed(() => {
  const { data, style, customProps } = props.component;
  const sKey = data?.mapping?.stateKey || data?.mapping?.statusKey || data?.mapping?.valueKey;
  const defaultVal = customProps?.position !== undefined ? customProps.position : 1;

  const resolved = resolveTeleSignalState(props.datasets, data?.datasetId, sKey, defaultVal);

  const isWorking = resolved.isWorking || resolved.numericValue === 1 || resolved.numericValue === 4;
  const isTest = resolved.isTest || resolved.numericValue === 0 || resolved.numericValue === 3;
  const posColor = isWorking ? '#ff3344' : (isTest ? '#00f2ff' : '#00e676');

  return {
    isWorking,
    isTest,
    posColor,
    statusText: resolved.statusText,
    numericValue: resolved.numericValue,
    stroke: style.stroke || posColor,
    strokeWidth: style.strokeWidth || 2
  };
});
</script>

<template>
  <div class="w-full h-full flex items-center justify-center select-none relative overflow-visible">
    <!-- Handcart IEC Switchgear Symbol -->
    <svg 
      class="w-full h-full overflow-visible"
      viewBox="0 0 70 80" 
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Fixed Outer Cabinet Guide Frame (Dashed, High Brightness) -->
      <rect x="8" y="8" width="54" height="64" rx="2" fill="none" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="3 3" stroke-opacity="0.8" />
      
      <!-- Top Fixed Contact Pin -->
      <circle cx="35" cy="8" r="3" :fill="handcartState.stroke" />
      <line x1="35" y1="0" x2="35" y2="8" :stroke="handcartState.stroke" :stroke-width="handcartState.strokeWidth" />

      <!-- Movable Trolley Core -->
      <rect 
        x="18" 
        y="18" 
        width="34" 
        height="44" 
        rx="2" 
        fill="rgba(6, 14, 28, 0.8)" 
        :stroke="handcartState.posColor" 
        :stroke-width="handcartState.strokeWidth" 
      />

      <!-- Breaker Element inside Trolley -->
      <line 
        v-if="handcartState.isWorking"
        x1="35" y1="24" x2="35" y2="56" 
        :stroke="handcartState.posColor" 
        :stroke-width="handcartState.strokeWidth + 1" 
        stroke-linecap="round"
      />
      <line 
        v-else
        x1="35" y1="56" x2="47" y2="28" 
        :stroke="handcartState.posColor" 
        :stroke-width="handcartState.strokeWidth + 1" 
        stroke-linecap="round"
      />

      <!-- Bottom Fixed Contact Pin -->
      <circle cx="35" cy="72" r="3" :fill="handcartState.stroke" />
      <line x1="35" y1="72" x2="35" y2="80" :stroke="handcartState.stroke" :stroke-width="handcartState.strokeWidth" />

      <!-- Trolley Small Wheels (Double Circle) -->
      <circle cx="26" cy="62" r="2.5" :fill="handcartState.posColor" />
      <circle cx="44" cy="62" r="2.5" :fill="handcartState.posColor" />
    </svg>
  </div>
</template>
