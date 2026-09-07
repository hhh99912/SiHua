<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { withAlpha } from '../../utils/color';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const pipeState = computed(() => {
  const { data, style, customProps, animation } = props.component;
  const boundDataset = props.datasets?.find(d => d.id === data.datasetId);
  const activeData = boundDataset?.data || data.staticData || {};

  const status = (data.mapping.statusKey && activeData[data.mapping.statusKey]) ?? customProps?.status ?? 'FLOWING';
  const color = style.stroke || style.fill || '#00f2ff';
  const isHorizontal = props.component.width >= props.component.height;
  const isFlowing = status === 'FLOWING' || status === 'NORMAL' || status === true;

  return {
    color,
    isHorizontal,
    isFlowing,
    speed: animation?.speed || 2
  };
});
</script>

<template>
  <div class="w-full h-full relative select-none flex items-center justify-center overflow-hidden">
    <!-- Horizontal Pipe (Stretches 100% to box width & height) -->
    <div 
      v-if="pipeState.isHorizontal"
      class="w-full h-full bg-slate-900 rounded-full border-2 border-slate-700 relative overflow-hidden flex items-center shadow-lg"
      :style="{ borderColor: withAlpha(pipeState.color, 0.6) }"
    >
      <!-- Flow animation stream -->
      <div 
        v-if="pipeState.isFlowing"
        class="absolute inset-0 flex items-center"
        style="animation: flowRight 2s linear infinite;"
      >
        <div 
          v-for="i in 16" 
          :key="i"
          class="h-full w-8 shrink-0 flex items-center justify-center opacity-80"
        >
          <div 
            class="w-3 h-2 rounded-full"
            :style="{ backgroundColor: pipeState.color, boxShadow: `0 0 6px ${pipeState.color}` }"
          />
        </div>
      </div>
    </div>

    <!-- Vertical Pipe (Stretches 100% to box width & height) -->
    <div 
      v-else
      class="w-full h-full bg-slate-900 rounded-full border-2 border-slate-700 relative overflow-hidden flex justify-center shadow-lg"
      :style="{ borderColor: withAlpha(pipeState.color, 0.6) }"
    >
      <div 
        v-if="pipeState.isFlowing"
        class="absolute inset-0 flex flex-col justify-around items-center"
      >
        <div 
          v-for="i in 10" 
          :key="i"
          class="w-2 h-3 rounded-full opacity-80 animate-bounce"
          :style="{ backgroundColor: pipeState.color, boxShadow: `0 0 6px ${pipeState.color}` }"
        />
      </div>
    </div>
  </div>
</template>
