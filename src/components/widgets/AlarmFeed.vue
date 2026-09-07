<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { withAlpha } from '../../utils/color';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Volume2, ShieldAlert } from 'lucide-vue-next';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const isPaused = ref(false);

const defaultAlarms = [
  { id: 'ALM-101', level: 'CRITICAL', levelText: '事故跳闸', device: '10kV 进线 101', point: '速断过流动作', val: '1420 A', msg: '101断路器瞬时速断保护跳闸', time: '10:42:15', status: 'UNACK' },
  { id: 'ALM-102', level: 'CRITICAL', levelText: '严重越限', device: '3# 动力变压器', point: '顶层油温超高', val: '98.5 °C', msg: '主变绕组温度超过95°C危险阈值', time: '10:39:02', status: 'UNACK' },
  { id: 'ALM-103', level: 'WARNING', levelText: '预警越限', device: '10kV 母线 I段', point: 'A相电压偏高', val: '10.85 kV', msg: '母线A相电压超过+8%整定范围', time: '10:31:40', status: 'ACK' },
  { id: 'ALM-104', level: 'WARNING', levelText: '气压偏低', device: '101 断路器机构', point: 'SF6 压力降低', val: '0.48 MPa', msg: 'SF6气体闭锁气压低于报警门限', time: '10:25:11', status: 'ACK' },
  { id: 'ALM-105', level: 'INFO', levelText: '遥控变位', device: '201 出线开关', point: '分合位置变位', val: '合闸(1)', msg: '调度遥控下发合闸指令执行成功', time: '10:18:04', status: 'AUTO' },
  { id: 'ALM-106', level: 'INFO', levelText: '状态正常', device: '直流屏系统', point: '控母对地绝缘', val: '120 kΩ', msg: '直流母线正负极对地绝缘自检正常', time: '10:05:30', status: 'AUTO' }
];

const customProps = computed(() => props.component.customProps || {});
const style = computed(() => props.component.style || {});
const mapping = computed(() => props.component.data?.mapping || {});

// Extract alarms from dataset or staticData or default
const activeAlarms = computed(() => {
  const { data } = props.component;
  const boundDataset = props.datasets?.find(d => d.id === data.datasetId);
  const activeData = boundDataset?.data || data.staticData || {};

  let list: any[] = [];
  if (Array.isArray(activeData.alarms) && activeData.alarms.length > 0) {
    list = activeData.alarms;
  } else if (Array.isArray(activeData.events) && activeData.events.length > 0) {
    list = activeData.events;
  } else if (Array.isArray(activeData) && activeData.length > 0) {
    list = activeData;
  } else {
    list = defaultAlarms;
  }

  // Filter by device if configured
  if (mapping.value.deviceId && mapping.value.deviceId !== 'ALL') {
    list = list.filter(item => !item.device || item.device.includes(mapping.value.deviceId) || item.device.includes(mapping.value.deviceName));
  }

  // Filter by severity level if configured
  if (customProps.value.levelFilter && customProps.value.levelFilter !== 'ALL') {
    list = list.filter(item => item.level === customProps.value.levelFilter);
  }

  return list;
});

// Display mode: 'table' (表格列表) | 'ticker' (无缝垂直平滑滚屏) | 'marquee' (单行横向跑马灯)
const displayMode = computed(() => customProps.value.displayMode || 'ticker');

// Scroll speed duration in seconds
const scrollDuration = computed(() => {
  const speed = customProps.value.scrollSpeed || 'normal';
  if (speed === 'fast') return 8;
  if (speed === 'slow') return 24;
  return 14;
});

// Theme color
const themeColor = computed(() => style.value.stroke || style.value.fill || '#ef4444');
const showHeader = computed(() => customProps.value.showHeader !== false);
const showBadge = computed(() => customProps.value.showBadge !== false);
const showTime = computed(() => customProps.value.showTime !== false);
const showDevice = computed(() => customProps.value.showDevice !== false);
const showValue = computed(() => customProps.value.showValue !== false);

// Critical count
const criticalCount = computed(() => activeAlarms.value.filter(a => a.level === 'CRITICAL').length);
const warningCount = computed(() => activeAlarms.value.filter(a => a.level === 'WARNING').length);

const getLevelBadgeClass = (level: string) => {
  switch (level?.toUpperCase()) {
    case 'CRITICAL':
    case 'ERROR':
    case 'ALARM':
      return 'bg-red-500 text-white font-bold border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
    case 'WARNING':
    case 'WARN':
      return 'bg-amber-500 text-slate-950 font-bold border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]';
    case 'INFO':
    default:
      return 'bg-cyan-600 text-white font-bold border-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.3)]';
  }
};

const getRowBgClass = (level: string) => {
  switch (level?.toUpperCase()) {
    case 'CRITICAL':
    case 'ERROR':
    case 'ALARM':
      return 'bg-red-950/40 hover:bg-red-900/60 border-red-500/50 text-red-100';
    case 'WARNING':
    case 'WARN':
      return 'bg-amber-950/30 hover:bg-amber-900/50 border-amber-500/40 text-amber-100';
    case 'INFO':
    default:
      return 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-700/60 text-slate-100';
  }
};
</script>

<template>
  <div 
    class="w-full h-full p-2.5 rounded-xl bg-[#060b17]/95 border flex flex-col justify-between select-none shadow-[0_10px_30px_rgba(0,0,0,0.85)] overflow-hidden font-sans backdrop-blur-md"
    :style="{ borderColor: withAlpha(themeColor, 0.45) }"
    @mouseenter="isPaused = true"
    @mouseleave="isPaused = false"
  >
    <!-- 1. Crystal-Clear Header -->
    <div 
      v-if="showHeader"
      class="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/80 shrink-0"
    >
      <div class="flex items-center gap-2 overflow-hidden">
        <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
        <span class="text-xs font-bold text-white tracking-wide truncate">
          {{ component.name || 'SCADA 实时事件与告警滚屏' }}
        </span>
      </div>

      <!-- Live Alarm Badges -->
      <div class="flex items-center gap-1.5 shrink-0 text-[11px] font-mono font-bold">
        <span 
          v-if="criticalCount > 0" 
          class="px-1.5 py-0.5 rounded bg-red-600 text-white flex items-center gap-1 shadow-xs animate-pulse"
        >
          <AlertCircle class="w-3 h-3" />
          <span>{{ criticalCount }} 严重</span>
        </span>
        <span 
          v-if="warningCount > 0" 
          class="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 flex items-center gap-1 shadow-xs"
        >
          <AlertTriangle class="w-3 h-3" />
          <span>{{ warningCount }} 预警</span>
        </span>
        <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
          共 {{ activeAlarms.length }} 条
        </span>
      </div>
    </div>

    <!-- 2. MODE A: Seamless Continuous Vertical Ticker (无缝连续滚屏) -->
    <div 
      v-if="displayMode === 'ticker'" 
      class="flex-1 overflow-hidden relative w-full"
    >
      <div 
        class="flex flex-col gap-1.5 absolute top-0 left-0 right-0 w-full animate-scada-scroll"
        :style="{
          animationDuration: `${scrollDuration}s`,
          animationPlayState: isPaused ? 'paused' : 'running'
        }"
      >
        <!-- First Loop -->
        <div
          v-for="alm in activeAlarms"
          :key="alm.id"
          class="p-2 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 shadow-xs transition-colors"
          :class="getRowBgClass(alm.level)"
        >
          <!-- Left: Level Badge + Time + Device -->
          <div class="flex items-center gap-2 min-w-0 overflow-hidden">
            <span 
              v-if="showBadge"
              class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 border"
              :class="getLevelBadgeClass(alm.level)"
            >
              {{ alm.levelText || alm.level }}
            </span>

            <span v-if="showTime" class="text-[11px] font-mono text-cyan-300 font-bold shrink-0">
              {{ alm.time }}
            </span>

            <span v-if="showDevice" class="font-bold text-white shrink-0">
              [{{ alm.device }}]
            </span>

            <span class="truncate text-slate-100 font-medium">
              {{ alm.msg }}
            </span>
          </div>

          <!-- Right: Value & Status -->
          <div class="flex items-center gap-2 shrink-0">
            <span v-if="showValue && alm.val" class="font-mono font-bold text-amber-300 text-[11px]">
              {{ alm.val }}
            </span>
            <span 
              class="px-1 py-0.2 rounded text-[9px] font-mono font-bold"
              :class="alm.status === 'UNACK' ? 'bg-red-500/20 text-red-300 border border-red-500/50 animate-pulse' : 'bg-slate-800 text-slate-400 border border-slate-700'"
            >
              {{ alm.status === 'UNACK' ? '未确认' : '已确认' }}
            </span>
          </div>
        </div>

        <!-- Duplicated Loop for Seamless Infinity Scroll -->
        <div
          v-for="alm in activeAlarms"
          :key="`dup-${alm.id}`"
          class="p-2 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 shadow-xs transition-colors"
          :class="getRowBgClass(alm.level)"
        >
          <div class="flex items-center gap-2 min-w-0 overflow-hidden">
            <span 
              v-if="showBadge"
              class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 border"
              :class="getLevelBadgeClass(alm.level)"
            >
              {{ alm.levelText || alm.level }}
            </span>

            <span v-if="showTime" class="text-[11px] font-mono text-cyan-300 font-bold shrink-0">
              {{ alm.time }}
            </span>

            <span v-if="showDevice" class="font-bold text-white shrink-0">
              [{{ alm.device }}]
            </span>

            <span class="truncate text-slate-100 font-medium">
              {{ alm.msg }}
            </span>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <span v-if="showValue && alm.val" class="font-mono font-bold text-amber-300 text-[11px]">
              {{ alm.val }}
            </span>
            <span 
              class="px-1 py-0.2 rounded text-[9px] font-mono font-bold"
              :class="alm.status === 'UNACK' ? 'bg-red-500/20 text-red-300 border border-red-500/50 animate-pulse' : 'bg-slate-800 text-slate-400 border border-slate-700'"
            >
              {{ alm.status === 'UNACK' ? '未确认' : '已确认' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. MODE B: Industrial High-Contrast Table (工控告警列表表格) -->
    <div 
      v-else-if="displayMode === 'table'"
      class="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1"
    >
      <!-- Table Header -->
      <div class="grid grid-cols-12 gap-1.5 px-2 py-1 bg-slate-900/90 rounded text-[11px] font-bold text-slate-300 border border-slate-800 sticky top-0 z-10 font-mono">
        <div class="col-span-2">发生时间</div>
        <div class="col-span-2">告警等级</div>
        <div class="col-span-3">受控装置</div>
        <div class="col-span-3">事件详情</div>
        <div class="col-span-2 text-right">动作数值</div>
      </div>

      <!-- Table Rows -->
      <div
        v-for="alm in activeAlarms"
        :key="alm.id"
        class="grid grid-cols-12 gap-1.5 px-2 py-1.5 rounded border text-xs items-center transition-colors font-mono"
        :class="getRowBgClass(alm.level)"
      >
        <div class="col-span-2 font-bold text-cyan-300 text-[11px] truncate">{{ alm.time }}</div>
        <div class="col-span-2">
          <span 
            class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border inline-block"
            :class="getLevelBadgeClass(alm.level)"
          >
            {{ alm.levelText || alm.level }}
          </span>
        </div>
        <div class="col-span-3 font-bold text-white truncate font-sans" :title="alm.device">{{ alm.device }}</div>
        <div class="col-span-3 text-slate-100 truncate font-sans" :title="alm.msg">{{ alm.msg }}</div>
        <div class="col-span-2 text-right font-bold text-amber-300 text-[11px] truncate">{{ alm.val || '--' }}</div>
      </div>
    </div>

    <!-- 4. MODE C: Single Line Marquee (单行横向广播滚屏) -->
    <div 
      v-else-if="displayMode === 'marquee'"
      class="flex-1 flex items-center overflow-hidden relative w-full bg-slate-950/80 rounded-lg border border-slate-800 px-2"
    >
      <div 
        class="whitespace-nowrap flex items-center gap-6 animate-scada-marquee text-xs font-bold text-white"
        :style="{
          animationDuration: `${scrollDuration * 1.5}s`,
          animationPlayState: isPaused ? 'paused' : 'running'
        }"
      >
        <div 
          v-for="alm in activeAlarms" 
          :key="alm.id"
          class="inline-flex items-center gap-2 shrink-0"
        >
          <span 
            class="px-1.5 py-0.2 rounded text-[10px] font-bold"
            :class="getLevelBadgeClass(alm.level)"
          >
            {{ alm.levelText || alm.level }}
          </span>
          <span class="text-cyan-300 font-mono">[{{ alm.time }}]</span>
          <span class="text-white font-bold">{{ alm.device }}:</span>
          <span class="text-slate-100">{{ alm.msg }}</span>
          <span v-if="alm.val" class="text-amber-300 font-mono font-bold">({{ alm.val }})</span>
          <span class="text-slate-600">|</span>
        </div>
      </div>
    </div>

    <!-- Footer Bar -->
    <div class="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono shrink-0">
      <span class="flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>SCADA SOE 事件总线已就绪</span>
      </span>
      <span class="text-slate-400">鼠标悬停可暂停滚屏</span>
    </div>
  </div>
</template>

<style scoped>
@keyframes scada-scroll {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(-50%);
  }
}

@keyframes scada-marquee {
  0% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(-100%);
  }
}

.animate-scada-scroll {
  animation: scada-scroll linear infinite;
}

.animate-scada-marquee {
  animation: scada-marquee linear infinite;
}
</style>
