<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { getComponentLiveNumericValue, formatTruncatedNumber } from '../../utils/scadaResolver';

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

  // Text color
  const textColor = style?.textColor || customProps?.textColor || '#00f2ff';

  // Background color
  const rawFill = style?.fill !== undefined ? style.fill : (customProps?.bgColor !== undefined ? customProps.bgColor : 'transparent');
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
    hasBorder,
    borderColor: strokeColor || 'transparent',
    borderWidth: hasBorder ? strokeWidth : 0,
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

// 3. Telemetry Font Size (统一直接使用 style.fontSize，支持抓手拉伸实时更新与属性面板批量修改)
const dynamicFontSize = computed(() => {
  const fs = props.component.style?.fontSize;
  if (typeof fs === 'number' && fs > 0) {
    return `${fs}px`;
  }
  const compH = props.component.height || 26;
  return `${Math.max(10, Math.floor(compH * 0.82))}px`;
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
  >
    <!-- 紧贴数字或细微边距的数码边框包装盒 (边框紧贴数字，无模糊) -->
    <div
      class="inline-flex items-center justify-center select-none overflow-hidden"
      :class="[
        staticStyle.hasBorder ? 'px-1 py-[1.5px] rounded-[2px]' : 'px-0 py-0'
      ]"
      :style="{ 
        backgroundColor: staticStyle.bgColor,
        borderStyle: staticStyle.hasBorder ? 'solid' : 'none',
        borderColor: staticStyle.borderColor,
        borderWidth: `${staticStyle.borderWidth}px`,
        boxSizing: 'border-box',
        maxWidth: '100%',
        maxHeight: '100%'
      }"
    >
      <span
        class="font-mono font-bold leading-none tracking-tight p-0 m-0 block whitespace-nowrap overflow-hidden select-none"
        :style="{
          color: staticStyle.textColor,
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
  </div>
</template>

