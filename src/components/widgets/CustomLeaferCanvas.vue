<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent } from '../../types';

interface Props {
  component: ScreenComponent;
}

const props = defineProps<Props>();

const type = computed(() => props.component.type || 'draw-rect');
const width = computed(() => Math.max(4, Math.round(props.component.width || 100)));
const height = computed(() => Math.max(4, Math.round(props.component.height || 100)));
const style = computed(() => props.component.style || {});

const stroke = computed(() => style.value.stroke || '#00f2ff');
const strokeWidth = computed(() => style.value.strokeWidth !== undefined ? style.value.strokeWidth : 2);
const fill = computed(() => style.value.fill || '#00f2ff');
const fillOpacity = computed(() => style.value.fillOpacity !== undefined ? style.value.fillOpacity : 0.2);
const opacity = computed(() => style.value.opacity !== undefined ? style.value.opacity : 1);
const borderRadius = computed(() => style.value.borderRadius ?? 6);

// Dash array mapping
const strokeDasharray = computed(() => {
  if (style.value.lineStyle === 'dashed') return '6 4';
  if (style.value.lineStyle === 'dotted') return '2 3';
  if (style.value.strokeDash && style.value.strokeDash.length > 0) return style.value.strokeDash.join(' ');
  return undefined;
});

// Streamer / Glow effect
const streamerActive = computed(() => Boolean(style.value.streamer?.active));
const streamerColor = computed(() => style.value.streamer?.color || '#00f2ff');
const streamerSpeed = computed(() => `${style.value.streamer?.speed || 2}s`);
const isReverse = computed(() => style.value.streamer?.direction === 'reverse');

// Helper calculations only when non-rectangular vector shape is active
const pad = computed(() => Math.max(1, Math.ceil(strokeWidth.value / 2)));
const innerW = computed(() => Math.max(1, width.value - pad.value * 2));
const innerH = computed(() => Math.max(1, height.value - pad.value * 2));

// Helper to compute polygon points for regular N-gon
const getRegularPolygonPoints = (sides: number) => {
  const w = width.value;
  const h = height.value;
  const p = pad.value;
  const cx = w / 2;
  const cy = h / 2;
  const rx = (w - p * 2) / 2;
  const ry = (h - p * 2) / 2;
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
};

// Helper to compute N-pointed star points
const getStarPoints = (pointsCount: number, innerRatio: number) => {
  const w = width.value;
  const h = height.value;
  const p = pad.value;
  const cx = w / 2;
  const cy = h / 2;
  const rxOuter = (w - p * 2) / 2;
  const ryOuter = (h - p * 2) / 2;
  const rxInner = rxOuter * innerRatio;
  const ryInner = ryOuter * innerRatio;
  const pts: string[] = [];
  const total = pointsCount * 2;
  
  for (let i = 0; i < total; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / pointsCount;
    const isOuter = i % 2 === 0;
    const rx = isOuter ? rxOuter : rxInner;
    const ry = isOuter ? ryOuter : ryInner;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
};

// On-demand path string calculation for specific complex shapes
const shapePath = computed(() => {
  const t = type.value;
  const w = width.value;
  const h = height.value;
  const p = pad.value;
  const iw = innerW.value;
  const ih = innerH.value;

  if (t === 'draw-trapezoid') {
    const trapTopMargin = iw * 0.22;
    return `M ${p + trapTopMargin} ${p} L ${w - p - trapTopMargin} ${p} L ${w - p} ${h - p} L ${p} ${h - p} Z`;
  }
  if (t === 'draw-parallelogram') {
    const paraSkew = iw * 0.25;
    return `M ${p + paraSkew} ${p} L ${w - p} ${p} L ${w - p - paraSkew} ${h - p} L ${p} ${h - p} Z`;
  }
  if (t === 'draw-cross') {
    const x1 = p + iw * 0.33;
    const x2 = p + iw * 0.67;
    const y1 = p + ih * 0.33;
    const y2 = p + ih * 0.67;
    return `M ${x1} ${p} L ${x2} ${p} L ${x2} ${y1} L ${w - p} ${y1} L ${w - p} ${y2} L ${x2} ${y2} L ${x2} ${h - p} L ${x1} ${h - p} L ${x1} ${y2} L ${p} ${y2} L ${p} ${y1} L ${x1} ${y1} Z`;
  }
  if (t === 'draw-heart') {
    return `M ${w / 2} ${h - p - ih * 0.1} C ${p} ${h * 0.6} ${p} ${p + ih * 0.2} ${w / 2 - iw * 0.15} ${p} C ${w / 2} ${p} ${w / 2} ${p + ih * 0.25} ${w / 2} ${p + ih * 0.25} C ${w / 2} ${p + ih * 0.25} ${w / 2} ${p} ${w / 2 + iw * 0.15} ${p} C ${w - p} ${p + ih * 0.2} ${w - p} ${h * 0.6} ${w / 2} ${h - p - ih * 0.1} Z`;
  }
  if (t === 'draw-bubble') {
    const bubbleTailW = Math.min(24, iw * 0.2);
    const bubbleTailH = Math.min(16, ih * 0.2);
    const bR = Math.min(borderRadius.value, (ih - bubbleTailH) / 2);
    return `M ${p + bR} ${p} L ${w - p - bR} ${p} Q ${w - p} ${p} ${w - p} ${p + bR} L ${w - p} ${h - p - bubbleTailH - bR} Q ${w - p} ${h - p - bubbleTailH} ${w - p - bR} ${h - p - bubbleTailH} L ${p + iw * 0.4 + bubbleTailW} ${h - p - bubbleTailH} L ${p + iw * 0.3} ${h - p} L ${p + iw * 0.4} ${h - p - bubbleTailH} L ${p + bR} ${h - p - bubbleTailH} Q ${p} ${h - p - bubbleTailH} ${p} ${h - p - bubbleTailH - bR} L ${p} ${p + bR} Q ${p} ${p} ${p + bR} ${p} Z`;
  }
  if (t === 'draw-sector') {
    return `M ${p} ${h - p} L ${w - p} ${h - p} A ${iw} ${ih} 0 0 0 ${p} ${p} Z`;
  }
  if (t === 'draw-arc') {
    return `M ${p} ${h - p} Q ${w / 2} ${p} ${w - p} ${h - p}`;
  }
  if (t === 'draw-double-arrow') {
    const arrowHead = Math.min(24, iw * 0.25, ih * 0.4);
    const arrowStemH = Math.max(4, ih * 0.3);
    const midY = h / 2;
    return `M ${p} ${midY} L ${p + arrowHead} ${midY - arrowHead} L ${p + arrowHead} ${midY - arrowStemH / 2} L ${w - p - arrowHead} ${midY - arrowStemH / 2} L ${w - p - arrowHead} ${midY - arrowHead} L ${w - p} ${midY} L ${w - p - arrowHead} ${midY + arrowHead} L ${w - p - arrowHead} ${midY + arrowStemH / 2} L ${p + arrowHead} ${midY + arrowStemH / 2} L ${p + arrowHead} ${midY + arrowHead} Z`;
  }
  if (t === 'draw-arrow') {
    const arrowHead = Math.min(24, iw * 0.25, ih * 0.4);
    const arrowStemH = Math.max(4, ih * 0.3);
    const midY = h / 2;
    return `M ${p} ${midY - arrowStemH / 2} L ${w - p - arrowHead} ${midY - arrowStemH / 2} L ${w - p - arrowHead} ${midY - arrowHead} L ${w - p} ${midY} L ${w - p - arrowHead} ${midY + arrowHead} L ${w - p - arrowHead} ${midY + arrowStemH / 2} L ${p} ${midY + arrowStemH / 2} Z`;
  }
  if (t === 'draw-elbow') {
    const elbowThick = Math.min(28, Math.min(iw, ih) * 0.35);
    return `M ${p} ${p + elbowThick} L ${w - p - elbowThick} ${p + elbowThick} L ${w - p - elbowThick} ${h - p} L ${w - p} ${h - p} L ${w - p} ${p} L ${p} ${p} Z`;
  }
  return '';
});

// Cube 3D Paths
const cubePaths = computed(() => {
  if (type.value !== 'draw-cube') return null;
  const w = width.value;
  const h = height.value;
  const p = pad.value;
  const ih = innerH.value;
  const cubeTopH = ih * 0.3;
  const cubeMidX = w / 2;
  return {
    top: `M ${cubeMidX} ${p} L ${w - p} ${p + cubeTopH * 0.6} L ${cubeMidX} ${p + cubeTopH * 1.2} L ${p} ${p + cubeTopH * 0.6} Z`,
    left: `M ${p} ${p + cubeTopH * 0.6} L ${cubeMidX} ${p + cubeTopH * 1.2} L ${cubeMidX} ${h - p} L ${p} ${h - p - cubeTopH * 0.6} Z`,
    right: `M ${cubeMidX} ${p + cubeTopH * 1.2} L ${w - p} ${p + cubeTopH * 0.6} L ${w - p} ${h - p - cubeTopH * 0.6} L ${cubeMidX} ${h - p} Z`
  };
});

// Cylinder 3D Paths
const cylPaths = computed(() => {
  if (type.value !== 'draw-cylinder') return null;
  const w = width.value;
  const h = height.value;
  const p = pad.value;
  const iw = innerW.value;
  const ih = innerH.value;
  const cylCapH = Math.min(30, ih * 0.22);
  return {
    top: `M ${p} ${p + cylCapH / 2} A ${iw / 2} ${cylCapH / 2} 0 1 0 ${w - p} ${p + cylCapH / 2} A ${iw / 2} ${cylCapH / 2} 0 1 0 ${p} ${p + cylCapH / 2}`,
    body: `M ${p} ${p + cylCapH / 2} L ${p} ${h - p - cylCapH / 2} A ${iw / 2} ${cylCapH / 2} 0 0 0 ${w - p} ${h - p - cylCapH / 2} L ${w - p} ${p + cylCapH / 2} Z`
  };
});
</script>

<template>
  <div 
    class="w-full h-full relative overflow-hidden select-none flex items-center justify-center pointer-events-none transform-gpu"
    :style="{ 
      opacity,
      contain: 'strict',
      contentVisibility: 'auto'
    }"
  >
    <!-- 1. FAST PATH: Standard Rectangle (Zero SVG Overhead, Pure Hardware-Accelerated CSS Box) -->
    <div
      v-if="type === 'draw-rect' && !streamerActive && !style.gradient"
      class="w-full h-full box-border"
      :style="{
        backgroundColor: fill && fill !== 'transparent' ? fill : 'transparent',
        opacity: fill && fill !== 'transparent' ? fillOpacity : 1,
        borderStyle: strokeWidth > 0 && stroke && stroke !== 'transparent' ? (style.lineStyle || 'solid') : 'none',
        borderColor: stroke || 'transparent',
        borderWidth: `${strokeWidth}px`,
        borderRadius: '0px',
        boxSizing: 'border-box'
      }"
    />

    <!-- 2. FAST PATH: Rounded Rectangle (Zero SVG Overhead, Pure Hardware-Accelerated CSS Box) -->
    <div
      v-else-if="type === 'draw-rounded-rect' && !streamerActive && !style.gradient"
      class="w-full h-full box-border"
      :style="{
        backgroundColor: fill && fill !== 'transparent' ? fill : 'transparent',
        opacity: fill && fill !== 'transparent' ? fillOpacity : 1,
        borderStyle: strokeWidth > 0 && stroke && stroke !== 'transparent' ? (style.lineStyle || 'solid') : 'none',
        borderColor: stroke || 'transparent',
        borderWidth: `${strokeWidth}px`,
        borderRadius: `${borderRadius || 8}px`,
        boxSizing: 'border-box'
      }"
    />

    <!-- 3. VECTOR PATHS (SVG On-Demand Rendering) -->
    <svg 
      v-else
      class="w-full h-full overflow-visible"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="none"
    >
      <defs v-if="streamerActive || style.gradient">
        <!-- Dynamic Streamer Laser Glow Filter -->
        <filter v-if="streamerActive" id="streamer-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <!-- Linear gradient if enabled -->
        <linearGradient 
          v-if="style.gradient" 
          id="custom-gradient" 
          :x1="style.gradient.type === 'linear' ? '0%' : '50%'" 
          :y1="style.gradient.type === 'linear' ? '0%' : '50%'" 
          :x2="style.gradient.type === 'linear' ? '100%' : '100%'" 
          :y2="style.gradient.type === 'linear' ? '100%' : '100%'"
        >
          <stop 
            v-for="(gColor, idx) in style.gradient.colors" 
            :key="idx" 
            :offset="`${(idx / (style.gradient.colors.length - 1)) * 100}%`" 
            :stop-color="gColor" 
          />
        </linearGradient>
      </defs>

      <!-- 1. Rectangle (Fallback for streamer or gradient) -->
      <rect
        v-if="type === 'draw-rect'"
        :x="pad"
        :y="pad"
        :width="innerW"
        :height="innerH"
        :rx="0"
        :fill="style.gradient ? 'url(#custom-gradient)' : fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 2. Rounded Rectangle (Fallback for streamer or gradient) -->
      <rect
        v-else-if="type === 'draw-rounded-rect'"
        :x="pad"
        :y="pad"
        :width="innerW"
        :height="innerH"
        :rx="borderRadius || 10"
        :ry="borderRadius || 10"
        :fill="style.gradient ? 'url(#custom-gradient)' : fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 3. Circle (正圆 / 椭圆) -->
      <ellipse
        v-else-if="type === 'draw-circle' || type === 'draw-ellipse'"
        :cx="width / 2"
        :cy="height / 2"
        :rx="innerW / 2"
        :ry="innerH / 2"
        :fill="style.gradient ? 'url(#custom-gradient)' : fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 4. Triangle (向上三角形) -->
      <polygon
        v-else-if="type === 'draw-triangle'"
        :points="`${width / 2},${pad} ${width - pad},${height - pad} ${pad},${height - pad}`"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 5. Triangle Down (倒三角形) -->
      <polygon
        v-else-if="type === 'draw-triangle-down'"
        :points="`${pad},${pad} ${width - pad},${pad} ${width / 2},${height - pad}`"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 6. Triangle Right (向右三角形) -->
      <polygon
        v-else-if="type === 'draw-triangle-right'"
        :points="`${pad},${pad} ${width - pad},${height / 2} ${pad},${height - pad}`"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 7. Diamond (菱形) -->
      <polygon
        v-else-if="type === 'draw-diamond'"
        :points="`${width / 2},${pad} ${width - pad},${height / 2} ${width / 2},${height - pad} ${pad},${height / 2}`"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 8. Pentagon (正五边形) -->
      <polygon
        v-else-if="type === 'draw-pentagon'"
        :points="getRegularPolygonPoints(5)"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 9. Hexagon (正六边形 / 蜂窝) -->
      <polygon
        v-else-if="type === 'draw-hexagon' || type === 'draw-polygon'"
        :points="getRegularPolygonPoints(6)"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 10. Octagon (正八边形) -->
      <polygon
        v-else-if="type === 'draw-octagon'"
        :points="getRegularPolygonPoints(8)"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 11. Five-pointed Star (五角星) -->
      <polygon
        v-else-if="type === 'draw-star'"
        :points="getStarPoints(5, 0.42)"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 12. Four-pointed Star (四角芒星) -->
      <polygon
        v-else-if="type === 'draw-star4'"
        :points="getStarPoints(4, 0.35)"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 13. Ring / Donut (同心圆环) -->
      <g v-else-if="type === 'draw-ring'">
        <ellipse
          :cx="width / 2"
          :cy="height / 2"
          :rx="innerW / 2"
          :ry="innerH / 2"
          fill="none"
          :stroke="stroke"
          :stroke-width="strokeWidth * 1.5"
          :stroke-dasharray="strokeDasharray"
        />
        <ellipse
          :cx="width / 2"
          :cy="height / 2"
          :rx="innerW * 0.32"
          :ry="innerH * 0.32"
          :fill="fill"
          :fill-opacity="fillOpacity"
          :stroke="stroke"
          :stroke-width="strokeWidth"
        />
      </g>

      <!-- 14. 3D Cube (等轴立方体) -->
      <g v-else-if="type === 'draw-cube' && cubePaths">
        <path :d="cubePaths.top" :fill="fill" :fill-opacity="Math.min(1, fillOpacity + 0.25)" :stroke="stroke" :stroke-width="strokeWidth" />
        <path :d="cubePaths.left" :fill="fill" :fill-opacity="fillOpacity" :stroke="stroke" :stroke-width="strokeWidth" />
        <path :d="cubePaths.right" :fill="fill" :fill-opacity="Math.max(0.05, fillOpacity - 0.1)" :stroke="stroke" :stroke-width="strokeWidth" />
      </g>

      <!-- 15. Cylinder (圆柱体) -->
      <g v-else-if="type === 'draw-cylinder' && cylPaths">
        <path :d="cylPaths.body" :fill="fill" :fill-opacity="fillOpacity" :stroke="stroke" :stroke-width="strokeWidth" />
        <path :d="cylPaths.top" :fill="fill" :fill-opacity="Math.min(1, fillOpacity + 0.2)" :stroke="stroke" :stroke-width="strokeWidth" />
      </g>

      <!-- 16. Text Label (矢量文本 / 标牌) -->
      <text
        v-else-if="type === 'draw-text'"
        :x="width / 2"
        :y="height / 2"
        dominant-baseline="central"
        text-anchor="middle"
        :fill="style.textColor || style.stroke || fill"
        :font-size="style.fontSize || Math.max(12, Math.round(height * 0.6))"
        :font-weight="style.fontWeight || 'bold'"
        :font-family="style.fontFamily || 'monospace'"
        :letter-spacing="style.letterSpacing || 1"
      >
        {{ style.text || component.name || '文本标签' }}
      </text>

      <!-- 17. Generic Calculated SVG Shape Path -->
      <path
        v-else-if="shapePath"
        :d="shapePath"
        :fill="type === 'draw-arc' ? 'none' : fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
        :stroke-linecap="type === 'draw-arc' ? 'round' : 'butt'"
      />

      <!-- 18. Custom Pen Path / SVG Icon -->
      <path
        v-else
        :d="style.customSvgPath || `M 10 10 L ${width - 10} 10 L ${width - 10} ${height - 10} L 10 ${height - 10} Z`"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- Streamer Laser Highlight Overlay -->
      <line
        v-if="streamerActive"
        :x1="pad"
        :y1="pad"
        :x2="width - pad"
        :y2="pad"
        :stroke="streamerColor"
        :stroke-width="strokeWidth + 2"
        stroke-linecap="round"
        filter="url(#streamer-glow)"
        class="streamer-glow-line"
        :style="{
          animationDuration: streamerSpeed,
          animationDirection: isReverse ? 'reverse' : 'normal'
        }"
      />
    </svg>
  </div>
</template>

<style scoped>
@keyframes streamerDash {
  0% {
    stroke-dashoffset: 200;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

.streamer-glow-line {
  stroke-dasharray: 40 160;
  animation: streamerDash 2s linear infinite;
}
</style>
