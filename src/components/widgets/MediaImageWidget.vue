<script setup lang="ts">
import { ref, computed } from 'vue';
import { ImageIcon, AlertCircle, UploadCloud } from 'lucide-vue-next';
import { ScreenComponent } from '../../types';

interface Props {
  component: ScreenComponent;
  previewMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  previewMode: false
});

const isImageError = ref(false);
const isHovering = ref(false);

const imageUrl = computed(() => {
  return props.component.customProps?.src || 
         props.component.style?.src || 
         props.component.data?.staticData?.src || 
         props.component.data?.staticData?.url || 
         '';
});

const objectFit = computed(() => {
  return props.component.customProps?.objectFit || 
         props.component.style?.objectFit || 
         'contain';
});

const imageFilter = computed(() => {
  const filterType = props.component.customProps?.imageFilter || props.component.style?.imageFilter || 'none';
  if (filterType === 'hud-dark') {
    return 'brightness(0.9) contrast(1.2) hue-rotate(180deg) saturate(1.4)';
  } else if (filterType === 'cyan-tint') {
    return 'brightness(0.95) contrast(1.1) sepia(100%) hue-rotate(145deg) saturate(300%)';
  } else if (filterType === 'grayscale') {
    return 'grayscale(100%) contrast(1.1)';
  } else if (filterType === 'invert') {
    return 'invert(100%)';
  } else if (filterType === 'high-contrast') {
    return 'contrast(1.4) brightness(1.05)';
  }
  return 'none';
});

const borderRadius = computed(() => {
  return (props.component.style?.borderRadius ?? props.component.customProps?.borderRadius ?? 0) + 'px';
});

const opacity = computed(() => {
  return props.component.style?.opacity ?? props.component.customProps?.opacity ?? 1;
});

const stroke = computed(() => {
  return props.component.style?.stroke || props.component.customProps?.stroke || 'transparent';
});

const strokeWidth = computed(() => {
  return props.component.style?.strokeWidth ?? props.component.customProps?.strokeWidth ?? 0;
});

const fill = computed(() => {
  return props.component.style?.fill || props.component.customProps?.fill || 'transparent';
});

const handleImageLoad = () => {
  isImageError.value = false;
};

const handleImageError = () => {
  isImageError.value = true;
};
</script>

<template>
  <div 
    class="w-full h-full relative overflow-hidden select-none flex items-center justify-center transition-all"
    :style="{
      borderRadius,
      opacity,
      border: strokeWidth > 0 && stroke !== 'transparent' ? `${strokeWidth}px solid ${stroke}` : 'none',
      backgroundColor: fill
    }"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <!-- Actual Image Rendered -->
    <img
      v-if="imageUrl && !isImageError"
      :src="imageUrl"
      :alt="component.name || 'SCADA Image'"
      draggable="false"
      @load="handleImageLoad"
      @error="handleImageError"
      class="w-full h-full pointer-events-none transition-transform"
      :style="{
        objectFit: objectFit,
        filter: imageFilter
      }"
    />

    <!-- Empty State / Placeholder (When no image is set) -->
    <div 
      v-else-if="!imageUrl"
      class="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-[#071326]/80 border-2 border-dashed border-cyan-500/40 rounded-lg text-cyan-300 pointer-events-none"
    >
      <div class="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-400/60 flex items-center justify-center mb-2 text-cyan-300 shadow-[0_0_12px_rgba(0,242,255,0.2)]">
        <ImageIcon class="w-5 h-5" />
      </div>
      <div class="text-xs font-mono font-medium text-cyan-200 mb-0.5 truncate max-w-full">
        {{ component.name || '图片图元' }}
      </div>
      <p class="text-[10px] text-cyan-400/70 font-light leading-tight">
        {{ previewMode ? '暂未配置图片源' : '右侧面板上传或输入图片地址' }}
      </p>
      <div v-if="!previewMode" class="mt-2 px-2 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 text-[9px] font-mono">
        支持 Linux 凝思 / 本地离线 Base64
      </div>
    </div>

    <!-- Error State (When image URL fails to load) -->
    <div 
      v-else
      class="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 pointer-events-none"
    >
      <AlertCircle class="w-6 h-6 text-rose-400 mb-1" />
      <div class="text-xs font-mono font-medium text-rose-200 mb-0.5">图片加载失败</div>
      <p class="text-[10px] text-rose-300/70 font-mono truncate max-w-full px-2">
        {{ imageUrl.substring(0, 40) }}...
      </p>
    </div>
  </div>
</template>
