<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  width: number;
  height: number;
  zoom: number;
  panOffset?: { x: number; y: number };
  cursorPos?: { x: number; y: number };
}

const props = withDefaults(defineProps<Props>(), {
  panOffset: () => ({ x: 0, y: 0 }),
  cursorPos: () => ({ x: 0, y: 0 })
});

// Ruler track thickness (30px wide/high for ample visibility)
const RULER_THICKNESS = 30;

// Step determination for ticks based on zoom level
const tickStep = computed(() => {
  if (props.zoom < 0.15) return 1000;
  if (props.zoom < 0.3) return 500;
  if (props.zoom < 0.6) return 200;
  if (props.zoom < 1.2) return 100;
  if (props.zoom < 2.5) return 50;
  return 20;
});

// Generate horizontal tick marks covering visible workspace
const horizontalTicks = computed(() => {
  const step = tickStep.value;
  const subStep = step / 5;
  const ticks: Array<{ value: number; pos: number; isMajor: boolean }> = [];
  
  const minCanvasX = Math.floor((-props.panOffset.x - 100) / (step * props.zoom)) * step;
  const maxCanvasX = Math.ceil((4000 - props.panOffset.x) / (step * props.zoom)) * step;

  for (let val = minCanvasX; val <= maxCanvasX; val += subStep) {
    const rx = Math.round(val * props.zoom + props.panOffset.x - RULER_THICKNESS);
    if (rx >= -60 && rx <= 3840) {
      const isMajor = Math.abs(val % step) < 0.001 || Math.abs(Math.abs(val % step) - step) < 0.001;
      ticks.push({ value: Math.round(val), pos: rx, isMajor });
    }
  }
  return ticks;
});

// Generate vertical tick marks covering visible workspace
const verticalTicks = computed(() => {
  const step = tickStep.value;
  const subStep = step / 5;
  const ticks: Array<{ value: number; pos: number; isMajor: boolean }> = [];

  const minCanvasY = Math.floor((-props.panOffset.y - 100) / (step * props.zoom)) * step;
  const maxCanvasY = Math.ceil((3000 - props.panOffset.y) / (step * props.zoom)) * step;

  for (let val = minCanvasY; val <= maxCanvasY; val += subStep) {
    const ry = Math.round(val * props.zoom + props.panOffset.y - RULER_THICKNESS);
    if (ry >= -60 && ry <= 3000) {
      const isMajor = Math.abs(val % step) < 0.001 || Math.abs(Math.abs(val % step) - step) < 0.001;
      ticks.push({ value: Math.round(val), pos: ry, isMajor });
    }
  }
  return ticks;
});

// Cursor Guide position on horizontal ruler (px from ruler left edge)
const cursorGuideX = computed(() => {
  return props.cursorPos.x * props.zoom + props.panOffset.x - RULER_THICKNESS;
});

// Cursor Guide position on vertical ruler (px from ruler top edge)
const cursorGuideY = computed(() => {
  return props.cursorPos.y * props.zoom + props.panOffset.y - RULER_THICKNESS;
});

// Active Screen Canvas highlight span on rulers
const canvasBoundsOnRuler = computed(() => {
  const x1 = 0 * props.zoom + props.panOffset.x - RULER_THICKNESS;
  const x2 = props.width * props.zoom + props.panOffset.x - RULER_THICKNESS;
  const y1 = 0 * props.zoom + props.panOffset.y - RULER_THICKNESS;
  const y2 = props.height * props.zoom + props.panOffset.y - RULER_THICKNESS;
  return { x1, x2, y1, y2, w: x2 - x1, h: y2 - y1 };
});
</script>

<template>
  <!-- Top Horizontal Ruler -->
  <div 
    class="absolute top-0 left-[30px] right-0 h-[30px] bg-[#070e1c] border-b border-cyan-400/50 overflow-hidden pointer-events-none select-none z-20 shadow-sm"
  >
    <svg class="w-full h-full">
      <!-- Active Canvas Highlight Band on Ruler -->
      <rect
        :x="canvasBoundsOnRuler.x1"
        y="0"
        :width="Math.max(0, canvasBoundsOnRuler.w)"
        height="30"
        fill="rgba(0, 242, 255, 0.12)"
      />
      <!-- Active Canvas Boundary Lines -->
      <line :x1="canvasBoundsOnRuler.x1" y1="0" :x2="canvasBoundsOnRuler.x1" y2="30" stroke="#00f2ff" stroke-width="2" />
      <line :x1="canvasBoundsOnRuler.x2" y1="0" :x2="canvasBoundsOnRuler.x2" y2="30" stroke="#00f2ff" stroke-width="2" />

      <!-- Horizontal Ticks -->
      <g 
        v-for="(tick, idx) in horizontalTicks" 
        :key="`xtick-${idx}-${tick.value}`"
        :transform="`translate(${tick.pos}, 0)`"
      >
        <line 
          x1="0" 
          :y1="tick.isMajor ? 14 : 22" 
          x2="0" 
          y2="30" 
          :stroke="tick.isMajor ? '#38bdf8' : '#0284c7'" 
          :stroke-width="tick.isMajor ? 1.5 : 1" 
        />
        <text
          v-if="tick.isMajor"
          x="4"
          y="12"
          fill="#38bdf8"
          font-size="9.5"
          font-weight="bold"
          font-family="monospace"
          class="select-none"
        >
          {{ tick.value }}
        </text>
      </g>

      <!-- Realtime Cursor Guide Line on X -->
      <line
        :x1="cursorGuideX"
        y1="0"
        :x2="cursorGuideX"
        y2="30"
        stroke="#facc15"
        stroke-width="2"
      />
    </svg>
  </div>

  <!-- Left Vertical Ruler (Wider track to prevent text truncation) -->
  <div 
    class="absolute top-[30px] left-0 bottom-0 w-[30px] bg-[#070e1c] border-r border-cyan-400/50 overflow-hidden pointer-events-none select-none z-20 shadow-sm"
  >
    <svg class="w-full h-full">
      <!-- Active Canvas Highlight Band on Ruler -->
      <rect
        x="0"
        :y="canvasBoundsOnRuler.y1"
        width="30"
        :height="Math.max(0, canvasBoundsOnRuler.h)"
        fill="rgba(0, 242, 255, 0.12)"
      />
      <!-- Active Canvas Boundary Lines -->
      <line x1="0" :y1="canvasBoundsOnRuler.y1" x2="30" :y2="canvasBoundsOnRuler.y1" stroke="#00f2ff" stroke-width="2" />
      <line x1="0" :y1="canvasBoundsOnRuler.y2" x2="30" :y2="canvasBoundsOnRuler.y2" stroke="#00f2ff" stroke-width="2" />

      <!-- Vertical Ticks -->
      <g 
        v-for="(tick, idx) in verticalTicks" 
        :key="`ytick-${idx}-${tick.value}`"
        :transform="`translate(0, ${tick.pos})`"
      >
        <line 
          :x1="tick.isMajor ? 16 : 22" 
          y1="0" 
          x2="30" 
          y2="0" 
          :stroke="tick.isMajor ? '#38bdf8' : '#0284c7'" 
          :stroke-width="tick.isMajor ? 1.5 : 1" 
        />
        <!-- Shifted rightwards (x=7) so text has comfortable space and is completely unmasked -->
        <text
          v-if="tick.isMajor"
          x="7"
          y="13"
          fill="#38bdf8"
          font-size="9"
          font-weight="bold"
          font-family="monospace"
          class="select-none"
          transform="rotate(-90 7,13)"
        >
          {{ tick.value }}
        </text>
      </g>

      <!-- Realtime Cursor Guide Line on Y -->
      <line
        x1="0"
        :y1="cursorGuideY"
        x2="30"
        :y2="cursorGuideY"
        stroke="#facc15"
        stroke-width="2"
      />
    </svg>
  </div>

  <!-- Top-Left Origin Junction (0, 0) -->
  <div class="absolute top-0 left-0 w-[30px] h-[30px] bg-[#050914] border-r border-b border-cyan-400/60 flex items-center justify-center text-[10px] font-mono text-cyan-300 font-bold z-30 select-none shadow-md">
    px
  </div>
</template>
