<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
  previewMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  previewMode: false
});

const now = ref(new Date());
let timerId: any = null;

const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const updateTime = () => {
  now.value = new Date();
};

onMounted(() => {
  updateTime();
  timerId = setInterval(updateTime, 1000);
});

onBeforeUnmount(() => {
  if (timerId) clearInterval(timerId);
});

// Formatted time components
const hours = computed(() => String(now.value.getHours()).padStart(2, '0'));
const minutes = computed(() => String(now.value.getMinutes()).padStart(2, '0'));
const seconds = computed(() => String(now.value.getSeconds()).padStart(2, '0'));
const year = computed(() => now.value.getFullYear());
const month = computed(() => String(now.value.getMonth() + 1).padStart(2, '0'));
const day = computed(() => String(now.value.getDate()).padStart(2, '0'));
const weekDay = computed(() => weekDays[now.value.getDay()]);

const timeString = computed(() => `${hours.value}:${minutes.value}:${seconds.value}`);
const dateString = computed(() => `${year.value}-${month.value}-${day.value} ${weekDay.value}`);

// Analog clock calculations
const secondDeg = computed(() => (now.value.getSeconds() / 60) * 360);
const minuteDeg = computed(() => ((now.value.getMinutes() + now.value.getSeconds() / 60) / 60) * 360);
const hourDeg = computed(() => (((now.value.getHours() % 12) + now.value.getMinutes() / 60) / 12) * 360);

// Style variables
const textColor = computed(() => props.component.style?.textColor || props.component.style?.stroke || '#00f2ff');
const strokeColor = computed(() => props.component.style?.stroke || props.component.style?.textColor || '#00f2ff');
const bgColor = computed(() => props.component.style?.fill || 'transparent');
</script>

<template>
  <!-- 1. Pure SCADA Analog Dial Clock (metric-clock-analog) - Tightly fits 100% bounds & scales smoothly -->
  <div 
    v-if="component.type === 'metric-clock-analog'"
    class="w-full h-full flex items-center justify-center select-none overflow-hidden"
    :style="{ backgroundColor: bgColor }"
  >
    <svg 
      viewBox="0 0 100 100" 
      class="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Outer Rim -->
      <circle cx="50" cy="50" r="48" :fill="bgColor !== 'transparent' ? bgColor : '#040a18'" :stroke="strokeColor" stroke-width="2" />
      <circle cx="50" cy="50" r="44" fill="none" :stroke="strokeColor" stroke-width="0.8" stroke-opacity="0.3" stroke-dasharray="1.5 1.5" />

      <!-- 60 Minute Ticks (Subtle) -->
      <g v-for="i in 60" :key="`min-${i}`" :transform="`rotate(${i * 6} 50 50)`">
        <line 
          v-if="i % 5 !== 0"
          x1="50" y1="4" x2="50" y2="6.5" 
          :stroke="strokeColor" 
          stroke-opacity="0.35"
          stroke-width="0.8" 
        />
      </g>

      <!-- 12 Hour Ticks & Numbers -->
      <g v-for="i in 12" :key="`hr-${i}`" :transform="`rotate(${(i - 1) * 30} 50 50)`">
        <line 
          x1="50" y1="3.5" x2="50" y2="9.5" 
          :stroke="i % 3 === 1 ? '#00f2ff' : strokeColor" 
          :stroke-width="i % 3 === 1 ? 2.2 : 1.2" 
          stroke-linecap="round"
        />
      </g>

      <!-- Hour Hand -->
      <line 
        x1="50" y1="50" x2="50" y2="24" 
        :stroke="strokeColor" 
        stroke-width="3" 
        stroke-linecap="round"
        :transform="`rotate(${hourDeg} 50 50)`"
      />

      <!-- Minute Hand -->
      <line 
        x1="50" y1="50" x2="50" y2="15" 
        stroke="#ffffff" 
        stroke-width="2" 
        stroke-linecap="round"
        :transform="`rotate(${minuteDeg} 50 50)`"
      />

      <!-- Second Hand (Accent Orange/Amber) -->
      <line 
        x1="50" y1="58" x2="50" y2="8" 
        stroke="#ffb703" 
        stroke-width="1.2" 
        stroke-linecap="round"
        :transform="`rotate(${secondDeg} 50 50)`"
      />

      <!-- Center Pin Axis -->
      <circle cx="50" cy="50" r="3.5" fill="#ffb703" stroke="#040a18" stroke-width="1.5" />
    </svg>
  </div>

  <!-- 2. Pure SCADA Digital LED Time Clock (metric-clock) - Scales 100% to bounding box -->
  <div 
    v-else-if="component.type === 'metric-clock'"
    class="w-full h-full flex items-center justify-center select-none overflow-hidden"
    :style="{ backgroundColor: bgColor }"
  >
    <svg 
      viewBox="0 0 170 50" 
      class="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <text 
        x="85" 
        y="37" 
        text-anchor="middle" 
        font-family="monospace" 
        font-weight="900" 
        font-size="40" 
        letter-spacing="2"
        :fill="textColor"
        :style="{ filter: `drop-shadow(0 0 6px ${textColor}80)` }"
      >
        {{ timeString }}
      </text>
    </svg>
  </div>

  <!-- 3. Pure Date & Weekday Display (metric-time-banner) - Scales 100% to bounding box -->
  <div 
    v-else-if="component.type === 'metric-time-banner'"
    class="w-full h-full flex items-center justify-center select-none overflow-hidden"
    :style="{ backgroundColor: bgColor }"
  >
    <svg 
      viewBox="0 0 220 40" 
      class="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <text 
        x="110" 
        y="27" 
        text-anchor="middle" 
        font-family="monospace" 
        font-weight="700" 
        font-size="20" 
        letter-spacing="1"
        :fill="textColor"
        :style="{ filter: `drop-shadow(0 0 4px ${textColor}60)` }"
      >
        {{ dateString }}
      </text>
    </svg>
  </div>

  <!-- 4. Pure SCADA Safe Operation / Runtime Timer (metric-countdown) -->
  <div 
    v-else
    class="w-full h-full flex items-center justify-center select-none overflow-hidden"
    :style="{ backgroundColor: bgColor }"
  >
    <svg 
      viewBox="0 0 220 50" 
      class="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <text 
        x="110" 
        y="36" 
        text-anchor="middle" 
        font-family="monospace" 
        font-weight="900" 
        font-size="32" 
        letter-spacing="2"
        :fill="textColor"
        :style="{ filter: `drop-shadow(0 0 6px ${textColor}80)` }"
      >
        365D {{ timeString }}
      </text>
    </svg>
  </div>
</template>
