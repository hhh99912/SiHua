<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Database,
  X,
  Search,
  CheckSquare,
  Square,
  Zap,
  Activity,
  Radio,
  Sliders,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
  Cpu,
  Table,
  LayoutGrid,
  CheckCircle2,
  AlertTriangle,
  Play,
  Copy,
  Plus
} from 'lucide-vue-next';
import {
  DatasetItem,
  ScadaDeviceItem,
  DeviceTelemetryPoint,
  DeviceTeleSignalPoint,
  DeviceEnergyPoint,
  DeviceTeleControlPoint,
  DeviceTeleRegulationPoint,
  ScreenComponent
} from '../types';
import { syncFlatDataFromDevices } from '../data/presetDatasets';

interface Props {
  visible: boolean;
  datasets: DatasetItem[];
  selectedComponents?: ScreenComponent[];
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  selectedComponents: () => []
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:datasets', datasets: DatasetItem[]): void;
  (e: 'batch:generate', comps: ScreenComponent[]): void;
  (e: 'batch:bind', mappingList: Array<{ compId: string; point: any; category: string; deviceId: string }>): void;
  (e: 'open:control', deviceId: string, pointId?: number | string, type?: 'control' | 'regulation'): void;
}>();

const selectedDatasetId = ref<string>(props.datasets[0]?.id || '');
const selectedDeviceId = ref<string>('all');
const activeCategoryTab = ref<'all' | 'yc' | 'yx' | 'dd' | 'yk' | 'yt'>('all');
const searchQuery = ref<string>('');
const selectedPointKeys = ref<Set<string>>(new Set());

// Batch Generation Config
const showBatchGenDialog = ref(false);
const batchGenType = ref<'table-card' | 'metric-grid' | 'status-matrix' | 'control-panel' | 'multimeter'>('table-card');
const batchGenCols = ref(3);
const batchGenStartX = ref(80);
const batchGenStartY = ref(120);

// Toast notification
const toastMsg = ref<string | null>(null);
const showToast = (msg: string) => {
  toastMsg.value = msg;
  setTimeout(() => {
    toastMsg.value = null;
  }, 2500);
};

const currentDataset = computed<DatasetItem | undefined>(() => {
  return props.datasets.find(d => d.id === selectedDatasetId.value) || props.datasets[0];
});

const allDevices = computed<ScadaDeviceItem[]>(() => {
  return currentDataset.value?.devices || [];
});

// Flat point structure for table display & filtering
interface FlatScadaPoint {
  key: string;
  deviceId: string;
  deviceName: string;
  pointCategory: 'yc' | 'yx' | 'dd' | 'yk' | 'yt';
  pointCategoryLabel: string;
  pointId: number | string;
  name: string;
  value: any;
  unit: string;
  factor?: number;
  statusText?: string;
  targetPointId?: number | string; // For YK linked YX
  options?: Array<{ label: string; value: number }>;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  rawPoint: any;
}

const allFlatPoints = computed<FlatScadaPoint[]>(() => {
  const list: FlatScadaPoint[] = [];
  const devs = allDevices.value;

  devs.forEach(dev => {
    if (selectedDeviceId.value !== 'all' && dev.deviceId !== selectedDeviceId.value) {
      return;
    }

    // 1. 遥测 (YC)
    if (activeCategoryTab.value === 'all' || activeCategoryTab.value === 'yc') {
      dev.telemetries?.forEach(yc => {
        list.push({
          key: `${dev.deviceId}_YC_${yc.pointId}`,
          deviceId: dev.deviceId,
          deviceName: dev.deviceName,
          pointCategory: 'yc',
          pointCategoryLabel: '遥测 (YC)',
          pointId: yc.pointId,
          name: yc.name,
          value: yc.value,
          unit: yc.unit || '',
          factor: yc.factor ?? 1.0,
          description: yc.description,
          rawPoint: yc
        });
      });
    }

    // 2. 遥信 (YX)
    if (activeCategoryTab.value === 'all' || activeCategoryTab.value === 'yx') {
      dev.teleSignals?.forEach(yx => {
        list.push({
          key: `${dev.deviceId}_YX_${yx.pointId}`,
          deviceId: dev.deviceId,
          deviceName: dev.deviceName,
          pointCategory: 'yx',
          pointCategoryLabel: '遥信 (YX)',
          pointId: yx.pointId,
          name: yx.name,
          value: yx.value,
          unit: '',
          statusText: yx.statusText || (yx.value === 1 ? '合闸 (1)' : (yx.value === 0 ? '分闸 (0)' : '故障 (2)')),
          description: yx.description,
          rawPoint: yx
        });
      });
    }

    // 3. 电度 (DD)
    if (activeCategoryTab.value === 'all' || activeCategoryTab.value === 'dd') {
      dev.energies?.forEach(dd => {
        list.push({
          key: `${dev.deviceId}_DD_${dd.pointId}`,
          deviceId: dev.deviceId,
          deviceName: dev.deviceName,
          pointCategory: 'dd',
          pointCategoryLabel: '电度 (DD)',
          pointId: dd.pointId,
          name: dd.name,
          value: dd.value,
          unit: dd.unit || 'kWh',
          factor: dd.factor ?? 1.0,
          description: dd.description,
          rawPoint: dd
        });
      });
    }

    // 4. 遥控 (YK)
    if (activeCategoryTab.value === 'all' || activeCategoryTab.value === 'yk') {
      dev.teleControls?.forEach(yk => {
        list.push({
          key: `${dev.deviceId}_YK_${yk.pointId}`,
          deviceId: dev.deviceId,
          deviceName: dev.deviceName,
          pointCategory: 'yk',
          pointCategoryLabel: '遥控 (YK)',
          pointId: yk.pointId,
          name: yk.name,
          value: yk.lastExecutedValue ?? '--',
          unit: '',
          targetPointId: yk.targetPointId,
          options: yk.options,
          description: yk.description || `关联遥信点: YX_${yk.targetPointId ?? '无'}`,
          rawPoint: yk
        });
      });
    }

    // 5. 遥调 (YT)
    if (activeCategoryTab.value === 'all' || activeCategoryTab.value === 'yt') {
      dev.teleRegulations?.forEach(yt => {
        list.push({
          key: `${dev.deviceId}_YT_${yt.pointId}`,
          deviceId: dev.deviceId,
          deviceName: dev.deviceName,
          pointCategory: 'yt',
          pointCategoryLabel: '遥调 (YT)',
          pointId: yt.pointId,
          name: yt.name,
          value: yt.value,
          unit: yt.unit || '',
          min: yt.min,
          max: yt.max,
          step: yt.step,
          description: yt.description || `整定范围: [${yt.min}, ${yt.max}] 步长: ${yt.step}`,
          rawPoint: yt
        });
      });
    }
  });

  if (!searchQuery.value.trim()) return list;
  const q = searchQuery.value.toLowerCase().trim();
  return list.filter(p =>
    p.deviceId.toLowerCase().includes(q) ||
    p.deviceName.toLowerCase().includes(q) ||
    p.name.toLowerCase().includes(q) ||
    String(p.pointId).includes(q) ||
    (p.unit && p.unit.toLowerCase().includes(q)) ||
    (p.description && p.description.toLowerCase().includes(q))
  );
});

// Selection Helpers
const isAllSelected = computed(() => {
  if (!allFlatPoints.value.length) return false;
  return allFlatPoints.value.every(p => selectedPointKeys.value.has(p.key));
});

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedPointKeys.value.clear();
  } else {
    allFlatPoints.value.forEach(p => selectedPointKeys.value.add(p.key));
  }
};

const toggleSelectPoint = (key: string) => {
  if (selectedPointKeys.value.has(key)) {
    selectedPointKeys.value.delete(key);
  } else {
    selectedPointKeys.value.add(key);
  }
};

const clearSelection = () => {
  selectedPointKeys.value.clear();
};

// Selected Point Objects
const selectedPointsList = computed(() => {
  return allFlatPoints.value.filter(p => selectedPointKeys.value.has(p.key));
});

// Batch Link to Currently Selected Canvas Components
const handleBatchBindToSelectedCanvasWidgets = () => {
  const selectedPoints = selectedPointsList.value;
  if (!selectedPoints.length) {
    showToast('请先在表格中勾选要关联的 SCADA 测点');
    return;
  }
  if (!props.selectedComponents?.length) {
    showToast('当前画布上未选中任何图元，无法批量关联');
    return;
  }

  const mappingList: Array<{ compId: string; point: any; category: string; deviceId: string }> = [];
  props.selectedComponents.forEach((comp, idx) => {
    const pt = selectedPoints[idx % selectedPoints.length];
    mappingList.push({
      compId: comp.id,
      point: pt.rawPoint,
      category: pt.pointCategory,
      deviceId: pt.deviceId
    });
  });

  emit('batch:bind', mappingList);
  showToast(`已成功将 ${mappingList.length} 个测点批量绑定到画布图元！`);
};

// Batch Generate Visual Widgets on Screen
const handleExecuteBatchGenerate = () => {
  const pts = selectedPointsList.value.length > 0 ? selectedPointsList.value : allFlatPoints.value.slice(0, 8);
  if (!pts.length) {
    showToast('无可生成的测点数据');
    return;
  }

  const generatedComps: ScreenComponent[] = [];
  const datasetId = currentDataset.value?.id || 'ds-substation-scada';
  const startX = Number(batchGenStartX.value) || 80;
  const startY = Number(batchGenStartY.value) || 120;
  const cols = Math.max(1, Number(batchGenCols.value) || 3);

  if (batchGenType.value === 'table-card') {
    // Generate an all-in-one industrial metric parameter table card
    const cardW = 460;
    const rowH = 34;
    const cardH = 60 + pts.length * rowH;
    const nowId = `comp-table-${Date.now()}`;

    // Generate sub items or single table widget
    generatedComps.push({
      id: nowId,
      name: `SCADA 测控实时参数看板 (${pts.length} 项)`,
      type: 'draw-rect',
      category: 'basic',
      x: startX,
      y: startY,
      width: cardW,
      height: cardH,
      rotation: 0,
      zIndex: 10,
      style: {
        fill: 'rgba(6, 14, 28, 0.94)',
        stroke: '#00f2ff',
        strokeWidth: 1.5,
        borderRadius: 8,
        shadowColor: 'rgba(0, 242, 255, 0.25)',
        shadowBlur: 15
      },
      data: {
        datasetId,
        mapping: {
          deviceId: pts[0].deviceId
        }
      }
    });

    // Add Header Title
    generatedComps.push({
      id: `${nowId}-title`,
      name: '看板标题',
      type: 'draw-text',
      category: 'basic',
      x: startX + 16,
      y: startY + 14,
      width: cardW - 32,
      height: 28,
      rotation: 0,
      zIndex: 11,
      style: {
        text: `⚡ ${pts[0].deviceName} 实时测控数据`,
        textColor: '#00f2ff',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'left'
      },
      data: { mapping: {} }
    });

    // Add rows of metrics
    pts.forEach((p, idx) => {
      const rowY = startY + 48 + idx * rowH;
      // Label text
      generatedComps.push({
        id: `${nowId}-lbl-${idx}`,
        name: p.name,
        type: 'draw-text',
        category: 'basic',
        x: startX + 16,
        y: rowY + 4,
        width: 220,
        height: 24,
        rotation: 0,
        zIndex: 11,
        style: {
          text: `[${p.pointCategoryLabel.slice(0, 2)}] ${p.name}`,
          textColor: '#94a3b8',
          fontSize: 12,
          textAlign: 'left'
        },
        data: { mapping: {} }
      });

      // Live Value text
      generatedComps.push({
        id: `${nowId}-val-${idx}`,
        name: `${p.name}测值`,
        type: 'metric-float',
        category: 'metrics',
        x: startX + 240,
        y: rowY + 2,
        width: 190,
        height: 26,
        rotation: 0,
        zIndex: 11,
        style: {
          textColor: p.pointCategory === 'yx' ? (p.value === 1 ? '#ef4444' : '#10b981') : '#00f2ff',
          fontSize: 13,
          fontWeight: 'bold',
          suffix: p.unit ? ` ${p.unit}` : (p.statusText ? ` (${p.statusText})` : ''),
          textAlign: 'right'
        },
        data: {
          datasetId,
          mapping: {
            deviceId: p.deviceId,
            pointCategory: p.pointCategory === 'yc' ? 'telemetry' : (p.pointCategory === 'yx' ? 'teleSignal' : 'energy'),
            pointId: p.pointId,
            valueKey: p.key,
            stateKey: p.key
          }
        }
      });
    });
  } else if (batchGenType.value === 'metric-grid') {
    // Generate individual Metric Cards in a grid
    const itemW = 160;
    const itemH = 68;
    const gapX = 16;
    const gapY = 16;

    pts.forEach((p, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = startX + col * (itemW + gapX);
      const y = startY + row * (itemH + gapY);
      const cardId = `comp-card-${Date.now()}-${idx}`;

      // Card Background Box
      generatedComps.push({
        id: cardId,
        name: `${p.name}卡片底框`,
        type: 'draw-rect',
        category: 'basic',
        x,
        y,
        width: itemW,
        height: itemH,
        rotation: 0,
        zIndex: 10,
        style: {
          fill: 'rgba(7, 16, 32, 0.88)',
          stroke: '#00f2ff',
          strokeWidth: 1,
          borderRadius: 6,
          shadowColor: 'rgba(0, 242, 255, 0.2)',
          shadowBlur: 8
        },
        data: { mapping: {} }
      });

      // Name Label
      generatedComps.push({
        id: `${cardId}-lbl`,
        name: p.name,
        type: 'draw-text',
        category: 'basic',
        x: x + 8,
        y: y + 6,
        width: itemW - 16,
        height: 20,
        rotation: 0,
        zIndex: 11,
        style: {
          text: p.name,
          textColor: '#94a3b8',
          fontSize: 11,
          textAlign: 'left'
        },
        data: { mapping: {} }
      });

      // Dynamic Float Metric
      generatedComps.push({
        id: `${cardId}-val`,
        name: `${p.name}测值`,
        type: 'metric-float',
        category: 'metrics',
        x: x + 8,
        y: y + 28,
        width: itemW - 16,
        height: 32,
        rotation: 0,
        zIndex: 11,
        style: {
          textColor: '#00f2ff',
          fontSize: 16,
          fontWeight: 'bold',
          suffix: p.unit ? ` ${p.unit}` : '',
          textAlign: 'left'
        },
        data: {
          datasetId,
          mapping: {
            deviceId: p.deviceId,
            pointCategory: p.pointCategory === 'yc' ? 'telemetry' : (p.pointCategory === 'yx' ? 'teleSignal' : 'energy'),
            pointId: p.pointId,
            valueKey: p.key,
            stateKey: p.key
          }
        }
      });
    });
  } else if (batchGenType.value === 'status-matrix') {
    // Generate LED Indicator Matrix
    const yxPts = pts.filter(p => p.pointCategory === 'yx');
    const targetPts = yxPts.length > 0 ? yxPts : pts;
    const itemW = 200;
    const itemH = 36;
    const gapY = 8;

    targetPts.forEach((p, idx) => {
      const y = startY + idx * (itemH + gapY);
      const rowId = `comp-led-${Date.now()}-${idx}`;

      // Row Background
      generatedComps.push({
        id: rowId,
        name: `${p.name}状态底框`,
        type: 'draw-rect',
        category: 'basic',
        x: startX,
        y,
        width: itemW,
        height: itemH,
        rotation: 0,
        zIndex: 10,
        style: {
          fill: 'rgba(6, 14, 28, 0.85)',
          stroke: '#334155',
          strokeWidth: 1,
          borderRadius: 6
        },
        data: { mapping: {} }
      });

      // LED Indicator Light
      generatedComps.push({
        id: `${rowId}-led`,
        name: `${p.name}指示灯`,
        type: 'ctrl-indicator',
        category: 'basic',
        x: startX + 10,
        y: y + 8,
        width: 20,
        height: 20,
        rotation: 0,
        zIndex: 11,
        style: {
          indicatorShape: 'circle',
          indicatorState: 'normal'
        },
        data: {
          datasetId,
          mapping: {
            deviceId: p.deviceId,
            pointCategory: 'teleSignal',
            pointId: p.pointId,
            stateKey: p.key,
            valueKey: p.key
          }
        }
      });

      // Signal Label
      generatedComps.push({
        id: `${rowId}-txt`,
        name: p.name,
        type: 'draw-text',
        category: 'basic',
        x: startX + 38,
        y: y + 8,
        width: itemW - 46,
        height: 20,
        rotation: 0,
        zIndex: 11,
        style: {
          text: p.name,
          textColor: '#e2e8f0',
          fontSize: 12,
          textAlign: 'left'
        },
        data: { mapping: {} }
      });
    });
  } else if (batchGenType.value === 'control-panel') {
    // Generate Tele-Control Buttons
    const ykPts = pts.filter(p => p.pointCategory === 'yk');
    const targetPts = ykPts.length > 0 ? ykPts : pts;
    const btnW = 180;
    const btnH = 40;
    const gapY = 12;

    targetPts.forEach((p, idx) => {
      const y = startY + idx * (btnH + gapY);
      const btnId = `comp-yk-btn-${Date.now()}-${idx}`;

      generatedComps.push({
        id: btnId,
        name: `${p.name}控制按键`,
        type: 'ctrl-button',
        category: 'basic',
        x: startX,
        y,
        width: btnW,
        height: btnH,
        rotation: 0,
        zIndex: 10,
        style: {
          buttonText: p.name,
          buttonColorTheme: 'cyan',
          buttonVariant: 'solid',
          borderRadius: 6
        },
        data: {
          datasetId,
          mapping: {
            deviceId: p.deviceId,
            pointCategory: 'teleControl',
            pointId: p.pointId
          },
          action: {
            type: 'tele-control',
            deviceId: p.deviceId,
            pointId: p.pointId
          }
        }
      });
    });
  }

  emit('batch:generate', generatedComps);
  showBatchGenDialog.value = false;
  showToast(`✓ 已成功在画布生成 ${generatedComps.length} 个工业 SCADA 联动组件！`);
  emit('close');
};

// Direct Test Dispatch
const handleDirectControlClick = (p: FlatScadaPoint) => {
  emit('open:control', p.deviceId, p.pointId, p.pointCategory === 'yt' ? 'regulation' : 'control');
};
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans"
  >
    <!-- Toast Notification -->
    <div
      v-if="toastMsg"
      class="fixed top-6 right-6 z-60 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-cyan-500 bg-slate-900 text-cyan-200 text-xs font-mono font-bold"
    >
      <Sparkles class="w-4 h-4 text-cyan-400 animate-spin" />
      <span>{{ toastMsg }}</span>
    </div>

    <!-- Main Container -->
    <div class="w-full max-w-7xl h-[88vh] bg-[#070d1c] border border-cyan-500/40 rounded-2xl shadow-[0_0_60px_rgba(0,242,255,0.2)] flex flex-col overflow-hidden">
      <!-- Header Bar -->
      <div class="px-5 py-3.5 border-b border-cyan-500/20 bg-[#040813] flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
            <Database class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>SCADA 测点总览与批量关联生成中心</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono">
                遥测 YC · 遥信 YX · 电度 DD · 遥控 YK · 遥调 YT
              </span>
            </h2>
            <p class="text-[11px] text-slate-400 font-mono">
              工业级测控点阵列管理，支持批量勾选一键生成 SCADA 看板组件、快速映射与遥控闭环校核
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Batch Action: Bind to Selected Canvas Widgets -->
          <button
            v-if="selectedComponents && selectedComponents.length > 0"
            @click="handleBatchBindToSelectedCanvasWidgets"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs font-mono font-bold hover:bg-emerald-900 cursor-pointer shadow-md transition-all"
            title="将勾选的测点按顺序批量绑定到画布当前选中的图元"
          >
            <Zap class="w-3.5 h-3.5" />
            <span>批量绑定到画布选中图元 ({{ selectedComponents.length }})</span>
          </button>

          <!-- Batch Action: Generate Screen Widgets -->
          <button
            @click="showBatchGenDialog = true"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold cursor-pointer shadow-[0_0_15px_rgba(0,242,255,0.4)] transition-all"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>一键批量生成 SCADA 看板 ({{ selectedPointsList.length > 0 ? selectedPointsList.length : '全部' }})</span>
          </button>

          <!-- Close Modal -->
          <button
            @click="emit('close')"
            class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Main Body: Split Sidebar + Content Table -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Left Sidebar: Station Hierarchy & Devices -->
        <div class="w-64 bg-[#050914] border-r border-slate-800/80 p-3 flex flex-col gap-3">
          <div class="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span class="flex items-center gap-1.5"><Cpu class="w-3.5 h-3.5" /> 装置与站所层级</span>
            <span class="text-[10px] text-slate-400">{{ allDevices.length }} 装置</span>
          </div>

          <!-- Device Switcher List -->
          <div class="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1">
            <!-- All Devices Tab -->
            <button
              @click="selectedDeviceId = 'all'"
              class="w-full text-left p-2 rounded-xl text-xs font-mono transition-all flex items-center justify-between border cursor-pointer"
              :class="selectedDeviceId === 'all' 
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 font-bold shadow-xs' 
                : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'"
            >
              <div class="flex items-center gap-2">
                <Layers class="w-3.5 h-3.5 text-cyan-400" />
                <span>全部装置测点总览</span>
              </div>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                {{ allDevices.reduce((acc, d) => acc + (d.telemetries?.length || 0) + (d.teleSignals?.length || 0), 0) }}
              </span>
            </button>

            <!-- Device Items -->
            <button
              v-for="dev in allDevices"
              :key="dev.deviceId"
              @click="selectedDeviceId = dev.deviceId"
              class="w-full text-left p-2.5 rounded-xl text-xs font-mono transition-all border cursor-pointer flex flex-col gap-1"
              :class="selectedDeviceId === dev.deviceId 
                ? 'bg-cyan-950/70 border-cyan-500 text-cyan-200 shadow-xs' 
                : 'bg-slate-900/30 border-slate-800/50 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'"
            >
              <div class="flex items-center justify-between">
                <span class="font-bold text-white truncate">{{ dev.deviceId }}</span>
                <span 
                  class="w-2 h-2 rounded-full" 
                  :class="dev.commStatus === 1 ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-red-400'" 
                  title="通信在线"
                />
              </div>
              <span class="text-[10px] text-slate-400 truncate">{{ dev.deviceName }}</span>
              <div class="flex items-center gap-1.5 text-[9px] text-slate-400 mt-0.5">
                <span class="text-cyan-400 font-semibold">YC:{{ dev.telemetries?.length || 0 }}</span>
                <span>·</span>
                <span class="text-amber-400 font-semibold">YX:{{ dev.teleSignals?.length || 0 }}</span>
                <span>·</span>
                <span class="text-emerald-400 font-semibold">DD:{{ dev.energies?.length || 0 }}</span>
                <span>·</span>
                <span class="text-rose-400 font-semibold">YK:{{ dev.teleControls?.length || 0 }}</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Right Content: Filter Bar & Scada Points Data Table -->
        <div class="flex-1 flex flex-col bg-[#060b17] overflow-hidden">
          <!-- Filter Toolbar -->
          <div class="p-3 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-[#050a16]">
            <!-- Category Tabs -->
            <div class="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              <button
                @click="activeCategoryTab = 'all'"
                class="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                :class="activeCategoryTab === 'all' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                全部测点 ({{ allFlatPoints.length }})
              </button>
              <button
                @click="activeCategoryTab = 'yc'"
                class="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                :class="activeCategoryTab === 'yc' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                遥测 YC
              </button>
              <button
                @click="activeCategoryTab = 'yx'"
                class="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                :class="activeCategoryTab === 'yx' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                遥信 YX
              </button>
              <button
                @click="activeCategoryTab = 'dd'"
                class="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                :class="activeCategoryTab === 'dd' ? 'bg-emerald-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'"
              >
                电度 DD
              </button>
              <button
                @click="activeCategoryTab = 'yk'"
                class="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                :class="activeCategoryTab === 'yk' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400 hover:text-white'"
              >
                遥控 YK
              </button>
              <button
                @click="activeCategoryTab = 'yt'"
                class="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                :class="activeCategoryTab === 'yt' ? 'bg-indigo-500 text-white font-bold' : 'text-slate-400 hover:text-white'"
              >
                遥调 YT
              </button>
            </div>

            <!-- Search Field -->
            <div class="flex-1 max-w-xs relative">
              <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索点号、名称、单位、装置..."
                class="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-400 focus:outline-hidden font-mono"
              />
            </div>

            <!-- Selection Status Actions -->
            <div class="flex items-center gap-2 text-xs font-mono">
              <span class="text-slate-400">已选中: <strong class="text-cyan-300">{{ selectedPointKeys.size }}</strong> 项</span>
              <button
                v-if="selectedPointKeys.size > 0"
                @click="clearSelection"
                class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
              >
                清空选择
              </button>
            </div>
          </div>

          <!-- Points Data Table -->
          <div class="flex-1 overflow-auto custom-scrollbar">
            <table class="w-full text-left text-xs font-mono border-collapse">
              <thead class="bg-[#030610] text-slate-400 sticky top-0 z-10 border-b border-slate-800 text-[11px]">
                <tr>
                  <th class="py-2.5 px-3 w-10 text-center">
                    <button @click="toggleSelectAll" class="cursor-pointer">
                      <CheckSquare v-if="isAllSelected" class="w-4 h-4 text-cyan-400" />
                      <Square v-else class="w-4 h-4 text-slate-600 hover:text-slate-400" />
                    </button>
                  </th>
                  <th class="py-2.5 px-3 w-28">装置编号</th>
                  <th class="py-2.5 px-3 w-24">分类</th>
                  <th class="py-2.5 px-3 w-20">点号</th>
                  <th class="py-2.5 px-3">测点名称 / 描述</th>
                  <th class="py-2.5 px-3 w-32 text-right">实时工程测值</th>
                  <th class="py-2.5 px-3 w-20">单位</th>
                  <th class="py-2.5 px-3 w-24">状态/校核</th>
                  <th class="py-2.5 px-3 w-28 text-center">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50 text-slate-200">
                <tr
                  v-for="p in allFlatPoints"
                  :key="p.key"
                  @click="toggleSelectPoint(p.key)"
                  class="hover:bg-cyan-950/30 transition-colors cursor-pointer"
                  :class="{ 'bg-cyan-950/40': selectedPointKeys.has(p.key) }"
                >
                  <!-- Checkbox -->
                  <td class="py-2 px-3 text-center" @click.stop="toggleSelectPoint(p.key)">
                    <CheckSquare v-if="selectedPointKeys.has(p.key)" class="w-4 h-4 text-cyan-400 inline" />
                    <Square v-else class="w-4 h-4 text-slate-600 hover:text-slate-400 inline" />
                  </td>

                  <!-- Device ID -->
                  <td class="py-2 px-3 font-bold text-white">{{ p.deviceId }}</td>

                  <!-- Point Category Badge -->
                  <td class="py-2 px-3">
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-bold"
                      :class="p.pointCategory === 'yc' 
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40' 
                        : (p.pointCategory === 'yx' 
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/40' 
                          : (p.pointCategory === 'dd' 
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' 
                            : (p.pointCategory === 'yk' 
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40' 
                              : 'bg-indigo-950 text-indigo-300 border border-indigo-500/40')))"
                    >
                      {{ p.pointCategoryLabel }}
                    </span>
                  </td>

                  <!-- Point ID -->
                  <td class="py-2 px-3 text-cyan-300 font-bold">#{{ p.pointId }}</td>

                  <!-- Name & Description -->
                  <td class="py-2 px-3">
                    <div class="font-bold text-slate-100">{{ p.name }}</div>
                    <div v-if="p.description" class="text-[10px] text-slate-500 truncate max-w-sm">{{ p.description }}</div>
                  </td>

                  <!-- Real-time Value -->
                  <td class="py-2 px-3 text-right font-mono font-bold text-base" :class="p.pointCategory === 'yx' ? (p.value === 1 ? 'text-red-400' : 'text-emerald-400') : 'text-cyan-400'">
                    {{ p.value }}
                  </td>

                  <!-- Unit -->
                  <td class="py-2 px-3 text-slate-400">{{ p.unit || '--' }}</td>

                  <!-- Status / Feedback info -->
                  <td class="py-2 px-3">
                    <span 
                      v-if="p.pointCategory === 'yx'"
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold inline-block"
                      :class="p.value === 1 ? 'bg-red-950 text-red-300 border border-red-500/40' : (p.value === 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40')"
                    >
                      {{ p.statusText }}
                    </span>
                    <span 
                      v-else-if="p.pointCategory === 'yk'"
                      class="text-[10px] text-slate-400 font-mono"
                    >
                      关联YX_{{ p.targetPointId ?? '1' }}
                    </span>
                    <span v-else class="text-[10px] text-slate-500 font-mono">系数: {{ p.factor ?? 1 }}</span>
                  </td>

                  <!-- Action Buttons -->
                  <td class="py-2 px-3 text-center" @click.stop>
                    <button
                      v-if="p.pointCategory === 'yk' || p.pointCategory === 'yt'"
                      @click="handleDirectControlClick(p)"
                      class="px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900 border border-amber-500/50 text-amber-300 text-[10px] font-bold cursor-pointer"
                    >
                      {{ p.pointCategory === 'yk' ? '执行遥控' : '执行遥调' }}
                    </button>
                    <button
                      v-else
                      @click="showToast(`测点标识 [${p.key}] 已就绪`)"
                      class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                    >
                      测点正常
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Batch Generation Configuration Modal Dialog -->
    <div
      v-if="showBatchGenDialog"
      class="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4"
    >
      <div class="w-full max-w-lg bg-[#0a1122] border border-cyan-500/50 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 font-mono text-xs">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles class="w-4 h-4 text-cyan-400" />
            <span>配置一键批量生成 SCADA 看板</span>
          </h3>
          <button @click="showBatchGenDialog = false" class="text-slate-400 hover:text-white cursor-pointer"><X class="w-4 h-4" /></button>
        </div>

        <div class="space-y-3">
          <!-- Template Selection -->
          <div>
            <label class="text-slate-400 block mb-1.5">选择生成布局形式:</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                @click="batchGenType = 'table-card'"
                class="p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1"
                :class="batchGenType === 'table-card' ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'"
              >
                <span class="font-bold text-white flex items-center gap-1.5"><Table class="w-3.5 h-3.5 text-cyan-400" /> 密集参数表格看板</span>
                <span class="text-[10px] text-slate-400">将选中测点合并为一个精美的数据监视卡片</span>
              </button>

              <button
                @click="batchGenType = 'metric-grid'"
                class="p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1"
                :class="batchGenType === 'metric-grid' ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'"
              >
                <span class="font-bold text-white flex items-center gap-1.5"><LayoutGrid class="w-3.5 h-3.5 text-cyan-400" /> 阵列测控卡片组</span>
                <span class="text-[10px] text-slate-400">多列网格独立排布每一个遥测卡片</span>
              </button>

              <button
                @click="batchGenType = 'status-matrix'"
                class="p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1"
                :class="batchGenType === 'status-matrix' ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'"
              >
                <span class="font-bold text-white flex items-center gap-1.5"><Zap class="w-3.5 h-3.5 text-amber-400" /> 遥信 LED 状态指示排</span>
                <span class="text-[10px] text-slate-400">为选中的遥信点生成状态指示灯列表</span>
              </button>

              <button
                @click="batchGenType = 'control-panel'"
                class="p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1"
                :class="batchGenType === 'control-panel' ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'"
              >
                <span class="font-bold text-white flex items-center gap-1.5"><Radio class="w-3.5 h-3.5 text-rose-400" /> 遥控操作控制按键组</span>
                <span class="text-[10px] text-slate-400">为选中的遥控点生成工业操作控制按钮</span>
              </button>
            </div>
          </div>

          <!-- Position Coordinates & Columns -->
          <div class="grid grid-cols-3 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div>
              <label class="text-slate-400 block text-[10px] mb-1">起始 X 坐标 (px):</label>
              <input v-model.number="batchGenStartX" type="number" class="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-cyan-200 font-bold" />
            </div>
            <div>
              <label class="text-slate-400 block text-[10px] mb-1">起始 Y 坐标 (px):</label>
              <input v-model.number="batchGenStartY" type="number" class="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-cyan-200 font-bold" />
            </div>
            <div v-if="batchGenType === 'metric-grid'">
              <label class="text-slate-400 block text-[10px] mb-1">网格排布列数:</label>
              <input v-model.number="batchGenCols" type="number" min="1" max="8" class="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-cyan-200 font-bold" />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button @click="showBatchGenDialog = false" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">取消</button>
          <button @click="handleExecuteBatchGenerate" class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer">立即生成到画布</button>
        </div>
      </div>
    </div>
  </div>
</template>
