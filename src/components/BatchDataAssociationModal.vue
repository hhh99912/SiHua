<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  Link2,
  X,
  Search,
  CheckCircle2,
  Cpu,
  Radio,
  Zap,
  Layers,
  Check,
  Building2,
  ChevronRight,
  ArrowUpDown,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  Trash2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Plus,
  CornerDownRight
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
import { scadaFacilities } from '../utils/scadaClient';

interface Props {
  visible: boolean;
  components: ScreenComponent[];
  category?: 'yc' | 'yx';
  datasets?: DatasetItem[];
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  components: () => [],
  category: 'yc',
  datasets: () => []
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', mappings: Array<{
    componentId: string;
    point: { pointId: number; name: string };
    deviceId: string;
    deviceName: string;
    datasetId: string;
    category: 'yc' | 'yx';
  }>): void;
}>();

export type SortMode = 'y' | 'x';
const currentSortMode = ref<SortMode>('y');

// 1. Sort components by user-selected coordinate dimension:
// - If 'y': sort by Y ascending; if Y identical, internally sort by X ascending
// - If 'x': sort by X ascending; if X identical, internally sort by Y ascending
const sortedComponents = computed(() => {
  return [...props.components].sort((a, b) => {
    const ya = a.y ?? 0;
    const yb = b.y ?? 0;
    const xa = a.x ?? 0;
    const xb = b.x ?? 0;

    if (currentSortMode.value === 'x') {
      if (xa !== xb) return xa - xb;
      return ya - yb;
    } else {
      if (ya !== yb) return ya - yb;
      return xa - xb;
    }
  });
});

const targetCount = computed(() => sortedComponents.value.length);

export interface SelectedPointItem {
  pointId: number;
  name: string;
  facId: number | string;
  facName: string;
  bayId: number | string;
  bayName: string;
  devId: number | string;
  devName: string;
  category: 'yc' | 'yx';
}

// Cascading Selector State
const selectedFacId = ref<number | string>(scadaFacilities.value[0]?.fac_id || 4000003);
const selectedBayId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.bay_id || 430000001);
const selectedDevId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.devices?.[0]?.dev_id || 7000001);
const searchQuery = ref<string>('');
const selectedPoints = ref<SelectedPointItem[]>([]);
const activeSlotIndex = ref<number | null>(null);

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

// Points list for current device and category (Only ID & Name)
const pointsList = computed(() => {
  const dev = currentDevice.value;
  if (!dev) return [];
  if (props.category === 'yc') {
    return dev.yc_list || [];
  } else {
    return dev.yx_list || [];
  }
});

// Filtered Points
const filteredPoints = computed(() => {
  const list = pointsList.value;
  if (!searchQuery.value.trim()) return list;
  const q = searchQuery.value.toLowerCase().trim();
  return list.filter(item =>
    String(item.id).toLowerCase().includes(q) ||
    (item.name && item.name.toLowerCase().includes(q))
  );
});

// Reset and initialize when modal opens
watch(
  () => props.visible,
  (isOpen) => {
    if (isOpen) {
      searchQuery.value = '';
      activeSlotIndex.value = null;
      selectedPoints.value = [];

      // Attempt to prepopulate existing bindings if already mapped
      const prefilled: SelectedPointItem[] = [];
      for (const comp of sortedComponents.value) {
        const mapping = comp.data?.mapping;
        const bindings = comp.data?.bindings;
        const boundKey = bindings?.value || bindings?.state || mapping?.valueKey || mapping?.stateKey || '';
        const m = String(boundKey).match(/(\d{5,})/);
        const targetPtId = mapping?.pointId ? Number(mapping.pointId) : (m ? Number(m[1]) : null);

        if (targetPtId) {
          let found = false;
          for (const fac of scadaFacilities.value) {
            for (const bay of fac.bays || []) {
              for (const dev of bay.devices || []) {
                const list = props.category === 'yc' ? dev.yc_list : dev.yx_list;
                const pt = (list || []).find(p => p.id === targetPtId);
                if (pt) {
                  prefilled.push({
                    pointId: pt.id,
                    name: pt.name,
                    facId: fac.fac_id,
                    facName: fac.fac_name,
                    bayId: bay.bay_id,
                    bayName: bay.bay_name,
                    devId: dev.dev_id,
                    devName: dev.dev_name,
                    category: props.category
                  });
                  found = true;
                  break;
                }
              }
              if (found) break;
            }
            if (found) break;
          }
        }
      }

      if (prefilled.length === sortedComponents.value.length) {
        selectedPoints.value = prefilled;
      }
    }
  },
  { immediate: true }
);

// Add a point to the list (supports repeat selection)
const handleAddPoint = (pt: any) => {
  const item: SelectedPointItem = {
    pointId: pt.id,
    name: pt.name,
    facId: selectedFacId.value,
    facName: currentFacility.value?.fac_name || '',
    bayId: selectedBayId.value,
    bayName: currentBay.value?.bay_name || '',
    devId: selectedDevId.value,
    devName: currentDevice.value?.dev_name || '',
    category: props.category
  };

  if (activeSlotIndex.value !== null && activeSlotIndex.value < targetCount.value) {
    if (activeSlotIndex.value < selectedPoints.value.length) {
      selectedPoints.value[activeSlotIndex.value] = item;
    } else {
      selectedPoints.value.push(item);
    }
    if (activeSlotIndex.value + 1 < targetCount.value) {
      activeSlotIndex.value++;
    } else {
      activeSlotIndex.value = null;
    }
  } else {
    if (selectedPoints.value.length < targetCount.value) {
      selectedPoints.value.push(item);
    } else {
      // If already full, overwrite the last item
      selectedPoints.value[selectedPoints.value.length - 1] = item;
    }
  }
};

// Batch continuous fill starting from the clicked point
const handleContinuousFill = (startPt: any) => {
  const list = filteredPoints.value;
  const startIndex = list.findIndex(p => p.id === startPt.id);
  if (startIndex === -1) return;

  const startSlot = activeSlotIndex.value !== null ? activeSlotIndex.value : selectedPoints.value.length;
  let currentList = [...selectedPoints.value];

  for (let i = 0; i < targetCount.value - startSlot; i++) {
    const ptIndex = startIndex + i;
    if (ptIndex < list.length) {
      const pt = list[ptIndex];
      const item: SelectedPointItem = {
        pointId: pt.id,
        name: pt.name,
        facId: selectedFacId.value,
        facName: currentFacility.value?.fac_name || '',
        bayId: selectedBayId.value,
        bayName: currentBay.value?.bay_name || '',
        devId: selectedDevId.value,
        devName: currentDevice.value?.dev_name || '',
        category: props.category
      };
      currentList[startSlot + i] = item;
    }
  }

  selectedPoints.value = currentList.slice(0, targetCount.value);
  activeSlotIndex.value = null;
};

// Reordering & Deletion
const handleMoveUp = (index: number) => {
  if (index <= 0) return;
  const temp = selectedPoints.value[index];
  selectedPoints.value[index] = selectedPoints.value[index - 1];
  selectedPoints.value[index - 1] = temp;
};

const handleMoveDown = (index: number) => {
  if (index >= selectedPoints.value.length - 1) return;
  const temp = selectedPoints.value[index];
  selectedPoints.value[index] = selectedPoints.value[index + 1];
  selectedPoints.value[index + 1] = temp;
};

const handleRemovePoint = (index: number) => {
  selectedPoints.value.splice(index, 1);
  if (activeSlotIndex.value === index) {
    activeSlotIndex.value = null;
  }
};

const handleClearAll = () => {
  selectedPoints.value = [];
  activeSlotIndex.value = null;
};

// Submit handler
const handleSubmit = (mode: SortMode) => {
  if (selectedPoints.value.length !== targetCount.value) {
    return;
  }

  currentSortMode.value = mode;

  const componentsToMap = [...props.components].sort((a, b) => {
    const ya = a.y ?? 0;
    const yb = b.y ?? 0;
    const xa = a.x ?? 0;
    const xb = b.x ?? 0;

    if (mode === 'x') {
      if (xa !== xb) return xa - xb;
      return ya - yb;
    } else {
      if (ya !== yb) return ya - yb;
      return xa - xb;
    }
  });

  const mappings = componentsToMap.map((comp, idx) => {
    const pt = selectedPoints.value[idx];
    return {
      componentId: comp.id,
      point: {
        pointId: pt.pointId,
        name: pt.name
      },
      deviceId: String(pt.devId),
      deviceName: pt.devName ? `${pt.bayName} - ${pt.devName}` : '',
      datasetId: String(pt.facId),
      category: props.category
    };
  });

  emit('submit', mappings);
  emit('close');
};
</script>

<template>
  <div
    v-if="visible"
    id="batch-data-association-modal"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 select-none font-sans"
    @click.self="emit('close')"
  >
    <div
      class="relative w-full max-w-6xl h-[750px] max-h-[95vh] bg-slate-900 border-2 border-cyan-500/70 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white"
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-cyan-500/20 border border-cyan-400 rounded-xl text-cyan-300">
            <Link2 class="w-6 h-6" />
          </div>
          <div>
            <div class="flex items-center gap-3">
              <h2 class="text-base font-bold text-white tracking-wide">
                SCADA 测点批量关联配置
              </h2>
              <span
                class="px-3 py-0.5 rounded-full text-xs font-mono font-bold border"
                :class="category === 'yc' ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-indigo-500/20 border-indigo-400 text-indigo-300'"
              >
                {{ category === 'yc' ? '遥测 (YC) 批量关联' : '遥信 (YX) 批量关联' }}
              </span>
              <span class="px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/20 border border-cyan-400 text-cyan-200">
                批选元件: {{ targetCount }} 个
              </span>
              <span
                class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border"
                :class="currentSortMode === 'x' ? 'bg-sky-950 text-sky-300 border-sky-500/50' : 'bg-emerald-950 text-emerald-300 border-emerald-500/50'"
              >
                当前预览: {{ currentSortMode === 'x' ? 'X 横坐标优先 (同X按Y)' : 'Y 纵坐标优先 (同Y按X)' }}
              </span>
            </div>
            <p class="text-xs text-cyan-200/90 mt-1 font-medium">
              批选规则：所选图元支持<strong>按横坐标关联</strong>或<strong>按纵坐标关联</strong>（坐标相同时内部自动按次轴升序排序），请在左侧选入 <strong>{{ targetCount }}</strong> 个测点，允许重复选择。
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            class="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            @click="handleClearAll"
          >
            <Trash2 class="w-4 h-4 text-rose-400" />
            <span>清空已选列表</span>
          </button>
          <button
            class="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            @click="emit('close')"
          >
            <X class="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <!-- Main Cascading & Mapping Layout -->
      <div class="flex-1 flex overflow-hidden">
        <!-- 1. 厂站 (Facility) -->
        <div class="w-44 border-r border-slate-800 bg-slate-950/60 flex flex-col shrink-0">
          <div class="p-2.5 border-b border-slate-800 text-xs font-bold text-cyan-300 flex items-center justify-between bg-slate-950">
            <div class="flex items-center gap-1.5">
              <Building2 class="w-3.5 h-3.5 text-blue-400" />
              <span>1. 厂站</span>
            </div>
            <span class="px-1.5 py-0.2 bg-blue-900/60 border border-blue-400 text-blue-200 text-[10px] rounded font-mono font-bold">
              {{ scadaFacilities.length }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto p-1.5 space-y-1">
            <div
              v-for="fac in scadaFacilities"
              :key="fac.fac_id"
              class="p-2 rounded-lg cursor-pointer border transition-all text-left text-xs"
              :class="selectedFacId === fac.fac_id ? 'bg-blue-600/30 border-blue-400 text-white font-bold shadow-md' : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700'"
              @click="selectedFacId = fac.fac_id; if (fac.bays?.[0]) selectedBayId = fac.bays[0].bay_id; if (fac.bays?.[0]?.devices?.[0]) selectedDevId = fac.bays[0].devices[0].dev_id;"
            >
              <div class="flex items-center justify-between">
                <span class="truncate text-white font-bold">{{ fac.fac_name }}</span>
                <ChevronRight class="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div class="text-[10px] text-blue-300 font-mono mt-0.5">ID: {{ fac.fac_id }}</div>
            </div>
          </div>
        </div>

        <!-- 2. 间隔 (Bay) -->
        <div class="w-48 border-r border-slate-800 bg-slate-950/40 flex flex-col shrink-0">
          <div class="p-2.5 border-b border-slate-800 text-xs font-bold text-cyan-300 flex items-center justify-between bg-slate-950">
            <div class="flex items-center gap-1.5">
              <Layers class="w-3.5 h-3.5 text-indigo-400" />
              <span>2. 间隔</span>
            </div>
            <span class="px-1.5 py-0.2 bg-indigo-900/60 border border-indigo-400 text-indigo-200 text-[10px] rounded font-mono font-bold">
              {{ currentFacility?.bays?.length || 0 }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto p-1.5 space-y-1">
            <div
              v-for="bay in (currentFacility?.bays || [])"
              :key="bay.bay_id"
              class="p-2 rounded-lg cursor-pointer border transition-all text-left text-xs"
              :class="selectedBayId === bay.bay_id ? 'bg-indigo-600/30 border-indigo-400 text-white font-bold shadow-md' : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700'"
              @click="selectedBayId = bay.bay_id; if (bay.devices?.[0]) selectedDevId = bay.devices[0].dev_id;"
            >
              <div class="flex items-center justify-between">
                <span class="truncate text-white font-bold">{{ bay.bay_name }}</span>
                <ChevronRight class="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div class="text-[10px] text-indigo-300 font-mono mt-0.5">ID: {{ bay.bay_id }}</div>
            </div>
          </div>
        </div>

        <!-- 3. 装置 (Device) -->
        <div class="w-52 border-r border-slate-800 bg-slate-950/30 flex flex-col shrink-0">
          <div class="p-2.5 border-b border-slate-800 text-xs font-bold text-cyan-300 flex items-center justify-between bg-slate-950">
            <div class="flex items-center gap-1.5">
              <Cpu class="w-3.5 h-3.5 text-emerald-400" />
              <span>3. 装置</span>
            </div>
            <span class="px-1.5 py-0.2 bg-emerald-900/60 border border-emerald-400 text-emerald-200 text-[10px] rounded font-mono font-bold">
              {{ currentBay?.devices?.length || 0 }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto p-1.5 space-y-1">
            <div
              v-for="dev in (currentBay?.devices || [])"
              :key="dev.dev_id"
              class="p-2 rounded-lg cursor-pointer border transition-all text-left text-xs"
              :class="selectedDevId === dev.dev_id ? 'bg-emerald-600/30 border-emerald-400 text-white font-bold shadow-md' : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700'"
              @click="selectedDevId = dev.dev_id"
            >
              <div class="truncate text-white font-bold">{{ dev.dev_name }}</div>
              <div class="text-[10px] text-emerald-300 font-mono mt-0.5">ID: {{ dev.dev_id }}</div>
            </div>
          </div>
        </div>

        <!-- 4. 测点选择池 (Point Pool) -->
        <div class="flex-1 flex flex-col bg-slate-900 overflow-hidden border-r border-slate-800">
          <!-- Search Bar -->
          <div class="p-2.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-2 shrink-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Zap v-if="category === 'yc'" class="w-4 h-4 text-amber-300" />
                <Radio v-else class="w-4 h-4 text-indigo-300" />
                <span>{{ category === 'yc' ? '遥测 (YC) 测点池' : '遥信 (YX) 测点池' }}</span>
              </span>
              <span class="px-2 py-0.5 bg-black/50 border border-slate-700 rounded text-[11px] font-mono font-bold text-slate-300">
                {{ filteredPoints.length }} 点
              </span>
            </div>

            <div class="relative w-48">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索点号或名称..."
                class="w-full pl-7 pr-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400 font-medium"
              />
              <Search class="w-3.5 h-3.5 text-cyan-400 absolute left-2 top-1.5" />
            </div>
          </div>

          <!-- Points Table -->
          <div class="flex-1 overflow-y-auto p-2">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-slate-800 bg-slate-950/80 text-cyan-300 text-[11px]">
                  <th class="p-2 font-bold w-24">点号</th>
                  <th class="p-2 font-bold">测点名称</th>
                  <th class="p-2 font-bold w-28 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/80">
                <tr
                  v-for="pt in filteredPoints"
                  :key="pt.id"
                  class="cursor-pointer transition-colors hover:bg-slate-800/70 text-slate-100 group"
                  @click="handleAddPoint(pt)"
                >
                  <td class="p-2 font-mono text-xs font-bold" :class="category === 'yc' ? 'text-amber-300' : 'text-cyan-300'">
                    {{ pt.id }}
                  </td>
                  <td class="p-2 font-sans text-xs font-medium text-white truncate max-w-[140px]" :title="pt.name">
                    {{ pt.name }}
                  </td>
                  <td class="p-2 text-right">
                    <div class="inline-flex items-center gap-1" @click.stop>
                      <button
                        class="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 hover:bg-cyan-500 hover:text-slate-950 transition-all flex items-center gap-0.5 cursor-pointer"
                        title="添加到下一个空位或当前选中的序号位"
                        @click="handleAddPoint(pt)"
                      >
                        <Plus class="w-3 h-3 stroke-[3]" />
                        <span>选入</span>
                      </button>
                      <button
                        class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950 transition-all flex items-center gap-0.5 cursor-pointer"
                        title="从当前点开始依次向下连续填充剩余位"
                        @click="handleContinuousFill(pt)"
                      >
                        <Sparkles class="w-3 h-3" />
                        <span>连选</span>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredPoints.length === 0">
                  <td colspan="3" class="p-6 text-center text-slate-400 font-sans text-xs">
                    当前装置暂无匹配测点
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 5. 顺序一一对应映射列表 (Ordered Mapping Queue) -->
        <div class="w-84 bg-slate-950 flex flex-col shrink-0 overflow-hidden border-l border-slate-800">
          <div class="p-2.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0 gap-1">
            <div class="flex items-center gap-1.5 shrink-0">
              <ArrowUpDown v-if="currentSortMode === 'y'" class="w-4 h-4 text-emerald-400" />
              <ArrowRightLeft v-else class="w-4 h-4 text-cyan-400" />
              <span class="text-xs font-bold text-white">映射队列</span>
              <span
                class="text-[11px] font-mono font-bold ml-0.5"
                :class="selectedPoints.length === targetCount ? 'text-emerald-400' : 'text-amber-400'"
              >
                ({{ selectedPoints.length }}/{{ targetCount }})
              </span>
            </div>

            <!-- Preview Sort Mode Switch Tabs -->
            <div class="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 shrink-0">
              <button
                class="px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                :class="currentSortMode === 'y' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'"
                @click="currentSortMode = 'y'"
                title="纵坐标优先：先按 Y 升序，若 Y 相同按 X 升序"
              >
                <ArrowUpDown class="w-3 h-3" />
                <span>Y 优先</span>
              </button>
              <button
                class="px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                :class="currentSortMode === 'x' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'"
                @click="currentSortMode = 'x'"
                title="横坐标优先：先按 X 升序，若 X 相同按 Y 升序"
              >
                <ArrowRightLeft class="w-3 h-3" />
                <span>X 优先</span>
              </button>
            </div>
          </div>

          <!-- Queue List -->
          <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
            <div
              v-for="(comp, idx) in sortedComponents"
              :key="comp.id"
              class="p-2 rounded-xl border transition-all text-xs flex flex-col gap-1.5"
              :class="[
                activeSlotIndex === idx
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : selectedPoints[idx]
                  ? 'bg-slate-900 border-slate-700/80 hover:border-slate-600'
                  : 'bg-slate-900/60 border-dashed border-amber-500/50 hover:border-amber-400'
              ]"
              @click="activeSlotIndex = idx"
            >
              <!-- Slot Header & Component Info -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span
                    class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold"
                    :class="selectedPoints[idx] ? 'bg-cyan-500 text-slate-950' : 'bg-amber-500/30 text-amber-300 border border-amber-500/60'"
                  >
                    {{ idx + 1 }}
                  </span>
                  <span class="font-bold text-white truncate max-w-[150px]" :title="comp.name">
                    {{ comp.name || '未命名元件' }}
                  </span>
                </div>
                <div class="flex items-center gap-1 text-[10px] font-mono text-cyan-300/80 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  <span :class="currentSortMode === 'x' ? 'text-sky-300 font-bold' : ''">X:{{ Math.round(comp.x ?? 0) }}</span>
                  <span class="text-slate-600">|</span>
                  <span :class="currentSortMode === 'y' ? 'text-emerald-300 font-bold' : ''">Y:{{ Math.round(comp.y ?? 0) }}</span>
                </div>
              </div>

              <!-- Point Mapping State -->
              <div v-if="selectedPoints[idx]" class="bg-slate-950/90 p-1.5 rounded-lg border border-slate-800 flex items-center justify-between">
                <div class="truncate pr-1">
                  <div class="flex items-center gap-1 text-[11px] font-mono font-bold" :class="category === 'yc' ? 'text-amber-300' : 'text-cyan-300'">
                    <span>ID: {{ selectedPoints[idx].pointId }}</span>
                    <span class="text-slate-300 font-sans font-normal truncate">({{ selectedPoints[idx].name }})</span>
                  </div>
                  <div class="text-[10px] text-slate-400 truncate mt-0.5">
                    {{ selectedPoints[idx].facName }} → {{ selectedPoints[idx].bayName }} → {{ selectedPoints[idx].devName }}
                  </div>
                </div>

                <!-- Up, Down, Delete buttons -->
                <div class="flex items-center gap-0.5 shrink-0" @click.stop>
                  <button
                    class="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded disabled:opacity-20 cursor-pointer"
                    :disabled="idx === 0"
                    title="上移此测点"
                    @click="handleMoveUp(idx)"
                  >
                    <ArrowUp class="w-3.5 h-3.5" />
                  </button>
                  <button
                    class="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded disabled:opacity-20 cursor-pointer"
                    :disabled="idx >= selectedPoints.length - 1"
                    title="下移此测点"
                    @click="handleMoveDown(idx)"
                  >
                    <ArrowDown class="w-3.5 h-3.5" />
                  </button>
                  <button
                    class="p-1 text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 rounded cursor-pointer"
                    title="移除该测点"
                    @click="handleRemovePoint(idx)"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div
                v-else
                class="bg-amber-950/20 p-2 rounded-lg border border-dashed border-amber-500/40 flex items-center justify-between text-[11px] text-amber-300"
              >
                <div class="flex items-center gap-1">
                  <CornerDownRight class="w-3.5 h-3.5 text-amber-400" />
                  <span>待分配测点 (点击左侧列表选入)</span>
                </div>
                <span class="text-[10px] text-amber-400/80 font-mono">位 #{{ idx + 1 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Bar -->
      <div class="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2 text-xs">
          <span class="text-cyan-300 font-bold">配置进度:</span>
          <div
            v-if="selectedPoints.length === targetCount"
            class="flex items-center gap-1.5 text-emerald-400 font-bold"
          >
            <CheckCircle2 class="w-4 h-4 text-emerald-400" />
            <span>已选齐 {{ targetCount }} 个测点，请选择「按横坐标关联」或「按纵坐标关联」完成映射</span>
          </div>
          <div
            v-else
            class="flex items-center gap-1.5 text-amber-300 font-medium"
          >
            <AlertTriangle class="w-4 h-4 text-amber-400" />
            <span>
              已选择 <strong class="text-white font-mono">{{ selectedPoints.length }}</strong> / {{ targetCount }} 个测点
              (还需选择 <strong class="text-rose-400 font-mono">{{ targetCount - selectedPoints.length }}</strong> 个点)
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            @click="emit('close')"
          >
            取消
          </button>

          <!-- 按钮 1: 按照横坐标关联 (X轴优先，若X相同按Y排序) -->
          <button
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            :class="[
              selectedPoints.length === targetCount
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/25 active:scale-95'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60 shadow-none'
            ]"
            :disabled="selectedPoints.length !== targetCount"
            title="按照横坐标(X)升序依次关联；若横坐标一致，则内部按照纵坐标(Y)升序关联"
            @click="handleSubmit('x')"
          >
            <ArrowRightLeft class="w-4 h-4 stroke-[2.5]" />
            <div class="flex flex-col text-left leading-tight">
              <span>按横坐标关联</span>
              <span class="text-[9px] opacity-80 font-mono font-normal">(X优先 / 同X按Y)</span>
            </div>
          </button>

          <!-- 按钮 2: 按照纵坐标关联 (Y轴优先，若Y相同按X排序) -->
          <button
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            :class="[
              selectedPoints.length === targetCount
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 active:scale-95'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60 shadow-none'
            ]"
            :disabled="selectedPoints.length !== targetCount"
            title="按照纵坐标(Y)升序依次关联；若纵坐标一致，则内部按照横坐标(X)升序关联"
            @click="handleSubmit('y')"
          >
            <ArrowUpDown class="w-4 h-4 stroke-[2.5]" />
            <div class="flex flex-col text-left leading-tight">
              <span>按纵坐标关联</span>
              <span class="text-[9px] opacity-80 font-mono font-normal">(Y优先 / 同Y按X)</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
