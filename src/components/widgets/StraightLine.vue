<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const style = computed(() => props.component.style || {});
const customProps = computed(() => props.component.customProps || {});

// Respect the user's custom chosen stroke color directly
const strokeColor = computed(() => {
  return style.value.stroke || '#00f2ff';
});

const strokeWidth = computed(() => style.value.strokeWidth || 3);
const isDashed = computed(() => style.value.lineStyle === 'dashed');
const isDotted = computed(() => style.value.lineStyle === 'dotted');

// Dynamic Coordinates Calculation:
// Uses normalized ratio multipliers so the line stretches/shrinks seamlessly when resizing the component!
const points = computed(() => {
  const customPts = customProps.value.points || (style.value as any).points;
  const w = props.component.width;
  const h = props.component.height;

  if (Array.isArray(customPts) && customPts.length >= 2) {
    const pt0 = customPts[0];
    const pt1 = customPts[1];
    
    // If xRatio and yRatio are present, multiply by current width and height
    if (pt0.xRatio !== undefined && pt0.yRatio !== undefined) {
      return {
        x1: pt0.xRatio * w,
        y1: pt0.yRatio * h,
        x2: pt1.xRatio * w,
        y2: pt1.yRatio * h
      };
    }
    
    // Fallback for legacy pixel points: scale relative to extent of points
    const minX = Math.min(pt0.x ?? 0, pt1.x ?? 0);
    const maxX = Math.max(pt0.x ?? 0, pt1.x ?? 0);
    const minY = Math.min(pt0.y ?? 0, pt1.y ?? 0);
    const maxY = Math.max(pt0.y ?? 0, pt1.y ?? 0);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    
    const r0x = (pt0.x - minX) / spanX;
    const r0y = (pt0.y - minY) / spanY;
    const r1x = (pt1.x - minX) / spanX;
    const r1y = (pt1.y - minY) / spanY;
    
    return {
      x1: r0x * w,
      y1: r0y * h,
      x2: r1x * w,
      y2: r1y * h
    };
  }

  // Preset lines (dropped from palette)
  if (w >= h * 2.5) {
    return { x1: 2, y1: h / 2, x2: w - 2, y2: h / 2 };
  } else if (h >= w * 2.5) {
    return { x1: w / 2, y1: 2, x2: w / 2, y2: h - 2 };
  } else {
    return { x1: 2, y1: 2, x2: w - 2, y2: h - 2 };
  }
});

const startArrow = computed(() => style.value.startArrow || false);
const endArrow = computed(() => style.value.endArrow || props.component.type === 'draw-arrow');
</script>

<template>
  <div class="w-full h-full relative overflow-visible select-none pointer-events-none">
    <svg 
      class="w-full h-full overflow-visible"
      :viewBox="`0 0 ${component.width} ${component.height}`"
      shape-rendering="geometricPrecision"
    >
      <defs v-if="startArrow || endArrow">
        <marker
          v-if="endArrow"
          :id="`arrow-end-${component.id}`"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" :fill="strokeColor" />
        </marker>
        <marker
          v-if="startArrow"
          :id="`arrow-start-${component.id}`"
          viewBox="0 0 10 10"
          refX="4"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 10 1 L 0 5 L 10 9 z" :fill="strokeColor" />
        </marker>
      </defs>

      <!-- Clean SCADA Line dynamically stretched to component width & height -->
      <line
        :x1="points.x1"
        :y1="points.y1"
        :x2="points.x2"
        :y2="points.y2"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :stroke-dasharray="isDashed ? '6 4' : (isDotted ? '2 3' : 'none')"
        stroke-linecap="round"
        :marker-start="startArrow ? `url(#arrow-start-${component.id})` : undefined"
        :marker-end="endArrow ? `url(#arrow-end-${component.id})` : undefined"
      />
    </svg>
  </div>
</template>
