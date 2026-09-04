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
const lineType = computed(() => style.value.lineType || 'step-horizontal');

// Calculate SVG Path:
// Dynamically scales all inflection points and segments when component width/height changes!
const svgPath = computed(() => {
  const customPts = customProps.value.points || (style.value as any).points;
  const w = props.component.width;
  const h = props.component.height;

  if (Array.isArray(customPts) && customPts.length >= 2) {
    const hasRatios = customPts[0].xRatio !== undefined && customPts[0].yRatio !== undefined;
    
    let scaledPts: Array<{ x: number; y: number }> = [];
    if (hasRatios) {
      scaledPts = customPts.map((p: any) => ({
        x: p.xRatio * w,
        y: p.yRatio * h
      }));
    } else {
      const minX = Math.min(...customPts.map((p: any) => p.x ?? 0));
      const maxX = Math.max(...customPts.map((p: any) => p.x ?? 0));
      const minY = Math.min(...customPts.map((p: any) => p.y ?? 0));
      const maxY = Math.max(...customPts.map((p: any) => p.y ?? 0));
      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);
      
      scaledPts = customPts.map((p: any) => ({
        x: ((p.x - minX) / spanX) * w,
        y: ((p.y - minY) / spanY) * h
      }));
    }

    let d = `M ${scaledPts[0].x} ${scaledPts[0].y}`;
    for (let i = 1; i < scaledPts.length; i++) {
      d += ` L ${scaledPts[i].x} ${scaledPts[i].y}`;
    }
    return d;
  }

  // Fallback to orthogonal presets
  const pad = 2;
  if (lineType.value === 'step-horizontal') {
    const midX = Math.round(w / 2);
    return `M ${pad} ${pad} L ${midX} ${pad} L ${midX} ${h - pad} L ${w - pad} ${h - pad}`;
  } else if (lineType.value === 'step-vertical') {
    const midY = Math.round(h / 2);
    return `M ${pad} ${pad} L ${pad} ${midY} L ${w - pad} ${midY} L ${w - pad} ${h - pad}`;
  } else if (lineType.value === 'multi-step') {
    const stepX = Math.round(w * 0.3);
    const stepX2 = Math.round(w * 0.7);
    return `M ${pad} ${h - pad} L ${stepX} ${h - pad} L ${stepX} ${pad} L ${stepX2} ${pad} L ${stepX2} ${h - pad} L ${w - pad} ${h - pad}`;
  } else {
    return `M ${pad} ${pad} L ${w - pad} ${pad} L ${w - pad} ${h - pad}`;
  }
});
</script>

<template>
  <div class="w-full h-full relative overflow-visible select-none pointer-events-none">
    <svg 
      class="w-full h-full overflow-visible"
      :viewBox="`0 0 ${component.width} ${component.height}`"
      shape-rendering="geometricPrecision"
    >
      <!-- Clean Polyline Path dynamically stretched to width and height -->
      <path
        :d="svgPath"
        fill="none"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :stroke-dasharray="isDashed ? '6 4' : (isDotted ? '2 3' : 'none')"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>
