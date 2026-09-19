<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { getPolylineSvgPath } from '../../utils/linePathUtils';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const style = computed(() => props.component.style || {});

// Respect the user's custom chosen stroke color directly
const strokeColor = computed(() => {
  return style.value.stroke || '#00f2ff';
});

const strokeWidth = computed(() => style.value.strokeWidth || 3);
const isDashed = computed(() => style.value.lineStyle === 'dashed');
const isDotted = computed(() => style.value.lineStyle === 'dotted');

// Calculate SVG Path dynamically scaled to component dimensions
const svgPath = computed(() => {
  return getPolylineSvgPath(props.component);
});
</script>

<template>
  <div class="w-full h-full relative overflow-visible select-none pointer-events-none">
    <svg 
      class="w-full h-full overflow-visible pointer-events-none"
      :viewBox="`0 0 ${component.width} ${component.height}`"
      preserveAspectRatio="none"
      shape-rendering="geometricPrecision"
    >
      <!-- Precise hit corridor on the actual polyline stroke only: must click the line entity to trigger selection -->
      <path
        :d="svgPath"
        fill="none"
        stroke="transparent"
        :stroke-width="Math.max(10, strokeWidth + 6)"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="pointer-events-auto cursor-move"
      />

      <!-- Clean Polyline Path dynamically stretched to width and height -->
      <path
        :d="svgPath"
        fill="none"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :stroke-dasharray="isDashed ? '6 4' : (isDotted ? '2 3' : 'none')"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
        class="pointer-events-none"
      />
    </svg>
  </div>
</template>
