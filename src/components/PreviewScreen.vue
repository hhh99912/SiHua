<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  X,
  Maximize,
  Minimize,
  Play,
  Pause,
  Monitor,
  Scaling,
  Sparkles,
  Layers,
  Layout,
  ChevronRight,
  TrendingUp,
  Zap,
  ShieldCheck,
  UserCheck,
  Edit3,
  RefreshCw,
  Eye,
  LogOut,
  Info,
  CheckCircle2,
  Sliders,
  Tv
} from 'lucide-vue-next';
import { ScreenConfig, ScreenComponent, DatasetItem, ScreenItem, ScadaDeviceItem } from '../types';
import { PRESET_SCADA_DEVICES } from '../data/presetDatasets';
import { currentUser, canEditCanvas } from '../utils/auth';
import WidgetRenderer from './widgets/WidgetRenderer.vue';
import HistoryCurveModal from './HistoryCurveModal.vue';
import ScadaControlModal from './ScadaControlModal.vue';
import LoginModal from './LoginModal.vue';

interface Props {
  screen: ScreenConfig;
  components: ScreenComponent[];
  datasets: DatasetItem[];
  isStreaming: boolean;
  screens?: ScreenItem[];
  activeScreenId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  screens: () => []
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'toggle:streaming'): void;
  (e: 'switch:screen', screenId: string): void;
  (e: 'logout'): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);
const scaleMode = ref<'fit' | 'fill' | 'original'>('fill');
const isBrowserFullscreen = ref(false);

// Modals inside Preview
const showHistoryModal = ref(false);
const historyDeviceId = ref<string>('DEV-101');
const historyPointId = ref<number>(1);

const showControlModal = ref(false);
const controlDeviceId = ref<string>('DEV-101');

const showLoginModal = ref(false);
const loginNotice = ref('');

// Context Menu State
const contextMenu = ref<{
  visible: boolean;
  x: number;
  y: number;
  targetComponent: ScreenComponent | null;
  targetDeviceId?: string;
  targetPointId?: number;
}>({
  visible: false,
  x: 0,
  y: 0,
  targetComponent: null
});

// Hovered Point Tooltip State
const hoverTooltip = ref<{
  visible: boolean;
  x: number;
  y: number;
  comp: ScreenComponent;
  device: ScadaDeviceItem | null;
  pointName: string;
  pointType: 'YC' | 'YX' | 'YK' | 'YT' | 'DD' | 'STATE';
  pointId?: number | string;
  currentValue: any;
  unit?: string;
  statusText?: string;
  verifyText?: string;
} | null>(null);

let hoverTimer: any = null;

const handleResize = () => {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
};

// Strict Content Bounding Box Calculation for Preview
const contentBBox = computed(() => {
  const visible = (props.components || []).filter(c => c.visible !== false);
  if (visible.length === 0) {
    return { minX: 0, minY: 0, width: props.screen.width || 1920, height: props.screen.height || 1080 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  visible.forEach(c => {
    const x = c.x ?? 0;
    const y = c.y ?? 0;
    const w = Math.max(1, c.width ?? 0);
    const h = Math.max(1, c.height ?? 0);

    let left = x;
    let top = y;
    let right = x + w;
    let bottom = y + h;

    if (c.rotation) {
      const rad = (c.rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const rotatedHalfW = (w / 2) * cos + (h / 2) * sin;
      const rotatedHalfH = (w / 2) * sin + (h / 2) * cos;
      const centerX = x + w / 2;
      const centerY = y + h / 2;
      left = centerX - rotatedHalfW;
      top = centerY - rotatedHalfH;
      right = centerX + rotatedHalfW;
      bottom = centerY + rotatedHalfH;
    }

    if (left < minX) minX = left;
    if (top < minY) minY = top;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  });

  if (!isFinite(minX)) minX = 0;
  if (!isFinite(minY)) minY = 0;
  if (!isFinite(maxX)) maxX = 1920;
  if (!isFinite(maxY)) maxY = 1080;

  return {
    minX: Math.round(minX),
    minY: Math.round(minY),
    width: Math.max(20, Math.round(maxX - minX)),
    height: Math.max(20, Math.round(maxY - minY))
  };
});

// Tight canvas dimensions based on minimal bounding box of content
const canvasWidth = computed(() => contentBBox.value.width);
const canvasHeight = computed(() => contentBBox.value.height);
const offsetX = computed(() => -contentBBox.value.minX);
const offsetY = computed(() => -contentBBox.value.minY);

// Calculate scale factor
const scaleRatio = computed(() => {
  const cw = canvasWidth.value;
  const ch = canvasHeight.value;
  if (scaleMode.value === 'original') return { scaleX: 1, scaleY: 1 };
  const sx = windowWidth.value / cw;
  const sy = windowHeight.value / ch;

  if (scaleMode.value === 'fill') {
    return { scaleX: sx, scaleY: sy };
  }

  // 'fit' maintains aspect ratio
  const s = Math.min(sx, sy);
  return { scaleX: s, scaleY: s };
});

const toggleBrowserFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    isBrowserFullscreen.value = true;
  } else {
    document.exitFullscreen().catch(() => {});
    isBrowserFullscreen.value = false;
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    handleExitPreview();
  }
};

// Exit Preview Handler (RBAC protected)
const handleExitPreview = () => {
  if (canEditCanvas()) {
    emit('close');
  } else {
    loginNotice.value = '请登录【系统用户】以进入编辑模式。';
    showLoginModal.value = true;
  }
};

// Component click handler for screen jump & interaction actions
const handlePreviewCompClick = (comp: ScreenComponent) => {
  const act = comp.data?.action;
  if (!act || act.type === 'none') return;
  if ((act.type === 'jump-screen' || act.type === 'switch-screen') && act.targetScreenId) {
    emit('switch:screen', act.targetScreenId);
  } else if (act.type === 'link' && act.url) {
    window.open(act.url, '_blank');
  } else if (act.type === 'tele-control' || act.type === 'tele-regulation') {
    controlDeviceId.value = act.deviceId || 'DEV-101';
    showControlModal.value = true;
  }
};

// Helper: Resolve Point Info from Component Data
const resolveComponentPointInfo = (comp: ScreenComponent) => {
  const mapping = comp.data?.mapping || {};
  const action = comp.data?.action;

  let devId = mapping.deviceId || action?.deviceId || comp.customProps?.deviceId;
  if (!devId) {
    // deduce from key
    const allKeys = [mapping.pointKey, mapping.stateKey, mapping.valueKey, mapping.statusKey].filter(Boolean);
    for (const k of allKeys) {
      const match = k.match(/^([A-Z0-9_-]+)_(YC|YX|YK|YT|DD)_/i);
      if (match) {
        devId = match[1];
        break;
      }
    }
  }

  const device = devId ? PRESET_SCADA_DEVICES.find(d => d.deviceId === devId) || null : null;
  const isBreakerOrIndicator = comp.type === 'elec-breaker' || comp.type === 'ctrl-indicator' || comp.type === 'elec-handcart' || comp.type === 'elec-disconnector';
  const isControl = action?.type === 'tele-control' || comp.type === 'ctrl-button';
  const isRegulation = action?.type === 'tele-regulation';
  const isMetric = comp.category === 'metrics' || comp.type === 'elec-multimeter';

  let pointType: 'YC' | 'YX' | 'YK' | 'YT' | 'DD' | 'STATE' = 'YC';
  let pointName = comp.name;
  let pointId: number | string | undefined = undefined;
  let currentValue: any = comp.data?.value ?? 0;
  let unit = comp.data?.unit || '';
  let statusText = '';
  let verifyText = '';

  // 1. Tele-control (YK)
  if (isControl) {
    pointType = 'YK';
    pointId = action?.pointId || mapping.ykPointId || 1;
    const ykDef = device?.teleControls?.find(k => k.pointId === pointId);
    if (ykDef) pointName = ykDef.name;
    const targetYxId = action?.targetPointId || mapping.targetYxPointId || 1;
    const targetYx = device?.teleSignals?.find(s => s.pointId === targetYxId);
    if (targetYx) {
      verifyText = `闭环校验遥信: [YX_${targetYxId}] ${targetYx.name}`;
      statusText = targetYx.statusText || (targetYx.value === 1 ? '合闸运行' : targetYx.value === 2 ? '故障跳闸' : '分闸停运');
      currentValue = targetYx.value;
    } else {
      verifyText = '控制输出 (无直接采样值)';
      currentValue = '无采样值';
      statusText = '控制通道';
    }
  }
  // 2. Tele-regulation (YT)
  else if (isRegulation) {
    pointType = 'YT';
    pointId = action?.pointId || mapping.ytPointId || 1;
    const ytDef = device?.teleRegulations?.find(t => t.pointId === pointId);
    if (ytDef) pointName = ytDef.name;
    const targetYcId = action?.targetPointId || mapping.targetYcPointId || 1;
    const targetYc = device?.telemetries?.find(m => m.pointId === targetYcId);
    if (targetYc) {
      verifyText = `闭环校验遥测: [YC_${targetYcId}] ${targetYc.name}`;
      currentValue = targetYc.value;
      unit = targetYc.unit || ytDef?.unit || '';
    } else {
      verifyText = '调节输出 (无直接采样值)';
      currentValue = ytDef ? ytDef.value : '无采样值';
      unit = ytDef?.unit || '';
    }
  }
  // 3. Tele-signal (YX)
  else if (isBreakerOrIndicator || mapping.stateKey || mapping.statusKey) {
    pointType = 'YX';
    const key = mapping.stateKey || mapping.statusKey || '';
    const match = key.match(/YX_(\d+)/i);
    pointId = match ? Number(match[1]) : (device?.teleSignals?.[0]?.pointId || 1);
    const yxDef = device?.teleSignals?.find(s => s.pointId === pointId);
    if (yxDef) {
      pointName = yxDef.name;
      currentValue = yxDef.value;
      statusText = yxDef.statusText || (yxDef.value === 1 ? '合闸运行' : yxDef.value === 2 ? '故障跳闸' : '分闸停运');
    } else {
      currentValue = comp.data?.state ?? 1;
      statusText = currentValue === 1 ? '合闸运行' : currentValue === 2 ? '故障告警' : '分闸停止';
    }
  }
  // 4. Telemetry (YC) / Energy (DD)
  else if (isMetric || mapping.valueKey || mapping.pointKey) {
    const key = mapping.valueKey || mapping.pointKey || '';
    if (key.includes('DD_')) {
      pointType = 'DD';
      const match = key.match(/DD_(\d+)/i);
      pointId = match ? Number(match[1]) : 1;
      const ddDef = device?.energies?.find(e => e.pointId === pointId);
      if (ddDef) {
        pointName = ddDef.name;
        currentValue = ddDef.value;
        unit = ddDef.unit || 'kWh';
      }
    } else {
      pointType = 'YC';
      const match = key.match(/YC_(\d+)/i);
      pointId = match ? Number(match[1]) : (device?.telemetries?.[0]?.pointId || 1);
      const ycDef = device?.telemetries?.find(m => m.pointId === pointId);
      if (ycDef) {
        pointName = ycDef.name;
        currentValue = ycDef.value;
        unit = ycDef.unit || unit;
      }
    }
  } else if (!device && !mapping.pointKey && !mapping.stateKey) {
    return null;
  }

  return {
    comp,
    device,
    pointName,
    pointType,
    pointId,
    currentValue,
    unit,
    statusText,
    verifyText
  };
};

// Component Mouse Enter & Move -> Trigger Point Hover Tooltip right next to cursor
const updateTooltipPosition = (e: MouseEvent) => {
  const tooltipWidth = 320;
  const tooltipHeight = 210;
  let posX = e.clientX + 14;
  let posY = e.clientY + 14;

  if (posX + tooltipWidth > window.innerWidth) {
    posX = e.clientX - tooltipWidth - 10;
  }
  if (posY + tooltipHeight > window.innerHeight) {
    posY = e.clientY - tooltipHeight - 10;
  }

  return {
    x: Math.max(10, posX),
    y: Math.max(10, posY)
  };
};

const handleCompMouseEnter = (e: MouseEvent, comp: ScreenComponent) => {
  clearTimeout(hoverTimer);
  const info = resolveComponentPointInfo(comp);
  if (!info) return;

  const pos = updateTooltipPosition(e);
  hoverTooltip.value = {
    ...info,
    visible: true,
    x: pos.x,
    y: pos.y
  };
};

const handleCompMouseMove = (e: MouseEvent, comp: ScreenComponent) => {
  if (!hoverTooltip.value || !hoverTooltip.value.visible) {
    const info = resolveComponentPointInfo(comp);
    if (!info) return;
    hoverTooltip.value = { ...info, visible: true, x: 0, y: 0 };
  }
  const pos = updateTooltipPosition(e);
  hoverTooltip.value.x = pos.x;
  hoverTooltip.value.y = pos.y;
};

const handleCompMouseLeave = () => {
  clearTimeout(hoverTimer);
  // Immediate disappearance when cursor leaves the component
  hoverTooltip.value = null;
};

// Right-click Context Menu
const handlePreviewContextMenu = (e: MouseEvent, comp?: ScreenComponent) => {
  e.preventDefault();
  e.stopPropagation();

  let targetDev = 'DEV-101';
  let targetPt = 1;

  if (comp) {
    const info = resolveComponentPointInfo(comp);
    if (info && info.device) {
      targetDev = info.device.deviceId;
      if (typeof info.pointId === 'number') {
        targetPt = info.pointId;
      }
    }
  }

  contextMenu.value = {
    visible: true,
    x: Math.min(window.innerWidth - 220, e.clientX),
    y: Math.min(window.innerHeight - 340, e.clientY),
    targetComponent: comp || null,
    targetDeviceId: targetDev,
    targetPointId: targetPt
  };
};

const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

// Context Menu Action Dispatchers
const handleOpenControlFromMenu = () => {
  controlDeviceId.value = contextMenu.value.targetDeviceId || 'DEV-101';
  showControlModal.value = true;
  closeContextMenu();
};

const handleOpenHistoryFromMenu = () => {
  historyDeviceId.value = contextMenu.value.targetDeviceId || 'DEV-101';
  historyPointId.value = contextMenu.value.targetPointId || 1;
  showHistoryModal.value = true;
  closeContextMenu();
};

// Global inter-screen jump event listener inside preview
const handleGlobalJump = (e: any) => {
  if (e.detail) {
    emit('switch:screen', e.detail);
  }
};

// Global SCADA control event listener inside preview
const handleGlobalControl = (e: any) => {
  if (e.detail) {
    controlDeviceId.value = e.detail.deviceId || 'DEV-101';
    showControlModal.value = true;
  }
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('datav:jump:screen', handleGlobalJump);
  window.addEventListener('scada:open:control', handleGlobalControl);
  handleResize();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('click', closeContextMenu);
  window.removeEventListener('datav:jump:screen', handleGlobalJump);
  window.removeEventListener('scada:open:control', handleGlobalControl);
  clearTimeout(hoverTimer);
});
</script>

<template>
  <div
    ref="containerRef"
    @contextmenu.prevent="handlePreviewContextMenu($event)"
    class="fixed inset-0 bg-[#02050b] z-50 overflow-hidden select-none font-sans"
  >
    <!-- Scaled Screen Canvas View: Perfectly centered using absolute translate + scale -->
    <div
      class="absolute transition-transform duration-100 ease-out"
      :style="{
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) scale(${scaleRatio.scaleX}, ${scaleRatio.scaleY})`,
        transformOrigin: 'center center',
        backgroundColor: screen.backgroundColor || '#040810',
        backgroundImage: 'none',
        boxShadow: '0 0 60px rgba(0,0,0,0.95)'
      }"
    >
      <!-- Components in Z-Index Order -->
      <div
        v-for="comp in components"
        :key="comp.id"
        class="absolute"
        :class="{
          'opacity-0 pointer-events-none': comp.visible === false,
          'cursor-pointer': comp.data?.action && comp.data.action.type !== 'none'
        }"
        :style="{
          left: `${(comp.x || 0) + offsetX}px`,
          top: `${(comp.y || 0) + offsetY}px`,
          width: `${comp.width}px`,
          height: `${comp.height}px`,
          transform: comp.rotation ? `rotate(${comp.rotation}deg)` : 'translateZ(0)',
          zIndex: comp.zIndex || 1,
          contain: 'layout style paint'
        }"
        @click="handlePreviewCompClick(comp)"
        @mouseenter="handleCompMouseEnter($event, comp)"
        @mousemove="handleCompMouseMove($event, comp)"
        @mouseleave="handleCompMouseLeave"
        @contextmenu.stop="handlePreviewContextMenu($event, comp)"
      >
        <WidgetRenderer
          :component="comp"
          :datasets="datasets"
          :preview-mode="true"
          @jump:screen="emit('switch:screen', $event)"
        />
      </div>
    </div>

    <!-- Hovered Point Information Tooltip (完整显示测点/装置详细遥测遥信参数，紧随光标) -->
    <div
      v-if="hoverTooltip && hoverTooltip.visible"
      class="fixed z-50 pointer-events-none bg-[#050c1e]/98 border border-cyan-500/70 p-3 rounded-xl shadow-[0_12px_35px_rgba(0,0,0,0.92)] font-mono text-xs text-white w-76 animate-in fade-in duration-75 backdrop-blur-xl flex flex-col gap-2"
      :style="{
        left: `${hoverTooltip.x}px`,
        top: `${hoverTooltip.y}px`
      }"
    >
      <!-- Header: Device & Point Type Badge -->
      <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div class="flex items-center gap-1.5 truncate">
          <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
          <span class="text-slate-300 font-bold truncate">
            {{ hoverTooltip.device ? hoverTooltip.device.name : 'SCADA测控装置' }}
          </span>
        </div>
        <span
          class="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0"
          :class="{
            'bg-cyan-950 text-cyan-300 border border-cyan-500/40': hoverTooltip.pointType === 'YC',
            'bg-emerald-950 text-emerald-300 border border-emerald-500/40': hoverTooltip.pointType === 'YX',
            'bg-purple-950 text-purple-300 border border-purple-500/40': hoverTooltip.pointType === 'YK',
            'bg-amber-950 text-amber-300 border border-amber-500/40': hoverTooltip.pointType === 'YT',
            'bg-blue-950 text-blue-300 border border-blue-500/40': hoverTooltip.pointType === 'DD'
          }"
        >
          {{ hoverTooltip.pointType }}_{{ hoverTooltip.pointId }}
        </span>
      </div>

      <!-- Point Name & Value -->
      <div class="space-y-1">
        <div class="text-slate-400 text-[11px] truncate">
          测点名称: <span class="text-slate-100 font-bold">{{ hoverTooltip.pointName || '未命名测点' }}</span>
        </div>

        <div class="flex items-center justify-between bg-[#030712]/90 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
          <span class="text-[11px] text-slate-400">实时数值/状态:</span>
          <div class="flex items-center gap-1.5 font-bold">
            <span
              v-if="hoverTooltip.statusText"
              class="px-1.5 py-0.2 rounded text-[11px]"
              :class="hoverTooltip.currentValue === 1 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : (hoverTooltip.currentValue === 2 ? 'bg-rose-950 text-rose-300 border border-rose-500/40' : 'bg-slate-900 text-slate-300 border border-slate-700')"
            >
              {{ hoverTooltip.statusText }} ({{ hoverTooltip.currentValue }})
            </span>
            <span v-else class="text-cyan-300 text-sm">
              {{ typeof hoverTooltip.currentValue === 'number' ? hoverTooltip.currentValue.toFixed(2) : hoverTooltip.currentValue }}
              <span v-if="hoverTooltip.unit" class="text-[11px] text-cyan-500 ml-0.5">{{ hoverTooltip.unit }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Extra SCADA Telemetry & Quality Info -->
      <div class="pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1">
        <div class="flex items-center justify-between">
          <span>装置编号: <span class="text-slate-300">{{ hoverTooltip.device ? hoverTooltip.device.deviceId : 'DEV-101' }}</span></span>
          <span class="text-emerald-400">品质: 正常 (0x00)</span>
        </div>
        <div v-if="hoverTooltip.verifyText" class="text-purple-300 truncate">
          {{ hoverTooltip.verifyText }}
        </div>
      </div>
    </div>

    <!-- Right-Click SCADA Context Menu (在大屏内右击调出) -->
    <div
      v-if="contextMenu.visible"
      @click.stop
      class="fixed z-50 bg-[#060c1c]/95 backdrop-blur-xl border border-cyan-500/40 rounded-xl shadow-[0_15px_45px_rgba(0,0,0,0.9)] w-56 py-1.5 text-xs text-slate-200 font-sans divide-y divide-slate-800/80 animate-in fade-in zoom-in-95 duration-100"
      :style="{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`
      }"
    >
      <!-- Section 1: SCADA Operations -->
      <div class="py-1">
        <button
          @click="handleOpenControlFromMenu"
          class="w-full px-3 py-1.5 text-left hover:bg-cyan-950/80 text-cyan-300 flex items-center justify-between cursor-pointer group"
        >
          <span class="flex items-center gap-2 font-bold">
            <Zap class="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>SCADA 遥控/遥调置数</span>
          </span>
          <span class="text-[10px] text-cyan-500 font-mono">YK/YT</span>
        </button>

        <button
          @click="handleOpenHistoryFromMenu"
          class="w-full px-3 py-1.5 text-left hover:bg-emerald-950/80 text-emerald-300 flex items-center justify-between cursor-pointer group"
        >
          <span class="flex items-center gap-2 font-bold">
            <TrendingUp class="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>查看历史负荷曲线</span>
          </span>
          <span class="text-[10px] text-emerald-500 font-mono">Trend</span>
        </button>
      </div>

      <!-- Section 2: Screen Switcher (if multiple screens) -->
      <div v-if="screens && screens.length > 1" class="py-1">
        <div class="px-3 py-1 text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1">
          <Layout class="w-3 h-3 text-cyan-400" />
          <span>切换 SCADA 画面:</span>
        </div>
        <div class="max-h-28 overflow-y-auto custom-scrollbar">
          <button
            v-for="s in screens"
            :key="s.id"
            @click="emit('switch:screen', s.id); closeContextMenu();"
            class="w-full px-3 py-1 text-left text-[11px] flex items-center justify-between hover:bg-slate-800/80 cursor-pointer"
            :class="s.id === activeScreenId ? 'text-cyan-400 font-bold bg-cyan-950/40' : 'text-slate-300'"
          >
            <span class="truncate">{{ s.name }}</span>
            <CheckCircle2 v-if="s.id === activeScreenId" class="w-3 h-3 text-cyan-400" />
          </button>
        </div>
      </div>

      <!-- Section 3: View & Ratio Settings -->
      <div class="py-1">
        <button
          @click="emit('toggle:streaming'); closeContextMenu();"
          class="w-full px-3 py-1.5 text-left hover:bg-slate-800/80 flex items-center justify-between cursor-pointer"
          :class="isStreaming ? 'text-emerald-400' : 'text-slate-400'"
        >
          <span class="flex items-center gap-2">
            <Pause v-if="isStreaming" class="w-3.5 h-3.5" />
            <Play v-else class="w-3.5 h-3.5" />
            <span>{{ isStreaming ? '暂停实时数据流' : '恢复实时数据流' }}</span>
          </span>
        </button>

        <button
          @click="toggleBrowserFullscreen(); closeContextMenu();"
          class="w-full px-3 py-1.5 text-left hover:bg-slate-800/80 text-slate-300 flex items-center justify-between cursor-pointer"
        >
          <span class="flex items-center gap-2">
            <Maximize class="w-3.5 h-3.5 text-cyan-400" />
            <span>{{ isBrowserFullscreen ? '退出浏览器全屏' : '切换全屏模式' }}</span>
          </span>
          <span class="text-[10px] text-slate-500 font-mono">F11</span>
        </button>

        <!-- Scale Mode Submenu / Toggle -->
        <div class="px-3 py-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>显示比例:</span>
          <div class="flex items-center gap-1 font-mono">
            <button
              @click="scaleMode = 'fit'"
              class="px-1.5 py-0.5 rounded text-[10px]"
              :class="scaleMode === 'fit' ? 'bg-cyan-500/30 text-cyan-300 font-bold' : 'hover:text-white'"
            >
              自适应
            </button>
            <button
              @click="scaleMode = 'fill'"
              class="px-1.5 py-0.5 rounded text-[10px]"
              :class="scaleMode === 'fill' ? 'bg-cyan-500/30 text-cyan-300 font-bold' : 'hover:text-white'"
            >
              铺满
            </button>
            <button
              @click="scaleMode = 'original'"
              class="px-1.5 py-0.5 rounded text-[10px]"
              :class="scaleMode === 'original' ? 'bg-cyan-500/30 text-cyan-300 font-bold' : 'hover:text-white'"
            >
              1:1
            </button>
          </div>
        </div>
      </div>

      <!-- Section 4: Exit & Auth User -->
      <div class="py-1">
        <!-- Switch User Button -->
        <button
          @click="showLoginModal = true; closeContextMenu();"
          class="w-full px-3 py-1.5 text-left hover:bg-slate-800/80 text-slate-300 flex items-center justify-between cursor-pointer"
        >
          <span class="flex items-center gap-2">
            <ShieldCheck class="w-3.5 h-3.5 text-amber-400" />
            <span>用户: {{ currentUser.name }}</span>
          </span>
          <span class="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
            {{ currentUser.role === 'system_admin' ? '系统用户' : '普通用户' }}
          </span>
        </button>

        <!-- Return to SCADA Login Screen -->
        <button
          @click="emit('logout'); closeContextMenu();"
          class="w-full px-3 py-1.5 text-left hover:bg-amber-950/40 text-amber-300 flex items-center justify-between cursor-pointer"
        >
          <span class="flex items-center gap-2">
            <UserCheck class="w-3.5 h-3.5 text-amber-400" />
            <span>注销 / 返回 SCADA 登录界面</span>
          </span>
          <span class="text-[10px] text-amber-500 font-mono">Login</span>
        </button>

        <!-- Exit Preview Mode to Editor -->
        <button
          @click="handleExitPreview(); closeContextMenu();"
          class="w-full px-3 py-1.5 text-left hover:bg-rose-950/60 text-rose-300 flex items-center justify-between cursor-pointer font-bold"
        >
          <span class="flex items-center gap-2">
            <LogOut class="w-3.5 h-3.5 text-rose-400" />
            <span>退出监控 / 进入编辑模式</span>
          </span>
          <span class="text-[10px] text-rose-500 font-mono">ESC</span>
        </button>
      </div>
    </div>

    <!-- Historical Curve Modal -->
    <HistoryCurveModal
      v-if="showHistoryModal"
      :initial-device-id="historyDeviceId"
      :initial-point-id="historyPointId"
      @close="showHistoryModal = false"
    />

    <!-- SCADA Control Modal -->
    <ScadaControlModal
      v-if="showControlModal"
      :visible="showControlModal"
      :initial-device-id="controlDeviceId"
      :datasets="datasets"
      @close="showControlModal = false"
    />

    <!-- User Authentication Modal -->
    <LoginModal
      v-if="showLoginModal"
      :notice="loginNotice"
      @close="showLoginModal = false; loginNotice = '';"
      @success="showLoginModal = false; loginNotice = '';"
    />
  </div>
</template>
