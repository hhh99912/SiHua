<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Database,
  X,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Edit,
  Check,
  Code,
  Trash2,
  Settings,
  Sliders,
  Cpu,
  Zap,
  Activity,
  Workflow,
  Radio,
  Send,
  AlertCircle,
  ToggleRight,
  Sparkles,
  Save,
  Server,
  FolderOpen,
  Wifi,
  WifiOff,
  Copy,
  Terminal,
  FileText,
  ShieldCheck,
  History,
  BellRing
} from 'lucide-vue-next';
import { DatasetItem, ScadaDeviceItem, DeviceTelemetryPoint, DeviceTeleSignalPoint, DeviceEnergyPoint, DeviceTeleControlPoint, DeviceTeleRegulationPoint } from '../types';
import { syncFlatDataFromDevices } from '../data/presetDatasets';
import { saveDatasetToDisk, fetchAllDatasetsFromDisk, deleteDatasetFromDisk } from '../utils/datasetFileService';
import {
  getProgramAConfig,
  saveProgramAConfig,
  fetchDevicesFromProgramA,
  generateCppSampleCode,
  ProgramAConfig
} from '../utils/serviceAClient';

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

const selectedDatasetId = ref<string>(props.datasets?.[0]?.id || '');
const selectedDeviceId = ref<string>('DEV-101');
const activeCategoryTab = ref<'yc' | 'yx' | 'dd' | 'yk' | 'yt' | 'json' | 'cpp-sync' | 'settings'>('yc');

const jsonString = ref('');
const jsonError = ref('');
const toastMessage = ref<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

// C++ Program A sync state
const isSyncingProgramA = ref(false);
const programAConfig = ref<ProgramAConfig>(getProgramAConfig());
const cppCodeSample = ref(generateCppSampleCode());
const copiedCode = ref(false);
const connTestStatus = ref<{ tested: boolean; success: boolean; message: string; latency?: number } | null>(null);
const isTestingConn = ref(false);
const diskDatasetFiles = ref<string[]>([]);

const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
  toastMessage.value = { text, type };
  setTimeout(() => {
    toastMessage.value = null;
  }, 4000);
};

const currentDataset = computed<DatasetItem | undefined>(() => {
  const list = props.datasets || [];
  return list.find(d => d.id === selectedDatasetId.value) || list[0];
});

const currentDevice = computed<ScadaDeviceItem | undefined>(() => {
  const ds = currentDataset.value;
  if (!ds || !ds.devices?.length) return undefined;
  return ds.devices.find(d => d.deviceId === selectedDeviceId.value) || ds.devices[0];
});

// Update Dataset helper
const updateDataset = (updater: (ds: DatasetItem) => DatasetItem, autoSaveDisk = true) => {
  const updated = (props.datasets || []).map(d => {
    if (d.id === (currentDataset.value?.id || d.id)) {
      const next = updater(d);
      if (autoSaveDisk) {
        saveDatasetToDisk(next).catch(() => {});
      }
      return next;
    }
    return d;
  });
  emit('update:datasets', updated);
};

// Streaming toggle
const toggleStreaming = () => {
  if (!currentDataset.value) return;
  updateDataset(ds => ({ ...ds, isStreaming: !ds.isStreaming }), false);
};

// Manual update tele-signal integer enum value directly
const handleUpdateTeleSignal = (point: DeviceTeleSignalPoint, nextVal: number, customText?: string) => {
  if (!currentDataset.value || !currentDevice.value) return;
  point.value = nextVal;
  if (customText) {
    point.statusText = customText;
  } else if (point.enumMapping && point.enumMapping[nextVal]) {
    point.statusText = `${point.enumMapping[nextVal]} (${nextVal})`;
  } else if (nextVal === 0) {
    point.statusText = '分闸 (0)';
  } else if (nextVal === 1) {
    point.statusText = '合闸 (1)';
  } else if (nextVal === 2) {
    point.statusText = '故障 (2)';
  } else if (nextVal === 3) {
    point.statusText = '试验位 (3)';
  } else if (nextVal === 4) {
    point.statusText = '工作位 (4)';
  } else {
    point.statusText = `状态 (${nextVal})`;
  }

  const synced = syncFlatDataFromDevices(currentDataset.value.devices);
  updateDataset(ds => ({
    ...ds,
    data: synced.data,
    fields: synced.fields
  }));
  showToast(`[状态修改] 遥信点 [${point.name}] 更新为: ${point.value} (${point.statusText})`, 'info');
};

// Add new Device
const handleAddDevice = () => {
  if (!currentDataset.value) return;
  const newId = `DEV-${100 + (currentDataset.value.devices?.length || 0) + 1}`;
  const newDev: ScadaDeviceItem = {
    deviceId: newId,
    deviceName: `${newId} 综合测控保护装置`,
    deviceType: '测控保护装置',
    commStatus: 1,
    ipAddress: `192.168.1.${100 + (currentDataset.value.devices?.length || 0) + 1}`,
    telemetries: [
      { pointId: 1, name: '三相电压 U', factor: 0.1, unit: 'kV', rawValue: 102.5, value: 10.25 },
      { pointId: 2, name: '三相电流 I', factor: 1.0, unit: 'A', rawValue: 240.0, value: 240.0 },
      { pointId: 3, name: '总有功功率 P', factor: 1.0, unit: 'kW', rawValue: 2450.0, value: 2450.0 }
    ],
    teleSignals: [
      { pointId: 1, name: '断路器位置 (0/1/2)', value: 1, statusText: '合闸 (1)' },
      { pointId: 2, name: '隔离刀闸位置 (0/1/2)', value: 1, statusText: '合闸 (1)' }
    ],
    energies: [
      { pointId: 1, name: '正向有功总电能', factor: 0.01, unit: 'kWh', value: 1000.0 }
    ],
    teleControls: [
      {
        pointId: 1,
        name: '断路器远方分合控制',
        targetPointId: 1,
        options: [
          { label: '分闸 (0)', value: 0 },
          { label: '合闸 (1)', value: 1 }
        ]
      }
    ],
    teleRegulations: [
      { pointId: 1, name: '保护过流动作定值', unit: 'A', min: 50, max: 1000, step: 10, value: 400 }
    ]
  };

  currentDataset.value.devices.push(newDev);
  const synced = syncFlatDataFromDevices(currentDataset.value.devices);
  updateDataset(ds => ({
    ...ds,
    devices: currentDataset.value!.devices,
    data: synced.data,
    fields: synced.fields
  }));
  selectedDeviceId.value = newId;
  showToast(`已成功添加新装置: ${newId} 并写入 data/ 目录`, 'success');
};

// Open JSON View
const handleOpenJson = () => {
  if (!currentDataset.value) return;
  jsonString.value = JSON.stringify(currentDataset.value.devices || [], null, 2);
  jsonError.value = '';
  activeCategoryTab.value = 'json';
};

// Save JSON View
const handleSaveJson = () => {
  try {
    const parsed = JSON.parse(jsonString.value);
    if (!Array.isArray(parsed)) {
      throw new Error('数据集装置配置必须为装置对象数组 (Array)');
    }
    const synced = syncFlatDataFromDevices(parsed);
    updateDataset(ds => ({
      ...ds,
      devices: parsed,
      data: synced.data,
      fields: synced.fields
    }));
    activeCategoryTab.value = 'yc';
    showToast('装置数据集 JSON 配置已保存并同步至 data/ 目录', 'success');
  } catch (err: any) {
    jsonError.value = 'JSON 解析格式错误: ' + err.message;
  }
};

/**
 * 核心操作：点击从 C++ 后端程序 A 动态获取装置与点表
 */
const handleSyncFromProgramA = async () => {
  isSyncingProgramA.value = true;
  saveProgramAConfig(programAConfig.value);

  try {
    const res = await fetchDevicesFromProgramA(programAConfig.value);
    if (res.success && res.devices && res.devices.length > 0) {
      const dsName = res.datasetName || 'C++ 程序 A 实时同步装置库';
      const dsId = `ds-cpp-service-a`;
      const synced = syncFlatDataFromDevices(res.devices);

      const newDs: DatasetItem = {
        id: dsId,
        name: dsName,
        description: `从 C++ 后端程序 A (${programAConfig.value.httpUrl}) 同步生成的测控装置与点表，共 ${res.devices.length} 台装置`,
        type: 'api',
        apiUrl: `${programAConfig.value.httpUrl}/api/scada/devices`,
        wsUrl: programAConfig.value.wsUrl,
        updateIntervalMs: 1500,
        isStreaming: true,
        devices: res.devices,
        data: synced.data,
        fields: synced.fields
      };

      // 保存至 data 磁盘文件
      const saveRes = await saveDatasetToDisk(newDs);

      // 更新前端数据集列表
      const existingList = props.datasets || [];
      const index = existingList.findIndex(d => d.id === dsId || d.name === dsName);
      let nextList: DatasetItem[];
      if (index >= 0) {
        nextList = [...existingList];
        nextList[index] = newDs;
      } else {
        nextList = [newDs, ...existingList];
      }

      selectedDatasetId.value = dsId;
      selectedDeviceId.value = res.devices[0]?.deviceId || 'DEV-CPP-101';
      emit('update:datasets', nextList);

      const diskFilename = saveRes.filename || `${dsName}.json`;
      if (res.source === 'real_cpp') {
        showToast(`✓ [真实 C++ 服务成功同步] 已载入 ${res.devices.length} 台装置点表，并写入 data/${diskFilename}！下次启动将自动读取。`, 'success');
      } else {
        showToast(`✓ [仿真同步就绪] 已从 C++ 接口生成 ${res.devices.length} 台装置并写入 data/${diskFilename}，启动程序 A 后可直连！`, 'info');
      }
    } else {
      showToast(res.error || '从 C++ 程序 A 获取装置点表失败', 'error');
    }
  } catch (err: any) {
    showToast(`同步异常: ${err.message || err}`, 'error');
  } finally {
    isSyncingProgramA.value = false;
  }
};

// 手动保存当前数据集至 data/ 目录
const handleSaveCurrentDatasetToDisk = async () => {
  if (!currentDataset.value) return;
  const res = await saveDatasetToDisk(currentDataset.value);
  if (res.success) {
    showToast(`✓ 数据集已成功保存至 data/${res.filename || currentDataset.value.name + '.json'}`, 'success');
  } else {
    showToast(`保存失败: ${res.error}`, 'error');
  }
};

// 测试 C++ 连接
const handleTestProgramAConnection = async () => {
  isTestingConn.value = true;
  connTestStatus.value = null;
  const start = performance.now();
  saveProgramAConfig(programAConfig.value);

  try {
    const res = await fetchDevicesFromProgramA(programAConfig.value);
    const latency = Math.round(performance.now() - start);
    if (res.source === 'real_cpp' && res.success) {
      connTestStatus.value = {
        tested: true,
        success: true,
        latency,
        message: `通信正常！成功连接到 C++ 程序 A (${programAConfig.value.httpUrl})，探测到 ${res.devices.length} 台装置。`
      };
    } else if (res.source === 'mock_simulation') {
      connTestStatus.value = {
        tested: true,
        success: false,
        latency,
        message: `目标 C++ 服务未响应 (端口 ${programAConfig.value.httpUrl} 离线)。当前启用了仿真协议模式供独立调试。`
      };
    }
  } catch (e: any) {
    connTestStatus.value = {
      tested: true,
      success: false,
      message: `网络异常: ${e.message || e}`
    };
  } finally {
    isTestingConn.value = false;
  }
};

const handleCopyCppCode = () => {
  navigator.clipboard.writeText(cppCodeSample.value);
  copiedCode.value = true;
  showToast('C++ 服务端接口源码已复制到剪贴板', 'success');
  setTimeout(() => {
    copiedCode.value = false;
  }, 2000);
};

onMounted(() => {
  if (!selectedDatasetId.value && props.datasets?.length) {
    selectedDatasetId.value = props.datasets[0].id;
  }
  if (currentDataset.value?.devices?.length) {
    selectedDeviceId.value = currentDataset.value.devices[0].deviceId;
  }
});
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans"
  >
    <!-- Toast Notification -->
    <div
      v-if="toastMessage"
      class="fixed top-6 right-6 z-60 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border text-xs font-mono font-bold animate-bounce max-w-md"
      :class="toastMessage.type === 'error' ? 'bg-red-950/95 border-red-500 text-red-200' : (toastMessage.type === 'info' ? 'bg-amber-950/95 border-amber-500 text-amber-200' : 'bg-emerald-950/95 border-emerald-500 text-emerald-200')"
    >
      <Sparkles class="w-4 h-4 text-cyan-400 shrink-0" />
      <span>{{ toastMessage.text }}</span>
    </div>

    <!-- Modal Box -->
    <div class="w-full max-w-6xl h-[88vh] bg-[#070d1c] border border-cyan-500/40 rounded-2xl shadow-[0_0_60px_rgba(0,242,255,0.18)] flex flex-col overflow-hidden">
      <!-- Modal Header -->
      <div class="px-5 py-3.5 border-b border-cyan-500/20 bg-[#040813] flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(0,242,255,0.2)]">
            <Database class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>SCADA 动态数据集与点表管理器</span>
              </h2>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono">
                data/ 目录持久化架构
              </span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1">
                <Server class="w-3 h-3" />
                C++ 程序 A 联动通信
              </span>
            </div>
            <p class="text-[11px] text-slate-400 font-mono mt-0.5">
              启动自动从 <span class="text-cyan-300">data/*.json</span> 读取装置与点表 | 点击一键从 C++ 后端程序 A 动态同步并持久化
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <!-- ⭐ 关键业务按钮：从 C++ 后端程序 A 获取装置点表 -->
          <button
            @click="handleSyncFromProgramA"
            :disabled="isSyncingProgramA"
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="向 C++ 程序 A 发起请求，获取最新测控装置与点表信息并写入 data/ 目录"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isSyncingProgramA }" />
            <span>{{ isSyncingProgramA ? '正在与 C++ 程序 A 同步...' : '从 C++ 服务(程序A)同步装置点表' }}</span>
          </button>

          <!-- 保存至 data/ 目录按钮 -->
          <button
            @click="handleSaveCurrentDatasetToDisk"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-950 text-xs font-mono font-bold cursor-pointer transition-colors"
            title="手动保存当前数据集配置至 data/<name>.json 供下次启动自动读取"
          >
            <Save class="w-3.5 h-3.5" />
            <span>写入 data/ 目录</span>
          </button>

          <!-- Streaming Toggle Button -->
          <button
            @click="toggleStreaming"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold cursor-pointer transition-colors"
            :class="currentDataset?.isStreaming ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 hover:bg-emerald-900' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'"
          >
            <component :is="currentDataset?.isStreaming ? Pause : Play" class="w-3.5 h-3.5" />
            <span>{{ currentDataset?.isStreaming ? '实时流运行中' : '实时流已暂停' }}</span>
          </button>

          <!-- Close Button -->
          <button
            @click="emit('close')"
            class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors ml-1"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Dataset Selector Bar (多数据集切换) -->
      <div class="px-5 py-2 bg-[#050a17] border-b border-cyan-500/10 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <span class="text-slate-400 font-mono flex items-center gap-1">
            <FolderOpen class="w-3.5 h-3.5 text-cyan-400" />
            <span>当前可用数据集:</span>
          </span>
          <button
            v-for="ds in (datasets || [])"
            :key="ds.id"
            @click="selectedDatasetId = ds.id"
            class="px-2.5 py-1 rounded-md border text-xs font-mono cursor-pointer transition-all flex items-center gap-1.5"
            :class="selectedDatasetId === ds.id ? 'bg-cyan-950 border-cyan-400 text-cyan-200 font-bold shadow-xs' : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="ds.type === 'api' ? 'bg-emerald-400' : 'bg-cyan-400'"></span>
            <span class="truncate max-w-[200px]">{{ ds.name }}</span>
            <span class="text-[10px] text-slate-500 font-mono">({{ ds.devices?.length || 0 }} 装置)</span>
          </button>
        </div>

        <div class="flex items-center gap-2 text-[11px] font-mono text-slate-400 shrink-0">
          <span class="text-emerald-400">● 磁盘目录:</span>
          <span class="text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">./data/</span>
        </div>
      </div>

      <!-- Modal Body (Two Column SCADA Explorer) -->
      <div class="flex-1 flex overflow-hidden">
        <!-- LEFT: Device Tree List -->
        <div class="w-72 border-r border-cyan-500/20 bg-[#050a16] flex flex-col">
          <div class="p-3 border-b border-slate-800 flex items-center justify-between">
            <span class="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Cpu class="w-4 h-4 text-cyan-400" />
              <span>下挂装置列表 ({{ currentDataset?.devices?.length || 0 }})</span>
            </span>
            <button
              @click="handleAddDevice"
              class="px-2 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus class="w-3 h-3" />
              <span>加装置</span>
            </button>
          </div>

          <!-- Device List -->
          <div class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            <div
              v-for="dev in (currentDataset?.devices || [])"
              :key="dev.deviceId"
              @click="selectedDeviceId = dev.deviceId"
              class="p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col gap-1"
              :class="selectedDeviceId === dev.deviceId ? 'bg-cyan-950/60 border-cyan-400 shadow-md text-cyan-200' : 'bg-[#091122] border-slate-800/80 hover:border-cyan-500/40 text-slate-300'"
            >
              <div class="flex items-center justify-between">
                <span class="font-mono font-bold text-cyan-300 text-xs">{{ dev.deviceId }}</span>
                <span class="text-[9px] px-1.5 py-0.2 rounded font-mono" :class="dev.commStatus === 1 ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-red-950 text-red-400 border border-red-500/30'">
                  {{ dev.commStatus === 1 ? '在线 (1)' : '离线 (0)' }}
                </span>
              </div>
              <div class="font-semibold text-[11px] truncate text-slate-200">
                {{ dev.deviceName }}
              </div>
              <div class="flex items-center gap-2 text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
                <span>YC:{{ dev.telemetries?.length || 0 }}</span>
                <span>YX:{{ dev.teleSignals?.length || 0 }}</span>
                <span>DD:{{ dev.energies?.length || 0 }}</span>
                <span>YK:{{ dev.teleControls?.length || 0 }}</span>
                <span>YT:{{ dev.teleRegulations?.length || 0 }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: Device Details & Tele-points Inspector / C++ Architecture Panel -->
        <div class="flex-1 flex flex-col bg-[#070c1a] overflow-hidden" v-if="currentDevice">
          <!-- Device Info Header -->
          <div class="px-5 py-3 border-b border-cyan-500/20 bg-[#060b18] flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-cyan-300 font-mono">[{{ currentDevice.deviceId }}]</span>
                <span class="text-sm font-bold text-slate-100">{{ currentDevice.deviceName }}</span>
                <span class="text-xs text-slate-400 font-mono">IP: {{ currentDevice.ipAddress || '192.168.1.1' }}</span>
              </div>
            </div>

            <!-- Tab Switcher -->
            <div class="flex items-center bg-[#091122] p-1 rounded-lg border border-slate-800 text-xs font-semibold">
              <button
                @click="activeCategoryTab = 'yc'"
                class="px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                :class="activeCategoryTab === 'yc' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                <span>📟 遥测 (YC)</span>
                <span class="text-[10px] opacity-75">({{ currentDevice.telemetries?.length || 0 }})</span>
              </button>

              <button
                @click="activeCategoryTab = 'yx'"
                class="px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                :class="activeCategoryTab === 'yx' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                <span>🚦 遥信 (YX)</span>
                <span class="text-[10px] opacity-75">({{ currentDevice.teleSignals?.length || 0 }})</span>
              </button>

              <button
                @click="activeCategoryTab = 'dd'"
                class="px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                :class="activeCategoryTab === 'dd' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                <span>⚡ 电度 (DD)</span>
                <span class="text-[10px] opacity-75">({{ currentDevice.energies?.length || 0 }})</span>
              </button>

              <button
                @click="activeCategoryTab = 'yk'"
                class="px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                :class="activeCategoryTab === 'yk' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                <span>🎮 遥控 (YK)</span>
                <span class="text-[10px] opacity-75">({{ currentDevice.teleControls?.length || 0 }})</span>
              </button>

              <button
                @click="activeCategoryTab = 'yt'"
                class="px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                :class="activeCategoryTab === 'yt' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                <span>🎚️ 遥调 (YT)</span>
                <span class="text-[10px] opacity-75">({{ currentDevice.teleRegulations?.length || 0 }})</span>
              </button>

              <button
                @click="activeCategoryTab = 'cpp-sync'"
                class="px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                :class="activeCategoryTab === 'cpp-sync' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold' : 'text-emerald-400 hover:text-emerald-200'"
              >
                <Server class="w-3.5 h-3.5" />
                <span>C++通信架构与协议</span>
              </button>

              <button
                @click="handleOpenJson"
                class="px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                :class="activeCategoryTab === 'json' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                <Code class="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          <!-- TAB 1: 遥测数据 (YC) -->
          <div v-if="activeCategoryTab === 'yc'" class="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div class="bg-[#050a16] border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <table class="w-full text-left text-xs font-mono">
                <thead class="bg-[#091122] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th class="py-2.5 px-3">点号</th>
                    <th class="py-2.5 px-3">遥测参数名称</th>
                    <th class="py-2.5 px-3">当前实时值</th>
                    <th class="py-2.5 px-3">单位</th>
                    <th class="py-2.5 px-3">变比系数</th>
                    <th class="py-2.5 px-3">数据键名</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60">
                  <tr
                    v-for="yc in currentDevice.telemetries"
                    :key="yc.pointId"
                    class="hover:bg-cyan-950/20 transition-colors"
                  >
                    <td class="py-2.5 px-3 font-bold text-cyan-400">#{{ yc.pointId }}</td>
                    <td class="py-2.5 px-3 text-slate-200 font-semibold">{{ yc.name }}</td>
                    <td class="py-2.5 px-3 font-bold text-emerald-400 text-sm">
                      <span class="inline-block transition-all duration-300">{{ yc.value }}</span>
                    </td>
                    <td class="py-2.5 px-3 text-cyan-300">{{ yc.unit || '-' }}</td>
                    <td class="py-2.5 px-3 text-slate-400">{{ yc.factor }}</td>
                    <td class="py-2.5 px-3 text-slate-400 text-[11px] font-mono">{{ currentDevice.deviceId }}_YC_{{ yc.pointId }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- TAB 2: 遥信状态 (YX: 兼容任意整数枚举值) -->
          <div v-else-if="activeCategoryTab === 'yx'" class="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div class="bg-[#050a16] border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <table class="w-full text-left text-xs font-mono">
                <thead class="bg-[#091122] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th class="py-2.5 px-3">点号</th>
                    <th class="py-2.5 px-3">遥信信号名称</th>
                    <th class="py-2.5 px-3">当前整数枚举值</th>
                    <th class="py-2.5 px-3">状态文本说明</th>
                    <th class="py-2.5 px-3">数据键名</th>
                    <th class="py-2.5 px-3 text-right">状态设置 (支持任意整数)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60">
                  <tr
                    v-for="yx in currentDevice.teleSignals"
                    :key="yx.pointId"
                    class="hover:bg-cyan-950/20 transition-colors"
                  >
                    <td class="py-2.5 px-3 font-bold text-cyan-400">#{{ yx.pointId }}</td>
                    <td class="py-2.5 px-3 text-slate-200 font-semibold">{{ yx.name }}</td>
                    <td class="py-2.5 px-3">
                      <span
                        class="px-2 py-0.5 rounded font-bold font-mono"
                        :class="yx.value === 1 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : (yx.value === 2 ? 'bg-amber-950 text-amber-300 border border-amber-500/40' : (yx.value === 0 ? 'bg-slate-900 text-slate-300 border border-slate-700' : 'bg-purple-950 text-purple-300 border border-purple-500/40'))"
                      >
                        {{ yx.value }}
                      </span>
                    </td>
                    <td class="py-2.5 px-3 text-slate-300">{{ yx.statusText || yx.description || `状态 (${yx.value})` }}</td>
                    <td class="py-2.5 px-3 text-slate-400 text-[11px] font-mono">{{ currentDevice.deviceId }}_YX_{{ yx.pointId }}</td>
                    <td class="py-2.5 px-3 text-right">
                      <div class="inline-flex items-center gap-1.5 justify-end">
                        <button
                          @click="handleUpdateTeleSignal(yx, 0)"
                          class="px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors"
                          :class="yx.value === 0 ? 'bg-slate-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'"
                        >
                          0:分
                        </button>
                        <button
                          @click="handleUpdateTeleSignal(yx, 1)"
                          class="px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors"
                          :class="yx.value === 1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 hover:bg-emerald-950 text-emerald-300 border border-slate-700'"
                        >
                          1:合
                        </button>
                        <button
                          @click="handleUpdateTeleSignal(yx, 2)"
                          class="px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors"
                          :class="yx.value === 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 hover:bg-amber-950 text-amber-300 border border-slate-700'"
                        >
                          2:障
                        </button>
                        <input
                          type="number"
                          :value="yx.value"
                          @change="handleUpdateTeleSignal(yx, Number(($event.target as HTMLInputElement).value))"
                          class="w-14 bg-[#081226] border border-cyan-500/40 rounded px-1.5 py-0.5 text-center text-cyan-300 text-xs font-mono font-bold outline-hidden"
                          title="输入任意自定义枚举整数"
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- TAB 3: 电度数据 (DD) -->
          <div v-else-if="activeCategoryTab === 'dd'" class="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div class="bg-[#050a16] border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <table class="w-full text-left text-xs font-mono">
                <thead class="bg-[#091122] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th class="py-2.5 px-3">点号</th>
                    <th class="py-2.5 px-3">电度脉冲参数</th>
                    <th class="py-2.5 px-3">累计电量</th>
                    <th class="py-2.5 px-3">单位</th>
                    <th class="py-2.5 px-3">变比</th>
                    <th class="py-2.5 px-3">数据键名</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60">
                  <tr
                    v-for="dd in currentDevice.energies"
                    :key="dd.pointId"
                    class="hover:bg-cyan-950/20 transition-colors"
                  >
                    <td class="py-2.5 px-3 font-bold text-cyan-400">#{{ dd.pointId }}</td>
                    <td class="py-2.5 px-3 text-slate-200 font-semibold">{{ dd.name }}</td>
                    <td class="py-2.5 px-3 font-bold text-cyan-300 text-sm">{{ dd.value }}</td>
                    <td class="py-2.5 px-3 text-slate-300">{{ dd.unit }}</td>
                    <td class="py-2.5 px-3 text-slate-400">{{ dd.factor }}</td>
                    <td class="py-2.5 px-3 text-slate-400 text-[11px] font-mono">{{ currentDevice.deviceId }}_DD_{{ dd.pointId }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- TAB 4: 遥控点表 (YK) -->
          <div v-else-if="activeCategoryTab === 'yk'" class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <div class="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between text-xs">
              <div class="flex items-center gap-2 text-amber-300 font-semibold">
                <Radio class="w-4 h-4 text-amber-400" />
                <span>遥控配置点表 (仅作点位定义与状态展示，实际遥控在主界面右击设备或工控按钮中下发)</span>
              </div>
              <span class="text-[10px] text-slate-400 font-mono">共 {{ currentDevice.teleControls?.length || 0 }} 个遥控点</span>
            </div>

            <div class="bg-[#050a16] border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <table class="w-full text-left text-xs font-mono">
                <thead class="bg-[#091122] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th class="py-2.5 px-3">遥控点号</th>
                    <th class="py-2.5 px-3">遥控名称</th>
                    <th class="py-2.5 px-3">支持控制选项</th>
                    <th class="py-2.5 px-3">关联下发遥信</th>
                    <th class="py-2.5 px-3">数据键名</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60">
                  <tr
                    v-for="yk in currentDevice.teleControls"
                    :key="yk.pointId"
                    class="hover:bg-amber-950/10 transition-colors"
                  >
                    <td class="py-2.5 px-3 font-bold text-amber-400">#{{ yk.pointId }}</td>
                    <td class="py-2.5 px-3 text-slate-200 font-semibold">{{ yk.name }}</td>
                    <td class="py-2.5 px-3">
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="opt in yk.options"
                          :key="opt.value"
                          class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#09142b] border border-cyan-500/30 text-cyan-300"
                        >
                          {{ opt.label }}
                        </span>
                      </div>
                    </td>
                    <td class="py-2.5 px-3 text-slate-300">
                      {{ yk.targetPointId !== undefined ? `#${yk.targetPointId} 遥信` : '无关联' }}
                    </td>
                    <td class="py-2.5 px-3 text-slate-400 text-[11px] font-mono">{{ currentDevice.deviceId }}_YK_{{ yk.pointId }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- TAB 5: 遥调点表 (YT) -->
          <div v-else-if="activeCategoryTab === 'yt'" class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <div class="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between text-xs">
              <div class="flex items-center gap-2 text-cyan-300 font-semibold">
                <Sliders class="w-4 h-4 text-cyan-400" />
                <span>遥调配置点表 (仅作点位定义与状态展示，实际定值调节在主界面右击设备或工控按钮中下发)</span>
              </div>
              <span class="text-[10px] text-slate-400 font-mono">共 {{ currentDevice.teleRegulations?.length || 0 }} 个遥调点</span>
            </div>

            <div class="bg-[#050a16] border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <table class="w-full text-left text-xs font-mono">
                <thead class="bg-[#091122] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th class="py-2.5 px-3">遥调点号</th>
                    <th class="py-2.5 px-3">遥调定值名称</th>
                    <th class="py-2.5 px-3">当前设定值</th>
                    <th class="py-2.5 px-3">调节范围</th>
                    <th class="py-2.5 px-3">步长</th>
                    <th class="py-2.5 px-3">单位</th>
                    <th class="py-2.5 px-3">数据键名</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60">
                  <tr
                    v-for="yt in currentDevice.teleRegulations"
                    :key="yt.pointId"
                    class="hover:bg-cyan-950/10 transition-colors"
                  >
                    <td class="py-2.5 px-3 font-bold text-cyan-400">#{{ yt.pointId }}</td>
                    <td class="py-2.5 px-3 text-slate-200 font-semibold">{{ yt.name }}</td>
                    <td class="py-2.5 px-3 font-bold text-cyan-300 text-sm">{{ yt.value }}</td>
                    <td class="py-2.5 px-3 text-slate-300">{{ yt.min }} ~ {{ yt.max }}</td>
                    <td class="py-2.5 px-3 text-slate-400">{{ yt.step }}</td>
                    <td class="py-2.5 px-3 text-cyan-400">{{ yt.unit }}</td>
                    <td class="py-2.5 px-3 text-slate-400 text-[11px] font-mono">{{ currentDevice.deviceId }}_YT_{{ yt.pointId }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- TAB 6: C++ 通信架构与协议设计 -->
          <div v-else-if="activeCategoryTab === 'cpp-sync'" class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <!-- Connection Settings Card -->
            <div class="p-4 rounded-xl bg-[#091224] border border-cyan-500/30 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Server class="w-4 h-4 text-emerald-400" />
                  <span class="text-xs font-bold text-slate-100">C++ 后端程序 A 工业通信网关配置</span>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    @click="handleTestProgramAConnection"
                    :disabled="isTestingConn"
                    class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Wifi class="w-3.5 h-3.5" :class="{ 'animate-pulse': isTestingConn }" />
                    <span>{{ isTestingConn ? '测试中...' : '测试连通性' }}</span>
                  </button>
                  <button
                    @click="handleSyncFromProgramA"
                    :disabled="isSyncingProgramA"
                    class="px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isSyncingProgramA }" />
                    <span>立即请求点表同步</span>
                  </button>
                </div>
              </div>

              <!-- Connection Inputs -->
              <div class="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <label class="text-slate-400 block mb-1">HTTP REST 服务地址 (GET /api/scada/devices)</label>
                  <input
                    v-model="programAConfig.httpUrl"
                    class="w-full bg-[#050a16] border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 outline-hidden focus:border-cyan-400"
                    placeholder="http://127.0.0.1:8088"
                  />
                </div>
                <div>
                  <label class="text-slate-400 block mb-1">WebSocket 实时推送地址 (推流与告警)</label>
                  <input
                    v-model="programAConfig.wsUrl"
                    class="w-full bg-[#050a16] border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 outline-hidden focus:border-cyan-400"
                    placeholder="ws://127.0.0.1:8088/ws"
                  />
                </div>
              </div>

              <!-- Connection Test Result Banner -->
              <div
                v-if="connTestStatus"
                class="p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 border"
                :class="connTestStatus.success ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200' : 'bg-amber-950/60 border-amber-500 text-amber-200'"
              >
                <component :is="connTestStatus.success ? ShieldCheck : AlertCircle" class="w-4 h-4 shrink-0" />
                <div class="flex-1">
                  <span>{{ connTestStatus.message }}</span>
                  <span v-if="connTestStatus.latency" class="ml-2 opacity-75">(往返延时: {{ connTestStatus.latency }}ms)</span>
                </div>
              </div>
            </div>

            <!-- Architecture Blueprint (5大场景协议规范) -->
            <div class="grid grid-cols-3 gap-3 text-xs">
              <!-- 1. 装置与点表同步 -->
              <div class="p-3 rounded-xl bg-[#081020] border border-slate-800 space-y-1.5">
                <div class="flex items-center gap-1.5 text-cyan-300 font-bold">
                  <Database class="w-3.5 h-3.5 text-cyan-400" />
                  <span>1. 装置点表同步</span>
                </div>
                <p class="text-[11px] text-slate-400 leading-relaxed">
                  前端发起 <code class="text-cyan-300">GET /api/scada/devices</code> 请求，程序 A 返回装置列表与 YC/YX/DD/YK/YT 点表，成功后自动落盘至 <code class="text-emerald-300">data/*.json</code>。
                </p>
              </div>

              <!-- 2. 实时测控推流 -->
              <div class="p-3 rounded-xl bg-[#081020] border border-slate-800 space-y-1.5">
                <div class="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <Activity class="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. 实时测控推流</span>
                </div>
                <p class="text-[11px] text-slate-400 leading-relaxed">
                  程序 A 通过 WebSocket 推送 <code class="text-emerald-300">{"type": "telemetry", "data": ...}</code>，前端以毫秒级响应更新大屏绑定组件。
                </p>
              </div>

              <!-- 3. 动态告警日志 -->
              <div class="p-3 rounded-xl bg-[#081020] border border-slate-800 space-y-1.5">
                <div class="flex items-center gap-1.5 text-amber-300 font-bold">
                  <BellRing class="w-3.5 h-3.5 text-amber-400" />
                  <span>3. 动态告警日志</span>
                </div>
                <p class="text-[11px] text-slate-400 leading-relaxed">
                  程序 A 实时上报 <code class="text-amber-300">{"type": "alarm", "data": ...}</code> 与 SOE 变位，驱动 SCADA 告警闪烁、事件流水表与语音播报。
                </p>
              </div>

              <!-- 4. 历史时序查询 -->
              <div class="p-3 rounded-xl bg-[#081020] border border-slate-800 space-y-1.5">
                <div class="flex items-center gap-1.5 text-purple-300 font-bold">
                  <History class="w-3.5 h-3.5 text-purple-400" />
                  <span>4. 历史曲线检索</span>
                </div>
                <p class="text-[11px] text-slate-400 leading-relaxed">
                  图表组件调用 <code class="text-purple-300">GET /api/scada/history</code> 查询时序曲线，程序 A 高效返回时间序列与品质因数。
                </p>
              </div>

              <!-- 5. 遥控闭环下发 -->
              <div class="p-3 rounded-xl bg-[#081020] border border-slate-800 space-y-1.5">
                <div class="flex items-center gap-1.5 text-rose-300 font-bold">
                  <Radio class="w-3.5 h-3.5 text-rose-400" />
                  <span>5. 遥控遥调下发</span>
                </div>
                <p class="text-[11px] text-slate-400 leading-relaxed">
                  前端点击控制按钮后，执行 <code class="text-rose-300">POST /api/scada/control</code>，程序 A 执行双确认下发并回传确认报文。
                </p>
              </div>

              <!-- 6. 离线缓存自愈 -->
              <div class="p-3 rounded-xl bg-[#081020] border border-slate-800 space-y-1.5">
                <div class="flex items-center gap-1.5 text-blue-300 font-bold">
                  <FolderOpen class="w-3.5 h-3.5 text-blue-400" />
                  <span>6. data 目录自愈</span>
                </div>
                <p class="text-[11px] text-slate-400 leading-relaxed">
                  每次同步均自动在 <code class="text-cyan-300">data/</code> 生成独立 JSON，即使程序 A 离线或重启，前端也能无缝从本地加载运行。
                </p>
              </div>
            </div>

            <!-- C++ Server Code Reference -->
            <div class="p-4 rounded-xl bg-[#050a14] border border-slate-800 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Terminal class="w-4 h-4 text-cyan-400" />
                  <span>C++ 程序 A 服务端范例源码 (基于 cpp-httplib & nlohmann::json)</span>
                </div>
                <button
                  @click="handleCopyCppCode"
                  class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Copy class="w-3.5 h-3.5" />
                  <span>{{ copiedCode ? '已复制！' : '复制 C++ 代码' }}</span>
                </button>
              </div>
              <pre class="bg-[#030712] p-3 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-72 custom-scrollbar leading-relaxed">{{ cppCodeSample }}</pre>
            </div>
          </div>

          <!-- TAB 7: JSON View -->
          <div v-else-if="activeCategoryTab === 'json'" class="flex-1 flex flex-col p-4">
            <div class="flex-1 flex flex-col bg-[#050a16] border border-slate-800 rounded-xl p-3">
              <textarea
                v-model="jsonString"
                class="flex-1 w-full bg-transparent text-cyan-300 font-mono text-xs outline-hidden resize-none custom-scrollbar"
                placeholder="请输入装置数组 JSON 数据..."
              />
              <div v-if="jsonError" class="text-red-400 text-xs font-mono pt-2 border-t border-red-500/30">
                {{ jsonError }}
              </div>
              <div class="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  @click="handleSaveJson"
                  class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <Check class="w-4 h-4" />
                  <span>保存并写入 data/ 目录</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.6);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(6, 182, 212, 0.4);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(6, 182, 212, 0.7);
}
</style>
