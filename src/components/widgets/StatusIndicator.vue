<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { resolveTeleSignalState, resolveComponentDynamicData, parseStrictNumber } from '../../utils/scadaResolver';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const style = computed(() => props.component.style || {});
const customProps = computed(() => props.component.customProps || {});
const mapping = computed(() => props.component.data?.mapping || {});

// Dynamic resolved data via unified resolver
const dynamicData = computed(() => resolveComponentDynamicData(props.component, props.datasets));

// Resolve strictly 0 (Green) vs 1 (Red) state
const indicatorState = computed(() => {
  const sKey = mapping.value.statusKey || mapping.value.stateKey || mapping.value.valueKey;
  const dyn = dynamicData.value;
  
  // 1. Resolve raw base state from unified dynamicData, staticData, activeState, customProps, or style
  let rawState: any = 0;
  if (dyn.state !== undefined) {
    rawState = dyn.state;
  } else if (dyn.value !== undefined) {
    rawState = dyn.value;
  } else if (props.component.data?.staticData?.state !== undefined) {
    rawState = props.component.data.staticData.state;
  } else if (props.component.data?.staticData?.value !== undefined) {
    rawState = props.component.data.staticData.value;
  } else if (props.component.activeState !== undefined) {
    rawState = props.component.activeState;
  } else if (customProps.value.state !== undefined) {
    rawState = customProps.value.state;
  } else if (style.value.indicatorState !== undefined) {
    rawState = style.value.indicatorState;
  }

  let effectiveState = 0;

  // 2. If SCADA live telemetry point is bound and not static override
  if (props.component.data?.useStatic !== true && sKey && (dyn.state === undefined && dyn.value === undefined)) {
    const resolved = resolveTeleSignalState(props.datasets, props.component.data?.datasetId, sKey, rawState);
    effectiveState = resolved.numericValue;
  } else {
    // 3. Static or direct JSON injection parsing with strict numeric safety
    if (typeof rawState === 'number') {
      effectiveState = isNaN(rawState) ? 0 : rawState;
    } else if (typeof rawState === 'boolean') {
      effectiveState = rawState ? 1 : 0;
    } else if (typeof rawState === 'string') {
      const lower = rawState.trim().toLowerCase();
      if (lower === '1' || lower.includes('合') || lower.includes('close') || lower.includes('run') || lower === 'on') {
        effectiveState = 1;
      } else if (lower === '0' || lower.includes('分') || lower.includes('open') || lower.includes('stop') || lower === 'off') {
        effectiveState = 0;
      } else if (lower === '2' || lower.includes('障') || lower.includes('fault') || lower.includes('trip') || lower.includes('err') || lower === 'alarm') {
        effectiveState = 2;
      } else if (lower === '3' || lower.includes('试') || lower.includes('test') || lower.includes('offline')) {
        effectiveState = 3;
      } else {
        effectiveState = Math.round(parseStrictNumber(lower, 0));
      }
    }
  }

  // Custom 0-state color (default: #00e676 green) and 1-state color (default: #ff2233 red)
  const color0 = dyn.color0 || customProps.value.color0 || style.value.color0 || props.component.data?.staticData?.color0 || '#00e676';
  const color1 = dyn.color1 || customProps.value.color1 || style.value.color1 || props.component.data?.staticData?.color1 || '#ff2233';
  const color2 = dyn.color2 || customProps.value.color2 || style.value.color2 || '#ffaa00';
  const color3 = dyn.color3 || customProps.value.color3 || style.value.color3 || '#64748b';

  const text0 = dyn.text0 || customProps.value.text0 || props.component.data?.staticData?.text0 || '分闸 0';
  const text1 = dyn.text1 || customProps.value.text1 || props.component.data?.staticData?.text1 || '合闸 1';
  const text2 = dyn.text2 || customProps.value.text2 || '故障 2';

  // 0: Green (分闸/停止/正常0状态), 1: Red (合闸/运行/带电1状态), 2: Yellow/Warning, 3/other: Gray
  let color = color0; // Default 0: Green
  let glow = `${color0}cc`;
  let isBlinking = false;
  let text = text0;

  if (effectiveState === 1) {
    color = color1; // 1: Red (合闸 / 运行)
    glow = `${color1}cc`;
    text = text1;
  } else if (effectiveState === 0) {
    color = color0; // 0: Green (分闸 / 停止)
    glow = `${color0}cc`;
    text = text0;
  } else if (effectiveState === 2) {
    color = color2; // 2: Yellow / Warning
    glow = `${color2}cc`;
    text = text2;
  } else if (effectiveState === 3) {
    color = color3; // 3: Offline / Gray
    glow = 'rgba(100, 116, 139, 0.4)';
    text = '离线 3';
  }

  const blinkSpeed = customProps.value.blink || customProps.value.blinkSpeed || style.value.indicatorBlinkSpeed || 'none';
  if (blinkSpeed === 'auto') {
    isBlinking = effectiveState === 1 || effectiveState === 2;
  } else if (blinkSpeed === 'slow' || blinkSpeed === 'fast') {
    isBlinking = true;
  }

  return {
    numVal: effectiveState,
    color,
    glow,
    blinkSpeed,
    isBlinking,
    text,
    color0,
    color1
  };
});

// Indicator Style Type
const indicatorStyleType = computed(() => customProps.value.indicatorStyle || style.value.indicatorStyle || 'bezel-circle');
</script>

<template>
  <div class="w-full h-full flex items-center justify-center select-none overflow-hidden p-0.5">
    <!-- 1. STYLE: Square Pilot Lamp (工业方型信号指示灯) -->
    <div 
      v-if="indicatorStyleType === 'square-lamp'"
      class="w-full h-full flex items-center justify-center p-0.5"
    >
      <div 
        class="w-full h-full rounded-md border-2 p-1 flex items-center justify-center shadow-lg transition-all"
        :style="{
          borderColor: indicatorState.color,
          backgroundColor: '#030712',
          boxShadow: `0 0 16px ${indicatorState.glow}`
        }"
      >
        <div 
          class="w-full h-full rounded-xs transition-all"
          :style="{
            backgroundColor: indicatorState.color,
            boxShadow: `inset 0 0 8px rgba(255,255,255,0.7), 0 0 12px ${indicatorState.color}`
          }"
          :class="{
            'animate-pulse': indicatorState.blinkSpeed === 'slow',
            'animate-ping': indicatorState.blinkSpeed === 'fast'
          }"
        />
      </div>
    </div>

    <!-- 2. STYLE: Flat Modern High-Brightness LED (现代扁平发光LED) -->
    <div 
      v-else-if="indicatorStyleType === 'flat-led'"
      class="w-full h-full flex items-center justify-center relative p-0.5"
    >
      <div 
        class="aspect-square w-full h-full max-w-full max-h-full rounded-full flex items-center justify-center relative shadow-lg"
        :style="{
          backgroundColor: '#030712',
          border: `2.5px solid ${indicatorState.color}`,
          boxShadow: `0 0 20px ${indicatorState.glow}`
        }"
      >
        <div 
          class="w-3/4 h-3/4 rounded-full transition-all"
          :style="{
            backgroundColor: indicatorState.color,
            boxShadow: `0 0 14px ${indicatorState.color}`
          }"
          :class="{
            'animate-pulse': indicatorState.blinkSpeed === 'slow',
            'animate-ping': indicatorState.blinkSpeed === 'fast'
          }"
        />
      </div>
    </div>

    <!-- 3. STYLE: Capsule / Pill Lamp (胶囊椭圆指示灯) -->
    <div 
      v-else-if="indicatorStyleType === 'pill-tag'"
      class="w-full h-full flex items-center justify-center p-0.5"
    >
      <div 
        class="w-full h-full rounded-full border-2 p-1 flex items-center justify-center shadow-lg transition-all"
        :style="{
          borderColor: indicatorState.color,
          backgroundColor: '#030712',
          boxShadow: `0 0 16px ${indicatorState.glow}`
        }"
      >
        <div 
          class="w-full h-full rounded-full transition-all"
          :style="{
            backgroundColor: indicatorState.color,
            boxShadow: `inset 0 0 6px rgba(255,255,255,0.7), 0 0 12px ${indicatorState.color}`
          }"
          :class="{
            'animate-pulse': indicatorState.blinkSpeed === 'slow',
            'animate-ping': indicatorState.blinkSpeed === 'fast'
          }"
        />
      </div>
    </div>

    <!-- 4. STYLE: Ring Pulse / Radar Ring (科技脉冲光环状态点) -->
    <div 
      v-else-if="indicatorStyleType === 'ring-pulse'"
      class="w-full h-full flex items-center justify-center min-w-0 min-h-0"
    >
      <svg viewBox="0 0 40 40" class="w-full h-full max-w-full max-h-full" preserveAspectRatio="xMidYMid meet">
        <!-- Outer dynamic pulse ring -->
        <circle cx="20" cy="20" r="18" fill="none" :stroke="indicatorState.color" stroke-width="1.2" stroke-dasharray="4,2" opacity="0.6" />
        <circle cx="20" cy="20" r="13" fill="none" :stroke="indicatorState.color" stroke-width="1.8" opacity="0.85" />
        <!-- Core light dot -->
        <circle 
          cx="20" cy="20" r="7" 
          :fill="indicatorState.color" 
          :style="{ filter: `drop-shadow(0 0 6px ${indicatorState.color})` }"
          :class="{
            'animate-pulse': indicatorState.blinkSpeed === 'slow',
            'animate-ping origin-center': indicatorState.blinkSpeed === 'fast'
          }"
        />
        <circle cx="18" cy="18" r="2" fill="#ffffff" opacity="0.8" />
      </svg>
    </div>

    <!-- 5. STYLE: Diamond Interlock (菱形联锁工控状态灯) -->
    <div 
      v-else-if="indicatorStyleType === 'diamond-badge'"
      class="w-full h-full flex items-center justify-center min-w-0 min-h-0"
    >
      <svg viewBox="0 0 40 40" class="w-full h-full max-w-full max-h-full" preserveAspectRatio="xMidYMid meet">
        <polygon points="20,2 38,20 20,38 2,20" fill="#040a18" :stroke="indicatorState.color" stroke-width="2" />
        <polygon 
          points="20,7 33,20 20,33 7,20" 
          :fill="indicatorState.color" 
          :style="{ filter: `drop-shadow(0 0 8px ${indicatorState.color})` }"
          :class="{
            'animate-pulse': indicatorState.blinkSpeed === 'slow',
            'animate-ping origin-center': indicatorState.blinkSpeed === 'fast'
          }"
        />
        <polygon points="20,11 29,20 20,20 11,20" fill="#ffffff" opacity="0.4" />
      </svg>
    </div>

    <!-- 6. STYLE: Hexagon Pilot (蜂巢六角工控指示灯) -->
    <div 
      v-else-if="indicatorStyleType === 'hexagon-pilot'"
      class="w-full h-full flex items-center justify-center min-w-0 min-h-0"
    >
      <svg viewBox="0 0 40 40" class="w-full h-full max-w-full max-h-full" preserveAspectRatio="xMidYMid meet">
        <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="#030712" :stroke="indicatorState.color" stroke-width="2" />
        <polygon 
          points="20,7 31,14 31,26 20,33 9,26 9,14" 
          :fill="indicatorState.color" 
          :style="{ filter: `drop-shadow(0 0 8px ${indicatorState.color})` }"
          :class="{
            'animate-pulse': indicatorState.blinkSpeed === 'slow',
            'animate-ping origin-center': indicatorState.blinkSpeed === 'fast'
          }"
        />
        <polygon points="20,7 31,14 20,20 9,14" fill="#ffffff" opacity="0.35" />
      </svg>
    </div>

    <!-- 7. STYLE: Crosshair Target (配电拓扑准星状态定位点) -->
    <div 
      v-else-if="indicatorStyleType === 'crosshair-target'"
      class="w-full h-full flex items-center justify-center min-w-0 min-h-0"
    >
      <svg viewBox="0 0 40 40" class="w-full h-full max-w-full max-h-full" preserveAspectRatio="xMidYMid meet">
        <!-- Reticle Cross Lines -->
        <line x1="20" y1="2" x2="20" y2="12" :stroke="indicatorState.color" stroke-width="1.5" />
        <line x1="20" y1="28" x2="20" y2="38" :stroke="indicatorState.color" stroke-width="1.5" />
        <line x1="2" y1="20" x2="12" y2="20" :stroke="indicatorState.color" stroke-width="1.5" />
        <line x1="28" y1="20" x2="38" y2="20" :stroke="indicatorState.color" stroke-width="1.5" />
        <circle cx="20" cy="20" r="12" fill="none" :stroke="indicatorState.color" stroke-width="1" stroke-dasharray="2,2" opacity="0.6" />
        <!-- Target Core Dot -->
        <circle 
          cx="20" cy="20" r="5.5" 
          :fill="indicatorState.color" 
          :style="{ filter: `drop-shadow(0 0 7px ${indicatorState.color})` }"
          :class="{
            'animate-pulse': indicatorState.blinkSpeed === 'slow',
            'animate-ping origin-center': indicatorState.blinkSpeed === 'fast'
          }"
        />
      </svg>
    </div>

    <!-- 8. STYLE: Neon Dot (极简微型高发光点 - 适合密布在主接线图) -->
    <div 
      v-else-if="indicatorStyleType === 'neon-dot'"
      class="w-full h-full flex items-center justify-center min-w-0 min-h-0"
    >
      <svg viewBox="0 0 24 24" class="w-full h-full max-w-full max-h-full" preserveAspectRatio="xMidYMid meet">
        <circle 
          cx="12" cy="12" r="7" 
          :fill="indicatorState.color" 
          :style="{ filter: `drop-shadow(0 0 6px ${indicatorState.color}) drop-shadow(0 0 12px ${indicatorState.color})` }"
          :class="{
            'animate-pulse': indicatorState.blinkSpeed === 'slow',
            'animate-ping origin-center': indicatorState.blinkSpeed === 'fast'
          }"
        />
        <circle cx="10.5" cy="10.5" r="2.2" fill="#ffffff" opacity="0.9" />
      </svg>
    </div>

    <!-- 9. STYLE: Status Plate with Code (工牌铭牌状态点) -->
    <div 
      v-else-if="indicatorStyleType === 'status-plate'"
      class="w-full h-full flex items-center justify-center p-0.5"
    >
      <div 
        class="w-full h-full rounded border flex items-center justify-between px-2 py-0.5 shadow-md"
        :style="{
          borderColor: indicatorState.color,
          backgroundColor: '#020617',
          boxShadow: `0 0 10px ${indicatorState.glow}`
        }"
      >
        <div 
          class="w-2.5 h-2.5 rounded-full flex-shrink-0"
          :style="{ backgroundColor: indicatorState.color, boxShadow: `0 0 6px ${indicatorState.color}` }"
          :class="{
            'animate-pulse': indicatorState.blinkSpeed === 'slow',
            'animate-ping': indicatorState.blinkSpeed === 'fast'
          }"
        />
        <span 
          class="font-mono font-bold text-xs"
          :style="{ color: indicatorState.color }"
        >
          {{ indicatorState.text === '1' ? '合闸 1' : (indicatorState.text === '0' ? '分闸 0' : (indicatorState.text === '2' ? '故障 2' : '离线')) }}
        </span>
      </div>
    </div>

    <!-- 10. STYLE: Classic Metallic Bezel Circle Lamp (默认经典金属高光外圈信号灯) -->
    <div 
      v-else
      class="w-full h-full flex items-center justify-center min-w-0 min-h-0"
    >
      <svg 
        viewBox="0 0 40 40" 
        class="w-full h-full max-w-full max-h-full"
        preserveAspectRatio="xMidYMid meet"
        shape-rendering="geometricPrecision"
      >
        <defs>
          <!-- High-Contrast Metallic Outer Bezel -->
          <linearGradient :id="`bezel-${component.id}`" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#e2e8f0" />
            <stop offset="50%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#64748b" />
          </linearGradient>
          <!-- Lamp Core Radial Gradient -->
          <radialGradient :id="`core-${component.id}`" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
            <stop offset="35%" :stop-color="indicatorState.color" />
            <stop offset="100%" :stop-color="indicatorState.color" stop-opacity="0.98" />
          </radialGradient>
        </defs>

        <!-- Outer Bezel Ring -->
        <circle cx="20" cy="20" r="19" :fill="`url(#bezel-${component.id})`" stroke="#94a3b8" stroke-width="0.8" />
        <circle cx="20" cy="20" r="16" fill="#020617" stroke="#38bdf8" stroke-width="0.8" stroke-opacity="0.5" />

        <!-- Glowing Light Core -->
        <circle 
          cx="20" 
          cy="20" 
          r="14" 
          :fill="`url(#core-${component.id})`"
          :style="{
            filter: `drop-shadow(0 0 8px ${indicatorState.color})`
          }"
          :class="{
            'animate-pulse': indicatorState.blinkSpeed === 'slow',
            'animate-ping origin-center': indicatorState.blinkSpeed === 'fast'
          }"
        />

        <!-- Top Gloss Reflection Arc -->
        <ellipse cx="20" cy="11.5" rx="7.5" ry="3.5" fill="#ffffff" fill-opacity="0.5" />
      </svg>
    </div>
  </div>
</template>
