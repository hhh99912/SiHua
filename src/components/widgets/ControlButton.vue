<script setup lang="ts">
import { ref, computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { ArrowRight, Power } from 'lucide-vue-next';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
  previewMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  previewMode: false
});

const emit = defineEmits<{
  (e: 'jump:screen', screenId: string): void;
}>();

const isHovered = ref(false);
const isPressed = ref(false);
const justTriggered = ref(false);

const style = computed(() => props.component.style || {});
const customProps = computed(() => props.component.customProps || {});
const buttonText = computed(() => style.value.buttonText || props.component.name || '控制按钮');
const variant = computed(() => style.value.buttonVariant || 'solid');
const colorTheme = computed(() => style.value.buttonColorTheme || 'cyan');
const action = computed(() => props.component.data?.action);

// 1. 用户自定义字体颜色
const effectiveTextColor = computed(() => {
  return style.value.textColor || style.value.color || customProps.value.textColor || customProps.value.color || '';
});

// 2. 用户自定义背景底色
const effectiveBgColor = computed(() => {
  return style.value.fill || style.value.backgroundColor || style.value.bgColor || customProps.value.bgColor || customProps.value.fill || '';
});

// 3. 用户自定义描边颜色与粗细
const effectiveBorderColor = computed(() => {
  return style.value.stroke || style.value.borderColor || customProps.value.borderColor || '';
});

const effectiveBorderWidth = computed(() => {
  if (typeof style.value.strokeWidth === 'number') return `${style.value.strokeWidth}px`;
  if (typeof style.value.borderWidth === 'number') return `${style.value.borderWidth}px`;
  return undefined;
});

const effectiveBorderRadius = computed(() => {
  if (typeof style.value.borderRadius === 'number') return `${style.value.borderRadius}px`;
  return '8px';
});

// 4. 动态计算字号
const dynamicFontSize = computed(() => {
  if (style.value.fontSize) return `${style.value.fontSize}px`;
  const h = props.component.height || 40;
  const w = props.component.width || 120;
  const textLen = Math.max(buttonText.value.length, 2);
  const byHeight = Math.round(h * 0.38);
  const byWidth = Math.round((w - 24) / textLen * 1.1);
  const size = Math.max(12, Math.min(byHeight, byWidth, 32));
  return `${size}px`;
});

const isJumpAction = computed(() => {
  return action.value?.type === 'jump-screen' || action.value?.type === 'switch-screen';
});

// Core Trigger Dispatch Function
const triggerAction = () => {
  justTriggered.value = true;
  setTimeout(() => {
    justTriggered.value = false;
  }, 800);

  if (action.value) {
    if (isJumpAction.value && action.value.targetScreenId) {
      emit('jump:screen', action.value.targetScreenId);
      window.dispatchEvent(new CustomEvent('datav:jump:screen', { detail: action.value.targetScreenId }));
    } else if (action.value.type === 'tele-control') {
      const devId = action.value.deviceId || props.component.data?.mapping?.deviceId;
      const ptId = action.value.pointId || props.component.data?.mapping?.pointId;
      window.dispatchEvent(new CustomEvent('scada:open:control', { detail: { deviceId: devId, pointId: ptId, type: 'control' } }));
    } else if (action.value.type === 'tele-regulation') {
      const devId = action.value.deviceId || props.component.data?.mapping?.deviceId;
      const ptId = action.value.pointId || props.component.data?.mapping?.pointId;
      window.dispatchEvent(new CustomEvent('scada:open:control', { detail: { deviceId: devId, pointId: ptId, type: 'regulation' } }));
    } else if (action.value.type === 'dispatch-command') {
      window.dispatchEvent(new CustomEvent('datav:command', { 
        detail: { 
          componentId: props.component.id, 
          command: action.value.commandValue || 'TRIGGER' 
        } 
      }));
    }
  } else {
    // Default SCADA behavior: open control modal for bound device if configured
    const deviceId = props.component.data?.mapping?.deviceId;
    const pointId = props.component.data?.mapping?.pointId;
    if (deviceId && pointId) {
      window.dispatchEvent(new CustomEvent('scada:open:control', { detail: { deviceId, pointId, type: 'control' } }));
    }
  }
};

const handlePointerDown = () => {
  isPressed.value = true;
};

const handlePointerUp = () => {
  if (isPressed.value) {
    isPressed.value = false;
    triggerAction();
  }
};

// Theme Color Map
const themeStyleMap = computed(() => {
  const t = colorTheme.value;
  switch (t) {
    case 'emerald':
      return {
        solidBg: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700',
        solidBorder: 'border-emerald-400/60',
        solidText: 'text-white',
        outlineBg: 'bg-emerald-950/40 hover:bg-emerald-900/60',
        outlineBorder: 'border-emerald-500/60 hover:border-emerald-400',
        outlineText: 'text-emerald-300',
        flatBg: 'bg-emerald-950/60 hover:bg-emerald-900/80',
        flatText: 'text-emerald-300',
        glow: 'shadow-[0_0_12px_rgba(16,185,129,0.35)]'
      };
    case 'rose':
      return {
        solidBg: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700',
        solidBorder: 'border-rose-400/60',
        solidText: 'text-white',
        outlineBg: 'bg-rose-950/40 hover:bg-rose-900/60',
        outlineBorder: 'border-rose-500/60 hover:border-rose-400',
        outlineText: 'text-rose-300',
        flatBg: 'bg-rose-950/60 hover:bg-rose-900/80',
        flatText: 'text-rose-300',
        glow: 'shadow-[0_0_12px_rgba(244,63,94,0.35)]'
      };
    case 'amber':
      return {
        solidBg: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700',
        solidBorder: 'border-amber-400/60',
        solidText: 'text-slate-950 font-bold',
        outlineBg: 'bg-amber-950/40 hover:bg-amber-900/60',
        outlineBorder: 'border-amber-500/60 hover:border-amber-400',
        outlineText: 'text-amber-300',
        flatBg: 'bg-amber-950/60 hover:bg-amber-900/80',
        flatText: 'text-amber-300',
        glow: 'shadow-[0_0_12px_rgba(245,158,11,0.35)]'
      };
    case 'indigo':
      return {
        solidBg: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700',
        solidBorder: 'border-indigo-400/60',
        solidText: 'text-white',
        outlineBg: 'bg-indigo-950/40 hover:bg-indigo-900/60',
        outlineBorder: 'border-indigo-500/60 hover:border-indigo-400',
        outlineText: 'text-indigo-300',
        flatBg: 'bg-indigo-950/60 hover:bg-indigo-900/80',
        flatText: 'text-indigo-300',
        glow: 'shadow-[0_0_12px_rgba(99,102,241,0.35)]'
      };
    case 'slate':
      return {
        solidBg: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-800',
        solidBorder: 'border-slate-500/60',
        solidText: 'text-slate-100',
        outlineBg: 'bg-slate-900/60 hover:bg-slate-800/80',
        outlineBorder: 'border-slate-600 hover:border-slate-500',
        outlineText: 'text-slate-300',
        flatBg: 'bg-slate-800 hover:bg-slate-700',
        flatText: 'text-slate-300',
        glow: 'shadow-sm'
      };
    case 'cyan':
    default:
      return {
        solidBg: 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700',
        solidBorder: 'border-cyan-400/60',
        solidText: 'text-slate-950 font-bold',
        outlineBg: 'bg-cyan-950/40 hover:bg-cyan-900/60',
        outlineBorder: 'border-cyan-500/60 hover:border-cyan-400',
        outlineText: 'text-cyan-300',
        flatBg: 'bg-cyan-950/60 hover:bg-cyan-900/80',
        flatText: 'text-cyan-300',
        glow: 'shadow-[0_0_12px_rgba(6,182,212,0.35)]'
      };
  }
});
</script>

<template>
  <button
    type="button"
    class="w-full h-full relative select-none flex items-center justify-center gap-2 px-3 py-1.5 transition-all duration-150 cursor-pointer overflow-hidden outline-hidden focus:ring-2 focus:ring-cyan-400/50"
    :class="[
      variant === 'outline'
        ? [themeStyleMap.outlineBg, 'border', themeStyleMap.outlineBorder, themeStyleMap.outlineText]
        : variant === 'flat'
        ? [themeStyleMap.flatBg, 'border border-transparent', themeStyleMap.flatText]
        : [themeStyleMap.solidBg, 'border', themeStyleMap.solidBorder, themeStyleMap.solidText, themeStyleMap.glow],
      isPressed ? 'scale-[0.97] brightness-90' : 'hover:scale-[1.01] hover:brightness-110',
      justTriggered ? 'ring-2 ring-white animate-pulse' : ''
    ]"
    :style="{
      backgroundColor: effectiveBgColor || undefined,
      color: effectiveTextColor || undefined,
      borderColor: effectiveBorderColor || undefined,
      borderWidth: effectiveBorderWidth || undefined,
      borderRadius: effectiveBorderRadius,
      fontSize: dynamicFontSize
    }"
    @pointerdown="handlePointerDown"
    @pointerup="handlePointerUp"
    @pointerleave="isPressed = false; isHovered = false"
    @pointerenter="isHovered = true"
  >
    <!-- Action Icon -->
    <ArrowRight v-if="isJumpAction" class="w-4 h-4 shrink-0 opacity-80" />
    <Power v-else-if="action?.type === 'tele-control'" class="w-4 h-4 shrink-0 opacity-80" />

    <!-- Button Text Label -->
    <span class="truncate tracking-wide select-none leading-none font-medium">
      {{ buttonText }}
    </span>

    <!-- Trigger Flash Ripple Effect -->
    <div 
      v-if="justTriggered" 
      class="absolute inset-0 bg-white/20 pointer-events-none transition-opacity duration-300"
    ></div>
  </button>
</template>
