<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent } from '../../types';
import { withAlpha } from '../../utils/color';

interface Props {
  component: ScreenComponent;
}

const props = defineProps<Props>();

const borderState = computed(() => {
  const { type, style, customProps, width, height, name } = props.component;
  const color = style.stroke || style.textColor || customProps?.color || '#00f2ff';
  const subColor = style.secondaryColor || customProps?.subColor || withAlpha(color, 0.3);
  const bgColor = style.fill || customProps?.bgColor || 'transparent';
  const title = style.textColor ? (customProps?.title || name) : (customProps?.title || null);
  const borderStyle = customProps?.borderStyle || type;

  return {
    type,
    borderStyle,
    color,
    subColor,
    bgColor,
    title,
    width,
    height
  };
});
</script>

<template>
  <div 
    class="w-full h-full relative select-none pointer-events-none overflow-hidden"
    :style="{ backgroundColor: borderState.bgColor }"
  >
    <!-- 1. STYLE: Neon Cyber Corner (霓虹发光四角标科技框) -->
    <div 
      v-if="borderState.borderStyle === 'deco-border-neon'"
      class="w-full h-full relative"
    >
      <div 
        class="w-full h-full rounded border relative pointer-events-none transition-colors"
        :style="{
          borderColor: withAlpha(borderState.color, 0.5),
          boxShadow: `0 0 12px ${withAlpha(borderState.color, 0.25)}, inset 0 0 10px ${withAlpha(borderState.color, 0.1)}`
        }"
      >
        <!-- 4 High-tech Corner brackets -->
        <div class="absolute -top-[1px] -left-[1px] w-3.5 h-3.5 border-t-2 border-l-2" :style="{ borderColor: borderState.color }" />
        <div class="absolute -top-[1px] -right-[1px] w-3.5 h-3.5 border-t-2 border-r-2" :style="{ borderColor: borderState.color }" />
        <div class="absolute -bottom-[1px] -left-[1px] w-3.5 h-3.5 border-b-2 border-l-2" :style="{ borderColor: borderState.color }" />
        <div class="absolute -bottom-[1px] -right-[1px] w-3.5 h-3.5 border-b-2 border-r-2" :style="{ borderColor: borderState.color }" />
        
        <!-- Center Accent Dots -->
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px]" :style="{ backgroundColor: borderState.color }" />
        <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2px]" :style="{ backgroundColor: borderState.color }" />

        <!-- Optional Title Header -->
        <div 
          v-if="borderState.title"
          class="flex items-center gap-1.5 px-3 py-1 bg-[#060e1c]/90 border-b text-xs font-mono font-bold tracking-wider"
          :style="{ borderColor: withAlpha(borderState.color, 0.3), color: borderState.color }"
        >
          <div class="w-1.5 h-3 rounded-[2px]" :style="{ backgroundColor: borderState.color, boxShadow: `0 0 6px ${borderState.color}` }" />
          <span>{{ borderState.title }}</span>
        </div>
      </div>
    </div>

    <!-- 2. STYLE: Tech Chamfer Armor (科技切角装甲框 - SVG 矢量切角) -->
    <div 
      v-else-if="borderState.borderStyle === 'deco-border-tech'"
      class="w-full h-full relative"
    >
      <svg class="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <!-- Main Chamfer Polygon -->
        <polygon 
          points="0,10 10,0 90,0 100,10 100,90 90,100 10,100 0,90" 
          fill="none" 
          :stroke="borderState.color" 
          stroke-width="1.5" 
          vector-effect="non-scaling-stroke"
          :style="{ filter: `drop-shadow(0 0 6px ${borderState.color})` }"
        />
        <!-- Inner Accent Lines -->
        <line x1="20" y1="0" x2="80" y2="0" :stroke="borderState.color" stroke-width="3" vector-effect="non-scaling-stroke" />
        <line x1="30" y1="100" x2="70" y2="100" :stroke="borderState.color" stroke-width="2" vector-effect="non-scaling-stroke" />
      </svg>
      <div v-if="borderState.title" class="absolute top-2 left-4 text-xs font-mono font-bold" :style="{ color: borderState.color }">
        {{ borderState.title }}
      </div>
    </div>

    <!-- 3. STYLE: Heavy Mech Plate (重装机甲铆钉框) -->
    <div 
      v-else-if="borderState.borderStyle === 'deco-border-mech' || borderState.borderStyle === 'deco-tech-plate'"
      class="w-full h-full relative"
    >
      <div 
        class="w-full h-full rounded-md border-2 relative"
        :style="{ borderColor: withAlpha(borderState.color, 0.6), boxShadow: `0 0 10px ${withAlpha(borderState.color, 0.2)}` }"
      >
        <!-- 4 Rivet Bolts -->
        <div class="absolute top-1.5 left-1.5 w-2 h-2 rounded-full border bg-slate-900" :style="{ borderColor: borderState.color, boxShadow: `0 0 4px ${borderState.color}` }" />
        <div class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border bg-slate-900" :style="{ borderColor: borderState.color, boxShadow: `0 0 4px ${borderState.color}` }" />
        <div class="absolute bottom-1.5 left-1.5 w-2 h-2 rounded-full border bg-slate-900" :style="{ borderColor: borderState.color, boxShadow: `0 0 4px ${borderState.color}` }" />
        <div class="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full border bg-slate-900" :style="{ borderColor: borderState.color, boxShadow: `0 0 4px ${borderState.color}` }" />

        <!-- Title -->
        <div v-if="borderState.title" class="flex items-center gap-1.5 px-3 py-1 bg-[#060e1c]/90 border-b" :style="{ borderColor: withAlpha(borderState.color, 0.3) }">
          <div class="w-2 h-2 rotate-45" :style="{ backgroundColor: borderState.color }" />
          <span class="text-xs font-mono font-bold tracking-wider" :style="{ color: borderState.color }">{{ borderState.title }}</span>
        </div>
      </div>
    </div>

    <!-- 4. STYLE: HUD Double Streamer (双线流光HUD框) -->
    <div 
      v-else-if="borderState.borderStyle === 'deco-border-hud-double'"
      class="w-full h-full p-1"
    >
      <div 
        class="w-full h-full border rounded relative p-1"
        :style="{ borderColor: withAlpha(borderState.color, 0.4) }"
      >
        <div 
          class="w-full h-full border rounded relative"
          :style="{ borderColor: borderState.color, boxShadow: `0 0 8px ${withAlpha(borderState.color, 0.3)}` }"
        >
          <!-- Left & Right Ticks -->
          <div class="absolute left-0 top-1/4 h-6 w-1 -translate-x-[2px]" :style="{ backgroundColor: borderState.color }" />
          <div class="absolute right-0 top-1/4 h-6 w-1 translate-x-[2px]" :style="{ backgroundColor: borderState.color }" />
          <div class="absolute left-0 bottom-1/4 h-6 w-1 -translate-x-[2px]" :style="{ backgroundColor: borderState.color }" />
          <div class="absolute right-0 bottom-1/4 h-6 w-1 translate-x-[2px]" :style="{ backgroundColor: borderState.color }" />
        </div>
      </div>
    </div>

    <!-- 5. STYLE: Cyber Corner Cuts (四角发光斜切微框) -->
    <div 
      v-else-if="borderState.borderStyle === 'deco-border-cyber-corner' || borderState.borderStyle === 'deco-corner-bracket'"
      class="w-full h-full relative"
    >
      <svg class="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <!-- Top Left Corner -->
        <path d="M 0 16 L 0 0 L 16 0" fill="none" :stroke="borderState.color" stroke-width="2.5" vector-effect="non-scaling-stroke" />
        <!-- Top Right Corner -->
        <path d="M 84 0 L 100 0 L 100 16" fill="none" :stroke="borderState.color" stroke-width="2.5" vector-effect="non-scaling-stroke" />
        <!-- Bottom Left Corner -->
        <path d="M 0 84 L 0 100 L 16 100" fill="none" :stroke="borderState.color" stroke-width="2.5" vector-effect="non-scaling-stroke" />
        <!-- Bottom Right Corner -->
        <path d="M 84 100 L 100 100 L 100 84" fill="none" :stroke="borderState.color" stroke-width="2.5" vector-effect="non-scaling-stroke" />
        <!-- Subtle Perimeter Box -->
        <rect x="1" y="1" width="98" height="98" fill="none" :stroke="borderState.color" stroke-width="0.75" stroke-dasharray="3,3" opacity="0.4" vector-effect="non-scaling-stroke" />
      </svg>
    </div>

    <!-- 6. STYLE: Gradient Pulse (渐变律动科技框) -->
    <div 
      v-else-if="borderState.borderStyle === 'deco-border-gradient-pulse'"
      class="w-full h-full relative"
    >
      <div 
        class="w-full h-full rounded-lg border-2 relative"
        :style="{
          borderColor: borderState.color,
          boxShadow: `0 0 16px ${withAlpha(borderState.color, 0.4)}, inset 0 0 14px ${withAlpha(borderState.color, 0.15)}`
        }"
      >
        <!-- Top Glowing Bar -->
        <div 
          class="absolute -top-1 left-4 right-4 h-1.5 rounded-full"
          :style="{
            background: `linear-gradient(90deg, transparent, ${borderState.color}, transparent)`,
            boxShadow: `0 0 8px ${borderState.color}`
          }"
        />
        <!-- Bottom Glowing Bar -->
        <div 
          class="absolute -bottom-1 left-4 right-4 h-1.5 rounded-full"
          :style="{
            background: `linear-gradient(90deg, transparent, ${borderState.color}, transparent)`,
            boxShadow: `0 0 8px ${borderState.color}`
          }"
        />
      </div>
    </div>

    <!-- 7. STYLE: Industrial Hazard Yellow Stripe Border (工业警示斜纹框) -->
    <div 
      v-else-if="borderState.borderStyle === 'deco-border-hazard' || borderState.borderStyle === 'deco-hazard-stripe'"
      class="w-full h-full relative"
    >
      <div 
        class="w-full h-full rounded border-2 relative"
        :style="{ borderColor: borderState.color }"
      >
        <!-- Top hazard line -->
        <div 
          class="h-2.5 w-full border-b"
          :style="{
            borderColor: withAlpha(borderState.color, 0.5),
            backgroundImage: `repeating-linear-gradient(45deg, ${borderState.color}, ${borderState.color} 8px, #0b0f19 8px, #0b0f19 16px)`
          }"
        />
        <!-- Bottom hazard line -->
        <div 
          class="absolute bottom-0 left-0 right-0 h-2.5 border-t"
          :style="{
            borderColor: withAlpha(borderState.color, 0.5),
            backgroundImage: `repeating-linear-gradient(45deg, ${borderState.color}, ${borderState.color} 8px, #0b0f19 8px, #0b0f19 16px)`
          }"
        />
      </div>
    </div>

    <!-- 8. STYLE: Minimal Bracket Caliper (极简对角卡尺定位框) -->
    <div 
      v-else-if="borderState.borderStyle === 'deco-border-bracket'"
      class="w-full h-full relative"
    >
      <div class="absolute top-0 left-0 w-4 h-1" :style="{ backgroundColor: borderState.color }" />
      <div class="absolute top-0 left-0 w-1 h-4" :style="{ backgroundColor: borderState.color }" />
      <div class="absolute top-0 right-0 w-4 h-1" :style="{ backgroundColor: borderState.color }" />
      <div class="absolute top-0 right-0 w-1 h-4" :style="{ backgroundColor: borderState.color }" />
      <div class="absolute bottom-0 left-0 w-4 h-1" :style="{ backgroundColor: borderState.color }" />
      <div class="absolute bottom-0 left-0 w-1 h-4" :style="{ backgroundColor: borderState.color }" />
      <div class="absolute bottom-0 right-0 w-4 h-1" :style="{ backgroundColor: borderState.color }" />
      <div class="absolute bottom-0 right-0 w-1 h-4" :style="{ backgroundColor: borderState.color }" />
      <!-- Faint perimeter -->
      <div class="w-full h-full border" :style="{ borderColor: withAlpha(borderState.color, 0.2) }" />
    </div>

    <!-- 9. STYLE: Dot Matrix Mesh (点阵发光机箱面板) -->
    <div 
      v-else-if="borderState.borderStyle === 'deco-border-matrix-panel'"
      class="w-full h-full relative"
    >
      <div 
        class="w-full h-full rounded border-2 relative"
        :style="{
          borderColor: borderState.color,
          backgroundImage: `radial-gradient(${withAlpha(borderState.color, 0.2)} 1px, transparent 1px)`,
          backgroundSize: '8px 8px'
        }"
      >
        <div class="absolute top-0 left-2 px-2 py-0.5 text-[9px] font-mono font-bold bg-[#030712] rounded-b border-b border-x" :style="{ borderColor: borderState.color, color: borderState.color }">
          SYS_PANEL
        </div>
      </div>
    </div>

    <!-- 10. STYLE: Quantum Levitation Box (量子悬浮边框) -->
    <div 
      v-else-if="borderState.borderStyle === 'deco-border-quantum-box'"
      class="w-full h-full relative flex items-center justify-center p-1"
    >
      <div 
        class="w-full h-full border border-dashed rounded relative"
        :style="{ borderColor: withAlpha(borderState.color, 0.6) }"
      >
        <div class="absolute -top-[3px] left-1/4 w-1/2 h-[3px] rounded-full" :style="{ backgroundColor: borderState.color, boxShadow: `0 0 8px ${borderState.color}` }" />
        <div class="absolute -bottom-[3px] left-1/4 w-1/2 h-[3px] rounded-full" :style="{ backgroundColor: borderState.color, boxShadow: `0 0 8px ${borderState.color}` }" />
      </div>
    </div>

    <!-- 11. STYLE: SCADA Standard Card Frame (SCADA标准工控外框 - Default) -->
    <div 
      v-else
      class="w-full h-full relative"
    >
      <div 
        class="w-full h-full rounded border relative"
        :style="{
          borderColor: withAlpha(borderState.color, 0.5),
          boxShadow: `0 0 8px ${withAlpha(borderState.color, 0.15)}`
        }"
      >
        <!-- Header -->
        <div 
          class="flex items-center justify-between px-2.5 py-1 bg-[#040816]/90 border-b text-xs font-mono font-bold"
          :style="{ borderColor: withAlpha(borderState.color, 0.3), color: borderState.color }"
        >
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: borderState.color, boxShadow: `0 0 4px ${borderState.color}` }"></span>
            <span>{{ borderState.title || 'SCADA 监控单元' }}</span>
          </div>
          <span class="text-[10px] opacity-70">ONLINE</span>
        </div>
      </div>
    </div>
  </div>
</template>
