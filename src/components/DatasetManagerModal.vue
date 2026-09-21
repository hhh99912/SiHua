<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  X,
  RefreshCw,
  Cpu,
  Zap,
  Activity,
  Workflow,
  Radio,
  Sliders,
  AlertCircle,
  Check,
  Server,
  Building2,
  Layers,
  ChevronRight,
  Info,
  FileText,
  Code
} from 'lucide-vue-next';
import {
  DatasetItem,
  ScadaFacilityNode,
  ScadaBayNode,
  ScadaDeviceNode,
  ScadaYcItem,
  ScadaYxItem
} from '../types';
import {
  scadaFacilities,
  isConfigLoading,
  scadaApiConnStatus,
  getScadaApiBaseUrl,
  setScadaApiBaseUrl,
  fetchScadaConfig,
  convertFacilitiesToDatasets
} from '../utils/scadaClient';

interface Props {
  visible: boolean;
  datasets?: DatasetItem[];
}

const props = withDefaults(defineProps<Props>(), {
  datasets: () => []
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:datasets', datasets: DatasetItem[]): void;
}>();

// API Configuration
const apiUrlInput = ref<string>(getScadaApiBaseUrl());

// Hierarchy Navigation Selection
const selectedFacId = ref<number | string>(scadaFacilities.value[0]?.fac_id || 4000003);
const selectedBayId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.bay_id || 430000001);
const selectedDevId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.devices?.[0]?.dev_id || 7000001);

const activeTab = ref<'yc' | 'yx' | 'dd' | 'yk' | 'yt' | 'json'>('yc');
const toastMessage = ref<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

// Search and filtering
const searchQuery = ref<string>('');

// Current Selected Facility
const currentFacility = computed<ScadaFacilityNode | undefined>(() => {
  return scadaFacilities.value.find(f => f.fac_id === selectedFacId.value) || scadaFacilities.value[0];
});

// Current Selected Bay
const currentBay = computed<ScadaBayNode | undefined>(() => {
  const fac = currentFacility.value;
  if (!fac || !fac.bays?.length) return undefined;
  return fac.bays.find(b => b.bay_id === selectedBayId.value) || fac.bays[0];
});

// Current Selected Device
const currentDevice = computed<ScadaDeviceNode | undefined>(() => {
  const bay = currentBay.value;
  if (!bay || !bay.devices?.length) return undefined;
  return bay.devices.find(d => d.dev_id === selectedDevId.value) || bay.devices[0];
});

// Filtered YC List (Lightweight Structure: only ID & Name)
const filteredYcList = computed<ScadaYcItem[]>(() => {
  const dev = currentDevice.value;
  if (!dev || !dev.yc_list) return [];
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return dev.yc_list;
  return dev.yc_list.filter(p =>
    String(p.id).includes(q) ||
    (p.name && p.name.toLowerCase().includes(q))
  );
});

// Filtered YX List (Lightweight Structure: only ID & Name)
const filteredYxList = computed<ScadaYxItem[]>(() => {
  const dev = currentDevice.value;
  if (!dev || !dev.yx_list) return [];
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return dev.yx_list;
  return dev.yx_list.filter(p =>
    String(p.id).includes(q) ||
    (p.name && p.name.toLowerCase().includes(q))
  );
});

// JSON View computed (Only serialize on demand)
const scadaConfigJsonString = computed(() => {
  if (activeTab.value !== 'json') return '';
  return JSON.stringify(
    {
      code: 200,
      msg: 'success',
      data: scadaFacilities.value
    },
    null,
    2
  );
});

const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
  toastMessage.value = { text, type };
  setTimeout(() => {
    toastMessage.value = null;
  }, 3500);
};

// Handle Save API Base URL
const handleSaveApiUrl = () => {
  setScadaApiBaseUrl(apiUrlInput.value);
  showToast(`已更新 SCADA API 接口地址: ${apiUrlInput.value}`, 'success');
};

// Handle GET /api/scada/config
const handleFetchConfig = async () => {
  handleSaveApiUrl();
  const res = await fetchScadaConfig(apiUrlInput.value);
  if (res.success && res.data) {
    showToast(`成功获取 SCADA 测点配置并同步写入本地 scada_config.json (${res.data.length} 个厂站)`, 'success');
    if (res.data[0]) {
      selectedFacId.value = res.data[0].fac_id;
      if (res.data[0].bays?.[0]) {
        selectedBayId.value = res.data[0].bays[0].bay_id;
        if (res.data[0].bays[0].devices?.[0]) {
          selectedDevId.value = res.data[0].bays[0].devices[0].dev_id;
        }
      }
    }
    syncToParentDatasets();
  } else {
    showToast(`获取配置失败: ${res.error || '无法连接'}`, 'error');
  }
};

// Sync facilities to datasets for canvas components
const syncToParentDatasets = () => {
  const ds = convertFacilitiesToDatasets(scadaFacilities.value);
  emit('update:datasets', ds);
};

// Watch visibility
watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    apiUrlInput.value = getScadaApiBaseUrl();
  }
});
</script>

<template>
  <div
    v-if="visible"
    id="dataset-manager-modal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-hidden select-none font-sans"
  >
    <div
      class="bg-slate-900 border-2 border-cyan-500/40 rounded-2xl w-full max-w-7xl h-[92vh] flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden text-white"
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-700 bg-slate-950 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-cyan-500/20 border border-cyan-400/50 rounded-xl text-cyan-300">
            <Building2 class="w-6 h-6" />
          </div>
          <div>
            <div class="flex items-center gap-2.5">
              <h2 class="text-xl font-bold tracking-tight text-white">SCADA 数据集与测点配置</h2>
              <span class="px-2.5 py-0.5 text-xs font-bold rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/50">
                厂站 → 间隔 → 装置 → YC/YX 测点信息
              </span>
              <span class="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                本地轻量化持久存储
              </span>
            </div>
            <p class="text-xs text-cyan-100 font-medium mt-1">
              测点配置自动持久化于本地 <code class="text-amber-300 font-mono font-bold">data/scada_config.json</code>，程序启动即刻秒开
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            id="close-dataset-modal-btn"
            class="p-2 text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-600"
            @click="emit('close')"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Top SCADA API Config Bar -->
      <div class="px-6 py-3 bg-slate-950/90 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div class="flex items-center gap-3 flex-1 min-w-[320px]">
          <div class="flex items-center gap-1.5 text-cyan-300 font-bold shrink-0">
            <Server class="w-4 h-4 text-cyan-400" />
            <span>SCADA 接口地址:</span>
          </div>
          <input
            v-model="apiUrlInput"
            id="scada-api-url-input"
            type="text"
            placeholder="http://127.0.0.1:36581"
            class="flex-1 max-w-md px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 font-mono font-bold"
            @blur="handleSaveApiUrl"
            @keyup.enter="handleFetchConfig"
          />
          <button
            id="btn-fetch-scada-config"
            :disabled="isConfigLoading"
            class="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-md cursor-pointer border border-cyan-400/50 active:scale-95"
            @click="handleFetchConfig"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isConfigLoading }" />
            <span>获取配置 (GET /config)</span>
          </button>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <!-- Connection status indicator -->
          <div class="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg shadow-inner">
            <span
              class="w-2.5 h-2.5 rounded-full"
              :class="scadaApiConnStatus === 'connected' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : (scadaApiConnStatus === 'disconnected' ? 'bg-rose-400 shadow-[0_0_8px_#f43f5e]' : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]')"
            />
            <span class="text-white font-mono font-bold text-xs">
              {{ scadaApiConnStatus === 'connected' ? '已连接生产服务' : (scadaApiConnStatus === 'disconnected' ? '未连接 (等待上线)' : '服务就绪 (本地已就绪)') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Main Body (3-Column Hierarchy + Point Tables) -->
      <div class="flex-1 flex overflow-hidden">
        <!-- 1. 厂站 (Facility) Column -->
        <div class="w-56 border-r border-slate-700 bg-slate-950/60 flex flex-col">
          <div class="p-3 border-b border-slate-700 flex items-center justify-between text-xs font-bold text-cyan-300">
            <div class="flex items-center gap-1.5">
              <Building2 class="w-3.5 h-3.5 text-cyan-400" />
              <span>1. 厂站列表 (Facility)</span>
            </div>
            <span class="px-2 py-0.5 text-[11px] bg-slate-800 rounded font-mono font-bold text-white border border-slate-600">
              {{ scadaFacilities.length }}
            </span>
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-1.5 will-change-scroll">
            <div
              v-for="fac in scadaFacilities"
              :key="fac.fac_id"
              :id="`facility-item-${fac.fac_id}`"
              class="p-2.5 rounded-xl cursor-pointer border transition-all text-left"
              :class="selectedFacId === fac.fac_id ? 'bg-cyan-900/40 border-cyan-400 text-white shadow-md font-bold' : 'bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800 hover:border-slate-500'"
              @click="selectedFacId = fac.fac_id; if (fac.bays?.[0]) selectedBayId = fac.bays[0].bay_id; if (fac.bays?.[0]?.devices?.[0]) selectedDevId = fac.bays[0].devices[0].dev_id;"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs truncate font-bold text-white">{{ fac.fac_name }}</span>
                <ChevronRight class="w-4 h-4 text-cyan-400" />
              </div>
              <div class="flex items-center justify-between text-[11px] text-cyan-200 font-mono font-bold">
                <span>ID: {{ fac.fac_id }}</span>
                <span class="text-cyan-300">{{ fac.bays?.length || 0 }} 间隔</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. 间隔 (Bay) Column -->
        <div class="w-60 border-r border-slate-700 bg-slate-950/40 flex flex-col">
          <div class="p-3 border-b border-slate-700 flex items-center justify-between text-xs font-bold text-indigo-300">
            <div class="flex items-center gap-1.5">
              <Layers class="w-3.5 h-3.5 text-indigo-400" />
              <span>2. 间隔列表 (Bay)</span>
            </div>
            <span class="px-2 py-0.5 text-[11px] bg-slate-800 rounded font-mono font-bold text-white border border-slate-600">
              {{ currentFacility?.bays?.length || 0 }}
            </span>
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-1.5 will-change-scroll">
            <div
              v-for="bay in (currentFacility?.bays || [])"
              :key="bay.bay_id"
              :id="`bay-item-${bay.bay_id}`"
              class="p-2.5 rounded-xl cursor-pointer border transition-all text-left"
              :class="selectedBayId === bay.bay_id ? 'bg-indigo-900/40 border-indigo-400 text-white shadow-md font-bold' : 'bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800 hover:border-slate-500'"
              @click="selectedBayId = bay.bay_id; if (bay.devices?.[0]) selectedDevId = bay.devices[0].dev_id;"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs truncate font-bold text-white">{{ bay.bay_name }}</span>
                <ChevronRight class="w-4 h-4 text-indigo-400" />
              </div>
              <div class="flex items-center justify-between text-[11px] text-indigo-200 font-mono font-bold">
                <span>ID: {{ bay.bay_id }}</span>
                <span class="text-indigo-300">{{ bay.devices?.length || 0 }} 装置</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. 装置 (Device) Column -->
        <div class="w-64 border-r border-slate-700 bg-slate-950/20 flex flex-col">
          <div class="p-3 border-b border-slate-700 flex items-center justify-between text-xs font-bold text-emerald-300">
            <div class="flex items-center gap-1.5">
              <Cpu class="w-3.5 h-3.5 text-emerald-400" />
              <span>3. 装置列表 (Device)</span>
            </div>
            <span class="px-2 py-0.5 text-[11px] bg-slate-800 rounded font-mono font-bold text-white border border-slate-600">
              {{ currentBay?.devices?.length || 0 }}
            </span>
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-1.5 will-change-scroll">
            <div
              v-for="dev in (currentBay?.devices || [])"
              :key="dev.dev_id"
              :id="`device-item-${dev.dev_id}`"
              class="p-2.5 rounded-xl cursor-pointer border transition-all text-left"
              :class="selectedDevId === dev.dev_id ? 'bg-emerald-900/40 border-emerald-400 text-white shadow-md font-bold' : 'bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800 hover:border-slate-500'"
              @click="selectedDevId = dev.dev_id"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs truncate font-bold text-white">{{ dev.dev_name }} ({{ dev.dev_id }})</span>
                <span class="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-200 text-[10px] rounded border border-emerald-400/50 font-mono font-bold">
                  cbty: {{ dev.cbty ?? 0 }}
                </span>
              </div>
              <div class="flex items-center justify-between text-[11px] text-emerald-200 font-mono font-bold">
                <span>YC: {{ dev.yc_list?.length || 0 }}</span>
                <span>YX: {{ dev.yx_list?.length || 0 }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Point Data Workspace (YC / YX / DD / YK / YT / JSON) -->
        <div class="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          <!-- Point Tab Bar & Search -->
          <div class="px-5 py-3 border-b border-slate-700 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-2">
              <!-- YC Tab -->
              <button
                id="tab-btn-yc"
                class="px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border"
                :class="activeTab === 'yc' ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-750 hover:text-white'"
                @click="activeTab = 'yc'"
              >
                <Zap class="w-3.5 h-3.5 text-cyan-300" />
                <span>遥测 (YC)</span>
                <span class="px-2 py-0.2 text-[10px] rounded-full bg-black/40 font-mono font-bold text-cyan-200">
                  {{ currentDevice?.yc_list?.length || 0 }}
                </span>
              </button>

              <!-- YX Tab -->
              <button
                id="tab-btn-yx"
                class="px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border"
                :class="activeTab === 'yx' ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-750 hover:text-white'"
                @click="activeTab = 'yx'"
              >
                <Radio class="w-3.5 h-3.5 text-indigo-300" />
                <span>遥信 (YX)</span>
                <span class="px-2 py-0.2 text-[10px] rounded-full bg-black/40 font-mono font-bold text-indigo-200">
                  {{ currentDevice?.yx_list?.length || 0 }}
                </span>
              </button>

              <!-- DD Tab -->
              <button
                id="tab-btn-dd"
                class="px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                :class="activeTab === 'dd' ? 'bg-slate-700 border-cyan-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750'"
                @click="activeTab = 'dd'"
              >
                <Activity class="w-3.5 h-3.5 text-cyan-400" />
                <span>电度 (DD)</span>
                <span class="text-[10px] text-slate-400 font-mono">(空)</span>
              </button>

              <!-- YK Tab -->
              <button
                id="tab-btn-yk"
                class="px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                :class="activeTab === 'yk' ? 'bg-slate-700 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750'"
                @click="activeTab = 'yk'"
              >
                <Sliders class="w-3.5 h-3.5 text-amber-400" />
                <span>遥控 (YK)</span>
                <span class="text-[10px] text-slate-400 font-mono">(空)</span>
              </button>

              <!-- YT Tab -->
              <button
                id="tab-btn-yt"
                class="px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                :class="activeTab === 'yt' ? 'bg-slate-700 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750'"
                @click="activeTab = 'yt'"
              >
                <Workflow class="w-3.5 h-3.5 text-emerald-400" />
                <span>遥调 (YT)</span>
                <span class="text-[10px] text-slate-400 font-mono">(空)</span>
              </button>

              <!-- JSON Viewer -->
              <button
                id="tab-btn-json"
                class="px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ml-2 border border-slate-700"
                :class="activeTab === 'json' ? 'bg-slate-700 border-cyan-400 text-cyan-300' : 'bg-slate-800 text-slate-200 hover:bg-slate-750'"
                @click="activeTab = 'json'"
              >
                <Code class="w-3.5 h-3.5 text-cyan-300" />
                <span>JSON 树查看</span>
              </button>
            </div>

            <!-- Search Input -->
            <div v-if="activeTab === 'yc' || activeTab === 'yx'" class="relative w-60">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索测点 ID 或名称..."
                class="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 font-medium"
              />
              <FileText class="w-3.5 h-3.5 text-cyan-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <!-- Tab Content 1: 遥测 (YC) Table (Ultra-lightweight with high contrast) -->
          <div v-if="activeTab === 'yc'" class="flex-1 overflow-y-auto p-4 will-change-scroll">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b-2 border-slate-700 text-cyan-300 bg-slate-950/80 font-bold sticky top-0 z-10">
                  <th class="p-3 w-44">测点 ID (ID)</th>
                  <th class="p-3">测点名称 (name)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800 font-mono">
                <tr
                  v-for="yc in filteredYcList"
                  :key="yc.id"
                  :id="`yc-row-${yc.id}`"
                  class="hover:bg-slate-800/80 transition-colors"
                >
                  <td class="p-3 font-bold text-cyan-300 text-sm">{{ yc.id }}</td>
                  <td class="p-3 font-sans font-bold text-white text-sm">{{ yc.name }}</td>
                </tr>
                <tr v-if="filteredYcList.length === 0">
                  <td colspan="2" class="p-8 text-center text-slate-300 font-sans font-medium text-sm">
                    暂无符合条件的遥测测点
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tab Content 2: 遥信 (YX) Table (Ultra-lightweight with high contrast) -->
          <div v-if="activeTab === 'yx'" class="flex-1 overflow-y-auto p-4 will-change-scroll">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b-2 border-slate-700 text-indigo-300 bg-slate-950/80 font-bold sticky top-0 z-10">
                  <th class="p-3 w-44">测点 ID (ID)</th>
                  <th class="p-3">测点名称 (name)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800 font-mono">
                <tr
                  v-for="yx in filteredYxList"
                  :key="yx.id"
                  :id="`yx-row-${yx.id}`"
                  class="hover:bg-slate-800/80 transition-colors"
                >
                  <td class="p-3 font-bold text-indigo-300 text-sm">{{ yx.id }}</td>
                  <td class="p-3 font-sans font-bold text-white text-sm">{{ yx.name }}</td>
                </tr>
                <tr v-if="filteredYxList.length === 0">
                  <td colspan="2" class="p-8 text-center text-slate-300 font-sans font-medium text-sm">
                    暂无符合条件的遥信测点
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tab Content 3: DD / YK / YT Empty State Notice -->
          <div v-if="activeTab === 'dd' || activeTab === 'yk' || activeTab === 'yt'" class="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div class="p-6 bg-slate-950 border-2 border-slate-700 rounded-2xl max-w-md shadow-xl">
              <Info class="w-10 h-10 text-cyan-400 mx-auto mb-3" />
              <h3 class="text-base font-bold text-white mb-2">
                {{ activeTab === 'dd' ? '电度 (DD)' : (activeTab === 'yk' ? '遥控 (YK)' : '遥调 (YT)') }} 暂未启用
              </h3>
              <p class="text-sm text-slate-200 font-medium leading-relaxed">
                按照调度系统业务规范，当前系统专注于
                <span class="text-cyan-300 font-bold">遥测 (YC)</span> 与
                <span class="text-indigo-300 font-bold">遥信 (YX)</span> 的两级测点配置解析。
              </p>
            </div>
          </div>

          <!-- Tab Content 4: JSON Config Viewer -->
          <div v-if="activeTab === 'json'" class="flex-1 p-4 overflow-hidden flex flex-col">
            <div class="mb-2 flex items-center justify-between text-xs text-cyan-300 font-bold">
              <span>SCADA 配置结构体 (符合 GET /api/scada/config 格式):</span>
            </div>
            <textarea
              readonly
              class="flex-1 w-full p-3 bg-slate-950 border-2 border-slate-700 rounded-xl text-xs font-mono text-cyan-300 resize-none focus:outline-none font-bold"
              :value="scadaConfigJsonString"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Toast Notification -->
      <div
        v-if="toastMessage"
        class="fixed bottom-6 right-6 px-5 py-3 rounded-xl text-sm font-bold shadow-2xl flex items-center gap-2.5 z-50 transition-all border border-white/20"
        :class="toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : (toastMessage.type === 'error' ? 'bg-rose-600 text-white' : 'bg-cyan-600 text-white')"
      >
        <Check v-if="toastMessage.type === 'success'" class="w-5 h-5" />
        <AlertCircle v-else class="w-5 h-5" />
        <span>{{ toastMessage.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.will-change-scroll {
  will-change: scroll-position;
  contain: content;
  -webkit-overflow-scrolling: touch;
}
</style>
