<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  X, Check, Radio, Zap, Sliders, Activity, Unlink, CheckCircle2,
  Building2, Layers, Cpu, ShieldCheck
} from 'lucide-vue-next';
import {
  CanvasComponent,
  ScadaFacilityNode,
  ScadaBayNode,
  ScadaDeviceNode,
  ScadaPointCategory
} from '../types';
import {
  scadaFacilities,
  findScadaPointDef
} from '../utils/scadaClient';

interface Props {
  visible: boolean;
  component: CanvasComponent | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: {
    componentId: string;
    unbind: boolean;
    deviceId?: string;
    deviceName?: string;
    category?: 'yc' | 'yx' | 'dd' | 'yk' | 'yt';
    point?: any;
    targetVerificationPointId?: number | string;
    targetVerificationType?: 'yx' | 'yc';
    verificationTimeout?: number;
  }): void;
}>();

// Cascading State
const selectedFacId = ref<number | string>(scadaFacilities.value[0]?.fac_id || 4000003);
const selectedBayId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.bay_id || 430000001);
const selectedDevId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.devices?.[0]?.dev_id || 7000001);
const selectedCategory = ref<'yc' | 'yx' | 'dd' | 'yk' | 'yt'>('yc');
const selectedPointId = ref<number | string | null>(null);
const selectedPoint = ref<any>(null);
const isUnboundPending = ref<boolean>(false);

// Return Verification Point State (同间隔下所有装置所有测点闭环返校)
const selectedVerificationPointId = ref<number | string | null>(null);
const verificationTimeout = 30; // 固定 30 秒自动闭环校验

// Current Facility
const currentFacility = computed<ScadaFacilityNode | undefined>(() => {
  return scadaFacilities.value.find(f => f.fac_id === selectedFacId.value || f.id === selectedFacId.value) || scadaFacilities.value[0];
});

// Current Bay
const currentBay = computed<ScadaBayNode | undefined>(() => {
  const fac = currentFacility.value;
  if (!fac || !fac.bays?.length) return undefined;
  return fac.bays.find(b => b.bay_id === selectedBayId.value || b.id === selectedBayId.value) || fac.bays[0];
});

// Current Device
const currentDevice = computed<ScadaDeviceNode | undefined>(() => {
  const bay = currentBay.value;
  if (!bay) return undefined;
  const devs = bay.devices || bay.cb_devices || [];
  return devs.find(d => d.dev_id === selectedDevId.value || d.id === selectedDevId.value) || devs[0];
});

// Category counts for the active device
const categoryStats = computed(() => {
  const dev = currentDevice.value;
  if (!dev) return { yc: 0, yx: 0, dd: 0, yk: 0, yt: 0 };
  return {
    yc: (dev.yc_list || dev.yc_points || []).length,
    yx: (dev.yx_list || dev.yx_points || []).length,
    yk: (dev.yk_list || dev.yk_points || []).length,
    yt: (dev.yt_list || dev.yt_points || []).length,
    dd: (dev.dd_list || dev.dd_points || []).length
  };
});

// Points list for current device and category
const pointsList = computed(() => {
  const dev = currentDevice.value;
  if (!dev) return [];
  if (selectedCategory.value === 'yc') {
    return dev.yc_list || dev.yc_points || [];
  } else if (selectedCategory.value === 'yx') {
    return dev.yx_list || dev.yx_points || [];
  } else if (selectedCategory.value === 'yk') {
    return dev.yk_list || dev.yk_points || [];
  } else if (selectedCategory.value === 'yt') {
    return dev.yt_list || dev.yt_points || [];
  } else if (selectedCategory.value === 'dd') {
    return dev.dd_list || dev.dd_points || [];
  }
  return [];
});

// 同间隔下所有装置的所有测点 (带序号索引 1, 2, 3...)
const sameBayVerificationCandidates = computed(() => {
  const bay = currentBay.value;
  if (!bay) return [];
  const devs = bay.devices || bay.cb_devices || [];
  const result: Array<{
    index: number;
    deviceId: number | string;
    deviceName: string;
    id: number;
    name: string;
    alias?: string;
  }> = [];

  let idx = 1;
  devs.forEach((d: any) => {
    const dName = d.dev_name || d.name || `设备_${d.dev_id || d.id}`;
    const pts = selectedCategory.value === 'yk'
      ? (d.yx_list || d.yx_points || [])
      : (d.yc_list || d.yc_points || []);

    pts.forEach((p: any) => {
      result.push({
        index: idx++,
        deviceId: d.dev_id || d.id,
        deviceName: dName,
        id: p.id,
        name: p.name,
        alias: p.alias || p.type_name
      });
    });
  });

  return result;
});

// Initialize and restore previous association when modal opens
const initializeCascadingSelection = () => {
  if (!props.component) return;

  const comp = props.component;
  const data = comp.data || {};
  const mapping = data.mapping || {};
  const action = data.action;

  let targetPointId: number | null = null;
  let targetCategory: 'yc' | 'yx' | 'dd' | 'yk' | 'yt' = 'yc';
  let targetVPointId: number | string | null = mapping.targetVerificationPointId || null;

  if (mapping.yk_id || mapping.ykPointId || (mapping.pointCategory === 'teleControl' && mapping.pointId)) {
    targetPointId = Number(mapping.yk_id || mapping.ykPointId || mapping.pointId);
    targetCategory = 'yk';
  } else if (mapping.yt_id || mapping.ytPointId || (mapping.pointCategory === 'teleRegulation' && mapping.pointId)) {
    targetPointId = Number(mapping.yt_id || mapping.ytPointId || mapping.pointId);
    targetCategory = 'yt';
  } else if (action?.type === 'tele-control' && (action.yk_id || action.pointId)) {
    targetPointId = Number(action.yk_id || action.pointId);
    targetCategory = 'yk';
    targetVPointId = action.targetVerificationPointId || action.targetPointId || targetVPointId;
  } else if (action?.type === 'tele-regulation' && (action.yt_id || action.pointId)) {
    targetPointId = Number(action.yt_id || action.pointId);
    targetCategory = 'yt';
    targetVPointId = action.targetVerificationPointId || action.targetPointId || targetVPointId;
  } else if (mapping.pointId) {
    targetPointId = Number(mapping.pointId);
    if (mapping.pointCategory === 'teleSignal' || mapping.pointCategory === 'yx' || ['elec-breaker', 'elec-disconnector', 'elec-grounding', 'elec-handcart', 'ctrl-indicator'].includes(comp.type)) {
      targetCategory = 'yx';
    } else if (mapping.pointCategory === 'energy' || mapping.pointCategory === 'dd') {
      targetCategory = 'dd';
    } else {
      targetCategory = 'yc';
    }
  }

  if (targetPointId) {
    const pDef = findScadaPointDef(targetPointId);
    if (pDef.category !== 'none') {
      if (pDef.facility) selectedFacId.value = pDef.facility.fac_id || pDef.facility.id || selectedFacId.value;
      if (pDef.bay) selectedBayId.value = pDef.bay.bay_id || pDef.bay.id || selectedBayId.value;
      if (pDef.device) selectedDevId.value = pDef.device.dev_id || pDef.device.id || selectedDevId.value;
      selectedCategory.value = (pDef.category as any) || targetCategory;
      selectedPointId.value = targetPointId;
      selectedPoint.value = {
        pointId: targetPointId,
        name: pDef.point?.name || `Point ${targetPointId}`
      };
      selectedVerificationPointId.value = targetVPointId || pDef.point?.targetVerificationPointId || null;
      isUnboundPending.value = false;

      nextTick(() => {
        scrollToSelectedRow();
      });
      return;
    }
  }

  // Fallback defaults
  const firstFac = scadaFacilities.value[0];
  if (firstFac) {
    selectedFacId.value = firstFac.fac_id || firstFac.id || selectedFacId.value;
    if (firstFac.bays?.[0]) {
      selectedBayId.value = firstFac.bays[0].bay_id || firstFac.bays[0].id || selectedBayId.value;
      const devs = firstFac.bays[0].devices || firstFac.bays[0].cb_devices || [];
      if (devs[0]) {
        selectedDevId.value = devs[0].dev_id || devs[0].id || selectedDevId.value;
      }
    }
  }

  if (['elec-breaker', 'elec-disconnector', 'elec-grounding', 'elec-handcart', 'ctrl-indicator'].includes(comp.type)) {
    selectedCategory.value = 'yx';
  } else {
    selectedCategory.value = 'yc';
  }

  selectedPointId.value = null;
  selectedPoint.value = null;
  selectedVerificationPointId.value = null;
  isUnboundPending.value = false;
};

const scrollToSelectedRow = () => {
  if (!selectedPointId.value) return;
  const el = document.getElementById(`cascade-point-row-${selectedPointId.value}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

watch(
  () => props.visible,
  (val) => {
    if (val) {
      initializeCascadingSelection();
    }
  },
  { immediate: true }
);

// Auto match default verification point when choosing YK/YT
const handleSelectPointRow = (pt: any) => {
  selectedPointId.value = pt.id;
  selectedPoint.value = {
    pointId: pt.id,
    name: pt.name,
    alias: pt.alias,
    type: pt.type,
    type_name: pt.type_name
  };
  isUnboundPending.value = false;

  // 默认尝试智能关联同间隔下同类首个返校点
  if (!selectedVerificationPointId.value) {
    if (pt.targetVerificationPointId) {
      selectedVerificationPointId.value = pt.targetVerificationPointId;
    } else if (sameBayVerificationCandidates.value.length > 0) {
      selectedVerificationPointId.value = sameBayVerificationCandidates.value[0].id;
    }
  }
};

const handleUnbind = () => {
  isUnboundPending.value = true;
  selectedPointId.value = null;
  selectedPoint.value = null;
  selectedVerificationPointId.value = null;
};

const handleSubmit = () => {
  if (!props.component) return;

  if (isUnboundPending.value) {
    emit('submit', {
      componentId: props.component.id,
      unbind: true
    });
    emit('close');
    return;
  }

  if (!selectedPoint.value) {
    emit('close');
    return;
  }

  const vType = selectedCategory.value === 'yk' ? 'yx' : (selectedCategory.value === 'yt' ? 'yc' : undefined);

  emit('submit', {
    componentId: props.component.id,
    unbind: false,
    deviceId: String(selectedDevId.value),
    deviceName: currentDevice.value?.dev_name || currentDevice.value?.name,
    category: selectedCategory.value,
    point: selectedPoint.value,
    targetVerificationPointId: selectedVerificationPointId.value || undefined,
    targetVerificationType: vType,
    verificationTimeout: 30
  });
  emit('close');
};
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 font-sans select-none"
    style="transform: translateZ(0); will-change: transform;"
  >
    <!-- Modal Dialog Box (超高对比度清晰亮色排版，大号文字，加宽至 max-w-7xl) -->
    <div
      class="bg-[#0e172a] border-2 border-sky-400 rounded-2xl shadow-2xl w-full max-w-7xl h-[88vh] max-h-[880px] flex flex-col overflow-hidden text-white"
      style="contain: paint layout;"
    >
      <!-- Title Header -->
      <div class="px-6 py-4 bg-[#080d1a] border-b-2 border-slate-700 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full bg-sky-400"></div>
          <div>
            <span class="text-lg font-bold text-white tracking-wide">
              测点数据关联配置中心
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-500 flex items-center gap-1.5 transition-colors cursor-pointer"
            @click="handleUnbind"
          >
            <Unlink class="w-4 h-4" />
            <span>解除测点绑定</span>
          </button>
          <button
            class="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            @click="emit('close')"
          >
            <X class="w-6 h-6" />
          </button>
        </div>
      </div>

      <!-- Main Body: 4-Column Layout -->
      <div class="flex-1 flex overflow-hidden bg-[#0a1120]">
        <!-- 1. 厂站 (Facility) -->
        <div class="w-56 border-r-2 border-slate-800 bg-[#0c1427] flex flex-col shrink-0">
          <div class="p-3.5 border-b-2 border-slate-800 bg-[#080d1a] flex items-center justify-between">
            <span class="text-sm font-bold text-sky-300">1. 厂站选择</span>
            <span class="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded font-mono font-bold">
              {{ scadaFacilities.length }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-2">
            <div
              v-for="fac in scadaFacilities"
              :key="fac.fac_id || fac.id"
              class="p-3 rounded-xl cursor-pointer border-2 transition-all text-left"
              :class="selectedFacId === (fac.fac_id || fac.id) ? 'bg-sky-600/30 border-sky-400 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'"
              @click="selectedFacId = (fac.fac_id || fac.id); selectedBayId = fac.bays?.[0]?.bay_id || fac.bays?.[0]?.id || 0"
            >
              <div class="truncate text-white font-bold text-sm">{{ fac.fac_name || fac.name }}</div>
              <div class="text-xs text-sky-300 font-mono mt-1 font-bold">ID: {{ fac.fac_id || fac.id }}</div>
            </div>
          </div>
        </div>

        <!-- 2. 间隔 (Bay) -->
        <div class="w-60 border-r-2 border-slate-800 bg-[#0c1427] flex flex-col shrink-0">
          <div class="p-3.5 border-b-2 border-slate-800 bg-[#080d1a] flex items-center justify-between">
            <span class="text-sm font-bold text-slate-200">2. 间隔选择</span>
            <span class="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded font-mono font-bold">
              {{ currentFacility?.bays?.length || 0 }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-2">
            <div
              v-for="bay in (currentFacility?.bays || [])"
              :key="bay.bay_id || bay.id"
              class="p-3 rounded-xl cursor-pointer border-2 transition-all text-left"
              :class="selectedBayId === (bay.bay_id || bay.id) ? 'bg-sky-600/30 border-sky-400 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'"
              @click="selectedBayId = (bay.bay_id || bay.id); selectedDevId = (bay.devices?.[0]?.dev_id || bay.devices?.[0]?.id || 0)"
            >
              <div class="truncate text-white font-bold text-sm">{{ bay.bay_name || bay.name }}</div>
              <div class="text-xs text-slate-300 font-mono mt-1 font-bold">ID: {{ bay.bay_id || bay.id }}</div>
            </div>
          </div>
        </div>

        <!-- 3. 装置 (Device) -->
        <div class="w-64 border-r-2 border-slate-800 bg-[#0c1427] flex flex-col shrink-0">
          <div class="p-3.5 border-b-2 border-slate-800 bg-[#080d1a] flex items-center justify-between">
            <span class="text-sm font-bold text-slate-200">3. 装置选择</span>
            <span class="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded font-mono font-bold">
              {{ currentBay?.devices?.length || currentBay?.cb_devices?.length || 0 }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-2">
            <div
              v-for="dev in (currentBay?.devices || currentBay?.cb_devices || [])"
              :key="dev.dev_id || dev.id"
              class="p-3 rounded-xl cursor-pointer border-2 transition-all text-left"
              :class="selectedDevId === (dev.dev_id || dev.id) ? 'bg-sky-600/30 border-sky-400 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'"
              @click="selectedDevId = (dev.dev_id || dev.id)"
            >
              <div class="truncate text-white font-bold text-sm">{{ dev.dev_name || dev.name }}</div>
              <div class="flex items-center justify-between text-xs text-slate-300 font-mono font-bold mt-1">
                <span>ID: {{ dev.dev_id || dev.id }}</span>
                <span class="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[11px]">{{ dev.cbty_name || '开关' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. 测点列表与同间隔返校校验配置 -->
        <div class="flex-1 flex flex-col bg-[#0f172a] overflow-hidden min-w-0">
          <!-- Category Tabs (五遥卡片排在一行，统一边框与高度，杜绝点击抖动) -->
          <div class="p-3 border-b-2 border-slate-800 bg-[#080d1a] shrink-0">
            <div class="grid grid-cols-5 gap-2.5 w-full">
              <button
                class="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer truncate border-2"
                :class="selectedCategory === 'yc' ? 'bg-sky-600 text-white border-sky-400 shadow-md font-black' : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-700'"
                @click="selectedCategory = 'yc'"
              >
                <span class="truncate">遥测 (YC)</span>
                <span class="px-1.5 py-0.5 bg-black/40 rounded font-mono text-xs font-bold text-sky-200">{{ categoryStats.yc }}</span>
              </button>

              <button
                class="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer truncate border-2"
                :class="selectedCategory === 'yx' ? 'bg-sky-600 text-white border-sky-400 shadow-md font-black' : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-700'"
                @click="selectedCategory = 'yx'"
              >
                <span class="truncate">遥信 (YX)</span>
                <span class="px-1.5 py-0.5 bg-black/40 rounded font-mono text-xs font-bold text-sky-200">{{ categoryStats.yx }}</span>
              </button>

              <button
                class="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer truncate border-2"
                :class="selectedCategory === 'dd' ? 'bg-sky-600 text-white border-sky-400 shadow-md font-black' : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-700'"
                @click="selectedCategory = 'dd'"
              >
                <span class="truncate">电度 (DD)</span>
                <span class="px-1.5 py-0.5 bg-black/40 rounded font-mono text-xs font-bold text-sky-200">{{ categoryStats.dd }}</span>
              </button>

              <button
                class="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer truncate border-2"
                :class="selectedCategory === 'yk' ? 'bg-sky-600 text-white border-sky-400 shadow-md font-black' : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-700'"
                @click="selectedCategory = 'yk'"
              >
                <span class="truncate">遥控 (YK)</span>
                <span class="px-1.5 py-0.5 bg-black/40 rounded font-mono text-xs font-bold text-sky-200">{{ categoryStats.yk }}</span>
              </button>

              <button
                class="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer truncate border-2"
                :class="selectedCategory === 'yt' ? 'bg-sky-600 text-white border-sky-400 shadow-md font-black' : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-700'"
                @click="selectedCategory = 'yt'"
              >
                <span class="truncate">遥调 (YT)</span>
                <span class="px-1.5 py-0.5 bg-black/40 rounded font-mono text-xs font-bold text-sky-200">{{ categoryStats.yt }}</span>
              </button>
            </div>
          </div>

          <!-- Point Table (高对比度大号清晰文字，定高防抖排版) -->
          <div
            class="flex-1 overflow-y-auto p-3"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <table class="w-full text-left text-sm border-collapse" style="table-layout: fixed;">
              <thead>
                <tr class="border-b-2 border-slate-700 bg-[#080d1a] text-sky-300 sticky top-0 z-10">
                  <th class="p-3 font-bold w-44">测点 ID</th>
                  <th class="p-3 font-bold">测点名称</th>
                  <th class="p-3 font-bold w-60">点位别名 / 类型</th>
                  <th class="p-3 font-bold w-28 text-right">选中状态</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800">
                <tr
                  v-for="pt in pointsList"
                  :key="pt.id"
                  :id="`cascade-point-row-${pt.id}`"
                  class="cursor-pointer transition-colors"
                  :class="selectedPointId === pt.id ? 'bg-sky-500/30 border-y-2 border-sky-400 text-white font-black' : 'hover:bg-slate-800 text-slate-100'"
                  @click="handleSelectPointRow(pt)"
                >
                  <td class="p-3 font-mono text-sm font-black text-sky-300">
                    {{ pt.id }}
                  </td>
                  <td class="p-3 font-sans text-sm font-bold text-white truncate">
                    {{ pt.name }}
                  </td>
                  <td class="p-3 font-mono text-xs text-slate-200 font-medium truncate">
                    {{ pt.alias || pt.type_name || '-' }}
                  </td>
                  <td class="p-3 text-right">
                    <div
                      class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition-all"
                      :class="selectedPointId === pt.id ? 'bg-sky-400 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-200 border border-slate-700'"
                    >
                      <Check class="w-4 h-4 stroke-[3]" />
                      <span>{{ selectedPointId === pt.id ? '已选中' : '选择' }}</span>
                    </div>
                  </td>
                </tr>
                <tr v-if="pointsList.length === 0">
                  <td colspan="4" class="p-10 text-center text-slate-200 font-sans text-sm font-bold">
                    当前装置暂无该类型的测点
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 5. Return Verification Point Config Box (常驻恒定高度 54px，杜绝高度突变导致表格上下抖动) -->
          <div
            class="h-[54px] min-h-[54px] p-3 bg-[#080d1a] border-t-2 border-slate-700 shrink-0 flex items-center justify-between gap-3 text-xs"
          >
            <template v-if="selectedCategory === 'yk' || selectedCategory === 'yt'">
              <div class="flex items-center gap-2 shrink-0 text-sm font-bold text-sky-300">
                <ShieldCheck class="w-4 h-4 text-sky-400" />
                <span>{{ selectedCategory === 'yk' ? '闭环返校遥信 (YX):' : '闭环返校遥测 (YC):' }}</span>
              </div>

              <div class="flex-1">
                <select
                  v-model="selectedVerificationPointId"
                  class="w-full bg-[#111c34] border border-sky-400 rounded-lg px-3 py-1.5 text-xs font-mono text-sky-100 font-bold focus:outline-none focus:border-sky-300 cursor-pointer"
                >
                  <option :value="null">-- 不配置专属返校校验点 (执行后直接返回) --</option>
                  <option
                    v-for="cand in sameBayVerificationCandidates"
                    :key="cand.id"
                    :value="cand.id"
                  >
                    [{{ cand.index }}] 【{{ cand.deviceName }}】 点号: {{ cand.id }} - {{ cand.name }} {{ cand.alias ? `(${cand.alias})` : '' }}
                  </option>
                </select>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center gap-2 text-slate-200 text-xs font-medium">
                <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span>当前为连续采样数据流（遥测/遥信/电度），实时直读上送，无需配置闭环返校点。</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Footer Bar -->
      <div class="px-6 py-4 border-t-2 border-slate-800 bg-[#080d1a] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-sky-400 font-black">当前选择:</span>
          <span v-if="isUnboundPending" class="text-rose-400 font-black font-mono">
            [已标记解除测点绑定]
          </span>
          <span v-else-if="selectedPoint" class="text-white font-bold font-mono">
            [{{ selectedCategory.toUpperCase() }}] {{ currentFacility?.fac_name || currentFacility?.name }} ➜ {{ currentBay?.bay_name || currentBay?.name }} ➜ {{ currentDevice?.dev_name || currentDevice?.name }} ➜ 点号: <strong class="text-amber-300 font-black text-base">{{ selectedPoint.pointId }}</strong> ({{ selectedPoint.name }})
            <span v-if="selectedVerificationPointId" class="text-sky-300 ml-2 font-black">
              [返校: {{ selectedCategory === 'yk' ? 'YX' : 'YC' }}_{{ selectedVerificationPointId }}]
            </span>
          </span>
          <span v-else class="text-slate-300 font-medium">
            未选择任何测点
          </span>
        </div>

        <div class="flex items-center gap-3">
          <button
            class="px-6 py-2 rounded-xl text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors cursor-pointer"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            class="px-7 py-2 rounded-xl text-sm font-black bg-sky-400 hover:bg-sky-300 text-slate-950 transition-all shadow-lg shadow-sky-400/20 flex items-center gap-2 cursor-pointer"
            @click="handleSubmit"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>确认关联生效</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
