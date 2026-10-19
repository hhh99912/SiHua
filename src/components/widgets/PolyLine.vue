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

const isAllOrthogonal = computed(() => {
  const pts = props.component.customProps?.points || (props.component.style as any)?.points;
  if (!Array.isArray(pts) || pts.length < 2) return true;
  for (let i = 1; i < pts.length; i++) {
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const y1 = p1.yRatio !== undefined ? p1.yRatio : (p1.y ?? 0);
    const y2 = p2.yRatio !== undefined ? p2.yRatio : (p2.y ?? 0);
    const x1 = p1.xRatio !== undefined ? p1.xRatio : (p1.x ?? 0);
    const x2 = p2.xRatio !== undefined ? p2.xRatio : (p2.x ?? 0);
    const isHoriz = Math.abs(y1 - y2) < 0.002;
    const isVert = Math.abs(x1 - x2) < 0.002;
    if (!isHoriz && !isVert) return false;
  }
  return true;
});
</script>

<template>
  <div class="w-full h-full relative overflow-visible select-none pointer-events-none">
    <svg 
      class="w-full h-full overflow-visible pointer-events-none"
      :viewBox="`0 0 ${Math.max(1, component.width)} ${Math.max(1, component.height)}`"
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
