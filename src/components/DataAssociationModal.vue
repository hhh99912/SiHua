<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  Database,
  X,
  Search,
  CheckCircle2,
  Cpu,
  Radio,
  Zap,
  Layers,
  Unlink,
  Check,
  Building2,
  ChevronRight,
  Info,
  Link2
} from 'lucide-vue-next';
import {
  DatasetItem,
  ScreenComponent,
  ScadaFacilityNode,
  ScadaBayNode,
  ScadaDeviceNode,
  ScadaYcItem,
  ScadaYxItem
} from '../types';
import {
  scadaFacilities
} from '../utils/scadaClient';

interface Props {
  visible: boolean;
  component: ScreenComponent | null;
  datasets: DatasetItem[];
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  component: null,
  datasets: () => []
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: {
    componentId: string;
    unbind?: boolean;
    datasetId?: string;
    deviceId?: string;
    deviceName?: string;
    category?: 'yc' | 'yx' | 'dd' | 'yk' | 'yt';
    point?: any;
    targetVerificationPointId?: number | string;
  }): void;
}>();

// Cascading State
const selectedFacId = ref<number | string>(scadaFacilities.value[0]?.fac_id || 4000003);
const selectedBayId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.bay_id || 430000001);
const selectedDevId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.devices?.[0]?.dev_id || 7000001);
const selectedCategory = ref<'yc' | 'yx' | 'dd' | 'yk' | 'yt'>('yc');
const selectedPointId = ref<number | string | null>(null);
const selectedPoint = ref<any>(null);
const searchQuery = ref<string>('');
const isUnboundPending = ref<boolean>(false);

// Previous association detail information for display
const initialAssociatedInfo = ref<{
  isBound: boolean;
  facName?: string;
  bayName?: string;
  devName?: string;
  category?: 'yc' | 'yx' | 'dd' | 'yk' | 'yt';
  pointId?: number | string;
  pointName?: string;
} | null>(null);

// Current Facility
const currentFacility = computed<ScadaFacilityNode | undefined>(() => {
  return scadaFacilities.value.find(f => f.fac_id === selectedFacId.value) || scadaFacilities.value[0];
});

// Current Bay
const currentBay = computed<ScadaBayNode | undefined>(() => {
  const fac = currentFacility.value;
  if (!fac || !fac.bays?.length) return undefined;
  return fac.bays.find(b => b.bay_id === selectedBayId.value) || fac.bays[0];
});

// Current Device
const currentDevice = computed<ScadaDeviceNode | undefined>(() => {
  const bay = currentBay.value;
  if (!bay || !bay.devices?.length) return undefined;
  return bay.devices.find(d => d.dev_id === selectedDevId.value) || bay.devices[0];
});

// Category counts for the active device
const categoryStats = computed(() => {
  const dev = currentDevice.value;
  if (!dev) return { yc: 0, yx: 0, dd: 0, yk: 0, yt: 0 };
  return {
    yc: dev.yc_list?.length || 0,
    yx: dev.yx_list?.length || 0,
    dd: 0,
    yk: 0,
    yt: 0
  };
});

// Points list for current device and category (Only ID & Name)
const pointsList = computed(() => {
  const dev = currentDevice.value;
  if (!dev) return [];
  if (selectedCategory.value === 'yc') {
    return dev.yc_list || [];
  } else if (selectedCategory.value === 'yx') {
    return dev.yx_list || [];
  }
  return [];
});

// Filtered Points (by ID or Name)
const filteredPoints = computed(() => {
  const list = pointsList.value;
  if (!searchQuery.value.trim()) return list;
  const q = searchQuery.value.toLowerCase().trim();
  return list.filter(item =>
    String(item.id).toLowerCase().includes(q) ||
    (item.name && item.name.toLowerCase().includes(q))
  );
});

// Initialize and restore previous association when modal opens
const initializeCascadingSelection = () => {
  if (!props.component) return;

  const comp = props.component;
  const data = comp.data || {};
  const mapping = data.mapping || {};
  const bindings = data.bindings || {};

  const boundKey = bindings.value || bindings.state || mapping.valueKey || mapping.stateKey || '';
  const m = String(boundKey).match(/(\d{5,})/);
  const targetPointId = mapping.pointId ? Number(mapping.pointId) : (m ? Number(m[1]) : null);
  const targetCategory = (mapping.pointCategory === 'teleSignal' || String(boundKey).includes('_YX_')) ? 'yx' : 'yc';

  let foundBoundPoint = false;

  if (targetPointId) {
    for (const fac of scadaFacilities.value) {
      for (const bay of fac.bays || []) {
        for (const dev of bay.devices || []) {
          // Check YC list
          const yc = (dev.yc_list || []).find(p => p.id === targetPointId);
          if (yc) {
            selectedFacId.value = fac.fac_id;
            selectedBayId.value = bay.bay_id;
            selectedDevId.value = dev.dev_id;
            selectedCategory.value = 'yc';
            selectedPointId.value = yc.id;
            selectedPoint.value = {
              pointId: yc.id,
              name: yc.name
            };
            isUnboundPending.value = false;
            initialAssociatedInfo.value = {
              isBound: true,
              facName: fac.fac_name,
              bayName: bay.bay_name,
              devName: dev.dev_name,
              category: 'yc',
              pointId: yc.id,
              pointName: yc.name
            };
            foundBoundPoint = true;
            break;
          }

          // Check YX list
          const yx = (dev.yx_list || []).find(p => p.id === targetPointId);
          if (yx) {
            selectedFacId.value = fac.fac_id;
            selectedBayId.value = bay.bay_id;
            selectedDevId.value = dev.dev_id;
            selectedCategory.value = 'yx';
            selectedPointId.value = yx.id;
            selectedPoint.value = {
              pointId: yx.id,
              name: yx.name
            };
            isUnboundPending.value = false;
            initialAssociatedInfo.value = {
              isBound: true,
              facName: fac.fac_name,
              bayName: bay.bay_name,
              devName: dev.dev_name,
              category: 'yx',
              pointId: yx.id,
              pointName: yx.name
            };
            foundBoundPoint = true;
            break;
          }
        }
        if (foundBoundPoint) break;
      }
      if (foundBoundPoint) break;
    }
  }

  if (foundBoundPoint) {
    nextTick(() => {
      scrollToSelectedRow();
    });
    return;
  }

  // Not bound previously
  initialAssociatedInfo.value = {
    isBound: false
  };

  const firstFac = scadaFacilities.value[0];
  if (firstFac) {
    selectedFacId.value = firstFac.fac_id;
    if (firstFac.bays?.[0]) {
      selectedBayId.value = firstFac.bays[0].bay_id;
      if (firstFac.bays[0].devices?.[0]) {
        selectedDevId.value = firstFac.bays[0].devices[0].dev_id;
      }
    }
  }

  if (['elec-breaker', 'elec-disconnector', 'elec-grounding', 'elec-handcart', 'ctrl-indicator'].includes(comp.type) || comp.category === 'status') {
    selectedCategory.value = 'yx';
  } else {
    selectedCategory.value = 'yc';
  }

  selectedPointId.value = null;
  selectedPoint.value = null;
  isUnboundPending.value = false;
};

const scrollToSelectedRow = () => {
  if (!selectedPointId.value) return;
  const el = document.getElementById(`cascade-point-row-${selectedPointId.value}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    searchQuery.value = '';
    initializeCascadingSelection();
  }
}, { immediate: true });

const handleSelectPointRow = (pt: any) => {
  isUnboundPending.value = false;
  selectedPointId.value = pt.id;
  selectedPoint.value = {
    pointId: pt.id,
    name: pt.name
  };
};

const handleMarkUnbound = () => {
  selectedPointId.value = null;
  selectedPoint.value = null;
  isUnboundPending.value = true;
};

const handleSubmit = () => {
  if (!props.component) {
    emit('close');
    return;
  }

  if (isUnboundPending.value || selectedPointId.value === null || !selectedPoint.value) {
    emit('submit', {
      componentId: props.component.id,
      unbind: true
    });
  } else {
    emit('submit', {
      componentId: props.component.id,
      unbind: false,
      datasetId: String(selectedFacId.value),
      deviceId: String(selectedDevId.value),
      deviceName: currentDevice.value ? `${currentBay.value?.bay_name || ''} - ${currentDevice.value.dev_name}` : '',
      category: selectedCategory.value,
      point: selectedPoint.value
    });
  }
  emit('close');
};
</script>

<template>
  <div
    v-if="visible"
    id="data-association-modal"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none font-sans"
    @click.self="emit('close')"
  >
    <div
      class="relative w-full max-w-5xl h-[700px] max-h-[94vh] bg-slate-900 border-2 border-cyan-500/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white"
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-cyan-500/20 border border-cyan-400 rounded-xl text-cyan-300">
            <Link2 class="w-6 h-6" />
          </div>
          <div>
            <div class="flex items-center gap-3">
              <h2 class="text-base font-bold text-white tracking-wide">SCADA 测点数据关联配置</h2>
              <span
                v-if="component"
                class="px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/20 border border-cyan-400 text-cyan-200"
              >
                目标图元: {{ component.name }} ({{ component.id }})
              </span>
            </div>
            <p class="text-xs text-cyan-200 mt-1 font-medium">
              层级选择：厂站 (Facility) → 间隔 (Bay) → 装置 (Device) → 遥测(YC) / 遥信(YX) 测点
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            class="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-500/20 border border-rose-500/60 text-rose-200 hover:bg-rose-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
            @click="handleMarkUnbound"
          >
            <Unlink class="w-4 h-4 text-rose-300" />
            <span>解除测点关联</span>
          </button>
          <button
            class="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            @click="emit('close')"
          >
            <X class="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <!-- Previously Associated Info Banner (高亮体现已关联信息) -->
      <div
        v-if="initialAssociatedInfo?.isBound"
        class="px-6 py-2.5 bg-cyan-950 border-b border-cyan-500/40 flex items-center justify-between text-xs text-white shrink-0"
      >
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold text-[11px]">
            已关联测点
          </span>
          <span class="font-medium text-cyan-100">
            厂站: <strong class="text-white">{{ initialAssociatedInfo.facName }}</strong>
            <span class="text-cyan-400 mx-1">→</span>
            间隔: <strong class="text-white">{{ initialAssociatedInfo.bayName }}</strong>
            <span class="text-cyan-400 mx-1">→</span>
            装置: <strong class="text-white">{{ initialAssociatedInfo.devName }}</strong>
            <span class="text-cyan-400 mx-1">→</span>
            类型: <strong class="text-amber-300">{{ initialAssociatedInfo.category?.toUpperCase() }}</strong>
            <span class="text-cyan-400 mx-1">→</span>
            测点: <strong class="text-amber-300 font-mono">ID {{ initialAssociatedInfo.pointId }}</strong>
            (<span class="text-white font-semibold">{{ initialAssociatedInfo.pointName }}</span>)
          </span>
        </div>
        <div class="flex items-center gap-1 text-emerald-400 font-bold">
          <CheckCircle2 class="w-4 h-4 text-emerald-400" />
          <span>已生效</span>
        </div>
      </div>

      <div
        v-else
        class="px-6 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center gap-2 text-xs text-slate-200 shrink-0"
      >
        <span class="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold text-[11px]">未关联</span>
        <span>当前图元尚未关联任何测点，请从下方选择测点并点击「确认关联生效」</span>
      </div>

      <!-- Main Cascading Columns -->
      <div class="flex-1 flex overflow-hidden">
        <!-- 1. 厂站 (Facility) -->
        <div class="w-56 border-r border-slate-800 bg-slate-950/60 flex flex-col">
          <div class="p-3 border-b border-slate-800 text-xs font-bold text-cyan-300 flex items-center justify-between bg-slate-950">
            <div class="flex items-center gap-1.5">
              <Building2 class="w-4 h-4 text-blue-400" />
              <span>1. 厂站 (Facility)</span>
            </div>
            <span class="px-1.5 py-0.2 bg-blue-900/60 border border-blue-400 text-blue-200 text-[10px] rounded font-mono font-bold">
              {{ scadaFacilities.length }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
            <div
              v-for="fac in scadaFacilities"
              :key="fac.fac_id"
              class="p-2.5 rounded-xl cursor-pointer border-2 transition-all text-left text-xs"
              :class="selectedFacId === fac.fac_id ? 'bg-blue-600/30 border-blue-400 text-white font-bold shadow-md' : 'bg-slate-900 border-slate-800 text-slate-100 hover:bg-slate-800 hover:border-slate-700'"
              @click="selectedFacId = fac.fac_id; if (fac.bays?.[0]) selectedBayId = fac.bays[0].bay_id; if (fac.bays?.[0]?.devices?.[0]) selectedDevId = fac.bays[0].devices[0].dev_id;"
            >
              <div class="flex items-center justify-between">
                <span class="truncate text-white font-bold">{{ fac.fac_name }}</span>
                <ChevronRight class="w-4 h-4 text-cyan-400" />
              </div>
              <div class="text-[11px] text-blue-300 font-mono font-medium mt-1">ID: {{ fac.fac_id }}</div>
            </div>
          </div>
        </div>

        <!-- 2. 间隔 (Bay) -->
        <div class="w-60 border-r border-slate-800 bg-slate-950/40 flex flex-col">
          <div class="p-3 border-b border-slate-800 text-xs font-bold text-cyan-300 flex items-center justify-between bg-slate-950">
            <div class="flex items-center gap-1.5">
              <Layers class="w-4 h-4 text-indigo-400" />
              <span>2. 间隔 (Bay)</span>
            </div>
            <span class="px-1.5 py-0.2 bg-indigo-900/60 border border-indigo-400 text-indigo-200 text-[10px] rounded font-mono font-bold">
              {{ currentFacility?.bays?.length || 0 }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
            <div
              v-for="bay in (currentFacility?.bays || [])"
              :key="bay.bay_id"
              class="p-2.5 rounded-xl cursor-pointer border-2 transition-all text-left text-xs"
              :class="selectedBayId === bay.bay_id ? 'bg-indigo-600/30 border-indigo-400 text-white font-bold shadow-md' : 'bg-slate-900 border-slate-800 text-slate-100 hover:bg-slate-800 hover:border-slate-700'"
              @click="selectedBayId = bay.bay_id; if (bay.devices?.[0]) selectedDevId = bay.devices[0].dev_id;"
            >
              <div class="flex items-center justify-between">
                <span class="truncate text-white font-bold">{{ bay.bay_name }}</span>
                <ChevronRight class="w-4 h-4 text-cyan-400" />
              </div>
              <div class="text-[11px] text-indigo-300 font-mono font-medium mt-1">ID: {{ bay.bay_id }}</div>
            </div>
          </div>
        </div>

        <!-- 3. 装置 (Device) -->
        <div class="w-60 border-r border-slate-800 bg-slate-950/30 flex flex-col">
          <div class="p-3 border-b border-slate-800 text-xs font-bold text-cyan-300 flex items-center justify-between bg-slate-950">
            <div class="flex items-center gap-1.5">
              <Cpu class="w-4 h-4 text-emerald-400" />
              <span>3. 装置 (Device)</span>
            </div>
            <span class="px-1.5 py-0.2 bg-emerald-900/60 border border-emerald-400 text-emerald-200 text-[10px] rounded font-mono font-bold">
              {{ currentBay?.devices?.length || 0 }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
            <div
              v-for="dev in (currentBay?.devices || [])"
              :key="dev.dev_id"
              class="p-2.5 rounded-xl cursor-pointer border-2 transition-all text-left text-xs"
              :class="selectedDevId === dev.dev_id ? 'bg-emerald-600/30 border-emerald-400 text-white font-bold shadow-md' : 'bg-slate-900 border-slate-800 text-slate-100 hover:bg-slate-800 hover:border-slate-700'"
              @click="selectedDevId = dev.dev_id"
            >
              <div class="truncate text-white font-bold">{{ dev.dev_name }}</div>
              <div class="flex items-center justify-between text-[11px] text-emerald-300 font-mono font-medium mt-1">
                <span>ID: {{ dev.dev_id }}</span>
                <span class="px-1.5 py-0.2 bg-emerald-950 border border-emerald-500 text-[10px] rounded">cbty: {{ dev.cbty ?? 0 }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. 测点列表 (Points Table: Only ID & Name, High Contrast) -->
        <div class="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          <!-- Category Tabs & Search Bar -->
          <div class="p-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-2">
              <button
                class="px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                :class="selectedCategory === 'yc' ? 'bg-blue-600 text-white shadow-lg border border-blue-400' : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700'"
                @click="selectedCategory = 'yc'"
              >
                <Zap class="w-4 h-4 text-amber-300" />
                <span>遥测 (YC)</span>
                <span class="px-2 py-0.5 bg-black/40 rounded-full text-[10px] font-mono font-bold">{{ categoryStats.yc }}</span>
              </button>

              <button
                class="px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                :class="selectedCategory === 'yx' ? 'bg-indigo-600 text-white shadow-lg border border-indigo-400' : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700'"
                @click="selectedCategory = 'yx'"
              >
                <Radio class="w-4 h-4 text-cyan-300" />
                <span>遥信 (YX)</span>
                <span class="px-2 py-0.5 bg-black/40 rounded-full text-[10px] font-mono font-bold">{{ categoryStats.yx }}</span>
              </button>
            </div>

            <!-- Search -->
            <div class="relative w-64">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索测点 ID 或名称..."
                class="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-600 rounded-lg text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400 font-medium"
              />
              <Search class="w-4 h-4 text-cyan-400 absolute left-2.5 top-2" />
            </div>
          </div>

          <!-- Point Table: Strictly ID & Name ONLY (No Realtime, No Units) -->
          <div class="flex-1 overflow-y-auto p-3">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b-2 border-slate-700 bg-slate-950 text-cyan-300">
                  <th class="p-3 font-bold w-44">测点 ID</th>
                  <th class="p-3 font-bold">测点名称</th>
                  <th class="p-3 font-bold w-28 text-right">选中状态</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800">
                <tr
                  v-for="pt in filteredPoints"
                  :key="pt.id"
                  :id="`cascade-point-row-${pt.id}`"
                  class="cursor-pointer transition-colors"
                  :class="selectedPointId === pt.id ? 'bg-cyan-500/25 border-y-2 border-cyan-400 text-white font-bold' : 'hover:bg-slate-800 text-slate-100'"
                  @click="handleSelectPointRow(pt)"
                >
                  <td class="p-3 font-mono text-sm font-bold" :class="selectedCategory === 'yc' ? 'text-amber-300' : 'text-cyan-300'">
                    {{ pt.id }}
                  </td>
                  <td class="p-3 font-sans text-sm font-semibold text-white">
                    {{ pt.name }}
                  </td>
                  <td class="p-3 text-right">
                    <div
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all"
                      :class="selectedPointId === pt.id ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400 border border-slate-700'"
                    >
                      <Check class="w-3.5 h-3.5 stroke-[3]" />
                      <span>{{ selectedPointId === pt.id ? '已选中' : '选择' }}</span>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredPoints.length === 0">
                  <td colspan="3" class="p-8 text-center text-slate-300 font-sans text-sm font-medium">
                    当前装置暂无符合条件的测点
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Footer Bar -->
      <div class="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2 text-xs">
          <span class="text-cyan-300 font-bold">当前选择:</span>
          <span v-if="isUnboundPending" class="text-rose-400 font-bold font-mono">
            [已标记解除测点绑定]
          </span>
          <span v-else-if="selectedPoint" class="text-cyan-200 font-bold font-mono">
            [{{ selectedCategory.toUpperCase() }}] {{ currentFacility?.fac_name }} → {{ currentBay?.bay_name }} → {{ currentDevice?.dev_name }} → 点号: <strong class="text-amber-300 font-bold">{{ selectedPoint.pointId }}</strong> ({{ selectedPoint.name }})
          </span>
          <span v-else class="text-slate-300 font-medium">
            未选择任何测点
          </span>
        </div>

        <div class="flex items-center gap-3">
          <button
            class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            class="px-6 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-lg shadow-cyan-500/30 flex items-center gap-1.5 cursor-pointer"
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
