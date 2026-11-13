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

// Selected YT Point
const selectedYtId = ref<number | null>(null);

// 目标调节定值 (直接浮点数输入)
const targetSetValue = ref<number>(5.0);

// Associated Verification Point
const boundVerificationYcId = ref<number | null>(null);

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

// Bound Verification Point Info
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

const displayUnit = computed<string>(() => {
  const u = activeYtPoint.value?.unit || boundVerificationPointDef.value?.point?.unit;
  if (!u || u === '档' || u.includes('档')) return '';
  return u;
});

const currentLiveValueText = computed<string>(() => {
  const _ = scadaLiveTick.value;
  const vId = boundVerificationYcId.value || activeYtPoint.value?.targetVerificationPointId;
  if (vId) {
    const val = rawYcValues.get(Number(vId));
    const u = displayUnit.value;
    if (val !== undefined && val !== null) {
      return u ? `${Number(val).toFixed(2)} ${u}` : `${Number(val).toFixed(2)}`;
    }
    return u ? `0.00 ${u}` : `0.00`;
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

// ---------------- 5. Handle AO SBO (遥调预置) ----------------
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
    executionStatusMsg.value = '未检测到有效的遥调测点！';
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
      executionStatusMsg.value = `遥调预置成功，目标值: ${targetVal}，请确认执行。`;
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

// ---------------- 6. Handle AO Execution (遥调执行) ----------------
const handleExecProc = async () => {
  if (execState.value !== 1) return;
  const ytId = selectedYtId.value || activeYtPoint.value?.id;
  if (!ytId) return;

  const verifId = boundVerificationYcId.value || activeYtPoint.value?.targetVerificationPointId;
  const oldVal = currentLiveValue.value;
  const targetVal = targetSetValue.value;

  isWaitingResponse.value = true;
  execState.value = 2;
  remainingTime.value = 30;
  executionStatusMsg.value = '遥调执行指令已下发，正在进行闭环返校校验...';

  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    if (remainingTime.value > 0) {
      remainingTime.value--;
    } else {
      clearInterval(timerHandle);
    }
  }, 1000);

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
    executionStatusMsg.value = `遥调执行成功！${res.message}`;
    emit('success', {
      ytId,
      targetValue: targetVal,
      message: res.message
    });
  } else {
    execState.value = 4;
    executionStatusMsg.value = `遥调执行失败/返校超时: ${res.message}`;
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
    id="scada-teleregulation-dialog"
    class="fixed inset-0 z-[999999] bg-black/40 select-none font-sans"
    style="font-family: var(--scada-font-family); -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision;"
  >
    <!-- Main Industrial AO Dialog (米白工控风格，纯黑高对比字体，支持拖拽) -->
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
          <div class="w-3 h-3 bg-sky-700"></div>
          <span class="text-sm font-bold text-black tracking-wide">
            遥调定值设定
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
        <!-- 1. 遥调对象与定值输入 (直接浮点数文本框) -->
        <div class="border border-[#c4baa4] p-3 bg-[#f5f1e8] flex flex-col justify-between">
          <div>
            <div class="text-black font-bold text-xs pb-1.5 mb-2.5 border-b border-[#cfc5b0]">
              <span>遥调对象</span>
            </div>

            <div class="space-y-2.5">
              <!-- Substation & Device -->
              <div>
                <label class="text-xs font-bold text-slate-700 block mb-1">厂站与设备:</label>
                <div class="bg-white border border-[#c4baa4] px-2.5 py-1.5 text-black font-medium text-xs truncate">
                  {{ currentFacility?.fac_name || currentFacility?.name }} · {{ currentDevice?.dev_name || currentDevice?.name }}
                </div>
              </div>

              <!-- Current Value -->
              <div>
                <label class="text-xs font-bold text-slate-700 block mb-1">当前采样值:</label>
                <div class="bg-white border border-[#c4baa4] px-2.5 py-1.5 text-black font-mono font-bold text-xs flex items-center justify-between">
                  <span class="text-sky-800">{{ currentLiveValueText }}</span>
                  <span class="text-[11px] px-1.5 py-0.2 bg-[#dfd7c5] text-slate-800 border border-[#b8ad96]">实时</span>
                </div>
              </div>

              <!-- Direct Floating-Point Target Value Input -->
              <div>
                <label class="text-xs font-bold text-slate-700 block mb-1">
                  目标设定值:
                </label>
                <div class="relative flex items-center">
                  <input
                    v-model.number="targetSetValue"
                    type="number"
                    step="any"
                    class="w-full bg-white border border-[#c4baa4] pl-2.5 pr-12 py-1.5 text-black font-mono text-sm font-bold focus:outline-hidden focus:border-sky-700"
                    placeholder="请输入数值"
                    @input="execState = 0"
                  />
                  <span v-if="displayUnit" class="absolute right-2.5 text-xs text-slate-600 font-mono font-bold">
                    {{ displayUnit }}
                  </span>
                </div>
              </div>

              <!-- YT Point ID & Alias -->
              <div>
                <label class="text-xs font-bold text-slate-700 block mb-1">遥调测点:</label>
                <div class="bg-white border border-[#c4baa4] px-2.5 py-1.5 text-black text-xs font-mono">
                  <span class="text-sky-800 font-bold">[{{ selectedYtId || activeYtPoint?.id || '未指定' }}]</span>
                  <span class="ml-1 text-black font-medium">{{ activeYtPoint?.name || '遥调测点' }}</span>
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
                  返校遥测点:
                </label>
                <div class="p-2 bg-white border border-[#c4baa4]">
                  <div v-if="boundVerificationPointDef?.point" class="text-xs font-mono text-black space-y-0.5">
                    <div class="text-slate-600 font-sans text-[11px]">
                      {{ boundVerificationPointDef.facility?.fac_name || boundVerificationPointDef.facility?.name }} · {{ boundVerificationPointDef.device?.dev_name || boundVerificationPointDef.device?.name }}
                    </div>
                    <div class="text-black font-bold">
                      [YC_{{ boundVerificationPointDef.point.id }}] {{ boundVerificationPointDef.point.name }}
                    </div>
                  </div>
                  <div v-else-if="boundVerificationYcId" class="text-xs font-mono text-black font-bold">
                    [YC_{{ boundVerificationYcId }}] 闭环返校点
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
              <!-- AO SBO Button -->
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
                <span>{{ execState >= 1 ? '遥调预置成功' : '1. 下发遥调预置' }}</span>
              </button>

              <!-- AO Execution Button -->
              <button
                type="button"
                :disabled="execState !== 1 || isWaitingResponse"
                class="w-full py-2.5 px-3 font-bold text-sm flex items-center justify-center gap-1.5 border transition-colors cursor-pointer"
                :class="execState !== 1
                  ? 'opacity-50 bg-[#ded5bf] border-[#c4baa4] text-slate-600 cursor-not-allowed'
                  : 'bg-sky-800 hover:bg-sky-700 border-sky-900 text-white'"
                @click="handleExecProc"
              >
                <RefreshCw v-if="isWaitingResponse && execState === 2" class="w-4 h-4 animate-spin" />
                <CheckCircle2 v-else-if="execState === 3" class="w-4 h-4 text-emerald-200" />
                <span>{{ execState === 3 ? '遥调执行成功' : '2. 确认遥调执行' }}</span>
              </button>
            </div>
          </div>

          <!-- Status / Countdown (Clean, minimal) -->
          <div v-if="remainingTime < 30 || isWaitingResponse || execState > 0" class="mt-3 p-2 bg-white border border-[#c4baa4] text-center">
            <div v-if="isWaitingResponse || execState === 2" class="mb-1">
              <span class="text-xs text-slate-600 block mb-0.5">采样校验倒计时:</span>
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
