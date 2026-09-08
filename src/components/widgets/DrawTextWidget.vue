<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const textContent = computed(() => {
  const { style, data, name } = props.component;
  if (style?.text !== undefined && style.text !== '') return style.text;
  if (data?.staticData?.text !== undefined) return String(data.staticData.text);
  return name || '';
});

const textStyle = computed(() => {
  const { style } = props.component;
  const color = style?.textColor || style?.stroke || '#00f2ff';
  const fontSize = typeof style?.fontSize === 'number' ? `${style.fontSize}px` : (style?.fontSize || '14px');
  const fontWeight = style?.fontWeight || 'bold';
  const textAlign = style?.textAlign || 'center';
  const fontFamily = style?.fontFamily || `'JetBrains Mono', Consolas, monospace, sans-serif`;
  const letterSpacing = style?.letterSpacing ? `${style.letterSpacing}px` : '0.5px';
  const bg = style?.fill && style.fill !== 'transparent' ? style.fill : 'transparent';

  return {
    color,
    fontSize,
    fontWeight,
    textAlign,
    fontFamily,
    letterSpacing,
    backgroundColor: bg
  };
});
</script>

<template>
  <div 
    class="w-full h-full flex items-center p-0 m-0 select-none overflow-hidden leading-none relative box-border"
    :class="{
      'justify-start text-left': textStyle.textAlign === 'left',
      'justify-center text-center': textStyle.textAlign === 'center',
      'justify-end text-right': textStyle.textAlign === 'right'
    }"
    :style="{
      backgroundColor: textStyle.backgroundColor,
      contain: 'strict'
    }"
  >
    <span
      class="leading-tight p-0 m-0 block whitespace-nowrap overflow-hidden select-none w-full"
      :style="{
        color: textStyle.color,
        fontSize: textStyle.fontSize,
        fontWeight: textStyle.fontWeight,
        textAlign: textStyle.textAlign as any,
        fontFamily: textStyle.fontFamily,
        letterSpacing: textStyle.letterSpacing
      }"
    >
      {{ textContent }}
    </span>
  </div>
</template>
