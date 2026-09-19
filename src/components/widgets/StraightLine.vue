<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { getStraightLinePoints } from '../../utils/linePathUtils';

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

// Dynamic Coordinates Calculation
const points = computed(() => {
  return getStraightLinePoints(props.component);
});

const startArrow = computed(() => style.value.startArrow || false);
const endArrow = computed(() => style.value.endArrow || props.component.type === 'draw-arrow');
</script>

<template>
  <div class="w-full h-full relative overflow-visible select-none pointer-events-none">
    <svg 
      class="w-full h-full overflow-visible pointer-events-none"
      :viewBox="`0 0 ${component.width} ${component.height}`"
      preserveAspectRatio="none"
      shape-rendering="geometricPrecision"
    >
      <defs v-if="startArrow || endArrow">
        <marker
          v-if="endArrow"
          :id="`arrow-end-${component.id}`"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 9 5 L 0 8.5 L 2.5 5 Z" :fill="strokeColor" />
        </marker>
        <marker
          v-if="startArrow"
          :id="`arrow-start-${component.id}`"
          viewBox="0 0 10 10"
          refX="2"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 10 1.5 L 1 5 L 10 8.5 L 7.5 5 Z" :fill="strokeColor" />
        </marker>
      </defs>

      <!-- Precise invisible hit line for actual line entity only -->
      <line
        :x1="points.x1"
        :y1="points.y1"
        :x2="points.x2"
        :y2="points.y2"
        stroke="transparent"
        :stroke-width="Math.max(10, strokeWidth + 6)"
        stroke-linecap="round"
        class="pointer-events-auto cursor-move"
      />

      <!-- Clean SCADA Line dynamically stretched to component width & height -->
      <line
        :x1="points.x1"
        :y1="points.y1"
        :x2="points.x2"
        :y2="points.y2"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :stroke-dasharray="isDashed ? '6 4' : (isDotted ? '2 3' : 'none')"
        :stroke-linecap="endArrow || startArrow ? 'square' : 'round'"
        vector-effect="non-scaling-stroke"
        :marker-start="startArrow ? `url(#arrow-start-${component.id})` : undefined"
        :marker-end="endArrow ? `url(#arrow-end-${component.id})` : undefined"
        class="pointer-events-none"
      />
    </svg>
  </div>
</template>
