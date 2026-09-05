<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { 
  AlertOctagon, 
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Zap,
  Lock,
  Unlock,
  Key,
  RotateCw,
  RotateCcw,
  Check,
  ChevronRight,
  Users,
  Power
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

// === Hardware & Mechanical Specific States ===
// 1. Flip Cover State
const isFlipped = ref(false);
const flipCoverShaking = ref(false);

// 2. Key Lock State
const isKeyTurned = ref(false);

// 3. 3-Position Rotary Knob State (-1: LOCAL, 0: STOP, 1: REMOTE)
const rotaryPosition = ref<-1 | 0 | 1>(0);

// 4. Dual Seesaw Rocker State ('left' | 'neutral' | 'right')
const rockerState = ref<'left' | 'neutral' | 'right'>('neutral');

// 5. Charge-to-Fire Hold State
const holdProgress = ref(0);
const isHolding = ref(false);
let holdInterval: any = null;

// 6. Twist-Reset Latch E-Stop State
const isEstopLatched = ref(false);

// 7. Slide-to-Confirm State
const slidePercent = ref(0);
const isSliding = ref(false);
const isSlideUnlocked = ref(false);
let startSlideX = 0;

// 8. Two-Hand Permissive Interlock State
const op1Approved = ref(false);
const op2Approved = ref(false);
let op1Timer: any = null;
let op2Timer: any = null;

const style = computed(() => props.component.style || {});
const customProps = computed(() => props.component.customProps || {});
const buttonText = computed(() => style.value.buttonText || props.component.name || '控制按钮');
const variant = computed(() => style.value.buttonVariant || 'solid');
const colorTheme = computed(() => style.value.buttonColorTheme || 'cyan');
const action = computed(() => props.component.data?.action);

// 1. 用户自定义字体颜色（优先级最高）
const effectiveTextColor = computed(() => {
  return style.value.textColor || style.value.color || customProps.value.textColor || customProps.value.color || '';
});

// 2. 用户自定义背景底色（优先级最高）
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
  return undefined;
});

// Dynamic font scaling according to component width & height
const dynamicFontSize = computed(() => {
  if (style.value.fontSize) return `${style.value.fontSize}px`;
  const h = props.component.height || 36;
  const w = props.component.width || 100;
  const textLen = Math.max(buttonText.value.length, 2);
  const byHeight = Math.round(h * 0.38);
  const byWidth = Math.round((w - 24) / textLen * 1.1);
  const size = Math.max(11, Math.min(byHeight, byWidth, 36));
  return `${size}px`;
});

const isJumpAction = computed(() => {
  return action.value?.type === 'jump-screen' || action.value?.type === 'switch-screen';
});

// Core Trigger Dispatch Function
const triggerAction = (customVal?: string) => {
  justTriggered.value = true;
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
      window.dispatchEvent(new CustomEvent('scada:open:control', { detail: { deviceId: devId, pointId: ptId, type: 'control', value: customVal } }));
    } else if (action.value.type === 'tele-regulation') {
      const devId = action.value.deviceId || props.component.data?.mapping?.deviceId;
      const ptId = action.value.pointId || props.component.data?.mapping?.pointId;
      window.dispatchEvent(new CustomEvent('scada:open:control', { detail: { deviceId: devId, pointId: ptId, type: 'regulation', value: customVal } }));
    } else if (action.value.type === 'dispatch-command') {
      window.dispatchEvent(new CustomEvent('datav:command', { 
        detail: { 
          componentId: props.component.id, 
          command: customVal || action.value.commandValue || 'TRIGGER' 
        } 
      }));
    }
  } else {
    // Default SCADA behavior: open control modal for bound device
    const deviceId = props.component.data?.mapping?.deviceId;
    const pointId = props.component.data?.mapping?.pointId;
    window.dispatchEvent(new CustomEvent('scada:open:control', { detail: { deviceId, pointId, value: customVal } }));
  }
};

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

  // For complex interactive mechanisms, click handlers are handled in their own dedicated interaction methods
  if (
    variant.value === 'flip-cover' ||
    variant.value === 'key-lock' ||
    variant.value === 'rotary-3pos' ||
    variant.value === 'rocker-switch' ||
    variant.value === 'charge-hold' ||
    variant.value === 'latch-estop' ||
    variant.value === 'slide-confirm' ||
    variant.value === 'two-hand'
  ) {
    return;
  }

  isPressed.value = true;
  setTimeout(() => {
    isPressed.value = false;
  }, 150);
  triggerAction();
};

// === 1. Flip-Cover Mechanics ===
const handleFlipCoverClick = (e: MouseEvent) => {
  if (!props.previewMode) return;
  e.stopPropagation();
  isFlipped.value = !isFlipped.value;
};

const handleFlipCoverInnerClick = (e: MouseEvent) => {
  if (!props.previewMode) return;
  e.stopPropagation();
  if (!isFlipped.value) {
    // Trigger shake animation warning
    flipCoverShaking.value = true;
    setTimeout(() => {
      flipCoverShaking.value = false;
    }, 500);
    return;
  }
  isPressed.value = true;
  setTimeout(() => {
    isPressed.value = false;
  }, 160);
  triggerAction('FLIP_EXECUTE');
};

// === 2. Key-Lock Mechanics ===
const handleKeyTurn = (e: MouseEvent) => {
  if (!props.previewMode) return;
  e.stopPropagation();
  isKeyTurned.value = !isKeyTurned.value;
};

const handleKeyLockExecute = (e: MouseEvent) => {
  if (!props.previewMode) return;
  e.stopPropagation();
  if (!isKeyTurned.value) {
    return;
  }
  isPressed.value = true;
  setTimeout(() => {
    isPressed.value = false;
  }, 160);
  triggerAction('KEY_PERMISSIVE_EXECUTE');
};

// === 3. Rotary 3-Position Knob Mechanics ===
const handleRotaryKnobClick = (e: MouseEvent) => {
  if (!props.previewMode) return;
  e.stopPropagation();
  if (rotaryPosition.value === -1) rotaryPosition.value = 0;
  else if (rotaryPosition.value === 0) rotaryPosition.value = 1;
  else rotaryPosition.value = -1;
  
  const valMap = { '-1': 'LOCAL', '0': 'STOP', '1': 'REMOTE' };
  triggerAction(valMap[String(rotaryPosition.value) as '-1' | '0' | '1']);
};

const setRotaryPosition = (pos: -1 | 0 | 1, e: MouseEvent) => {
  if (!props.previewMode) return;
  e.stopPropagation();
  rotaryPosition.value = pos;
  const valMap = { '-1': 'LOCAL', '0': 'STOP', '1': 'REMOTE' };
  triggerAction(valMap[String(pos) as '-1' | '0' | '1']);
};

// === 4. Seesaw Rocker Mechanics ===
const handleRockerClick = (side: 'left' | 'right', e: MouseEvent) => {
  if (!props.previewMode) return;
  e.stopPropagation();
  rockerState.value = side;
  triggerAction(side === 'left' ? 'TRIP' : 'CLOSE');
};

// === 5. Charge-to-Fire Hold Mechanics ===
const startChargeHold = (e: MouseEvent | TouchEvent) => {
  if (!props.previewMode) return;
  e.stopPropagation();
  isHolding.value = true;
  holdProgress.value = 0;
  clearInterval(holdInterval);
  
  const stepMs = 30;
  const totalMs = 1400;
  holdInterval = setInterval(() => {
    holdProgress.value += (stepMs / totalMs) * 100;
    if (holdProgress.value >= 100) {
      holdProgress.value = 100;
      clearInterval(holdInterval);
      isHolding.value = false;
      triggerAction('CHARGE_FIRE_SUCCESS');
      setTimeout(() => {
        holdProgress.value = 0;
      }, 1000);
    }
  }, stepMs);
};

const cancelChargeHold = () => {
  if (isHolding.value) {
    isHolding.value = false;
    clearInterval(holdInterval);
    holdProgress.value = 0;
  }
};

// === 6. Twist-to-Reset Latch E-Stop Mechanics ===
const handleEstopPress = (e: MouseEvent) => {
  if (!props.previewMode) return;
  e.stopPropagation();
  if (!isEstopLatched.value) {
    isEstopLatched.value = true;
    triggerAction('EMERGENCY_SHUTDOWN');
  }
};

const handleEstopTwistReset = (e: MouseEvent) => {
  if (!props.previewMode) return;
  e.stopPropagation();
  if (isEstopLatched.value) {
    isEstopLatched.value = false;
    triggerAction('ESTOP_RESET');
  }
};

// === 7. Slide-to-Confirm Mechanics ===
const handleSlideStart = (e: MouseEvent) => {
  if (!props.previewMode || isSlideUnlocked.value) return;
  e.stopPropagation();
  isSliding.value = true;
  startSlideX = e.clientX;
  
  const onMove = (me: MouseEvent) => {
    if (!isSliding.value) return;
    const delta = me.clientX - startSlideX;
    const maxTrack = props.component.width - 56;
    const pct = Math.min(100, Math.max(0, (delta / Math.max(1, maxTrack)) * 100));
    slidePercent.value = pct;
    if (pct >= 95) {
      slidePercent.value = 100;
      isSliding.value = false;
      isSlideUnlocked.value = true;
      triggerAction('SLIDE_CONFIRM_DISPATCH');
      setTimeout(() => {
        slidePercent.value = 0;
        isSlideUnlocked.value = false;
      }, 2000);
      cleanup();
    }
  };
  
  const onUp = () => {
    if (isSliding.value) {
      isSliding.value = false;
      if (slidePercent.value < 95) {
        slidePercent.value = 0;
      }
    }
    cleanup();
  };
  
  const cleanup = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
};

// === 8. Two-Hand Permissive Interlock Mechanics ===
const handleOp1Press = (e: MouseEvent) => {
  if (!props.previewMode) return;
  e.stopPropagation();
  op1Approved.value = true;
  clearTimeout(op1Timer);
  op1Timer = setTimeout(() => {
    op1Approved.value = false;
  }, 4000);
  checkTwoHandBoth();
};

const handleOp2Press = (e: MouseEvent) => {
  if (!props.previewMode) return;
  e.stopPropagation();
  op2Approved.value = true;
  clearTimeout(op2Timer);
  op2Timer = setTimeout(() => {
    op2Approved.value = false;
  }, 4000);
  checkTwoHandBoth();
};

const checkTwoHandBoth = () => {
  if (op1Approved.value && op2Approved.value) {
    triggerAction('TWO_HAND_PERMISSIVE_EXECUTE');
    setTimeout(() => {
      op1Approved.value = false;
      op2Approved.value = false;
    }, 1500);
  }
};

onUnmounted(() => {
  clearInterval(holdInterval);
  clearTimeout(op1Timer);
  clearTimeout(op2Timer);
});

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
        dot: 'bg-emerald-400',
        accentColor: '#10b981'
      };
    case 'amber':
      return {
        bg: 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600',
        border: 'border-amber-400',
        text: 'text-amber-950 font-bold',
        glow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]',
        outlineText: 'text-amber-300',
        outlineBg: 'bg-amber-950/40 hover:bg-amber-900/60',
        dot: 'bg-amber-400',
        accentColor: '#f59e0b'
      };
    case 'rose':
      return {
        bg: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700',
        border: 'border-rose-400',
        text: 'text-white font-bold',
        glow: 'shadow-[0_0_18px_rgba(225,29,72,0.6)]',
        outlineText: 'text-rose-300',
        outlineBg: 'bg-rose-950/40 hover:bg-rose-900/60',
        dot: 'bg-rose-400',
        accentColor: '#f43f5e'
      };
    case 'indigo':
      return {
        bg: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700',
        border: 'border-indigo-400',
        text: 'text-white font-bold',
        glow: 'shadow-[0_0_15px_rgba(99,102,241,0.5)]',
        outlineText: 'text-indigo-300',
        outlineBg: 'bg-indigo-950/40 hover:bg-indigo-900/60',
        dot: 'bg-indigo-400',
        accentColor: '#6366f1'
      };
    case 'slate':
      return {
        bg: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-800',
        border: 'border-slate-500',
        text: 'text-slate-100 font-bold',
        glow: 'shadow-[0_0_10px_rgba(148,163,184,0.3)]',
        outlineText: 'text-slate-300',
        outlineBg: 'bg-slate-900/60 hover:bg-slate-800/80',
        dot: 'bg-slate-400',
        accentColor: '#94a3b8'
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
        dot: 'bg-cyan-400',
        accentColor: '#00f2ff'
      };
  }
});
</script>

<template>
  <div 
    class="w-full h-full flex items-center justify-center select-none font-mono transition-transform duration-100 cursor-pointer pointer-events-auto relative overflow-visible"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false; isPressed = false; cancelChargeHold()"
    @mousedown="handlePointerDown"
    @mouseup="handlePointerUp"
    @click="handleClick"
    :style="{
      opacity: style.opacity ?? 1,
      fontSize: dynamicFontSize
    }"
  >
    <!-- ================================================================= -->
    <!-- 1. FLIP-COVER: 翻盖防误触安全按钮 (Safety Flip-Cover Mechanism)       -->
    <!-- ================================================================= -->
    <div 
      v-if="variant === 'flip-cover'"
      class="w-full h-full relative rounded-lg p-1.5 border flex flex-col justify-between overflow-hidden shadow-2xl transition-all"
      :style="{
        backgroundColor: effectiveBgColor || '#07101e',
        borderColor: effectiveBorderColor || '#f59e0b',
        borderWidth: effectiveBorderWidth || '1.5px',
        borderRadius: effectiveBorderRadius || '10px'
      }"
    >
      <!-- Industrial Hex Mounting Screws -->
      <div class="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-slate-400/80 border border-slate-700" />
      <div class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-400/80 border border-slate-700" />
      <div class="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-slate-400/80 border border-slate-700" />
      <div class="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-400/80 border border-slate-700" />

      <!-- Inner Recessed Push Button underneath cover -->
      <div 
        @click="handleFlipCoverInnerClick"
        class="w-full h-full rounded-md border flex items-center justify-center px-2 py-1 gap-1.5 transition-all relative z-0"
        :class="[
          isFlipped ? 'cursor-pointer hover:brightness-110 active:scale-95 shadow-[0_0_12px_rgba(244,63,94,0.6)]' : 'cursor-not-allowed opacity-75',
          isPressed ? 'translate-y-0.5 shadow-inner' : ''
        ]"
        :style="{
          backgroundColor: isFlipped ? '#e11d48' : '#334155',
          borderColor: isFlipped ? '#fda4af' : '#64748b',
          color: effectiveTextColor || '#ffffff'
        }"
      >
        <Power class="w-4 h-4 shrink-0" :class="isFlipped ? 'text-white animate-pulse' : 'text-slate-400'" />
        <span class="font-bold truncate tracking-tight text-center" :style="{ fontSize: dynamicFontSize }">
          {{ buttonText }}
        </span>
      </div>

      <!-- Hinged Polycarbonate Flip Cover Overlay (3D Swing) -->
      <div
        v-if="!isFlipped"
        @click="handleFlipCoverClick"
        class="absolute inset-0 z-20 rounded-lg p-1.5 bg-yellow-500/25 backdrop-blur-[2px] border-2 border-yellow-400/80 flex flex-col items-center justify-between cursor-pointer transition-transform"
        :class="{ 'animate-shake': flipCoverShaking }"
        style="background: repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.2) 8px, rgba(0, 0, 0, 0.4) 8px, rgba(0, 0, 0, 0.4) 16px);"
      >
        <!-- Hinge Pin -->
        <div class="w-16 h-1.5 bg-slate-700 rounded-full border border-yellow-400/60 shadow-xs" />
        
        <!-- Center Warning Tag -->
        <div class="px-2 py-0.5 rounded bg-black/85 border border-yellow-400/80 text-[10px] text-yellow-300 font-bold tracking-widest flex items-center gap-1 shadow-md">
          <Lock class="w-3 h-3 text-yellow-400" />
          <span>防误触保护罩 (点击掀开)</span>
        </div>

        <!-- Flip Pull Latch Tab -->
        <div class="w-full flex justify-center">
          <div class="px-3 py-0.5 rounded-t bg-yellow-400 text-slate-950 text-[9px] font-black tracking-tighter uppercase shadow-sm flex items-center gap-1 hover:bg-yellow-300">
            <span>FLIP OPEN ▲</span>
          </div>
        </div>
      </div>

      <!-- Quick Close Button when Flipped -->
      <button
        v-else
        @click="handleFlipCoverClick"
        type="button"
        class="absolute top-0.5 right-1 z-30 px-1.5 py-0.2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[9px] font-mono font-bold shadow-md cursor-pointer"
      >
        合上盖 ▼
      </button>
    </div>

    <!-- ================================================================= -->
    <!-- 2. KEY-LOCK: 五防钥匙闭锁旋转开关 (Key Interlock Rotary Switch)       -->
    <!-- ================================================================= -->
    <div
      v-else-if="variant === 'key-lock'"
      class="w-full h-full rounded-xl p-2 border flex items-center justify-between gap-2 shadow-2xl relative transition-all"
      :style="{
        backgroundColor: effectiveBgColor || '#071021',
        borderColor: effectiveBorderColor || (isKeyTurned ? '#10b981' : '#f43f5e'),
        borderWidth: effectiveBorderWidth || '1.5px',
        borderRadius: effectiveBorderRadius || '12px'
      }"
    >
      <!-- Keyhole & Metallic Key Head (Interactive Turn) -->
      <div 
        @click="handleKeyTurn"
        class="w-10 h-10 rounded-full bg-linear-to-b from-slate-600 via-slate-800 to-slate-950 border-2 flex items-center justify-center relative cursor-pointer shadow-lg shrink-0 group transition-transform active:scale-95"
        :style="{ borderColor: isKeyTurned ? '#10b981' : '#f43f5e' }"
        :title="isKeyTurned ? '钥匙已导通 (点击拔出锁定)' : '钥匙闭锁 (点击旋转90°放行)'"
      >
        <!-- Metallic Key Grip inserted into slot -->
        <div 
          class="transition-transform duration-300 flex items-center justify-center"
          :class="isKeyTurned ? 'rotate-90' : 'rotate-0'"
        >
          <div class="w-2.5 h-6 rounded bg-linear-to-r from-amber-200 via-amber-400 to-amber-600 border border-amber-300 shadow-md flex items-center justify-center">
            <div class="w-1 h-3 bg-amber-900/60 rounded-xs" />
          </div>
        </div>

        <!-- Status Pilot LED -->
        <div 
          class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-black shadow-xs"
          :class="isKeyTurned ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'"
        />
      </div>

      <!-- Action Push Button (Enabled only when key is turned) -->
      <div 
        @click="handleKeyLockExecute"
        class="flex-1 h-full rounded-lg border flex flex-col items-center justify-center px-2 transition-all relative overflow-hidden"
        :class="[
          isKeyTurned 
            ? 'cursor-pointer bg-emerald-600 hover:bg-emerald-500 active:scale-95 border-emerald-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.5)]' 
            : 'cursor-not-allowed bg-slate-900/80 border-slate-700/80 text-slate-500',
          isPressed && isKeyTurned ? 'scale-95 shadow-inner' : ''
        ]"
        :style="{
          color: isKeyTurned ? (effectiveTextColor || '#ffffff') : undefined
        }"
      >
        <div class="flex items-center gap-1">
          <Key class="w-3.5 h-3.5" :class="isKeyTurned ? 'text-emerald-200' : 'text-slate-600'" />
          <span class="font-bold truncate tracking-tight text-xs">
            {{ isKeyTurned ? buttonText : '闭锁中 (转动钥匙)' }}
          </span>
        </div>
        <span class="text-[9px] font-mono tracking-tighter opacity-85">
          {{ isKeyTurned ? '● 权限就绪 点击执行' : '○ 五防机械闭锁' }}
        </span>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- 3. ROTARY-3POS: 三档工况选择旋钮 (3-Position Heavy Knob)             -->
    <!-- ================================================================= -->
    <div
      v-else-if="variant === 'rotary-3pos'"
      class="w-full h-full rounded-xl p-2 border flex items-center justify-between gap-3 shadow-xl relative select-none"
      :style="{
        backgroundColor: effectiveBgColor || '#070f1e',
        borderColor: effectiveBorderColor || '#00f2ff',
        borderWidth: effectiveBorderWidth || '1.5px',
        borderRadius: effectiveBorderRadius || '12px'
      }"
    >
      <!-- Knurled 3-Position Center Knob -->
      <div 
        @click="handleRotaryKnobClick"
        class="w-11 h-11 rounded-full bg-linear-to-b from-slate-700 via-slate-800 to-slate-950 border-2 border-cyan-400/80 flex items-center justify-center relative cursor-pointer shadow-lg shrink-0 transition-transform active:scale-95"
        title="点击旋钮顺序切档 (就地/停止/远方)"
      >
        <!-- Knob Pointer Indicator -->
        <div 
          class="w-full h-full flex items-center justify-center transition-transform duration-300"
          :style="{
            transform: rotaryPosition === -1 ? 'rotate(-45deg)' : (rotaryPosition === 1 ? 'rotate(45deg)' : 'rotate(0deg)')
          }"
        >
          <div class="w-1 h-5 bg-cyan-300 rounded-full shadow-[0_0_8px_#00f2ff] translate-y-[-7px]" />
        </div>
        <!-- Center Cap -->
        <div class="absolute w-4 h-4 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center text-[8px] text-cyan-400 font-mono">
          3P
        </div>
      </div>

      <!-- 3 Stepped Indicators (Local / Stop / Remote) -->
      <div class="flex-1 grid grid-cols-3 gap-1 h-full items-center">
        <!-- Position 1: LOCAL -->
        <button
          @click="setRotaryPosition(-1, $event)"
          type="button"
          class="h-full rounded flex flex-col items-center justify-center px-1 border transition-all cursor-pointer"
          :class="rotaryPosition === -1 ? 'bg-amber-950/80 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'"
        >
          <span class="w-2 h-2 rounded-full mb-0.5" :class="rotaryPosition === -1 ? 'bg-amber-400' : 'bg-slate-700'" />
          <span class="text-[10px] font-bold">就地</span>
          <span class="text-[8px] font-mono opacity-70">LOCAL</span>
        </button>

        <!-- Position 2: STOP -->
        <button
          @click="setRotaryPosition(0, $event)"
          type="button"
          class="h-full rounded flex flex-col items-center justify-center px-1 border transition-all cursor-pointer"
          :class="rotaryPosition === 0 ? 'bg-rose-950/80 border-rose-400 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'"
        >
          <span class="w-2 h-2 rounded-full mb-0.5" :class="rotaryPosition === 0 ? 'bg-rose-500' : 'bg-slate-700'" />
          <span class="text-[10px] font-bold">切除</span>
          <span class="text-[8px] font-mono opacity-70">STOP</span>
        </button>

        <!-- Position 3: REMOTE -->
        <button
          @click="setRotaryPosition(1, $event)"
          type="button"
          class="h-full rounded flex flex-col items-center justify-center px-1 border transition-all cursor-pointer"
          :class="rotaryPosition === 1 ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'"
        >
          <span class="w-2 h-2 rounded-full mb-0.5" :class="rotaryPosition === 1 ? 'bg-emerald-400' : 'bg-slate-700'" />
          <span class="text-[10px] font-bold">远方</span>
          <span class="text-[8px] font-mono opacity-70">REMOTE</span>
        </button>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- 4. ROCKER-SWITCH: 双向机械互锁翘板 (Dual Seesaw Rocker)               -->
    <!-- ================================================================= -->
    <div
      v-else-if="variant === 'rocker-switch'"
      class="w-full h-full rounded-xl p-1 border flex items-center justify-center shadow-xl relative overflow-hidden"
      :style="{
        backgroundColor: effectiveBgColor || '#030814',
        borderColor: effectiveBorderColor || '#475569',
        borderWidth: effectiveBorderWidth || '1.5px',
        borderRadius: effectiveBorderRadius || '10px'
      }"
    >
      <div class="w-full h-full grid grid-cols-2 gap-1 rounded-lg bg-slate-950 p-1">
        <!-- Left Wing: TRIP / 分闸 -->
        <button
          @click="handleRockerClick('left', $event)"
          type="button"
          class="h-full rounded-md border flex flex-col items-center justify-center p-1 cursor-pointer transition-all relative overflow-hidden"
          :class="[
            rockerState === 'left' 
              ? 'bg-emerald-600/90 border-emerald-400 text-white shadow-inner translate-y-0.5' 
              : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/60'
          ]"
        >
          <div class="w-2 h-2 rounded-full mb-1" :class="rockerState === 'left' ? 'bg-emerald-300 shadow-[0_0_6px_#10b981]' : 'bg-emerald-700'" />
          <span class="font-bold text-xs">分闸</span>
          <span class="text-[9px] font-mono opacity-70">TRIP (O)</span>
        </button>

        <!-- Right Wing: CLOSE / 合闸 -->
        <button
          @click="handleRockerClick('right', $event)"
          type="button"
          class="h-full rounded-md border flex flex-col items-center justify-center p-1 cursor-pointer transition-all relative overflow-hidden"
          :class="[
            rockerState === 'right' 
              ? 'bg-rose-600/90 border-rose-400 text-white shadow-inner translate-y-0.5' 
              : 'bg-rose-950/30 border-rose-500/40 text-rose-400 hover:bg-rose-950/60'
          ]"
        >
          <div class="w-2 h-2 rounded-full mb-1" :class="rockerState === 'right' ? 'bg-rose-300 shadow-[0_0_6px_#f43f5e]' : 'bg-rose-700'" />
          <span class="font-bold text-xs">合闸</span>
          <span class="text-[9px] font-mono opacity-70">CLOSE (I)</span>
        </button>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- 5. CHARGE-HOLD: 长按充能防误动按钮 (Charge-to-Fire Hold Button)       -->
    <!-- ================================================================= -->
    <div
      v-else-if="variant === 'charge-hold'"
      @mousedown="startChargeHold"
      @mouseup="cancelChargeHold"
      @mouseleave="cancelChargeHold"
      @touchstart="startChargeHold"
      @touchend="cancelChargeHold"
      class="w-full h-full rounded-xl p-1.5 border flex items-center justify-between gap-2 shadow-2xl relative select-none overflow-hidden cursor-pointer"
      :style="{
        backgroundColor: effectiveBgColor || '#071226',
        borderColor: effectiveBorderColor || (holdProgress >= 100 ? '#10b981' : (isHolding ? '#f59e0b' : '#00f2ff')),
        borderWidth: effectiveBorderWidth || '1.5px',
        borderRadius: effectiveBorderRadius || '12px'
      }"
    >
      <!-- Circular Progress Ring -->
      <div class="relative w-10 h-10 shrink-0 flex items-center justify-center">
        <svg class="w-full h-full -rotate-90">
          <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.15)" stroke-width="3" fill="transparent" />
          <circle 
            cx="20" 
            cy="20" 
            r="16" 
            :stroke="holdProgress >= 100 ? '#10b981' : (isHolding ? '#f59e0b' : '#00f2ff')" 
            stroke-width="3" 
            fill="transparent"
            stroke-dasharray="100"
            :stroke-dashoffset="100 - holdProgress"
            stroke-linecap="round"
            class="transition-all duration-75"
          />
        </svg>
        <span class="absolute text-[10px] font-mono font-bold" :class="holdProgress >= 100 ? 'text-emerald-400' : 'text-cyan-300'">
          {{ Math.round(holdProgress) }}%
        </span>
      </div>

      <!-- Main Text & State Feedback -->
      <div class="flex-1 flex flex-col justify-center overflow-hidden">
        <div class="flex items-center gap-1.5">
          <Zap class="w-3.5 h-3.5" :class="isHolding ? 'text-amber-400 animate-bounce' : 'text-cyan-400'" />
          <span class="font-bold truncate text-xs" :style="{ color: effectiveTextColor || undefined }">
            {{ buttonText }}
          </span>
        </div>
        <span class="text-[9px] font-mono truncate" :class="holdProgress >= 100 ? 'text-emerald-400' : (isHolding ? 'text-amber-300' : 'text-slate-400')">
          {{ holdProgress >= 100 ? '✓ 充能完成 已触发' : (isHolding ? '正在充能防误动...' : '按住 1.5s 确认执行') }}
        </span>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- 6. LATCH-ESTOP: 旋转复位自锁急停钮 (Twist-to-Reset Latch E-Stop)      -->
    <!-- ================================================================= -->
    <div
      v-else-if="variant === 'latch-estop' || variant === 'emergency-stop'"
      class="w-full h-full rounded-2xl p-1.5 border-2 flex items-center justify-between gap-2 shadow-2xl relative select-none"
      :style="{
        backgroundColor: effectiveBgColor || '#1c1917',
        borderColor: effectiveBorderColor || '#eab308',
        borderWidth: effectiveBorderWidth || '2px',
        borderRadius: effectiveBorderRadius || '16px'
      }"
    >
      <!-- Big Round Mushroom Head -->
      <button
        @click="handleEstopPress"
        type="button"
        class="w-12 h-12 rounded-full border-4 border-yellow-400 shadow-xl flex flex-col items-center justify-center shrink-0 transition-all cursor-pointer relative overflow-hidden"
        :class="[
          isEstopLatched 
            ? 'scale-90 bg-rose-950 border-rose-600 shadow-inner' 
            : 'bg-rose-600 hover:bg-rose-500 active:scale-95 shadow-[0_0_15px_rgba(225,29,72,0.7)]'
        ]"
      >
        <AlertOctagon class="w-5 h-5 text-white" :class="isEstopLatched ? 'animate-pulse' : ''" />
        <span class="text-[8px] font-black text-white uppercase leading-none mt-0.5">
          {{ isEstopLatched ? 'LATCH' : 'STOP' }}
        </span>
      </button>

      <!-- Twist Reset Ring & Label -->
      <div class="flex-1 flex flex-col justify-center">
        <span class="text-xs font-bold truncate" :class="isEstopLatched ? 'text-rose-400' : 'text-yellow-400'">
          {{ isEstopLatched ? '⚠️ 急停闭锁生效' : buttonText }}
        </span>
        
        <button
          v-if="isEstopLatched"
          @click="handleEstopTwistReset"
          type="button"
          class="mt-1 px-2 py-0.5 rounded bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-[10px] font-bold flex items-center gap-1 shadow-md cursor-pointer animate-pulse"
        >
          <RotateCw class="w-3 h-3" />
          <span>顺时针旋转复位</span>
        </button>
        <span v-else class="text-[9px] text-slate-400 font-mono mt-0.5">
          拍下急停 / 旋转解锁
        </span>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- 7. SLIDE-CONFIRM: 滑动解锁确认执行滑块 (Slide-to-Confirm)            -->
    <!-- ================================================================= -->
    <div
      v-else-if="variant === 'slide-confirm'"
      class="w-full h-full rounded-xl p-1 border flex items-center relative overflow-hidden shadow-xl select-none"
      :style="{
        backgroundColor: effectiveBgColor || '#030813',
        borderColor: effectiveBorderColor || (isSlideUnlocked ? '#10b981' : '#00f2ff'),
        borderWidth: effectiveBorderWidth || '1.5px',
        borderRadius: effectiveBorderRadius || '12px'
      }"
    >
      <!-- Background Guide Chevrons -->
      <div class="absolute inset-0 flex items-center justify-center gap-2 text-cyan-500/40 text-xs font-bold tracking-widest pointer-events-none">
        <span :class="isSlideUnlocked ? 'text-emerald-400' : 'text-cyan-300/60'">
          {{ isSlideUnlocked ? '✓ 指令已确认执行' : '滑动滑块确认执行 >>>' }}
        </span>
      </div>

      <!-- Left Slider Thumb Handle -->
      <div
        @mousedown="handleSlideStart"
        class="h-full aspect-square rounded-lg border-2 flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform relative z-10 shadow-lg"
        :class="isSlideUnlocked ? 'bg-emerald-500 border-emerald-300 text-slate-950' : 'bg-cyan-500 border-cyan-300 text-slate-950 hover:brightness-110'"
        :style="{
          transform: `translateX(${(slidePercent / 100) * (component.width - 48)}px)`
        }"
      >
        <Check v-if="isSlideUnlocked" class="w-4 h-4 stroke-[3]" />
        <ChevronRight v-else class="w-4 h-4 stroke-[3] animate-pulse" />
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- 8. TWO-HAND: 双人双键同押确认器 (Two-Hand Permissive Interlock)       -->
    <!-- ================================================================= -->
    <div
      v-else-if="variant === 'two-hand'"
      class="w-full h-full rounded-xl p-1.5 border flex items-center justify-between gap-1.5 shadow-xl relative select-none"
      :style="{
        backgroundColor: effectiveBgColor || '#060e1d',
        borderColor: effectiveBorderColor || (op1Approved && op2Approved ? '#10b981' : '#6366f1'),
        borderWidth: effectiveBorderWidth || '1.5px',
        borderRadius: effectiveBorderRadius || '12px'
      }"
    >
      <!-- Operator 1 Key -->
      <button
        @click="handleOp1Press"
        type="button"
        class="flex-1 h-full rounded-lg border flex flex-col items-center justify-center p-1 cursor-pointer transition-all"
        :class="op1Approved ? 'bg-emerald-600 border-emerald-400 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-cyan-200'"
      >
        <span class="text-[9px] font-mono">操作人 1</span>
        <span class="text-xs font-bold">{{ op1Approved ? '已确认 ✓' : '点击授权' }}</span>
      </button>

      <!-- Center Dual Permissive Icon -->
      <div class="flex flex-col items-center justify-center px-1">
        <Users class="w-3.5 h-3.5" :class="op1Approved && op2Approved ? 'text-emerald-400 animate-bounce' : 'text-indigo-400'" />
        <span class="text-[8px] font-mono text-slate-400 mt-0.5">两票互锁</span>
      </div>

      <!-- Operator 2 Key -->
      <button
        @click="handleOp2Press"
        type="button"
        class="flex-1 h-full rounded-lg border flex flex-col items-center justify-center p-1 cursor-pointer transition-all"
        :class="op2Approved ? 'bg-emerald-600 border-emerald-400 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-cyan-200'"
      >
        <span class="text-[9px] font-mono">监护人 2</span>
        <span class="text-xs font-bold">{{ op2Approved ? '已确认 ✓' : '点击授权' }}</span>
      </button>
    </div>

    <!-- ================================================================= -->
    <!-- 9. METALLIC: 金属机械按键 (Metallic Bezel Legacy Fallback)         -->
    <!-- ================================================================= -->
    <div 
      v-else-if="variant === 'metallic'"
      class="w-full h-full rounded-xl p-[2px] border shadow-xl transition-all"
      :style="{
        borderRadius: effectiveBorderRadius || '10px',
        borderColor: effectiveBorderColor || '#475569',
        borderWidth: effectiveBorderWidth || '1px'
      }"
      :class="[
        effectiveBgColor ? '' : 'bg-gradient-to-b from-slate-700 via-slate-900 to-slate-950'
      ]"
    >
      <div 
        class="w-full h-full rounded-[8px] flex items-center justify-center px-3 gap-2 transition-all"
        :class="[
          isPressed ? 'translate-y-0.5 shadow-inner' : 'shadow-md',
          effectiveTextColor ? '' : themeClasses.outlineText
        ]"
        :style="{
          backgroundColor: effectiveBgColor || (isPressed ? '#0f172a' : '#1e293b'),
          borderRadius: effectiveBorderRadius ? `calc(${effectiveBorderRadius} - 2px)` : '8px',
          color: effectiveTextColor || undefined
        }"
      >
        <span 
          class="w-2 h-2 rounded-full" 
          :class="[effectiveTextColor ? '' : themeClasses.dot, justTriggered ? 'animate-ping' : '']"
          :style="{ backgroundColor: effectiveTextColor || undefined }"
        />
        <span 
          class="font-bold truncate tracking-wide" 
          :style="{ fontSize: dynamicFontSize, color: effectiveTextColor || undefined }"
        >
          {{ buttonText }}
        </span>
        <ArrowRight v-if="isJumpAction" class="w-3.5 h-3.5 opacity-70 shrink-0" :style="{ color: effectiveTextColor || undefined }" />
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- 10. OUTLINE / GLASS: 科技线框按键 (Cyber Outline)                  -->
    <!-- ================================================================= -->
    <div 
      v-else-if="variant === 'glass' || variant === 'outline'"
      class="w-full h-full border flex items-center justify-center px-3 gap-2 backdrop-blur-sm transition-all"
      :class="[
        effectiveBorderColor ? '' : themeClasses.border,
        effectiveBgColor ? '' : themeClasses.outlineBg,
        effectiveTextColor ? '' : themeClasses.outlineText,
        isHovered ? themeClasses.glow : '',
        isPressed ? 'scale-95' : ''
      ]"
      :style="{
        borderRadius: effectiveBorderRadius || '8px',
        backgroundColor: effectiveBgColor || undefined,
        borderColor: effectiveBorderColor || undefined,
        borderWidth: effectiveBorderWidth || undefined,
        color: effectiveTextColor || undefined
      }"
    >
      <span 
        class="w-1.5 h-1.5 rounded-full" 
        :class="effectiveTextColor ? '' : themeClasses.dot"
        :style="{ backgroundColor: effectiveTextColor || undefined }" 
      />
      <span 
        class="font-bold truncate tracking-wider" 
        :style="{ fontSize: dynamicFontSize, color: effectiveTextColor || undefined }"
      >
        {{ buttonText }}
      </span>
      <ArrowRight v-if="isJumpAction" class="w-3.5 h-3.5 opacity-80 shrink-0" :style="{ color: effectiveTextColor || undefined }" />
    </div>

    <!-- ================================================================= -->
    <!-- 11. SOLID: 工业微晶标准按键 (Standard Solid Cyber Button - Default)-->
    <!-- ================================================================= -->
    <div 
      v-else
      class="w-full h-full border flex items-center justify-center px-2 py-0.5 gap-1.5 transition-all shadow-xs leading-none"
      :class="[
        effectiveBgColor ? '' : themeClasses.bg,
        effectiveBorderColor ? '' : themeClasses.border,
        effectiveTextColor ? '' : themeClasses.text,
        isHovered ? themeClasses.glow : '',
        isPressed ? 'scale-95 translate-y-0.5' : ''
      ]"
      :style="{
        borderRadius: effectiveBorderRadius || '6px',
        backgroundColor: effectiveBgColor || undefined,
        borderColor: effectiveBorderColor || undefined,
        borderWidth: effectiveBorderWidth || undefined,
        color: effectiveTextColor || undefined
      }"
    >
      <span 
        class="font-bold truncate tracking-tight leading-none" 
        :style="{ fontSize: dynamicFontSize, color: effectiveTextColor || undefined }"
      >
        {{ buttonText }}
      </span>
      <ArrowRight 
        v-if="isJumpAction" 
        class="w-3 h-3 stroke-[2] shrink-0" 
        :style="{ color: effectiveTextColor || undefined }"
      />
    </div>
  </div>
</template>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
.animate-shake {
  animation: shake 0.4s ease-in-out;
}
</style>
