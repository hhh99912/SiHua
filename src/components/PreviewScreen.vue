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
  Tv,
  Bell,
  PanelBottom,
  CheckSquare,
  Square,
  ChevronUp,
  ChevronDown,
  Flame,
  Radio
} from 'lucide-vue-next';
import { ScreenConfig, ScreenComponent, DatasetItem, ScreenItem, ScadaDeviceItem } from '../types';
import { PRESET_SCADA_DEVICES } from '../data/presetDatasets';
import { currentUser, canEditCanvas } from '../utils/auth';
import {
  triggerGetRealtimeDataViaUds,
  isAlarmStreamRunning,
  onUdsAlarm,
  onUdsRealtime,
  ScadaAlarmEvent
} from '../utils/udsClient';
import WidgetRenderer from './widgets/WidgetRenderer.vue';
import HistoryCurveModal from './HistoryCurveModal.vue';
import RealtimeAlarmModal from './RealtimeAlarmModal.vue';
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

// Bottom Bar Visibility (默认不显示，由右键菜单控制)
const showBottomBar = ref(false);
const showScreenSwitcherPopover = ref(false);

// Modals inside Preview
const showHistoryModal = ref(false);
const historyDeviceId = ref<string>('DEV-101');
const historyPointId = ref<number>(1);

const showAlarmModal = ref(false);
const unacknowledgedAlarmCount = ref(2);

const showControlModal = ref(false);
const controlDeviceId = ref<string>('DEV-101');

const showLoginModal = ref(false);
const loginNotice = ref('');

// Trigger UDS Realtime Refresh state
const isTriggeringUds = ref(false);
const udsTriggerStatus = ref<string>('');

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
let unsubscribeAlarm: (() => void) | null = null;
let unsubscribeRealtime: (() => void) | null = null;

const handleResize = () => {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
};

// Handle UDS Realtime Manual Trigger
const handleTriggerUdsRealtime = async () => {
  if (isTriggeringUds.value) return;
  isTriggeringUds.value = true;
  udsTriggerStatus.value = '正在拉取 UDS 实时数据...';
  try {
    const res = await triggerGetRealtimeDataViaUds();
    if (res.success) {
      udsTriggerStatus.value = 'UDS 数据触发刷新成功';
    }
  } catch (err) {
    udsTriggerStatus.value = 'UDS 触发失败';
  } finally {
    setTimeout(() => {
      isTriggeringUds.value = false;
      udsTriggerStatus.value = '';
    }, 1200);
  }
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

// Standard SCADA Fixed Canvas Dimensions (default 1920x1080)
const canvasWidth = computed(() => props.screen?.width || 1920);
const canvasHeight = computed(() => props.screen?.height || 1080);
const offsetX = computed(() => 0);
const offsetY = computed(() => 0);

// Calculate scale factor & Pixel-Perfect 1:1 detection
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

const isExactPixelMatch = computed(() => {
  return scaleMode.value === 'original' || 
    (Math.abs(scaleRatio.value.scaleX - 1) < 0.005 && Math.abs(scaleRatio.value.scaleY - 1) < 0.005);
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
    x: Math.round(Math.min(window.innerWidth - 240, Math.max(10, e.clientX))),
    y: Math.round(Math.min(window.innerHeight - 340, Math.max(10, e.clientY))),
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

  // 监听 UDS 实时告警推送
  unsubscribeAlarm = onUdsAlarm((event: ScadaAlarmEvent) => {
    unacknowledgedAlarmCount.value += 1;
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('click', closeContextMenu);
  window.removeEventListener('datav:jump:screen', handleGlobalJump);
  window.removeEventListener('scada:open:control', handleGlobalControl);
  clearTimeout(hoverTimer);
  if (unsubscribeAlarm) unsubscribeAlarm();
  if (unsubscribeRealtime) unsubscribeRealtime();
});
</script>

<template>
  <div
    ref="containerRef"
    @contextmenu.prevent="handlePreviewContextMenu($event)"
    class="fixed inset-0 bg-[#02050b] z-50 overflow-hidden select-none font-sans"
  >
    <!-- Scaled Screen Canvas View: Perfectly centered without layout jumps -->
    <div
      class="absolute"
      :style="{
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        left: '50%',
        top: '50%',
        transform: isExactPixelMatch 
          ? 'translate(-50%, -50%)' 
          : `translate(-50%, -50%) scale(${scaleRatio.scaleX}, ${scaleRatio.scaleY})`,
        transformOrigin: 'center center',
        backgroundColor: screen.backgroundColor || '#040810',
        backgroundImage: 'none',
        boxShadow: isExactPixelMatch ? 'none' : '0 0 60px rgba(0,0,0,0.95)'
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
          transform: comp.rotation ? `rotate(${comp.rotation}deg)` : undefined,
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

    <!-- Hovered Point Information Tooltip (完整显示测点/装置详细遥测遥信参数，紧随光标，无模糊滤镜) -->
    <div
      v-if="hoverTooltip && hoverTooltip.visible"
      class="fixed z-50 pointer-events-none bg-[#091326] border border-cyan-500/70 p-3 rounded-lg shadow-[0_12px_35px_rgba(0,0,0,0.95)] font-mono text-xs text-white w-76 flex flex-col gap-2"
      :style="{
        left: `${Math.round(hoverTooltip.x)}px`,
        top: `${Math.round(hoverTooltip.y)}px`
      }"
    >
      <!-- Header: Device & Point Type Badge -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-2">
        <div class="flex items-center gap-1.5 truncate">
          <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
          <span class="text-slate-200 font-bold truncate">
            {{ hoverTooltip.device ? hoverTooltip.device.name : 'SCADA测控装置' }}
          </span>
        </div>
        <span
          class="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0"
          :class="{
            'bg-cyan-950 text-cyan-300 border border-cyan-500/50': hoverTooltip.pointType === 'YC',
            'bg-emerald-950 text-emerald-300 border border-emerald-500/50': hoverTooltip.pointType === 'YX',
            'bg-purple-950 text-purple-300 border border-purple-500/50': hoverTooltip.pointType === 'YK',
            'bg-amber-950 text-amber-300 border border-amber-500/50': hoverTooltip.pointType === 'YT',
            'bg-blue-950 text-blue-300 border border-blue-500/50': hoverTooltip.pointType === 'DD'
          }"
        >
          {{ hoverTooltip.pointType }}_{{ hoverTooltip.pointId }}
        </span>
      </div>

      <!-- Point Name & Value -->
      <div class="space-y-1">
        <div class="text-slate-300 text-[11px] truncate">
          测点名称: <span class="text-white font-bold">{{ hoverTooltip.pointName || '未命名测点' }}</span>
        </div>

        <div class="flex items-center justify-between bg-[#040914] px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span class="text-[11px] text-slate-300 font-medium">实时数值/状态:</span>
          <div class="flex items-center gap-1.5 font-bold">
            <span
              v-if="hoverTooltip.statusText"
              class="px-1.5 py-0.2 rounded text-[11px]"
              :class="hoverTooltip.currentValue === 1 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-bold' : (hoverTooltip.currentValue === 2 ? 'bg-rose-950 text-rose-300 border border-rose-500/50 font-bold' : 'bg-slate-900 text-slate-200 border border-slate-700')"
            >
              {{ hoverTooltip.statusText }} ({{ hoverTooltip.currentValue }})
            </span>
            <span v-else class="text-cyan-300 text-sm font-bold">
              {{ typeof hoverTooltip.currentValue === 'number' ? hoverTooltip.currentValue.toFixed(2) : hoverTooltip.currentValue }}
              <span v-if="hoverTooltip.unit" class="text-[11px] text-cyan-400 ml-0.5 font-mono">{{ hoverTooltip.unit }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Extra SCADA Telemetry & Quality Info -->
      <div class="pt-1.5 border-t border-slate-800 text-[10px] text-slate-300 space-y-1">
        <div class="flex items-center justify-between">
          <span>装置编号: <span class="text-slate-100 font-mono font-medium">{{ hoverTooltip.device ? hoverTooltip.device.deviceId : 'DEV-101' }}</span></span>
          <span class="text-emerald-400 font-mono font-semibold">品质: 1 (正常在线)</span>
        </div>
        <div v-if="hoverTooltip.verifyText" class="text-purple-300 truncate font-medium">
          {{ hoverTooltip.verifyText }}
        </div>
      </div>
    </div>

    <!-- Right-Click SCADA Context Menu (Solid, Ultra-High-Contrast, Razor-Sharp Luminous Menu) -->
    <div
      v-if="contextMenu.visible"
      @click.stop
      class="fixed z-50 bg-[#060c1c] border border-cyan-400/80 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.95)] w-64 py-1.5 text-[13px] text-white font-sans divide-y divide-cyan-950/60"
      :style="{
        left: `${Math.round(contextMenu.x)}px`,
        top: `${Math.round(contextMenu.y)}px`,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'geometricPrecision',
        transform: 'translateZ(0)'
      }"
    >
      <!-- Section 1: Switch to Edit Mode & Fullscreen (切换编辑界面 / 全屏 - 迁移到右击菜单中) -->
      <div class="py-1">
        <button
          @click="handleExitPreview(); closeContextMenu();"
          class="w-full px-3 py-1.5 text-left bg-transparent hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 flex items-center justify-between cursor-pointer group font-normal transition-colors"
        >
          <span class="flex items-center gap-2">
            <Edit3 class="w-4 h-4 text-rose-300 stroke-[1.75]" />
            <span class="text-rose-200 group-hover:text-rose-100 font-normal tracking-wide text-[13px]">切换编辑界面 / 退出监控</span>
          </span>
          <span class="text-[11px] text-rose-300/80 font-mono">ESC</span>
        </button>

        <button
          @click="toggleBrowserFullscreen(); closeContextMenu();"
          class="w-full px-3 py-1.5 text-left bg-transparent hover:bg-cyan-500/20 text-slate-100 hover:text-white flex items-center justify-between cursor-pointer group transition-colors mt-0.5"
        >
          <span class="flex items-center gap-2">
            <component :is="isBrowserFullscreen ? Minimize : Maximize" class="w-4 h-4 text-cyan-300 stroke-[1.75]" />
            <span class="text-slate-100 group-hover:text-white font-normal tracking-wide text-[13px]">{{ isBrowserFullscreen ? '退出全屏显示' : '进入全屏大屏模式' }}</span>
          </span>
          <span class="text-[11px] text-cyan-300/80 font-mono">F11</span>
        </button>
      </div>

      <!-- Section 2: SCADA Operations (Direct YK/YT on clicked target) -->
      <div class="py-1">
        <button
          @click="handleOpenControlFromMenu"
          class="w-full px-3 py-1.5 text-left bg-transparent hover:bg-amber-500/20 text-amber-200 hover:text-amber-100 flex items-center justify-between cursor-pointer group transition-colors"
        >
          <span class="flex items-center gap-2">
            <Zap class="w-4 h-4 text-amber-300 stroke-[1.75]" />
            <span class="text-amber-100 group-hover:text-white font-normal tracking-wide text-[13px]">SCADA 遥控/遥调置数</span>
          </span>
          <span class="text-[11px] text-amber-300/80 font-mono font-normal">YK/YT</span>
        </button>
      </div>

      <!-- Section 3: Bottom Bar Toggle (右键菜单控制底栏显隐，默认不显示) -->
      <div class="py-1">
        <button
          @click="showBottomBar = !showBottomBar; closeContextMenu();"
          class="w-full px-3 py-1.5 text-left bg-transparent hover:bg-cyan-500/20 flex items-center justify-between cursor-pointer group transition-colors"
          :class="showBottomBar ? 'text-cyan-300' : 'text-slate-100 hover:text-white'"
        >
          <span class="flex items-center gap-2">
            <PanelBottom class="w-4 h-4 text-cyan-300 stroke-[1.75]" />
            <span class="text-slate-100 group-hover:text-white font-normal tracking-wide text-[13px]">{{ showBottomBar ? '隐藏底部工具栏' : '显示底部工具栏' }}</span>
          </span>
          <component :is="showBottomBar ? CheckSquare : Square" class="w-3.5 h-3.5 text-cyan-300" />
        </button>
      </div>

      <!-- Section 4: View & Ratio Settings -->
      <div class="py-1">
        <button
          @click="emit('toggle:streaming'); closeContextMenu();"
          class="w-full px-3 py-1.5 text-left bg-transparent hover:bg-emerald-500/20 flex items-center justify-between cursor-pointer transition-colors"
          :class="isStreaming ? 'text-emerald-300' : 'text-slate-300'"
        >
          <span class="flex items-center gap-2 font-normal">
            <Pause v-if="isStreaming" class="w-3.5 h-3.5 text-emerald-300 stroke-[1.75]" />
            <Play v-else class="w-3.5 h-3.5 text-slate-400 stroke-[1.75]" />
            <span :class="isStreaming ? 'text-emerald-200' : 'text-slate-300'" class="font-normal tracking-wide text-[13px]">{{ isStreaming ? '暂停实时数据流' : '恢复实时数据流' }}</span>
          </span>
        </button>

        <!-- Scale Mode Submenu / Toggle (No heavy boxes) -->
        <div class="px-3 py-1.5 flex items-center justify-between text-[12px] text-slate-200">
          <span class="font-normal text-slate-200">显示比例:</span>
          <div class="flex items-center gap-1 font-mono">
            <button
              @click="scaleMode = 'fit'"
              class="px-2 py-0.5 rounded text-[11px] font-normal transition-colors cursor-pointer"
              :class="scaleMode === 'fit' ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/60' : 'bg-transparent text-slate-300 hover:text-white hover:bg-cyan-500/10 border border-transparent'"
            >
              自适应
            </button>
            <button
              @click="scaleMode = 'fill'"
              class="px-2 py-0.5 rounded text-[11px] font-normal transition-colors cursor-pointer"
              :class="scaleMode === 'fill' ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/60' : 'bg-transparent text-slate-300 hover:text-white hover:bg-cyan-500/10 border border-transparent'"
            >
              铺满
            </button>
            <button
              @click="scaleMode = 'original'"
              class="px-2 py-0.5 rounded text-[11px] font-normal transition-colors cursor-pointer"
              :class="scaleMode === 'original' ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/60' : 'bg-transparent text-slate-300 hover:text-white hover:bg-cyan-500/10 border border-transparent'"
            >
              1:1
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部大屏监控底栏 (Bottom Bar) -->
    <!-- 默认不显示，可在右键菜单中勾选「显示底部工具栏」打开；所有按钮全部简化为单个纯图标，中文作为浮标悬停提示 -->
    <div
      v-if="showBottomBar"
      class="fixed bottom-0 left-0 right-0 z-40 bg-[#060c1e]/95 backdrop-blur-xl border-t border-cyan-500/40 px-3 py-1.5 flex items-center justify-between text-xs text-slate-200 shadow-[0_-10px_35px_rgba(0,0,0,0.85)] animate-in slide-in-from-bottom-2 duration-150"
    >
      <!-- Left Section: Screen Switching, Alarms, History Curves, UDS Trigger (全部简化为单个纯图标) -->
      <div class="flex items-center gap-1.5">
        <!-- 1. 切换画面 (Screen Switcher - 纯图标) -->
        <div class="relative">
          <button
            @click="showScreenSwitcherPopover = !showScreenSwitcherPopover"
            class="p-2 rounded-lg bg-slate-900/90 border border-slate-700 hover:border-cyan-500 text-slate-200 hover:text-cyan-300 cursor-pointer transition-all flex items-center justify-center relative group"
            :title="`切换画面: ${screens.find(s => s.id === activeScreenId)?.name || '当前画面'}`"
          >
            <Layout class="w-4 h-4 text-cyan-400" />
            <!-- 中文浮标 Tooltip -->
            <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block px-2 py-1 bg-slate-950/95 border border-cyan-500/50 rounded text-[11px] text-cyan-300 whitespace-nowrap shadow-xl z-50">
              切换画面 ({{ screens.find(s => s.id === activeScreenId)?.name || '当前画面' }})
            </span>
          </button>

          <!-- Screen Switcher Popover -->
          <div
            v-if="showScreenSwitcherPopover"
            class="absolute bottom-full left-0 mb-2 w-64 bg-[#081226] border border-cyan-500/50 rounded-xl shadow-[0_-10px_30px_rgba(0,0,0,0.8)] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
          >
            <div class="px-3 py-1 text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1 border-b border-slate-800">
              <Layout class="w-3.5 h-3.5 text-cyan-400" />
              <span>所有 SCADA 画面 ({{ screens.length }}):</span>
            </div>
            <div class="max-h-48 overflow-y-auto custom-scrollbar py-1">
              <button
                v-for="s in screens"
                :key="s.id"
                @click="emit('switch:screen', s.id); showScreenSwitcherPopover = false;"
                class="w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors"
                :class="s.id === activeScreenId ? 'text-cyan-300 font-bold bg-cyan-950/60' : 'text-slate-300'"
              >
                <span class="truncate">{{ s.name }}</span>
                <CheckCircle2 v-if="s.id === activeScreenId" class="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              </button>
            </div>
          </div>
        </div>

        <!-- 2. 查看所有测点历史数据与历史曲线 (History Curves - 纯图标) -->
        <button
          @click="showHistoryModal = true"
          class="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:bg-emerald-900/60 cursor-pointer transition-all shadow-xs flex items-center justify-center relative group"
          title="历史数据与曲线"
        >
          <TrendingUp class="w-4 h-4 text-emerald-400" />
          <!-- 中文浮标 Tooltip -->
          <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block px-2 py-1 bg-slate-950/95 border border-emerald-500/50 rounded text-[11px] text-emerald-300 whitespace-nowrap shadow-xl z-50">
            查看所有测点历史数据与曲线
          </span>
        </button>

        <!-- 3. 查看实时告警流 (Realtime Alarm Stream - 纯图标带角标) -->
        <button
          @click="showAlarmModal = true; unacknowledgedAlarmCount = 0;"
          class="p-2 rounded-lg bg-rose-950/60 border border-rose-500/50 hover:border-rose-400 text-rose-300 hover:bg-rose-900/60 cursor-pointer transition-all shadow-xs flex items-center justify-center relative group"
          title="实时告警流"
        >
          <Bell class="w-4 h-4 text-rose-400 animate-pulse" />
          <span
            v-if="unacknowledgedAlarmCount > 0"
            class="absolute -top-1 -right-1 px-1 py-0.2 rounded-full text-[9px] bg-rose-600 text-white font-mono font-bold leading-none"
          >
            {{ unacknowledgedAlarmCount }}
          </span>
          <!-- 中文浮标 Tooltip -->
          <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block px-2 py-1 bg-slate-950/95 border border-rose-500/50 rounded text-[11px] text-rose-300 whitespace-nowrap shadow-xl z-50">
            实时告警与事件流中心
          </span>
        </button>

        <!-- 4. 触发拉取 UDS 实时数据 (Trigger UDS Realtime Refresh - 纯图标) -->
        <button
          @click="handleTriggerUdsRealtime"
          :disabled="isTriggeringUds"
          class="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500 text-cyan-300 cursor-pointer transition-all flex items-center justify-center relative group"
          title="触发 UDS 刷新"
        >
          <RefreshCw class="w-4 h-4 text-cyan-400" :class="{ 'animate-spin': isTriggeringUds }" />
          <!-- 中文浮标 Tooltip -->
          <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block px-2 py-1 bg-slate-950/95 border border-cyan-500/50 rounded text-[11px] text-cyan-300 whitespace-nowrap shadow-xl z-50">
            {{ isTriggeringUds ? 'UDS 数据拉取中...' : '触发拉取 UDS 实时数据' }}
          </span>
        </button>

        <span v-if="udsTriggerStatus" class="text-[11px] text-emerald-400 font-mono animate-fade-in pl-1">
          {{ udsTriggerStatus }}
        </span>
      </div>

      <!-- Right Section: Fullscreen, User/Login, Logout, Hide Bottom Bar (纯图标) -->
      <div class="flex items-center gap-1.5">
        <!-- 5. 切换全屏 (Toggle Fullscreen - 纯图标) -->
        <button
          @click="toggleBrowserFullscreen"
          class="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-cyan-300 cursor-pointer transition-all flex items-center justify-center relative group"
          title="切换全屏模式 (F11)"
        >
          <component :is="isBrowserFullscreen ? Minimize : Maximize" class="w-4 h-4 text-cyan-400" />
          <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block px-2 py-1 bg-slate-950/95 border border-cyan-500/50 rounded text-[11px] text-cyan-300 whitespace-nowrap shadow-xl z-50">
            {{ isBrowserFullscreen ? '退出全屏 (F11)' : '全屏显示 (F11)' }}
          </span>
        </button>

        <!-- 6. 用户与切换登录 (Switch Login - 纯图标) -->
        <button
          @click="showLoginModal = true"
          class="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-500 text-slate-300 hover:text-amber-300 cursor-pointer transition-all flex items-center justify-center relative group"
          title="切换登录账号"
        >
          <ShieldCheck class="w-4 h-4 text-amber-400" />
          <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block px-2 py-1 bg-slate-950/95 border border-amber-500/50 rounded text-[11px] text-amber-300 whitespace-nowrap shadow-xl z-50">
            当前用户: {{ currentUser.name }} ({{ currentUser.role === 'system_admin' ? '系统用户' : '普通用户' }}) · 点击切换
          </span>
        </button>

        <!-- 7. 注销 (Logout - 纯图标) -->
        <button
          @click="emit('logout')"
          class="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-500 text-amber-400 hover:bg-amber-950/40 cursor-pointer transition-all flex items-center justify-center relative group"
          title="注销 / 返回 SCADA 登录界面"
        >
          <UserCheck class="w-4 h-4" />
          <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block px-2 py-1 bg-slate-950/95 border border-amber-500/50 rounded text-[11px] text-amber-300 whitespace-nowrap shadow-xl z-50">
            注销 / 返回 SCADA 登录界面
          </span>
        </button>

        <!-- 8. 隐藏底栏 (可在右键菜单中再次显示) -->
        <button
          @click="showBottomBar = false"
          class="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-white hover:bg-slate-800 cursor-pointer transition-all ml-1 flex items-center justify-center relative group"
          title="收起底栏"
        >
          <X class="w-4 h-4" />
          <span class="pointer-events-none absolute bottom-full right-0 mb-2 hidden group-hover:block px-2 py-1 bg-slate-950/95 border border-slate-700 rounded text-[11px] text-slate-300 whitespace-nowrap shadow-xl z-50">
            收起底栏 (右键菜单可重新开启)
          </span>
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

    <!-- Realtime Alarm & Event Stream Modal -->
    <RealtimeAlarmModal
      :visible="showAlarmModal"
      @close="showAlarmModal = false"
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
