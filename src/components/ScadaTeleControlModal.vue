<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  X, Check, CheckCircle2, RefreshCw,
  KeyRound, UserCheck
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

// ---------------- 1. 拖拽与窗口位置管理 ----------------
const modalPos = ref({ x: 0, y: 0 });
const isDragging = ref(false);
let dragStart = { mouseX: 0, mouseY: 0, posX: 0, posY: 0 };

const initModalPosition = () => {
  const modalW = Math.min(window.innerWidth - 32, 860);
  const modalH = Math.min(window.innerHeight - 32, 480);
  modalPos.value = {
    x: Math.max(16, (window.innerWidth - modalW) / 2),
    y: Math.max(20, (window.innerHeight - modalH) / 2)
  };
};

const onHeaderMouseDown = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('button, input, select, a')) return;
  isDragging.value = true;
  dragStart = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    posX: modalPos.value.x,
    posY: modalPos.value.y
  };

  const onMouseMove = (ev: MouseEvent) => {
    if (!isDragging.value) return;
    const dx = ev.clientX - dragStart.mouseX;
    const dy = ev.clientY - dragStart.mouseY;
    const maxX = Math.max(0, window.innerWidth - 300);
    const maxY = Math.max(0, window.innerHeight - 80);
    modalPos.value = {
      x: Math.min(maxX, Math.max(8, dragStart.posX + dx)),
      y: Math.min(maxY, Math.max(8, dragStart.posY + dy))
    };
  };

  const onMouseUp = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

// ---------------- 2. SCADA 层级与对象 ----------------
const selectedFacId = ref<number | string>(scadaFacilities.value[0]?.fac_id || 4000003);
const selectedBayId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.bay_id || 430000001);
const selectedDevId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.devices?.[0]?.dev_id || 7000001);

// Selected YK Point
const selectedYkId = ref<number | null>(null);

// Selected Operation: 1 = 合, 0 = 分
const selectedOperation = ref<number>(1);

// Associated Verification Point
const boundVerificationYxId = ref<number | null>(null);

// ---------------- 3. 双人身份核验 ----------------
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

// ---------------- 4. 执行状态与 30s 倒计时 ----------------
// 0: 初始, 1: 预置成功, 2: 执行中, 3: 成功, 4: 失败/超时
const execState = ref<number>(0);
const isWaitingResponse = ref<boolean>(false);
const executionStatusMsg = ref<string>('');
const remainingTime = ref<number>(30);
let timerHandle: any = null;

// ---------------- Computeds ----------------
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

// Bound Verification Point Info
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
    if (val === 1) return '合 (1)';
    if (val === 0) return '分 (0)';
    return `状态 (${val})`;
  }
  return '未配置返校';
});

// ---------------- Dual-Person Handlers ----------------
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

// ---------------- 5. Handle SO SBO (遥控预置) ----------------
const handlePrevProc = async () => {
  if (!isOperVerified.value || !isMonVerified.value) {
    authErrorMessage.value = '请先完成操作人与监护人的身份核验！';
    return;
  }
  if (operatorUser.value === supervisorUser.value) {
    authErrorMessage.value = '操作人与监护人不能为同一用户！';
    return;
  }
  
  const ykId = selectedYkId.value || activeYkPoint.value?.id;
  if (!ykId) {
    executionStatusMsg.value = '未检测到有效的遥控测点！';
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
      executionStatusMsg.value = '遥控预置成功，请确认执行。';
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

// ---------------- 6. Handle DO Execution (遥控执行) ----------------
const handleExecProc = async () => {
  if (execState.value !== 1) return;
  const ykId = selectedYkId.value || activeYkPoint.value?.id;
  if (!ykId) return;

  const targetState = selectedOperation.value === 1 ? 'close' : 'open';
  const verifId = boundVerificationYxId.value || activeYkPoint.value?.targetVerificationPointId;

  isWaitingResponse.value = true;
  execState.value = 2;
  remainingTime.value = 30;
  executionStatusMsg.value = '遥控执行指令已下发，正在进行闭环返校校验...';

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
    executionStatusMsg.value = `遥控执行成功！${res.message}`;
    emit('success', {
      ykId,
      operation: selectedOperation.value,
      message: res.message
    });
  } else {
    execState.value = 4;
    executionStatusMsg.value = `遥控执行失败/返校超时: ${res.message}`;
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
  executionStatusMsg.value = '';
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

watch(
  () => [props.visible, props.initialPointId, props.initialDeviceId, props.initialTargetVerificationPointId] as const,
  ([visible]) => {
    if (visible) {
      initModalPosition();
      initFromProps();
    } else {
      if (timerHandle) clearInterval(timerHandle);
    }
  },
  { immediate: true }
);

onMounted(() => {
  initModalPosition();
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
    class="fixed inset-0 z-[999999] bg-black/40 select-none font-sans"
    style="font-family: var(--scada-font-family); -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision;"
  >
    <!-- Main Industrial DO Dialog (米白工控风格，纯黑高对比字体，支持拖拽) -->
    <div
      class="fixed bg-[#ebe4d4] border-2 border-[#8c826d] shadow-2xl flex flex-col overflow-hidden text-black select-none"
      :style="{
        left: `${modalPos.x}px`,
        top: `${modalPos.y}px`,
        width: 'min(92vw, 860px)'
      }"
    >
      <!-- Titlebar: 可拖拽标题栏 -->
      <div
        class="px-4 py-2 bg-[#dfd7c5] border-b border-[#cfc5b0] flex items-center justify-between cursor-move select-none"
        @mousedown="onHeaderMouseDown"
      >
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 bg-rose-600"></div>
          <span class="text-sm font-bold text-black tracking-wide">
            遥控操作
          </span>
        </div>
        <button
          class="p-1 hover:bg-[#ded5bf] border border-[#cfc5b0] text-slate-700 hover:text-black transition-colors cursor-pointer"
          @click="emit('close')"
          title="关闭"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Main Body: 3-Column Clean Industrial Layout -->
      <div class="p-3.5 grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#ebe4d4]">
        <!-- 1. 遥控对象 -->
        <div class="border border-[#c4baa4] p-3 bg-[#f5f1e8] flex flex-col justify-between">
          <div>
            <div class="text-black font-bold text-xs pb-1.5 mb-2.5 border-b border-[#cfc5b0]">
              <span>遥控对象</span>
            </div>

            <div class="space-y-2.5">
              <!-- Substation & Device -->
              <div>
                <label class="text-xs font-bold text-slate-700 block mb-1">厂站与设备:</label>
                <div class="bg-white border border-[#c4baa4] px-2.5 py-1.5 text-black font-medium text-xs truncate">
                  {{ currentFacility?.fac_name || currentFacility?.name }} · {{ currentDevice?.dev_name || currentDevice?.name }}
                </div>
              </div>

              <!-- Switch Live State -->
              <div>
                <label class="text-xs font-bold text-slate-700 block mb-1">当前遥信状态:</label>
                <div
                  class="flex items-center justify-between bg-white border px-2.5 py-1.5 font-bold text-xs"
                  :class="currentLiveStateText.includes('合') ? 'border-rose-400 text-rose-700' : 'border-emerald-500 text-emerald-700'"
                >
                  <span>{{ currentLiveStateText }}</span>
                  <span
                    class="w-2.5 h-2.5"
                    :class="currentLiveStateText.includes('合') ? 'bg-rose-600' : 'bg-emerald-600'"
                  ></span>
                </div>
              </div>

              <!-- Operation Choice (合 / 分) -->
              <div>
                <label class="text-xs font-bold text-slate-700 block mb-1">操作选择:</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    class="py-2 px-3 font-bold text-xs transition-colors flex items-center justify-center border cursor-pointer"
                    :class="selectedOperation === 1 ? 'bg-rose-700 border-rose-800 text-white shadow-xs' : 'bg-white border-[#c4baa4] text-slate-800 hover:bg-[#e8e2d4]'"
                    @click="selectedOperation = 1; execState = 0;"
                  >
                    <span>合</span>
                  </button>

                  <button
                    type="button"
                    class="py-2 px-3 font-bold text-xs transition-colors flex items-center justify-center border cursor-pointer"
                    :class="selectedOperation === 0 ? 'bg-emerald-700 border-emerald-800 text-white shadow-xs' : 'bg-white border-[#c4baa4] text-slate-800 hover:bg-[#e8e2d4]'"
                    @click="selectedOperation = 0; execState = 0;"
                  >
                    <span>分</span>
                  </button>
                </div>
              </div>

              <!-- YK Point ID & Alias -->
              <div>
                <label class="text-xs font-bold text-slate-700 block mb-1">遥控测点:</label>
                <div class="bg-white border border-[#c4baa4] px-2.5 py-1.5 text-black text-xs font-mono">
                  <span class="text-sky-800 font-bold">[{{ selectedYkId || activeYkPoint?.id || '未指定' }}]</span>
                  <span class="ml-1 text-black font-medium">{{ activeYkPoint?.name || '遥控测点' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. 双人身份核验 -->
        <div class="border border-[#c4baa4] p-3 bg-[#f5f1e8] flex flex-col justify-between">
          <div>
            <div class="text-black font-bold text-xs pb-1.5 mb-2.5 border-b border-[#cfc5b0]">
              <span>身份核验</span>
            </div>

            <div class="space-y-2.5">
              <!-- 1. Operator Selection with Password Input -->
              <div class="p-2 bg-white border border-[#c4baa4] space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <UserCheck class="w-3.5 h-3.5 text-sky-700" />
                    <span>操作人</span>
                  </label>
                  <span
                    class="text-[11px] font-bold px-1.5 py-0.2 border"
                    :class="isOperVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-500' : 'bg-amber-50 text-amber-700 border-amber-500'"
                  >
                    {{ isOperVerified ? '已核验' : '待核验' }}
                  </span>
                </div>

                <div class="flex items-center gap-1.5">
                  <select
                    v-model="operatorUser"
                    class="w-1/2 bg-[#fcfbf8] border border-[#c4baa4] px-2 py-1 text-xs text-black font-mono focus:outline-hidden focus:border-sky-600 cursor-pointer"
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
                    class="w-1/2 bg-[#fcfbf8] border border-[#c4baa4] px-2 py-1 text-xs text-black font-mono focus:outline-hidden focus:border-sky-600"
                    @keyup.enter="handleVerifyOperator"
                  />
                </div>

                <button
                  type="button"
                  class="w-full py-1 text-xs font-bold transition-all flex items-center justify-center gap-1 border cursor-pointer"
                  :class="isOperVerified ? 'bg-[#dfd7c5] hover:bg-[#d0c6b0] border-[#b8ad96] text-black' : 'bg-sky-700 hover:bg-sky-600 border-sky-800 text-white'"
                  @click="handleVerifyOperator"
                >
                  <Check class="w-3.5 h-3.5" />
                  <span>{{ isOperVerified ? '重新核验' : '核验操作人' }}</span>
                </button>
              </div>

              <!-- 2. Supervisor Selection with Password Input -->
              <div class="p-2 bg-white border border-[#c4baa4] space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <KeyRound class="w-3.5 h-3.5 text-indigo-700" />
                    <span>监护人</span>
                  </label>
                  <span
                    class="text-[11px] font-bold px-1.5 py-0.2 border"
                    :class="isMonVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-500' : 'bg-amber-50 text-amber-700 border-amber-500'"
                  >
                    {{ isMonVerified ? '已核验' : '待核验' }}
                  </span>
                </div>

                <div class="flex items-center gap-1.5">
                  <select
                    v-model="supervisorUser"
                    class="w-1/2 bg-[#fcfbf8] border border-[#c4baa4] px-2 py-1 text-xs text-black font-mono focus:outline-hidden focus:border-sky-600 cursor-pointer"
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
                    class="w-1/2 bg-[#fcfbf8] border border-[#c4baa4] px-2 py-1 text-xs text-black font-mono focus:outline-hidden focus:border-sky-600"
                    @keyup.enter="handleVerifySupervisor"
                  />
                </div>

                <button
                  type="button"
                  class="w-full py-1 text-xs font-bold transition-all flex items-center justify-center gap-1 border cursor-pointer"
                  :class="isMonVerified ? 'bg-[#dfd7c5] hover:bg-[#d0c6b0] border-[#b8ad96] text-black' : 'bg-indigo-700 hover:bg-indigo-600 border-indigo-800 text-white'"
                  @click="handleVerifySupervisor"
                >
                  <Check class="w-3.5 h-3.5" />
                  <span>{{ isMonVerified ? '重新核验' : '核验监护人' }}</span>
                </button>
              </div>

              <div v-if="authErrorMessage" class="text-rose-700 text-xs bg-rose-50 border border-rose-400 p-1.5">
                * {{ authErrorMessage }}
              </div>

              <!-- Bound Verification Point -->
              <div class="pt-1.5 border-t border-[#cfc5b0]">
                <label class="text-xs font-bold text-slate-700 block mb-1">
                  返校遥信点:
                </label>
                <div class="p-2 bg-white border border-[#c4baa4]">
                  <div v-if="boundVerificationPointDef?.point" class="text-xs font-mono text-black space-y-0.5">
                    <div class="text-slate-600 font-sans text-[11px]">
                      {{ boundVerificationPointDef.facility?.fac_name || boundVerificationPointDef.facility?.name }} · {{ boundVerificationPointDef.device?.dev_name || boundVerificationPointDef.device?.name }}
                    </div>
                    <div class="text-black font-bold">
                      [YX_{{ boundVerificationPointDef.point.id }}] {{ boundVerificationPointDef.point.name }}
                    </div>
                  </div>
                  <div v-else-if="boundVerificationYxId" class="text-xs font-mono text-black font-bold">
                    [YX_{{ boundVerificationYxId }}] 闭环返校点
                  </div>
                  <div v-else class="text-xs text-slate-500 font-sans">
                    未配置专属返校校验点
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. 操作执行与返校校验 -->
        <div class="border border-[#c4baa4] p-3 bg-[#f5f1e8] flex flex-col justify-between">
          <div>
            <div class="text-black font-bold text-xs pb-1.5 mb-2.5 border-b border-[#cfc5b0]">
              <span>操作执行</span>
            </div>

            <div class="space-y-2.5 mt-1">
              <!-- SO SBO Button -->
              <button
                type="button"
                :disabled="!isOperVerified || !isMonVerified || execState >= 1 || isWaitingResponse"
                class="w-full py-2 px-3 font-bold text-xs flex items-center justify-center gap-1.5 border transition-colors cursor-pointer"
                :class="(!isOperVerified || !isMonVerified || execState >= 1)
                  ? 'opacity-60 bg-[#ded5bf] border-[#c4baa4] text-slate-600 cursor-not-allowed'
                  : 'bg-blue-700 hover:bg-blue-600 border-blue-800 text-white'"
                @click="handlePrevProc"
              >
                <RefreshCw v-if="isWaitingResponse && execState === 0" class="w-3.5 h-3.5 animate-spin" />
                <Check v-else-if="execState >= 1" class="w-3.5 h-3.5 text-emerald-200 stroke-[3]" />
                <span>{{ execState >= 1 ? '遥控预置成功' : '1. 下发遥控预置' }}</span>
              </button>

              <!-- DO Execution Button -->
              <button
                type="button"
                :disabled="execState !== 1 || isWaitingResponse"
                class="w-full py-2.5 px-3 font-bold text-sm flex items-center justify-center gap-1.5 border transition-colors cursor-pointer"
                :class="execState !== 1
                  ? 'opacity-50 bg-[#ded5bf] border-[#c4baa4] text-slate-600 cursor-not-allowed'
                  : 'bg-rose-700 hover:bg-rose-600 border-rose-800 text-white'"
                @click="handleExecProc"
              >
                <RefreshCw v-if="isWaitingResponse && execState === 2" class="w-4 h-4 animate-spin" />
                <CheckCircle2 v-else-if="execState === 3" class="w-4 h-4 text-emerald-200" />
                <span>{{ execState === 3 ? '遥控执行成功' : '2. 确认遥控执行' }}</span>
              </button>
            </div>
          </div>

          <!-- Status / Countdown (Clean, minimal) -->
          <div v-if="remainingTime < 30 || isWaitingResponse || execState > 0" class="mt-3 p-2 bg-white border border-[#c4baa4] text-center">
            <div v-if="isWaitingResponse || execState === 2" class="mb-1">
              <span class="text-xs text-slate-600 block mb-0.5">变位校验倒计时:</span>
              <span class="text-xl font-mono font-bold text-black tracking-wider">
                {{ remainingTime }}s
              </span>
            </div>

            <div
              v-if="executionStatusMsg"
              class="text-xs font-mono leading-relaxed"
              :class="execState === 3 ? 'text-emerald-700 font-bold' : (execState === 4 ? 'text-rose-700 font-bold' : 'text-slate-800')"
            >
              {{ executionStatusMsg }}
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Bar (纯净底栏) -->
      <div class="px-4 py-2 bg-[#dfd7c5] border-t border-[#cfc5b0] flex items-center justify-end">
        <button
          type="button"
          class="px-5 py-1 bg-[#dfd7c5] hover:bg-[#d0c6b0] text-black border border-[#b8ad96] font-medium text-xs transition-colors cursor-pointer"
          @click="emit('close')"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>
