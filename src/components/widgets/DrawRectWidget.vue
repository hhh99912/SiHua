<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const rectStyle = computed(() => {
  const { style } = props.component;
  const stroke = style?.stroke || '#00f2ff';
  const strokeWidth = style?.strokeWidth !== undefined ? style.strokeWidth : 2;
  const fill = style?.fill || 'transparent';
  const fillOpacity = style?.fillOpacity !== undefined ? style.fillOpacity : 0.2;
  const lineStyle = style?.lineStyle || 'solid';
  const borderRadius = style?.borderRadius ?? 0;

  const bg = fill && fill !== 'transparent' ? fill : 'transparent';

  return {
    backgroundColor: bg,
    opacity: fill && fill !== 'transparent' ? fillOpacity : 1,
    borderColor: stroke && stroke !== 'transparent' ? stroke : 'transparent',
    borderWidth: `${strokeWidth}px`,
    borderStyle: strokeWidth > 0 && stroke && stroke !== 'transparent' ? lineStyle : 'none',
    borderRadius: `${borderRadius}px`
  };
});
</script>

<template>
  <div 
    class="w-full h-full box-border select-none pointer-events-none"
    :style="{
      backgroundColor: rectStyle.backgroundColor,
      borderColor: rectStyle.borderColor,
      borderWidth: rectStyle.borderWidth,
      borderStyle: rectStyle.borderStyle,
      borderRadius: rectStyle.borderRadius,
      boxSizing: 'border-box',
      contain: 'strict'
    }"
  />
</template>
