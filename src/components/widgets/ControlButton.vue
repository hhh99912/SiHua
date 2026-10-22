<script setup lang="ts">
import { ref, computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { isComponentBoundToControlOrRegulation } from '../../utils/scadaClient';

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
const buttonText = computed(() => style.value.buttonText || customProps.value.label || props.component.name || '控制按钮');
const variant = computed(() => style.value.buttonVariant || 'outline');
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
  return '6px';
});

// 4. 自适应动态内边距 (根据尺寸弹性伸缩，杜绝拉窄时左右内边距将边框挤出容器导致右边框消失)
const dynamicPaddingX = computed(() => {
  const w = props.component.width || 120;
  if (w < 28) return '1px';
  if (w < 48) return '3px';
  if (w < 72) return '6px';
  return '12px';
});

const dynamicPaddingY = computed(() => {
  const h = props.component.height || 40;
  if (h < 24) return '1px';
  if (h < 36) return '3px';
  return '6px';
});

// 5. 动态计算字号 (自适应顶满组件抓手框)
const dynamicFontSize = computed(() => {
  if (style.value.fontSize && typeof style.value.fontSize === 'number' && style.value.fontSize > 0) {
    return `${style.value.fontSize}px`;
  }
  const h = props.component.height || 40;
  const w = props.component.width || 120;
  const text = buttonText.value || '控制按钮';
  let visualLen = 0;
  for (let i = 0; i < text.length; i++) {
    visualLen += text.charCodeAt(i) > 255 ? 1.0 : 0.55;
  }
  visualLen = Math.max(1, visualLen);
  const byHeight = Math.floor(h * 0.72);
  const byWidth = Math.floor((w - 4) / visualLen);
  const minSize = w < 32 ? 6 : 8;
  const size = Math.max(minSize, Math.min(byHeight, byWidth));
  return `${size}px`;
});

const isJumpAction = computed(() => {
  return action.value?.type === 'jump-screen' || action.value?.type === 'switch-screen';
});

// Core Trigger Dispatch Function
const triggerAction = () => {
  if (!props.previewMode) return;

  justTriggered.value = true;
  setTimeout(() => {
    justTriggered.value = false;
  }, 800);

  // 1. Direct screen jump priority
  const targetId = customProps.value.targetScreenId || action.value?.targetScreenId;
  if (targetId) {
    emit('jump:screen', targetId);
    window.dispatchEvent(new CustomEvent('datav:jump:screen', { detail: targetId }));
    return;
  }

  if (action.value) {
    if (isJumpAction.value && action.value.targetScreenId) {
      emit('jump:screen', action.value.targetScreenId);
      window.dispatchEvent(new CustomEvent('datav:jump:screen', { detail: action.value.targetScreenId }));
      return;
    } else if (action.value.type === 'dispatch-command') {
      window.dispatchEvent(new CustomEvent('datav:command', { 
        detail: { 
          componentId: props.component.id, 
          command: action.value.commandValue || 'TRIGGER' 
        } 
      }));
      return;
    }
  }

  // 单击不要触发遥控遥调，工业控制统一由右键上下文菜单核实后执行
};

const handlePointerDown = () => {
  if (!props.previewMode) return;
  isPressed.value = true;
};

const handlePointerUp = () => {
  if (!props.previewMode) return;
  if (isPressed.value) {
    isPressed.value = false;
    triggerAction();
  }
};

const handlePointerEnter = () => {
  if (props.previewMode) {
    isHovered.value = true;
  }
};

// Theme Color Map (发光阴影已全部移除)
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
        glow: 'shadow-none'
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
        glow: 'shadow-none'
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
        glow: 'shadow-none'
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
        glow: 'shadow-none'
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
        glow: 'shadow-none'
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
        glow: 'shadow-none'
      };
  }
});
</script>

<template>
  <button
    type="button"
    class="w-full h-full relative select-none flex items-center justify-center transition-colors duration-150 outline-none focus:outline-none box-border min-w-0 min-h-0"
    :class="[
      previewMode ? 'cursor-pointer active:brightness-90 hover:brightness-105' : 'cursor-default pointer-events-none',
      variant === 'outline'
        ? [themeStyleMap.outlineBg, 'border', themeStyleMap.outlineBorder, themeStyleMap.outlineText]
        : variant === 'flat'
        ? [themeStyleMap.flatBg, 'border border-transparent', themeStyleMap.flatText]
        : [themeStyleMap.solidBg, 'border', themeStyleMap.solidBorder, themeStyleMap.solidText, themeStyleMap.glow],
      justTriggered ? 'ring-2 ring-white animate-pulse' : ''
    ]"
    :style="{
      backgroundColor: effectiveBgColor || undefined,
      color: effectiveTextColor || undefined,
      borderColor: effectiveBorderColor || undefined,
      borderWidth: effectiveBorderWidth || undefined,
      borderRadius: effectiveBorderRadius,
      fontSize: dynamicFontSize,
      paddingLeft: dynamicPaddingX,
      paddingRight: dynamicPaddingX,
      paddingTop: dynamicPaddingY,
      paddingBottom: dynamicPaddingY,
      boxSizing: 'border-box'
    }"
    @pointerdown="handlePointerDown"
    @pointerup="handlePointerUp"
    @pointerleave="isPressed = false; isHovered = false"
    @pointerenter="handlePointerEnter"
  >
    <!-- Button Text Label (极小尺寸自动安全隐藏，防止撑破边框) -->
    <span 
      v-if="(component.width || 120) >= 16 && (component.height || 40) >= 12"
      class="truncate tracking-wide select-none leading-none font-medium max-w-full min-w-0 pointer-events-none"
    >
      {{ buttonText }}
    </span>

    <!-- Trigger Flash Ripple Effect -->
    <div 
      v-if="justTriggered" 
      class="absolute inset-0 bg-white/20 pointer-events-none transition-opacity duration-300"
    ></div>
  </button>
</template>
