<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  Bell,
  X,
  Play,
  Pause,
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  Volume2,
  VolumeX,
  Filter,
  RefreshCw,
  Download,
  Flame,
  Radio,
  Sparkles,
  Search
} from 'lucide-vue-next';
import {
  ScadaAlarmEvent,
  startAlarmStreamViaUds,
  stopAlarmStreamViaUds,
  isAlarmStreamRunning,
  onUdsAlarm
} from '../utils/udsClient';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isStreaming = ref(isAlarmStreamRunning());
const alarmList = ref<ScadaAlarmEvent[]>([]);
const selectedLevel = ref<string>('all');
const searchQuery = ref<string>('');
const isSoundEnabled = ref<boolean>(false);
const autoScroll = ref<boolean>(true);

// 默认预置一些历史告警
const INITIAL_ALARMS: ScadaAlarmEvent[] = [
  {
    id: 'ALM-1001',
    timestamp: Date.now() - 320000,
    timeStr: '08:42:15.120',
    deviceId: 'DEV-101',
    deviceName: '10kV 1号进线柜',
    pointType: 'YX',
    pointId: 1,
    pointName: '断路器位置',
    level: 'critical',
    value: 2,
    message: '【事故告警】10kV 1号进线柜 速断保护I段动作，断路器故障跳闸！',
    acknowledged: false
  },
  {
    id: 'ALM-1002',
    timestamp: Date.now() - 180000,
    timeStr: '08:44:30.850',
    deviceId: 'DEV-102',
    deviceName: '1号主变压器测控单元',
    pointType: 'YC',
    pointId: 3,
    pointName: '顶层油温 TopTemp',
    level: 'major',
    value: 89.2,
    threshold: 85.0,
    message: '【越限告警】1号主变顶层油温 89.2℃ 超过高温预警限值 (85.0℃)',
    acknowledged: false
  },
  {
    id: 'ALM-1003',
    timestamp: Date.now() - 60000,
    timeStr: '08:46:12.430',
    deviceId: 'DEV-101',
    deviceName: '10kV 1号进线柜',
    pointType: 'YC',
    pointId: 1,
    pointName: 'A相母线电压 Ua',
    level: 'minor',
    value: 11.65,
    threshold: 11.5,
    message: '【一般告警】10kV 母线 A相电压 11.65kV 越上限',
    acknowledged: true
  },
  {
    id: 'ALM-1004',
    timestamp: Date.now() - 20000,
    timeStr: '08:47:00.010',
    deviceId: 'DEV-103',
    deviceName: '储能变流升压一体舱 PCS',
    pointType: 'YX',
    pointId: 2,
    pointName: '手车工作/试验位',
    level: 'info',
    value: 1,
    message: '【事件SOE】变流器直流侧隔离开关合闸就绪 (SOE变位记录)',
    acknowledged: true
  }
];

alarmList.value = [...INITIAL_ALARMS];

let unsubscribeAlarm: (() => void) | null = null;

const toggleStreaming = async () => {
  if (isStreaming.value) {
    await stopAlarmStreamViaUds();
    isStreaming.value = false;
  } else {
    await startAlarmStreamViaUds();
    isStreaming.value = true;
  }
};

const handleAcknowledge = (alarm: ScadaAlarmEvent) => {
  alarm.acknowledged = true;
};

const handleAcknowledgeAll = () => {
  alarmList.value.forEach(a => {
    a.acknowledged = true;
  });
};

const handleClearAlarms = () => {
  alarmList.value = [];
};

const filteredAlarms = computed(() => {
  return alarmList.value.filter(a => {
    if (selectedLevel.value !== 'all' && a.level !== selectedLevel.value) {
      return false;
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      const matchDev = a.deviceId.toLowerCase().includes(q) || a.deviceName.toLowerCase().includes(q);
      const matchMsg = a.message.toLowerCase().includes(q) || a.pointName.toLowerCase().includes(q);
      return matchDev || matchMsg;
    }
    return true;
  });
});

const unacknowledgedCount = computed(() => {
  return alarmList.value.filter(a => !a.acknowledged).length;
});

const criticalCount = computed(() => {
  return alarmList.value.filter(a => a.level === 'critical').length;
});

onMounted(() => {
  isStreaming.value = isAlarmStreamRunning();
  unsubscribeAlarm = onUdsAlarm((event: ScadaAlarmEvent) => {
    alarmList.value.unshift(event);
    if (alarmList.value.length > 500) {
      alarmList.value.pop();
    }
  });
});

onBeforeUnmount(() => {
  if (unsubscribeAlarm) {
    unsubscribeAlarm();
  }
});
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans"
  >
    <!-- Modal Card -->
    <div class="w-full max-w-5xl h-[82vh] bg-[#070d1e] border border-rose-500/40 rounded-2xl shadow-[0_0_60px_rgba(244,63,94,0.22)] flex flex-col overflow-hidden">
      <!-- Modal Header -->
      <div class="px-5 py-3.5 border-b border-rose-500/20 bg-[#040814] flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
            <Bell class="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>SCADA 实时告警与事件流中心</span>
              </h2>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1 border"
                :class="isStreaming ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' : 'bg-slate-900 text-slate-400 border-slate-700'"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="isStreaming ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'"></span>
                {{ isStreaming ? 'UDS 持续推流中' : 'UDS 推流已关闭' }}
              </span>
              <span v-if="unacknowledgedCount > 0" class="text-[10px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40 font-mono font-bold">
                {{ unacknowledgedCount }} 条未确认
              </span>
            </div>
            <p class="text-[11px] text-slate-400 font-mono mt-0.5">
              基于 UDS 本地套接字 / 命名管道的毫秒级告警事件流推送机制
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <!-- 核心操作：开启 / 关闭 UDS 持续告警推送流 -->
          <button
            @click="toggleStreaming"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all border"
            :class="isStreaming ? 'bg-rose-950/80 border-rose-500 text-rose-300 hover:bg-rose-900' : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-md'"
          >
            <component :is="isStreaming ? Pause : Play" class="w-3.5 h-3.5" />
            <span>{{ isStreaming ? '关闭 UDS 告警流' : '开启 UDS 持续告警流' }}</span>
          </button>

          <!-- 一键确认告警 -->
          <button
            @click="handleAcknowledgeAll"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:border-cyan-500 hover:text-cyan-300 text-xs font-mono font-bold cursor-pointer transition-colors"
          >
            <CheckCircle2 class="w-3.5 h-3.5 text-cyan-400" />
            <span>全部确认</span>
          </button>

          <!-- 清空日志 -->
          <button
            @click="handleClearAlarms"
            class="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 cursor-pointer transition-colors"
            title="清空告警记录"
          >
            <Trash2 class="w-4 h-4" />
          </button>

          <!-- 关闭按钮 -->
          <button
            @click="emit('close')"
            class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors ml-1"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="px-5 py-2.5 bg-[#050a17] border-b border-rose-500/10 flex items-center justify-between gap-4 text-xs">
        <div class="flex items-center gap-1.5">
          <span class="text-slate-400 font-mono text-[11px]">告警等级:</span>
          <button
            @click="selectedLevel = 'all'"
            class="px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors"
            :class="selectedLevel === 'all' ? 'bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold' : 'bg-slate-900 text-slate-400 hover:text-slate-200'"
          >
            全部 ({{ alarmList.length }})
          </button>
          <button
            @click="selectedLevel = 'critical'"
            class="px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors flex items-center gap-1"
            :class="selectedLevel === 'critical' ? 'bg-rose-950 border border-rose-500 text-rose-300 font-bold' : 'bg-slate-900 text-slate-400 hover:text-rose-300'"
          >
            <Flame class="w-3 h-3 text-rose-400" />
            <span>事故 ({{ criticalCount }})</span>
          </button>
          <button
            @click="selectedLevel = 'major'"
            class="px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors"
            :class="selectedLevel === 'major' ? 'bg-amber-950 border border-amber-500 text-amber-300 font-bold' : 'bg-slate-900 text-slate-400 hover:text-amber-300'"
          >
            严重
          </button>
          <button
            @click="selectedLevel = 'minor'"
            class="px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors"
            :class="selectedLevel === 'minor' ? 'bg-blue-950 border border-blue-500 text-blue-300 font-bold' : 'bg-slate-900 text-slate-400 hover:text-blue-300'"
          >
            一般
          </button>
          <button
            @click="selectedLevel = 'info'"
            class="px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors"
            :class="selectedLevel === 'info' ? 'bg-purple-950 border border-purple-500 text-purple-300 font-bold' : 'bg-slate-900 text-slate-400 hover:text-purple-300'"
          >
            变位/SOE
          </button>
        </div>

        <div class="flex items-center gap-2">
          <!-- 搜索过滤 -->
          <div class="relative w-56">
            <Search class="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              v-model="searchQuery"
              placeholder="搜索装置/事件内容..."
              class="w-full bg-[#081124] border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 outline-hidden focus:border-rose-500"
            />
          </div>
        </div>
      </div>

      <!-- Alarm Table / Stream View -->
      <div class="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#050914]">
        <div v-if="filteredAlarms.length === 0" class="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
          <CheckCircle2 class="w-12 h-12 text-emerald-500/40" />
          <p class="text-xs font-mono">当前暂无符合条件的告警事件</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="item in filteredAlarms"
            :key="item.id"
            class="p-3 rounded-xl border text-xs font-mono flex items-start justify-between gap-3 transition-all"
            :class="item.acknowledged ? 'bg-[#091122]/60 border-slate-800/80 text-slate-400' : (item.level === 'critical' ? 'bg-rose-950/30 border-rose-500/60 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.15)]' : (item.level === 'major' ? 'bg-amber-950/20 border-amber-500/50 text-amber-200' : 'bg-[#0a1428] border-cyan-500/30 text-slate-200'))"
          >
            <div class="flex items-start gap-3">
              <!-- Level Tag Badge -->
              <span
                class="px-2 py-0.5 rounded font-bold text-[10px] shrink-0 mt-0.5 uppercase flex items-center gap-1 border"
                :class="{
                  'bg-rose-950 text-rose-300 border-rose-500': item.level === 'critical',
                  'bg-amber-950 text-amber-300 border-amber-500': item.level === 'major',
                  'bg-blue-950 text-blue-300 border-blue-500': item.level === 'minor',
                  'bg-purple-950 text-purple-300 border-purple-500': item.level === 'info'
                }"
              >
                <component
                  :is="item.level === 'critical' ? Flame : (item.level === 'major' ? AlertTriangle : (item.level === 'minor' ? AlertCircle : Info))"
                  class="w-3 h-3"
                />
                <span>{{ item.level === 'critical' ? '事故' : (item.level === 'major' ? '严重' : (item.level === 'minor' ? '一般' : 'SOE')) }}</span>
              </span>

              <!-- Content details -->
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-slate-400 font-mono text-[11px]">{{ item.timeStr }}</span>
                  <span class="text-cyan-400 font-bold">[{{ item.deviceId }}]</span>
                  <span class="text-slate-300 font-semibold">{{ item.deviceName }}</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-400 font-mono">
                    {{ item.pointType }}_{{ item.pointId }} ({{ item.pointName }})
                  </span>
                </div>
                <div class="text-xs font-sans font-semibold leading-relaxed" :class="item.level === 'critical' ? 'text-rose-300' : (item.level === 'major' ? 'text-amber-300' : 'text-slate-200')">
                  {{ item.message }}
                </div>
              </div>
            </div>

            <!-- Right Actions -->
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="item.acknowledged" class="text-[10px] text-slate-500 font-mono">已确认</span>
              <button
                v-else
                @click="handleAcknowledge(item)"
                class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold cursor-pointer transition-colors border border-slate-700"
              >
                确认告警
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.6);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(244, 63, 94, 0.4);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(244, 63, 94, 0.7);
}
</style>
