<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  X, Check, AlertCircle, CheckCircle2,
  RefreshCw, Plus, Minus, KeyRound, UserCheck, ShieldCheck
} from 'lucide-vue-next';
import {
  ScadaFacilityNode,
  ScadaBayNode,
  ScadaDeviceNode,
  ScadaYtItem
} from '../types';
import {
  scadaFacilities,
  rawYcValues,
  scadaLiveTick,
  sendScadaYt,
  executeClosedLoopControl,
  findScadaPointDef
} from '../utils/scadaClient';

interface Props {
  visible: boolean;
  initialPointId?: number | string | null;
  initialDeviceId?: number | string | null;
  initialTargetVerificationPointId?: number | string | null;
  initialTargetValue?: number;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  initialPointId: null,
  initialDeviceId: null,
  initialTargetVerificationPointId: null,
  initialTargetValue: 5.0
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', payload: any): void;
}>();

// ---------------- 1. SCADA Device & Hierarchy ----------------
const selectedFacId = ref<number | string>(scadaFacilities.value[0]?.fac_id || 4000003);
const selectedBayId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.bay_id || 430000001);
const selectedDevId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.devices?.[0]?.dev_id || 7000001);

// Selected YT Point
const selectedYtId = ref<number | null>(null);

// 直接设置目标定值 (Direct Set Value)
const targetSetValue = ref<number>(5.0);

// Associated Verification Point (只读展示，在数据关联时已配置)
const boundVerificationYcId = ref<number | null>(null);

// ---------------- 2. Virtual Users & Simulated Password Verification ----------------
const virtualUsers = [
  { id: '111', name: '用户 111 (操作员)' },
  { id: '222', name: '用户 222 (主值班员)' },
  { id: 'zzz', name: '用户 zzz (监护主管)' }
];
const operatorUser = ref<string>('111');
const operatorPassword = ref<string>('');
const isOperVerified = ref<boolean>(false);

const supervisorUser = ref<string>('222');
const supervisorPassword = ref<string>('');
const isMonVerified = ref<boolean>(false);

const authErrorMessage = ref<string>('');

// ---------------- 3. Execution State & 30s Countdown ----------------
// 0: Initial, 1: Pre-set success (AO SBO Ack), 2: Executing (AO Sending), 3: Success, 4: Failed/Timeout
const execState = ref<number>(0);
const isWaitingResponse = ref<boolean>(false);
const executionStatusMsg = ref<string>('请先完成双人身份口令核验，再下发遥调预置');
const remainingTime = ref<number>(30);
let timerHandle: any = null;

// ---------------- Computeds for Current Device Hierarchy ----------------
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

const availableYtPoints = computed<ScadaYtItem[]>(() => {
  const dev = currentDevice.value;
  return dev?.yt_list || dev?.yt_points || [];
});

const activeYtPoint = computed<ScadaYtItem | undefined>(() => {
  if (selectedYtId.value) {
    const pDef = findScadaPointDef(selectedYtId.value);
    if (pDef.point) return pDef.point as ScadaYtItem;
  }
  return availableYtPoints.value.find(p => p.id === selectedYtId.value) || availableYtPoints.value[0];
});

// Bound Verification Point Info (只读展示绑定的返校点定义)
const boundVerificationPointDef = computed(() => {
  const _ = scadaLiveTick.value;
  const vId = boundVerificationYcId.value || activeYtPoint.value?.targetVerificationPointId;
  if (!vId) return null;
  return findScadaPointDef(Number(vId));
});

// Current Live Value of Selected Verification Point
const currentLiveValue = computed<number>(() => {
  const _ = scadaLiveTick.value;
  const vId = boundVerificationYcId.value || activeYtPoint.value?.targetVerificationPointId;
  if (vId) {
    return rawYcValues.get(Number(vId)) ?? 0.0;
  }
  return 0.0;
});

const currentLiveValueText = computed<string>(() => {
  const _ = scadaLiveTick.value;
  const vId = boundVerificationYcId.value || activeYtPoint.value?.targetVerificationPointId;
  if (vId) {
    const val = rawYcValues.get(Number(vId));
    const unit = activeYtPoint.value?.unit || boundVerificationPointDef.value?.point?.unit || 'MW';
    if (val !== undefined && val !== null) {
      return `${Number(val).toFixed(2)} ${unit}`;
    }
    return `0.00 ${unit}`;
  }
  return '未配置返校';
});

// Operation List Preview String (操作序列预览)
const operationListText = computed<string>(() => {
  const facName = currentFacility.value?.fac_name || currentFacility.value?.name || '';
  const devName = currentDevice.value?.dev_name || currentDevice.value?.name || '';
  const ytName = activeYtPoint.value?.name || (selectedYtId.value ? `遥调测点_${selectedYtId.value}` : '遥调');
  const unit = activeYtPoint.value?.unit || '';
  return `${facName} ➜ ${devName} ➜ ${ytName} ➜ 定值调节 【${targetSetValue.value} ${unit}】`;
});

// ---------------- Dual-Person Password Verification Handlers ----------------
const handleVerifyOperator = () => {
  if (operatorUser.value === supervisorUser.value) {
    authErrorMessage.value = '操作人与监护人不能为同一用户！请重新选择。';
    isOperVerified.value = false;
    return;
  }
  authErrorMessage.value = '';
  isOperVerified.value = true;
  if (isMonVerified.value) {
    executionStatusMsg.value = '双人核验已通过，请点击【1. 下发遥调预置】';
  }
};

const handleVerifySupervisor = () => {
  if (operatorUser.value === supervisorUser.value) {
    authErrorMessage.value = '监护人与操作人不能为同一用户！请重新选择。';
    isMonVerified.value = false;
    return;
  }
  authErrorMessage.value = '';
  isMonVerified.value = true;
  if (isOperVerified.value) {
    executionStatusMsg.value = '双人核验已通过，请点击【1. 下发遥调预置】';
  }
};

const handleOperatorChange = () => {
  isOperVerified.value = false;
  authErrorMessage.value = '';
};

const handleSupervisorChange = () => {
  isMonVerified.value = false;
  authErrorMessage.value = '';
};

// ---------------- 4. Handle AO SBO (遥调预置: oper 始终为 adjust，直接设值) ----------------
const handlePrevProc = async () => {
  if (!isOperVerified.value || !isMonVerified.value) {
    authErrorMessage.value = '请先完成操作人与监护人的身份核验！';
    return;
  }
  if (operatorUser.value === supervisorUser.value) {
    authErrorMessage.value = '操作人与监护人不能为同一用户！';
    return;
  }
  
  const ytId = selectedYtId.value || activeYtPoint.value?.id;
  if (!ytId) {
    executionStatusMsg.value = '未检测到有效的遥调测点编号！';
    return;
  }

  isWaitingResponse.value = true;
  executionStatusMsg.value = '正在下发遥调预置指令...';

  const oldVal = currentLiveValue.value;
  const targetVal = targetSetValue.value;

  try {
    const res = await sendScadaYt({
      yt_id: ytId,
      action: 'prev',
      oper: 'adjust',
      val: targetVal,
      old_val: oldVal,
      oper_name: 'http_admin'
    });

    if (res.success) {
      execState.value = 1;
      executionStatusMsg.value = `✓ 遥调预置成功！前置机已锁定目标值 [${targetVal}]，请确认执行。`;
    } else {
      execState.value = 4;
      executionStatusMsg.value = '遥调预置失败: ' + (res.error || res.msg || '前置机未响应');
    }
  } catch (err: any) {
    execState.value = 4;
    executionStatusMsg.value = '遥调通信异常: ' + err.message;
  } finally {
    isWaitingResponse.value = false;
  }
};

// ---------------- 5. Handle AO Execution (遥调执行: oper 始终为 adjust，直接设值并 30s 校验) ----------------
const handleExecProc = async () => {
  if (execState.value !== 1) return;
  const ytId = selectedYtId.value || activeYtPoint.value?.id;
  if (!ytId) return;

  const verifId = boundVerificationYcId.value || activeYtPoint.value?.targetVerificationPointId;
  const oldVal = currentLiveValue.value;
  const targetVal = targetSetValue.value;

  isWaitingResponse.value = true;
  execState.value = 2; // 执行中
  remainingTime.value = 30; // 30秒倒计时
  executionStatusMsg.value = '遥调执行指令已下发，正在进行 30s 闭环返校采样值校验...';

  // Start 30s countdown
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    if (remainingTime.value > 0) {
      remainingTime.value--;
    } else {
      clearInterval(timerHandle);
    }
  }, 1000);

  // Execute closed-loop verification
  const res = await executeClosedLoopControl({
    type: 'yt',
    pointId: ytId,
    action: 'direct',
    ytOper: 'adjust',
    ytVal: targetVal,
    ytOldVal: oldVal,
    oper_name: 'http_admin',
    targetVerificationPointId: verifId ? Number(verifId) : undefined,
    targetVerificationType: 'yc',
    verificationTimeoutMs: 30000,
    onProgress: (info) => {
      executionStatusMsg.value = info.step;
    }
  });

  if (timerHandle) clearInterval(timerHandle);
  isWaitingResponse.value = false;

  if (res.success) {
    execState.value = 3;
    executionStatusMsg.value = `✓ 遥调执行成功！${res.message}`;
    emit('success', {
      ytId,
      targetValue: targetVal,
      message: res.message
    });
  } else {
    execState.value = 4;
    executionStatusMsg.value = `✗ 遥调执行失败/返校超时: ${res.message}`;
  }
};

// Step helpers
const adjustTargetValue = (delta: number) => {
  targetSetValue.value = Number((targetSetValue.value + delta).toFixed(2));
  execState.value = 0;
};

// Reset & Initialize State
const initFromProps = () => {
  execState.value = 0;
  operatorUser.value = '111';
  supervisorUser.value = '222';
  operatorPassword.value = '';
  supervisorPassword.value = '';
  isOperVerified.value = false;
  isMonVerified.value = false;
  authErrorMessage.value = '';
  isWaitingResponse.value = false;
  executionStatusMsg.value = '请先完成双人身份口令核验，再下发遥调预置';
  remainingTime.value = 30;

  if (props.initialTargetValue !== undefined) {
    targetSetValue.value = props.initialTargetValue;
  }

  // 1. If point ID is provided, look up full point definition immediately
  if (props.initialPointId) {
    const ptId = Number(props.initialPointId);
    if (!isNaN(ptId)) {
      selectedYtId.value = ptId;
      const pDef = findScadaPointDef(ptId);
      if (pDef.category !== 'none') {
        if (pDef.facility) selectedFacId.value = pDef.facility.fac_id || pDef.facility.id || selectedFacId.value;
        if (pDef.bay) selectedBayId.value = pDef.bay.bay_id || pDef.bay.id || selectedBayId.value;
        if (pDef.device) selectedDevId.value = pDef.device.dev_id || pDef.device.id || selectedDevId.value;
      } else {
        // Fallback exhaustive search across all facilities
        scadaFacilities.value.forEach(fac => {
          fac.bays?.forEach(bay => {
            const devs = bay.devices || bay.cb_devices || [];
            devs.forEach(dev => {
              const ytPts = dev.yt_list || dev.yt_points || [];
              const foundPt = ytPts.find(p => p.id === ptId);
              if (foundPt) {
                selectedFacId.value = fac.fac_id || fac.id;
                selectedBayId.value = bay.bay_id || bay.id;
                selectedDevId.value = dev.dev_id || dev.id;
              }
            });
          });
        });
      }
    }
  } else if (availableYtPoints.value[0]) {
    selectedYtId.value = availableYtPoints.value[0].id;
  }

  // 2. Set device if passed and point not resolved
  if (props.initialDeviceId && !props.initialPointId) {
    scadaFacilities.value.forEach(fac => {
      fac.bays?.forEach(bay => {
        const devs = bay.devices || bay.cb_devices || [];
        const found = devs.find(d => String(d.dev_id || d.id) === String(props.initialDeviceId));
        if (found) {
          selectedFacId.value = fac.fac_id || fac.id;
          selectedBayId.value = bay.bay_id || bay.id;
          selectedDevId.value = found.dev_id || found.id;
          if (found.yt_list?.[0] || found.yt_points?.[0]) {
            selectedYtId.value = (found.yt_list?.[0] || found.yt_points?.[0]).id;
          }
        }
      });
    });
  }

  // 3. Set verification point
  if (props.initialTargetVerificationPointId && !isNaN(Number(props.initialTargetVerificationPointId))) {
    boundVerificationYcId.value = Number(props.initialTargetVerificationPointId);
  } else if (selectedYtId.value) {
    const pDef = findScadaPointDef(selectedYtId.value);
    const vId = pDef.point?.targetVerificationPointId || pDef.point?.targetYcPointId;
    if (vId && !isNaN(Number(vId))) {
      boundVerificationYcId.value = Number(vId);
    } else {
      boundVerificationYcId.value = null;
    }
  } else {
    boundVerificationYcId.value = null;
  }
};

// 统一极简监听：仅监听 4 个基础数值与状态属性，零深层遍历，在 Electron / 凝思等国产 Linux 环境下零 CPU 额外开销
watch(
  () => [props.visible, props.initialPointId, props.initialDeviceId, props.initialTargetVerificationPointId] as const,
  ([visible]) => {
    if (visible) {
      initFromProps();
    } else {
      if (timerHandle) clearInterval(timerHandle);
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (props.visible) {
    initFromProps();
  }
});

onBeforeUnmount(() => {
  if (timerHandle) clearInterval(timerHandle);
});
</script>

<template>
  <div
    v-if="visible"
    id="scada-teleregulation-dialog"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none font-sans text-slate-100"
    style="transform: translateZ(0); will-change: transform;"
  >
    <!-- Main Industrial AO Dialog (纯净工控风格，无顶部/底部接口字样) -->
    <div
      class="bg-[#1e293b] border border-slate-600 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col"
      style="contain: paint layout;"
    >
      <!-- Titlebar: 纯净标题栏 -->
      <div class="px-5 py-3.5 bg-[#0f172a] border-b border-slate-700 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-3 h-3 rounded-full bg-sky-400"></div>
          <span class="text-base font-bold text-white tracking-wide">
            遥调定值设置 (Direct Regulation)
          </span>
        </div>
        <button
          class="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
          @click="emit('close')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Main Body: 3-Column Clean Industrial Layout -->
      <div class="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#1e293b]">
        <!-- 1. 遥调定值设置 (直接设置目标数值，无升降模式) -->
        <div class="border border-slate-700 rounded-lg p-4 bg-[#0f172a] flex flex-col justify-between">
          <div>
            <div class="text-white font-bold text-sm pb-2 mb-3 border-b border-slate-800 flex items-center justify-between">
              <span>1. 遥调定值设定</span>
              <span class="text-xs text-slate-400 font-mono">第 1 步</span>
            </div>

            <div class="space-y-3">
              <!-- Substation & Device -->
              <div>
                <label class="text-xs font-medium text-slate-400 block mb-1">所属厂站与设备:</label>
                <div class="bg-[#1e293b] border border-slate-700 rounded px-3 py-2 text-white font-medium text-xs truncate">
                  {{ currentFacility?.fac_name || currentFacility?.name }} · {{ currentDevice?.dev_name || currentDevice?.name }}
                </div>
              </div>

              <!-- Current Value -->
              <div>
                <label class="text-xs font-medium text-slate-400 block mb-1">当前采样基准值 (old_val):</label>
                <div class="bg-[#1e293b] border border-slate-700 rounded px-3 py-2 text-white font-mono font-bold text-sm flex items-center justify-between">
                  <span class="text-amber-300">{{ currentLiveValueText }}</span>
                  <span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">实时数据</span>
                </div>
              </div>

              <!-- Direct Target Set Value Input (直接设定目标值) -->
              <div>
                <label class="text-xs font-medium text-sky-300 block mb-1">
                  目标调节定值 (val):
                </label>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center justify-center border border-slate-600 cursor-pointer font-bold active:scale-95"
                    @click="adjustTargetValue(-1)"
                  >
                    <Minus class="w-4 h-4" />
                  </button>

                  <div class="flex-1 relative">
                    <input
                      v-model.number="targetSetValue"
                      type="number"
                      step="0.1"
                      class="w-full bg-[#1e293b] border-2 border-sky-400 rounded-lg px-3 py-2 text-center text-white font-mono text-lg font-black focus:outline-none focus:border-sky-300"
                      @input="execState = 0"
                    />
                    <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">
                      {{ activeYtPoint?.unit || '' }}
                    </span>
                  </div>

                  <button
                    type="button"
                    class="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center justify-center border border-slate-600 cursor-pointer font-bold active:scale-95"
                    @click="adjustTargetValue(1)"
                  >
                    <Plus class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- YT Point ID & Alias -->
              <div>
                <label class="text-xs font-medium text-slate-400 block mb-1">遥调测点编号:</label>
                <div class="bg-[#1e293b] border border-slate-700 rounded px-3 py-2 text-slate-200 font-mono text-xs">
                  <span class="text-amber-300 font-bold">[{{ selectedYtId || activeYtPoint?.id || '未指定' }}]</span>
                  <span class="ml-1 text-white font-medium">{{ activeYtPoint?.name || '遥调控制测点' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Operation Preview -->
          <div class="mt-3 p-2.5 bg-[#1e293b] border border-slate-700 rounded">
            <span class="text-[11px] text-slate-400 block mb-0.5">指令序列预览:</span>
            <span class="text-xs font-mono text-sky-200 font-medium leading-relaxed">
              {{ operationListText }}
            </span>
          </div>
        </div>

        <!-- 2. 双人口令核验 & 返校点只读展示 -->
        <div class="border border-slate-700 rounded-lg p-4 bg-[#0f172a] flex flex-col justify-between">
          <div>
            <div class="text-white font-bold text-sm pb-2 mb-3 border-b border-slate-800 flex items-center justify-between">
              <span>2. 身份核验与返校点</span>
              <span class="text-xs text-slate-400 font-mono">第 2 步</span>
            </div>

            <div class="space-y-3">
              <!-- 1. Operator Selection with Password Input -->
              <div class="p-2.5 rounded-lg bg-[#1e293b] border border-slate-700 space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <UserCheck class="w-3.5 h-3.5 text-sky-400" />
                    <span>操作人 (Operator)</span>
                  </label>
                  <span
                    class="text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1"
                    :class="isOperVerified ? 'bg-emerald-950 text-emerald-300 border border-emerald-500' : 'bg-amber-950 text-amber-300 border border-amber-600'"
                  >
                    <CheckCircle2 v-if="isOperVerified" class="w-3 h-3" />
                    <span>{{ isOperVerified ? '已通过核验' : '待口令核验' }}</span>
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <select
                    v-model="operatorUser"
                    class="w-1/2 bg-[#0f172a] border border-slate-600 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-400 cursor-pointer"
                    @change="handleOperatorChange"
                  >
                    <option v-for="u in virtualUsers" :key="u.id" :value="u.id">
                      {{ u.name }}
                    </option>
                  </select>

                  <input
                    v-model="operatorPassword"
                    type="password"
                    placeholder="请输入口令"
                    class="w-1/2 bg-[#0f172a] border border-slate-600 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-400"
                    @keyup.enter="handleVerifyOperator"
                  />
                </div>

                <button
                  type="button"
                  class="w-full py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer"
                  :class="isOperVerified ? 'bg-emerald-800/80 border-emerald-500 text-emerald-100 hover:bg-emerald-700' : 'bg-sky-600 hover:bg-sky-500 border-sky-400 text-white shadow-md'"
                  @click="handleVerifyOperator"
                >
                  <Check class="w-3.5 h-3.5" />
                  <span>{{ isOperVerified ? '重新核验操作人' : '确认操作人身份 (验证)' }}</span>
                </button>
              </div>

              <!-- 2. Supervisor Selection with Password Input -->
              <div class="p-2.5 rounded-lg bg-[#1e293b] border border-slate-700 space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <KeyRound class="w-3.5 h-3.5 text-indigo-400" />
                    <span>监护人 (Supervisor)</span>
                  </label>
                  <span
                    class="text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1"
                    :class="isMonVerified ? 'bg-emerald-950 text-emerald-300 border border-emerald-500' : 'bg-amber-950 text-amber-300 border border-amber-600'"
                  >
                    <CheckCircle2 v-if="isMonVerified" class="w-3 h-3" />
                    <span>{{ isMonVerified ? '已通过核验' : '待口令核验' }}</span>
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <select
                    v-model="supervisorUser"
                    class="w-1/2 bg-[#0f172a] border border-slate-600 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-400 cursor-pointer"
                    @change="handleSupervisorChange"
                  >
                    <option v-for="u in virtualUsers" :key="u.id" :value="u.id">
                      {{ u.name }}
                    </option>
                  </select>

                  <input
                    v-model="supervisorPassword"
                    type="password"
                    placeholder="请输入口令"
                    class="w-1/2 bg-[#0f172a] border border-slate-600 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-400"
                    @keyup.enter="handleVerifySupervisor"
                  />
                </div>

                <button
                  type="button"
                  class="w-full py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer"
                  :class="isMonVerified ? 'bg-emerald-800/80 border-emerald-500 text-emerald-100 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white shadow-md'"
                  @click="handleVerifySupervisor"
                >
                  <Check class="w-3.5 h-3.5" />
                  <span>{{ isMonVerified ? '重新核验监护人' : '确认监护人身份 (验证)' }}</span>
                </button>
              </div>

              <div v-if="authErrorMessage" class="text-rose-400 text-xs bg-rose-950/60 border border-rose-800 rounded p-2">
                * {{ authErrorMessage }}
              </div>

              <!-- Bound Verification Point Read-Only Display -->
              <div class="pt-2 border-t border-slate-800">
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-medium text-slate-400">
                    绑定的闭环返校遥测点:
                  </label>
                  <span class="text-[11px] text-slate-400 font-mono">30s 时限</span>
                </div>

                <div class="p-2.5 rounded bg-[#1e293b] border border-slate-700">
                  <div v-if="boundVerificationPointDef?.point" class="text-xs font-mono text-slate-200 space-y-0.5">
                    <div class="text-slate-400 font-sans text-[11px]">
                      {{ boundVerificationPointDef.facility?.fac_name || boundVerificationPointDef.facility?.name }} · {{ boundVerificationPointDef.device?.dev_name || boundVerificationPointDef.device?.name }}
                    </div>
                    <div class="text-white font-medium">
                      [YC_{{ boundVerificationPointDef.point.id }}] {{ boundVerificationPointDef.point.name }}
                    </div>
                  </div>
                  <div v-else-if="boundVerificationYcId" class="text-xs font-mono text-white">
                    [YC_{{ boundVerificationYcId }}] 闭环返校采样点 (点号: {{ boundVerificationYcId }})
                  </div>
                  <div v-else class="text-xs text-slate-400 font-sans">
                    未配置专属返校校验点
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3 text-xs text-slate-400 bg-[#1e293b] p-2 rounded border border-slate-700">
            核验状态: 操作员 [{{ isOperVerified ? '已通过' : '未验证' }}] + 监护人 [{{ isMonVerified ? '已通过' : '未验证' }}]
          </div>
        </div>

        <!-- 3. 遥调预置与遥调执行 -->
        <div class="border border-slate-700 rounded-lg p-4 bg-[#0f172a] flex flex-col justify-between">
          <div>
            <div class="text-white font-bold text-sm pb-2 mb-3 border-b border-slate-800 flex items-center justify-between">
              <span>3. 下发与闭环校验</span>
              <span class="text-xs text-slate-400 font-mono">第 3 步</span>
            </div>

            <div class="space-y-3 mt-2">
              <!-- AO SBO Button (双人核验通过后可点击) -->
              <button
                type="button"
                :disabled="!isOperVerified || !isMonVerified || execState >= 1 || isWaitingResponse"
                class="w-full py-2.5 px-4 rounded font-bold text-xs flex items-center justify-center gap-2 border transition-colors cursor-pointer"
                :class="(!isOperVerified || !isMonVerified || execState >= 1)
                  ? 'opacity-50 bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white'"
                @click="handlePrevProc"
              >
                <RefreshCw v-if="isWaitingResponse && execState === 0" class="w-4 h-4 animate-spin" />
                <Check v-else-if="execState >= 1" class="w-4 h-4 text-emerald-300 stroke-[3]" />
                <span>{{ execState >= 1 ? '✓ 遥调预置成功' : '1. 下发遥调预置' }}</span>
              </button>

              <!-- AO Execution Button -->
              <button
                type="button"
                :disabled="execState !== 1 || isWaitingResponse"
                class="w-full py-3 px-4 rounded font-bold text-sm flex items-center justify-center gap-2 border transition-colors cursor-pointer"
                :class="execState !== 1
                  ? 'opacity-40 bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-rose-700 hover:bg-rose-600 border-rose-400 text-white'"
                @click="handleExecProc"
              >
                <RefreshCw v-if="isWaitingResponse && execState === 2" class="w-4 h-4 animate-spin" />
                <CheckCircle2 v-else-if="execState === 3" class="w-4 h-4 text-emerald-300" />
                <span>{{ execState === 3 ? '✓ 遥调执行成功' : '2. 确认遥调执行' }}</span>
              </button>
            </div>
          </div>

          <!-- 30s Countdown & Status Dashboard -->
          <div class="mt-4 p-3 rounded bg-[#1e293b] border border-slate-700 text-center">
            <!-- 30s Countdown -->
            <div v-if="isWaitingResponse || execState === 2" class="mb-1">
              <span class="text-xs text-slate-400 block mb-0.5">返校采样达标倒计时 (30s):</span>
              <span class="text-2xl font-mono font-bold text-white tracking-wider">
                {{ remainingTime }}s
              </span>
            </div>

            <div
              class="text-xs font-mono leading-relaxed mt-1"
              :class="execState === 3 ? 'text-emerald-400 font-bold' : (execState === 4 ? 'text-rose-400 font-bold' : 'text-slate-300')"
            >
              {{ executionStatusMsg }}
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Bar (纯净底栏，无接口信息) -->
      <div class="px-5 py-3 bg-[#0f172a] border-t border-slate-700 flex items-center justify-between">
        <span class="text-xs text-slate-400 font-medium">
          请在两名值班人员输入口令核验确认后，依序执行遥调定值预置与执行操作。
        </span>
        <button
          type="button"
          class="px-6 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg font-medium text-xs transition-colors cursor-pointer"
          @click="emit('close')"
        >
          关闭窗口
        </button>
      </div>
    </div>
  </div>
</template>
