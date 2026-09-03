<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { 
  X, 
  TrendingUp, 
  Calendar, 
  RefreshCw, 
  Download, 
  Activity, 
  Zap, 
  Gauge, 
  Maximize2,
  Clock,
  Layers,
  AlertTriangle,
  ChevronDown
} from 'lucide-vue-next';
import { PRESET_SCADA_DEVICES } from '../data/presetDatasets';
import { ScadaDeviceItem, ScadaTelemetryPoint } from '../types';

interface Props {
  initialDeviceId?: string;
  initialPointId?: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
}>();

const devices = ref<ScadaDeviceItem[]>(PRESET_SCADA_DEVICES);
const selectedDeviceId = ref<string>(props.initialDeviceId || devices.value[0].deviceId);
const selectedDevice = computed(() => {
  return devices.value.find(d => d.deviceId === selectedDeviceId.value) || devices.value[0];
});

// Telemetry Point Selection
const selectedPointId = ref<number>(props.initialPointId || selectedDevice.value.telemetries?.[0]?.pointId || 1);
const selectedPoint = computed(() => {
  return selectedDevice.value.telemetries?.find(p => p.pointId === selectedPointId.value) || selectedDevice.value.telemetries?.[0] || {
    pointId: 1,
    name: 'A相母线电压',
    value: 10.48,
    unit: 'kV',
    min: 9.0,
    max: 11.5
  };
});

// When device changes, fallback point
watch(selectedDeviceId, () => {
  if (selectedDevice.value?.telemetries?.length) {
    if (!selectedDevice.value.telemetries.some(p => p.pointId === selectedPointId.value)) {
      selectedPointId.value = selectedDevice.value.telemetries[0].pointId;
    }
  }
});

// Time Range
const timeRange = ref<'1h' | '6h' | '24h' | '7d'>('24h');

// Simulated historical points
interface HistoryDataPoint {
  time: string;
  timestamp: number;
  value: number;
  quality: string;
}

const historyData = ref<HistoryDataPoint[]>([]);
const isGenerating = ref(false);

const generateHistoryData = () => {
  isGenerating.value = true;
  const baseVal = Number(selectedPoint.value.value) || 10;
  const minVal = Number(selectedPoint.value.min) !== undefined ? Number(selectedPoint.value.min) : baseVal * 0.7;
  const maxVal = Number(selectedPoint.value.max) !== undefined ? Number(selectedPoint.value.max) : baseVal * 1.3;
  const span = maxVal - minVal;

  const now = Date.now();
  let count = 60;
  let intervalMs = 60 * 1000; // 1 min

  if (timeRange.value === '1h') {
    count = 60;
    intervalMs = 60 * 1000;
  } else if (timeRange.value === '6h') {
    count = 72;
    intervalMs = 5 * 60 * 1000;
  } else if (timeRange.value === '24h') {
    count = 96;
    intervalMs = 15 * 60 * 1000;
  } else if (timeRange.value === '7d') {
    count = 168;
    intervalMs = 60 * 60 * 1000;
  }

  const list: HistoryDataPoint[] = [];
  const startTime = now - (count - 1) * intervalMs;

  for (let i = 0; i < count; i++) {
    const t = startTime + i * intervalMs;
    const date = new Date(t);
    const hour = date.getHours() + date.getMinutes() / 60;

    // Daily sinusoidal load peak (morning 9-11, evening 18-21)
    const dailyFactor = Math.sin((hour - 6) * Math.PI / 12) * 0.15;
    const noise = (Math.random() - 0.5) * 0.08;
    let v = baseVal * (1 + dailyFactor + noise);

    // Keep within reasonable bounds
    v = Math.max(minVal * 0.95, Math.min(maxVal * 1.05, v));
    const formattedVal = Math.round(v * 100) / 100;

    const timeStr = timeRange.value === '7d' 
      ? `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:00`
      : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    list.push({
      time: timeStr,
      timestamp: t,
      value: formattedVal,
      quality: 'GOOD (0x00)'
    });
  }

  historyData.value = list;
  setTimeout(() => {
    isGenerating.value = false;
  }, 100);
};

watch([selectedDeviceId, selectedPointId, timeRange], () => {
  generateHistoryData();
}, { immediate: true });

// Statistics
const stats = computed(() => {
  if (!historyData.value.length) return { max: 0, min: 0, avg: 0, count: 0, latest: 0 };
  const values = historyData.value.map(d => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / values.length) * 100) / 100;
  const latest = values[values.length - 1];
  return { max, min, avg, count: values.length, latest };
});

// Chart View Geometry (SVG generation)
const chartWidth = 920;
const chartHeight = 320;
const padding = { top: 30, right: 30, bottom: 40, left: 60 };

const innerWidth = computed(() => chartWidth - padding.left - padding.right);
const innerHeight = computed(() => chartHeight - padding.top - padding.bottom);

const yDomain = computed(() => {
  if (!historyData.value.length) return { min: 0, max: 100 };
  const values = historyData.value.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || max * 0.1 || 5;
  return {
    min: Math.floor((min - pad) * 10) / 10,
    max: Math.ceil((max + pad) * 10) / 10
  };
});

// Point coordinates on SVG
const svgPoints = computed(() => {
  if (!historyData.value.length) return [];
  const { min: yMin, max: yMax } = yDomain.value;
  const ySpan = yMax - yMin || 1;
  const len = historyData.value.length;

  return historyData.value.map((d, index) => {
    const x = padding.left + (index / (len - 1)) * innerWidth.value;
    const yRatio = (d.value - yMin) / ySpan;
    const y = padding.top + (1 - yRatio) * innerHeight.value;
    return { x, y, data: d };
  });
});

// SVG Path string
const polylinePath = computed(() => {
  if (!svgPoints.value.length) return '';
  return svgPoints.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
});

// Gradient Area Path
const areaPath = computed(() => {
  if (!svgPoints.value.length) return '';
  const first = svgPoints.value[0];
  const last = svgPoints.value[svgPoints.value.length - 1];
  const bottomY = padding.top + innerHeight.value;
  return `${polylinePath.value} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
});

// Hover tooltip on chart
const hoverPoint = ref<{ x: number; y: number; data: HistoryDataPoint } | null>(null);

const handleMouseMoveChart = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const clientX = e.clientX - rect.left;
  // find closest point
  let closest: any = null;
  let minDist = 9999;
  svgPoints.value.forEach(p => {
    const dist = Math.abs(p.x - clientX);
    if (dist < minDist) {
      minDist = dist;
      closest = p;
    }
  });
  hoverPoint.value = closest;
};

const handleMouseLeaveChart = () => {
  hoverPoint.value = null;
};

// Export CSV
const exportCsv = () => {
  const headers = ['时间戳', '采集时间', '装置编号', '测点名称', '数值', '单位', '状态品质'];
  const rows = historyData.value.map(d => [
    d.timestamp,
    d.time,
    selectedDevice.value.deviceId,
    selectedPoint.value.name,
    d.value,
    selectedPoint.value.unit || '',
    d.quality
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `SCADA历史曲线_${selectedDevice.value.deviceId}_${selectedPoint.value.name}_${timeRange.value}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
    <div class="bg-[#050b18] border border-cyan-500/40 rounded-2xl w-full max-w-5xl shadow-[0_0_60px_rgba(0,242,255,0.25)] flex flex-col max-h-[92vh] overflow-hidden font-sans">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-slate-950/70">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-400 shadow-inner">
            <TrendingUp class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-base font-bold text-white tracking-wide flex items-center gap-2">
              <span>SCADA 遥测历史趋势曲线调阅</span>
              <span class="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">
                高精度采样
              </span>
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">
              实时调阅电力与工控遥测测点的历史运行工况、负荷峰谷波动与越限趋势分析
            </p>
          </div>
        </div>

        <button
          @click="emit('close')"
          class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Controls & Filter Toolbar -->
      <div class="px-6 py-3.5 bg-[#081126] border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center flex-wrap gap-3">
          <!-- Select Device -->
          <div class="flex items-center gap-2">
            <label class="text-slate-400 font-medium">监测装置:</label>
            <select
              v-model="selectedDeviceId"
              class="bg-slate-900 border border-slate-700 text-cyan-300 font-mono font-bold rounded-lg px-3 py-1.5 focus:border-cyan-400 focus:outline-hidden cursor-pointer"
            >
              <option v-for="dev in devices" :key="dev.deviceId" :value="dev.deviceId">
                [{{ dev.deviceId }}] {{ dev.name }} ({{ dev.type }})
              </option>
            </select>
          </div>

          <!-- Select Telemetry Point -->
          <div class="flex items-center gap-2">
            <label class="text-slate-400 font-medium">遥测测点 (YC):</label>
            <select
              v-model="selectedPointId"
              class="bg-slate-900 border border-slate-700 text-emerald-300 font-mono font-bold rounded-lg px-3 py-1.5 focus:border-cyan-400 focus:outline-hidden cursor-pointer"
            >
              <option v-for="yc in selectedDevice.telemetries || []" :key="yc.pointId" :value="yc.pointId">
                [YC_{{ yc.pointId }}] {{ yc.name }} (当前: {{ yc.value }} {{ yc.unit || '' }})
              </option>
            </select>
          </div>

          <!-- Time Range Selector -->
          <div class="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              v-for="range in (['1h', '6h', '24h', '7d'] as const)"
              :key="range"
              @click="timeRange = range"
              class="px-2.5 py-1 rounded-lg font-mono text-xs transition-colors cursor-pointer"
              :class="timeRange === range 
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-xs' 
                : 'text-slate-400 hover:text-white'"
            >
              {{ range === '1h' ? '1小时' : range === '6h' ? '6小时' : range === '24h' ? '24小时' : '7天' }}
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2">
          <button
            @click="generateHistoryData"
            class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
            title="刷新历史数据"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isGenerating }" />
            <span>刷新</span>
          </button>
          <button
            @click="exportCsv"
            class="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
            title="导出 CSV 历史报表"
          >
            <Download class="w-3.5 h-3.5" />
            <span>导出报表</span>
          </button>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="p-6 overflow-y-auto space-y-5 custom-scrollbar">
        <!-- Stats Summary KPI Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div class="text-[11px] text-slate-400 flex items-center justify-between">
              <span>当前实时测值</span>
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div class="text-xl font-black text-emerald-400 mt-1">
              {{ stats.latest }} <span class="text-xs text-emerald-600 font-normal">{{ selectedPoint.unit || '' }}</span>
            </div>
            <div class="text-[10px] text-slate-500 mt-1">品质: GOOD (0x00) 正常</div>
          </div>

          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div class="text-[11px] text-slate-400 flex items-center justify-between">
              <span>区间最高峰值 (Max)</span>
              <span class="text-[10px] text-rose-400 font-bold">PEAK</span>
            </div>
            <div class="text-xl font-black text-rose-400 mt-1">
              {{ stats.max }} <span class="text-xs text-rose-600 font-normal">{{ selectedPoint.unit || '' }}</span>
            </div>
            <div class="text-[10px] text-slate-500 mt-1">未超出预警上限</div>
          </div>

          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div class="text-[11px] text-slate-400 flex items-center justify-between">
              <span>区间最低谷值 (Min)</span>
              <span class="text-[10px] text-cyan-400 font-bold">VALLEY</span>
            </div>
            <div class="text-xl font-black text-cyan-400 mt-1">
              {{ stats.min }} <span class="text-xs text-cyan-600 font-normal">{{ selectedPoint.unit || '' }}</span>
            </div>
            <div class="text-[10px] text-slate-500 mt-1">运行稳定</div>
          </div>

          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div class="text-[11px] text-slate-400 flex items-center justify-between">
              <span>区间加权平均 (Avg)</span>
              <span class="text-[10px] text-amber-400 font-bold">AVG</span>
            </div>
            <div class="text-xl font-black text-amber-400 mt-1">
              {{ stats.avg }} <span class="text-xs text-amber-600 font-normal">{{ selectedPoint.unit || '' }}</span>
            </div>
            <div class="text-[10px] text-slate-500 mt-1">采样点数: {{ stats.count }} 点</div>
          </div>
        </div>

        <!-- Interactive Vector SCADA Chart Canvas -->
        <div class="bg-[#030712] border border-cyan-500/30 rounded-xl p-4 relative select-none">
          <div class="flex items-center justify-between mb-2 text-xs font-mono text-slate-400">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-sm bg-cyan-400 shadow-[0_0_8px_#00f2ff]" />
              <span class="text-slate-200 font-bold">{{ selectedDevice.name }} · {{ selectedPoint.name }} 历史负荷曲线</span>
            </div>
            <div class="flex items-center gap-4 text-[11px]">
              <span class="flex items-center gap-1"><span class="w-3 h-0.5 bg-cyan-400 inline-block" /> 实时测值</span>
              <span class="flex items-center gap-1"><span class="w-3 h-0.5 bg-amber-500/80 inline-block stroke-dasharray" /> 预警上限</span>
              <span class="flex items-center gap-1"><span class="w-3 h-0.5 bg-rose-500/80 inline-block" /> 报警上限</span>
            </div>
          </div>

          <!-- SVG Chart Container -->
          <div 
            class="relative w-full h-[320px] overflow-hidden cursor-crosshair"
            @mousemove="handleMouseMoveChart"
            @mouseleave="handleMouseLeaveChart"
          >
            <svg
              :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
              class="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <!-- Neon Cyan Area Gradient -->
                <linearGradient id="scadaCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#00f2ff" stop-opacity="0.35" />
                  <stop offset="60%" stop-color="#00f2ff" stop-opacity="0.08" />
                  <stop offset="100%" stop-color="#00f2ff" stop-opacity="0.0" />
                </linearGradient>
              </defs>

              <!-- Grid Horizontal Lines & Y-Labels -->
              <g class="opacity-40">
                <template v-for="i in 5" :key="i">
                  <line
                    :x1="padding.left"
                    :y1="padding.top + (innerHeight / 4) * (i - 1)"
                    :x2="padding.left + innerWidth"
                    :y2="padding.top + (innerHeight / 4) * (i - 1)"
                    stroke="#1e293b"
                    stroke-width="1"
                    stroke-dasharray="4,4"
                  />
                  <text
                    :x="padding.left - 8"
                    :y="padding.top + (innerHeight / 4) * (i - 1) + 4"
                    fill="#64748b"
                    font-size="10"
                    font-family="monospace"
                    text-anchor="end"
                  >
                    {{ (yDomain.max - ((yDomain.max - yDomain.min) / 4) * (i - 1)).toFixed(1) }}
                  </text>
                </template>
              </g>

              <!-- X-Axis Labels -->
              <g class="opacity-70">
                <template v-for="(p, idx) in svgPoints" :key="idx">
                  <text
                    v-if="idx % Math.ceil(svgPoints.length / 7) === 0"
                    :x="p.x"
                    :y="chartHeight - 12"
                    fill="#64748b"
                    font-size="10"
                    font-family="monospace"
                    text-anchor="middle"
                  >
                    {{ p.data.time }}
                  </text>
                </template>
              </g>

              <!-- Gradient Area -->
              <path
                :d="areaPath"
                fill="url(#scadaCurveGrad)"
              />

              <!-- Main Curve Line -->
              <path
                :d="polylinePath"
                fill="none"
                stroke="#00f2ff"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="filter drop-shadow-[0_0_8px_rgba(0,242,255,0.8)]"
              />

              <!-- Threshold Limit Lines (Yellow/Red) -->
              <line
                :x1="padding.left"
                :y1="padding.top + innerHeight * 0.18"
                :x2="padding.left + innerWidth"
                :y2="padding.top + innerHeight * 0.18"
                stroke="#f59e0b"
                stroke-width="1"
                stroke-dasharray="6,4"
                class="opacity-60"
              />
              <line
                :x1="padding.left"
                :y1="padding.top + innerHeight * 0.08"
                :x2="padding.left + innerWidth"
                :y2="padding.top + innerHeight * 0.08"
                stroke="#ef4444"
                stroke-width="1"
                stroke-dasharray="6,4"
                class="opacity-60"
              />

              <!-- Hover Crosshair & Marker -->
              <g v-if="hoverPoint">
                <!-- Vertical Line -->
                <line
                  :x1="hoverPoint.x"
                  :y1="padding.top"
                  :x2="hoverPoint.x"
                  :y2="padding.top + innerHeight"
                  stroke="#38bdf8"
                  stroke-width="1"
                  stroke-dasharray="3,3"
                />
                <!-- Horizontal Line -->
                <line
                  :x1="padding.left"
                  :y1="hoverPoint.y"
                  :x2="padding.left + innerWidth"
                  :y2="hoverPoint.y"
                  stroke="#38bdf8"
                  stroke-width="1"
                  stroke-dasharray="3,3"
                />
                <!-- Outer Pulse Circle -->
                <circle
                  :cx="hoverPoint.x"
                  :cy="hoverPoint.y"
                  r="6"
                  fill="#00f2ff"
                  class="animate-ping opacity-75"
                />
                <!-- Center Marker -->
                <circle
                  :cx="hoverPoint.x"
                  :cy="hoverPoint.y"
                  r="4"
                  fill="#00f2ff"
                  stroke="#020617"
                  stroke-width="2"
                />
              </g>
            </svg>

            <!-- Floating Tooltip Box -->
            <div
              v-if="hoverPoint"
              class="absolute z-20 pointer-events-none bg-[#0a1329]/95 border border-cyan-400 p-2.5 rounded-xl shadow-[0_4px_25px_rgba(0,0,0,0.8)] font-mono text-xs text-white"
              :style="{
                left: `${Math.min(chartWidth - 160, Math.max(20, hoverPoint.x - 80))}px`,
                top: `${Math.max(10, hoverPoint.y - 80)}px`
              }"
            >
              <div class="text-[10px] text-cyan-300 font-bold border-b border-cyan-900/60 pb-1 flex items-center justify-between gap-2">
                <span>{{ hoverPoint.data.time }}</span>
                <span class="text-emerald-400">GOOD</span>
              </div>
              <div class="mt-1.5 flex items-baseline gap-1.5">
                <span class="text-slate-300 text-[11px]">{{ selectedPoint.name }}:</span>
                <span class="text-sm font-black text-cyan-400">{{ hoverPoint.data.value }}</span>
                <span class="text-[10px] text-slate-400">{{ selectedPoint.unit || '' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-3 bg-[#040813] border-t border-cyan-500/20 flex items-center justify-between text-xs text-slate-400 font-mono">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400" />
          <span>通信协议: IEC 60870-5-104 / Modbus TCP 实时采集通道正常</span>
        </div>
        <button
          @click="emit('close')"
          class="px-5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer font-bold"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>
