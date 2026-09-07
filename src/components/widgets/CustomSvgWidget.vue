<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { withAlpha } from '../../utils/color';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const svgContent = computed(() => {
  const { style, customProps } = props.component || ({} as any);
  const rawCode = (style?.customSvgCode || customProps?.svgCode || '') as string;

  // Default sample high-tech vector badge if empty
  if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
    return `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
      <polygon points="50,5 90,25 90,75 50,95 10,75 10,25" stroke="${style?.stroke || '#00f2ff'}" stroke-width="${style?.strokeWidth || 2}" fill="${style?.fill || 'rgba(0, 242, 255, 0.15)'}" />
      <circle cx="50" cy="50" r="24" stroke="${style?.stroke || '#00f2ff'}" stroke-width="1.5" stroke-dasharray="4 2" />
      <polygon points="50,30 68,62 32,62" fill="${style?.stroke || '#00f2ff'}" opacity="0.8" />
    </svg>`;
  }

  const trimmed = rawCode.trim();
  // If user entered only <path ...> or <polygon ...>, wrap in <svg>
  if (!trimmed.startsWith('<svg')) {
    return `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">${trimmed}</svg>`;
  }

  return trimmed;
});
</script>

<template>
  <div 
    class="w-full h-full flex items-center justify-center relative overflow-hidden select-none"
    :style="{
      opacity: component.style.opacity ?? 1,
      filter: component.style.glowColor ? `drop-shadow(0 0 ${component.style.glowBlur || 8}px ${component.style.glowColor})` : 'none'
    }"
  >
    <div 
      class="w-full h-full flex items-center justify-center"
      v-html="svgContent"
    />
  </div>
</template>

<style scoped>
:deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
