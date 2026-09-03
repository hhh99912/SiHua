<script setup lang="ts">
import { ref, computed } from 'vue';
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
  Sparkles
} from 'lucide-vue-next';
import { DatasetItem, ScadaDeviceItem, DeviceTelemetryPoint, DeviceTeleSignalPoint, DeviceEnergyPoint, DeviceTeleControlPoint, DeviceTeleRegulationPoint } from '../types';
import { syncFlatDataFromDevices, executeSimulatedTeleControl, executeSimulatedTeleRegulation } from '../data/presetDatasets';

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
const activeCategoryTab = ref<'yc' | 'yx' | 'dd' | 'yk' | 'yt' | 'json' | 'settings'>('yc');

const jsonString = ref('');
const jsonError = ref('');
const toastMessage = ref<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
  toastMessage.value = { text, type };
  setTimeout(() => {
    toastMessage.value = null;
  }, 3500);
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
const updateDataset = (updater: (ds: DatasetItem) => DatasetItem) => {
  const updated = (props.datasets || []).map(d => {
    if (d.id === (currentDataset.value?.id || d.id)) {
      return updater(d);
    }
    return d;
  });
  emit('update:datasets', updated);
};

// Streaming toggle
const toggleStreaming = () => {
  if (!currentDataset.value) return;
  updateDataset(ds => ({ ...ds, isStreaming: !ds.isStreaming }));
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
  showToast(`[状态修改] 遥信点 [${point.name}] 更新为状态枚举: ${point.value} (${point.statusText})`, 'info');
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
  showToast(`已成功添加新装置: ${newId}`, 'success');
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
    showToast('装置数据集 JSON 配置保存成功', 'success');
  } catch (err: any) {
    jsonError.value = 'JSON 解析格式错误: ' + err.message;
  }
};
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans"
  >
    <!-- Toast Notification -->
    <div
      v-if="toastMessage"
      class="fixed top-6 right-6 z-60 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border text-xs font-mono font-bold animate-bounce"
      :class="toastMessage.type === 'error' ? 'bg-red-950 border-red-500 text-red-200' : (toastMessage.type === 'info' ? 'bg-amber-950 border-amber-500 text-amber-200' : 'bg-emerald-950 border-emerald-500 text-emerald-200')"
    >
      <Sparkles class="w-4 h-4 text-cyan-400" />
      <span>{{ toastMessage.text }}</span>
    </div>

    <!-- Modal Box -->
    <div class="w-full max-w-6xl h-[86vh] bg-[#070d1c] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(0,242,255,0.15)] flex flex-col overflow-hidden">
      <!-- Modal Header -->
      <div class="px-5 py-3.5 border-b border-cyan-500/20 bg-[#040813] flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
            <Database class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>SCADA 装置级实时数据集管理器</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono">
                以装置号为初始单位架构
              </span>
            </h2>
            <p class="text-[11px] text-slate-400 font-mono">
              每个装置含装置号与装置名，下挂遥测(YC)、遥信(YX: 0/1/2)、电度(DD)、遥控(YK)与遥调(YT)
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Streaming Toggle Button -->
          <button
            @click="toggleStreaming"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold cursor-pointer transition-colors"
            :class="currentDataset?.isStreaming ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 hover:bg-emerald-900' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'"
          >
            <component :is="currentDataset?.isStreaming ? Pause : Play" class="w-3.5 h-3.5" />
            <span>{{ currentDataset?.isStreaming ? '模拟流推送中' : '模拟流已暂停' }}</span>
          </button>

          <!-- Close Button -->
          <button
            @click="emit('close')"
            class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X class="w-5 h-5" />
          </button>
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

        <!-- RIGHT: Device Details & Tele-points Inspector -->
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
                class="px-3 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                :class="activeCategoryTab === 'yc' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                <span>📟 遥测 (YC)</span>
                <span class="text-[10px] opacity-75">({{ currentDevice.telemetries?.length || 0 }})</span>
              </button>

              <button
                @click="activeCategoryTab = 'yx'"
                class="px-3 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                :class="activeCategoryTab === 'yx' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                <span>🚦 遥信 (YX)</span>
                <span class="text-[10px] opacity-75">({{ currentDevice.teleSignals?.length || 0 }})</span>
              </button>

              <button
                @click="activeCategoryTab = 'dd'"
                class="px-3 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                :class="activeCategoryTab === 'dd' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                <span>⚡ 电度 (DD)</span>
                <span class="text-[10px] opacity-75">({{ currentDevice.energies?.length || 0 }})</span>
              </button>

              <button
                @click="activeCategoryTab = 'yk'"
                class="px-3 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                :class="activeCategoryTab === 'yk' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                <span>🎮 遥控点表 (YK)</span>
                <span class="text-[10px] opacity-75">({{ currentDevice.teleControls?.length || 0 }})</span>
              </button>

              <button
                @click="activeCategoryTab = 'yt'"
                class="px-3 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                :class="activeCategoryTab === 'yt' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                <span>🎚️ 遥调点表 (YT)</span>
                <span class="text-[10px] opacity-75">({{ currentDevice.teleRegulations?.length || 0 }})</span>
              </button>

              <button
                @click="handleOpenJson"
                class="px-3 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
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

          <!-- TAB 4: 遥控点表 (YK - 仅展示点表定义，执行在主界面/右键菜单) -->
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
                    <th class="py-2.5 px-3">上次调度记录</th>
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
                    <td class="py-2.5 px-3 text-slate-400 text-[11px]">
                      {{ yk.lastExecutedTime ? `${yk.lastExecutedTime} (${yk.lastExecutedValue})` : '未执行' }}
                    </td>
                    <td class="py-2.5 px-3 text-slate-400 text-[11px] font-mono">{{ currentDevice.deviceId }}_YK_{{ yk.pointId }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- TAB 5: 遥调点表 (YT - 仅展示点表定义，执行在主界面/右键菜单) -->
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

          <!-- TAB 5: JSON View -->
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
                  <span>保存装置架构 JSON</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
