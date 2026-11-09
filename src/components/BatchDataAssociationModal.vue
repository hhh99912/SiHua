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

      // Fast O(1) point map indexing across all facilities
      const pointMap = new Map<number, SelectedPointItem>();
      for (const fac of scadaFacilities.value) {
        for (const bay of fac.bays || []) {
          for (const dev of bay.devices || []) {
            const list = props.category === 'yc' ? dev.yc_list : dev.yx_list;
            for (const pt of list || []) {
              pointMap.set(pt.id, {
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
            }
          }
        }
      }

      // Instant O(1) prefill
      const prefilled: SelectedPointItem[] = [];
      for (const comp of sortedComponents.value) {
        const mapping = comp.data?.mapping;
        const bindings = comp.data?.bindings;
        const boundKey = bindings?.value || bindings?.state || mapping?.valueKey || mapping?.stateKey || '';
        const m = String(boundKey).match(/(\d{5,})/);
        const targetPtId = mapping?.pointId ? Number(mapping.pointId) : (m ? Number(m[1]) : null);

        if (targetPtId && pointMap.has(targetPtId)) {
          prefilled.push(pointMap.get(targetPtId)!);
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
    class="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none font-sans"
    style="transform: translateZ(0); will-change: transform;"
    @click.self="emit('close')"
  >
    <div
      class="relative w-full max-w-[1580px] w-[96vw] h-[90vh] max-h-[920px] bg-[#f2eee3] border-2 border-[#8c826d] rounded-xl shadow-2xl flex flex-col overflow-hidden text-black"
      style="contain: paint layout;"
    >
      <!-- Header: 简洁统一工控米白，高对比度黑字 -->
      <div class="px-6 py-3.5 border-b border-[#cfc5b0] bg-[#e5decb] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full bg-sky-700"></div>
          <div class="flex items-center gap-3">
            <h2 class="text-base font-bold text-black tracking-normal">
              SCADA 测点批量关联配置 ({{ category === 'yc' ? '遥测 YC' : '遥信 YX' }})
            </h2>
            <span class="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-[#dfd6bf] border border-[#b8ad96] text-black">
              待关联图元: {{ targetCount }} 个
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            class="px-3 py-1 rounded text-xs font-bold bg-[#dfd6bf] border border-[#b8ad96] text-rose-800 hover:bg-[#d4caaf] transition-colors flex items-center gap-1.5 cursor-pointer"
            @click="handleClearAll"
          >
            <Trash2 class="w-3.5 h-3.5 text-rose-700" />
            <span>清空已选列表</span>
          </button>
          <button
            class="p-1.5 text-black hover:text-rose-700 hover:bg-rose-100 rounded transition-colors cursor-pointer"
            @click="emit('close')"
          >
            <X class="w-5 h-5 text-black" />
          </button>
        </div>
      </div>

      <!-- Main Cascading & Mapping Layout -->
      <div class="flex-1 flex overflow-hidden bg-[#ebe4d4]">
        <!-- 1. 厂站 (Facility) -->
        <div class="w-44 border-r border-[#cfc5b0] bg-[#ebe4d4] flex flex-col shrink-0">
          <div class="p-2.5 border-b border-[#cfc5b0] text-xs font-bold text-black flex items-center justify-between bg-[#e5decb]">
            <div class="flex items-center gap-1.5">
              <Building2 class="w-3.5 h-3.5 text-sky-700" />
              <span>1. 厂站</span>
            </div>
            <span class="px-1.5 py-0.5 bg-[#dfd6bf] border border-[#b8ad96] text-black text-[11px] rounded font-mono font-bold">
              {{ scadaFacilities.length }}
            </span>
          </div>
          <div
            class="flex-1 overflow-y-auto p-2 space-y-1.5"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <div
              v-for="fac in scadaFacilities"
              :key="fac.fac_id"
              class="p-2.5 rounded border transition-colors text-left cursor-pointer"
              :class="selectedFacId === fac.fac_id ? 'bg-sky-700 border-sky-900 text-white font-bold shadow-xs' : 'bg-white border-[#cfc5b0] text-black hover:bg-[#faf7f0]'"
              @click="selectedFacId = fac.fac_id; if (fac.bays?.[0]) selectedBayId = fac.bays[0].bay_id; if (fac.bays?.[0]?.devices?.[0]) selectedDevId = fac.bays[0].devices[0].dev_id;"
            >
              <div class="truncate text-sm font-bold mb-0.5" :class="selectedFacId === fac.fac_id ? 'text-white' : 'text-black'">{{ fac.fac_name }}</div>
              <div class="text-[11px] font-mono" :class="selectedFacId === fac.fac_id ? 'text-sky-100 font-bold' : 'text-neutral-600 font-medium'">ID: {{ fac.fac_id }}</div>
            </div>
          </div>
        </div>

        <!-- 2. 间隔 (Bay) -->
        <div class="w-48 border-r border-[#cfc5b0] bg-[#ebe4d4] flex flex-col shrink-0">
          <div class="p-2.5 border-b border-[#cfc5b0] text-xs font-bold text-black flex items-center justify-between bg-[#e5decb]">
            <div class="flex items-center gap-1.5">
              <Layers class="w-3.5 h-3.5 text-sky-700" />
              <span>2. 间隔</span>
            </div>
            <span class="px-1.5 py-0.5 bg-[#dfd6bf] border border-[#b8ad96] text-black text-[11px] rounded font-mono font-bold">
              {{ currentFacility?.bays?.length || 0 }}
            </span>
          </div>
          <div
            class="flex-1 overflow-y-auto p-2 space-y-1.5"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <div
              v-for="bay in (currentFacility?.bays || [])"
              :key="bay.bay_id"
              class="p-2.5 rounded border transition-colors text-left cursor-pointer"
              :class="selectedBayId === bay.bay_id ? 'bg-sky-700 border-sky-900 text-white font-bold shadow-xs' : 'bg-white border-[#cfc5b0] text-black hover:bg-[#faf7f0]'"
              @click="selectedBayId = bay.bay_id; if (bay.devices?.[0]) selectedDevId = bay.devices[0].dev_id;"
            >
              <div class="truncate text-sm font-bold mb-0.5" :class="selectedBayId === bay.bay_id ? 'text-white' : 'text-black'">{{ bay.bay_name }}</div>
              <div class="text-[11px] font-mono" :class="selectedBayId === bay.bay_id ? 'text-sky-100 font-bold' : 'text-neutral-600 font-medium'">ID: {{ bay.bay_id }}</div>
            </div>
          </div>
        </div>

        <!-- 3. 装置 (Device) -->
        <div class="w-52 border-r border-[#cfc5b0] bg-[#ebe4d4] flex flex-col shrink-0">
          <div class="p-2.5 border-b border-[#cfc5b0] text-xs font-bold text-black flex items-center justify-between bg-[#e5decb]">
            <div class="flex items-center gap-1.5">
              <Cpu class="w-3.5 h-3.5 text-sky-700" />
              <span>3. 装置</span>
            </div>
            <span class="px-1.5 py-0.5 bg-[#dfd6bf] border border-[#b8ad96] text-black text-[11px] rounded font-mono font-bold">
              {{ currentBay?.devices?.length || 0 }}
            </span>
          </div>
          <div
            class="flex-1 overflow-y-auto p-2 space-y-1.5"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <div
              v-for="dev in (currentBay?.devices || [])"
              :key="dev.dev_id"
              class="p-2.5 rounded border transition-colors text-left cursor-pointer"
              :class="selectedDevId === dev.dev_id ? 'bg-sky-700 border-sky-900 text-white font-bold shadow-xs' : 'bg-white border-[#cfc5b0] text-black hover:bg-[#faf7f0]'"
              @click="selectedDevId = dev.dev_id"
            >
              <div class="truncate text-sm font-bold mb-0.5" :class="selectedDevId === dev.dev_id ? 'text-white' : 'text-black'">{{ dev.dev_name }}</div>
              <div class="text-[11px] font-mono" :class="selectedDevId === dev.dev_id ? 'text-sky-100 font-bold' : 'text-neutral-600 font-medium'">ID: {{ dev.dev_id }}</div>
            </div>
          </div>
        </div>

        <!-- 4. 测点选择池 (Point Pool) -->
        <div class="flex-1 flex flex-col bg-[#f2eee3] overflow-hidden border-r border-[#cfc5b0] min-w-0">
          <!-- Search Bar -->
          <div class="p-2.5 border-b border-[#cfc5b0] bg-[#e5decb] flex items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-black flex items-center gap-1.5">
                <Zap v-if="category === 'yc'" class="w-3.5 h-3.5 text-sky-700" />
                <Radio v-else class="w-3.5 h-3.5 text-sky-700" />
                <span>{{ category === 'yc' ? '遥测 (YC) 可选测点池' : '遥信 (YX) 可选测点池' }}</span>
              </span>
              <span class="px-1.5 py-0.5 bg-[#dfd6bf] border border-[#b8ad96] rounded text-[11px] font-mono font-bold text-black">
                {{ filteredPoints.length }} 个
              </span>
            </div>

            <div class="relative w-64">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索测点名称..."
                class="w-full pl-7 pr-3 py-1 bg-white border border-[#b8ad96] rounded text-xs text-black placeholder:text-neutral-500 focus:outline-none focus:border-sky-700 font-medium"
              />
              <Search class="w-3.5 h-3.5 text-neutral-600 absolute left-2 top-2" />
            </div>
          </div>

          <!-- Points Table -->
          <div
            class="flex-1 overflow-y-auto p-2.5 bg-[#f2eee3]"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <table class="w-full text-left text-sm border-collapse bg-white border border-[#cfc5b0]" style="table-layout: fixed;">
              <thead>
                <tr class="border-b border-[#cfc5b0] bg-[#e5decb] text-black font-bold sticky top-0 z-10 h-10">
                  <th class="p-2.5 w-16 text-center text-xs">序号</th>
                  <th class="p-2.5 text-xs">测点名称</th>
                  <th class="p-2.5 w-40 text-right text-xs">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#ebe4d4]">
                <tr
                  v-for="(pt, idx) in filteredPoints"
                  :key="pt.id"
                  class="cursor-pointer transition-colors hover:bg-[#faf7f0] text-black group"
                  @click="handleAddPoint(pt)"
                >
                  <td class="p-2.5 text-center font-mono text-xs font-bold text-neutral-700">
                    #{{ idx + 1 }}
                  </td>
                  <td class="p-2.5 font-sans text-sm font-bold text-black truncate" :title="pt.name">
                    {{ pt.name }}
                  </td>
                  <td class="p-2.5 text-right">
                    <div class="inline-flex items-center gap-1.5" @click.stop>
                      <button
                        class="px-2.5 py-1 rounded text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white border border-sky-950 transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                        title="添加到下一个空位或当前选中的序号位"
                        @click="handleAddPoint(pt)"
                      >
                        <Plus class="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>选入</span>
                      </button>
                      <button
                        class="px-2.5 py-1 rounded text-xs font-bold bg-[#dfd6bf] hover:bg-[#d4caaf] text-black border border-[#b8ad96] transition-colors flex items-center gap-1 cursor-pointer"
                        title="从当前点开始依次向下连续填充剩余位"
                        @click="handleContinuousFill(pt)"
                      >
                        <Sparkles class="w-3.5 h-3.5 text-sky-800" />
                        <span>连选</span>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredPoints.length === 0">
                  <td colspan="3" class="p-8 text-center text-neutral-700 font-sans text-sm font-bold">
                    当前装置暂无匹配测点
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 5. 顺序一一对应映射列表 (Ordered Mapping Queue) -->
        <div class="w-[420px] bg-[#ebe4d4] flex flex-col shrink-0 overflow-hidden border-l border-[#cfc5b0]">
          <div class="p-2.5 border-b border-[#cfc5b0] bg-[#e5decb] flex items-center justify-between shrink-0 gap-2">
            <div class="flex items-center gap-2 shrink-0">
              <ArrowUpDown v-if="currentSortMode === 'y'" class="w-3.5 h-3.5 text-sky-700" />
              <ArrowRightLeft v-else class="w-3.5 h-3.5 text-sky-700" />
              <span class="text-xs font-bold text-black">映射对应队列</span>
              <span
                class="text-xs font-mono font-bold"
                :class="selectedPoints.length === targetCount ? 'text-emerald-700' : 'text-sky-800'"
              >
                ({{ selectedPoints.length }}/{{ targetCount }})
              </span>
            </div>

            <!-- Preview Sort Mode Switch Tabs -->
            <div class="flex items-center bg-[#dfd6bf] p-0.5 rounded border border-[#b8ad96] shrink-0">
              <button
                class="px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                :class="currentSortMode === 'y' ? 'bg-sky-700 text-white font-bold shadow-xs' : 'text-black hover:bg-[#d4caaf]'"
                @click="currentSortMode = 'y'"
                title="纵坐标优先：先按 Y 升序，若 Y 相同按 X 升序"
              >
                <ArrowUpDown class="w-3 h-3" />
                <span>Y 优先</span>
              </button>
              <button
                class="px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                :class="currentSortMode === 'x' ? 'bg-sky-700 text-white font-bold shadow-xs' : 'text-black hover:bg-[#d4caaf]'"
                @click="currentSortMode = 'x'"
                title="横坐标优先：先按 X 升序，若 X 相同按 Y 升序"
              >
                <ArrowRightLeft class="w-3 h-3" />
                <span>X 优先</span>
              </button>
            </div>
          </div>

          <!-- Queue List -->
          <div
            class="flex-1 overflow-y-auto p-2 space-y-1.5"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <div
              v-for="(comp, idx) in sortedComponents"
              :key="comp.id"
              class="p-2 rounded border transition-colors text-xs flex flex-col gap-1.5 cursor-pointer"
              :class="[
                activeSlotIndex === idx
                  ? 'bg-sky-50 border-2 border-sky-600 shadow-xs'
                  : selectedPoints[idx]
                  ? 'bg-white border-[#cfc5b0] shadow-xs'
                  : 'bg-white/60 border-dashed border-[#b8ad96]'
              ]"
              @click="activeSlotIndex = idx"
            >
              <!-- Slot Header & Component Info -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span
                    class="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono font-bold"
                    :class="selectedPoints[idx] ? 'bg-sky-700 text-white' : 'bg-[#dfd6bf] text-black border border-[#b8ad96]'"
                  >
                    {{ idx + 1 }}
                  </span>
                  <span class="font-bold text-black text-xs truncate max-w-[170px]" :title="comp.name">
                    {{ comp.name || '未命名元件' }}
                  </span>
                </div>
                <div class="flex items-center gap-1 text-[11px] font-mono text-neutral-800 bg-[#dfd6bf] px-1.5 py-0.5 rounded border border-[#b8ad96]">
                  <span :class="currentSortMode === 'x' ? 'text-sky-900 font-bold' : ''">X:{{ Math.round(comp.x ?? 0) }}</span>
                  <span class="text-neutral-400">|</span>
                  <span :class="currentSortMode === 'y' ? 'text-sky-900 font-bold' : ''">Y:{{ Math.round(comp.y ?? 0) }}</span>
                </div>
              </div>

              <!-- Point Mapping State -->
              <div v-if="selectedPoints[idx]" class="bg-[#faf7f0] p-1.5 rounded border border-[#cfc5b0] flex items-center justify-between">
                <div class="truncate pr-1">
                  <div class="flex items-center gap-1 text-xs font-mono font-bold text-sky-900">
                    <span>ID: {{ selectedPoints[idx].pointId }}</span>
                    <span class="text-black font-sans font-bold truncate">({{ selectedPoints[idx].name }})</span>
                  </div>
                  <div class="text-[11px] text-neutral-700 truncate mt-0.5 font-medium">
                    {{ selectedPoints[idx].facName }} → {{ selectedPoints[idx].bayName }} → {{ selectedPoints[idx].devName }}
                  </div>
                </div>

                <!-- Up, Down, Delete buttons -->
                <div class="flex items-center gap-0.5 shrink-0" @click.stop>
                  <button
                    class="p-1 text-black hover:text-sky-800 hover:bg-[#dfd6bf] rounded disabled:opacity-20 cursor-pointer"
                    :disabled="idx === 0"
                    title="上移此测点"
                    @click="handleMoveUp(idx)"
                  >
                    <ArrowUp class="w-3.5 h-3.5" />
                  </button>
                  <button
                    class="p-1 text-black hover:text-sky-800 hover:bg-[#dfd6bf] rounded disabled:opacity-20 cursor-pointer"
                    :disabled="idx >= selectedPoints.length - 1"
                    title="下移此测点"
                    @click="handleMoveDown(idx)"
                  >
                    <ArrowDown class="w-3.5 h-3.5" />
                  </button>
                  <button
                    class="p-1 text-rose-700 hover:text-rose-900 hover:bg-rose-100 rounded cursor-pointer"
                    title="移除该测点"
                    @click="handleRemovePoint(idx)"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div
                v-else
                class="bg-white/40 p-2 rounded border border-dashed border-[#b8ad96] flex items-center justify-between text-xs text-neutral-600"
              >
                <div class="flex items-center gap-1">
                  <CornerDownRight class="w-3.5 h-3.5 text-sky-700" />
                  <span>待分配测点 (点击左侧列表选入)</span>
                </div>
                <span class="text-[11px] text-sky-800 font-mono font-bold">位 #{{ idx + 1 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Bar -->
      <div class="px-6 py-3 border-t border-[#cfc5b0] bg-[#e5decb] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-black font-bold">配置进度:</span>
          <div
            v-if="selectedPoints.length === targetCount"
            class="flex items-center gap-1.5 text-emerald-800 font-bold"
          >
            <CheckCircle2 class="w-4 h-4 text-emerald-700" />
            <span>已选齐 {{ targetCount }} 个测点，请选择「按横坐标关联」或「按纵坐标关联」完成映射</span>
          </div>
          <div
            v-else
            class="flex items-center gap-1.5 text-black font-medium"
          >
            <AlertTriangle class="w-4 h-4 text-amber-700" />
            <span>
              已选择 <strong class="text-sky-900 font-mono font-bold text-base">{{ selectedPoints.length }}</strong> / {{ targetCount }} 个测点
              (还需选择 <strong class="text-amber-800 font-mono font-bold text-base">{{ targetCount - selectedPoints.length }}</strong> 个)
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            class="px-4 py-1.5 rounded text-xs sm:text-sm font-bold text-black bg-[#dfd6bf] hover:bg-[#d4caaf] border border-[#b8ad96] transition-colors cursor-pointer"
            @click="emit('close')"
          >
            取消
          </button>

          <!-- 按钮 1: 按照横坐标关联 (X轴优先，若X相同按Y排序) -->
          <button
            class="px-4 py-1.5 rounded text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer border"
            :class="[
              selectedPoints.length === targetCount
                ? 'bg-sky-700 hover:bg-sky-800 border-sky-950 text-white active:scale-95'
                : 'bg-[#dfd6bf] text-neutral-400 border-[#cfc5b0] cursor-not-allowed opacity-50 shadow-none'
            ]"
            :disabled="selectedPoints.length !== targetCount"
            title="按照横坐标(X)升序依次关联；若横坐标一致，则内部按照纵坐标(Y)升序关联"
            @click="handleSubmit('x')"
          >
            <ArrowRightLeft class="w-3.5 h-3.5 stroke-[2.5]" />
            <div class="flex flex-col text-left leading-tight">
              <span>按横坐标关联</span>
              <span class="text-[10px] opacity-80 font-mono font-normal">(X优先 / 同X按Y)</span>
            </div>
          </button>

          <!-- 按钮 2: 按照纵坐标关联 (Y轴优先，若Y相同按X排序) -->
          <button
            class="px-4 py-1.5 rounded text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer border"
            :class="[
              selectedPoints.length === targetCount
                ? 'bg-sky-700 hover:bg-sky-800 border-sky-950 text-white active:scale-95'
                : 'bg-[#dfd6bf] text-neutral-400 border-[#cfc5b0] cursor-not-allowed opacity-50 shadow-none'
            ]"
            :disabled="selectedPoints.length !== targetCount"
            title="按照纵坐标(Y)升序依次关联；若纵坐标一致，则内部按照横坐标(X)升序关联"
            @click="handleSubmit('y')"
          >
            <ArrowUpDown class="w-3.5 h-3.5 stroke-[2.5]" />
            <div class="flex flex-col text-left leading-tight">
              <span>按纵坐标关联</span>
              <span class="text-[10px] opacity-80 font-mono font-normal">(Y优先 / 同Y按X)</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
