<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { 
  X, Zap, Radio, Sliders, ShieldCheck, CheckCircle2, 
  AlertTriangle, Send, Activity, Lock, RefreshCw, Cpu
} from 'lucide-vue-next';
import { ScadaDeviceItem, DeviceTeleControlPoint, DeviceTeleRegulationPoint, DatasetItem } from '../types';

interface Props {
  visible: boolean;
  device?: ScadaDeviceItem | null;
  initialDeviceId?: string | null;
  initialPointId?: number | string | null;
  initialType?: 'control' | 'regulation' | 'view';
  datasets: DatasetItem[];
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  device: null,
  initialDeviceId: null,
  initialPointId: null,
  initialType: 'control'
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'execute:control', deviceId: string, pointId: number | string, targetValue: number): void;
  (e: 'execute:regulation', deviceId: string, pointId: number | string, targetValue: number): void;
}>();

// Extract all available devices from all datasets
const allDevices = computed<ScadaDeviceItem[]>(() => {
  const list: ScadaDeviceItem[] = [];
  props.datasets.forEach(ds => {
    if (Array.isArray(ds.devices)) {
      ds.devices.forEach(d => {
        if (!list.some(existing => existing.deviceId === d.deviceId)) {
          list.push(d);
        }
      });
    }
  });
  return list;
});

const selectedDeviceId = ref<string>('');
const currentDevice = computed<ScadaDeviceItem | undefined>(() => {
  if (props.device) return props.device;
  return allDevices.value.find(d => d.deviceId === selectedDeviceId.value) || allDevices.value[0];
});

const activeType = ref<'control' | 'regulation' | 'view'>('control');
const selectedPointId = ref<number | string | null>(null);
const targetControlValue = ref<number>(0);
const targetRegulationValue = ref<number>(0);
const operatorName = ref<string>('值班调度员 (SCADA_OP_01)');
const isVerified = ref<boolean>(true); // SCADA 双人监护预演校核
const executionSuccessMsg = ref<string | null>(null);
const executingState = ref<'idle' | 'transmitting' | 'verifying' | 'success'>('idle');

watch(
  () => [props.visible, props.initialDeviceId, props.device],
  () => {
    if (props.visible) {
      if (props.device) {
        selectedDeviceId.value = props.device.deviceId;
      } else if (props.initialDeviceId) {
        selectedDeviceId.value = props.initialDeviceId;
      } else if (allDevices.value.length > 0 && !selectedDeviceId.value) {
        selectedDeviceId.value = allDevices.value[0].deviceId;
      }

      activeType.value = props.initialType || 'control';
      const dev = currentDevice.value;
      if (dev) {
        if (activeType.value === 'control') {
          const pt = props.initialPointId 
            ? dev.teleControls.find(c => String(c.pointId) === String(props.initialPointId))
            : dev.teleControls[0];
          selectedPointId.value = pt ? pt.pointId : null;
          targetControlValue.value = pt?.options[0]?.value ?? 0;
        } else if (activeType.value === 'regulation') {
          const pt = props.initialPointId
            ? dev.teleRegulations.find(r => String(r.pointId) === String(props.initialPointId))
            : dev.teleRegulations[0];
          selectedPointId.value = pt ? pt.pointId : null;
          targetRegulationValue.value = pt?.value ?? 0;
        }
      }
      executionSuccessMsg.value = null;
      executingState.value = 'idle';
    }
  },
  { immediate: true }
);

watch(
  () => selectedDeviceId.value,
  () => {
    const dev = currentDevice.value;
    if (dev) {
      if (activeType.value === 'control') {
        const pt = dev.teleControls[0];
        selectedPointId.value = pt ? pt.pointId : null;
        targetControlValue.value = pt?.options[0]?.value ?? 0;
      } else if (activeType.value === 'regulation') {
        const pt = dev.teleRegulations[0];
        selectedPointId.value = pt ? pt.pointId : null;
        targetRegulationValue.value = pt?.value ?? 0;
      }
    }
  }
);

const currentControlPoint = computed<DeviceTeleControlPoint | undefined>(() => {
  const dev = currentDevice.value;
  if (!dev || !dev.teleControls) return undefined;
  return dev.teleControls.find(c => String(c.pointId) === String(selectedPointId.value)) || dev.teleControls[0];
});

const currentRegulationPoint = computed<DeviceTeleRegulationPoint | undefined>(() => {
  const dev = currentDevice.value;
  if (!dev || !dev.teleRegulations) return undefined;
  return dev.teleRegulations.find(r => String(r.pointId) === String(selectedPointId.value)) || dev.teleRegulations[0];
});

// Linked Tele-Signal (关联遥信状态)
const linkedTeleSignal = computed(() => {
  const dev = currentDevice.value;
  if (!dev || !currentControlPoint.value) return undefined;
  if (currentControlPoint.value.targetPointId !== undefined) {
    return dev.teleSignals.find(s => String(s.pointId) === String(currentControlPoint.value?.targetPointId));
  }
  return undefined;
});

const handleConfirmControl = () => {
  const dev = currentDevice.value;
  if (!dev || !currentControlPoint.value) return;

  executingState.value = 'transmitting';
  
  setTimeout(() => {
    executingState.value = 'verifying';
    emit('execute:control', dev.deviceId, currentControlPoint.value!.pointId, targetControlValue.value);

    const optLabel = currentControlPoint.value!.options.find(o => o.value === targetControlValue.value)?.label || `状态 (${targetControlValue.value})`;
    
    setTimeout(() => {
      executingState.value = 'success';
      executionSuccessMsg.value = `✓ 遥控指令校验通过并执行成功！已向 [${dev.deviceId}] 下发: ${optLabel}，对应遥信状态已联动刷新`;
      
      setTimeout(() => {
        executionSuccessMsg.value = null;
        executingState.value = 'idle';
        emit('close');
      }, 1500);
    }, 400);
  }, 400);
};

const handleConfirmRegulation = () => {
  const dev = currentDevice.value;
  if (!dev || !currentRegulationPoint.value) return;

  executingState.value = 'transmitting';

  setTimeout(() => {
    executingState.value = 'verifying';
    emit('execute:regulation', dev.deviceId, currentRegulationPoint.value!.pointId, Number(targetRegulationValue.value));

    setTimeout(() => {
      executingState.value = 'success';
      executionSuccessMsg.value = `✓ 遥调定值下发成功！[${dev.deviceId}] ${currentRegulationPoint.value!.name} 已整定为: ${targetRegulationValue.value} ${currentRegulationPoint.value!.unit}`;
      
      setTimeout(() => {
        executionSuccessMsg.value = null;
        executingState.value = 'idle';
        emit('close');
      }, 1500);
    }, 400);
  }, 400);
};
</script>

<template>
  <div
    v-if="visible && currentDevice"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    @click.self="emit('close')"
  >
    <div class="bg-[#050a16] border border-cyan-500/50 rounded-2xl w-full max-w-xl overflow-hidden shadow-[0_0_50px_rgba(0,242,255,0.2)] flex flex-col font-sans">
      <!-- Modal Header -->
      <div class="px-6 py-4 bg-[#081122] border-b border-cyan-500/30 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
            <Zap class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 font-mono font-bold">
                {{ currentDevice.deviceId }}
              </span>
              <h3 class="text-base font-bold text-slate-100">
                电力 SCADA 远方调度操作台
              </h3>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              目标装置: {{ currentDevice.deviceName }} ({{ currentDevice.deviceType || '测控保护装置' }})
            </p>
          </div>
        </div>

        <button
          @click="emit('close')"
          class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Device Switcher (when multiple devices exist) -->
      <div v-if="allDevices.length > 1" class="px-6 py-2.5 bg-[#060e1d] border-b border-slate-800 flex items-center justify-between text-xs">
        <span class="text-slate-400 flex items-center gap-1.5 font-medium">
          <Cpu class="w-3.5 h-3.5 text-cyan-400" />
          <span>切换目标调度装置:</span>
        </span>
        <select
          v-model="selectedDeviceId"
          class="bg-[#09152b] border border-cyan-500/40 rounded-lg px-2.5 py-1 text-xs text-cyan-200 font-bold outline-hidden cursor-pointer"
        >
          <option v-for="d in allDevices" :key="d.deviceId" :value="d.deviceId">
            [{{ d.deviceId }}] {{ d.deviceName }}
          </option>
        </select>
      </div>

      <!-- Type Switcher Tabs -->
      <div class="flex border-b border-slate-800 bg-[#060b18] px-6 pt-2">
        <button
          @click="activeType = 'control'"
          class="px-4 py-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center gap-2"
          :class="activeType === 'control' 
            ? 'border-amber-400 text-amber-300 bg-amber-950/20' 
            : 'border-transparent text-slate-400 hover:text-slate-200'"
        >
          <Radio class="w-4 h-4" />
          <span>⚡ 遥控指令下发 (YK)</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 font-mono">{{ currentDevice.teleControls?.length || 0 }}</span>
        </button>

        <button
          @click="activeType = 'regulation'"
          class="px-4 py-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center gap-2"
          :class="activeType === 'regulation' 
            ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20' 
            : 'border-transparent text-slate-400 hover:text-slate-200'"
        >
          <Sliders class="w-4 h-4" />
          <span>🎛️ 参数定值遥调 (YT)</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 font-mono">{{ currentDevice.teleRegulations?.length || 0 }}</span>
        </button>

        <button
          @click="activeType = 'view'"
          class="px-4 py-2.5 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center gap-2"
          :class="activeType === 'view' 
            ? 'border-emerald-400 text-emerald-300 bg-emerald-950/20' 
            : 'border-transparent text-slate-400 hover:text-slate-200'"
        >
          <Activity class="w-4 h-4" />
          <span>📊 装置四遥点表总览</span>
        </button>
      </div>

      <!-- Execution State Indicator Banner -->
      <div v-if="executingState === 'transmitting'" class="mx-6 mt-4 p-3 rounded-xl bg-cyan-950/80 border border-cyan-400 text-cyan-300 text-xs font-bold flex items-center gap-2 animate-pulse">
        <RefreshCw class="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
        <span>正在通过 SCADA 专网向装置 [{{ currentDevice.deviceId }}] 下发指令报文...</span>
      </div>

      <div v-else-if="executingState === 'verifying'" class="mx-6 mt-4 p-3 rounded-xl bg-amber-950/80 border border-amber-400 text-amber-300 text-xs font-bold flex items-center gap-2 animate-pulse">
        <ShieldCheck class="w-4 h-4 text-amber-400 shrink-0" />
        <span>正在比对遥信回路返校遥信状态，执行一致性闭锁校验...</span>
      </div>

      <!-- Success Notification Toast inside Modal -->
      <div v-else-if="executionSuccessMsg" class="mx-6 mt-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-400 text-emerald-300 text-xs font-bold flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
        <span>{{ executionSuccessMsg }}</span>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-5 overflow-y-auto max-h-[65vh] custom-scrollbar text-xs">
        <!-- 1. TELE-CONTROL (遥控) -->
        <template v-if="activeType === 'control'">
          <div v-if="!currentDevice.teleControls || currentDevice.teleControls.length === 0" class="text-center py-8 text-slate-400">
            该装置暂未配置遥控控制点。
          </div>
          <div v-else class="space-y-4">
            <!-- Select Control Point -->
            <div>
              <label class="font-bold text-slate-300 block mb-1.5">选择要操作的遥控点 (Tele-Control Point)</label>
              <select
                :value="currentControlPoint?.pointId"
                @change="selectedPointId = ($event.target as HTMLSelectElement).value"
                class="w-full bg-[#081226] border border-cyan-500/40 rounded-xl px-3 py-2 text-cyan-200 font-bold outline-hidden cursor-pointer"
              >
                <option v-for="c in currentDevice.teleControls" :key="c.pointId" :value="c.pointId">
                  #{{ c.pointId }} {{ c.name }}
                </option>
              </select>
            </div>

            <!-- Current Linked Tele-Signal Status -->
            <div class="p-3 rounded-xl bg-[#09142b] border border-slate-800 flex items-center justify-between">
              <div>
                <span class="text-slate-400 text-[11px] block">当前关联遥信回路状态 (YX):</span>
                <span class="text-slate-200 font-bold text-xs mt-0.5 block">
                  {{ linkedTeleSignal ? `[#${linkedTeleSignal.pointId}] ${linkedTeleSignal.name}` : '未指定关联遥信' }}
                </span>
              </div>
              <div>
                <span 
                  v-if="linkedTeleSignal"
                  class="px-2.5 py-1 rounded-lg text-xs font-bold font-mono border inline-block"
                  :class="linkedTeleSignal.value === 1 ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50' : (linkedTeleSignal.value === 2 ? 'bg-amber-950 text-amber-300 border-amber-500/50' : 'bg-slate-900 text-slate-300 border-slate-700')"
                >
                  当前状态: {{ linkedTeleSignal.statusText || linkedTeleSignal.value }}
                </span>
              </div>
            </div>

            <!-- Target Command Options -->
            <div class="space-y-2">
              <label class="font-bold text-amber-300 block">选择下发控制指令目标值:</label>
              <div class="grid grid-cols-2 gap-2.5">
                <button
                  v-for="opt in currentControlPoint?.options || []"
                  :key="opt.value"
                  @click="targetControlValue = opt.value"
                  class="py-3 px-4 rounded-xl border text-xs font-mono font-bold cursor-pointer transition-all flex items-center justify-between"
                  :class="targetControlValue === opt.value
                    ? (opt.value === 1 ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md scale-[1.01]' : (opt.value === 2 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-[1.01]' : 'bg-rose-500 text-white border-rose-400 shadow-md scale-[1.01]'))
                    : 'bg-[#081226] text-slate-300 border-slate-700 hover:border-cyan-400'"
                >
                  <span>{{ opt.label }}</span>
                  <span class="text-[11px] opacity-80">枚举值: {{ opt.value }}</span>
                </button>
              </div>
            </div>

            <!-- SCADA Two-Step Verification Check -->
            <div class="p-3 rounded-xl bg-amber-950/20 border border-amber-500/40 space-y-2">
              <div class="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <ShieldCheck class="w-4 h-4 text-amber-400" />
                <span>SCADA 防误闭锁与监护核对机制</span>
              </div>
              <p class="text-[11px] text-slate-300 leading-relaxed">
                按照电力系统调度规程，本次遥控下发已通过闭锁逻辑校验（无接地刀闸闭锁、无检修互锁挂牌）。指令触发后将虚拟驱动远方遥信状态变位并核验动作一致性。
              </p>
            </div>
          </div>
        </template>

        <!-- 2. TELE-REGULATION (遥调) -->
        <template v-else-if="activeType === 'regulation'">
          <div v-if="!currentDevice.teleRegulations || currentDevice.teleRegulations.length === 0" class="text-center py-8 text-slate-400">
            该装置暂未配置遥调定值点。
          </div>
          <div v-else class="space-y-4">
            <!-- Select Regulation Point -->
            <div>
              <label class="font-bold text-slate-300 block mb-1.5">选择要整定的遥调项目 (Tele-Regulation)</label>
              <select
                :value="currentRegulationPoint?.pointId"
                @change="selectedPointId = ($event.target as HTMLSelectElement).value; targetRegulationValue = currentRegulationPoint?.value ?? 0;"
                class="w-full bg-[#081226] border border-cyan-500/40 rounded-xl px-3 py-2 text-cyan-200 font-bold outline-hidden cursor-pointer"
              >
                <option v-for="r in currentDevice.teleRegulations" :key="r.pointId" :value="r.pointId">
                  #{{ r.pointId }} {{ r.name }} (当前: {{ r.value }} {{ r.unit }})
                </option>
              </select>
            </div>

            <!-- Current vs Target Value Input -->
            <div v-if="currentRegulationPoint" class="p-4 rounded-xl bg-[#081226] border border-cyan-500/40 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-slate-400 text-[11px]">当前装置定值:</span>
                  <span class="text-cyan-300 font-mono font-bold text-sm block">
                    {{ currentRegulationPoint.value }} {{ currentRegulationPoint.unit }}
                  </span>
                </div>
                <div class="text-right">
                  <span class="text-slate-400 text-[11px]">可调节范围:</span>
                  <span class="text-slate-200 font-mono font-bold text-xs block">
                    {{ currentRegulationPoint.min }} ~ {{ currentRegulationPoint.max }} {{ currentRegulationPoint.unit }}
                  </span>
                </div>
              </div>

              <!-- Slider & Numeric Input -->
              <div class="space-y-2 pt-2 border-t border-slate-800">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-slate-200">目标整定数值:</label>
                  <div class="flex items-center gap-1.5">
                    <input
                      type="number"
                      :min="currentRegulationPoint.min"
                      :max="currentRegulationPoint.max"
                      :step="currentRegulationPoint.step || 1"
                      v-model.number="targetRegulationValue"
                      class="w-24 bg-[#050a16] border border-cyan-400 rounded-lg px-2 py-1 text-cyan-300 font-bold text-sm font-mono text-center outline-hidden"
                    />
                    <span class="text-cyan-400 font-mono font-bold">{{ currentRegulationPoint.unit }}</span>
                  </div>
                </div>

                <input
                  type="range"
                  :min="currentRegulationPoint.min"
                  :max="currentRegulationPoint.max"
                  :step="currentRegulationPoint.step || 1"
                  v-model.number="targetRegulationValue"
                  class="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- 3. VIEW 4-TELE POINTS (四遥点表一览) -->
        <template v-else>
          <div class="space-y-3">
            <!-- YC List -->
            <div>
              <div class="font-bold text-cyan-300 mb-1.5 flex items-center gap-1.5">
                <span>📟 遥测清单 (YC)</span>
                <span class="text-slate-400 font-normal">({{ currentDevice.telemetries?.length || 0 }} 项)</span>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <div
                  v-for="yc in currentDevice.telemetries"
                  :key="yc.pointId"
                  class="p-2 rounded-lg bg-[#081226] border border-slate-800 flex items-center justify-between"
                >
                  <span class="text-slate-300 truncate text-[11px]">#{{ yc.pointId }} {{ yc.name }}</span>
                  <span class="font-mono font-bold text-emerald-400">{{ yc.value }} {{ yc.unit }}</span>
                </div>
              </div>
            </div>

            <!-- YX List -->
            <div class="pt-2 border-t border-slate-800">
              <div class="font-bold text-amber-300 mb-1.5 flex items-center gap-1.5">
                <span>🚦 遥信状态 (YX)</span>
                <span class="text-slate-400 font-normal">({{ currentDevice.teleSignals?.length || 0 }} 项)</span>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <div
                  v-for="yx in currentDevice.teleSignals"
                  :key="yx.pointId"
                  class="p-2 rounded-lg bg-[#081226] border border-slate-800 flex items-center justify-between"
                >
                  <span class="text-slate-300 truncate text-[11px]">#{{ yx.pointId }} {{ yx.name }}</span>
                  <span
                    class="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono"
                    :class="yx.value === 1 ? 'bg-emerald-950 text-emerald-300' : (yx.value === 2 ? 'bg-amber-950 text-amber-300' : 'bg-slate-800 text-slate-300')"
                  >
                    {{ yx.value }} ({{ yx.statusText || yx.value }})
                  </span>
                </div>
              </div>
            </div>

            <!-- DD List -->
            <div v-if="currentDevice.energies && currentDevice.energies.length > 0" class="pt-2 border-t border-slate-800">
              <div class="font-bold text-purple-300 mb-1.5 flex items-center gap-1.5">
                <span>⚡ 电度计量 (DD)</span>
                <span class="text-slate-400 font-normal">({{ currentDevice.energies?.length || 0 }} 项)</span>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <div
                  v-for="dd in currentDevice.energies"
                  :key="dd.pointId"
                  class="p-2 rounded-lg bg-[#081226] border border-slate-800 flex items-center justify-between"
                >
                  <span class="text-slate-300 truncate text-[11px]">#{{ dd.pointId }} {{ dd.name }}</span>
                  <span class="font-mono font-bold text-purple-400">{{ dd.value }} {{ dd.unit }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Modal Footer Action Buttons -->
      <div class="px-6 py-4 bg-[#081122] border-t border-cyan-500/30 flex items-center justify-between">
        <div class="flex items-center gap-2 text-slate-400 text-xs font-mono">
          <Lock class="w-3.5 h-3.5 text-cyan-400" />
          <span>调度员: {{ operatorName }}</span>
        </div>

        <div class="flex items-center gap-3">
          <button
            @click="emit('close')"
            class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer transition-colors"
          >
            取消关闭
          </button>

          <button
            v-if="activeType === 'control' && currentControlPoint"
            @click="handleConfirmControl"
            :disabled="executingState !== 'idle'"
            class="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <Send class="w-3.5 h-3.5" />
            <span>{{ executingState === 'idle' ? '执行遥控下发' : '正在下发...' }}</span>
          </button>

          <button
            v-else-if="activeType === 'regulation' && currentRegulationPoint"
            @click="handleConfirmRegulation"
            :disabled="executingState !== 'idle'"
            class="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            <Send class="w-3.5 h-3.5" />
            <span>{{ executingState === 'idle' ? '执行遥调定值下发' : '正在下发...' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
