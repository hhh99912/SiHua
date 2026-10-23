<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  LineChart,
  Search,
  RefreshCw,
  Download,
  Calendar,
  Layers,
  Clock,
  Filter,
  Check,
  X,
  Maximize2,
  ChevronDown,
  RotateCcw
} from 'lucide-vue-next';

interface Props {
  visible?: boolean;
  isEmbedded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
  isEmbedded: true
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

// 快捷时间范围
const timePresets = [
  { id: '1h', label: '近1小时' },
  { id: '6h', label: '近6小时' },
  { id: '12h', label: '近12小时' },
  { id: 'today', label: '今天' },
  { id: '3d', label: '近3天' },
  { id: '7d', label: '近7天' }
];

const selectedPreset = ref('today');
const startDate = ref('2026-10-23 00:00:00');
const endDate = ref('2026-10-23 23:59:59');
const sampleRate = ref('1m'); // 1s, 5s, 1m, 5m, 15m

// 常用曲线通道
interface ChannelItem {
  id: string;
  name: string;
  color: string;
  unit: string;
  enabled: boolean;
  curVal: number;
  maxVal: number;
  minVal: number;
  avgVal: number;
}

const channels = ref<ChannelItem[]>([
  { id: 'YC-01', name: '35kV I段母线线电压 Uab', color: '#0284c7', unit: 'kV', enabled: true, curVal: 36.4, maxVal: 37.1, minVal: 35.8, avgVal: 36.3 },
  { id: 'YC-02', name: '35kV I段母线总有功功率 P', color: '#16a34a', unit: 'MW', enabled: true, curVal: 142.1, maxVal: 156.4, minVal: 0.0, avgVal: 88.5 },
  { id: 'YC-03', name: '35kV I段母线总无功功率 Q', color: '#ea580c', unit: 'Mvar', enabled: false, curVal: 12.8, maxVal: 18.2, minVal: 4.1, avgVal: 10.2 },
  { id: 'YC-04', name: '#1主变高压侧A相电流 Ia', color: '#8b5cf6', unit: 'A', enabled: true, curVal: 248.5, maxVal: 285.0, minVal: 0.0, avgVal: 165.2 },
  { id: 'YC-05', name: '速利达站环境辐照强度 GHI', color: '#eab308', unit: 'W/m²', enabled: false, curVal: 785.0, maxVal: 980.0, minVal: 0.0, avgVal: 412.0 }
]);

const isQuerying = ref(false);
const hasQueried = ref(true);

const handleQuery = () => {
  isQuerying.value = true;
  setTimeout(() => {
    isQuerying.value = false;
    hasQueried.value = true;
  }, 400);
};

const handleReset = () => {
  channels.value.forEach((ch, idx) => {
    ch.enabled = idx < 2;
  });
};

const toggleChannel = (ch: ChannelItem) => {
  ch.enabled = !ch.enabled;
};

// 底部标签分类 (对齐全站告警风格)
const viewTabs = ['实时多轴曲线', '采样数据明细', '极值与合格率分析', '通道关联配置'];
const activeTab = ref('实时多轴曲线');
</script>

<template>
  <div 
    v-if="visible"
    :class="[
      isEmbedded 
        ? 'w-full h-full bg-white text-slate-800 flex flex-col font-sans select-none overflow-hidden text-sm'
        : 'fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex flex-col select-none p-1 md:p-2'
    ]"
  >
    <div 
      class="w-full h-full bg-white text-slate-800 flex flex-col font-sans select-none overflow-hidden text-sm"
      :class="{ 'rounded-lg shadow-2xl border border-slate-300': !isEmbedded }"
    >
      <!-- 非嵌入模式下的顶部标题栏 -->
      <div 
        v-if="!isEmbedded"
        class="h-11 bg-slate-100 border-b border-slate-300 px-4 flex items-center justify-between shrink-0 select-none"
      >
        <div class="flex items-center gap-2.5 font-bold text-slate-800 text-base">
          <LineChart class="w-5 h-5 text-indigo-600" />
          <span>历史曲线中心 (遥测时序多轴趋势分析)</span>
        </div>
        <button
          @click="emit('close')"
          class="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          title="关闭窗口"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- ===================================================================== -->
      <!-- 1. 顶部操作工具栏 (仿全站告警 RealtimeAlarmModal 样式)                   -->
      <!-- ===================================================================== -->
      <div class="h-11 bg-slate-50 border-b border-slate-300 px-3 flex items-center justify-between shrink-0 select-none overflow-x-auto gap-3">
        <!-- 左侧：快捷范围与时间设置 -->
        <div class="flex items-center gap-1.5 shrink-0">
          <!-- 快捷预设 -->
          <div class="flex items-center bg-white border border-slate-300 rounded p-0.5">
            <button
              v-for="p in timePresets"
              :key="p.id"
              @click="selectedPreset = p.id"
              class="px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer"
              :class="selectedPreset === p.id ? 'bg-sky-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'"
            >
              {{ p.label }}
            </button>
          </div>

          <div class="h-5 w-[1px] bg-slate-300 mx-1" />

          <!-- 起止时间输入 -->
          <div class="flex items-center gap-1 text-xs text-slate-700 bg-white border border-slate-300 rounded px-2 py-1">
            <Calendar class="w-3.5 h-3.5 text-slate-400" />
            <input 
              v-model="startDate" 
              class="w-34 font-mono focus:outline-none text-slate-800" 
              placeholder="开始时间"
            />
            <span class="text-slate-400">至</span>
            <input 
              v-model="endDate" 
              class="w-34 font-mono focus:outline-none text-slate-800" 
              placeholder="结束时间"
            />
          </div>

          <!-- 采样周期 -->
          <select 
            v-model="sampleRate" 
            class="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="1s">1秒 (高精)</option>
            <option value="5s">5秒</option>
            <option value="1m">1分钟</option>
            <option value="5m">5分钟</option>
            <option value="15m">15分钟</option>
          </select>
        </div>

        <!-- 右侧：执行查询、刷新、重置、导出 -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            @click="handleQuery"
            class="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            :disabled="isQuerying"
            title="执行查询历史数据"
          >
            <Search class="w-4 h-4" :class="{ 'animate-spin': isQuerying }" />
            <span>{{ isQuerying ? '查询中...' : '查询曲线' }}</span>
          </button>

          <button
            @click="handleQuery"
            class="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="刷新当前曲线"
          >
            <RefreshCw class="w-4 h-4 text-slate-500" />
            <span>刷新</span>
          </button>

          <button
            @click="handleReset"
            class="px-2.5 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1"
            title="重置通道选择"
          >
            <RotateCcw class="w-3.5 h-3.5 text-slate-500" />
            <span>重置</span>
          </button>

          <button
            class="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="导出曲线采样点至 CSV / EXCEL"
          >
            <Download class="w-4 h-4 text-slate-500" />
            <span>导出</span>
          </button>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- 2. 主体内容区 (左侧通道列表 + 右侧多轴曲线画布)                           -->
      <!-- ===================================================================== -->
      <div class="flex-1 flex overflow-hidden min-h-0 bg-slate-100/50">
        <!-- 左侧：曲线通道选择列表 -->
        <div class="w-68 bg-white border-r border-slate-300 flex flex-col shrink-0">
          <div class="h-9 px-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
            <span class="flex items-center gap-1.5">
              <Layers class="w-3.5 h-3.5 text-sky-600" />
              <span>显示通道 ({{ channels.filter(c => c.enabled).length }}/{{ channels.length }})</span>
            </span>
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
            <div
              v-for="ch in channels"
              :key="ch.id"
              @click="toggleChannel(ch)"
              class="p-2.5 rounded border transition-all cursor-pointer flex flex-col gap-1 text-xs"
              :class="ch.enabled ? 'bg-sky-50/60 border-sky-300 shadow-2xs' : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'"
            >
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-2 font-bold text-slate-800 truncate">
                  <span class="w-3 h-3 rounded-sm shrink-0" :style="{ backgroundColor: ch.color }"></span>
                  <span class="truncate">{{ ch.name }}</span>
                </span>
                <span 
                  class="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                  :class="ch.enabled ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-300 bg-white'"
                >
                  <Check v-if="ch.enabled" class="w-3 h-3 stroke-[3]" />
                </span>
              </div>

              <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-0.5">
                <span>实时: <strong class="text-slate-900">{{ ch.curVal }}</strong> {{ ch.unit }}</span>
                <span>均值: {{ ch.avgVal }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：曲线趋势图主视图 (SCADA 工业坐标轴与趋势模拟) -->
        <div class="flex-1 flex flex-col overflow-hidden bg-slate-950 p-3">
          <!-- 坐标系顶部图例 -->
          <div class="h-7 flex items-center justify-between px-2 text-xs text-slate-400 font-mono select-none">
            <div class="flex items-center gap-4">
              <div 
                v-for="ch in channels.filter(c => c.enabled)" 
                :key="ch.id" 
                class="flex items-center gap-1.5"
              >
                <div class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: ch.color }"></div>
                <span class="text-slate-300">{{ ch.name }}:</span>
                <span class="font-bold text-white">{{ ch.curVal }} {{ ch.unit }}</span>
              </div>
            </div>
            <span class="text-slate-500">网格采样步长: 1m | 坐标系: 标准工业多轴</span>
          </div>

          <!-- 模拟图表画布容器 -->
          <div class="flex-1 relative border border-slate-800 bg-[#070d19] rounded overflow-hidden flex flex-col justify-between p-4">
            <!-- 纵向水平网格刻度线 -->
            <div class="absolute inset-0 flex flex-col justify-between pointer-events-none p-4 opacity-25">
              <div v-for="i in 6" :key="i" class="w-full border-b border-dashed border-sky-400/30"></div>
            </div>
            <div class="absolute inset-0 flex justify-between pointer-events-none p-4 opacity-20">
              <div v-for="i in 12" :key="i" class="h-full border-r border-dashed border-sky-400/30"></div>
            </div>

            <!-- SVG 动态趋势曲线渲染 -->
            <svg class="w-full h-full relative z-10" preserveAspectRatio="none" viewBox="0 0 1000 400">
              <!-- 通道 1 曲线 (Uab 电压 - 稳态平缓) -->
              <path
                d="M 0,160 Q 150,155 300,165 T 600,158 T 900,162 L 1000,160"
                fill="none"
                stroke="#0284c7"
                stroke-width="2.5"
                stroke-linecap="round"
              />
              <!-- 通道 2 曲线 (有功功率 P - 典型光伏日照驼峰) -->
              <path
                d="M 0,380 Q 200,380 350,220 T 550,60 T 750,240 T 900,375 L 1000,380"
                fill="none"
                stroke="#16a34a"
                stroke-width="3"
                stroke-linecap="round"
              />
              <!-- 光伏功率半透明填充渐变 -->
              <path
                d="M 0,380 Q 200,380 350,220 T 550,60 T 750,240 T 900,375 L 1000,380 L 1000,395 L 0,395 Z"
                fill="rgba(22, 163, 74, 0.12)"
              />
              <!-- 通道 4 曲线 (电流 Ia - 随功率波动) -->
              <path
                d="M 0,370 Q 220,360 360,240 T 560,95 T 760,260 T 920,368 L 1000,370"
                fill="none"
                stroke="#8b5cf6"
                stroke-width="2"
                stroke-dasharray="4 2"
                stroke-linecap="round"
              />
            </svg>

            <!-- 底部横轴时间刻度 -->
            <div class="relative z-10 flex justify-between text-[11px] font-mono text-slate-400 border-t border-slate-700/60 pt-1">
              <span>00:00</span>
              <span>03:00</span>
              <span>06:00</span>
              <span>09:00</span>
              <span>12:00</span>
              <span>15:00</span>
              <span>18:00</span>
              <span>21:00</span>
              <span>24:00</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- 3. 底部各分类标签 (仿照 RealtimeAlarmModal 样式)                         -->
      <!-- ===================================================================== -->
      <div class="h-9 bg-slate-100 border-t border-slate-300 px-2 flex items-center justify-between shrink-0 select-none text-xs">
        <div class="flex items-center gap-1 overflow-x-auto">
          <button
            v-for="tab in viewTabs"
            :key="tab"
            @click="activeTab = tab"
            class="px-3 py-1 rounded font-bold transition-colors cursor-pointer text-xs"
            :class="activeTab === tab ? 'bg-sky-700 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'"
          >
            {{ tab }}
          </button>
        </div>

        <div class="flex items-center gap-4 text-slate-600 font-mono text-xs pr-2">
          <span>采样点总数: <strong class="text-slate-800">1,440</strong></span>
          <span>查询耗时: <strong class="text-emerald-600">32ms</strong></span>
          <span>状态: <strong class="text-emerald-700">实时归档就绪</strong></span>
        </div>
      </div>
    </div>
  </div>
</template>
