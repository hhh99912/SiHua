<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
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
  ChevronDown,
  Zap,
  ShieldCheck,
  UserCheck,
  Edit3,
  RefreshCw,
  Eye,
  LogOut,
  Info,
  CheckCircle2,
  Tv,
  Bell,
  PanelBottom,
  CheckSquare,
  Square,
  Flame,
  Radio,
  Cpu,
  Clock,
  Volume2,
  VolumeX,
  Activity,
  FolderTree,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Home,
  Folder,
  Terminal,
  Database,
  SlidersHorizontal
} from 'lucide-vue-next';
import { ScreenConfig, ScreenComponent, DatasetItem, ScreenItem, ScadaDeviceItem } from '../types';
import { PRESET_SCADA_DEVICES } from '../data/presetDatasets';
import { currentUser, canEditCanvas } from '../utils/auth';
import {
  fetchScadaRealtime,
  getAssociatedPointIdsFromComponents,
  getAllPointIdsFromFacilities,
  scadaFacilities,
  invalidateAssociatedPointsCache,
  isComponentBoundToControlOrRegulation,
  findScadaPointDef,
  getFastLiveYc,
  getFastLiveYx,
  scadaLiveTick
} from '../utils/scadaClient';
import WidgetRenderer from './widgets/WidgetRenderer.vue';
import RealtimeAlarmModal from './RealtimeAlarmModal.vue';
import LoginModal from './LoginModal.vue';

interface Props {
  screen: ScreenConfig;
  components: ScreenComponent[];
  datasets: DatasetItem[];
  isStreaming: boolean;
  screens?: ScreenItem[];
  activeScreenId?: string;
  isEmbedded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  screens: () => [],
  isEmbedded: false
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'toggle:streaming'): void;
  (e: 'switch:screen', screenId: string): void;
  (e: 'logout'): void;
  (e: 'open:alarm'): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);
const scaleMode = ref<'fit' | 'original'>('fit');
const isBrowserFullscreen = ref(false);

// 仿照片：五防主机状态与顶部菜单
const interlockStatus = ref<'退出' | '投入'>('退出');
const toggleInterlock = () => {
  interlockStatus.value = interlockStatus.value === '退出' ? '投入' : '退出';
};

const activeTopMenu = ref<'func' | 'config' | 'app' | 'view' | null>(null);
const toggleTopMenu = (menu: 'func' | 'config' | 'app' | 'view') => {
  activeTopMenu.value = activeTopMenu.value === menu ? null : menu;
};
const closeTopMenus = () => {
  activeTopMenu.value = null;
};

// 仿照片：顶部动态时间格式 (例如 10月9日星期五 14:19)
const scadaClockStr = ref('');
const updateScadaClock = () => {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const w = weekdays[now.getDay()];
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  scadaClockStr.value = `${m}月${d}日${w} ${hh}:${mm}`;
};

// 画面切换快速导航 (上一画面 / 下一画面 / 主画面)
const handlePrevScreen = () => {
  if (!props.screens || props.screens.length <= 1) return;
  const idx = props.screens.findIndex(s => s.id === props.activeScreenId);
  const prevIdx = (idx - 1 + props.screens.length) % props.screens.length;
  emit('switch:screen', props.screens[prevIdx].id);
};

const handleNextScreen = () => {
  if (!props.screens || props.screens.length <= 1) return;
  const idx = props.screens.findIndex(s => s.id === props.activeScreenId);
  const nextIdx = (idx + 1) % props.screens.length;
  emit('switch:screen', props.screens[nextIdx].id);
};

const handleHomeScreen = () => {
  const indexScreen = props.screens?.find(s => s.isIndex) || props.screens?.[0];
  if (indexScreen) {
    emit('switch:screen', indexScreen.id);
  }
};

// 缩放操作与缩放系数 (1:1等比无拉伸)
const userZoomFactor = ref(1);
const handleZoomIn = () => {
  userZoomFactor.value = Math.min(3, +(userZoomFactor.value * 1.15).toFixed(2));
};
const handleZoomOut = () => {
  userZoomFactor.value = Math.max(0.3, +(userZoomFactor.value / 1.15).toFixed(2));
};
const handleResetZoom = () => {
  userZoomFactor.value = 1;
  scaleMode.value = 'fit';
};

const handlePrintScreen = () => {
  window.print();
};

// GE-SCADA Left Bay Tree Navigation
const isTreeCollapsed = ref(false);
const treeSearchQuery = ref('');

// 实时全站告警弹窗状态 (支持嵌入 MDI 模式和独立预览模式)
const showAlarmModal = ref(false);
const isMuted = ref(false);

const handleOpenAlarm = () => {
  if (props.isEmbedded) {
    emit('open:alarm');
  } else {
    showAlarmModal.value = true;
  }
};

const showLoginModal = ref(false);
const loginNotice = ref('');

// Trigger SCADA Realtime Refresh state
const isTriggeringScada = ref(false);
const scadaTriggerStatus = ref<string>('');

// GE-SCADA Realtime Grid Total Metrics
const gridTotalPowerP = computed(() => {
  const p1 = getFastLiveYc(62000003) ?? 120.0;
  const p2 = getFastLiveYc(62000061) ?? 22.1;
  const total = ((p1 + p2) / 10).toFixed(2);
  return `${total} MW`;
});

const gridTotalPowerQ = computed(() => {
  const q1 = getFastLiveYc(62000004) ?? 12.0;
  return `${(q1 / 4).toFixed(2)} Mvar`;
});

const gridFrequency = computed(() => {
  const f = getFastLiveYc(62000020) ?? 50.01;
  return `${f.toFixed(2)} Hz`;
});

const gridPowerFactor = computed(() => {
  const pf = getFastLiveYc(62000021) ?? 0.985;
  return pf.toFixed(3);
});

// Latest Rolling SOE Alarm Banner (仿 GE-SCADA 底部跑马灯)
const latestRollingAlarm = ref({
  time: '20:18:32.145',
  level: 'critical',
  bay: '10kV 苏州晟高一体柜',
  message: '【事故SOE】10kV一体柜 6#开关 速断保护I段动作，断路器事故跳闸！(时标 1ms)'
});

// GE-SCADA 底部状态栏核心指标
const safetyDays = ref(1428); // 变电站安全运行天数
const unconfirmedAlarmCount = ref(12); // 未复归告警数量
const showScreenMenu = ref(false); // 底部画面快速切换菜单

// Precision Clock (时间到秒，1000ms 频率避免高频重绘卡顿)
const currentTimeStr = ref('');
const currentTimeSecondStr = ref('');
let clockTimer: any = null;
const updateClock = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  currentTimeSecondStr.value = `${year}-${month}-${day} ${hh}:${mm}:${ss}`;
  currentTimeStr.value = currentTimeSecondStr.value;
};

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
let realtimePollingTimer: any = null;

const handleResize = () => {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
};

// 严格 1000ms 实时轮询：无离屏休眠，底层直读共享内存，带并发防堆积锁
let isPollingRealtime = false;
const pollAssociatedRealtimeData = async () => {
  if (isPollingRealtime) return;
  const { yc_ids, yx_ids } = getAssociatedPointIdsFromComponents(props.components, props.screens);
  if (yc_ids.length === 0 && yx_ids.length === 0) {
    return;
  }
  isPollingRealtime = true;
  try {
    await fetchScadaRealtime({ yc_ids, yx_ids });
  } catch (err) {
    // Background polling silent failure
  } finally {
    isPollingRealtime = false;
  }
};

// Handle SCADA Realtime Manual Trigger (保持原有接口)
const handleTriggerScadaRealtime = async () => {
  if (isTriggeringScada.value) return;
  isTriggeringScada.value = true;
  scadaTriggerStatus.value = '正在拉取实时数据...';
  try {
    const { yc_ids, yx_ids } = getAssociatedPointIdsFromComponents(props.components, props.screens);
    const targetYc = yc_ids.length > 0 ? yc_ids : getAllPointIdsFromFacilities(scadaFacilities.value).yc_ids;
    const targetYx = yx_ids.length > 0 ? yx_ids : getAllPointIdsFromFacilities(scadaFacilities.value).yx_ids;
    const res = await fetchScadaRealtime({ yc_ids: targetYc, yx_ids: targetYx });
    if (res.success) {
      scadaTriggerStatus.value = '数据刷新成功';
    } else {
      scadaTriggerStatus.value = res.error || 'SCADA 刷新失败';
    }
  } catch (err) {
    scadaTriggerStatus.value = 'SCADA 触发失败';
  } finally {
    setTimeout(() => {
      isTriggeringScada.value = false;
      scadaTriggerStatus.value = '';
    }, 1500);
  }
};

// Fixed Canvas Dimensions
const canvasWidth = computed(() => props.screen?.width || 1920);
const canvasHeight = computed(() => props.screen?.height || 1080);

// Viewport container measurement
const mainViewportRef = ref<HTMLElement | null>(null);
const viewportWidth = ref(1200);
const viewportHeight = ref(800);
let resizeObserver: ResizeObserver | null = null;
let resizeRafId: number | null = null;

// 1. 严格计算可见图元的实际外接矩形 (Bounding Box) 避免留白过大
const contentBoundingBox = computed(() => {
  const comps = props.components?.filter(c => c.visible !== false) || [];
  if (comps.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: canvasWidth.value,
      maxY: canvasHeight.value,
      width: canvasWidth.value,
      height: canvasHeight.value
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const c of comps) {
    const x = typeof c.x === 'number' ? c.x : 0;
    const y = typeof c.y === 'number' ? c.y : 0;
    const w = typeof c.width === 'number' && c.width > 0 ? c.width : 40;
    const h = typeof c.height === 'number' && c.height > 0 ? c.height : 40;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  }

  if (!isFinite(minX) || !isFinite(minY) || maxX <= minX || maxY <= minY) {
    return {
      minX: 0,
      minY: 0,
      maxX: canvasWidth.value,
      maxY: canvasHeight.value,
      width: canvasWidth.value,
      height: canvasHeight.value
    };
  }

  // 四周预留合理呼吸边距 (24px 宽, 20px 高)，确保最外侧线条和文字不贴边
  const padX = 24;
  const padY = 20;

  const cMinX = Math.floor(minX - padX);
  const cMinY = Math.floor(minY - padY);
  const cMaxX = Math.ceil(maxX + padX);
  const cMaxY = Math.ceil(maxY + padY);

  return {
    minX: cMinX,
    minY: cMinY,
    maxX: cMaxX,
    maxY: cMaxY,
    width: Math.max(160, cMaxX - cMinX),
    height: Math.max(120, cMaxY - cMinY)
  };
});

// 2. 等比例无拉伸缩放计算 (严禁 scaleX != scaleY，彻底解决拉伸失真)
const fitScale = computed(() => {
  if (scaleMode.value === 'original') {
    return userZoomFactor.value;
  }

  const bbox = contentBoundingBox.value;
  // 可用视口空间，留出安全边距
  const availW = Math.max(300, viewportWidth.value - 24);
  const availH = Math.max(200, viewportHeight.value - 24);

  const sx = availW / bbox.width;
  const sy = availH / bbox.height;

  // 核心：Math.min 保证横纵等比同比例缩放，绝不拉伸失真
  const uniformScale = Math.min(sx, sy) * userZoomFactor.value;
  return Math.max(0.1, uniformScale);
});

// 兼容旧接口的 scaleRatio
const scaleRatio = computed(() => {
  const s = fitScale.value;
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
    loginNotice.value = '请登录【系统用户】以进入组态编辑模式。';
    showLoginModal.value = true;
  }
};

// Component click handler for screen jump & interaction actions
const handlePreviewCompClick = (comp: ScreenComponent) => {
  const act = comp.data?.action;
  const mapping = comp.data?.mapping || {};
  const bound = isComponentBoundToControlOrRegulation(comp);

  if ((act?.type === 'jump-screen' || act?.type === 'switch-screen') && act.targetScreenId) {
    emit('switch:screen', act.targetScreenId);
    return;
  } else if (act?.type === 'link' && act.url) {
    window.open(act.url, '_blank');
    return;
  }

  if (bound.isBound) {
    controlDeviceId.value = String(bound.device?.dev_id || bound.device?.id || act?.deviceId || mapping.deviceId || '7000001');
    controlInitialPointId.value = bound.pointId || null;
    controlInitialTargetVerificationPointId.value = bound.targetVerificationPointId || null;
    if (bound.type === 'yt') {
      showTeleRegulationModal.value = true;
    } else {
      showTeleControlModal.value = true;
    }
    return;
  }

  if (act?.type === 'tele-control') {
    controlDeviceId.value = String(act.deviceId || mapping.deviceId || '7000001');
    controlInitialPointId.value = act.pointId || act.yk_id || mapping.pointId || mapping.yk_id || null;
    controlInitialTargetVerificationPointId.value = act.targetPointId || act.targetVerificationPointId || mapping.targetVerificationPointId || null;
    showTeleControlModal.value = true;
  } else if (act?.type === 'tele-regulation') {
    controlDeviceId.value = String(act.deviceId || mapping.deviceId || '7000001');
    controlInitialPointId.value = act.pointId || act.yt_id || mapping.pointId || mapping.yt_id || null;
    controlInitialTargetVerificationPointId.value = act.targetPointId || act.targetVerificationPointId || mapping.targetVerificationPointId || null;
    showTeleRegulationModal.value = true;
  }
};

// Helper: Resolve Point Info from Component Data
const resolveComponentPointInfo = (comp: ScreenComponent) => {
  const mapping = comp.data?.mapping || {};
  const action = comp.data?.action;

  let devId = mapping.deviceId || action?.deviceId || comp.customProps?.deviceId;
  if (!devId) {
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
  } else if (isRegulation) {
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
  } else if (isBreakerOrIndicator || mapping.stateKey || mapping.statusKey) {
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
  } else if (isMetric || mapping.valueKey || mapping.pointKey) {
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

// Component Mouse Enter & Move -> Tooltip
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
    x: Math.round(Math.min(window.innerWidth - 260, Math.max(10, e.clientX))),
    y: Math.round(Math.min(window.innerHeight - 340, Math.max(10, e.clientY))),
    targetComponent: comp || null,
    targetDeviceId: targetDev,
    targetPointId: targetPt
  };
};

const closeContextMenu = () => {
  contextMenu.value.visible = false;
};


const handleContainerClick = (e: MouseEvent) => {
  closeContextMenu();
  const target = e.target as HTMLElement;
  if (!target.closest('.scada-top-menu-item')) {
    closeTopMenus();
  }
};

let scadaClockTimer: any = null;

// Watch activeScreenId changes - auto reset zoom to fit new screen
watch(
  () => props.activeScreenId,
  () => {
    userZoomFactor.value = 1;
    scaleMode.value = 'fit';
    hoverTooltip.value = null;
    contextMenu.value.visible = false;
    clearTimeout(hoverTimer);
    invalidateAssociatedPointsCache();
    pollAssociatedRealtimeData();
  }
);

onMounted(() => {
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  updateClock();
  clockTimer = setInterval(updateClock, 1000);

  updateScadaClock();
  scadaClockTimer = setInterval(updateScadaClock, 1000);

  // ResizeObserver for main viewport with requestAnimationFrame debouncing
  nextTick(() => {
    if (mainViewportRef.value) {
      viewportWidth.value = mainViewportRef.value.clientWidth || 1200;
      viewportHeight.value = mainViewportRef.value.clientHeight || 800;

      resizeObserver = new ResizeObserver((entries) => {
        if (resizeRafId) cancelAnimationFrame(resizeRafId);
        resizeRafId = requestAnimationFrame(() => {
          for (const entry of entries) {
            if (entry.contentRect) {
              const newW = Math.round(entry.contentRect.width);
              const newH = Math.round(entry.contentRect.height);
              if (newW > 0 && newH > 0 && (newW !== viewportWidth.value || newH !== viewportHeight.value)) {
                viewportWidth.value = newW;
                viewportHeight.value = newH;
              }
            }
          }
        });
      });
      resizeObserver.observe(mainViewportRef.value);
    }
  });

  // 严格保持 1000ms 实时轮询，无离屏休眠
  pollAssociatedRealtimeData();
  realtimePollingTimer = setInterval(pollAssociatedRealtimeData, 1000);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  if (clockTimer) clearInterval(clockTimer);
  if (scadaClockTimer) clearInterval(scadaClockTimer);
  if (realtimePollingTimer) clearInterval(realtimePollingTimer);
  if (resizeRafId) {
    cancelAnimationFrame(resizeRafId);
    resizeRafId = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});
</script>

<template>
  <div
    ref="containerRef"
    class="bg-[#060c18] text-slate-100 flex flex-col overflow-hidden select-none font-sans"
    :class="isEmbedded ? 'w-full h-full relative' : 'fixed inset-0 z-50'"
    @contextmenu.prevent="handlePreviewContextMenu($event)"
    @click="handleContainerClick"
  >
    <!-- ===================================================================== -->
    <!-- 1. KND科能达 SCADA 顶部主应用导航栏与快捷操作工具条 (护眼暖白/米白高质感单行顶栏)   -->
    <!-- ===================================================================== -->
    <header class="h-9.5 bg-[#f7f5ef] border-b border-[#e1ddd4] px-3 flex items-center justify-between shrink-0 shadow-2xs z-30 text-slate-800 font-sans select-none tracking-wide">
      <!-- Left: KND科能达品牌标识 + 功能/配置/应用/视图菜单 + 快捷小工具群 -->
      <div class="flex items-center gap-2 min-w-0">
        <!-- 品牌标识 (用户指定：(KND)科能达，红圈包裹更圆润) -->
        <div class="flex items-center gap-2 pr-3 border-r border-[#e1ddd4] select-none shrink-0">
          <div class="px-2 py-0.5 rounded-full bg-[#d81e06] text-white flex items-center justify-center font-black text-xs shadow-2xs tracking-wide">
            KND
          </div>
          <span class="text-[#d81e06] font-black tracking-wide text-base">
            科能达
          </span>
        </div>

        <!-- SCADA 主下拉菜单群：功能、配置、应用、视图 (删除英文后缀) -->
        <nav class="flex items-center gap-1 text-[13.5px] font-bold shrink-0 tracking-wide text-slate-800">
          <!-- 功能 -->
          <div class="relative scada-top-menu-item">
            <button
              @click.stop="toggleTopMenu('func')"
              class="px-2.5 py-1.5 rounded hover:bg-[#efeae0] text-slate-800 font-bold transition-colors cursor-pointer tracking-wide"
              :class="{ 'bg-[#efeae0] text-sky-700': activeTopMenu === 'func' }"
            >
              功能
            </button>
            <div
              v-if="activeTopMenu === 'func'"
              class="absolute left-0 top-full mt-1 w-52 bg-[#faf8f5] border border-[#e2ddd4] rounded-lg shadow-xl py-1 z-50 text-[13px] text-slate-800 divide-y divide-[#eee9df] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="handlePrevScreen(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>切换上一画面</span>
                  <span class="text-[11px] text-slate-400 font-mono">Alt+←</span>
                </button>
                <button
                  @click="handleNextScreen(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>切换下一画面</span>
                  <span class="text-[11px] text-slate-400 font-mono">Alt+→</span>
                </button>
                <button
                  @click="handleHomeScreen(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>返回主接线图</span>
                  <span class="text-[11px] text-slate-400 font-mono">Home</span>
                </button>
              </div>
              <div class="py-1">
                <button
                  @click="handleTriggerScadaRealtime(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>刷新测点数据</span>
                  <span class="text-[11px] text-slate-400 font-mono">F5</span>
                </button>
                <button
                  @click="handlePrintScreen(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>打印当前图纸</span>
                  <span class="text-[11px] text-slate-400 font-mono">Ctrl+P</span>
                </button>
              </div>
              <div class="py-1">
                <button
                  @click="handleExitPreview(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center justify-between cursor-pointer"
                >
                  <span>退出监控运行</span>
                  <span class="text-[11px] text-rose-400 font-mono">ESC</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 配置 -->
          <div class="relative scada-top-menu-item">
            <button
              @click.stop="toggleTopMenu('config')"
              class="px-2.5 py-1.5 rounded hover:bg-[#efeae0] text-slate-800 font-bold transition-colors cursor-pointer tracking-wide"
              :class="{ 'bg-[#efeae0] text-sky-700': activeTopMenu === 'config' }"
            >
              配置
            </button>
            <div
              v-if="activeTopMenu === 'config'"
              class="absolute left-0 top-full mt-1 w-52 bg-[#faf8f5] border border-[#e2ddd4] rounded-lg shadow-xl py-1 z-50 text-[13px] text-slate-800 divide-y divide-[#eee9df] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="scaleMode = 'fit'; userZoomFactor = 1; closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>画面自动适应</span>
                  <span v-if="scaleMode === 'fit'" class="text-sky-600 font-bold">✓</span>
                </button>
                <button
                  @click="scaleMode = 'original'; userZoomFactor = 1; closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>原始比例 1:1</span>
                  <span v-if="scaleMode === 'original'" class="text-sky-600 font-bold">✓</span>
                </button>
              </div>
              <div class="py-1">
                <button
                  @click="toggleInterlock(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>五防主机 ({{ interlockStatus }})</span>
                </button>
                <button
                  @click="isMuted = !isMuted; closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>声音告警 ({{ isMuted ? '已静音' : '开启' }})</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 应用 -->
          <div class="relative scada-top-menu-item">
            <button
              @click.stop="toggleTopMenu('app')"
              class="px-2.5 py-1.5 rounded hover:bg-[#efeae0] text-slate-800 font-bold transition-colors cursor-pointer tracking-wide"
              :class="{ 'bg-[#efeae0] text-sky-700': activeTopMenu === 'app' }"
            >
              应用
            </button>
            <div
              v-if="activeTopMenu === 'app'"
              class="absolute left-0 top-full mt-1 w-52 bg-[#faf8f5] border border-[#e2ddd4] rounded-lg shadow-xl py-1 z-50 text-[13px] text-slate-800 divide-y divide-[#eee9df] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="handleHomeScreen(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer font-bold text-sky-800"
                >
                  <Zap class="w-4 h-4 text-amber-500" />
                  <span>实时监控主接线</span>
                </button>
                <button
                  @click="handleOpenAlarm(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <Bell class="w-4 h-4 text-rose-500" />
                  <span>全站告警窗 (独立可拖)</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 视图 -->
          <div class="relative scada-top-menu-item">
            <button
              @click.stop="toggleTopMenu('view')"
              class="px-2.5 py-1.5 rounded hover:bg-[#efeae0] text-slate-800 font-bold transition-colors cursor-pointer tracking-wide"
              :class="{ 'bg-[#efeae0] text-sky-700': activeTopMenu === 'view' }"
            >
              视图
            </button>
            <div
              v-if="activeTopMenu === 'view'"
              class="absolute left-0 top-full mt-1 w-52 bg-[#faf8f5] border border-[#e2ddd4] rounded-lg shadow-xl py-1 z-50 text-[13px] text-slate-800 divide-y divide-[#eee9df] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="isTreeCollapsed = !isTreeCollapsed; closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>画面目录树</span>
                  <span class="text-sky-600 font-bold">{{ !isTreeCollapsed ? '显示' : '隐藏' }}</span>
                </button>
                <button
                  @click="scaleMode = 'fit'; closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>自动适应画布</span>
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div class="h-4 w-[1px] bg-slate-300 mx-1 shrink-0" />

        <!-- 快捷小工具单图标按钮组 (无卡片包裹，纯净单图标) -->
        <div class="flex items-center gap-0.5 shrink-0">
          <!-- 目录折叠/展开 -->
          <button
            @click="isTreeCollapsed = !isTreeCollapsed"
            class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            :title="isTreeCollapsed ? '展开左侧目录' : '收起左侧目录'"
          >
            <component :is="isTreeCollapsed ? PanelLeftOpen : PanelLeftClose" class="w-4 h-4 text-slate-700" />
          </button>

          <!-- 主画面 (Home) -->
          <button
            @click="handleHomeScreen"
            class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
            title="返回主画面 (Home)"
          >
            <Home class="w-4 h-4 text-sky-600" />
          </button>

          <!-- 上一画面 (<) -->
          <button
            @click="handlePrevScreen"
            class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
            title="上一画面"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>

          <!-- 下一画面 (>) -->
          <button
            @click="handleNextScreen"
            class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
            title="下一画面"
          >
            <ChevronRight class="w-4 h-4" />
          </button>

          <!-- 打印画面 -->
          <button
            @click="handlePrintScreen"
            class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="打印当前画面"
          >
            <Printer class="w-4 h-4 text-slate-600" />
          </button>

          <!-- 放大 (+) -->
          <button
            @click="handleZoomIn"
            class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-sky-700 transition-colors cursor-pointer font-bold"
            title="放大接线图 (+)"
          >
            <ZoomIn class="w-4 h-4" />
          </button>

          <!-- 缩小 (-) -->
          <button
            @click="handleZoomOut"
            class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-sky-700 transition-colors cursor-pointer font-bold"
            title="缩小接线图 (-)"
          >
            <ZoomOut class="w-4 h-4" />
          </button>

          <!-- 自适应 / 1:1 切换 (单图标式极简按钮) -->
          <button
            @click="scaleMode = scaleMode === 'fill' || scaleMode === 'fit' ? 'original' : 'fit'; userZoomFactor = 1;"
            class="px-1.5 py-1 rounded hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-mono font-bold transition-colors cursor-pointer"
            :title="scaleMode === 'original' ? '切换为自动适应' : '切换为 1:1 原尺寸'"
          >
            {{ scaleMode === 'original' ? '1:1' : '适应' }}
          </button>

          <!-- 刷新 SCADA 实时测点 -->
          <button
            @click="handleTriggerScadaRealtime"
            class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
            title="刷新 SCADA 实时测点数据"
          >
            <RefreshCw class="w-4 h-4 text-sky-600" :class="{ 'animate-spin': isTriggeringScada }" />
          </button>
        </div>
      </div>

      <!-- Center: 当前工况状态 (与周边文字保持相同大小 text-[13px]，无卡片包裹) -->
      <div class="hidden lg:flex items-center gap-3.5 text-[13px] text-slate-700 select-none tracking-wide">
        <!-- 实时态标志 -->
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
          <span>当前状态: <strong class="text-slate-800 font-bold">实时态</strong></span>
        </div>
        <span class="text-slate-300">|</span>
        <!-- 五防主机状态标志 (支持点击投入/退出) -->
        <button
          @click="toggleInterlock"
          class="flex items-center gap-1 hover:text-sky-700 cursor-pointer transition-colors text-[13px]"
          title="点击切换五防主机投入/退出状态"
        >
          <span>五防主机: <strong class="font-bold" :class="interlockStatus === '投入' ? 'text-amber-600' : 'text-slate-800'">{{ interlockStatus }}</strong></span>
        </button>
      </div>

      <!-- Right: 音量、电站名称与全屏/退出控制 (移除顶栏时钟，全部单图标无卡片) -->
      <div class="flex items-center gap-1 shrink-0">
        <!-- 电站/大屏名称标牌 (无卡片包裹，纯净文本) -->
        <div class="text-slate-800 font-bold text-[13px] tracking-wide truncate max-w-[200px] pr-2 border-r border-slate-300">
          {{ screen.name || '速利达光伏发电站' }}
        </div>

        <!-- 声音告警静音切换 -->
        <button
          @click="isMuted = !isMuted"
          class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
          :title="isMuted ? '取消静音' : '告警静音'"
        >
          <component :is="isMuted ? VolumeX : Volume2" class="w-4 h-4 text-slate-600" />
        </button>

        <!-- 全屏切换 -->
        <button
          @click="toggleBrowserFullscreen"
          class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
          title="全屏切换 (F11)"
        >
          <component :is="isBrowserFullscreen ? Minimize : Maximize" class="w-4 h-4" />
        </button>

        <!-- 退出监控运行 (单图标无卡片包裹) -->
        <button
          @click="handleExitPreview"
          class="p-1.5 rounded hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors cursor-pointer"
          title="退出监控运行 (ESC)"
        >
          <LogOut class="w-4 h-4 text-rose-500" />
        </button>
      </div>
    </header>

    <!-- ===================================================================== -->
    <!-- 2. 中间主体：左侧画面目录树 + 中央电气主接线画布 (Workspace)            -->
    <!-- ===================================================================== -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- 2.1 左侧画面目录导航栏 (关闭时完全隐藏，无微型侧栏；无设备工况统计) -->
      <aside
        v-if="!isTreeCollapsed"
        class="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0 text-slate-800 z-20 shadow-xs select-none tracking-wide"
      >
        <!-- 侧栏顶标 -->
        <div class="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div class="flex items-center gap-2 text-[13px] font-bold text-slate-900">
            <FolderTree class="w-4 h-4 text-sky-600" />
            <span>画面列表 ({{ screens.length }})</span>
          </div>
          <button
            @click="isTreeCollapsed = true"
            class="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="收起目录"
          >
            <PanelLeftClose class="w-4 h-4" />
          </button>
        </div>

        <!-- 画面列表 (按要求删去设备运行工况统计) -->
        <div class="flex-1 overflow-y-auto p-2 space-y-1.5 text-[13px]" style="scrollbar-gutter: stable;">
          <div
            v-for="s in screens"
            :key="s.id"
            @click="emit('switch:screen', s.id)"
            class="px-2.5 py-2 rounded-md cursor-pointer transition-all flex items-center justify-between border"
            :class="s.id === activeScreenId ? 'bg-sky-50 border-sky-300 text-sky-900 font-bold shadow-2xs' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'"
          >
            <div class="flex items-center gap-2.5 truncate">
              <Zap class="w-4 h-4 shrink-0" :class="s.id === activeScreenId ? 'text-sky-600' : 'text-slate-400'" />
              <span class="truncate font-medium">{{ s.name }}</span>
            </div>
            <span
              v-if="s.id === activeScreenId"
              class="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0"
            />
          </div>
        </div>
      </aside>

      <!-- 2.2 中央电气主接线工作画布 (Canvas Viewport) -->
      <!-- 留白部分直接继续用背景色填充，绝不拉伸失真，裁剪放大到适屏尺寸，左右居中，上对齐 -->
      <main
        ref="mainViewportRef"
        class="flex-1 relative overflow-auto select-none flex flex-col items-center justify-start p-2 transition-colors"
        :style="{
          backgroundColor: screen.backgroundColor || '#080f1e'
        }"
      >
        <!-- 外层定寸包裹容器：严格等于裁剪放大后的尺寸，保证水平居中与上对齐 -->
        <div
          class="relative shrink-0 transition-all duration-100 ease-out"
          :style="{
            width: `${Math.round(contentBoundingBox.width * fitScale)}px`,
            height: `${Math.round(contentBoundingBox.height * fitScale)}px`
          }"
        >
          <!-- 内部定点缩放层：等比例严格放大，彻底消除拉伸失真 -->
          <div
            class="absolute top-0 left-0 origin-top-left"
            :style="{
              width: `${contentBoundingBox.width}px`,
              height: `${contentBoundingBox.height}px`,
              transform: `scale(${fitScale})`,
              backgroundColor: screen.backgroundColor || '#080f1e',
              backgroundImage: screen.backgroundImage ? `url(${screen.backgroundImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }"
          >
            <!-- 逐图元精准渲染 (按 contentBoundingBox.minX, minY 平移对齐) -->
            <div
              v-for="comp in components"
              :key="comp.id"
              class="absolute"
              :class="{
                'opacity-0 pointer-events-none': comp.visible === false,
                'cursor-pointer': comp.data?.action && comp.data.action.type !== 'none'
              }"
              :style="{
                left: `${(comp.x || 0) - contentBoundingBox.minX}px`,
                top: `${(comp.y || 0) - contentBoundingBox.minY}px`,
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
        </div>

        <!-- 悬浮测点参数提示卡 (GE-SCADA 风格) -->
        <div
          v-if="hoverTooltip && hoverTooltip.visible"
          class="fixed z-50 pointer-events-none bg-[#091326] border border-sky-400 p-3 rounded-lg shadow-[0_12px_35px_rgba(0,0,0,0.95)] font-mono text-xs text-white w-80 flex flex-col gap-2"
          :style="{
            left: `${Math.round(hoverTooltip.x)}px`,
            top: `${Math.round(hoverTooltip.y)}px`
          }"
        >
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <div class="flex items-center gap-1.5 truncate">
              <span class="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
              <span class="text-slate-200 font-bold truncate">
                {{ hoverTooltip.device ? hoverTooltip.device.name : 'SCADA 测控装置' }}
              </span>
            </div>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0"
              :class="{
                'bg-sky-950 text-sky-300 border border-sky-500/50': hoverTooltip.pointType === 'YC',
                'bg-emerald-950 text-emerald-300 border border-emerald-500/50': hoverTooltip.pointType === 'YX',
                'bg-purple-950 text-purple-300 border border-purple-500/50': hoverTooltip.pointType === 'YK',
                'bg-amber-950 text-amber-300 border border-amber-500/50': hoverTooltip.pointType === 'YT',
                'bg-blue-950 text-blue-300 border border-blue-500/50': hoverTooltip.pointType === 'DD'
              }"
            >
              {{ hoverTooltip.pointType }}_{{ hoverTooltip.pointId }}
            </span>
          </div>

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
                <span v-else class="text-sky-300 text-sm font-bold">
                  {{ typeof hoverTooltip.currentValue === 'number' ? hoverTooltip.currentValue.toFixed(2) : hoverTooltip.currentValue }}
                  <span v-if="hoverTooltip.unit" class="text-[11px] text-sky-400 ml-0.5 font-mono">{{ hoverTooltip.unit }}</span>
                </span>
              </div>
            </div>
          </div>

          <div class="pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 space-y-1">
            <div class="flex items-center justify-between">
              <span>装置编号: <span class="text-slate-200 font-mono">{{ hoverTooltip.device ? hoverTooltip.device.deviceId : 'DEV-101' }}</span></span>
              <span class="text-emerald-400 font-mono font-semibold">品质: 0 (正常在线)</span>
            </div>
          </div>
        </div>

        <!-- 右键操作菜单 (GE-SCADA 标准右键菜单) -->
        <div
          v-if="contextMenu.visible"
          @click.stop
          class="fixed z-50 bg-[#060c1c] border-2 border-sky-400/80 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.95)] w-68 py-2 text-xs text-white font-sans divide-y divide-[#172744]"
          :style="{
            left: `${Math.round(contextMenu.x)}px`,
            top: `${Math.round(contextMenu.y)}px`
          }"
        >
          <!-- 组态模式切换 -->
          <div class="py-1">
            <button
              @click="handleExitPreview(); closeContextMenu();"
              class="w-full px-3 py-1.5 text-left hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 flex items-center justify-between cursor-pointer"
            >
              <span class="flex items-center gap-2">
                <Edit3 class="w-3.5 h-3.5 text-rose-300" />
                <span>退出监控 / 组态编辑模式</span>
              </span>
              <span class="text-[10px] text-rose-400 font-mono">ESC</span>
            </button>
          </div>

          <!-- 缩放控制 -->
          <div class="py-1 px-3 flex items-center justify-between text-[11px] text-slate-300">
            <span>显示比例:</span>
            <div class="flex items-center gap-1 font-mono">
              <button
                @click="scaleMode = 'fit'"
                class="px-1.5 py-0.5 rounded text-[10px]"
                :class="scaleMode === 'fit' ? 'bg-sky-600 text-white font-bold' : 'hover:bg-slate-800 text-slate-400'"
              >
                自适应
              </button>
              <button
                @click="scaleMode = 'fill'"
                class="px-1.5 py-0.5 rounded text-[10px]"
                :class="scaleMode === 'fill' ? 'bg-sky-600 text-white font-bold' : 'hover:bg-slate-800 text-slate-400'"
              >
                铺满
              </button>
              <button
                @click="scaleMode = 'original'"
                class="px-1.5 py-0.5 rounded text-[10px]"
                :class="scaleMode === 'original' ? 'bg-sky-600 text-white font-bold' : 'hover:bg-slate-800 text-slate-400'"
              >
                1:1
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- ===================================================================== -->
    <!-- 3. GE-SCADA 底部功能菜单栏 (白色主题，按用户要求一切功能按钮简洁显示)  -->
    <!-- ===================================================================== -->
    <footer 
      v-if="!isEmbedded" 
      class="bg-[#f7f5ef] border-t border-[#e1ddd4] flex flex-col shrink-0 select-none z-40 font-sans relative shadow-xs text-slate-800"
    >
      <!-- 3.1 顶部实时跑马灯告警带 (Rolling SOE Alarm Strip) -->
      <div class="h-6.5 bg-[#f4f1ea] border-b border-[#e1ddd4] px-3 flex items-center justify-between text-xs font-mono">
        <div class="flex items-center gap-2 truncate flex-1 mr-4">
          <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-600 text-white uppercase animate-pulse shrink-0">
            最新告警
          </span>
          <span class="text-sky-700 font-bold shrink-0">[{{ latestRollingAlarm.time }}]</span>
          <span class="text-slate-600 font-semibold shrink-0">[{{ latestRollingAlarm.bay }}]</span>
          <span class="text-rose-600 truncate font-sans">{{ latestRollingAlarm.message }}</span>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button
            @click="handleOpenAlarm"
            class="px-2 py-0.5 rounded bg-[#faf8f5] hover:bg-[#efeae0] border border-[#e2ddd4] text-slate-700 text-[10px] font-bold transition-colors cursor-pointer"
          >
            告警窗
          </button>
        </div>
      </div>

      <!-- 3.2 简洁底部主控制与状态菜单栏 (护眼暖白/米白背景，字号放大更清晰) -->
      <div class="h-9 px-3 flex items-center justify-between text-[13px] bg-[#f7f5ef] tracking-wide">
        <!-- 左侧：基础功能按钮群 (简洁显示) -->
        <div class="flex items-center gap-1.5">
          <!-- 1. 一次主接线 -->
          <button
            @click="scaleMode = 'fill'"
            class="px-3 py-1.5 rounded-md text-[13px] font-bold transition-colors flex items-center gap-2 cursor-pointer bg-sky-50 border border-sky-300 text-sky-800 shadow-2xs"
            title="一次电气主接线图 (当前画面)"
          >
            <Zap class="w-4 h-4 text-sky-600" />
            <span>主接线图</span>
          </button>

          <!-- 2. 全站告警 (含未确认数量角标) -->
          <button
            @click="handleOpenAlarm"
            class="px-3 py-1.5 rounded-md text-[13px] font-bold text-slate-800 hover:text-sky-700 hover:bg-[#efeae0] border border-[#e2ddd4] transition-colors flex items-center gap-2 cursor-pointer relative"
            title="查看全站 SOE 事件与实时告警窗"
          >
            <Bell class="w-4 h-4 text-rose-500" :class="{ 'animate-pulse': unconfirmedAlarmCount > 0 }" />
            <span>全站告警</span>
            <span
              v-if="unconfirmedAlarmCount > 0"
              class="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold leading-none animate-pulse"
            >
              {{ unconfirmedAlarmCount }}
            </span>
          </button>

          <!-- 3. 画面切换快捷菜单 -->
          <div class="relative">
            <button
              @click="showScreenMenu = !showScreenMenu"
              class="px-3 py-1.5 rounded-md text-[13px] font-bold text-slate-800 hover:bg-[#efeae0] border border-[#e2ddd4] transition-colors flex items-center gap-1.5 cursor-pointer"
              title="快速切换监控画面"
            >
              <Layout class="w-4 h-4 text-sky-600" />
              <span>画面切换</span>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
            </button>

            <!-- 画面切换悬浮列表 (暖白米白高质感) -->
            <div
              v-if="showScreenMenu"
              class="absolute left-0 bottom-full mb-2 w-64 bg-[#faf8f5] border border-[#e2ddd4] rounded-xl shadow-xl py-1.5 z-50 text-[13px] text-slate-800 divide-y divide-[#eee9df] tracking-wide"
            >
              <div class="px-3.5 py-1.5 text-[11px] text-slate-500 font-bold font-mono uppercase flex items-center justify-between">
                <span>变电站大屏画面 ({{ screens.length }})</span>
                <button @click="showScreenMenu = false" class="text-slate-400 hover:text-slate-700">✕</button>
              </div>
              <div class="max-h-64 overflow-y-auto py-1">
                <button
                  v-for="s in screens"
                  :key="s.id"
                  @click="emit('switch:screen', s.id); showScreenMenu = false;"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] hover:text-sky-700 flex items-center justify-between transition-colors cursor-pointer"
                  :class="{ 'bg-sky-50 text-sky-800 font-bold': s.id === activeScreenId }"
                >
                  <div class="flex items-center gap-2.5 truncate">
                    <Zap class="w-4 h-4 text-sky-600 shrink-0" />
                    <span class="truncate">{{ s.name }}</span>
                  </div>
                  <span v-if="s.id === activeScreenId" class="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：简洁状态与时钟 -->
        <div class="flex items-center gap-2.5 text-[13px]">
          <!-- 消音按钮 -->
          <button
            @click="isMuted = !isMuted"
            class="p-1.5 rounded-md border border-[#e2ddd4] hover:bg-[#efeae0] transition-colors cursor-pointer"
            :class="isMuted ? 'text-slate-400' : 'text-slate-700'"
            :title="isMuted ? '警报音已消音' : '警报音正常'"
          >
            <component :is="isMuted ? VolumeX : Volume2" class="w-4 h-4" />
          </button>

          <!-- 安全天数 -->
          <div
            class="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[12.5px]"
            title="变电站连续安全运行天数"
          >
            <ShieldCheck class="w-4 h-4 text-emerald-600" />
            <span>安全运行 {{ safetyDays }} 天</span>
          </div>

          <!-- 账号 -->
          <button
            @click="showLoginModal = true"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-[#efeae0] border border-[#e2ddd4] text-slate-800 font-mono font-bold transition-colors cursor-pointer"
            :title="`当前账号: ${currentUser.name}`"
          >
            <UserCheck class="w-4 h-4 text-sky-600" />
            <span>{{ currentUser.name }}</span>
          </button>

          <!-- 秒时钟 -->
          <div class="flex items-center gap-1.5 font-mono text-[13px] font-bold text-slate-800 bg-[#f4f1ea] px-2.5 py-1 rounded-md border border-[#e2ddd4]">
            <Clock class="w-4 h-4 text-sky-600" />
            <span>{{ currentTimeSecondStr }}</span>
          </div>
        </div>
      </div>
    </footer>

    <!-- ===================================================================== -->
    <!-- 4. 模态窗口与服务集成 (独立全站告警窗与认证)                       -->
    <!-- ===================================================================== -->
    <!-- 4.1 SOE 实时告警窗 (独立或嵌入式) -->
    <RealtimeAlarmModal
      v-if="showAlarmModal"
      :visible="showAlarmModal"
      @close="showAlarmModal = false"
    />

    <!-- 4.2 用户认证弹窗 -->
    <LoginModal
      v-if="showLoginModal"
      :notice="loginNotice"
      @close="showLoginModal = false; loginNotice = '';"
      @success="showLoginModal = false; loginNotice = '';"
    />
  </div>
</template>
