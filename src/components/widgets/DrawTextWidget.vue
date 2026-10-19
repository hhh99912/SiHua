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
  const { style, height, width } = props.component;
  const color = style?.textColor || style?.stroke || '#00f2ff';
  
  // Dynamic font size: if style.fontSize is defined use it, otherwise calculate from width and height to fit box snugly
  let fontSizeNum = typeof style?.fontSize === 'number' && style.fontSize > 0 ? style.fontSize : 0;
  if (!fontSizeNum) {
    const text = textContent.value || '文本';
    let visualLen = 0;
    for (let i = 0; i < text.length; i++) {
      visualLen += text.charCodeAt(i) > 255 ? 1.0 : 0.55;
    }
    visualLen = Math.max(1, visualLen);
    const h = height || 26;
    const w = width || 80;
    fontSizeNum = Math.max(10, Math.min(Math.floor(h * 0.88), Math.floor((w - 2) / visualLen)));
  }
  const fontSize = `${fontSizeNum}px`;
  const fontWeight = style?.fontWeight || 'bold';
  const textAlign = style?.textAlign || 'center';
  const fontFamily = style?.fontFamily || `'Noto Sans SC', 'Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei', 'Microsoft YaHei', 'PingFang SC', 'SimHei', 'JetBrains Mono', system-ui, sans-serif`;
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
