<script setup lang="ts">
import { ref, computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { 
  Play, 
  Power, 
  RefreshCw, 
  Radio, 
  Sliders, 
  AlertOctagon, 
  CheckCircle2, 
  ArrowRight,
  Sparkles
} from 'lucide-vue-next';

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
const pointerDownPos = ref<{ x: number; y: number } | null>(null);

const style = computed(() => props.component.style || {});
const buttonText = computed(() => style.value.buttonText || props.component.name || '控制按钮');
const variant = computed(() => style.value.buttonVariant || 'solid');
const colorTheme = computed(() => style.value.buttonColorTheme || 'cyan');
const action = computed(() => props.component.data?.action);

// Dynamic font scaling according to component width & height
const dynamicFontSize = computed(() => {
  if (style.value.fontSize) return `${style.value.fontSize}px`;
  const h = props.component.height || 36;
  const w = props.component.width || 100;
  const textLen = Math.max(buttonText.value.length, 2);
  const byHeight = Math.round(h * 0.42);
  const byWidth = Math.round((w - 24) / textLen * 1.1);
  const size = Math.max(11, Math.min(byHeight, byWidth, 42));
  return `${size}px`;
});

const isJumpAction = computed(() => {
  return action.value?.type === 'jump-screen' || action.value?.type === 'switch-screen';
});

const handlePointerDown = (e: MouseEvent) => {
  pointerDownPos.value = { x: e.clientX, y: e.clientY };
  isPressed.value = true;
};

const handlePointerUp = () => {
  isPressed.value = false;
};

const handleClick = (e: MouseEvent) => {
  // In editor mode, button click events are disabled
  if (!props.previewMode) {
    return;
  }

  // Prevent button trigger if mouse was moved / dragged (threshold 5px)
  if (pointerDownPos.value) {
    const dist = Math.hypot(e.clientX - pointerDownPos.value.x, e.clientY - pointerDownPos.value.y);
    if (dist > 5) {
      pointerDownPos.value = null;
      return;
    }
  }
  pointerDownPos.value = null;

  e.stopPropagation();
  isPressed.value = true;
  justTriggered.value = true;
  setTimeout(() => {
    isPressed.value = false;
  }, 150);
  setTimeout(() => {
    justTriggered.value = false;
  }, 1200);

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
    // Default SCADA behavior: open control modal for bound device
    const deviceId = props.component.data?.mapping?.deviceId;
    const pointId = props.component.data?.mapping?.pointId;
    window.dispatchEvent(new CustomEvent('scada:open:control', { detail: { deviceId, pointId } }));
  }
};
const themeClasses = computed(() => {
  switch (colorTheme.value) {
    case 'emerald':
      return {
        bg: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700',
        border: 'border-emerald-400',
        text: 'text-emerald-950 font-bold',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.5)]',
        outlineText: 'text-emerald-300',
        outlineBg: 'bg-emerald-950/40 hover:bg-emerald-900/60',
        dot: 'bg-emerald-400'
      };
    case 'amber':
      return {
        bg: 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600',
        border: 'border-amber-400',
        text: 'text-amber-950 font-bold',
        glow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]',
        outlineText: 'text-amber-300',
        outlineBg: 'bg-amber-950/40 hover:bg-amber-900/60',
        dot: 'bg-amber-400'
      };
    case 'rose':
      return {
        bg: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700',
        border: 'border-rose-400',
        text: 'text-white font-bold',
        glow: 'shadow-[0_0_18px_rgba(225,29,72,0.6)]',
        outlineText: 'text-rose-300',
        outlineBg: 'bg-rose-950/40 hover:bg-rose-900/60',
        dot: 'bg-rose-400'
      };
    case 'indigo':
      return {
        bg: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700',
        border: 'border-indigo-400',
        text: 'text-white font-bold',
        glow: 'shadow-[0_0_15px_rgba(99,102,241,0.5)]',
        outlineText: 'text-indigo-300',
        outlineBg: 'bg-indigo-950/40 hover:bg-indigo-900/60',
        dot: 'bg-indigo-400'
      };
    case 'slate':
      return {
        bg: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-800',
        border: 'border-slate-500',
        text: 'text-slate-100 font-bold',
        glow: 'shadow-[0_0_10px_rgba(148,163,184,0.3)]',
        outlineText: 'text-slate-300',
        outlineBg: 'bg-slate-900/60 hover:bg-slate-800/80',
        dot: 'bg-slate-400'
      };
    case 'cyan':
    default:
      return {
        bg: 'bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600',
        border: 'border-cyan-300',
        text: 'text-slate-950 font-bold',
        glow: 'shadow-[0_0_16px_rgba(0,242,255,0.5)]',
        outlineText: 'text-cyan-300',
        outlineBg: 'bg-cyan-950/40 hover:bg-cyan-900/60',
        dot: 'bg-cyan-400'
      };
  }
});
</script>

<template>
  <div 
    class="w-full h-full flex items-center justify-center select-none font-mono transition-transform duration-100 cursor-pointer pointer-events-auto"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false; isPressed = false"
    @mousedown="handlePointerDown"
    @mouseup="handlePointerUp"
    @click="handleClick"
    :style="{
      opacity: style.opacity ?? 1,
      fontSize: dynamicFontSize
    }"
  >
    <!-- 1. Emergency Stop Knob Variant -->
    <div 
      v-if="variant === 'emergency-stop'"
      class="w-full h-full flex items-center justify-center p-1"
    >
      <div 
        class="w-full h-full rounded-full border-4 border-yellow-400 bg-red-600 hover:bg-red-500 active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.7)] flex flex-col items-center justify-center text-white transition-all relative overflow-hidden"
        :class="{ 'scale-90 shadow-inner bg-red-800': isPressed }"
      >
        <AlertOctagon class="w-6 h-6 animate-pulse" />
        <span class="font-black uppercase tracking-tighter mt-0.5" :style="{ fontSize: dynamicFontSize }">{{ buttonText }}</span>
        <div class="absolute inset-0 bg-radial from-white/25 to-transparent pointer-events-none" />
      </div>
    </div>

    <!-- 2. Metallic Bezel Industrial Button -->
    <div 
      v-else-if="variant === 'metallic'"
      class="w-full h-full rounded-xl bg-gradient-to-b from-slate-700 via-slate-900 to-slate-950 p-[2.5px] border border-slate-600 shadow-xl"
    >
      <div 
        class="w-full h-full rounded-[9px] flex items-center justify-center px-3 gap-2 transition-all"
        :class="[
          isPressed ? 'translate-y-0.5 bg-slate-900 shadow-inner' : 'bg-gradient-to-b from-slate-800 to-slate-900 shadow-md',
          themeClasses.outlineText
        ]"
      >
        <span class="w-2 h-2 rounded-full" :class="[themeClasses.dot, justTriggered ? 'animate-ping' : '']" />
        <span class="font-bold truncate tracking-wide" :style="{ fontSize: dynamicFontSize }">{{ buttonText }}</span>
        <ArrowRight v-if="isJumpAction" class="w-3.5 h-3.5 opacity-70 shrink-0" />
      </div>
    </div>

    <!-- 3. Outline Glass Button -->
    <div 
      v-else-if="variant === 'glass' || variant === 'outline'"
      class="w-full h-full rounded-xl border flex items-center justify-center px-3 gap-2 backdrop-blur-sm transition-all"
      :class="[
        themeClasses.border,
        themeClasses.outlineBg,
        themeClasses.outlineText,
        isHovered ? themeClasses.glow : '',
        isPressed ? 'scale-95' : ''
      ]"
      :style="{
        borderRadius: (style.borderRadius ?? 8) + 'px'
      }"
    >
      <span class="w-1.5 h-1.5 rounded-full" :class="themeClasses.dot" />
      <span class="font-bold truncate tracking-wider" :style="{ fontSize: dynamicFontSize }">{{ buttonText }}</span>
      <ArrowRight v-if="isJumpAction" class="w-3.5 h-3.5 opacity-80 shrink-0" />
    </div>

    <!-- 4. Default Solid Cyber Button -->
    <div 
      v-else
      class="w-full h-full rounded-md border flex items-center justify-center px-1.5 py-0.5 gap-1.5 transition-all shadow-xs leading-none"
      :class="[
        themeClasses.bg,
        themeClasses.border,
        themeClasses.text,
        isHovered ? themeClasses.glow : '',
        isPressed ? 'scale-95 translate-y-0.5' : ''
      ]"
      :style="{
        borderRadius: (style.borderRadius ?? 6) + 'px'
      }"
    >
      <span class="font-bold truncate tracking-tight leading-none" :style="{ fontSize: dynamicFontSize }">{{ buttonText }}</span>
      <ArrowRight v-if="isJumpAction" class="w-3 h-3 stroke-[2] shrink-0" />
    </div>
  </div>
</template>
