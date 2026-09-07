<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { resolveTeleSignalState } from '../../utils/scadaResolver';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const breakerState = computed(() => {
  const { data, style, customProps } = props.component;
  
  const sKey = data?.mapping?.stateKey || data?.mapping?.statusKey || data?.mapping?.valueKey;
  
  let defaultVal = 1;
  if (data?.staticData?.state !== undefined) {
    defaultVal = data.staticData.state;
  } else if (props.component.activeState !== undefined) {
    defaultVal = Number(props.component.activeState);
  } else if (customProps?.state !== undefined) {
    defaultVal = customProps.state;
  }

  const resolved = resolveTeleSignalState(props.datasets, data?.datasetId, sKey, defaultVal);

  const isClosed = resolved.isClosed || resolved.numericValue === 1;
  const status = resolved.isFault ? 'fault' : (isClosed ? 'closed' : 'open');
  
  const colorClosed = customProps?.color1 || style.breakerColorClosed || data?.staticData?.color1 || '#ff3344';
  const colorOpen = customProps?.color0 || style.breakerColorOpen || data?.staticData?.color0 || '#00e676';
  
  const statusColor = status === 'fault' 
    ? '#ffb703' 
    : (isClosed ? colorClosed : colorOpen);

  return {
    status,
    isClosed,
    statusColor,
    statusText: resolved.statusText,
    numericValue: resolved.numericValue,
    stroke: style.stroke && style.stroke !== '#00f2ff' ? style.stroke : statusColor,
    strokeWidth: style.strokeWidth || 2.5,
    isSolid: customProps?.solidFill || customProps?.displayStyle === 'scada-solid' || style?.fill || customProps?.styleType === 'scada-solid'
  };
});
</script>

<template>
  <div class="w-full h-full flex items-center justify-center select-none relative overflow-visible">
    <!-- 1. SCADA Solid State Grid Breaker (国标/南瑞高压实心断路器 + 隔离开关触头) -->
    <svg 
      v-if="breakerState.isSolid"
      class="w-full h-full overflow-visible"
      viewBox="0 0 60 80" 
      preserveAspectRatio="xMidYMid meet"
      shape-rendering="geometricPrecision"
    >
      <!-- Top Incomer Conductor -->
      <line x1="30" y1="0" x2="30" y2="18" :stroke="breakerState.stroke" :stroke-width="breakerState.strokeWidth" stroke-linecap="round" />
      <!-- Upper Contact Arc/Bracket -->
      <path d="M 18 16 C 24 22, 36 22, 42 16" fill="none" :stroke="breakerState.stroke" :stroke-width="breakerState.strokeWidth" stroke-linecap="round" />

      <!-- Center Breaker Solid Block (合闸时实心红块，分闸时黑底/绿边空心) -->
      <rect 
        x="18" 
        y="24" 
        width="24" 
        height="32" 
        :fill="breakerState.isClosed ? breakerState.statusColor : '#000000'" 
        :stroke="breakerState.statusColor" 
        :stroke-width="breakerState.strokeWidth"
        rx="1"
      />

      <!-- Lower Contact Arc/Bracket -->
      <path d="M 18 64 C 24 58, 36 58, 42 64" fill="none" :stroke="breakerState.stroke" :stroke-width="breakerState.strokeWidth" stroke-linecap="round" />
      <!-- Bottom Outgoing Conductor -->
      <line x1="30" y1="62" x2="30" y2="80" :stroke="breakerState.stroke" :stroke-width="breakerState.strokeWidth" stroke-linecap="round" />
    </svg>

    <!-- 2. IEC Standard Breaker with moving blade -->
    <svg 
      v-else
      class="w-full h-full overflow-visible"
      viewBox="0 0 60 80" 
      preserveAspectRatio="xMidYMid meet"
      shape-rendering="geometricPrecision"
    >
      <!-- Top Incomer Terminal Line -->
      <line x1="30" y1="0" x2="30" y2="20" :stroke="breakerState.stroke" :stroke-width="breakerState.strokeWidth" stroke-linecap="round" />
      <circle cx="30" cy="20" r="3" :fill="breakerState.stroke" />

      <!-- Center Breaker Square Box (IEC 60617 standard) -->
      <rect 
        x="15" 
        y="20" 
        width="30" 
        height="40" 
        :fill="breakerState.isClosed ? 'rgba(255, 51, 68, 0.25)' : 'rgba(0, 230, 118, 0.25)'" 
        :stroke="breakerState.statusColor" 
        :stroke-width="breakerState.strokeWidth"
        rx="2"
      />

      <!-- Switch Contact Blade -->
      <line 
        v-if="breakerState.isClosed"
        x1="30" 
        y1="20" 
        x2="30" 
        y2="60" 
        :stroke="breakerState.statusColor" 
        :stroke-width="breakerState.strokeWidth + 1" 
        stroke-linecap="round"
      />
      <line 
        v-else
        x1="30" 
        y1="60" 
        x2="46" 
        y2="28" 
        :stroke="breakerState.statusColor" 
        :stroke-width="breakerState.strokeWidth + 1" 
        stroke-linecap="round"
      />

      <!-- Bottom Terminal Line -->
      <circle cx="30" cy="60" r="3" :fill="breakerState.stroke" />
      <line x1="30" y1="60" x2="30" y2="80" :stroke="breakerState.stroke" :stroke-width="breakerState.strokeWidth" stroke-linecap="round" />
    </svg>
  </div>
</template>
