<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent } from '../../types';

interface Props {
  component: ScreenComponent;
}

const props = defineProps<Props>();

const width = computed(() => Math.max(4, Math.round(props.component.width || 100)));
const height = computed(() => Math.max(4, Math.round(props.component.height || 100)));
const type = computed(() => props.component.type);
const style = computed(() => props.component.style || {});

const stroke = computed(() => style.value.stroke || '#00f2ff');
const strokeWidth = computed(() => style.value.strokeWidth !== undefined ? style.value.strokeWidth : 2);
const fill = computed(() => style.value.fill || '#00f2ff');
const fillOpacity = computed(() => style.value.fillOpacity !== undefined ? style.value.fillOpacity : 0.2);
const opacity = computed(() => style.value.opacity !== undefined ? style.value.opacity : 1);
const borderRadius = computed(() => style.value.borderRadius || 6);

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

// Helper to compute polygon points for regular N-gon
const getRegularPolygonPoints = (sides: number, w: number, h: number, pad: number) => {
  const cx = w / 2;
  const cy = h / 2;
  const rx = (w - pad * 2) / 2;
  const ry = (h - pad * 2) / 2;
  const pts: string[] = [];
  // Start from top (-PI/2)
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(' ');
};

// Helper to compute N-pointed star points
const getStarPoints = (pointsCount: number, innerRatio: number, w: number, h: number, pad: number) => {
  const cx = w / 2;
  const cy = h / 2;
  const rxOuter = (w - pad * 2) / 2;
  const ryOuter = (h - pad * 2) / 2;
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
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(' ');
};

// SVG Path definitions for special primitives
const paths = computed(() => {
  const w = width.value;
  const h = height.value;
  const pad = Math.max(2, Math.ceil(strokeWidth.value / 2));
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  // Trapezoid (等腰梯形)
  const trapTopMargin = innerW * 0.22;
  const trapezoid = `M ${pad + trapTopMargin} ${pad} L ${w - pad - trapTopMargin} ${pad} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`;

  // Parallelogram (平行四边形)
  const paraSkew = innerW * 0.25;
  const parallelogram = `M ${pad + paraSkew} ${pad} L ${w - pad} ${pad} L ${w - pad - paraSkew} ${h - pad} L ${pad} ${h - pad} Z`;

  // Cross (十字形 / 加号)
  const crossX1 = pad + innerW * 0.33;
  const crossX2 = pad + innerW * 0.67;
  const crossY1 = pad + innerH * 0.33;
  const crossY2 = pad + innerH * 0.67;
  const cross = `M ${crossX1} ${pad} L ${crossX2} ${pad} L ${crossX2} ${crossY1} L ${w - pad} ${crossY1} L ${w - pad} ${crossY2} L ${crossX2} ${crossY2} L ${crossX2} ${h - pad} L ${crossX1} ${h - pad} L ${crossX1} ${crossY2} L ${pad} ${crossY2} L ${pad} ${crossY1} L ${crossX1} ${crossY1} Z`;

  // Heart (心形)
  const heart = `M ${w / 2} ${h - pad - innerH * 0.1} C ${pad} ${h * 0.6} ${pad} ${pad + innerH * 0.2} ${w / 2 - innerW * 0.15} ${pad} C ${w / 2} ${pad} ${w / 2} ${pad + innerH * 0.25} ${w / 2} ${pad + innerH * 0.25} C ${w / 2} ${pad + innerH * 0.25} ${w / 2} ${pad} ${w / 2 + innerW * 0.15} ${pad} C ${w - pad} ${pad + innerH * 0.2} ${w - pad} ${h * 0.6} ${w / 2} ${h - pad - innerH * 0.1} Z`;

  // Speech Bubble (对话气泡)
  const bubbleTailW = Math.min(24, innerW * 0.2);
  const bubbleTailH = Math.min(16, innerH * 0.2);
  const bR = Math.min(borderRadius.value, (innerH - bubbleTailH) / 2);
  const bubble = `M ${pad + bR} ${pad} L ${w - pad - bR} ${pad} Q ${w - pad} ${pad} ${w - pad} ${pad + bR} L ${w - pad} ${h - pad - bubbleTailH - bR} Q ${w - pad} ${h - pad - bubbleTailH} ${w - pad - bR} ${h - pad - bubbleTailH} L ${pad + innerW * 0.4 + bubbleTailW} ${h - pad - bubbleTailH} L ${pad + innerW * 0.3} ${h - pad} L ${pad + innerW * 0.4} ${h - pad - bubbleTailH} L ${pad + bR} ${h - pad - bubbleTailH} Q ${pad} ${h - pad - bubbleTailH} ${pad} ${h - pad - bubbleTailH - bR} L ${pad} ${pad + bR} Q ${pad} ${pad} ${pad + bR} ${pad} Z`;

  // Cube (3D等轴立体箱)
  const cubeTopH = innerH * 0.3;
  const cubeMidX = w / 2;
  const cubeTop = `M ${cubeMidX} ${pad} L ${w - pad} ${pad + cubeTopH * 0.6} L ${cubeMidX} ${pad + cubeTopH * 1.2} L ${pad} ${pad + cubeTopH * 0.6} Z`;
  const cubeLeft = `M ${pad} ${pad + cubeTopH * 0.6} L ${cubeMidX} ${pad + cubeTopH * 1.2} L ${cubeMidX} ${h - pad} L ${pad} ${h - pad - cubeTopH * 0.6} Z`;
  const cubeRight = `M ${cubeMidX} ${pad + cubeTopH * 1.2} L ${w - pad} ${pad + cubeTopH * 0.6} L ${w - pad} ${h - pad - cubeTopH * 0.6} L ${cubeMidX} ${h - pad} Z`;

  // Cylinder (圆柱体 / 储罐几何)
  const cylCapH = Math.min(30, innerH * 0.22);
  const cylTop = `M ${pad} ${pad + cylCapH / 2} A ${innerW / 2} ${cylCapH / 2} 0 1 0 ${w - pad} ${pad + cylCapH / 2} A ${innerW / 2} ${cylCapH / 2} 0 1 0 ${pad} ${pad + cylCapH / 2}`;
  const cylBody = `M ${pad} ${pad + cylCapH / 2} L ${pad} ${h - pad - cylCapH / 2} A ${innerW / 2} ${cylCapH / 2} 0 0 0 ${w - pad} ${h - pad - cylCapH / 2} L ${w - pad} ${pad + cylCapH / 2} Z`;

  // Arc Curve (曲线弧线)
  const arcPath = `M ${pad} ${h - pad} Q ${w / 2} ${pad} ${w - pad} ${h - pad}`;

  // Double Arrow (双向箭头)
  const arrowHead = Math.min(24, innerW * 0.25, innerH * 0.4);
  const arrowStemH = Math.max(4, innerH * 0.3);
  const midY = h / 2;
  const doubleArrow = `M ${pad} ${midY} L ${pad + arrowHead} ${midY - arrowHead} L ${pad + arrowHead} ${midY - arrowStemH / 2} L ${w - pad - arrowHead} ${midY - arrowStemH / 2} L ${w - pad - arrowHead} ${midY - arrowHead} L ${w - pad} ${midY} L ${w - pad - arrowHead} ${midY + arrowHead} L ${w - pad - arrowHead} ${midY + arrowStemH / 2} L ${pad + arrowHead} ${midY + arrowStemH / 2} L ${pad + arrowHead} ${midY + arrowHead} Z`;

  // Single Arrow (单向向右箭头)
  const singleArrow = `M ${pad} ${midY - arrowStemH / 2} L ${w - pad - arrowHead} ${midY - arrowStemH / 2} L ${w - pad - arrowHead} ${midY - arrowHead} L ${w - pad} ${midY} L ${w - pad - arrowHead} ${midY + arrowHead} L ${w - pad - arrowHead} ${midY + arrowStemH / 2} L ${pad} ${midY + arrowStemH / 2} Z`;

  // Sector (扇形 / 90度饼块)
  const sector = `M ${pad} ${h - pad} L ${w - pad} ${h - pad} A ${innerW} ${innerH} 0 0 0 ${pad} ${pad} Z`;

  // Elbow Pipe (直角弯管)
  const elbowThick = Math.min(28, Math.min(innerW, innerH) * 0.35);
  const elbow = `M ${pad} ${pad + elbowThick} L ${w - pad - elbowThick} ${pad + elbowThick} L ${w - pad - elbowThick} ${h - pad} L ${w - pad} ${h - pad} L ${w - pad} ${pad} L ${pad} ${pad} Z`;

  return {
    pad,
    innerW,
    innerH,
    trapezoid,
    parallelogram,
    cross,
    heart,
    bubble,
    cubeTop,
    cubeLeft,
    cubeRight,
    cylTop,
    cylBody,
    arcPath,
    doubleArrow,
    singleArrow,
    sector,
    elbow
  };
});
</script>

<template>
  <div 
    class="w-full h-full relative overflow-hidden select-none flex items-center justify-center pointer-events-none"
    :style="{ opacity }"
  >
    <svg 
      class="w-full h-full overflow-visible"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="none"
    >
      <defs>
        <!-- Dynamic Streamer Laser Glow Filter -->
        <filter id="streamer-glow" x="-20%" y="-20%" width="140%" height="140%">
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

      <!-- 1. Rectangle (矩形) -->
      <rect
        v-if="type === 'draw-rect'"
        :x="paths.pad"
        :y="paths.pad"
        :width="paths.innerW"
        :height="paths.innerH"
        :rx="0"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 2. Rounded Rectangle (圆角矩形) -->
      <rect
        v-else-if="type === 'draw-rounded-rect'"
        :x="paths.pad"
        :y="paths.pad"
        :width="paths.innerW"
        :height="paths.innerH"
        :rx="borderRadius || 10"
        :ry="borderRadius || 10"
        :fill="fill"
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
        :rx="paths.innerW / 2"
        :ry="paths.innerH / 2"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 4. Triangle (向上三角形) -->
      <polygon
        v-else-if="type === 'draw-triangle'"
        :points="`${width / 2},${paths.pad} ${width - paths.pad},${height - paths.pad} ${paths.pad},${height - paths.pad}`"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 5. Triangle Down (倒三角形) -->
      <polygon
        v-else-if="type === 'draw-triangle-down'"
        :points="`${paths.pad},${paths.pad} ${width - paths.pad},${paths.pad} ${width / 2},${height - paths.pad}`"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 6. Triangle Right (向右三角形) -->
      <polygon
        v-else-if="type === 'draw-triangle-right'"
        :points="`${paths.pad},${paths.pad} ${width - paths.pad},${height / 2} ${paths.pad},${height - paths.pad}`"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 7. Diamond (菱形) -->
      <polygon
        v-else-if="type === 'draw-diamond'"
        :points="`${width / 2},${paths.pad} ${width - paths.pad},${height / 2} ${width / 2},${height - paths.pad} ${paths.pad},${height / 2}`"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 8. Pentagon (正五边形) -->
      <polygon
        v-else-if="type === 'draw-pentagon'"
        :points="getRegularPolygonPoints(5, width, height, paths.pad)"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 9. Hexagon (正六边形 / 蜂窝) -->
      <polygon
        v-else-if="type === 'draw-hexagon' || type === 'draw-polygon'"
        :points="getRegularPolygonPoints(6, width, height, paths.pad)"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 10. Octagon (正八边形) -->
      <polygon
        v-else-if="type === 'draw-octagon'"
        :points="getRegularPolygonPoints(8, width, height, paths.pad)"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 11. Five-pointed Star (五角星) -->
      <polygon
        v-else-if="type === 'draw-star'"
        :points="getStarPoints(5, 0.42, width, height, paths.pad)"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 12. Four-pointed Star (四角芒星) -->
      <polygon
        v-else-if="type === 'draw-star4'"
        :points="getStarPoints(4, 0.35, width, height, paths.pad)"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 13. Trapezoid (梯形) -->
      <path
        v-else-if="type === 'draw-trapezoid'"
        :d="paths.trapezoid"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 14. Parallelogram (平行四边形) -->
      <path
        v-else-if="type === 'draw-parallelogram'"
        :d="paths.parallelogram"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 15. Cross (十字形 / 加号) -->
      <path
        v-else-if="type === 'draw-cross'"
        :d="paths.cross"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 16. Ring / Donut (同心圆环) -->
      <g v-else-if="type === 'draw-ring'">
        <ellipse
          :cx="width / 2"
          :cy="height / 2"
          :rx="paths.innerW / 2"
          :ry="paths.innerH / 2"
          fill="none"
          :stroke="stroke"
          :stroke-width="strokeWidth * 1.5"
          :stroke-dasharray="strokeDasharray"
        />
        <ellipse
          :cx="width / 2"
          :cy="height / 2"
          :rx="paths.innerW * 0.32"
          :ry="paths.innerH * 0.32"
          :fill="fill"
          :fill-opacity="fillOpacity"
          :stroke="stroke"
          :stroke-width="strokeWidth"
        />
      </g>

      <!-- 17. Sector (扇形) -->
      <path
        v-else-if="type === 'draw-sector'"
        :d="paths.sector"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 18. Heart (心形) -->
      <path
        v-else-if="type === 'draw-heart'"
        :d="paths.heart"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 19. Speech Bubble (气泡) -->
      <path
        v-else-if="type === 'draw-bubble'"
        :d="paths.bubble"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
      />

      <!-- 20. 3D Cube (等轴立方体) -->
      <g v-else-if="type === 'draw-cube'">
        <path :d="paths.cubeTop" :fill="fill" :fill-opacity="Math.min(1, fillOpacity + 0.25)" :stroke="stroke" :stroke-width="strokeWidth" />
        <path :d="paths.cubeLeft" :fill="fill" :fill-opacity="fillOpacity" :stroke="stroke" :stroke-width="strokeWidth" />
        <path :d="paths.cubeRight" :fill="fill" :fill-opacity="Math.max(0.05, fillOpacity - 0.1)" :stroke="stroke" :stroke-width="strokeWidth" />
      </g>

      <!-- 21. Cylinder (圆柱体) -->
      <g v-else-if="type === 'draw-cylinder'">
        <path :d="paths.cylBody" :fill="fill" :fill-opacity="fillOpacity" :stroke="stroke" :stroke-width="strokeWidth" />
        <path :d="paths.cylTop" :fill="fill" :fill-opacity="Math.min(1, fillOpacity + 0.2)" :stroke="stroke" :stroke-width="strokeWidth" />
      </g>

      <!-- 22. Arc (圆弧) -->
      <path
        v-else-if="type === 'draw-arc'"
        :d="paths.arcPath"
        fill="none"
        :stroke="stroke"
        :stroke-width="strokeWidth"
        :stroke-dasharray="strokeDasharray"
        stroke-linecap="round"
      />

      <!-- 23. Double Arrow (双向箭头) -->
      <path
        v-else-if="type === 'draw-double-arrow'"
        :d="paths.doubleArrow"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
      />

      <!-- 24. Arrow (单向箭头) -->
      <path
        v-else-if="type === 'draw-arrow'"
        :d="paths.singleArrow"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
      />

      <!-- 25. Elbow (直角弯头) -->
      <path
        v-else-if="type === 'draw-elbow'"
        :d="paths.elbow"
        :fill="fill"
        :fill-opacity="fillOpacity"
        :stroke="stroke"
        :stroke-width="strokeWidth"
      />

      <!-- 26. Text Label (矢量文本 / 标牌) -->
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

      <!-- 27. Custom Pen Path / SVG Icon -->
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
        :x1="paths.pad"
        :y1="paths.pad"
        :x2="width - paths.pad"
        :y2="paths.pad"
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
