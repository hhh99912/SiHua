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
  ShieldCheck,
  Maximize2,
  Minimize2
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

// IP Parsing and Reconstruction
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

// API IP Configuration
const apiIpInput = ref<string>(extractIpFromUrl(getScadaApiBaseUrl()));

// Hierarchy Navigation Selection
const selectedFacId = ref<number | string>(scadaFacilities.value[0]?.fac_id || 4000003);
const selectedBayId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.bay_id || 430000001);
const selectedDevId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.devices?.[0]?.dev_id || 7000001);

const activeTab = ref<'yc' | 'yx' | 'dd' | 'yk' | 'yt' | 'json'>('yc');
const toastMessage = ref<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

// Search and filtering
const searchQuery = ref<string>('');

// 弹框拖拽与尺寸管理 (与数据关联弹框风格统一)
const modalRef = ref<HTMLElement | null>(null);
const isMaximized = ref(false);
const isDragging = ref(false);
const modalPos = ref({ x: 0, y: 0 });
const modalSize = ref({ width: 1100, height: 720 });
let dragStart = { mouseX: 0, mouseY: 0, posX: 0, posY: 0 };
let preMaxState = { x: 0, y: 0, width: 1100, height: 720 };

const initModalPosition = () => {
  const w = Math.min(window.innerWidth - 32, 1140);
  const h = Math.min(window.innerHeight - 32, 740);
  modalSize.value = { width: w, height: h };
  modalPos.value = {
    x: Math.max(16, (window.innerWidth - w) / 2),
    y: Math.max(16, (window.innerHeight - h) / 2)
  };
};

const toggleMaximize = () => {
  if (!isMaximized.value) {
    preMaxState = {
      x: modalPos.value.x,
      y: modalPos.value.y,
      width: modalSize.value.width,
      height: modalSize.value.height
    };
    modalPos.value = { x: 8, y: 8 };
    modalSize.value = {
      width: window.innerWidth - 16,
      height: window.innerHeight - 16
    };
    isMaximized.value = true;
  } else {
    isMaximized.value = false;
    modalPos.value = { x: preMaxState.x, y: preMaxState.y };
    modalSize.value = { width: preMaxState.width, height: preMaxState.height };
  }
};

const onHeaderMouseDown = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('button, input, select, a')) return;

  if (isMaximized.value) {
    const restoreW = preMaxState.width;
    const restoreH = preMaxState.height;
    isMaximized.value = false;
    modalSize.value = { width: restoreW, height: restoreH };
    modalPos.value = {
      x: Math.max(8, Math.min(window.innerWidth - restoreW - 8, e.clientX - restoreW / 2)),
      y: Math.max(8, Math.min(window.innerHeight - restoreH - 8, e.clientY - 18))
    };
  }

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
    const modalW = modalSize.value.width;
    const modalH = modalSize.value.height;

    const maxX = Math.max(0, window.innerWidth - modalW - 8);
    const maxY = Math.max(0, window.innerHeight - modalH - 8);

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

// JSON View computed
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
    initModalPosition();
    apiIpInput.value = extractIpFromUrl(getScadaApiBaseUrl());
  }
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      id="dataset-manager-modal"
      class="fixed inset-0 z-[9999] pointer-events-none select-none font-sans"
    >
      <!-- 统一数据关联弹框风格：纯黑背景、硬质深灰边框、纯白高对比字体、支持拖动与拉伸 -->
      <div
        ref="modalRef"
        class="pointer-events-auto absolute bg-black text-white rounded-lg border border-neutral-700 shadow-2xl flex flex-col overflow-hidden"
        :style="{
          left: `${modalPos.x}px`,
          top: `${modalPos.y}px`,
          width: `${modalSize.width}px`,
          height: `${modalSize.height}px`
        }"
      >
        <!-- Header -->
        <header
          class="h-12 px-4 bg-[#111111] border-b border-[#2a2a2a] flex items-center justify-between shrink-0 cursor-move"
          @mousedown="onHeaderMouseDown"
          @dblclick="toggleMaximize"
        >
          <div class="flex items-center gap-2.5">
            <Server class="w-4 h-4 text-white" />
            <h2 class="text-sm font-bold tracking-wide text-white">SCADA 数据集与测点配置中心</h2>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              class="p-1.5 text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer"
              :title="isMaximized ? '向下还原' : '最大化'"
              @click.stop="toggleMaximize"
            >
              <Minimize2 v-if="isMaximized" class="w-4 h-4" />
              <Maximize2 v-else class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1.5 text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer"
              title="关闭"
              @click.stop="emit('close')"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </header>

        <!-- Top SCADA API Config Bar -->
        <div class="px-4 py-2.5 bg-[#141414] border-b border-[#2a2a2a] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div class="flex items-center gap-3 flex-1 min-w-[300px]">
            <div class="flex items-center gap-2 text-white font-bold shrink-0 text-xs">
              <Server class="w-3.5 h-3.5 text-white" />
              <span>服务 IP 地址:</span>
            </div>
            <input
              v-model="apiIpInput"
              id="scada-api-ip-input"
              type="text"
              placeholder="127.0.0.1"
              class="w-52 px-3 py-1 bg-[#181818] border border-neutral-700 rounded text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-white font-mono font-bold"
              @blur="handleSaveApiIp"
              @keyup.enter="handleFetchConfig"
            />
            <button
              id="btn-fetch-scada-config"
              :disabled="isConfigLoading"
              class="px-3.5 py-1 bg-white hover:bg-neutral-200 text-black rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              @click="handleFetchConfig"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isConfigLoading }" />
              <span>获取配置 (GET /config)</span>
            </button>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <!-- Connection status indicator -->
            <div class="flex items-center gap-2 px-3 py-1 bg-[#181818] border border-[#2a2a2a] rounded">
              <span
                class="w-2 h-2 rounded-full"
                :class="scadaApiConnStatus === 'connected' ? 'bg-emerald-400' : (scadaApiConnStatus === 'disconnected' ? 'bg-rose-400' : 'bg-amber-400')"
              />
              <span class="text-white font-bold text-xs">
                {{ scadaApiConnStatus === 'connected' ? '已连接生产服务' : (scadaApiConnStatus === 'disconnected' ? '未连接 (等待上线)' : '服务就绪 (本地已就绪)') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Main Body (3-Column Hierarchy + Point Tables) -->
        <div class="flex-1 flex overflow-hidden bg-black">
          <!-- 1. 厂站 (Facility) Column -->
          <div class="w-52 border-r border-[#2a2a2a] bg-[#111111] flex flex-col shrink-0">
            <div class="p-3 border-b border-[#2a2a2a] bg-[#141414] flex items-center justify-between">
              <div class="flex items-center gap-1.5 text-xs font-bold text-white">
                <Building2 class="w-4 h-4 text-white" />
                <span>1. 厂站选择</span>
              </div>
              <span class="px-1.5 py-0.2 text-[11px] bg-black rounded font-mono font-bold text-white border border-neutral-700">
                {{ scadaFacilities.length }}
              </span>
            </div>

            <div
              class="flex-1 overflow-y-auto p-2 space-y-1.5"
              style="scrollbar-gutter: stable;"
            >
              <div
                v-for="fac in scadaFacilities"
                :key="fac.fac_id"
                :id="`facility-item-${fac.fac_id}`"
                class="p-2.5 rounded cursor-pointer border transition-colors text-left"
                :class="selectedFacId === fac.fac_id ? 'bg-neutral-800 border-neutral-500 text-white font-bold' : 'bg-[#161616] border-[#262626] text-white hover:bg-neutral-800'"
                @click="selectedFacId = fac.fac_id; if (fac.bays?.[0]) selectedBayId = fac.bays[0].bay_id; if (fac.bays?.[0]?.devices?.[0]) selectedDevId = fac.bays[0].devices[0].dev_id;"
              >
                <div class="truncate text-white font-bold text-xs mb-1">{{ fac.fac_name }}</div>
                <div class="flex items-center justify-between text-[11px] text-white font-mono">
                  <span>ID: {{ fac.fac_id }}</span>
                  <span>{{ fac.bays?.length || 0 }} 间隔</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. 间隔 (Bay) Column -->
          <div class="w-56 border-r border-[#2a2a2a] bg-[#111111] flex flex-col shrink-0">
            <div class="p-3 border-b border-[#2a2a2a] bg-[#141414] flex items-center justify-between">
              <div class="flex items-center gap-1.5 text-xs font-bold text-white">
                <Layers class="w-4 h-4 text-white" />
                <span>2. 间隔选择</span>
              </div>
              <span class="px-1.5 py-0.2 text-[11px] bg-black rounded font-mono font-bold text-white border border-neutral-700">
                {{ currentFacility?.bays?.length || 0 }}
              </span>
            </div>

            <div
              class="flex-1 overflow-y-auto p-2 space-y-1.5"
              style="scrollbar-gutter: stable;"
            >
              <div
                v-for="bay in (currentFacility?.bays || [])"
                :key="bay.bay_id"
                :id="`bay-item-${bay.bay_id}`"
                class="p-2.5 rounded cursor-pointer border transition-colors text-left"
                :class="selectedBayId === bay.bay_id ? 'bg-neutral-800 border-neutral-500 text-white font-bold' : 'bg-[#161616] border-[#262626] text-white hover:bg-neutral-800'"
                @click="selectedBayId = bay.bay_id; if (bay.devices?.[0]) selectedDevId = bay.devices[0].dev_id; else if (bay.cb_devices?.[0]) selectedDevId = bay.cb_devices[0].dev_id;"
              >
                <div class="truncate text-white font-bold text-xs mb-1">{{ bay.bay_name }}</div>
                <div class="flex items-center justify-between text-[11px] text-white font-mono">
                  <span>ID: {{ bay.bay_id }}</span>
                  <span>{{ (bay.devices || bay.cb_devices || []).length }} 设备</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. 设备 (Device) Column -->
          <div class="w-56 border-r border-[#2a2a2a] bg-[#111111] flex flex-col shrink-0">
            <div class="p-3 border-b border-[#2a2a2a] bg-[#141414] flex items-center justify-between">
              <div class="flex items-center gap-1.5 text-xs font-bold text-white">
                <Cpu class="w-4 h-4 text-white" />
                <span>3. 设备选择</span>
              </div>
              <span class="px-1.5 py-0.2 text-[11px] bg-black rounded font-mono font-bold text-white border border-neutral-700">
                {{ (currentBay?.devices || currentBay?.cb_devices || []).length }}
              </span>
            </div>

            <div
              class="flex-1 overflow-y-auto p-2 space-y-1.5"
              style="scrollbar-gutter: stable;"
            >
              <div
                v-for="dev in (currentBay?.devices || currentBay?.cb_devices || [])"
                :key="dev.dev_id"
                :id="`dev-item-${dev.dev_id}`"
                class="p-2.5 rounded cursor-pointer border transition-colors text-left"
                :class="selectedDevId === dev.dev_id ? 'bg-neutral-800 border-neutral-500 text-white font-bold' : 'bg-[#161616] border-[#262626] text-white hover:bg-neutral-800'"
                @click="selectedDevId = dev.dev_id"
              >
                <div class="truncate text-white font-bold text-xs mb-1">{{ dev.dev_name }}</div>
                <div class="flex items-center justify-between text-[11px] text-white font-mono">
                  <span>ID: {{ dev.dev_id }}</span>
                  <span>测点 {{ (dev.yc_list || dev.yc_points || []).length + (dev.yx_list || dev.yx_points || []).length }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. 测点数据主展示区 (Point Tabs & Tables) -->
          <div class="flex-1 flex flex-col overflow-hidden bg-black">
            <!-- Tabs & Filter Bar -->
            <div class="h-12 px-4 bg-[#111111] border-b border-[#2a2a2a] flex items-center justify-between gap-3 shrink-0">
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  class="px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                  :class="activeTab === 'yc' ? 'bg-white text-black border-white shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                  @click="activeTab = 'yc'"
                >
                  <Activity class="w-3.5 h-3.5" />
                  <span>遥测 (YC)</span>
                  <span class="px-1.5 py-0.2 rounded text-[10px] font-mono" :class="activeTab === 'yc' ? 'bg-black text-white' : 'bg-black/60 text-white'">
                    {{ (currentDevice?.yc_list || currentDevice?.yc_points || []).length }}
                  </span>
                </button>

                <button
                  type="button"
                  class="px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                  :class="activeTab === 'yx' ? 'bg-white text-black border-white shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                  @click="activeTab = 'yx'"
                >
                  <Radio class="w-3.5 h-3.5" />
                  <span>遥信 (YX)</span>
                  <span class="px-1.5 py-0.2 rounded text-[10px] font-mono" :class="activeTab === 'yx' ? 'bg-black text-white' : 'bg-black/60 text-white'">
                    {{ (currentDevice?.yx_list || currentDevice?.yx_points || []).length }}
                  </span>
                </button>

                <button
                  type="button"
                  class="px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                  :class="activeTab === 'dd' ? 'bg-white text-black border-white shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                  @click="activeTab = 'dd'"
                >
                  <Zap class="w-3.5 h-3.5" />
                  <span>电度 (DD)</span>
                  <span class="px-1.5 py-0.2 rounded text-[10px] font-mono" :class="activeTab === 'dd' ? 'bg-black text-white' : 'bg-black/60 text-white'">
                    {{ (currentDevice?.dd_list || currentDevice?.dd_points || []).length }}
                  </span>
                </button>

                <button
                  type="button"
                  class="px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                  :class="activeTab === 'yk' ? 'bg-white text-black border-white shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                  @click="activeTab = 'yk'"
                >
                  <Sliders class="w-3.5 h-3.5" />
                  <span>遥控 (YK)</span>
                  <span class="px-1.5 py-0.2 rounded text-[10px] font-mono" :class="activeTab === 'yk' ? 'bg-black text-white' : 'bg-black/60 text-white'">
                    {{ (currentDevice?.yk_list || currentDevice?.yk_points || []).length }}
                  </span>
                </button>

                <button
                  type="button"
                  class="px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                  :class="activeTab === 'yt' ? 'bg-white text-black border-white shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                  @click="activeTab = 'yt'"
                >
                  <Workflow class="w-3.5 h-3.5" />
                  <span>遥调 (YT)</span>
                  <span class="px-1.5 py-0.2 rounded text-[10px] font-mono" :class="activeTab === 'yt' ? 'bg-black text-white' : 'bg-black/60 text-white'">
                    {{ (currentDevice?.yt_list || currentDevice?.yt_points || []).length }}
                  </span>
                </button>

                <button
                  type="button"
                  class="px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                  :class="activeTab === 'json' ? 'bg-white text-black border-white shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                  @click="activeTab = 'json'"
                >
                  <Code class="w-3.5 h-3.5" />
                  <span>JSON 树</span>
                </button>
              </div>

              <!-- Search Input -->
              <div v-if="activeTab !== 'json'" class="relative w-44">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="搜索测点..."
                  class="w-full pl-8 pr-2.5 py-1 bg-[#181818] border border-neutral-700 rounded text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-white font-medium"
                />
                <FileText class="w-3.5 h-3.5 text-white absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <!-- Tab Content 1: 遥测 (YC) Table -->
            <div
              v-if="activeTab === 'yc'"
              class="flex-1 overflow-y-auto p-2.5"
              style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
            >
              <table class="w-full text-left text-xs border-collapse" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: 140px;" />
                  <col style="width: auto;" />
                  <col style="width: 220px;" />
                </colgroup>
                <thead>
                  <tr class="border-b border-[#2a2a2a] text-white bg-[#141414] font-bold sticky top-0 z-10 h-10">
                    <th class="p-2.5">测点 ID</th>
                    <th class="p-2.5">测点名称</th>
                    <th class="p-2.5">点位别名 / 类型</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#1e1e1e] font-mono text-white">
                  <tr
                    v-for="yc in filteredYcList"
                    :key="yc.id"
                    :id="`yc-row-${yc.id}`"
                    class="hover:bg-[#161616] transition-colors h-10"
                  >
                    <td class="p-2.5 font-bold text-white">{{ yc.id }}</td>
                    <td class="p-2.5 font-sans font-bold text-white truncate">{{ yc.name }}</td>
                    <td class="p-2.5 text-white truncate">{{ yc.alias || yc.type_name || '-' }}</td>
                  </tr>
                  <tr v-if="filteredYcList.length === 0">
                    <td colspan="3" class="p-8 text-center text-white font-sans font-medium text-xs">
                      暂无符合条件的遥测测点
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tab Content 2: 遥信 (YX) Table -->
            <div
              v-if="activeTab === 'yx'"
              class="flex-1 overflow-y-auto p-2.5"
              style="scrollbar-gutter: stable;"
            >
              <table class="w-full text-left text-xs border-collapse" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: 140px;" />
                  <col style="width: auto;" />
                  <col style="width: 220px;" />
                </colgroup>
                <thead>
                  <tr class="border-b border-[#2a2a2a] text-white bg-[#141414] font-bold sticky top-0 z-10 h-10">
                    <th class="p-2.5">测点 ID</th>
                    <th class="p-2.5">测点名称</th>
                    <th class="p-2.5">点位别名 / 类型</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#1e1e1e] font-mono text-white">
                  <tr
                    v-for="yx in filteredYxList"
                    :key="yx.id"
                    :id="`yx-row-${yx.id}`"
                    class="hover:bg-[#161616] transition-colors h-10"
                  >
                    <td class="p-2.5 font-bold text-white">{{ yx.id }}</td>
                    <td class="p-2.5 font-sans font-bold text-white truncate">{{ yx.name }}</td>
                    <td class="p-2.5 text-white truncate">{{ yx.alias || yx.type_name || '-' }}</td>
                  </tr>
                  <tr v-if="filteredYxList.length === 0">
                    <td colspan="3" class="p-8 text-center text-white font-sans font-medium text-xs">
                      暂无符合条件的遥信测点
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tab Content 3: 电度 (DD) Table -->
            <div
              v-if="activeTab === 'dd'"
              class="flex-1 overflow-y-auto p-2.5"
              style="scrollbar-gutter: stable;"
            >
              <table class="w-full text-left text-xs border-collapse" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: 140px;" />
                  <col style="width: auto;" />
                  <col style="width: 220px;" />
                </colgroup>
                <thead>
                  <tr class="border-b border-[#2a2a2a] text-white bg-[#141414] font-bold sticky top-0 z-10 h-10">
                    <th class="p-2.5">电度 ID</th>
                    <th class="p-2.5">测点名称</th>
                    <th class="p-2.5">点位别名 / 单位</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#1e1e1e] font-mono text-white">
                  <tr
                    v-for="dd in filteredDdList"
                    :key="dd.id"
                    :id="`dd-row-${dd.id}`"
                    class="hover:bg-[#161616] transition-colors h-10"
                  >
                    <td class="p-2.5 font-bold text-white">{{ dd.id }}</td>
                    <td class="p-2.5 font-sans font-bold text-white truncate">{{ dd.name }}</td>
                    <td class="p-2.5 text-white truncate">{{ dd.alias || dd.unit || 'kWh' }}</td>
                  </tr>
                  <tr v-if="filteredDdList.length === 0">
                    <td colspan="3" class="p-8 text-center text-white font-sans font-medium text-xs">
                      暂无符合条件的电度测点
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tab Content 4: 遥控 (YK) Table -->
            <div
              v-if="activeTab === 'yk'"
              class="flex-1 overflow-y-auto p-2.5"
              style="scrollbar-gutter: stable;"
            >
              <table class="w-full text-left text-xs border-collapse" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: 140px;" />
                  <col style="width: auto;" />
                  <col style="width: 180px;" />
                  <col style="width: 180px;" />
                </colgroup>
                <thead>
                  <tr class="border-b border-[#2a2a2a] text-white bg-[#141414] font-bold sticky top-0 z-10 h-10">
                    <th class="p-2.5">遥控 ID</th>
                    <th class="p-2.5">控制名称</th>
                    <th class="p-2.5">别名 / 编号</th>
                    <th class="p-2.5">关联返校遥信点 (YX)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#1e1e1e] font-mono text-white">
                  <tr
                    v-for="yk in filteredYkList"
                    :key="yk.id"
                    :id="`yk-row-${yk.id}`"
                    class="hover:bg-[#161616] transition-colors h-10"
                  >
                    <td class="p-2.5 font-bold text-white">{{ yk.id }}</td>
                    <td class="p-2.5 font-sans font-bold text-white truncate">{{ yk.name }}</td>
                    <td class="p-2.5 text-white truncate">{{ yk.alias || '-' }}</td>
                    <td class="p-2.5 text-white text-xs font-bold">
                      <span v-if="yk.targetVerificationPointId" class="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-600">
                        YX_{{ yk.targetVerificationPointId }}
                      </span>
                      <span v-else class="text-white">未指定默认</span>
                    </td>
                  </tr>
                  <tr v-if="filteredYkList.length === 0">
                    <td colspan="4" class="p-8 text-center text-white font-sans font-medium text-xs">
                      暂无符合条件的遥控点位
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tab Content 5: 遥调 (YT) Table -->
            <div
              v-if="activeTab === 'yt'"
              class="flex-1 overflow-y-auto p-2.5"
              style="scrollbar-gutter: stable;"
            >
              <table class="w-full text-left text-xs border-collapse" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: 140px;" />
                  <col style="width: auto;" />
                  <col style="width: 180px;" />
                  <col style="width: 180px;" />
                </colgroup>
                <thead>
                  <tr class="border-b border-[#2a2a2a] text-white bg-[#141414] font-bold sticky top-0 z-10 h-10">
                    <th class="p-2.5">遥调 ID</th>
                    <th class="p-2.5">遥调名称</th>
                    <th class="p-2.5">别名 / 编号</th>
                    <th class="p-2.5">关联返校遥测点 (YC)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#1e1e1e] font-mono text-white">
                  <tr
                    v-for="yt in filteredYtList"
                    :key="yt.id"
                    :id="`yt-row-${yt.id}`"
                    class="hover:bg-[#161616] transition-colors h-10"
                  >
                    <td class="p-2.5 font-bold text-white">{{ yt.id }}</td>
                    <td class="p-2.5 font-sans font-bold text-white truncate">{{ yt.name }}</td>
                    <td class="p-2.5 text-white truncate">{{ yt.alias || '-' }}</td>
                    <td class="p-2.5 text-white text-xs font-bold">
                      <span v-if="yt.targetVerificationPointId" class="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-600">
                        YC_{{ yt.targetVerificationPointId }}
                      </span>
                      <span v-else class="text-white">未指定默认</span>
                    </td>
                  </tr>
                  <tr v-if="filteredYtList.length === 0">
                    <td colspan="4" class="p-8 text-center text-white font-sans font-medium text-xs">
                      暂无符合条件的遥调点位
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tab Content 6: JSON Config Viewer -->
            <div v-if="activeTab === 'json'" class="flex-1 p-3 overflow-hidden flex flex-col bg-black">
              <div class="mb-2 flex items-center justify-between text-xs text-white font-bold">
                <span>SCADA 配置结构体 (符合 GET /api/scada/config 格式):</span>
              </div>
              <textarea
                readonly
                class="flex-1 w-full p-3 bg-[#0e0e0e] border border-neutral-700 rounded text-xs font-mono text-white resize-none focus:outline-none"
                :value="scadaConfigJsonString"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <footer class="h-13 px-5 bg-[#111111] border-t border-[#2a2a2a] flex items-center justify-between shrink-0">
          <div class="text-xs text-white font-medium">
            当前选中: {{ currentFacility?.fac_name || '-' }} ➜ {{ currentBay?.bay_name || '-' }} ➜ {{ currentDevice?.dev_name || '-' }}
          </div>

          <div class="flex items-center gap-2.5">
            <button
              type="button"
              @click="syncToParentDatasets(); showToast('已成功同步测点至全局数据集', 'success');"
              class="px-4 py-1.5 rounded bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-colors cursor-pointer shadow-sm"
            >
              同步全局数据集
            </button>
            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              关闭
            </button>
          </div>
        </footer>

        <!-- Toast Notification -->
        <div
          v-if="toastMessage"
          class="fixed bottom-6 right-6 px-4 py-2.5 rounded text-xs font-bold shadow-2xl flex items-center gap-2 z-50 transition-all border border-neutral-600 bg-neutral-900 text-white"
        >
          <Check v-if="toastMessage.type === 'success'" class="w-4 h-4 text-emerald-400" />
          <AlertCircle v-else class="w-4 h-4 text-rose-400" />
          <span>{{ toastMessage.text }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>
