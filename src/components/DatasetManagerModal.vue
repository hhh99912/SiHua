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
  Code,
  ShieldCheck
} from 'lucide-vue-next';
import {
  DatasetItem,
  ScadaFacilityNode,
  ScadaBayNode,
  ScadaDeviceNode,
  ScadaYcItem,
  ScadaYxItem,
  ScadaDdItem,
  ScadaYkItem,
  ScadaYtItem
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

// IP Parsing and Reconstruction (固定 http 与固定端口 36581，仅向用户开放修改 IP)
const extractIpFromUrl = (url: string): string => {
  if (!url) return '127.0.0.1';
  const clean = url.trim();
  const match = clean.match(/(?:https?:\/\/)?([^:/]+)(?::\d+)?/i);
  return match && match[1] ? match[1] : clean.replace(/^https?:\/\//i, '').replace(/:\d+.*$/, '') || '127.0.0.1';
};

const buildUrlFromIp = (ip: string): string => {
  const cleanIp = (ip || '').trim().replace(/^https?:\/\//i, '').replace(/:\d+.*$/, '') || '127.0.0.1';
  return `http://${cleanIp}:36581`;
};

// API IP Configuration (只显示和编辑 IP)
const apiIpInput = ref<string>(extractIpFromUrl(getScadaApiBaseUrl()));

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
  return scadaFacilities.value.find(f => f.fac_id === selectedFacId.value || f.id === selectedFacId.value) || scadaFacilities.value[0];
});

// Current Selected Bay
const currentBay = computed<ScadaBayNode | undefined>(() => {
  const fac = currentFacility.value;
  if (!fac || !fac.bays?.length) return undefined;
  return fac.bays.find(b => b.bay_id === selectedBayId.value || b.id === selectedBayId.value) || fac.bays[0];
});

// Current Selected Device
const currentDevice = computed<ScadaDeviceNode | undefined>(() => {
  const bay = currentBay.value;
  if (!bay) return undefined;
  const devs = bay.devices || bay.cb_devices || [];
  return devs.find(d => d.dev_id === selectedDevId.value || d.id === selectedDevId.value) || devs[0];
});

// Filtered YC List
const filteredYcList = computed<ScadaYcItem[]>(() => {
  const dev = currentDevice.value;
  if (!dev) return [];
  const list = dev.yc_list || dev.yc_points || [];
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(p =>
    String(p.id).includes(q) ||
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.alias && p.alias.toLowerCase().includes(q))
  );
});

// Filtered YX List
const filteredYxList = computed<ScadaYxItem[]>(() => {
  const dev = currentDevice.value;
  if (!dev) return [];
  const list = dev.yx_list || dev.yx_points || [];
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(p =>
    String(p.id).includes(q) ||
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.alias && p.alias.toLowerCase().includes(q))
  );
});

// Filtered DD List
const filteredDdList = computed<ScadaDdItem[]>(() => {
  const dev = currentDevice.value;
  if (!dev) return [];
  const list = dev.dd_list || dev.dd_points || [];
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(p =>
    String(p.id).includes(q) ||
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.alias && p.alias.toLowerCase().includes(q))
  );
});

// Filtered YK List
const filteredYkList = computed<ScadaYkItem[]>(() => {
  const dev = currentDevice.value;
  if (!dev) return [];
  const list = dev.yk_list || dev.yk_points || [];
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(p =>
    String(p.id).includes(q) ||
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.alias && p.alias.toLowerCase().includes(q))
  );
});

// Filtered YT List
const filteredYtList = computed<ScadaYtItem[]>(() => {
  const dev = currentDevice.value;
  if (!dev) return [];
  const list = dev.yt_list || dev.yt_points || [];
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(p =>
    String(p.id).includes(q) ||
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.alias && p.alias.toLowerCase().includes(q))
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

// Handle Save API Base IP
const handleSaveApiIp = () => {
  const fullUrl = buildUrlFromIp(apiIpInput.value);
  setScadaApiBaseUrl(fullUrl);
  showToast(`已更新 SCADA 服务 IP: ${apiIpInput.value}`, 'success');
};

// Handle GET /api/scada/config
const handleFetchConfig = async () => {
  handleSaveApiIp();
  const fullUrl = buildUrlFromIp(apiIpInput.value);
  const res = await fetchScadaConfig(fullUrl);
  if (res.success && res.data) {
    showToast(`成功获取 SCADA 测点配置 (${res.data.length} 个厂站，涵盖遥测/遥信/电度/遥控/遥调)`, 'success');
    if (res.data[0]) {
      selectedFacId.value = res.data[0].fac_id;
      if (res.data[0].bays?.[0]) {
        selectedBayId.value = res.data[0].bays[0].bay_id;
        const devs = res.data[0].bays[0].devices || res.data[0].bays[0].cb_devices || [];
        if (devs[0]) {
          selectedDevId.value = devs[0].dev_id;
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
    apiIpInput.value = extractIpFromUrl(getScadaApiBaseUrl());
  }
});
</script>

<template>
  <div
    v-if="visible"
    id="dataset-manager-modal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 font-sans select-none"
    style="transform: translateZ(0); will-change: transform;"
  >
    <div
      class="bg-[#0e172a] border-2 border-sky-400 rounded-2xl w-full max-w-7xl h-[88vh] max-h-[880px] flex flex-col shadow-2xl overflow-hidden text-white"
      style="contain: paint layout;"
    >
      <!-- Header: 简洁统一大方，无冗余卡片标签 -->
      <div class="px-6 py-4 border-b-2 border-slate-700 bg-[#080d1a] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full bg-sky-400"></div>
          <h2 class="text-lg font-bold tracking-wide text-white">SCADA 数据集与测点配置中心</h2>
        </div>

        <div class="flex items-center gap-2">
          <button
            id="close-dataset-modal-btn"
            class="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            @click="emit('close')"
          >
            <X class="w-6 h-6" />
          </button>
        </div>
      </div>

      <!-- Top SCADA API Config Bar: 仅显示修改 IP -->
      <div class="px-6 py-3 bg-[#0c1427] border-b-2 border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div class="flex items-center gap-3 flex-1 min-w-[300px]">
          <div class="flex items-center gap-2 text-sky-300 font-bold shrink-0 text-sm">
            <Server class="w-4 h-4 text-sky-400" />
            <span>服务 IP 地址:</span>
          </div>
          <input
            v-model="apiIpInput"
            id="scada-api-ip-input"
            type="text"
            placeholder="127.0.0.1"
            class="w-56 px-3 py-1.5 bg-[#111c34] border border-sky-400 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-sky-300 font-mono font-bold shadow-inner"
            @blur="handleSaveApiIp"
            @keyup.enter="handleFetchConfig"
          />
          <button
            id="btn-fetch-scada-config"
            :disabled="isConfigLoading"
            class="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-md cursor-pointer border border-sky-400 active:scale-95 text-xs"
            @click="handleFetchConfig"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isConfigLoading }" />
            <span>获取配置 (GET /config)</span>
          </button>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <!-- Connection status indicator -->
          <div class="flex items-center gap-2 px-3 py-1.5 bg-[#111c34] border border-slate-700 rounded-lg">
            <span
              class="w-2.5 h-2.5 rounded-full"
              :class="scadaApiConnStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : (scadaApiConnStatus === 'disconnected' ? 'bg-rose-400 shadow-[0_0_8px_#f43f5e]' : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]')"
            />
            <span class="text-slate-100 font-mono font-bold text-xs">
              {{ scadaApiConnStatus === 'connected' ? '已连接生产服务' : (scadaApiConnStatus === 'disconnected' ? '未连接 (等待上线)' : '服务就绪 (本地已就绪)') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Main Body (3-Column Hierarchy + Point Tables) -->
      <div class="flex-1 flex overflow-hidden bg-[#0a1120]">
        <!-- 1. 厂站 (Facility) Column -->
        <div class="w-56 border-r-2 border-slate-800 bg-[#0c1427] flex flex-col shrink-0">
          <div class="p-3.5 border-b-2 border-slate-800 bg-[#080d1a] flex items-center justify-between">
            <div class="flex items-center gap-1.5 text-sm font-bold text-sky-300">
              <Building2 class="w-4 h-4 text-sky-400" />
              <span>1. 厂站选择</span>
            </div>
            <span class="px-2 py-0.5 text-xs bg-slate-800 rounded font-mono font-bold text-slate-100 border border-slate-700">
              {{ scadaFacilities.length }}
            </span>
          </div>

          <div
            class="flex-1 overflow-y-auto p-2 space-y-2"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <div
              v-for="fac in scadaFacilities"
              :key="fac.fac_id"
              :id="`facility-item-${fac.fac_id}`"
              class="p-3 rounded-xl cursor-pointer border-2 transition-colors text-left"
              :class="selectedFacId === fac.fac_id ? 'bg-sky-600/30 border-sky-400 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'"
              @click="selectedFacId = fac.fac_id; if (fac.bays?.[0]) selectedBayId = fac.bays[0].bay_id; if (fac.bays?.[0]?.devices?.[0]) selectedDevId = fac.bays[0].devices[0].dev_id;"
            >
              <div class="truncate text-white font-bold text-sm mb-1">{{ fac.fac_name }}</div>
              <div class="flex items-center justify-between text-xs text-sky-300 font-mono font-bold">
                <span>ID: {{ fac.fac_id }}</span>
                <span>{{ fac.bays?.length || 0 }} 间隔</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. 间隔 (Bay) Column -->
        <div class="w-60 border-r-2 border-slate-800 bg-[#0c1427] flex flex-col shrink-0">
          <div class="p-3.5 border-b-2 border-slate-800 bg-[#080d1a] flex items-center justify-between">
            <div class="flex items-center gap-1.5 text-sm font-bold text-slate-200">
              <Layers class="w-4 h-4 text-sky-400" />
              <span>2. 间隔选择</span>
            </div>
            <span class="px-2 py-0.5 text-xs bg-slate-800 rounded font-mono font-bold text-slate-100 border border-slate-700">
              {{ currentFacility?.bays?.length || 0 }}
            </span>
          </div>

          <div
            class="flex-1 overflow-y-auto p-2 space-y-2"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <div
              v-for="bay in (currentFacility?.bays || [])"
              :key="bay.bay_id"
              :id="`bay-item-${bay.bay_id}`"
              class="p-3 rounded-xl cursor-pointer border-2 transition-colors text-left"
              :class="selectedBayId === bay.bay_id ? 'bg-sky-600/30 border-sky-400 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'"
              @click="selectedBayId = bay.bay_id; if (bay.devices?.[0]) selectedDevId = bay.devices[0].dev_id;"
            >
              <div class="truncate text-white font-bold text-sm mb-1">{{ bay.bay_name }}</div>
              <div class="flex items-center justify-between text-xs text-slate-200 font-mono font-bold">
                <span>ID: {{ bay.bay_id }}</span>
                <span>{{ bay.devices?.length || 0 }} 装置</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. 装置 (Device) Column -->
        <div class="w-64 border-r-2 border-slate-800 bg-[#0c1427] flex flex-col shrink-0">
          <div class="p-3.5 border-b-2 border-slate-800 bg-[#080d1a] flex items-center justify-between">
            <div class="flex items-center gap-1.5 text-sm font-bold text-slate-200">
              <Cpu class="w-4 h-4 text-sky-400" />
              <span>3. 装置选择</span>
            </div>
            <span class="px-2 py-0.5 text-xs bg-slate-800 rounded font-mono font-bold text-slate-100 border border-slate-700">
              {{ currentBay?.devices?.length || currentBay?.cb_devices?.length || 0 }}
            </span>
          </div>

          <div
            class="flex-1 overflow-y-auto p-2 space-y-2"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <div
              v-for="dev in (currentBay?.devices || currentBay?.cb_devices || [])"
              :key="dev.dev_id || dev.id"
              :id="`device-item-${dev.dev_id || dev.id}`"
              class="p-3 rounded-xl cursor-pointer border-2 transition-colors text-left"
              :class="selectedDevId === (dev.dev_id || dev.id) ? 'bg-sky-600/30 border-sky-400 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'"
              @click="selectedDevId = (dev.dev_id || dev.id)"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm truncate font-bold text-white">{{ dev.dev_name || dev.name }}</span>
                <span class="px-1.5 py-0.5 bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 font-mono font-bold">
                  {{ dev.cbty_name || '开关' }}
                </span>
              </div>
              <div class="grid grid-cols-3 gap-1 text-xs text-slate-200 font-mono font-bold mt-1">
                <span>YC: {{ (dev.yc_list || dev.yc_points || []).length }}</span>
                <span>YX: {{ (dev.yx_list || dev.yx_points || []).length }}</span>
                <span>DD: {{ (dev.dd_list || dev.dd_points || []).length }}</span>
                <span>YK: {{ (dev.yk_list || dev.yk_points || []).length }}</span>
                <span>YT: {{ (dev.yt_list || dev.yt_points || []).length }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Point Data Workspace (YC / YX / DD / YK / YT / JSON) -->
        <div class="flex-1 flex flex-col bg-[#0f172a] overflow-hidden min-w-0">
          <!-- Point Tab Bar & Search: 统一边框与样式 -->
          <div class="p-3 border-b-2 border-slate-800 bg-[#080d1a] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-2 flex-wrap">
              <!-- YC Tab -->
              <button
                id="tab-btn-yc"
                class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border-2"
                :class="activeTab === 'yc' ? 'bg-sky-600 border-sky-400 text-white font-black shadow-md' : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'"
                @click="activeTab = 'yc'"
              >
                <Zap class="w-3.5 h-3.5 text-sky-200" />
                <span>遥测 (YC)</span>
                <span class="px-1.5 py-0.2 text-xs rounded font-mono font-bold bg-black/40 text-sky-200">
                  {{ (currentDevice?.yc_list || currentDevice?.yc_points || []).length }}
                </span>
              </button>

              <!-- YX Tab -->
              <button
                id="tab-btn-yx"
                class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border-2"
                :class="activeTab === 'yx' ? 'bg-sky-600 border-sky-400 text-white font-black shadow-md' : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'"
                @click="activeTab = 'yx'"
              >
                <Radio class="w-3.5 h-3.5 text-sky-200" />
                <span>遥信 (YX)</span>
                <span class="px-1.5 py-0.2 text-xs rounded font-mono font-bold bg-black/40 text-sky-200">
                  {{ (currentDevice?.yx_list || currentDevice?.yx_points || []).length }}
                </span>
              </button>

              <!-- DD Tab -->
              <button
                id="tab-btn-dd"
                class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border-2"
                :class="activeTab === 'dd' ? 'bg-sky-600 border-sky-400 text-white font-black shadow-md' : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'"
                @click="activeTab = 'dd'"
              >
                <Activity class="w-3.5 h-3.5 text-sky-200" />
                <span>电度 (DD)</span>
                <span class="px-1.5 py-0.2 text-xs rounded font-mono font-bold bg-black/40 text-sky-200">
                  {{ (currentDevice?.dd_list || currentDevice?.dd_points || []).length }}
                </span>
              </button>

              <!-- YK Tab -->
              <button
                id="tab-btn-yk"
                class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border-2"
                :class="activeTab === 'yk' ? 'bg-sky-600 border-sky-400 text-white font-black shadow-md' : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'"
                @click="activeTab = 'yk'"
              >
                <Zap class="w-3.5 h-3.5 text-sky-200" />
                <span>遥控 (YK)</span>
                <span class="px-1.5 py-0.2 text-xs rounded font-mono font-bold bg-black/40 text-sky-200">
                  {{ (currentDevice?.yk_list || currentDevice?.yk_points || []).length }}
                </span>
              </button>

              <!-- YT Tab -->
              <button
                id="tab-btn-yt"
                class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border-2"
                :class="activeTab === 'yt' ? 'bg-sky-600 border-sky-400 text-white font-black shadow-md' : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'"
                @click="activeTab = 'yt'"
              >
                <Sliders class="w-3.5 h-3.5 text-sky-200" />
                <span>遥调 (YT)</span>
                <span class="px-1.5 py-0.2 text-xs rounded font-mono font-bold bg-black/40 text-sky-200">
                  {{ (currentDevice?.yt_list || currentDevice?.yt_points || []).length }}
                </span>
              </button>

              <!-- JSON Viewer -->
              <button
                id="tab-btn-json"
                class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ml-2 border-2 border-slate-700"
                :class="activeTab === 'json' ? 'bg-slate-700 border-sky-400 text-sky-300' : 'bg-slate-800 text-slate-100 hover:bg-slate-700'"
                @click="activeTab = 'json'"
              >
                <Code class="w-3.5 h-3.5 text-sky-300" />
                <span>JSON 树</span>
              </button>
            </div>

            <!-- Search Input -->
            <div v-if="activeTab !== 'json'" class="relative w-64">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索测点 ID / 名称 / 别名..."
                class="w-full pl-8 pr-3 py-1.5 bg-[#111c34] border border-slate-600 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-400 font-medium"
              />
              <FileText class="w-3.5 h-3.5 text-sky-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <!-- Tab Content 1: 遥测 (YC) Table (丝滑滚轮 + 亮色大字体) -->
          <div
            v-if="activeTab === 'yc'"
            class="flex-1 overflow-y-auto p-3"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <table class="w-full text-left text-sm border-collapse" style="table-layout: fixed;">
              <thead>
                <tr class="border-b-2 border-slate-700 text-sky-300 bg-[#080d1a] font-bold sticky top-0 z-10">
                  <th class="p-3 w-44">测点 ID</th>
                  <th class="p-3">测点名称</th>
                  <th class="p-3 w-56">点位别名 / 类型</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800 font-mono">
                <tr
                  v-for="yc in filteredYcList"
                  :key="yc.id"
                  :id="`yc-row-${yc.id}`"
                  class="hover:bg-slate-800 transition-colors"
                >
                  <td class="p-3 font-bold text-sky-300 text-sm">{{ yc.id }}</td>
                  <td class="p-3 font-sans font-bold text-white text-sm truncate">{{ yc.name }}</td>
                  <td class="p-3 text-slate-200 text-xs truncate">{{ yc.alias || '-' }}</td>
                </tr>
                <tr v-if="filteredYcList.length === 0">
                  <td colspan="3" class="p-8 text-center text-slate-200 font-sans font-medium text-sm">
                    暂无符合条件的遥测测点
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tab Content 2: 遥信 (YX) Table -->
          <div
            v-if="activeTab === 'yx'"
            class="flex-1 overflow-y-auto p-3"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <table class="w-full text-left text-sm border-collapse" style="table-layout: fixed;">
              <thead>
                <tr class="border-b-2 border-slate-700 text-sky-300 bg-[#080d1a] font-bold sticky top-0 z-10">
                  <th class="p-3 w-44">测点 ID</th>
                  <th class="p-3">测点名称</th>
                  <th class="p-3 w-56">点位别名 / 类型</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800 font-mono">
                <tr
                  v-for="yx in filteredYxList"
                  :key="yx.id"
                  :id="`yx-row-${yx.id}`"
                  class="hover:bg-slate-800 transition-colors"
                >
                  <td class="p-3 font-bold text-sky-300 text-sm">{{ yx.id }}</td>
                  <td class="p-3 font-sans font-bold text-white text-sm truncate">{{ yx.name }}</td>
                  <td class="p-3 text-slate-200 text-xs truncate">{{ yx.alias || '-' }}</td>
                </tr>
                <tr v-if="filteredYxList.length === 0">
                  <td colspan="3" class="p-8 text-center text-slate-200 font-sans font-medium text-sm">
                    暂无符合条件的遥信测点
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tab Content 3: 电度 (DD) Table -->
          <div
            v-if="activeTab === 'dd'"
            class="flex-1 overflow-y-auto p-3"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <table class="w-full text-left text-sm border-collapse" style="table-layout: fixed;">
              <thead>
                <tr class="border-b-2 border-slate-700 text-sky-300 bg-[#080d1a] font-bold sticky top-0 z-10">
                  <th class="p-3 w-44">电度 ID</th>
                  <th class="p-3">测点名称</th>
                  <th class="p-3 w-56">点位别名 / 单位</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800 font-mono">
                <tr
                  v-for="dd in filteredDdList"
                  :key="dd.id"
                  :id="`dd-row-${dd.id}`"
                  class="hover:bg-slate-800 transition-colors"
                >
                  <td class="p-3 font-bold text-sky-300 text-sm">{{ dd.id }}</td>
                  <td class="p-3 font-sans font-bold text-white text-sm truncate">{{ dd.name }}</td>
                  <td class="p-3 text-slate-200 text-xs truncate">{{ dd.alias || dd.unit || 'kWh' }}</td>
                </tr>
                <tr v-if="filteredDdList.length === 0">
                  <td colspan="3" class="p-8 text-center text-slate-200 font-sans font-medium text-sm">
                    暂无符合条件的电度测点
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tab Content 4: 遥控 (YK) Table -->
          <div
            v-if="activeTab === 'yk'"
            class="flex-1 overflow-y-auto p-3"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <table class="w-full text-left text-sm border-collapse" style="table-layout: fixed;">
              <thead>
                <tr class="border-b-2 border-slate-700 text-sky-300 bg-[#080d1a] font-bold sticky top-0 z-10">
                  <th class="p-3 w-44">遥控 ID</th>
                  <th class="p-3">控制名称</th>
                  <th class="p-3 w-44">别名 / 编号</th>
                  <th class="p-3 w-48">关联返校遥信点 (YX)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800 font-mono">
                <tr
                  v-for="yk in filteredYkList"
                  :key="yk.id"
                  :id="`yk-row-${yk.id}`"
                  class="hover:bg-slate-800 transition-colors"
                >
                  <td class="p-3 font-bold text-sky-300 text-sm">{{ yk.id }}</td>
                  <td class="p-3 font-sans font-bold text-white text-sm truncate">{{ yk.name }}</td>
                  <td class="p-3 text-slate-200 text-xs truncate">{{ yk.alias || '-' }}</td>
                  <td class="p-3 text-sky-200 text-xs font-bold">
                    <span v-if="yk.targetVerificationPointId" class="px-2 py-0.5 rounded bg-sky-950 border border-sky-400">
                      YX_{{ yk.targetVerificationPointId }}
                    </span>
                    <span v-else class="text-slate-400">未指定默认</span>
                  </td>
                </tr>
                <tr v-if="filteredYkList.length === 0">
                  <td colspan="4" class="p-8 text-center text-slate-200 font-sans font-medium text-sm">
                    暂无符合条件的遥控点位
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tab Content 5: 遥调 (YT) Table -->
          <div
            v-if="activeTab === 'yt'"
            class="flex-1 overflow-y-auto p-3"
            style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
          >
            <table class="w-full text-left text-sm border-collapse" style="table-layout: fixed;">
              <thead>
                <tr class="border-b-2 border-slate-700 text-sky-300 bg-[#080d1a] font-bold sticky top-0 z-10">
                  <th class="p-3 w-44">遥调 ID</th>
                  <th class="p-3">遥调名称</th>
                  <th class="p-3 w-44">别名 / 编号</th>
                  <th class="p-3 w-48">关联返校遥测点 (YC)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800 font-mono">
                <tr
                  v-for="yt in filteredYtList"
                  :key="yt.id"
                  :id="`yt-row-${yt.id}`"
                  class="hover:bg-slate-800 transition-colors"
                >
                  <td class="p-3 font-bold text-sky-300 text-sm">{{ yt.id }}</td>
                  <td class="p-3 font-sans font-bold text-white text-sm truncate">{{ yt.name }}</td>
                  <td class="p-3 text-slate-200 text-xs truncate">{{ yt.alias || '-' }}</td>
                  <td class="p-3 text-sky-200 text-xs font-bold">
                    <span v-if="yt.targetVerificationPointId" class="px-2 py-0.5 rounded bg-sky-950 border border-sky-400">
                      YC_{{ yt.targetVerificationPointId }}
                    </span>
                    <span v-else class="text-slate-400">未指定默认</span>
                  </td>
                </tr>
                <tr v-if="filteredYtList.length === 0">
                  <td colspan="4" class="p-8 text-center text-slate-200 font-sans font-medium text-sm">
                    暂无符合条件的遥调点位
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tab Content 6: JSON Config Viewer -->
          <div v-if="activeTab === 'json'" class="flex-1 p-4 overflow-hidden flex flex-col">
            <div class="mb-2 flex items-center justify-between text-xs text-sky-300 font-bold">
              <span>SCADA 配置结构体 (符合 GET /api/scada/config 格式):</span>
            </div>
            <textarea
              readonly
              class="flex-1 w-full p-3 bg-slate-950 border-2 border-slate-700 rounded-xl text-xs font-mono text-sky-300 resize-none focus:outline-none font-bold"
              :value="scadaConfigJsonString"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Toast Notification -->
      <div
        v-if="toastMessage"
        class="fixed bottom-6 right-6 px-5 py-3 rounded-xl text-sm font-bold shadow-2xl flex items-center gap-2.5 z-50 transition-all border border-white/20"
        :class="toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : (toastMessage.type === 'error' ? 'bg-rose-600 text-white' : 'bg-sky-600 text-white')"
      >
        <Check v-if="toastMessage.type === 'success'" class="w-5 h-5" />
        <AlertCircle v-else class="w-5 h-5" />
        <span>{{ toastMessage.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 硬件加速极速滚动条与固定列宽排版 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #080d1a;
}
::-webkit-scrollbar-thumb {
  background: #1e293b;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #334155;
}
</style>
