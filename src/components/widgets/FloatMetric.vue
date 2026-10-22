<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { getComponentLiveNumericValue, formatTruncatedNumber, getComponentPointQuality } from '../../utils/scadaResolver';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
  previewMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  previewMode: false
});

// 1. Static/Style properties (computed only when component style or customProps changes)
const staticStyle = computed(() => {
  const { style, customProps } = props.component;

  // Decimals precision & Trailing Zeros
  const decimals = typeof style?.decimals === 'number' 
    ? style.decimals 
    : (typeof customProps?.decimals === 'number' ? customProps.decimals : 2);
  const clampedDecimals = Math.max(0, Math.min(6, decimals));

  // Strip trailing zeros: true by default or explicitly configured
  const trimZeros = style?.trimZeros !== undefined 
    ? Boolean(style.trimZeros) 
    : (customProps?.trimZeros !== undefined ? Boolean(customProps.trimZeros) : true);

  // Text color (strictly font color)
  const textColor = style?.textColor || style?.color || customProps?.textColor || customProps?.color || '#00f2ff';

  // Background color (strictly separate from textColor!)
  const rawFill = style?.bgColor !== undefined 
    ? style.bgColor 
    : (customProps?.bgColor !== undefined 
      ? customProps.bgColor 
      : (style?.fill && style?.fill !== 'transparent' && style?.fill !== textColor ? style.fill : 'transparent'));
  const bgColor = rawFill && rawFill !== 'transparent' ? rawFill : 'transparent';

  // Border
  const strokeColor = style?.stroke && style.stroke !== 'transparent' 
    ? style.stroke 
    : (customProps?.borderColor && customProps.borderColor !== 'transparent' ? customProps.borderColor : '');
  
  const strokeWidth = typeof style?.strokeWidth === 'number' 
    ? style.strokeWidth 
    : (typeof customProps?.borderWidth === 'number' ? customProps.borderWidth : (strokeColor ? 1 : 0));
  
  const hasBorder = Boolean(strokeColor && strokeColor !== 'transparent' && strokeWidth > 0);

  // Fixed font size and styling
  const fontSize = style?.fontSize ? `${style.fontSize}px` : '22px';
  const fontWeight = style?.fontWeight || 'bold';
  const textAlign = style?.textAlign || 'center';

  return {
    decimals: clampedDecimals,
    trimZeros,
    textColor,
    bgColor,
    fontSize,
    fontWeight,
    textAlign
  };
});

// 2. High-speed direct numeric formatting (Instant O(1) hash lookup, Direct Truncation without rounding)
const formattedValue = computed(() => {
  const num = getComponentLiveNumericValue(props.component, props.datasets, 0.0, props.previewMode);
  return formatTruncatedNumber(num, staticStyle.value.decimals, staticStyle.value.trimZeros);
});

// 3. 测点质量状态检查 (quality status=1 表示差/无效，按要求字体一律显示灰色 #94a3b8)
const pointQuality = computed(() => {
  return getComponentPointQuality(props.component);
});

const effectiveTextColor = computed(() => {
  if (props.previewMode && pointQuality.value === 1) {
    return '#94a3b8';
  }
  return staticStyle.value.textColor;
});

// 4. Telemetry Font Size (抓手拉伸实时更新与自适应顶满抓手框，无边框纯净显示)
const dynamicFontSize = computed(() => {
  const fs = props.component.style?.fontSize;
  if (typeof fs === 'number' && fs > 0) {
    return `${fs}px`;
  }
  const compH = props.component.height || 26;
  const compW = props.component.width || 72;
  const valStr = formattedValue.value || '10.00';
  const charLen = Math.max(3.5, valStr.length);
  const fitH = Math.floor(compH * 0.88);
  const fitW = Math.floor((compW - 2) / (charLen * 0.58));
  return `${Math.max(10, Math.min(fitH, fitW))}px`;
});
</script>

<template>
  <div 
    class="w-full h-full flex items-center p-0 m-0 select-none overflow-hidden leading-none relative box-border"
    :class="{
      'justify-start': staticStyle.textAlign === 'left',
      'justify-center': staticStyle.textAlign === 'center',
      'justify-end': staticStyle.textAlign === 'right'
    }"
    :style="{
      backgroundColor: staticStyle.bgColor
    }"
  >
    <!-- 纯净数码数字，无数字边框，顶满组件抓手框 -->
    <span
      class="font-mono font-bold leading-none tracking-tight p-0 m-0 block whitespace-nowrap overflow-hidden select-none"
      :style="{
        color: effectiveTextColor,
        fontSize: dynamicFontSize,
        fontWeight: staticStyle.fontWeight,
        textAlign: staticStyle.textAlign as any,
        fontFamily: `'Chakra Petch', 'JetBrains Mono', Consolas, monospace`,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1
      }"
    >
      {{ formattedValue }}
    </span>
  </div>
</template>

