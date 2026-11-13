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
const modalSize = ref({ width: 1400, height: 760 });
let dragStart = { mouseX: 0, mouseY: 0, posX: 0, posY: 0 };
let preMaxState = { x: 0, y: 0, width: 1400, height: 760 };

const isResizing = ref(false);
let resizeStart = { mouseX: 0, mouseY: 0, width: 0, height: 0 };
let currentResizeDir: 'e' | 's' | 'se' = 'se';

const initModalPosition = () => {
  const w = Math.min(window.innerWidth - 32, 1420);
  const h = Math.min(window.innerHeight - 32, 780);
  modalSize.value = { width: w, height: h };
  modalPos.value = {
    x: Math.max(16, (window.innerWidth - w) / 2),
    y: Math.max(16, (window.innerHeight - h) / 2)
  };
};

const startResize = (dir: 'e' | 's' | 'se', e: MouseEvent) => {
  if (isMaximized.value) return;
  e.preventDefault();
  e.stopPropagation();

  isResizing.value = true;
  currentResizeDir = dir;
  resizeStart = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    width: modalSize.value.width,
    height: modalSize.value.height
  };

  const onMouseMove = (ev: MouseEvent) => {
    if (!isResizing.value) return;
    const dx = ev.clientX - resizeStart.mouseX;
    const dy = ev.clientY - resizeStart.mouseY;

    let newW = resizeStart.width;
    let newH = resizeStart.height;

    if (currentResizeDir === 'e' || currentResizeDir === 'se') {
      newW = Math.max(820, Math.min(window.innerWidth - modalPos.value.x - 8, resizeStart.width + dx));
    }
    if (currentResizeDir === 's' || currentResizeDir === 'se') {
      newH = Math.max(480, Math.min(window.innerHeight - modalPos.value.y - 8, resizeStart.height + dy));
    }

    modalSize.value = { width: newW, height: newH };
  };

  const onMouseUp = () => {
    isResizing.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
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
      <!-- 统一凝思工控米白质感风格：纯正米白背景、工控立体灰边框、纯黑高对比字体、支持拖动 -->
      <div
        ref="modalRef"
        class="pointer-events-auto absolute bg-[#ebe4d4] text-black border-2 border-[#8c826d] shadow-2xl flex flex-col overflow-hidden"
        :style="{
          left: `${modalPos.x}px`,
          top: `${modalPos.y}px`,
          width: `${modalSize.width}px`,
          height: `${modalSize.height}px`
        }"
      >
        <!-- Modal Header -->
        <header
          class="h-11 px-3.5 bg-[#e5decb] border-b border-[#cfc5b0] flex items-center justify-between shrink-0 cursor-move text-black"
          @mousedown="onHeaderMouseDown"
          @dblclick="toggleMaximize"
        >
          <div class="flex items-center gap-2.5">
            <Server class="w-4 h-4 text-sky-800" />
            <h2 class="text-sm font-bold tracking-wide text-black">SCADA 数据集与测点配置中心</h2>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              class="p-1.5 text-slate-700 hover:text-black hover:bg-[#ded5bf] border border-transparent hover:border-[#cfc5b0] transition-colors cursor-pointer"
              :title="isMaximized ? '向下还原' : '最大化'"
              @click.stop="toggleMaximize"
            >
              <Minimize2 v-if="isMaximized" class="w-4 h-4" />
              <Maximize2 v-else class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1.5 text-slate-700 hover:text-black hover:bg-[#ded5bf] border border-transparent hover:border-[#cfc5b0] transition-colors cursor-pointer"
              title="关闭"
              @click.stop="emit('close')"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </header>

        <!-- Top SCADA API Config Bar -->
        <div class="px-4 py-2 bg-[#ebe4d4] border-b border-[#cfc5b0] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 text-black">
          <div class="flex items-center gap-3 flex-1 min-w-[300px]">
            <div class="flex items-center gap-2 text-black font-bold shrink-0 text-xs">
              <Server class="w-3.5 h-3.5 text-sky-800" />
              <span>服务 IP 地址:</span>
            </div>
            <input
              v-model="apiIpInput"
              id="scada-api-ip-input"
              type="text"
              placeholder="127.0.0.1"
              class="w-48 px-2.5 py-1 bg-white border border-[#b8ad96] text-xs text-black placeholder-slate-400 focus:outline-none focus:border-sky-700 font-mono font-medium"
              @blur="handleSaveApiIp"
              @keyup.enter="handleFetchConfig"
            />
            <button
              id="btn-fetch-scada-config"
              :disabled="isConfigLoading"
              class="px-3 py-1 bg-sky-700 hover:bg-sky-800 border border-sky-950 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              @click="handleFetchConfig"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isConfigLoading }" />
              <span>获取配置 (GET /config)</span>
            </button>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <!-- Connection status indicator -->
            <div class="flex items-center gap-2 px-2.5 py-1 bg-white border border-[#b8ad96]">
              <span
                class="w-2 h-2 rounded-full"
                :class="scadaApiConnStatus === 'connected' ? 'bg-[#67c23a]' : (scadaApiConnStatus === 'disconnected' ? 'bg-[#f56c6c]' : 'bg-[#e6a23c]')"
              />
              <span class="text-black font-medium text-xs">
                {{ scadaApiConnStatus === 'connected' ? '已连接生产服务' : (scadaApiConnStatus === 'disconnected' ? '未连接 (等待上线)' : '服务就绪 (本地已就绪)') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Main Body (3-Column Hierarchy + Point Tables) -->
        <div class="flex-1 flex overflow-hidden bg-[#f2eee3] text-black">
          <!-- 1. 厂站 (Facility) Column -->
          <div class="w-56 border-r border-[#cfc5b0] bg-[#ebe4d4] flex flex-col shrink-0">
            <div class="p-2.5 border-b border-[#cfc5b0] bg-[#e5decb] flex items-center justify-between text-black">
              <div class="flex items-center gap-1.5 text-xs font-bold text-black">
                <Building2 class="w-4 h-4 text-sky-800" />
                <span>1. 厂站选择</span>
              </div>
              <span class="px-1.5 py-0.2 text-[11px] bg-[#dfd6bf] font-mono font-medium text-black border border-[#cfc5b0]">
                {{ scadaFacilities.length }}
              </span>
            </div>

            <div
              class="flex-1 overflow-y-auto p-1.5 space-y-1"
              style="scrollbar-gutter: stable;"
            >
              <div
                v-for="fac in scadaFacilities"
                :key="fac.fac_id"
                :id="`facility-item-${fac.fac_id}`"
                class="p-2 cursor-pointer border transition-colors text-left"
                :class="selectedFacId === fac.fac_id ? 'bg-[#dfd6bf] border-[#8c826d] text-black font-bold' : 'bg-white border-[#b8ad96] text-black hover:bg-[#f8f5ee]'"
                @click="selectedFacId = fac.fac_id; if (fac.bays?.[0]) selectedBayId = fac.bays[0].bay_id; if (fac.bays?.[0]?.devices?.[0]) selectedDevId = fac.bays[0].devices[0].dev_id;"
              >
                <div class="truncate text-black font-bold text-xs mb-1">{{ fac.fac_name }}</div>
                <div class="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                  <span>ID: {{ fac.fac_id }}</span>
                  <span>{{ fac.bays?.length || 0 }} 间隔</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. 间隔 (Bay) Column -->
          <div class="w-60 border-r border-[#cfc5b0] bg-[#ebe4d4] flex flex-col shrink-0">
            <div class="p-2.5 border-b border-[#cfc5b0] bg-[#e5decb] flex items-center justify-between text-black">
              <div class="flex items-center gap-1.5 text-xs font-bold text-black">
                <Layers class="w-4 h-4 text-sky-800" />
                <span>2. 间隔选择</span>
              </div>
              <span class="px-1.5 py-0.2 text-[11px] bg-[#dfd6bf] font-mono font-medium text-black border border-[#cfc5b0]">
                {{ currentFacility?.bays?.length || 0 }}
              </span>
            </div>

            <div
              class="flex-1 overflow-y-auto p-1.5 space-y-1"
              style="scrollbar-gutter: stable;"
            >
              <div
                v-for="bay in (currentFacility?.bays || [])"
                :key="bay.bay_id"
                :id="`bay-item-${bay.bay_id}`"
                class="p-2 cursor-pointer border transition-colors text-left"
                :class="selectedBayId === bay.bay_id ? 'bg-[#dfd6bf] border-[#8c826d] text-black font-bold' : 'bg-white border-[#b8ad96] text-black hover:bg-[#f8f5ee]'"
                @click="selectedBayId = bay.bay_id; if (bay.devices?.[0]) selectedDevId = bay.devices[0].dev_id; else if (bay.cb_devices?.[0]) selectedDevId = bay.cb_devices[0].dev_id;"
              >
                <div class="truncate text-black font-bold text-xs mb-1">{{ bay.bay_name }}</div>
                <div class="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                  <span>ID: {{ bay.bay_id }}</span>
                  <span>{{ (bay.devices || bay.cb_devices || []).length }} 设备</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. 设备 (Device) Column -->
          <div class="w-60 border-r border-[#cfc5b0] bg-[#ebe4d4] flex flex-col shrink-0">
            <div class="p-2.5 border-b border-[#cfc5b0] bg-[#e5decb] flex items-center justify-between text-black">
              <div class="flex items-center gap-1.5 text-xs font-bold text-black">
                <Cpu class="w-4 h-4 text-sky-800" />
                <span>3. 设备选择</span>
              </div>
              <span class="px-1.5 py-0.2 text-[11px] bg-[#dfd6bf] font-mono font-medium text-black border border-[#cfc5b0]">
                {{ (currentBay?.devices || currentBay?.cb_devices || []).length }}
              </span>
            </div>

            <div
              class="flex-1 overflow-y-auto p-1.5 space-y-1"
              style="scrollbar-gutter: stable;"
            >
              <div
                v-for="dev in (currentBay?.devices || currentBay?.cb_devices || [])"
                :key="dev.dev_id"
                :id="`dev-item-${dev.dev_id}`"
                class="p-2 cursor-pointer border transition-colors text-left"
                :class="selectedDevId === dev.dev_id ? 'bg-[#dfd6bf] border-[#8c826d] text-black font-bold' : 'bg-white border-[#b8ad96] text-black hover:bg-[#f8f5ee]'"
                @click="selectedDevId = dev.dev_id"
              >
                <div class="truncate text-black font-bold text-xs mb-1">{{ dev.dev_name }}</div>
                <div class="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                  <span>ID: {{ dev.dev_id }}</span>
                  <span>测点 {{ (dev.yc_list || dev.yc_points || []).length + (dev.yx_list || dev.yx_points || []).length }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. 测点数据主展示区 (Point Tabs & Tables) -->
          <div class="flex-1 flex flex-col overflow-hidden bg-white text-black">
            <!-- Tabs & Filter Bar -->
            <div class="h-10 px-3 bg-[#e5decb] border-b border-[#cfc5b0] flex items-center justify-between gap-3 shrink-0">
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  class="px-2.5 py-0.5 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                  :class="activeTab === 'yc' ? 'bg-white text-black border-[#8c826d]' : 'bg-[#dfd6bf] text-black border-[#cfc5b0] hover:bg-[#d4caaf]'"
                  @click="activeTab = 'yc'"
                >
                  <Activity class="w-3.5 h-3.5 text-sky-800" />
                  <span>遥测</span>
                  <span class="px-1 text-[10px] font-mono bg-[#ebe4d4] text-black border border-[#cfc5b0]">
                    {{ (currentDevice?.yc_list || currentDevice?.yc_points || []).length }}
                  </span>
                </button>

                <button
                  type="button"
                  class="px-2.5 py-0.5 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                  :class="activeTab === 'yx' ? 'bg-white text-black border-[#8c826d]' : 'bg-[#dfd6bf] text-black border-[#cfc5b0] hover:bg-[#d4caaf]'"
                  @click="activeTab = 'yx'"
                >
                  <Radio class="w-3.5 h-3.5 text-sky-800" />
                  <span>遥信</span>
                  <span class="px-1 text-[10px] font-mono bg-[#ebe4d4] text-black border border-[#cfc5b0]">
                    {{ (currentDevice?.yx_list || currentDevice?.yx_points || []).length }}
                  </span>
                </button>

                <button
                  type="button"
                  class="px-2.5 py-0.5 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                  :class="activeTab === 'dd' ? 'bg-white text-black border-[#8c826d]' : 'bg-[#dfd6bf] text-black border-[#cfc5b0] hover:bg-[#d4caaf]'"
                  @click="activeTab = 'dd'"
                >
                  <Zap class="w-3.5 h-3.5 text-amber-600" />
                  <span>电度</span>
                  <span class="px-1 text-[10px] font-mono bg-[#ebe4d4] text-black border border-[#cfc5b0]">
                    {{ (currentDevice?.dd_list || currentDevice?.dd_points || []).length }}
                  </span>
                </button>

                <button
                  type="button"
                  class="px-2.5 py-0.5 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                  :class="activeTab === 'yk' ? 'bg-white text-black border-[#8c826d]' : 'bg-[#dfd6bf] text-black border-[#cfc5b0] hover:bg-[#d4caaf]'"
                  @click="activeTab = 'yk'"
                >
                  <Sliders class="w-3.5 h-3.5 text-sky-800" />
                  <span>遥控</span>
                  <span class="px-1 text-[10px] font-mono bg-[#ebe4d4] text-black border border-[#cfc5b0]">
                    {{ (currentDevice?.yk_list || currentDevice?.yk_points || []).length }}
                  </span>
                </button>

                <button
                  type="button"
                  class="px-2.5 py-0.5 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                  :class="activeTab === 'yt' ? 'bg-white text-black border-[#8c826d]' : 'bg-[#dfd6bf] text-black border-[#cfc5b0] hover:bg-[#d4caaf]'"
                  @click="activeTab = 'yt'"
                >
                  <Workflow class="w-3.5 h-3.5 text-sky-800" />
                  <span>遥调</span>
                  <span class="px-1 text-[10px] font-mono bg-[#ebe4d4] text-black border border-[#cfc5b0]">
                    {{ (currentDevice?.yt_list || currentDevice?.yt_points || []).length }}
                  </span>
                </button>

                <button
                  type="button"
                  class="px-2.5 py-0.5 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border"
                  :class="activeTab === 'json' ? 'bg-white text-black border-[#8c826d]' : 'bg-[#dfd6bf] text-black border-[#cfc5b0] hover:bg-[#d4caaf]'"
                  @click="activeTab = 'json'"
                >
                  <Code class="w-3.5 h-3.5 text-slate-700" />
                  <span>JSON 树</span>
                </button>
              </div>

              <!-- Search Input -->
              <div v-if="activeTab !== 'json'" class="relative w-44">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="搜索测点..."
                  class="w-full pl-7 pr-2.5 py-0.5 bg-white border border-[#b8ad96] text-xs text-black placeholder-slate-400 focus:outline-none focus:border-sky-700 font-medium"
                />
                <FileText class="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <!-- Tab Content 1: 遥测 (YC) Table -->
            <div
              v-if="activeTab === 'yc'"
              class="flex-1 overflow-y-auto p-2"
              style="contain: strict; will-change: scroll-position; transform: translateZ(0); scrollbar-gutter: stable;"
            >
              <table class="w-full text-left text-xs border-collapse" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: 140px;" />
                  <col style="width: auto;" />
                  <col style="width: 220px;" />
                </colgroup>
                <thead>
                  <tr class="border-b border-[#b8ad96] text-black bg-[#ebe4d4] font-bold sticky top-0 z-10 h-8">
                    <th class="p-2">测点 ID</th>
                    <th class="p-2">测点名称</th>
                    <th class="p-2">点位别名 / 类型</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 font-mono text-black">
                  <tr
                    v-for="yc in filteredYcList"
                    :key="yc.id"
                    :id="`yc-row-${yc.id}`"
                    class="hover:bg-[#f8f5ee] transition-colors h-8.5"
                  >
                    <td class="p-2 font-medium text-black">{{ yc.id }}</td>
                    <td class="p-2 font-sans font-medium text-black truncate">{{ yc.name }}</td>
                    <td class="p-2 text-slate-700 truncate">{{ yc.alias || yc.type_name || '-' }}</td>
                  </tr>
                  <tr v-if="filteredYcList.length === 0">
                    <td colspan="3" class="p-8 text-center text-slate-500 font-sans font-medium text-xs">
                      暂无符合条件的遥测测点
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tab Content 2: 遥信 (YX) Table -->
            <div
              v-if="activeTab === 'yx'"
              class="flex-1 overflow-y-auto p-2"
              style="scrollbar-gutter: stable;"
            >
              <table class="w-full text-left text-xs border-collapse" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: 140px;" />
                  <col style="width: auto;" />
                  <col style="width: 220px;" />
                </colgroup>
                <thead>
                  <tr class="border-b border-[#b8ad96] text-black bg-[#ebe4d4] font-bold sticky top-0 z-10 h-8">
                    <th class="p-2">测点 ID</th>
                    <th class="p-2">测点名称</th>
                    <th class="p-2">点位别名 / 类型</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 font-mono text-black">
                  <tr
                    v-for="yx in filteredYxList"
                    :key="yx.id"
                    :id="`yx-row-${yx.id}`"
                    class="hover:bg-[#f8f5ee] transition-colors h-8.5"
                  >
                    <td class="p-2 font-medium text-black">{{ yx.id }}</td>
                    <td class="p-2 font-sans font-medium text-black truncate">{{ yx.name }}</td>
                    <td class="p-2 text-slate-700 truncate">{{ yx.alias || yx.type_name || '-' }}</td>
                  </tr>
                  <tr v-if="filteredYxList.length === 0">
                    <td colspan="3" class="p-8 text-center text-slate-500 font-sans font-medium text-xs">
                      暂无符合条件的遥信测点
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tab Content 3: 电度 (DD) Table -->
            <div
              v-if="activeTab === 'dd'"
              class="flex-1 overflow-y-auto p-2"
              style="scrollbar-gutter: stable;"
            >
              <table class="w-full text-left text-xs border-collapse" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: 140px;" />
                  <col style="width: auto;" />
                  <col style="width: 220px;" />
                </colgroup>
                <thead>
                  <tr class="border-b border-[#b8ad96] text-black bg-[#ebe4d4] font-bold sticky top-0 z-10 h-8">
                    <th class="p-2">电度 ID</th>
                    <th class="p-2">测点名称</th>
                    <th class="p-2">点位别名 / 单位</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 font-mono text-black">
                  <tr
                    v-for="dd in filteredDdList"
                    :key="dd.id"
                    :id="`dd-row-${dd.id}`"
                    class="hover:bg-[#f8f5ee] transition-colors h-8.5"
                  >
                    <td class="p-2 font-medium text-black">{{ dd.id }}</td>
                    <td class="p-2 font-sans font-medium text-black truncate">{{ dd.name }}</td>
                    <td class="p-2 text-slate-700 truncate">{{ dd.alias || dd.unit || 'kWh' }}</td>
                  </tr>
                  <tr v-if="filteredDdList.length === 0">
                    <td colspan="3" class="p-8 text-center text-slate-500 font-sans font-medium text-xs">
                      暂无符合条件的电度测点
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tab Content 4: 遥控 (YK) Table -->
            <div
              v-if="activeTab === 'yk'"
              class="flex-1 overflow-y-auto p-2"
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
                  <tr class="border-b border-[#b8ad96] text-black bg-[#ebe4d4] font-bold sticky top-0 z-10 h-8">
                    <th class="p-2">遥控 ID</th>
                    <th class="p-2">控制名称</th>
                    <th class="p-2">别名 / 编号</th>
                    <th class="p-2">关联返校遥信点</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 font-mono text-black">
                  <tr
                    v-for="yk in filteredYkList"
                    :key="yk.id"
                    :id="`yk-row-${yk.id}`"
                    class="hover:bg-[#f8f5ee] transition-colors h-8.5"
                  >
                    <td class="p-2 font-medium text-black">{{ yk.id }}</td>
                    <td class="p-2 font-sans font-medium text-black truncate">{{ yk.name }}</td>
                    <td class="p-2 text-slate-700 truncate">{{ yk.alias || '-' }}</td>
                    <td class="p-2 text-black text-xs font-medium">
                      <span v-if="yk.targetVerificationPointId" class="px-1.5 py-0.5 bg-[#dfd6bf] border border-[#cfc5b0]">
                        {{ yk.targetVerificationPointId }}
                      </span>
                      <span v-else class="text-slate-500">未指定默认</span>
                    </td>
                  </tr>
                  <tr v-if="filteredYkList.length === 0">
                    <td colspan="4" class="p-8 text-center text-slate-500 font-sans font-medium text-xs">
                      暂无符合条件的遥控点位
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tab Content 5: 遥调 (YT) Table -->
            <div
              v-if="activeTab === 'yt'"
              class="flex-1 overflow-y-auto p-2"
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
                  <tr class="border-b border-[#b8ad96] text-black bg-[#ebe4d4] font-bold sticky top-0 z-10 h-8">
                    <th class="p-2">遥调 ID</th>
                    <th class="p-2">遥调名称</th>
                    <th class="p-2">别名 / 编号</th>
                    <th class="p-2">关联返校遥测点</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 font-mono text-black">
                  <tr
                    v-for="yt in filteredYtList"
                    :key="yt.id"
                    :id="`yt-row-${yt.id}`"
                    class="hover:bg-[#f8f5ee] transition-colors h-8.5"
                  >
                    <td class="p-2 font-medium text-black">{{ yt.id }}</td>
                    <td class="p-2 font-sans font-medium text-black truncate">{{ yt.name }}</td>
                    <td class="p-2 text-slate-700 truncate">{{ yt.alias || '-' }}</td>
                    <td class="p-2 text-black text-xs font-medium">
                      <span v-if="yt.targetVerificationPointId" class="px-1.5 py-0.5 bg-[#dfd6bf] border border-[#cfc5b0]">
                        {{ yt.targetVerificationPointId }}
                      </span>
                      <span v-else class="text-slate-500">未指定默认</span>
                    </td>
                  </tr>
                  <tr v-if="filteredYtList.length === 0">
                    <td colspan="4" class="p-8 text-center text-slate-500 font-sans font-medium text-xs">
                      暂无符合条件的遥调点位
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tab Content 6: JSON Config Viewer -->
            <div v-if="activeTab === 'json'" class="flex-1 p-3 overflow-hidden flex flex-col bg-white">
              <div class="mb-2 flex items-center justify-between text-xs text-black font-bold">
                <span>SCADA 配置结构体 (符合 GET /api/scada/config 格式):</span>
              </div>
              <textarea
                readonly
                class="flex-1 w-full p-2.5 bg-[#f8f5ee] border border-[#b8ad96] text-xs font-mono text-black resize-none focus:outline-none"
                :value="scadaConfigJsonString"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <footer class="h-12 px-4 bg-[#e5decb] border-t border-[#cfc5b0] flex items-center justify-between shrink-0 text-black">
          <div class="text-xs text-black font-medium">
            当前选中: {{ currentFacility?.fac_name || '-' }} ➜ {{ currentBay?.bay_name || '-' }} ➜ {{ currentDevice?.dev_name || '-' }}
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="syncToParentDatasets(); showToast('已成功同步测点至全局数据集', 'success');"
              class="px-3.5 py-1 bg-sky-700 hover:bg-sky-800 border border-sky-950 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              同步全局数据集
            </button>
            <button
              type="button"
              @click="emit('close')"
              class="px-3.5 py-1 bg-[#dfd6bf] hover:bg-[#d4caaf] border border-[#b8ad96] text-black text-xs font-medium transition-colors cursor-pointer"
            >
              关闭
            </button>
          </div>
        </footer>

        <!-- Toast Notification -->
        <div
          v-if="toastMessage"
          class="fixed bottom-6 right-6 px-4 py-2 border border-[#8c826d] bg-[#f2eee3] text-black text-xs font-bold shadow-2xl flex items-center gap-2 z-50 transition-all"
        >
          <Check v-if="toastMessage.type === 'success'" class="w-4 h-4 text-[#67c23a]" />
          <AlertCircle v-else class="w-4 h-4 text-[#f56c6c]" />
          <span>{{ toastMessage.text }}</span>
        </div>

        <!-- 窗体拉伸控制边缘 (未最大化时有效) -->
        <template v-if="!isMaximized">
          <div
            @mousedown="startResize('e', $event)"
            class="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-sky-500/20 transition-colors"
            title="左右拖动调整宽度"
          ></div>
          <div
            @mousedown="startResize('s', $event)"
            class="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-sky-500/20 transition-colors"
            title="上下拖动调整高度"
          ></div>
          <div
            @mousedown="startResize('se', $event)"
            class="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 text-neutral-600 hover:text-black hover:bg-black/10 rounded-br transition-colors"
            title="拖动右下角调整大小"
          >
            <svg class="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor">
              <path d="M8 8H9V9H8V8ZM5 8H6V9H5V8ZM8 5H9V6H8V5ZM2 8H3V9H2V8ZM5 5H6V6H5V5ZM8 2H9V3H8V2Z" />
            </svg>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
