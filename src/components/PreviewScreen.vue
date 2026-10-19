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
import ScadaTeleControlModal from './ScadaTeleControlModal.vue';
import ScadaTeleRegulationModal from './ScadaTeleRegulationModal.vue';

interface Props {
  screen: ScreenConfig;
  components: ScreenComponent[];
  datasets: DatasetItem[];
  isStreaming: boolean;
  screens?: ScreenItem[];
  activeScreenId?: string;
  indexScreenId?: string;
  indexScreenName?: string;
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
  (e: 'reload:current-screen'): void;
  (e: 'logout'): void;
  (e: 'open:alarm'): void;
  (e: 'open:control', devId: string, pointId: any, type: 'control' | 'regulation', targetPointId?: any): void;
}>();

// 工业遥控/遥调模态框状态与参数
const showTeleControlModal = ref(false);
const showTeleRegulationModal = ref(false);
const controlDeviceId = ref<string>('7000001');
const controlInitialPointId = ref<string | number | null>(null);
const controlInitialTargetVerificationPointId = ref<string | number | null>(null);

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
  let targetScreen = null;
  if (props.indexScreenId) {
    targetScreen = props.screens?.find(s => s.id === props.indexScreenId);
  }
  if (!targetScreen && props.indexScreenName) {
    const targetName = props.indexScreenName.trim().toLowerCase();
    targetScreen = props.screens?.find(s => s.name.trim().toLowerCase() === targetName);
  }
  if (!targetScreen) {
    targetScreen = props.screens?.find(s => 
      (s as any).isIndex || 
      s.name.includes('主索引') || 
      s.name.includes('主接线') ||
      s.name.includes('主网')
    );
  }
  if (!targetScreen && props.screens && props.screens.length > 0) {
    targetScreen = props.screens[0];
  }
  if (targetScreen) {
    emit('switch:screen', targetScreen.id);
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
let gcTimer: any = null;
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

// Context Menu State (支持遥控遥调、测点层级与直接退出编辑)
const contextMenu = ref<{
  visible: boolean;
  x: number;
  y: number;
  targetComponent: ScreenComponent | null;
  hasControl: boolean;
  hasRegulation: boolean;
  hierarchyText: string;
  pointType: string;
}>({
  visible: false,
  x: 0,
  y: 0,
  targetComponent: null,
  hasControl: false,
  hasRegulation: false,
  hierarchyText: '',
  pointType: ''
});

// Hovered Point Tooltip State (浮标格式: 间隔-设备-测点名称，简洁紧凑)
const hoverTooltip = ref<{
  visible: boolean;
  x: number;
  y: number;
  comp: ScreenComponent;
  pointId: number | string;
  pointType: 'YC' | 'YX' | 'YK' | 'YT' | 'DD';
  hierarchyText: string;
  displayValueText: string;
} | null>(null);

let hoverTimer: any = null;
let realtimePollingTimer: any = null;

const handleResize = () => {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
};

// 严格工业级实时轮询：自适应抗雪崩间隔（测点少 1000ms，400+ 测点 1500~2000ms），链式防堆积调度，杜绝工控机 CPU 跑满引发看门狗饿死
let isPollingRealtime = false;
let isUnmounted = false;

const scheduleNextPoll = (delayMs: number = 1000) => {
  if (isUnmounted) return;
  if (realtimePollingTimer) {
    clearTimeout(realtimePollingTimer);
    realtimePollingTimer = null;
  }
  realtimePollingTimer = setTimeout(pollAssociatedRealtimeData, delayMs);
};

const pollAssociatedRealtimeData = async () => {
  if (isPollingRealtime || isUnmounted) return;
  // 关键优化：仅提取当前激活画面的测点，严禁将全工程全部画面的几千个测点全量叠加发送
  const { yc_ids, yx_ids } = getAssociatedPointIdsFromComponents(props.components);
  const totalPoints = yc_ids.length + yx_ids.length;
  if (totalPoints === 0) {
    scheduleNextPoll(2000);
    return;
  }
  isPollingRealtime = true;
  try {
    await fetchScadaRealtime({ yc_ids, yx_ids });
  } catch (err) {
    // Background polling silent failure
  } finally {
    isPollingRealtime = false;
    // 400+ 测点平滑机制：根据点位量自适应调节轮询节奏，消除每秒密集高并发对 C++ 服务端与 Linux 看门狗的压力
    const nextInterval = totalPoints > 200 ? 2000 : (totalPoints > 80 ? 1500 : 1000);
    scheduleNextPoll(nextInterval);
  }
};

// Handle Reload Current Screen (重新加载当前画面)
const handleReloadCurrentScreen = async () => {
  if (isTriggeringScada.value) return;
  isTriggeringScada.value = true;
  scadaTriggerStatus.value = '正在重新加载当前画面...';
  try {
    emit('reload:current-screen');
    invalidateAssociatedPointsCache();
    const { yc_ids, yx_ids } = getAssociatedPointIdsFromComponents(props.components, props.screens);
    const targetYc = yc_ids.length > 0 ? yc_ids : getAllPointIdsFromFacilities(scadaFacilities.value).yc_ids;
    const targetYx = yx_ids.length > 0 ? yx_ids : getAllPointIdsFromFacilities(scadaFacilities.value).yx_ids;
    const res = await fetchScadaRealtime({ yc_ids: targetYc, yx_ids: targetYx });
    if (res.success) {
      scadaTriggerStatus.value = '画面重新加载完成';
    } else {
      scadaTriggerStatus.value = res.error || '重新加载完成';
    }
  } catch (err) {
    scadaTriggerStatus.value = '重新加载完成';
  } finally {
    setTimeout(() => {
      isTriggeringScada.value = false;
      scadaTriggerStatus.value = '';
    }, 1200);
  }
};
const handleTriggerScadaRealtime = handleReloadCurrentScreen;

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

// Exit Preview Handler (退出监控直接跳转编辑界面)
const handleExitPreview = () => {
  emit('close');
};

// Component click handler for screen jump & interaction actions (单机仅处理画面跳转与超链接，遥控遥调通过右键菜单执行)
const handlePreviewCompClick = (comp: ScreenComponent) => {
  const act = comp.data?.action;

  if ((act?.type === 'jump-screen' || act?.type === 'switch-screen') && act.targetScreenId) {
    emit('switch:screen', act.targetScreenId);
    return;
  } else if (act?.type === 'link' && act.url) {
    window.open(act.url, '_blank');
    return;
  }
};

// Helper: Resolve Point Info from Component Data (只有关联好测点的才显示浮标，按钮等都不显示)
// 浮标格式: 间隔-设备-测点名称
const resolveComponentPointInfo = (comp: ScreenComponent) => {
  if (!comp) return null;

  // 1. 明确排除按钮等交互控制组件与非测点组件
  if (comp.type === 'ctrl-button') {
    return null;
  }

  const mapping = comp.data?.mapping || {};
  const action = comp.data?.action;
  const customProps = comp.customProps || {};

  // 2. 检查是否确实已关联有效测点 (未关联测点绝不显示浮标)
  let pointId: number | string | null = null;
  let pointCategory: 'yc' | 'yx' | 'yk' | 'yt' | 'dd' | null = null;
  let deviceId: string | number | null = mapping.deviceId || action?.deviceId || customProps.deviceId || null;

  if (mapping.pointId !== undefined && mapping.pointId !== null && mapping.pointId !== '') {
    pointId = mapping.pointId;
    if (mapping.pointCategory === 'teleSignal' || mapping.pointCategory === 'yx' || ['elec-breaker', 'elec-disconnector', 'elec-grounding', 'elec-handcart', 'ctrl-indicator'].includes(comp.type)) {
      pointCategory = 'yx';
    } else if (mapping.pointCategory === 'energy' || mapping.pointCategory === 'dd') {
      pointCategory = 'dd';
    } else if (mapping.pointCategory === 'teleControl' || mapping.pointCategory === 'yk') {
      pointCategory = 'yk';
    } else if (mapping.pointCategory === 'teleRegulation' || mapping.pointCategory === 'yt') {
      pointCategory = 'yt';
    } else {
      pointCategory = 'yc';
    }
  } else if (mapping.yk_id || mapping.ykPointId) {
    pointId = mapping.yk_id || mapping.ykPointId;
    pointCategory = 'yk';
  } else if (mapping.yt_id || mapping.ytPointId) {
    pointId = mapping.yt_id || mapping.ytPointId;
    pointCategory = 'yt';
  } else if (mapping.yc_id || mapping.ycPointId) {
    pointId = mapping.yc_id || mapping.ycPointId;
    pointCategory = 'yc';
  } else if (mapping.yx_id || mapping.yxPointId) {
    pointId = mapping.yx_id || mapping.yxPointId;
    pointCategory = 'yx';
  } else if (mapping.valueKey) {
    const m = String(mapping.valueKey).match(/^(?:([A-Za-z0-9_-]+)_)?(YC|YX|YK|YT|DD)_(\d+)/i);
    if (m) {
      if (m[1]) deviceId = m[1];
      pointCategory = m[2].toLowerCase() as any;
      pointId = Number(m[3]);
    }
  } else if (mapping.stateKey) {
    const m = String(mapping.stateKey).match(/^(?:([A-Za-z0-9_-]+)_)?(YC|YX|YK|YT|DD)_(\d+)/i);
    if (m) {
      if (m[1]) deviceId = m[1];
      pointCategory = m[2].toLowerCase() as any;
      pointId = Number(m[3]);
    }
  } else if (mapping.pointKey) {
    const m = String(mapping.pointKey).match(/^(?:([A-Za-z0-9_-]+)_)?(YC|YX|YK|YT|DD)_(\d+)/i);
    if (m) {
      if (m[1]) deviceId = m[1];
      pointCategory = m[2].toLowerCase() as any;
      pointId = Number(m[3]);
    }
  } else if (customProps.pointId) {
    pointId = customProps.pointId;
    pointCategory = customProps.category || 'yc';
  }

  // 若未关联具体测点 ID，直接返回 null，不展示任何浮标
  if (!pointId) {
    return null;
  }

  // 3. 高精度解析: 间隔 - 设备 - 测点名称
  let bayName = '';
  let devName = '';
  let pointName = '';
  let unit = mapping.unit || '';

  const pointDef = findScadaPointDef(pointId);
  if (pointDef && pointDef.category !== 'none') {
    bayName = pointDef.bay?.name || pointDef.bay?.bay_name || '';
    devName = pointDef.device?.name || pointDef.device?.dev_name || '';
    pointName = pointDef.point?.name || '';
    if (pointDef.point?.unit) unit = pointDef.point.unit;
    if (!pointCategory) pointCategory = pointDef.category;
  }

  if (!bayName || !devName) {
    for (const fac of scadaFacilities.value || []) {
      for (const b of fac.bays || []) {
        for (const d of b.devices || b.cb_devices || []) {
          if (deviceId && String(d.dev_id || d.id) === String(deviceId)) {
            if (!bayName) bayName = b.name || b.bay_name || '';
            if (!devName) devName = d.name || d.dev_name || '';
          }
          const pts = [
            ...(d.yc_list || d.yc_points || []),
            ...(d.yx_list || d.yx_points || []),
            ...(d.yk_list || d.yk_points || []),
            ...(d.yt_list || d.yt_points || []),
            ...(d.dd_list || d.dd_points || [])
          ];
          const found = pts.find(p => p.id === Number(pointId));
          if (found) {
            if (!bayName) bayName = b.name || b.bay_name || '';
            if (!devName) devName = d.name || d.dev_name || '';
            if (!pointName) pointName = found.name || '';
            if (found.unit) unit = found.unit;
            break;
          }
        }
      }
    }
  }

  if (!devName) devName = mapping.deviceName || (deviceId ? `装置${deviceId}` : '测控装置');
  if (!pointName) pointName = mapping.pointName || comp.name || `测点${pointId}`;
  if (!bayName) bayName = mapping.bayName || '';

  // 严格格式: 间隔-设备-测点名称
  const hierarchyText = bayName ? `${bayName}-${devName}-${pointName}` : `${devName}-${pointName}`;

  // 实时数值/状态转换
  const pCat = (pointCategory || 'yc').toUpperCase() as 'YC' | 'YX' | 'YK' | 'YT' | 'DD';
  let displayValueText = '';
  if (pCat === 'YC') {
    const num = getFastLiveYc(Number(pointId));
    displayValueText = `${typeof num === 'number' ? num.toFixed(2) : num}${unit ? ' ' + unit : ''}`;
  } else if (pCat === 'YX') {
    const yxVal = getFastLiveYx(Number(pointId));
    displayValueText = yxVal === 1 ? '合闸' : (yxVal === 2 ? '故障' : '分闸');
  }

  return {
    comp,
    pointId,
    pointType: pCat,
    hierarchyText,
    displayValueText
  };
};

// Component Mouse Enter & Move -> Tooltip (简洁紧凑工业浮标)
const updateTooltipPosition = (e: MouseEvent) => {
  const tooltipWidth = 280;
  const tooltipHeight = 36;
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
  if (!info) {
    hoverTooltip.value = null;
    return;
  }

  const pos = updateTooltipPosition(e);
  hoverTooltip.value = {
    ...info,
    visible: true,
    x: pos.x,
    y: pos.y
  };
};

let tooltipRaf: number | null = null;

const handleCompMouseMove = (e: MouseEvent, comp: ScreenComponent) => {
  if (!hoverTooltip.value || !hoverTooltip.value.visible) {
    const info = resolveComponentPointInfo(comp);
    if (!info) {
      hoverTooltip.value = null;
      return;
    }
    const pos = updateTooltipPosition(e);
    hoverTooltip.value = { ...info, visible: true, x: pos.x, y: pos.y };
    return;
  }
  if (tooltipRaf === null) {
    const clientX = e.clientX;
    const clientY = e.clientY;
    tooltipRaf = requestAnimationFrame(() => {
      tooltipRaf = null;
      if (hoverTooltip.value && hoverTooltip.value.visible) {
        const pos = updateTooltipPosition({ clientX, clientY } as MouseEvent);
        if (Math.abs(hoverTooltip.value.x - pos.x) > 2 || Math.abs(hoverTooltip.value.y - pos.y) > 2) {
          hoverTooltip.value.x = pos.x;
          hoverTooltip.value.y = pos.y;
        }
      }
    });
  }
};

const handleCompMouseLeave = () => {
  if (tooltipRaf !== null) {
    cancelAnimationFrame(tooltipRaf);
    tooltipRaf = null;
  }
  clearTimeout(hoverTimer);
  hoverTooltip.value = null;
};

// Right-click Context Menu (右击菜单承接全部遥控遥调操作，样式参考编辑界面，删除显示比例，退出监控直接跳转编辑界面)
const handlePreviewContextMenu = (e: MouseEvent, comp?: ScreenComponent) => {
  e.preventDefault();
  e.stopPropagation();

  let hasControl = false;
  let hasRegulation = false;
  let hierarchyText = '';
  let pointType = '';

  if (comp) {
    const info = resolveComponentPointInfo(comp);
    if (info) {
      hierarchyText = info.hierarchyText;
      pointType = info.pointType;
    }

    const bound = isComponentBoundToControlOrRegulation(comp);
    const act = comp.data?.action;
    const mapping = comp.data?.mapping || {};
    const isBreakerOrSwitch = ['elec-breaker', 'elec-disconnector', 'elec-grounding', 'elec-handcart', 'ctrl-indicator'].includes(comp.type);
    const isTransform = ['elec-transformer', 'elec-transformer-3w', 'elec-transformer-tap'].includes(comp.type);

    hasControl = isBreakerOrSwitch || comp.type === 'ctrl-button' || act?.type === 'tele-control' || mapping.pointCategory === 'teleControl' || (bound.isBound && bound.type === 'yk');

    hasRegulation = isTransform || act?.type === 'tele-regulation' || mapping.pointCategory === 'teleRegulation' || (bound.isBound && bound.type === 'yt');
  }

  const menuWidth = 288;
  const menuHeight = hasControl || hasRegulation ? 230 : 120;
  const x = Math.min(window.innerWidth - menuWidth - 10, Math.max(10, e.clientX));
  const y = Math.min(window.innerHeight - menuHeight - 10, Math.max(10, e.clientY));

  contextMenu.value = {
    visible: true,
    x,
    y,
    targetComponent: comp || null,
    hasControl,
    hasRegulation,
    hierarchyText,
    pointType
  };
};

const executeContextMenuControl = (type: 'control' | 'regulation') => {
  const comp = contextMenu.value.targetComponent;
  if (!comp) return;

  const bound = isComponentBoundToControlOrRegulation(comp);
  const data = comp?.data || {};
  const mapping = data.mapping || {};
  const action = data.action;

  const devId = String(bound.device?.dev_id || bound.device?.id || action?.deviceId || mapping.deviceId || '7000001');
  const ptId = bound.pointId || action?.pointId || (type === 'regulation' ? action?.yt_id || mapping.yt_id : action?.yk_id || mapping.yk_id) || mapping.pointId || 1;
  const targetPtId = bound.targetVerificationPointId || action?.targetVerificationPointId || action?.targetPointId || mapping.targetVerificationPointId || (type === 'regulation' ? mapping.targetYcPointId : mapping.targetYxPointId) || null;

  controlDeviceId.value = devId;
  controlInitialPointId.value = ptId;
  controlInitialTargetVerificationPointId.value = targetPtId;

  if (type === 'regulation') {
    showTeleRegulationModal.value = true;
    emit('open:control', devId, ptId, 'regulation', targetPtId);
  } else {
    showTeleControlModal.value = true;
    emit('open:control', devId, ptId, 'control', targetPtId);
  }
  closeContextMenu();
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
    scheduleNextPoll(100);
  }
);

onMounted(() => {
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  updateClock();
  updateScadaClock();
  clockTimer = setInterval(() => {
    updateClock();
    updateScadaClock();
  }, 1000);

  // 夜间长周期运行防内存泄漏守护：每 60 秒触发一次 V8 垃圾回收 (需暴露 --expose-gc)
  gcTimer = setInterval(() => {
    if (typeof window !== 'undefined' && (window as any).gc) {
      try { (window as any).gc(); } catch {}
    }
  }, 60000);

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

  // 工业级自适应自平衡轮询（消除 CPU 持续满载，避免看门狗超时）
  scheduleNextPoll(150);
});

onBeforeUnmount(() => {
  isUnmounted = true;
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  if (clockTimer) clearInterval(clockTimer);
  if (gcTimer) clearInterval(gcTimer);
  if (scadaClockTimer) clearInterval(scadaClockTimer);
  if (realtimePollingTimer) {
    clearTimeout(realtimePollingTimer);
    realtimePollingTimer = null;
  }
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
    <!-- ===================================================================== -->
    <!-- 1. KND科能达 SCADA 顶部主应用导航栏与快捷操作工具条 (护眼暖白/米白高质感单行顶栏)   -->
    <!-- ===================================================================== -->
    <header class="h-11 bg-[#ebe4d4] border-b border-[#cfc5b0] px-3 flex items-center justify-between shrink-0 shadow-2xs z-30 text-slate-800 font-sans select-none tracking-wide">
      <!-- Left: KND科能达品牌标识 + 功能/配置/应用/视图菜单 + 快捷小工具群 -->
      <div class="flex items-center gap-2.5 min-w-0">
        <!-- 品牌标识 (用户指定：(KND)科能达，红圈包裹更圆润) -->
        <div class="flex items-center gap-2 pr-3 border-r border-[#cfc5b0] select-none shrink-0">
          <div class="px-2 py-0.5 rounded-full bg-[#d81e06] text-white flex items-center justify-center font-bold text-xs shadow-2xs tracking-wide">
            KND
          </div>
          <span class="text-[#d81e06] font-bold tracking-wide text-[17px]">
            科能达
          </span>
        </div>

        <!-- SCADA 主下拉菜单群：功能、配置、应用、视图 (删除英文后缀) -->
        <nav class="flex items-center gap-1 text-[15px] font-medium shrink-0 tracking-wide text-slate-800">
          <!-- 功能 -->
          <div class="relative scada-top-menu-item">
            <button
              @click.stop="toggleTopMenu('func')"
              class="px-3 py-1.5 rounded hover:bg-[#e4dcce] text-slate-800 font-medium transition-colors cursor-pointer tracking-wide text-[15px]"
              :class="{ 'bg-[#e4dcce] text-sky-700': activeTopMenu === 'func' }"
            >
              功能
            </button>
            <div
              v-if="activeTopMenu === 'func'"
              class="absolute left-0 top-full mt-1 w-56 bg-[#f2eee3] border border-[#cfc5b0] rounded-lg shadow-xl py-1 z-50 text-[14px] text-slate-800 divide-y divide-[#ded5bf] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="handlePrevScreen(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>切换上一画面</span>
                  <span class="text-xs text-slate-400 font-mono">Alt+←</span>
                </button>
                <button
                  @click="handleNextScreen(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>切换下一画面</span>
                  <span class="text-xs text-slate-400 font-mono">Alt+→</span>
                </button>
                <button
                  @click="handleHomeScreen(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>返回主索引画面</span>
                  <span class="text-xs text-slate-400 font-mono">Home</span>
                </button>
              </div>
              <div class="py-1">
                <button
                  @click="handleReloadCurrentScreen(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>重新加载当前画面</span>
                  <span class="text-xs text-slate-400 font-mono">F5</span>
                </button>
                <button
                  @click="handlePrintScreen(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>打印当前图纸</span>
                  <span class="text-xs text-slate-400 font-mono">Ctrl+P</span>
                </button>
              </div>
              <div class="py-1">
                <button
                  @click="handleExitPreview(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center justify-between cursor-pointer"
                >
                  <span>退出监控运行</span>
                  <span class="text-xs text-rose-400 font-mono">ESC</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 配置 -->
          <div class="relative scada-top-menu-item">
            <button
              @click.stop="toggleTopMenu('config')"
              class="px-3 py-1.5 rounded hover:bg-[#e4dcce] text-slate-800 font-medium transition-colors cursor-pointer tracking-wide text-[15px]"
              :class="{ 'bg-[#e4dcce] text-sky-700': activeTopMenu === 'config' }"
            >
              配置
            </button>
            <div
              v-if="activeTopMenu === 'config'"
              class="absolute left-0 top-full mt-1 w-56 bg-[#f2eee3] border border-[#cfc5b0] rounded-lg shadow-xl py-1 z-50 text-[14px] text-slate-800 divide-y divide-[#ded5bf] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="scaleMode = 'fit'; userZoomFactor = 1; closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>画面自动适应</span>
                  <span v-if="scaleMode === 'fit'" class="text-sky-600 font-medium">✓</span>
                </button>
                <button
                  @click="scaleMode = 'original'; userZoomFactor = 1; closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>原始比例 1:1</span>
                  <span v-if="scaleMode === 'original'" class="text-sky-600 font-medium">✓</span>
                </button>
              </div>
              <div class="py-1">
                <button
                  @click="toggleInterlock(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>五防主机 ({{ interlockStatus }})</span>
                </button>
                <button
                  @click="isMuted = !isMuted; closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
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
              class="px-3 py-1.5 rounded hover:bg-[#e4dcce] text-slate-800 font-medium transition-colors cursor-pointer tracking-wide text-[15px]"
              :class="{ 'bg-[#e4dcce] text-sky-700': activeTopMenu === 'app' }"
            >
              应用
            </button>
            <div
              v-if="activeTopMenu === 'app'"
              class="absolute left-0 top-full mt-1 w-56 bg-[#f2eee3] border border-[#cfc5b0] rounded-lg shadow-xl py-1 z-50 text-[14px] text-slate-800 divide-y divide-[#ded5bf] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="handleHomeScreen(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer font-medium text-sky-800"
                >
                  <Zap class="w-4.5 h-4.5 text-amber-500" />
                  <span>实时监控主接线</span>
                </button>
                <button
                  @click="handleOpenAlarm(); closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <Bell class="w-4.5 h-4.5 text-rose-500" />
                  <span>全站告警窗 (独立可拖)</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 视图 -->
          <div class="relative scada-top-menu-item">
            <button
              @click.stop="toggleTopMenu('view')"
              class="px-3 py-1.5 rounded hover:bg-[#e4dcce] text-slate-800 font-medium transition-colors cursor-pointer tracking-wide text-[15px]"
              :class="{ 'bg-[#e4dcce] text-sky-700': activeTopMenu === 'view' }"
            >
              视图
            </button>
            <div
              v-if="activeTopMenu === 'view'"
              class="absolute left-0 top-full mt-1 w-56 bg-[#f2eee3] border border-[#cfc5b0] rounded-lg shadow-xl py-1 z-50 text-[14px] text-slate-800 divide-y divide-[#ded5bf] tracking-wide"
            >
              <div class="py-1">
                <button
                  @click="isTreeCollapsed = !isTreeCollapsed; closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>画面目录树</span>
                  <span class="text-sky-600 font-medium">{{ !isTreeCollapsed ? '显示' : '隐藏' }}</span>
                </button>
                <button
                  @click="scaleMode = 'fit'; closeTopMenus();"
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between cursor-pointer"
                >
                  <span>自动适应画布</span>
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div class="h-4 w-[1px] bg-[#cfc5b0] mx-1 shrink-0" />

        <!-- 快捷小工具单图标按钮组 (无卡片包裹，纯净单图标) -->
        <div class="flex items-center gap-1 shrink-0">
          <!-- 目录折叠/展开 -->
          <button
            @click="isTreeCollapsed = !isTreeCollapsed"
            class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            :title="isTreeCollapsed ? '展开左侧目录' : '收起左侧目录'"
          >
            <component :is="isTreeCollapsed ? PanelLeftOpen : PanelLeftClose" class="w-4.5 h-4.5 text-slate-700" />
          </button>

          <!-- 主索引画面 (Home) -->
          <button
            @click="handleHomeScreen"
            class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
            title="返回主索引画面 (Home)"
          >
            <Home class="w-4.5 h-4.5 text-sky-600" />
          </button>

          <!-- 上一画面 (<) -->
          <button
            @click="handlePrevScreen"
            class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
            title="上一画面"
          >
            <ChevronLeft class="w-4.5 h-4.5" />
          </button>

          <!-- 下一画面 (>) -->
          <button
            @click="handleNextScreen"
            class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
            title="下一画面"
          >
            <ChevronRight class="w-4.5 h-4.5" />
          </button>

          <!-- 打印画面 -->
          <button
            @click="handlePrintScreen"
            class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="打印当前画面"
          >
            <Printer class="w-4.5 h-4.5 text-slate-600" />
          </button>

          <!-- 放大 (+) -->
          <button
            @click="handleZoomIn"
            class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
            title="放大接线图 (+)"
          >
            <ZoomIn class="w-4.5 h-4.5" />
          </button>

          <!-- 缩小 (-) -->
          <button
            @click="handleZoomOut"
            class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
            title="缩小接线图 (-)"
          >
            <ZoomOut class="w-4.5 h-4.5" />
          </button>

          <!-- 自适应 / 1:1 切换 (单图标式极简按钮) -->
          <button
            @click="scaleMode = scaleMode === 'fill' || scaleMode === 'fit' ? 'original' : 'fit'; userZoomFactor = 1;"
            class="px-2 py-1 rounded hover:bg-[#e4dcce] text-slate-700 hover:text-slate-900 text-[13px] font-mono font-medium transition-colors cursor-pointer"
            :title="scaleMode === 'original' ? '切换为自动适应' : '切换为 1:1 原尺寸'"
          >
            {{ scaleMode === 'original' ? '1:1' : '适应' }}
          </button>

          <!-- 重新加载当前画面 -->
          <button
            @click="handleReloadCurrentScreen"
            class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
            title="重新加载当前画面"
          >
            <RefreshCw class="w-4.5 h-4.5 text-sky-600" :class="{ 'animate-spin': isTriggeringScada }" />
          </button>
        </div>
      </div>

      <!-- Center: 当前工况状态 (与周边文字保持相同大小 text-[14px]，无卡片包裹) -->
      <div class="hidden lg:flex items-center gap-3.5 text-[14px] text-slate-700 select-none tracking-wide font-normal">
        <!-- 实时态标志 -->
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0" />
          <span>当前状态: <span class="text-slate-800 font-medium">实时态</span></span>
        </div>
        <span class="text-slate-300">|</span>
        <!-- 五防主机状态标志 (支持点击投入/退出) -->
        <button
          @click="toggleInterlock"
          class="flex items-center gap-1 hover:text-sky-700 cursor-pointer transition-colors text-[14px]"
          title="点击切换五防主机投入/退出状态"
        >
          <span>五防主机: <span class="font-medium" :class="interlockStatus === '投入' ? 'text-amber-600' : 'text-slate-800'">{{ interlockStatus }}</span></span>
        </button>
      </div>

      <!-- Right: 音量、电站名称与全屏/退出控制 (移除顶栏时钟，全部单图标无卡片) -->
      <div class="flex items-center gap-1 shrink-0">
        <!-- 电站/大屏名称标牌 (无卡片包裹，纯净文本) -->
        <div class="text-slate-800 font-medium text-[14px] tracking-wide truncate max-w-[200px] pr-3 border-r border-[#cfc5b0]">
          {{ screen.name || '速利达光伏发电站' }}
        </div>

        <!-- 声音告警静音切换 -->
        <button
          @click="isMuted = !isMuted"
          class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
          :title="isMuted ? '取消静音' : '告警静音'"
        >
          <component :is="isMuted ? VolumeX : Volume2" class="w-4.5 h-4.5 text-slate-600" />
        </button>

        <!-- 全屏切换 -->
        <button
          @click="toggleBrowserFullscreen"
          class="p-1.5 rounded hover:bg-[#e4dcce] text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
          title="全屏切换 (F11)"
        >
          <component :is="isBrowserFullscreen ? Minimize : Maximize" class="w-4.5 h-4.5" />
        </button>

        <!-- 退出监控运行 (单图标无卡片包裹) -->
        <button
          @click="handleExitPreview"
          class="p-1.5 rounded hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors cursor-pointer"
          title="退出监控运行 (ESC)"
        >
          <LogOut class="w-4.5 h-4.5 text-rose-500" />
        </button>
      </div>
    </header>

    <!-- ===================================================================== -->
    <!-- 2. 中间主体：左侧画面目录树 + 中央电气主接线画布 (Workspace)            -->
    <!-- ===================================================================== -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- 2.1 左侧画面目录导航栏 (非白背景，与顶栏相同背景色，极简非卡片行) -->
      <aside
        v-if="!isTreeCollapsed"
        class="w-60 bg-[#ebe4d4] border-r border-[#cfc5b0] flex flex-col shrink-0 text-slate-800 z-20 select-none tracking-wide"
      >
        <!-- 侧栏顶标 -->
        <div class="px-3.5 py-2.5 border-b border-[#cfc5b0] flex items-center justify-between bg-[#ebe4d4]">
          <div class="flex items-center gap-2 text-[14px] font-medium text-slate-800">
            <FolderTree class="w-4.5 h-4.5 text-sky-600" />
            <span>画面列表 ({{ screens.length }})</span>
          </div>
          <button
            @click="isTreeCollapsed = true"
            class="p-1 rounded hover:bg-[#e4dcce] text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="收起目录"
          >
            <PanelLeftClose class="w-4 h-4" />
          </button>
        </div>

        <!-- 画面列表 (极简纯净单行，无卡片，无悬浮气泡解释，字号一致) -->
        <div class="flex-1 overflow-y-auto py-1 text-[14px]" style="scrollbar-gutter: stable;">
          <div
            v-for="s in screens"
            :key="s.id"
            @click="emit('switch:screen', s.id)"
            class="px-3.5 py-2 cursor-pointer transition-colors flex items-center justify-between text-[14px] border-b border-[#ded5bf]"
            :class="s.id === activeScreenId 
              ? 'bg-[#e4dcce] text-sky-800 font-medium border-l-3 border-sky-600' 
              : 'text-slate-800 hover:bg-[#e4dcce] font-normal border-l-3 border-transparent'"
          >
            <div class="flex items-center gap-2.5 truncate">
              <Zap class="w-4.5 h-4.5 shrink-0" :class="s.id === activeScreenId ? 'text-sky-600' : 'text-slate-500'" />
              <span class="truncate text-[14px]">{{ s.name }}</span>
            </div>
            <span
              v-if="s.id === activeScreenId"
              class="w-2 h-2 rounded-full bg-sky-600 shrink-0"
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
                contain: comp.type.startsWith('draw-') || comp.category === 'basic' || comp.category === 'drawing' ? 'none' : 'layout style'
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

        <!-- 悬浮测点浮标 (格式: 间隔-设备-测点名称，极简紧凑工业风，仅关联好测点的图元展示) -->
        <div
          v-if="hoverTooltip && hoverTooltip.visible"
          class="fixed z-50 pointer-events-none px-2.5 py-1 rounded-md bg-[#091528]/95 backdrop-blur-md border border-[#00f2ff]/60 shadow-[0_6px_20px_rgba(0,0,0,0.85)] flex items-center gap-1.5 text-xs font-sans whitespace-nowrap"
          :style="{
            left: `${Math.round(hoverTooltip.x)}px`,
            top: `${Math.round(hoverTooltip.y)}px`
          }"
        >
          <span
            class="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded uppercase shrink-0"
            :class="{
              'bg-cyan-950 text-cyan-300 border border-cyan-500/50': hoverTooltip.pointType === 'YC',
              'bg-emerald-950 text-emerald-300 border border-emerald-500/50': hoverTooltip.pointType === 'YX',
              'bg-amber-950 text-amber-300 border border-amber-500/50': hoverTooltip.pointType === 'YT',
              'bg-purple-950 text-purple-300 border border-purple-500/50': hoverTooltip.pointType === 'YK',
              'bg-blue-950 text-blue-300 border border-blue-500/50': hoverTooltip.pointType === 'DD'
            }"
          >
            {{ hoverTooltip.pointType }}
          </span>
          <span class="text-slate-100 font-mono text-[11.5px] font-medium tracking-wide">
            {{ hoverTooltip.hierarchyText }}
          </span>
          <span v-if="hoverTooltip.displayValueText" class="text-[#00f2ff] font-mono font-bold text-[11.5px] ml-1 pl-1.5 border-l border-slate-700">
            {{ hoverTooltip.displayValueText }}
          </span>
        </div>

        <!-- 右键操作菜单 (布局样式参考编辑界面，统一高对比度微光质感，承载遥控遥调操作，删除显示比例，退出监控直接跳转编辑界面) -->
        <div
          v-if="contextMenu.visible"
          @click.stop
          @contextmenu.stop.prevent
          class="fixed z-50 bg-[#091528] border-2 border-[#00f2ff]/80 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.95)] p-2 w-72 text-sm font-sans divide-y divide-[#00f2ff]/30"
          :style="{
            left: `${Math.round(contextMenu.x)}px`,
            top: `${Math.round(contextMenu.y)}px`,
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'geometricPrecision',
            transform: 'translateZ(0)'
          }"
        >
          <!-- 头部信息 -->
          <div class="px-3 py-1.5 text-sm font-bold text-[#00f2ff] flex items-center justify-between pb-2 tracking-wide border-b border-[#00f2ff]/30">
            <span class="truncate">{{ contextMenu.targetComponent ? contextMenu.targetComponent.name : '监控界面操作' }}</span>
            <span v-if="contextMenu.pointType" class="text-xs text-[#38bdf8] font-mono font-bold">{{ contextMenu.pointType }}</span>
            <span v-else class="text-xs text-slate-400 font-mono">SCADA</span>
          </div>

          <!-- 测点层级信息展示 (如有点位) -->
          <div v-if="contextMenu.hierarchyText" class="py-1.5">
            <div class="px-2.5 py-1.5 bg-[#040914] rounded-lg border border-[#00f2ff]/20 text-xs">
              <div class="text-slate-400 text-[10px] mb-0.5">测点层级信息:</div>
              <div class="text-[#00f2ff] font-mono font-bold text-[11px] truncate" :title="contextMenu.hierarchyText">
                {{ contextMenu.hierarchyText }}
              </div>
            </div>
          </div>

          <!-- 遥控/遥调执行按钮区 (用户要求：遥控遥调全部通过右击菜单实现) -->
          <div v-if="contextMenu.hasControl || contextMenu.hasRegulation" class="py-1.5 space-y-1">
            <!-- 执行遥控 (YK) -->
            <button
              v-if="contextMenu.hasControl"
              @click="executeContextMenuControl('control')"
              class="w-full text-left px-3 py-2 bg-[#fbbf24]/15 hover:bg-[#fbbf24]/25 border border-[#fbbf24]/50 rounded-lg text-[#fbbf24] hover:text-[#fde047] cursor-pointer flex items-center justify-between group transition-colors shadow-xs"
            >
              <div class="flex items-center gap-2.5">
                <Radio class="w-4 h-4 text-[#fbbf24] stroke-[2.5]" />
                <span class="font-bold text-[#fbbf24] tracking-wide text-sm">执行工业遥控 (YK)</span>
              </div>
              <span class="text-xs bg-[#451a03] text-[#fbbf24] border border-[#f59e0b] px-2 py-0.5 rounded font-mono font-bold">
                操作合分
              </span>
            </button>

            <!-- 执行遥调 (YT) -->
            <button
              v-if="contextMenu.hasRegulation"
              @click="executeContextMenuControl('regulation')"
              class="w-full text-left px-3 py-2 bg-[#38bdf8]/15 hover:bg-[#38bdf8]/25 border border-[#38bdf8]/50 rounded-lg text-[#38bdf8] hover:text-[#7dd3fc] cursor-pointer flex items-center justify-between group transition-colors shadow-xs"
            >
              <div class="flex items-center gap-2.5">
                <SlidersHorizontal class="w-4 h-4 text-[#38bdf8] stroke-[2.5]" />
                <span class="font-bold text-[#38bdf8] tracking-wide text-sm">执行工业遥调 (YT)</span>
              </div>
              <span class="text-xs bg-[#082f49] text-[#38bdf8] border border-[#0284c7] px-2 py-0.5 rounded font-mono font-bold">
                升降/档位
              </span>
            </button>
          </div>

          <!-- 退出监控直接跳转编辑界面 -->
          <div class="pt-1.5">
            <button
              @click="handleExitPreview(); closeContextMenu();"
              class="w-full text-left px-3 py-2 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/40 rounded-lg text-rose-300 hover:text-rose-100 cursor-pointer flex items-center justify-between group transition-colors"
            >
              <div class="flex items-center gap-2.5">
                <Edit3 class="w-4 h-4 text-rose-400 stroke-[2]" />
                <span class="font-bold text-rose-300 group-hover:text-rose-100 tracking-wide text-sm">退出监控 / 跳转编辑界面</span>
              </div>
              <span class="text-xs bg-rose-950 text-rose-400 border border-rose-800 px-1.5 py-0.5 rounded font-mono font-bold">ESC</span>
            </button>
          </div>
        </div>
      </main>
    </div>

    <!-- ===================================================================== -->
    <!-- 3. GE-SCADA 底部功能菜单栏 (白色主题，按用户要求一切功能按钮简洁显示)  -->
    <!-- ===================================================================== -->
    <footer 
      v-if="!isEmbedded" 
      class="bg-[#ebe4d4] border-t border-[#cfc5b0] flex flex-col shrink-0 select-none z-40 font-sans relative shadow-xs text-slate-800"
    >
      <!-- 3.1 顶部实时跑马灯告警带 (Rolling SOE Alarm Strip) -->
      <div class="h-6.5 bg-[#e5decb] border-b border-[#cfc5b0] px-3 flex items-center justify-between text-xs font-mono">
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
            class="px-2 py-0.5 rounded bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#cfc5b0] text-slate-700 text-[10px] font-bold transition-colors cursor-pointer"
          >
            告警窗
          </button>
        </div>
      </div>

      <!-- 3.2 简洁底部主控制与状态菜单栏 (护眼暖白/米白背景，字号放大更清晰) -->
      <div class="h-9 px-3 flex items-center justify-between text-[13px] bg-[#ebe4d4] tracking-wide">
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
            class="px-3 py-1.5 rounded-md text-[13px] font-bold text-slate-800 hover:text-sky-700 hover:bg-[#e4dcce] border border-[#cfc5b0] transition-colors flex items-center gap-2 cursor-pointer relative"
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
              class="px-3 py-1.5 rounded-md text-[13px] font-bold text-slate-800 hover:bg-[#e4dcce] border border-[#cfc5b0] transition-colors flex items-center gap-1.5 cursor-pointer"
              title="快速切换监控画面"
            >
              <Layout class="w-4 h-4 text-sky-600" />
              <span>画面切换</span>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
            </button>

            <!-- 画面切换悬浮列表 (暖白米白高质感) -->
            <div
              v-if="showScreenMenu"
              class="absolute left-0 bottom-full mb-2 w-64 bg-[#f2eee3] border border-[#cfc5b0] rounded-xl shadow-xl py-1.5 z-50 text-[13px] text-slate-800 divide-y divide-[#ded5bf] tracking-wide"
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
                  class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] hover:text-sky-700 flex items-center justify-between transition-colors cursor-pointer"
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
            class="p-1.5 rounded-md border border-[#cfc5b0] hover:bg-[#e4dcce] transition-colors cursor-pointer"
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
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-[#e4dcce] border border-[#cfc5b0] text-slate-800 font-mono font-bold transition-colors cursor-pointer"
            :title="`当前账号: ${currentUser.name}`"
          >
            <UserCheck class="w-4 h-4 text-sky-600" />
            <span>{{ currentUser.name }}</span>
          </button>

          <!-- 秒时钟 -->
          <div class="flex items-center gap-1.5 font-mono text-[13px] font-bold text-slate-800 bg-[#e5decb] px-2.5 py-1 rounded-md border border-[#cfc5b0]">
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

    <!-- 4.3 工业遥控操作弹窗 (YK) -->
    <ScadaTeleControlModal
      v-if="showTeleControlModal"
      :visible="showTeleControlModal"
      :initialDeviceId="controlDeviceId"
      :initialPointId="controlInitialPointId"
      :initialTargetVerificationPointId="controlInitialTargetVerificationPointId"
      @close="showTeleControlModal = false"
      @success="() => { showTeleControlModal = false; scadaLiveTick++; }"
    />

    <!-- 4.4 工业遥调操作弹窗 (YT) -->
    <ScadaTeleRegulationModal
      v-if="showTeleRegulationModal"
      :visible="showTeleRegulationModal"
      :initialDeviceId="controlDeviceId"
      :initialPointId="controlInitialPointId"
      :initialTargetVerificationPointId="controlInitialTargetVerificationPointId"
      @close="showTeleRegulationModal = false"
      @success="() => { showTeleRegulationModal = false; scadaLiveTick++; }"
    />
  </div>
</template>
