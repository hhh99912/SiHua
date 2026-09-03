<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import WidgetRenderer from './WidgetRenderer.vue';

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

const children = computed<ScreenComponent[]>(() => {
  const { states, activeState, data } = props.component;
  
  // If data binding provides a stateKey from telemetry
  let resolvedVal: any = activeState !== undefined ? activeState : undefined;
  if (props.datasets && data?.datasetId) {
    const boundDs = props.datasets.find(d => d.id === data.datasetId);
    if (boundDs?.data && data.mapping?.stateKey && boundDs.data[data.mapping.stateKey] !== undefined) {
      resolvedVal = boundDs.data[data.mapping.stateKey];
    }
  }

  if (states && states.length > 0) {
    let matchedState = states[0];
    if (resolvedVal !== undefined) {
      const match = states.find(s => 
        String(s.matchValue ?? s.id) === String(resolvedVal) ||
        String(s.id) === String(resolvedVal)
      );
      if (match) {
        matchedState = match;
      }
    }
    if (matchedState && matchedState.children) {
      return matchedState.children;
    }
  }

  return props.component.children || props.component.customProps?.children || [];
});

// Streamer Effect config
const isStreamerActive = computed(() => {
  return props.component.style?.streamer?.active;
});

const streamerConfig = computed(() => {
  return props.component.style?.streamer || {
    active: false,
    color: '#00f2ff',
    speed: 2,
    direction: 'forward',
    type: 'laser'
  };
});

// Calculate bounding box of children if defined to scale appropriately
const baseBounds = computed(() => {
  if (children.value.length === 0) return { width: props.component.width, height: props.component.height };
  const maxX = children.value.reduce((max, c) => Math.max(max, c.x + c.width), 0);
  const maxY = children.value.reduce((max, c) => Math.max(max, c.y + c.height), 0);
  return {
    width: Math.max(10, maxX),
    height: Math.max(10, maxY)
  };
});

const scaleX = computed(() => props.component.width / (baseBounds.value.width || 1));
const scaleY = computed(() => props.component.height / (baseBounds.value.height || 1));
</script>

<template>
  <div class="w-full h-full relative overflow-visible select-none">
    <!-- Composite Container Canvas -->
    <div 
      class="w-full h-full relative"
      :style="{
        backgroundColor: component.style?.fill || 'transparent',
        borderRadius: (component.style?.borderRadius || 0) + 'px'
      }"
    >
      <div
        v-for="child in children"
        :key="child.id"
        class="absolute"
        :style="{
          left: `${child.x * scaleX}px`,
          top: `${child.y * scaleY}px`,
          width: `${child.width * scaleX}px`,
          height: `${child.height * scaleY}px`,
          transform: child.rotation ? `rotate(${child.rotation}deg)` : 'none',
          zIndex: child.zIndex || 1
        }"
      >
        <WidgetRenderer
          :component="{
            ...child,
            // Forward dataset or telemetry override if configured
            data: child.data?.datasetId ? child.data : (component.data?.datasetId ? component.data : child.data)
          }"
          :datasets="datasets"
          :preview-mode="previewMode"
          @jump:screen="emit('jump:screen', $event)"
        />
      </div>

      <!-- Fallback when no children are inside -->
      <div 
        v-if="children.length === 0" 
        class="w-full h-full border border-dashed border-cyan-500/40 rounded flex flex-col items-center justify-center p-2 text-center text-xs font-mono text-cyan-400 bg-cyan-950/20"
      >
        <span>{{ component.name }}</span>
        <span class="text-[10px] text-slate-500 mt-0.5">复合图元 (暂无子图元)</span>
      </div>

      <!-- Animated Streamer Effect Border/Halo -->
      <svg 
        v-if="isStreamerActive" 
        class="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
      >
        <rect
          x="1"
          y="1"
          :width="Math.max(2, component.width - 2)"
          :height="Math.max(2, component.height - 2)"
          :rx="component.style?.borderRadius || 0"
          :ry="component.style?.borderRadius || 0"
          fill="none"
          :stroke="streamerConfig.color || '#00f2ff'"
          :stroke-width="streamerConfig.width || 2"
          :stroke-dasharray="streamerConfig.type === 'dots' ? '4,8' : '20,40'"
          class="animate-streamer-flow"
          :style="{
            animationDuration: `${Math.max(0.5, streamerConfig.speed || 2)}s`,
            animationDirection: streamerConfig.direction === 'reverse' ? 'reverse' : 'normal',
            filter: `drop-shadow(0 0 6px ${streamerConfig.color || '#00f2ff'})`
          }"
        />
      </svg>
    </div>
  </div>
</template>

<style scoped>
@keyframes streamerFlow {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: -120;
  }
}

.animate-streamer-flow {
  animation: streamerFlow linear infinite;
}
</style>
