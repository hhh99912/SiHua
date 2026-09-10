<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  Database,
  X,
  Search,
  CheckCircle2,
  Cpu,
  Radio,
  Sliders,
  Activity,
  Zap,
  Layers,
  Unlink,
  Check,
  ShieldCheck,
  Building2,
  ChevronRight,
  Info
} from 'lucide-vue-next';
import {
  DatasetItem,
  ScadaDeviceItem,
  ScreenComponent
} from '../types';

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

// 级联临时选择状态 (不点击提交就不会实际生效)
const selectedStationId = ref<string>('');
const selectedDeviceId = ref<string>('');
const selectedCategory = ref<'yc' | 'yx' | 'dd' | 'yk' | 'yt'>('yc');
const selectedPointId = ref<number | string | null>(null);
const selectedPoint = ref<any>(null);
const selectedTargetVerificationId = ref<number | string | null>(null);
const searchQuery = ref<string>('');
const isUnboundPending = ref<boolean>(false);

// 当前选中的厂站 (Station / Dataset)
const currentStation = computed<DatasetItem | undefined>(() => {
  return props.datasets.find(d => d.id === selectedStationId.value) || props.datasets[0];
});

// 当前厂站下的受控装置列表 (Devices)
const currentDevices = computed<ScadaDeviceItem[]>(() => {
  const ds = currentStation.value;
  if (!ds) return [];
  if (Array.isArray(ds.devices) && ds.devices.length > 0) {
    return ds.devices;
  }
  if (ds.data && Array.isArray((ds.data as any).devices)) {
    return (ds.data as any).devices;
  }
  return [];
});

// 当前选中的受控装置 (Device)
const currentDevice = computed<ScadaDeviceItem | undefined>(() => {
  return currentDevices.value.find(d => d.deviceId === selectedDeviceId.value) || currentDevices.value[0];
});

// 五遥分类定义与测点统计
const categoryStats = computed(() => {
  const dev = currentDevice.value;
  if (!dev) {
    return { yc: 0, yx: 0, dd: 0, yk: 0, yt: 0 };
  }
  return {
    yc: dev.telemetries?.length || 0,
    yx: dev.teleSignals?.length || 0,
    dd: dev.energies?.length || 0,
    yk: dev.teleControls?.length || 0,
    yt: dev.teleRegulations?.length || 0
  };
});

// 当前装置和分类下的测点点表
const pointsList = computed(() => {
  const dev = currentDevice.value;
  if (!dev) return [];
  let list: any[] = [];
  if (selectedCategory.value === 'yc') {
    list = dev.telemetries || [];
  } else if (selectedCategory.value === 'yx') {
    list = dev.teleSignals || [];
  } else if (selectedCategory.value === 'dd') {
    list = dev.energies || [];
  } else if (selectedCategory.value === 'yk') {
    list = dev.teleControls || [];
  } else if (selectedCategory.value === 'yt') {
    list = dev.teleRegulations || [];
  }
  return list;
});

// 搜索过滤后的测点列表
const filteredPoints = computed(() => {
  const list = pointsList.value;
  if (!searchQuery.value.trim()) return list;
  const q = searchQuery.value.toLowerCase().trim();
  return list.filter(item =>
    String(item.pointId).toLowerCase().includes(q) ||
    (item.name && item.name.toLowerCase().includes(q)) ||
    (item.unit && item.unit.toLowerCase().includes(q)) ||
    (item.description && item.description.toLowerCase().includes(q)) ||
    (item.statusText && item.statusText.toLowerCase().includes(q))
  );
});

// 针对遥控遥调的校验点列表
const availableVerificationPoints = computed(() => {
  const dev = currentDevice.value;
  if (!dev) return [];
  if (selectedCategory.value === 'yk') {
    return dev.teleSignals || [];
  }
  if (selectedCategory.value === 'yt') {
    return dev.telemetries || [];
  }
  return [];
});

// 自动定位级联的选中状态 (若关联点不在数据集中，按未绑定处理)
const initializeCascadingSelection = () => {
  searchQuery.value = '';
  isUnboundPending.value = false;

  const comp = props.component;
  if (!comp || !comp.data) {
    applyDefaultUnbound();
    return;
  }

  const mapping = comp.data.mapping || {};
  const action = comp.data.action;
  const bindings = comp.data.bindings || {};

  let targetStationId = comp.data.datasetId || props.datasets[0]?.id || '';
  let targetDevId = mapping.deviceId || (action?.type === 'tele-control' || action?.type === 'tele-regulation' ? action?.deviceId : undefined);
  let rawKey = mapping.valueKey || mapping.stateKey || mapping.statusKey || bindings.value || bindings.state || '';

  if (!targetDevId && rawKey) {
    const match = String(rawKey).match(/^([A-Za-z0-9_-]+)_(YC|YX|DD|YK|YT)_/i);
    if (match) targetDevId = match[1];
  }

  // 识别五遥分类
  let targetCat: 'yc' | 'yx' | 'dd' | 'yk' | 'yt' = 'yc';
  if (mapping.pointCategory === 'teleControl' || action?.type === 'tele-control' || mapping.ykPointId || String(rawKey).includes('_YK_')) {
    targetCat = 'yk';
  } else if (mapping.pointCategory === 'teleRegulation' || action?.type === 'tele-regulation' || mapping.ytPointId || String(rawKey).includes('_YT_')) {
    targetCat = 'yt';
  } else if (mapping.pointCategory === 'teleSignal' || String(rawKey).includes('_YX_') || mapping.stateKey) {
    targetCat = 'yx';
  } else if (mapping.pointCategory === 'energy' || String(rawKey).includes('_DD_')) {
    targetCat = 'dd';
  } else if (mapping.pointCategory === 'telemetry' || String(rawKey).includes('_YC_') || mapping.valueKey) {
    targetCat = 'yc';
  }

  let targetPointId: any = undefined;
  if (targetCat === 'yk') {
    targetPointId = mapping.ykPointId || action?.pointId || mapping.pointId;
  } else if (targetCat === 'yt') {
    targetPointId = mapping.ytPointId || action?.pointId || mapping.pointId;
  } else {
    targetPointId = mapping.pointId;
  }
  if (targetPointId === undefined && rawKey) {
    const m = String(rawKey).match(/_(?:YC|YX|DD|YK|YT)_(\d+)/i);
    if (m) targetPointId = Number(m[1]);
  }

  // 校验该测点是否存在于当前数据集
  let matchedDs = props.datasets.find(d => d.id === targetStationId) || props.datasets[0];
  let matchedDev: ScadaDeviceItem | undefined = undefined;
  let matchedPoint: any = undefined;

  if (matchedDs && targetDevId) {
    const devs = (Array.isArray(matchedDs.devices) ? matchedDs.devices : (matchedDs.data as any)?.devices) || [];
    matchedDev = devs.find((d: any) => d.deviceId === targetDevId);
  }

  if (matchedDev && targetPointId !== undefined && targetPointId !== null) {
    let list: any[] = [];
    if (targetCat === 'yc') list = matchedDev.telemetries || [];
    else if (targetCat === 'yx') list = matchedDev.teleSignals || [];
    else if (targetCat === 'dd') list = matchedDev.energies || [];
    else if (targetCat === 'yk') list = matchedDev.teleControls || [];
    else if (targetCat === 'yt') list = matchedDev.teleRegulations || [];

    matchedPoint = list.find((p: any) => String(p.pointId) === String(targetPointId));
  }

  if (matchedDs && matchedDev && matchedPoint) {
    // 成功定位到有效测点
    selectedStationId.value = matchedDs.id;
    selectedDeviceId.value = matchedDev.deviceId;
    selectedCategory.value = targetCat;
    selectedPointId.value = matchedPoint.pointId;
    selectedPoint.value = matchedPoint;
    selectedTargetVerificationId.value = action?.targetPointId || mapping.targetYxPointId || mapping.targetYcPointId || null;
    isUnboundPending.value = false;

    // 自动滚动到对应行
    nextTick(() => {
      scrollToSelectedPoint(matchedPoint.pointId);
    });
  } else {
    // 关联点不在数据集中，按未绑定处理并智能定位默认列表
    applyDefaultUnbound();
  }
};

const applyDefaultUnbound = () => {
  const firstDs = props.datasets[0];
  selectedStationId.value = firstDs?.id || '';
  
  const devs = (firstDs && Array.isArray(firstDs.devices) ? firstDs.devices : (firstDs?.data as any)?.devices) || [];
  selectedDeviceId.value = devs[0]?.deviceId || '';
  
  // 依据组件特征提供友好的默认分类
  const comp = props.component;
  if (comp) {
    const t = comp.type;
    if (['elec-breaker', 'elec-disconnector', 'elec-grounding', 'elec-handcart', 'ctrl-indicator'].includes(t) || comp.category === 'status') {
      selectedCategory.value = 'yx';
    } else if (t === 'ctrl-button') {
      selectedCategory.value = 'yk';
    } else {
      selectedCategory.value = 'yc';
    }
  } else {
    selectedCategory.value = 'yc';
  }

  selectedPointId.value = null;
  selectedPoint.value = null;
  selectedTargetVerificationId.value = null;
  isUnboundPending.value = false;
};

// 监听弹框显示状态，每次打开时重新初始化并定位
watch(
  () => props.visible,
  (val) => {
    if (val) {
      initializeCascadingSelection();
    }
  },
  { immediate: true }
);

// 选择厂站时，自动保持或重置装置
const handleSelectStation = (stationId: string) => {
  selectedStationId.value = stationId;
  const devs = currentDevices.value;
  if (!devs.some(d => d.deviceId === selectedDeviceId.value)) {
    selectedDeviceId.value = devs[0]?.deviceId || '';
  }
  // 清除点选或检查是否保留
  checkPointValidityAfterSwitch();
};

// 选择装置时
const handleSelectDevice = (deviceId: string) => {
  selectedDeviceId.value = deviceId;
  checkPointValidityAfterSwitch();
};

// 选择五遥分类时
const handleSelectCategory = (cat: 'yc' | 'yx' | 'dd' | 'yk' | 'yt') => {
  selectedCategory.value = cat;
  searchQuery.value = '';
  checkPointValidityAfterSwitch();
};

const checkPointValidityAfterSwitch = () => {
  if (selectedPointId.value !== null) {
    const exists = pointsList.value.some(p => String(p.pointId) === String(selectedPointId.value));
    if (!exists) {
      selectedPointId.value = null;
      selectedPoint.value = null;
    }
  }
};

// 选择测点
const handleSelectPointRow = (pt: any) => {
  isUnboundPending.value = false;
  if (String(selectedPointId.value) === String(pt.pointId)) {
    // 再次点击已选中的点不做变动，保持高亮
    return;
  }
  selectedPointId.value = pt.pointId;
  selectedPoint.value = pt;

  // 如果是遥控，自动带入默认校验遥信
  if (selectedCategory.value === 'yk') {
    selectedTargetVerificationId.value = pt.targetPointId || currentDevice.value?.teleSignals?.[0]?.pointId || 1;
  } else if (selectedCategory.value === 'yt') {
    selectedTargetVerificationId.value = pt.targetYcPointId || currentDevice.value?.telemetries?.[0]?.pointId || 1;
  }
};

// 滚动定位点表行
const scrollToSelectedPoint = (pointId: number | string) => {
  const el = document.getElementById(`cascade-point-row-${pointId}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

// 点击解绑按钮
const handleMarkUnbound = () => {
  selectedPointId.value = null;
  selectedPoint.value = null;
  selectedTargetVerificationId.value = null;
  isUnboundPending.value = true;
};

// 提交生效
const handleSubmit = () => {
  if (!props.component) {
    emit('close');
    return;
  }

  if (isUnboundPending.value || selectedPointId.value === null || !selectedPoint.value) {
    // 提交解绑
    emit('submit', {
      componentId: props.component.id,
      unbind: true
    });
  } else {
    // 提交测点关联生效
    emit('submit', {
      componentId: props.component.id,
      unbind: false,
      datasetId: currentStation.value?.id || selectedStationId.value,
      deviceId: currentDevice.value?.deviceId || selectedDeviceId.value,
      deviceName: currentDevice.value?.deviceName,
      category: selectedCategory.value,
      point: selectedPoint.value,
      targetVerificationPointId: selectedTargetVerificationId.value || undefined
    });
  }
  emit('close');
};

const handleCancel = () => {
  emit('close');
};
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none font-sans"
    @click.self="handleCancel"
  >
    <div
      class="relative w-full max-w-5xl h-[680px] max-h-[92vh] bg-[#0c1d37] border border-cyan-400/60 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(0,242,255,0.2)] flex flex-col overflow-hidden text-cyan-100 animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-cyan-500/30 bg-[#10274a] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(0,242,255,0.3)]">
            <Database class="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div class="flex items-center gap-2.5">
              <h2 class="text-base font-medium text-cyan-100 tracking-wide">SCADA 测点数据级联关联配置</h2>
              <span
                v-if="component"
                class="px-2.5 py-0.5 rounded-full text-xs font-mono bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 shadow-xs"
              >
                目标图元: {{ component.name }}
              </span>
            </div>
            <p class="text-xs text-cyan-400/70 font-light mt-0.5">
              依次级联选择「厂站 ➔ 装置 ➔ 五遥 ➔ 测点」，选完点击提交即刻生效
            </p>
          </div>
        </div>

        <button
          @click="handleCancel"
          class="p-1.5 rounded-lg bg-[#183a69] hover:bg-rose-500/30 text-cyan-300 hover:text-rose-200 border border-cyan-500/40 hover:border-rose-400/60 cursor-pointer transition-colors"
          title="取消并关闭"
        >
          <X class="w-4 h-4 stroke-[2]" />
        </button>
      </div>

      <!-- Cascading 4-Column Studio Layout -->
      <div class="flex-1 min-h-0 grid grid-cols-12 divide-x divide-cyan-500/25 bg-[#09152b] overflow-hidden">
        
        <!-- Column 1: 厂站 (Station / Dataset) - 3 Cols -->
        <div class="col-span-3 flex flex-col h-full bg-[#081326]/60 overflow-hidden">
          <div class="px-3.5 py-2.5 bg-[#0e213f] border-b border-cyan-500/30 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-1.5 text-xs font-medium text-cyan-200">
              <span class="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono font-bold">1</span>
              <Building2 class="w-3.5 h-3.5 text-cyan-400" />
              <span>选择厂站 / 数据集</span>
            </div>
            <span class="text-[11px] font-mono text-cyan-400/70">{{ datasets.length }} 个厂站</span>
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            <div
              v-for="ds in datasets"
              :key="ds.id"
              @click="handleSelectStation(ds.id)"
              class="p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between group"
              :class="selectedStationId === ds.id
                ? 'bg-cyan-950/70 border-cyan-400 text-cyan-100 shadow-[0_0_15px_rgba(0,242,255,0.25)] ring-1 ring-cyan-400'
                : 'bg-[#0d1f3b]/60 border-cyan-500/25 text-cyan-300/90 hover:border-cyan-400/60 hover:bg-[#12284b]'"
            >
              <div class="min-w-0 pr-2">
                <div class="font-medium truncate flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full" :class="selectedStationId === ds.id ? 'bg-cyan-400 shadow-[0_0_6px_#00f2ff]' : 'bg-slate-600'"></span>
                  <span class="truncate">{{ ds.name }}</span>
                </div>
                <div class="text-[10px] text-cyan-400/60 font-mono mt-1 flex items-center gap-2">
                  <span>包含 {{ (Array.isArray(ds.devices) ? ds.devices.length : (ds.data as any)?.devices?.length) || 0 }} 台装置</span>
                </div>
              </div>
              <ChevronRight class="w-4 h-4 text-cyan-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" :class="{ 'opacity-100': selectedStationId === ds.id }" />
            </div>
          </div>
        </div>

        <!-- Column 2: 受控装置 (Device) - 3 Cols -->
        <div class="col-span-3 flex flex-col h-full bg-[#081326]/40 overflow-hidden">
          <div class="px-3.5 py-2.5 bg-[#0e213f] border-b border-cyan-500/30 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-1.5 text-xs font-medium text-cyan-200">
              <span class="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono font-bold">2</span>
              <Cpu class="w-3.5 h-3.5 text-cyan-400" />
              <span>选择受控装置</span>
            </div>
            <span class="text-[11px] font-mono text-cyan-400/70">{{ currentDevices.length }} 台</span>
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            <div
              v-for="dev in currentDevices"
              :key="dev.deviceId"
              @click="handleSelectDevice(dev.deviceId)"
              class="p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between group"
              :class="selectedDeviceId === dev.deviceId
                ? 'bg-cyan-950/70 border-cyan-400 text-cyan-100 shadow-[0_0_15px_rgba(0,242,255,0.25)] ring-1 ring-cyan-400'
                : 'bg-[#0d1f3b]/60 border-cyan-500/25 text-cyan-300/90 hover:border-cyan-400/60 hover:bg-[#12284b]'"
            >
              <div class="min-w-0 pr-2">
                <div class="font-medium truncate flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full" :class="selectedDeviceId === dev.deviceId ? 'bg-cyan-400 shadow-[0_0_6px_#00f2ff]' : 'bg-slate-600'"></span>
                  <span class="truncate">{{ dev.deviceName }}</span>
                </div>
                <div class="text-[10px] text-cyan-400/60 font-mono mt-1 flex items-center gap-2">
                  <span class="px-1 rounded bg-[#061021] border border-cyan-500/30 text-cyan-300">[{{ dev.deviceId }}]</span>
                  <span>{{ dev.deviceType || '测控保护' }}</span>
                </div>
              </div>
              <ChevronRight class="w-4 h-4 text-cyan-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" :class="{ 'opacity-100': selectedDeviceId === dev.deviceId }" />
            </div>

            <div v-if="currentDevices.length === 0" class="p-6 text-center text-xs text-cyan-400/60">
              当前厂站下无装置
            </div>
          </div>
        </div>

        <!-- Column 3: 五遥分类 (Five Remotes Category) - 2 Cols -->
        <div class="col-span-2 flex flex-col h-full bg-[#081326]/20 overflow-hidden">
          <div class="px-3 py-2.5 bg-[#0e213f] border-b border-cyan-500/30 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-1.5 text-xs font-medium text-cyan-200">
              <span class="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono font-bold">3</span>
              <Activity class="w-3.5 h-3.5 text-cyan-400" />
              <span>五遥分类</span>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            <!-- 遥测 YC -->
            <button
              type="button"
              @click="handleSelectCategory('yc')"
              class="w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1"
              :class="selectedCategory === 'yc'
                ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400 shadow-[0_0_12px_rgba(0,242,255,0.4)]'
                : 'bg-[#0d1f3b]/60 border-cyan-500/30 text-cyan-300 hover:border-cyan-400 hover:bg-[#12284b]'"
            >
              <div class="flex items-center justify-between w-full">
                <span class="font-bold text-xs">遥测 YC</span>
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded" :class="selectedCategory === 'yc' ? 'bg-slate-950/30 text-slate-950 font-bold' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'">
                  {{ categoryStats.yc }}
                </span>
              </div>
              <span class="text-[10px] opacity-80">模拟量 (电压/电流/功率)</span>
            </button>

            <!-- 遥信 YX -->
            <button
              type="button"
              @click="handleSelectCategory('yx')"
              class="w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1"
              :class="selectedCategory === 'yx'
                ? 'bg-emerald-500 text-slate-950 font-medium border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'bg-[#0d1f3b]/60 border-emerald-500/30 text-emerald-300 hover:border-emerald-400 hover:bg-[#12284b]'"
            >
              <div class="flex items-center justify-between w-full">
                <span class="font-bold text-xs">遥信 YX</span>
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded" :class="selectedCategory === 'yx' ? 'bg-slate-950/30 text-slate-950 font-bold' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'">
                  {{ categoryStats.yx }}
                </span>
              </div>
              <span class="text-[10px] opacity-80">状态量 (开关分合/告警)</span>
            </button>

            <!-- 遥控 YK -->
            <button
              type="button"
              @click="handleSelectCategory('yk')"
              class="w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1"
              :class="selectedCategory === 'yk'
                ? 'bg-purple-500 text-white font-medium border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                : 'bg-[#0d1f3b]/60 border-purple-500/30 text-purple-300 hover:border-purple-400 hover:bg-[#12284b]'"
            >
              <div class="flex items-center justify-between w-full">
                <span class="font-bold text-xs">遥控 YK</span>
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded" :class="selectedCategory === 'yk' ? 'bg-purple-950 text-purple-200 font-bold' : 'bg-purple-950 text-purple-300 border border-purple-500/40'">
                  {{ categoryStats.yk }}
                </span>
              </div>
              <span class="text-[10px] opacity-80">控制输出 (分合闸指令)</span>
            </button>

            <!-- 遥调 YT -->
            <button
              type="button"
              @click="handleSelectCategory('yt')"
              class="w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1"
              :class="selectedCategory === 'yt'
                ? 'bg-blue-500 text-white font-medium border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                : 'bg-[#0d1f3b]/60 border-blue-500/30 text-blue-300 hover:border-blue-400 hover:bg-[#12284b]'"
            >
              <div class="flex items-center justify-between w-full">
                <span class="font-bold text-xs">遥调 YT</span>
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded" :class="selectedCategory === 'yt' ? 'bg-blue-950 text-blue-200 font-bold' : 'bg-blue-950 text-blue-300 border border-blue-500/40'">
                  {{ categoryStats.yt }}
                </span>
              </div>
              <span class="text-[10px] opacity-80">定值输出 (档位/设定)</span>
            </button>

            <!-- 电度 DD -->
            <button
              type="button"
              @click="handleSelectCategory('dd')"
              class="w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1"
              :class="selectedCategory === 'dd'
                ? 'bg-amber-500 text-slate-950 font-medium border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'bg-[#0d1f3b]/60 border-amber-500/30 text-amber-300 hover:border-amber-400 hover:bg-[#12284b]'"
            >
              <div class="flex items-center justify-between w-full">
                <span class="font-bold text-xs">电度 DD</span>
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded" :class="selectedCategory === 'dd' ? 'bg-slate-950/30 text-slate-950 font-bold' : 'bg-amber-950 text-amber-300 border border-amber-500/40'">
                  {{ categoryStats.dd }}
                </span>
              </div>
              <span class="text-[10px] opacity-80">电能量 (kWh / 累计量)</span>
            </button>
          </div>
        </div>

        <!-- Column 4: 测点点表 (Points Table) - 4 Cols -->
        <div class="col-span-4 flex flex-col h-full bg-[#081326]/10 overflow-hidden">
          <div class="px-3.5 py-2.5 bg-[#0e213f] border-b border-cyan-500/30 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-1.5 text-xs font-medium text-cyan-200">
              <span class="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono font-bold">4</span>
              <Sliders class="w-3.5 h-3.5 text-cyan-400" />
              <span>选择目标测点 (点击选择)</span>
            </div>
            <span class="text-[11px] font-mono text-cyan-400/70">共 {{ filteredPoints.length }} 点</span>
          </div>

          <!-- Search Input -->
          <div class="p-2 border-b border-cyan-500/20 bg-[#071120]">
            <div class="relative">
              <Search class="w-3.5 h-3.5 text-cyan-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                v-model="searchQuery"
                placeholder="按点号、点名或规约标识快速过滤..."
                class="w-full bg-[#0d1f3b] border border-cyan-500/30 focus:border-cyan-400 rounded-lg pl-8 pr-3 py-1.5 text-xs text-cyan-100 placeholder-cyan-500/50 outline-hidden font-light"
              />
            </div>
          </div>

          <!-- Points Scroll List -->
          <div class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            <div
              v-for="pt in filteredPoints"
              :key="pt.pointId"
              :id="`cascade-point-row-${pt.pointId}`"
              @click="handleSelectPointRow(pt)"
              class="p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between group font-light"
              :class="[
                !isUnboundPending && String(selectedPointId) === String(pt.pointId)
                  ? 'border-cyan-400 bg-cyan-950/80 shadow-[0_0_15px_rgba(0,242,255,0.3)] ring-1 ring-cyan-400 text-cyan-100'
                  : 'border-cyan-500/25 bg-[#0d1f3b]/60 text-cyan-300 hover:border-cyan-400/60 hover:bg-[#12284b]'
              ]"
            >
              <div class="min-w-0 pr-2">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-cyan-400 text-xs font-medium">#{{ pt.pointId }}</span>
                  <span class="font-medium text-cyan-100 truncate group-hover:text-cyan-200">{{ pt.name }}</span>
                </div>
                <div class="text-[10px] text-cyan-400/60 font-mono mt-1 truncate">
                  {{ currentDevice?.deviceId }}_{{ selectedCategory.toUpperCase() }}_{{ pt.pointId }}
                </div>
              </div>

              <div class="text-right shrink-0 flex items-center gap-2">
                <!-- Values for YC / DD -->
                <div v-if="selectedCategory === 'yc' || selectedCategory === 'dd'" class="text-right">
                  <span class="font-mono text-emerald-400 font-medium text-xs">{{ pt.value }}</span>
                  <span class="text-[10px] text-cyan-300 ml-1">{{ pt.unit || '' }}</span>
                </div>

                <!-- Values for YX -->
                <div v-else-if="selectedCategory === 'yx'" class="text-right">
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                    :class="pt.value === 1 ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' : 'bg-[#050c1c] text-cyan-400 border-cyan-500/30'"
                  >
                    {{ pt.value }} ({{ pt.statusText || (pt.value === 1 ? '合闸' : '分闸') }})
                  </span>
                </div>

                <!-- Values for YK / YT -->
                <div v-else-if="selectedCategory === 'yk' || selectedCategory === 'yt'" class="text-right">
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950/80 text-purple-300 border border-purple-500/40">
                    {{ selectedCategory === 'yk' ? '控制通道' : '调节定值' }}
                  </span>
                </div>

                <!-- Selected Tick -->
                <div
                  v-if="!isUnboundPending && String(selectedPointId) === String(pt.pointId)"
                  class="w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 shadow-[0_0_8px_#00f2ff]"
                >
                  <Check class="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>
            </div>

            <div v-if="filteredPoints.length === 0" class="p-8 text-center text-xs text-cyan-400/60 font-light">
              未找到符合条件的测点
            </div>
          </div>

          <!-- Closed-Loop Verification for YK / YT -->
          <div
            v-if="selectedCategory === 'yk' || selectedCategory === 'yt'"
            class="p-2.5 border-t border-purple-500/40 bg-purple-950/30 space-y-1.5 shrink-0"
          >
            <div class="flex items-center justify-between text-[11px] text-purple-300 font-medium">
              <span class="flex items-center gap-1">
                <ShieldCheck class="w-3.5 h-3.5 text-purple-400" />
                <span>{{ selectedCategory === 'yk' ? '校验遥信 (YX 反馈状态)' : '校验遥测 (YC 实测值)' }}</span>
              </span>
            </div>
            <select
              v-model="selectedTargetVerificationId"
              class="w-full bg-[#050c1c] border border-purple-500/40 rounded-lg px-2 py-1 text-purple-200 text-xs font-mono outline-hidden cursor-pointer"
            >
              <option v-for="vp in availableVerificationPoints" :key="vp.pointId" :value="vp.pointId">
                [#{{ vp.pointId }}] {{ vp.name }} (实时: {{ vp.value }} {{ vp.unit || '' }})
              </option>
            </select>
          </div>
        </div>

      </div>

      <!-- Modal Footer Action Bar -->
      <div class="px-6 py-3.5 border-t border-cyan-500/30 bg-[#10274a] flex items-center justify-between shrink-0">
        <!-- Left status summary / unbind action -->
        <div class="flex items-center gap-3">
          <button
            type="button"
            @click="handleMarkUnbound"
            class="px-3 py-1.5 rounded-lg border text-xs font-light cursor-pointer transition-all flex items-center gap-1.5"
            :class="isUnboundPending
              ? 'bg-rose-500 text-slate-950 font-medium border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
              : 'bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border-rose-500/40'"
          >
            <Unlink class="w-3.5 h-3.5" />
            <span>{{ isUnboundPending ? '已标记为解绑 (点击确定生效)' : '解除测点关联 (清空绑定)' }}</span>
          </button>

          <span v-if="!isUnboundPending && selectedPoint" class="text-xs text-cyan-300/80 font-mono hidden sm:inline-block">
            待关联: {{ currentStation?.name }} ➔ {{ currentDevice?.deviceName }} ➔ {{ selectedPoint.name }} (#{{ selectedPoint.pointId }})
          </span>
        </div>

        <!-- Right Confirm / Cancel buttons -->
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            @click="handleCancel"
            class="px-4 py-2 rounded-xl bg-[#142c52] hover:bg-[#1a3869] border border-cyan-500/40 text-cyan-300 hover:text-cyan-100 text-xs font-light cursor-pointer transition-colors"
          >
            取消
          </button>

          <button
            type="button"
            @click="handleSubmit"
            class="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-xs cursor-pointer shadow-[0_0_20px_rgba(0,242,255,0.4)] transition-all flex items-center gap-1.5 active:scale-95"
          >
            <CheckCircle2 class="w-4 h-4 stroke-[2.5]" />
            <span>确认关联并生效</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
