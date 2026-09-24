<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  X, Check, AlertCircle, CheckCircle2, RefreshCw,
  KeyRound, UserCheck, ShieldCheck
} from 'lucide-vue-next';
import {
  ScadaFacilityNode,
  ScadaBayNode,
  ScadaDeviceNode,
  ScadaYkItem
} from '../types';
import {
  scadaFacilities,
  rawYxValues,
  scadaLiveTick,
  sendScadaYk,
  executeClosedLoopControl,
  findScadaPointDef
} from '../utils/scadaClient';

interface Props {
  visible: boolean;
  initialPointId?: number | string | null;
  initialDeviceId?: number | string | null;
  initialTargetVerificationPointId?: number | string | null;
  initialState?: number; // 1 (合) | 0 (分)
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  initialPointId: null,
  initialDeviceId: null,
  initialTargetVerificationPointId: null,
  initialState: 1
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', payload: any): void;
}>();

// ---------------- 1. SCADA Device & Hierarchy ----------------
const selectedFacId = ref<number | string>(scadaFacilities.value[0]?.fac_id || 4000003);
const selectedBayId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.bay_id || 430000001);
const selectedDevId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.devices?.[0]?.dev_id || 7000001);

// Selected YK Point
const selectedYkId = ref<number | null>(null);

// Selected Operation: 1 = 合闸 (Close), 0 = 分闸 (Open)
const selectedOperation = ref<number>(1);

// Associated Verification Point (只读展示，在数据关联时已配置)
const boundVerificationYxId = ref<number | null>(null);

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
// 0: Initial, 1: Pre-set success (SO SBO Ack), 2: Executing (DO Sending), 3: Success, 4: Failed/Timeout
const execState = ref<number>(0);
const isWaitingResponse = ref<boolean>(false);
const executionStatusMsg = ref<string>('请先完成双人身份口令核验，再下发遥控预置');
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

const availableYkPoints = computed<ScadaYkItem[]>(() => {
  const dev = currentDevice.value;
  return dev?.yk_list || dev?.yk_points || [];
});

const activeYkPoint = computed<ScadaYkItem | undefined>(() => {
  if (selectedYkId.value) {
    const pDef = findScadaPointDef(selectedYkId.value);
    if (pDef.point) return pDef.point as ScadaYkItem;
  }
  return availableYkPoints.value.find(p => p.id === selectedYkId.value) || availableYkPoints.value[0];
});

// Bound Verification Point Info (只读展示绑定的返校点定义)
const boundVerificationPointDef = computed(() => {
  const _ = scadaLiveTick.value;
  const vId = boundVerificationYxId.value || activeYkPoint.value?.targetVerificationPointId;
  if (!vId) return null;
  return findScadaPointDef(Number(vId));
});

// Current Live State of Bound Verification Point
const currentLiveStateText = computed<string>(() => {
  const _ = scadaLiveTick.value;
  const vId = boundVerificationYxId.value || activeYkPoint.value?.targetVerificationPointId;
  if (vId) {
    const val = rawYxValues.get(Number(vId));
    if (val === 1) return '合闸 (1)';
    if (val === 0) return '分闸 (0)';
    return `状态 (${val})`;
  }
  return '未配置返校';
});

// Operation List Preview String (操作序列预览)
const operationListText = computed<string>(() => {
  const facName = currentFacility.value?.fac_name || currentFacility.value?.name || '';
  const devName = currentDevice.value?.dev_name || currentDevice.value?.name || '';
  const ykName = activeYkPoint.value?.name || (selectedYkId.value ? `遥控测点_${selectedYkId.value}` : '遥控');
  const opName = selectedOperation.value === 1 ? '合闸 (Close)' : '分闸 (Open)';
  return `${facName} ➜ ${devName} ➜ ${ykName} ➜ 【${opName}】`;
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
    executionStatusMsg.value = '双人核验已通过，请点击【1. 下发遥控预置】';
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
    executionStatusMsg.value = '双人核验已通过，请点击【1. 下发遥控预置】';
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

// ---------------- 4. Handle SO SBO (遥控预置：只要收到HTTP返回成功即算成功) ----------------
const handlePrevProc = async () => {
  if (!isOperVerified.value || !isMonVerified.value) {
    authErrorMessage.value = '请先完成操作人与监护人的身份口令核验！';
    return;
  }
  if (operatorUser.value === supervisorUser.value) {
    authErrorMessage.value = '操作人与监护人不能为同一用户！';
    return;
  }
  
  const ykId = selectedYkId.value || activeYkPoint.value?.id;
  if (!ykId) {
    executionStatusMsg.value = '未检测到有效的遥控测点编号！';
    return;
  }

  isWaitingResponse.value = true;
  executionStatusMsg.value = '正在下发遥控预置指令...';

  const targetState = selectedOperation.value === 1 ? 'close' : 'open';

  try {
    const res = await sendScadaYk({
      yk_id: ykId,
      action: 'prev',
      state: targetState
    });

    if (res.success) {
      execState.value = 1;
      executionStatusMsg.value = '✓ 遥控预置成功！前置机已锁定目标对象，请确认执行。';
    } else {
      execState.value = 4;
      executionStatusMsg.value = '遥控预置失败: ' + (res.error || res.msg || '前置机未响应');
    }
  } catch (err: any) {
    execState.value = 4;
    executionStatusMsg.value = '遥控通信异常: ' + err.message;
  } finally {
    isWaitingResponse.value = false;
  }
};

// ---------------- 5. Handle DO Execution (遥控执行：严格下发 action: exec，并开始 30s 校验) ----------------
const handleExecProc = async () => {
  if (execState.value !== 1) return;
  const ykId = selectedYkId.value || activeYkPoint.value?.id;
  if (!ykId) return;

  const targetState = selectedOperation.value === 1 ? 'close' : 'open';
  const verifId = boundVerificationYxId.value || activeYkPoint.value?.targetVerificationPointId;

  isWaitingResponse.value = true;
  execState.value = 2; // 执行中
  remainingTime.value = 30; // 30秒倒计时
  executionStatusMsg.value = '遥控执行指令已下发，正在进行 30s 闭环返校变位校验...';

  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    if (remainingTime.value > 0) {
      remainingTime.value--;
    } else {
      clearInterval(timerHandle);
    }
  }, 1000);

  const res = await executeClosedLoopControl({
    type: 'yk',
    pointId: ykId,
    action: 'direct',
    ykState: targetState,
    targetVerificationPointId: verifId ? Number(verifId) : undefined,
    targetVerificationType: 'yx',
    verificationTimeoutMs: 30000,
    onProgress: (info) => {
      executionStatusMsg.value = info.step;
    }
  });

  if (timerHandle) clearInterval(timerHandle);
  isWaitingResponse.value = false;

  if (res.success) {
    execState.value = 3;
    executionStatusMsg.value = `✓ 遥控执行成功！${res.message}`;
    emit('success', {
      ykId,
      operation: selectedOperation.value,
      message: res.message
    });
  } else {
    execState.value = 4;
    executionStatusMsg.value = `✗ 遥控执行失败/返校超时: ${res.message}`;
  }
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
  executionStatusMsg.value = '请先完成双人身份口令核验，再下发遥控预置';
  remainingTime.value = 30;

  if (props.initialState !== undefined) {
    selectedOperation.value = props.initialState;
  }

  // 1. If point ID is provided, look up full point definition immediately
  if (props.initialPointId) {
    const ptId = Number(props.initialPointId);
    if (!isNaN(ptId)) {
      selectedYkId.value = ptId;
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
              const ykPts = dev.yk_list || dev.yk_points || [];
              const foundPt = ykPts.find(p => p.id === ptId);
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
  } else if (availableYkPoints.value[0]) {
    selectedYkId.value = availableYkPoints.value[0].id;
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
          if (found.yk_list?.[0] || found.yk_points?.[0]) {
            selectedYkId.value = (found.yk_list?.[0] || found.yk_points?.[0]).id;
          }
        }
      });
    });
  }

  // 3. Set verification point
  if (props.initialTargetVerificationPointId && !isNaN(Number(props.initialTargetVerificationPointId))) {
    boundVerificationYxId.value = Number(props.initialTargetVerificationPointId);
  } else if (selectedYkId.value) {
    const pDef = findScadaPointDef(selectedYkId.value);
    const vId = pDef.point?.targetVerificationPointId || pDef.point?.targetYxPointId;
    if (vId && !isNaN(Number(vId))) {
      boundVerificationYxId.value = Number(vId);
    } else {
      boundVerificationYxId.value = null;
    }
  } else {
    boundVerificationYxId.value = null;
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
    id="scada-telecontrol-dialog"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none font-sans text-slate-100"
    style="transform: translateZ(0); will-change: transform;"
  >
    <!-- Main Industrial DO Dialog (专业工控纯净配色，去除顶部/底部接口字样) -->
    <div
      class="bg-[#1e293b] border border-slate-600 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col"
      style="contain: paint layout;"
    >
      <!-- Titlebar: 纯净标题栏 -->
      <div class="px-5 py-3.5 bg-[#0f172a] border-b border-slate-700 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-3 h-3 rounded-full bg-rose-500"></div>
          <span class="text-base font-bold text-white tracking-wide">
            遥控操作执行 (Tele-Control Execution)
          </span>
        </div>
        <button
          class="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
          @click="emit('close')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Main Body: 3-Column Clean Layout -->
      <div class="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#1e293b]">
        <!-- 1. 遥控对象信息 -->
        <div class="border border-slate-700 rounded-lg p-4 bg-[#0f172a] flex flex-col justify-between">
          <div>
            <div class="text-white font-bold text-sm pb-2 mb-3 border-b border-slate-800 flex items-center justify-between">
              <span>1. 遥控对象信息</span>
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

              <!-- Switch Live State -->
              <div>
                <label class="text-xs font-medium text-slate-400 block mb-1">当前遥信采样状态:</label>
                <div
                  class="flex items-center justify-between bg-[#1e293b] border rounded px-3 py-2 font-mono font-bold text-xs"
                  :class="currentLiveStateText.includes('合') ? 'border-rose-600/60 text-rose-300' : 'border-emerald-600/60 text-emerald-300'"
                >
                  <span>{{ currentLiveStateText }}</span>
                  <span
                    class="w-2.5 h-2.5 rounded-full"
                    :class="currentLiveStateText.includes('合') ? 'bg-rose-500' : 'bg-emerald-500'"
                  ></span>
                </div>
              </div>

              <!-- Operation Choice (合闸 / 分闸) -->
              <div>
                <label class="text-xs font-medium text-slate-400 block mb-1">操作选择:</label>
                <div class="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    class="py-2.5 px-3 rounded font-bold text-xs transition-colors flex items-center justify-center gap-1.5 border cursor-pointer"
                    :class="selectedOperation === 1 ? 'bg-rose-700 border-rose-500 text-white' : 'bg-[#1e293b] border-slate-700 text-slate-300 hover:bg-slate-800'"
                    @click="selectedOperation = 1; execState = 0;"
                  >
                    <span>合 闸 (Close)</span>
                  </button>

                  <button
                    type="button"
                    class="py-2.5 px-3 rounded font-bold text-xs transition-colors flex items-center justify-center gap-1.5 border cursor-pointer"
                    :class="selectedOperation === 0 ? 'bg-emerald-700 border-emerald-500 text-white' : 'bg-[#1e293b] border-slate-700 text-slate-300 hover:bg-slate-800'"
                    @click="selectedOperation = 0; execState = 0;"
                  >
                    <span>分 闸 (Open)</span>
                  </button>
                </div>
              </div>

              <!-- YK Point ID & Alias -->
              <div>
                <label class="text-xs font-medium text-slate-400 block mb-1">遥控测点编号:</label>
                <div class="bg-[#1e293b] border border-slate-700 rounded px-3 py-2 text-slate-200 font-mono text-xs">
                  <span class="text-amber-300 font-bold">[{{ selectedYkId || activeYkPoint?.id || '未指定' }}]</span>
                  <span class="ml-1 text-white font-medium">{{ activeYkPoint?.name || '遥控控制测点' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Operation Preview -->
          <div class="mt-3 p-2.5 bg-[#1e293b] border border-slate-700 rounded">
            <span class="text-[11px] text-slate-400 block mb-0.5">指令序列预览:</span>
            <span class="text-xs font-mono text-slate-200 font-medium leading-relaxed">
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
                    绑定的闭环返校遥信点:
                  </label>
                  <span class="text-[11px] text-slate-400 font-mono">30s 时限</span>
                </div>

                <div class="p-2.5 rounded bg-[#1e293b] border border-slate-700">
                  <div v-if="boundVerificationPointDef?.point" class="text-xs font-mono text-slate-200 space-y-0.5">
                    <div class="text-slate-400 font-sans text-[11px]">
                      {{ boundVerificationPointDef.facility?.fac_name || boundVerificationPointDef.facility?.name }} · {{ boundVerificationPointDef.device?.dev_name || boundVerificationPointDef.device?.name }}
                    </div>
                    <div class="text-white font-medium">
                      [YX_{{ boundVerificationPointDef.point.id }}] {{ boundVerificationPointDef.point.name }}
                    </div>
                  </div>
                  <div v-else-if="boundVerificationYxId" class="text-xs font-mono text-white">
                    [YX_{{ boundVerificationYxId }}] 闭环返校变位点 (点号: {{ boundVerificationYxId }})
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

        <!-- 3. 遥控预置与遥控执行 -->
        <div class="border border-slate-700 rounded-lg p-4 bg-[#0f172a] flex flex-col justify-between">
          <div>
            <div class="text-white font-bold text-sm pb-2 mb-3 border-b border-slate-800 flex items-center justify-between">
              <span>3. 下发与闭环校验</span>
              <span class="text-xs text-slate-400 font-mono">第 3 步</span>
            </div>

            <div class="space-y-3 mt-2">
              <!-- SO SBO Button -->
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
                <span>{{ execState >= 1 ? '✓ 遥控预置成功' : '1. 下发遥控预置' }}</span>
              </button>

              <!-- DO Execution Button -->
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
                <span>{{ execState === 3 ? '✓ 遥控执行成功' : '2. 确认遥控执行' }}</span>
              </button>
            </div>
          </div>

          <!-- 30s Countdown & Status Dashboard -->
          <div class="mt-4 p-3 rounded bg-[#1e293b] border border-slate-700 text-center">
            <!-- 30s Countdown -->
            <div v-if="isWaitingResponse || execState === 2" class="mb-1">
              <span class="text-xs text-slate-400 block mb-0.5">返校变位校验倒计时 (30s):</span>
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
          请在两名值班人员输入口令核验确认后，依序执行遥控预置与执行操作。
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
