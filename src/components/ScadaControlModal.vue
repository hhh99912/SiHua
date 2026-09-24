<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { 
  X, Zap, Radio, Sliders, ShieldCheck, CheckCircle2, 
  AlertTriangle, Send, Activity, Lock, RefreshCw, Cpu,
  Clock, Check, AlertCircle, XCircle, ArrowRight
} from 'lucide-vue-next';
import { 
  ScadaFacilityNode,
  ScadaBayNode,
  ScadaDeviceNode,
  ScadaYkItem,
  ScadaYtItem,
  ScadaYxItem,
  ScadaYcItem
} from '../types';
import { 
  scadaFacilities, 
  rawYxValues, 
  rawYcValues,
  executeClosedLoopControl,
  sendScadaYk,
  sendScadaYt,
  YK_STATE_OPTIONS,
  YT_OPER_OPTIONS,
  findScadaPointDef
} from '../utils/scadaClient';

interface Props {
  visible: boolean;
  initialType?: 'yk' | 'yt' | 'control' | 'regulation';
  initialPointId?: number | string | null;
  initialTargetVerificationPointId?: number | string | null;
  initialDeviceId?: number | string | null;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  initialType: 'yk',
  initialPointId: null,
  initialTargetVerificationPointId: null,
  initialDeviceId: null
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', info: any): void;
}>();

// Active Mode: 'yk' (遥控) | 'yt' (遥调)
const activeTab = ref<'yk' | 'yt'>('yk');

// Selected Hierarchy
const selectedFacId = ref<number | string>(scadaFacilities.value[0]?.fac_id || 4000003);
const selectedBayId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.bay_id || 430000001);
const selectedDevId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.devices?.[0]?.dev_id || 7000001);

// Selected Points
const selectedPointId = ref<number | null>(null);
const selectedVerificationPointId = ref<number | null>(null);

// Control Parameters
const selectedYkState = ref<string>('close');
const selectedYtOper = ref<string>('adjust');
const targetYtVal = ref<number>(20.0);
const oldYtVal = ref<number>(9.0);
const controlMode = ref<'prev-exec' | 'direct'>('prev-exec'); // 标准预置-执行 vs 直接执行
const timeoutSeconds = ref<number>(10); // 超时时间 (秒)
const operatorName = ref<string>('值班调度员 (SCADA_OP_01)');

// Execution & Verification State
const executionState = ref<'idle' | 'executing' | 'success' | 'failed' | 'timeout'>('idle');
const progressMessage = ref<string>('');
const remainingSeconds = ref<number>(10);
const elapsedMs = ref<number>(0);
const resultMessage = ref<string>('');
const liveReturnVal = ref<any>(null);

// Facilities lookup
const currentFacility = computed<ScadaFacilityNode | undefined>(() => {
  return scadaFacilities.value.find(f => f.fac_id === selectedFacId.value || f.id === selectedFacId.value) || scadaFacilities.value[0];
});

const currentBay = computed<ScadaBayNode | undefined>(() => {
  const fac = currentFacility.value;
  if (!fac || !fac.bays?.length) return undefined;
  return fac.bays.find(b => b.bay_id === selectedBayId.value || b.id === selectedBayId.value) || fac.bays[0];
});

const currentDevice = computed<ScadaDeviceNode | undefined>(() => {
  const bay = currentBay.value;
  if (!bay) return undefined;
  const devs = bay.devices || bay.cb_devices || [];
  return devs.find(d => d.dev_id === selectedDevId.value || d.id === selectedDevId.value) || devs[0];
});

// All Available YK & YT points in current device
const availableYkPoints = computed<ScadaYkItem[]>(() => {
  const dev = currentDevice.value;
  return dev?.yk_list || dev?.yk_points || [];
});

const availableYtPoints = computed<ScadaYtItem[]>(() => {
  const dev = currentDevice.value;
  return dev?.yt_list || dev?.yt_points || [];
});

// All Available YX & YC verification candidate points in current device
const availableYxPoints = computed<ScadaYxItem[]>(() => {
  const dev = currentDevice.value;
  return dev?.yx_list || dev?.yx_points || [];
});

const availableYcPoints = computed<ScadaYcItem[]>(() => {
  const dev = currentDevice.value;
  return dev?.yc_list || dev?.yc_points || [];
});

// Active YK or YT point object
const activePoint = computed<any>(() => {
  if (activeTab.value === 'yk') {
    return availableYkPoints.value.find(k => k.id === selectedPointId.value) || availableYkPoints.value[0];
  } else {
    return availableYtPoints.value.find(t => t.id === selectedPointId.value) || availableYtPoints.value[0];
  }
});

// Active Verification Point object
const activeVerificationPoint = computed<any>(() => {
  if (!selectedVerificationPointId.value) return null;
  if (activeTab.value === 'yk') {
    return availableYxPoints.value.find(x => x.id === selectedVerificationPointId.value);
  } else {
    return availableYcPoints.value.find(c => c.id === selectedVerificationPointId.value);
  }
});

// Current Live values for display
const currentLiveYxVal = computed(() => {
  if (selectedVerificationPointId.value && activeTab.value === 'yk') {
    return rawYxValues.get(selectedVerificationPointId.value) ?? 0;
  }
  return 0;
});

const currentLiveYcVal = computed(() => {
  if (selectedVerificationPointId.value && activeTab.value === 'yt') {
    return rawYcValues.get(selectedVerificationPointId.value) ?? 0;
  }
  return 0;
});

// Reset / Initialize on open
watch(
  () => props.visible,
  (val) => {
    if (val) {
      executionState.value = 'idle';
      progressMessage.value = '';
      resultMessage.value = '';
      elapsedMs.value = 0;

      if (props.initialType === 'yt' || props.initialType === 'regulation') {
        activeTab.value = 'yt';
      } else {
        activeTab.value = 'yk';
      }

      // Restore device & point
      if (props.initialPointId) {
        const pDef = findScadaPointDef(props.initialPointId);
        if (pDef.facility) selectedFacId.value = pDef.facility.fac_id || pDef.facility.id || selectedFacId.value;
        if (pDef.bay) selectedBayId.value = pDef.bay.bay_id || pDef.bay.id || selectedBayId.value;
        if (pDef.device) selectedDevId.value = pDef.device.dev_id || pDef.device.id || selectedDevId.value;
        selectedPointId.value = Number(props.initialPointId);
      } else {
        const firstYk = availableYkPoints.value[0];
        const firstYt = availableYtPoints.value[0];
        selectedPointId.value = activeTab.value === 'yk' ? (firstYk?.id || 54000003) : (firstYt?.id || 54000004);
      }

      if (props.initialTargetVerificationPointId) {
        selectedVerificationPointId.value = Number(props.initialTargetVerificationPointId);
      } else {
        // Auto default to associated verification point
        if (activeTab.value === 'yk') {
          selectedVerificationPointId.value = activePoint.value?.targetVerificationPointId || availableYxPoints.value[0]?.id || null;
        } else {
          selectedVerificationPointId.value = activePoint.value?.targetVerificationPointId || availableYcPoints.value[0]?.id || null;
          oldYtVal.value = currentLiveYcVal.value;
        }
      }
    }
  },
  { immediate: true }
);

// Switch Point handler
watch(
  () => [selectedDevId.value, activeTab.value],
  () => {
    if (activeTab.value === 'yk') {
      const pt = availableYkPoints.value[0];
      selectedPointId.value = pt?.id || null;
      selectedVerificationPointId.value = pt?.targetVerificationPointId || availableYxPoints.value[0]?.id || null;
    } else {
      const pt = availableYtPoints.value[0];
      selectedPointId.value = pt?.id || null;
      selectedVerificationPointId.value = pt?.targetVerificationPointId || availableYcPoints.value[0]?.id || null;
      oldYtVal.value = currentLiveYcVal.value;
    }
  }
);

// Execute Control with Verification
let cancelFlag = false;

const handleExecuteControl = async () => {
  if (!selectedPointId.value) return;
  
  cancelFlag = false;
  executionState.value = 'executing';
  progressMessage.value = '正在校验权限与下发控制预演...';
  remainingSeconds.value = timeoutSeconds.value;
  resultMessage.value = '';

  const res = await executeClosedLoopControl({
    type: activeTab.value,
    pointId: selectedPointId.value,
    action: controlMode.value,
    ykState: selectedYkState.value,
    ytOper: selectedYtOper.value,
    ytVal: targetYtVal.value,
    ytOldVal: oldYtVal.value,
    targetVerificationPointId: selectedVerificationPointId.value || undefined,
    targetVerificationType: activeTab.value === 'yk' ? 'yx' : 'yc',
    verificationTimeoutMs: timeoutSeconds.value * 1000,
    onProgress: (info) => {
      progressMessage.value = info.step;
      remainingSeconds.value = info.remainingSeconds;
      elapsedMs.value = info.elapsedMs;
      liveReturnVal.value = info.currentVal;
    }
  });

  if (res.success && res.verified) {
    executionState.value = 'success';
    resultMessage.value = res.message;
    emit('success', {
      type: activeTab.value,
      pointId: selectedPointId.value,
      verificationPointId: selectedVerificationPointId.value,
      finalValue: res.finalValue,
      elapsedMs: res.elapsedMs
    });
  } else if (res.timeout) {
    executionState.value = 'timeout';
    resultMessage.value = res.message;
  } else {
    executionState.value = 'failed';
    resultMessage.value = res.message;
  }
};

// Send Cancel Command
const handleCancelCommand = async () => {
  cancelFlag = true;
  executionState.value = 'idle';
  progressMessage.value = '';
  
  if (selectedPointId.value) {
    if (activeTab.value === 'yk') {
      await sendScadaYk({ yk_id: selectedPointId.value, action: 'cancel', state: selectedYkState.value });
    } else {
      await sendScadaYt({ yt_id: selectedPointId.value, action: 'cancel', oper: selectedYtOper.value, val: targetYtVal.value });
    }
  }
};
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
    @click.self="emit('close')"
  >
    <div
      class="bg-[#0b1329] border border-cyan-500/60 rounded-2xl w-full max-w-3xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden text-slate-100"
      @click.stop
    >
      <!-- Header -->
      <div class="px-6 py-4 bg-gradient-to-r from-slate-900 via-[#0d1c3a] to-slate-900 border-b border-cyan-500/40 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Zap v-if="activeTab === 'yk'" class="w-5 h-5 text-cyan-400 animate-pulse" />
            <Sliders v-else class="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-bold text-white tracking-wide">
                {{ activeTab === 'yk' ? 'SCADA 遥控操作 (YK) 与返校闭环校验' : 'SCADA 遥调操作 (YT) 与定值反馈校核' }}
              </h3>
              <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-500/50">
                {{ activeTab === 'yk' ? 'Tele-Control' : 'Tele-Regulation' }}
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              严格遵照 SCADA 双人监护预演标准流程：预置下发 (prev) -> 执行下发 (exec) -> 限时返校校验闭环变位
            </p>
          </div>
        </div>

        <button
          @click="emit('close')"
          class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Main Body -->
      <div class="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
        <!-- 1. Mode Tab Selector -->
        <div class="flex items-center justify-between bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <div class="flex items-center gap-2">
            <button
              @click="activeTab = 'yk'"
              class="px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              :class="activeTab === 'yk' ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'"
            >
              <Zap class="w-4 h-4" />
              <span>遥控操作 (YK)</span>
            </button>
            <button
              @click="activeTab = 'yt'"
              class="px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              :class="activeTab === 'yt' ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'text-slate-400 hover:text-white hover:bg-slate-900'"
            >
              <Sliders class="w-4 h-4" />
              <span>遥调操作 (YT)</span>
            </button>
          </div>

          <div class="flex items-center gap-2 text-xs text-slate-400 pr-2 font-mono">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>接口协议: HTTP / JSON</span>
          </div>
        </div>

        <!-- 2. Device & Point Cascader Selection -->
        <div class="grid grid-cols-3 gap-3 bg-[#0d1a33]/80 p-3.5 rounded-xl border border-slate-800 text-xs">
          <div>
            <label class="block text-slate-400 mb-1 font-medium">所属厂站 (Facility):</label>
            <select
              v-model="selectedFacId"
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-cyan-400 focus:outline-none"
            >
              <option v-for="f in scadaFacilities" :key="f.fac_id || f.id" :value="f.fac_id || f.id">
                [{{ f.fac_id || f.id }}] {{ f.fac_name || f.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-slate-400 mb-1 font-medium">所属间隔 (Bay):</label>
            <select
              v-model="selectedBayId"
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-cyan-400 focus:outline-none"
            >
              <option v-for="b in currentFacility?.bays || []" :key="b.bay_id || b.id" :value="b.bay_id || b.id">
                [{{ b.bay_id || b.id }}] {{ b.bay_name || b.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-slate-400 mb-1 font-medium">一次设备/装置 (Device):</label>
            <select
              v-model="selectedDevId"
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-cyan-400 focus:outline-none"
            >
              <option v-for="d in currentBay?.devices || currentBay?.cb_devices || []" :key="d.dev_id || d.id" :value="d.dev_id || d.id">
                [{{ d.dev_id || d.id }}] {{ d.dev_name || d.name }} ({{ d.cbty_name || '开关' }})
              </option>
            </select>
          </div>
        </div>

        <!-- 3. Target Control Point & Return Verification Point (两点联动配置) -->
        <div class="grid grid-cols-2 gap-4">
          <!-- Left: Control Point Selection -->
          <div class="bg-[#0d1a33]/90 p-4 rounded-xl border border-cyan-500/40 space-y-3">
            <div class="flex items-center justify-between border-b border-cyan-500/30 pb-2">
              <div class="flex items-center gap-2 font-bold text-sm text-cyan-300">
                <Zap v-if="activeTab === 'yk'" class="w-4 h-4 text-cyan-400" />
                <Sliders v-else class="w-4 h-4 text-amber-400" />
                <span>1. 选择控制点 ({{ activeTab === 'yk' ? 'YK 遥控点' : 'YT 遥调点' }})</span>
              </div>
              <span class="text-[10px] font-mono text-slate-400">下发控制源</span>
            </div>

            <div>
              <label class="block text-xs text-slate-300 mb-1">控制点号与名称:</label>
              <select
                v-model="selectedPointId"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-200 focus:border-cyan-400 focus:outline-none"
              >
                <template v-if="activeTab === 'yk'">
                  <option v-for="pt in availableYkPoints" :key="pt.id" :value="pt.id">
                    [YK_{{ pt.id }}] {{ pt.name }} ({{ pt.alias || pt.type_name }})
                  </option>
                </template>
                <template v-else>
                  <option v-for="pt in availableYtPoints" :key="pt.id" :value="pt.id">
                    [YT_{{ pt.id }}] {{ pt.name }} ({{ pt.alias || pt.type_name }})
                  </option>
                </template>
              </select>
            </div>

            <!-- YK Target State Selection -->
            <div v-if="activeTab === 'yk'" class="space-y-2">
              <label class="block text-xs text-slate-300">目标遥控指令 (State):</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="opt in YK_STATE_OPTIONS"
                  :key="opt.value"
                  @click="selectedYkState = opt.value"
                  class="px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer"
                  :class="selectedYkState === opt.value
                    ? (opt.targetState === 1 ? 'bg-rose-600 border-rose-400 text-white shadow-[0_0_10px_rgba(225,29,72,0.4)]' : 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]')
                    : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-slate-500'"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <!-- YT Target Oper & Value -->
            <div v-else class="space-y-3">
              <div>
                <label class="block text-xs text-slate-300 mb-1">遥调操作类型 (Oper):</label>
                <div class="grid grid-cols-4 gap-1.5">
                  <button
                    v-for="opt in YT_OPER_OPTIONS"
                    :key="opt.value"
                    @click="selectedYtOper = opt.value"
                    class="px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer"
                    :class="selectedYtOper === opt.value ? 'bg-amber-500 border-amber-300 text-slate-950 font-bold' : 'bg-slate-900 border-slate-700 text-slate-300'"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs text-slate-400 mb-1">目标设定值 (val):</label>
                  <input
                    v-model.number="targetYtVal"
                    type="number"
                    step="0.1"
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">当前参考值 (old_val):</label>
                  <input
                    v-model.number="oldYtVal"
                    type="number"
                    step="0.1"
                    class="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Return Verification Point (返校校验点) Selection -->
          <div class="bg-[#0d1a33]/90 p-4 rounded-xl border border-purple-500/40 space-y-3">
            <div class="flex items-center justify-between border-b border-purple-500/30 pb-2">
              <div class="flex items-center gap-2 font-bold text-sm text-purple-300">
                <ShieldCheck class="w-4 h-4 text-purple-400" />
                <span>2. 选择返回校验点 (闭环返校)</span>
              </div>
              <span class="text-[10px] font-mono text-purple-300 font-bold">校验反馈源</span>
            </div>

            <div>
              <label class="block text-xs text-slate-300 mb-1">
                {{ activeTab === 'yk' ? '关联返校遥信点 (YX):' : '关联返校遥测点 (YC):' }}
              </label>
              <select
                v-model="selectedVerificationPointId"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-purple-200 focus:border-purple-400 focus:outline-none"
              >
                <option :value="null">-- 不进行返校校验 (单向开环指令) --</option>
                <template v-if="activeTab === 'yk'">
                  <option v-for="yx in availableYxPoints" :key="yx.id" :value="yx.id">
                    [YX_{{ yx.id }}] {{ yx.name }} ({{ yx.alias || yx.type_name }}) - 当前: {{ yx.val === 1 ? '合闸(1)' : '分闸(0)' }}
                  </option>
                </template>
                <template v-else>
                  <option v-for="yc in availableYcPoints" :key="yc.id" :value="yc.id">
                    [YC_{{ yc.id }}] {{ yc.name }} ({{ yc.alias || yc.type_name }}) - 当前: {{ yc.val }} {{ yc.unit }}
                  </option>
                </template>
              </select>
            </div>

            <!-- Live Status of Verification Point -->
            <div class="bg-slate-950/80 p-3 rounded-lg border border-purple-900/60 text-xs space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-slate-400">返校测点当前采样值:</span>
                <span v-if="activeTab === 'yk'" class="font-mono font-bold" :class="currentLiveYxVal === 1 ? 'text-rose-400' : 'text-emerald-400'">
                  {{ currentLiveYxVal === 1 ? '合闸状态 (1)' : '分闸状态 (0)' }}
                </span>
                <span v-else class="font-mono font-bold text-amber-300">
                  {{ currentLiveYcVal }}
                </span>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-slate-400">期望变位结果:</span>
                <span v-if="activeTab === 'yk'" class="font-mono font-bold text-cyan-300">
                  {{ ['close', 'tqh', 'yyh', 'wyh', 'hhh', 'tsh'].includes(selectedYkState) ? '变位 -> 合闸 (1)' : '变位 -> 分闸 (0)' }}
                </span>
                <span v-else class="font-mono font-bold text-cyan-300">
                  达到目标值 -> {{ targetYtVal }}
                </span>
              </div>

              <div class="flex items-center justify-between pt-1 border-t border-slate-900 text-[11px]">
                <span class="text-slate-500">校验超时时限:</span>
                <div class="flex items-center gap-1 font-mono">
                  <input
                    v-model.number="timeoutSeconds"
                    type="number"
                    min="3"
                    max="60"
                    class="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center text-purple-300"
                  />
                  <span class="text-slate-400">秒</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Execution Workflow Monitor Panel (执行与倒计时返校监控进度条) -->
        <div v-if="executionState !== 'idle'" class="bg-[#070e1e] p-4 rounded-xl border border-cyan-500/50 space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 font-bold text-sm">
              <RefreshCw v-if="executionState === 'executing'" class="w-4 h-4 text-cyan-400 animate-spin" />
              <CheckCircle2 v-else-if="executionState === 'success'" class="w-4 h-4 text-emerald-400" />
              <XCircle v-else class="w-4 h-4 text-rose-400" />
              <span :class="{
                'text-cyan-300': executionState === 'executing',
                'text-emerald-400 font-bold': executionState === 'success',
                'text-rose-400 font-bold': executionState === 'failed' || executionState === 'timeout'
              }">
                {{ executionState === 'executing' ? '控制指令已下发，正在进行限时返校闭环校验...' : (executionState === 'success' ? '控制执行成功！返校校验变位正常' : '控制超时或校验失败！') }}
              </span>
            </div>

            <div class="flex items-center gap-3 font-mono text-xs">
              <span v-if="executionState === 'executing'" class="text-amber-300 animate-pulse font-bold">
                校验倒计时: {{ remainingSeconds }}s
              </span>
              <span class="text-slate-400">
                耗时: {{ (elapsedMs / 1000).toFixed(1) }}s
              </span>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              class="h-full transition-all duration-300 rounded-full"
              :class="{
                'bg-gradient-to-r from-cyan-500 to-blue-500': executionState === 'executing',
                'bg-emerald-500': executionState === 'success',
                'bg-rose-500': executionState === 'failed' || executionState === 'timeout'
              }"
              :style="{ width: executionState === 'executing' ? `${Math.max(5, (1 - remainingSeconds / timeoutSeconds) * 100)}%` : '100%' }"
            ></div>
          </div>

          <!-- Status Log Message -->
          <div class="text-xs font-mono px-3 py-2 rounded-lg bg-slate-950 border border-slate-800" :class="{
            'text-cyan-200': executionState === 'executing',
            'text-emerald-300 border-emerald-500/50 bg-emerald-950/40': executionState === 'success',
            'text-rose-300 border-rose-500/50 bg-rose-950/40': executionState === 'failed' || executionState === 'timeout'
          }">
            {{ resultMessage || progressMessage }}
          </div>
        </div>

        <!-- 5. Dual-Operator Safety Confirmation Bar -->
        <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2 text-slate-300">
            <ShieldCheck class="w-4 h-4 text-emerald-400" />
            <span>执行模式:</span>
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="radio" value="prev-exec" v-model="controlMode" :disabled="executionState === 'executing'" />
              <span>标准两步预置执行 (prev->exec)</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer ml-2">
              <input type="radio" value="direct" v-model="controlMode" :disabled="executionState === 'executing'" />
              <span>直接执行 (direct)</span>
            </label>
          </div>

          <div class="text-slate-400 font-mono">
            操作员: <span class="text-white">{{ operatorName }}</span>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
        <div class="text-xs text-slate-500">
          POST /api/scada/control/{{ activeTab === 'yk' ? 'yk' : 'yt' }}
        </div>

        <div class="flex items-center gap-3">
          <button
            v-if="executionState === 'executing'"
            @click="handleCancelCommand"
            class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(225,29,72,0.3)]"
          >
            <X class="w-4 h-4" />
            <span>取消指令 (Cancel)</span>
          </button>

          <button
            @click="emit('close')"
            class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            关闭
          </button>

          <button
            v-if="executionState !== 'executing'"
            @click="handleExecuteControl"
            class="px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg"
            :class="activeTab === 'yk'
              ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.4)]'"
          >
            <Send class="w-4 h-4" />
            <span>下发并启动返校校验</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
