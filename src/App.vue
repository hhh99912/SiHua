<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import { 
  ScreenConfig, 
  ScreenComponent, 
  DatasetItem, 
  MultiScreenProjectSchema, 
  HistorySnapshot,
  ScreenItem,
  CustomSymbolDef
} from './types';
import { INITIAL_DATASETS, tickDataset, executeSimulatedTeleControl, executeSimulatedTeleRegulation } from './data/presetDatasets';
import { syncDatasetFastIndex, generateUniqueDuplicateName, resolveDataPointValue, scadaLiveTick } from './utils/scadaResolver';
import { PRESET_MULTI_SCREENS } from './data/presetMultiScreens';
import { PRESET_TEMPLATES } from './data/templates';
import { COMPONENT_DEFINITIONS } from './data/componentLibrary';
import { getCustomSymbols, addCustomSymbol, refreshCustomSymbolsFromDisk } from './utils/customSymbolStorage';
import Navbar from './components/Navbar.vue';
import ComponentPalette from './components/ComponentPalette.vue';
import LayerManager from './components/LayerManager.vue';
import CanvasEditor from './components/CanvasEditor.vue';
import PropertyInspector from './components/PropertyInspector.vue';
import ScreenManagerBar from './components/ScreenManagerBar.vue';
import CustomSymbolModal from './components/CustomSymbolModal.vue';
import SaveSymbolModal from './components/SaveSymbolModal.vue';
import DatasetManagerModal from './components/DatasetManagerModal.vue';
import DataAssociationModal from './components/DataAssociationModal.vue';
import BatchDataAssociationModal from './components/BatchDataAssociationModal.vue';
import ScadaTeleControlModal from './components/ScadaTeleControlModal.vue';
import ScadaTeleRegulationModal from './components/ScadaTeleRegulationModal.vue';
import ScadaBatchPointModal from './components/ScadaBatchPointModal.vue';
import DesktopPlatformModal from './components/DesktopPlatformModal.vue';
import PreviewScreen from './components/PreviewScreen.vue';
import RealtimeAlarmModal from './components/RealtimeAlarmModal.vue';
import HistoryCurveModal from './components/HistoryCurveModal.vue';
import HistoryAlarmModal from './components/HistoryAlarmModal.vue';
import ReportManagerModal from './components/ReportManagerModal.vue';
import MdiWindow from './components/MdiWindow.vue';
import PrsBottomBar, { BottomWindowItem } from './components/PrsBottomBar.vue';
import LoginModal from './components/LoginModal.vue';
import DiskStorageModal from './components/DiskStorageModal.vue';
import SystemHealthModal from './components/SystemHealthModal.vue';
import { windowClose, safeConfirm } from './utils/platform';
import { 
  loadScreensFromDisk, 
  saveScreenToDisk, 
  deleteScreenFromDisk, 
  getDiskStorageConfig,
  getIndexScreen,
  setIndexScreen
} from './utils/screenFileService';
import { fetchAllDatasetsFromDisk } from './utils/datasetFileService';
import { 
  loadLocalScadaConfigFile, 
  invalidateAssociatedPointsCache, 
  globalUnconfirmedAlarmCount, 
  syncRealtimeAlarms,
  fetchScadaConfig,
  convertFacilitiesToDatasets,
  scadaFacilities
} from './utils/scadaClient';
import { fetchBaseConfig, computeSafetyDays, scheduleMidnightTask, saveScreenOrder, applyScreenOrder } from './utils/cfgFileService';
import { currentUser, canEditCanvas, isLoggedIn, logoutUser } from './utils/auth';
import { 
  Sparkles, 
  Layers, 
  Box, 
  Zap, 
  HardDrive,
  PenTool,
  TrendingUp,
  ShieldAlert,
  LineChart,
  History,
  FileSpreadsheet,
  Network,
  Lightbulb,
  Sliders,
  Tv
} from 'lucide-vue-next';

// 1. Initial State: Load Multi-Screen Electrical Project (快速本地缓存引导与主索引初态加载，彻底消除一次系统图一闪而过)
function getInitialBootstrapData(): { screens: ScreenItem[]; initialScreen: ScreenItem; indexId: string; indexName: string } {
  try {
    const cached = localStorage.getItem('ge_scada_screens_cache_v3');
    const cachedIndexId = localStorage.getItem('scada_index_screen_id') || 'screen-transformer-detail';
    const cachedIndexName = localStorage.getItem('scada_index_screen_name') || '#1主变压器及测控画面';
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const target = parsed.find((s: ScreenItem) => 
          (cachedIndexId && s.id === cachedIndexId) || 
          (cachedIndexName && s.name.trim().toLowerCase() === cachedIndexName.trim().toLowerCase())
        ) || parsed.find((s: ScreenItem) => s.id === 'screen-transformer-detail') || parsed[0];
        return { screens: parsed, initialScreen: target, indexId: cachedIndexId, indexName: cachedIndexName };
      }
    }
  } catch {}

  const defaultIndex = PRESET_MULTI_SCREENS.find(s => s.name === '#1主变压器及测控画面' || s.id === 'screen-transformer-detail') || PRESET_MULTI_SCREENS[0];
  return { 
    screens: JSON.parse(JSON.stringify(PRESET_MULTI_SCREENS)), 
    initialScreen: JSON.parse(JSON.stringify(defaultIndex)), 
    indexId: defaultIndex.id, 
    indexName: defaultIndex.name 
  };
}

const bootstrapData = getInitialBootstrapData();
const screens = ref<ScreenItem[]>(bootstrapData.screens);
const activeScreenId = ref<string>(bootstrapData.initialScreen.id);

// Current active screen object & components ref
const currentScreenItem = computed(() => {
  return screens.value.find(s => s.id === activeScreenId.value) || screens.value[0];
});

const screen = ref<ScreenConfig>({
  ...bootstrapData.initialScreen.screen,
  updatedAt: new Date().toISOString()
});

const components = ref<ScreenComponent[]>(JSON.parse(JSON.stringify(bootstrapData.initialScreen.components)));

// 实时监控运行大屏独立状态（启动时严格同步主索引大屏，杜绝一次系统图闪烁）
const monitorActiveScreenId = ref<string>(bootstrapData.initialScreen.id);
const monitorScreen = ref<ScreenConfig>({
  ...bootstrapData.initialScreen.screen,
  updatedAt: new Date().toISOString()
});
const monitorComponents = ref<ScreenComponent[]>(JSON.parse(JSON.stringify(bootstrapData.initialScreen.components)));
const isBootLoading = ref<boolean>(true);
const datasets = ref<DatasetItem[]>([...INITIAL_DATASETS]);
const selectedIds = ref<string[]>([]);
const zoom = ref<number>(0.62);
const isStreaming = ref<boolean>(true);
const leftSidebarTab = ref<'palette' | 'layers'>('palette');
const drawTool = ref<string>('select');
const activePlacementDef = ref<any>(null);
const activeShapeType = ref<string>('');

// Infinite Canvas & Snapping Controls
const showGrid = ref<boolean>(true);
const gridSize = ref<number>(40);
const snapToGrid = ref<boolean>(false);
const orthogonalLock = ref<boolean>(false);
const showRuler = ref<boolean>(false);
const canvasEditorRef = ref<any>(null);
const showPropertyInspector = ref<boolean>(false);

// Watch selectedIds: if selection is cleared, close property inspector.
// 单击组件仅选中，不弹出属性面板；必须右击 -> "查看/编辑属性面板" 才能弹出
watch(selectedIds, (newIds) => {
  if (!newIds || newIds.length === 0) {
    showPropertyInspector.value = false;
  }
});

// Modals
const showDatasetsModal = ref(false);
const showControlModal = ref(false);
const showRegulationModal = ref(false);
const controlInitialDeviceId = ref<string | undefined>(undefined);
const controlInitialPointId = ref<number | string | null>(null);
const controlInitialTargetVerificationPointId = ref<number | string | null>(null);
const showPreviewModal = ref(false); // Controlled via monitor-screen MdiWindow

// ---------------- GE-SCADA 多组态 MDI 独立窗口系统状态 ----------------
export interface MdiWindowItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  headerTheme?: 'white' | 'dark';
}

const highestZIndex = ref(30);
const activeWindowId = ref<string>('monitor-screen');

const mdiWindows = ref<MdiWindowItem[]>([
  {
    id: 'graphic-editor',
    title: '图形编辑',
    subtitle: '',
    icon: PenTool,
    isOpen: true,
    isMinimized: false,
    isMaximized: true,
    zIndex: 10,
    x: 0,
    y: 0,
    width: 1200,
    height: 780,
    headerTheme: 'white'
  },
  {
    id: 'monitor-screen',
    title: '实时监控',
    subtitle: '',
    icon: Zap,
    isOpen: true,
    isMinimized: false,
    isMaximized: true,
    zIndex: 30,
    x: 0,
    y: 0,
    width: 1200,
    height: 780,
    headerTheme: 'white'
  },
  {
    id: 'alarm-window',
    title: '全站告警',
    subtitle: '',
    icon: ShieldAlert,
    isOpen: false,
    isMinimized: false,
    isMaximized: true,
    zIndex: 35,
    x: 80,
    y: 40,
    width: 1100,
    height: 640,
    headerTheme: 'white'
  },
  {
    id: 'history-curve',
    title: '历史曲线',
    subtitle: '',
    icon: LineChart,
    isOpen: false,
    isMinimized: false,
    isMaximized: true,
    zIndex: 36,
    x: 100,
    y: 50,
    width: 1120,
    height: 660,
    headerTheme: 'white'
  },
  {
    id: 'history-alarm',
    title: '历史告警',
    subtitle: '',
    icon: History,
    isOpen: false,
    isMinimized: false,
    isMaximized: true,
    zIndex: 37,
    x: 120,
    y: 60,
    width: 1120,
    height: 660,
    headerTheme: 'white'
  },
  {
    id: 'report-window',
    title: '报表',
    subtitle: '',
    icon: FileSpreadsheet,
    isOpen: false,
    isMinimized: false,
    isMaximized: true,
    zIndex: 38,
    x: 140,
    y: 70,
    width: 1120,
    height: 660,
    headerTheme: 'white'
  }
]);

const getWindow = (id: string): MdiWindowItem => {
  return mdiWindows.value.find(w => w.id === id) || mdiWindows.value[0];
};

// 从 cfg/base.json 检索并重排画面顺序 (支持热更新与冷启动检索)
const reloadAndApplyScreenOrder = async () => {
  try {
    const cfg = await fetchBaseConfig();
    if (cfg && Array.isArray(cfg.SCREEN_ORDER) && cfg.SCREEN_ORDER.length > 0) {
      screens.value = applyScreenOrder(screens.value, cfg.SCREEN_ORDER);
    }
  } catch (err) {
    console.warn('[SCADA] 检索 cfg/base.json 画面顺序失败:', err);
  }
};

// 画面上下顺序调整并自动持久化到 cfg/base.json
const handleReorderScreens = async (newScreens: ScreenItem[]) => {
  screens.value = newScreens;
  const names = newScreens.map(s => s.name);
  await saveScreenOrder(names);
  showDiskNotification('已保存画面显示顺序至 cfg/base.json');
};

const openWindow = async (id: string) => {
  const win = mdiWindows.value.find(w => w.id === id);
  if (win) {
    win.isOpen = true;
    win.isMinimized = false;
    if (id === 'alarm-window' || id === 'history-curve' || id === 'history-alarm' || id === 'report-window') {
      win.isMaximized = true;
    }
    focusWindow(id);

    // 每次打开 图形编辑界面(graphic-editor) / 实时监控界面(monitor-screen) 就在此检索画面顺序并应用
    if (id === 'graphic-editor' || id === 'monitor-screen') {
      await reloadAndApplyScreenOrder();
    }
  }
};

const closeWindow = (id: string) => {
  const win = mdiWindows.value.find(w => w.id === id);
  if (win) {
    win.isOpen = false;
  }
};

const minimizeWindow = (id: string) => {
  const win = mdiWindows.value.find(w => w.id === id);
  if (win) {
    win.isMinimized = true;
  }
};

const maximizeWindow = (id: string) => {
  const win = mdiWindows.value.find(w => w.id === id);
  if (win) {
    win.isMaximized = true;
    focusWindow(id);
  }
};

const restoreWindow = (id: string) => {
  const win = mdiWindows.value.find(w => w.id === id);
  if (win) {
    win.isMaximized = false;
    focusWindow(id);
  }
};

const toggleWindow = (id: string) => {
  const win = mdiWindows.value.find(w => w.id === id);
  if (!win) return;
  if (!win.isOpen) {
    win.isOpen = true;
    win.isMinimized = false;
    focusWindow(id);
  } else if (win.isMinimized) {
    win.isMinimized = false;
    focusWindow(id);
  } else if (activeWindowId.value === id) {
    win.isMinimized = true;
  } else {
    focusWindow(id);
  }
};

const focusWindow = (id: string) => {
  activeWindowId.value = id;
  const win = mdiWindows.value.find(w => w.id === id);
  if (win) {
    highestZIndex.value += 1;
    win.zIndex = highestZIndex.value;
  }
};

const updateWindowCoord = (id: string, prop: 'x' | 'y' | 'width' | 'height', val: number) => {
  const win = mdiWindows.value.find(w => w.id === id);
  if (win) {
    win[prop] = val;
  }
};

const updateWindowProp = (id: string, prop: 'isMaximized' | 'isMinimized', val: boolean) => {
  const win = mdiWindows.value.find(w => w.id === id);
  if (win) {
    win[prop] = val;
    if (prop === 'isMaximized' && val) {
      focusWindow(id);
    }
  }
};

const tileWindows = () => {
  const openWins = mdiWindows.value.filter(w => w.isOpen && !w.isMinimized);
  if (openWins.length === 0) return;
  const availW = window.innerWidth;
  const availH = window.innerHeight - 40;

  if (openWins.length === 1) {
    openWins[0].isMaximized = true;
    focusWindow(openWins[0].id);
    return;
  }

  openWins.forEach(w => { w.isMaximized = false; });

  if (openWins.length === 2) {
    openWins[0].x = 0;
    openWins[0].y = 0;
    openWins[0].width = Math.floor(availW / 2);
    openWins[0].height = availH;

    openWins[1].x = Math.floor(availW / 2);
    openWins[1].y = 0;
    openWins[1].width = Math.ceil(availW / 2);
    openWins[1].height = availH;
  } else if (openWins.length <= 4) {
    const halfW = Math.floor(availW / 2);
    const halfH = Math.floor(availH / 2);
    openWins.forEach((w, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      w.x = col * halfW;
      w.y = row * halfH;
      w.width = halfW;
      w.height = halfH;
    });
  } else {
    const cols = 3;
    const colW = Math.floor(availW / cols);
    const rows = Math.ceil(openWins.length / cols);
    const rowH = Math.floor(availH / rows);
    openWins.forEach((w, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      w.x = col * colW;
      w.y = row * rowH;
      w.width = colW;
      w.height = rowH;
    });
  }
};

const cascadeWindows = () => {
  const openWins = mdiWindows.value.filter(w => w.isOpen && !w.isMinimized);
  openWins.forEach(w => { w.isMaximized = false; });
  const baseW = Math.min(1080, Math.floor(window.innerWidth * 0.78));
  const baseH = Math.min(680, Math.floor((window.innerHeight - 40) * 0.78));
  openWins.forEach((w, idx) => {
    w.x = Math.min(window.innerWidth - baseW, 30 + idx * 35);
    w.y = Math.min(window.innerHeight - 40 - baseH, 20 + idx * 30);
    w.width = baseW;
    w.height = baseH;
    highestZIndex.value += 1;
    w.zIndex = highestZIndex.value;
  });
};

const minimizeAll = () => {
  mdiWindows.value.forEach(w => {
    if (w.isOpen) w.isMinimized = true;
  });
};

const restoreAll = () => {
  mdiWindows.value.forEach(w => {
    if (w.isOpen) w.isMinimized = false;
  });
};

const bottomBarWindows = computed<BottomWindowItem[]>(() => {
  return mdiWindows.value.map(w => ({
    id: w.id,
    title: w.title.split(' ')[0],
    icon: w.icon,
    isOpen: w.isOpen,
    isMinimized: w.isMinimized,
    isMaximized: w.isMaximized,
    isActive: activeWindowId.value === w.id
  }));
});
const showSymbolModal = ref(false);
const showSaveSymbolModal = ref(false);
const showPlatformModal = ref(false);
const showBatchPointModal = ref(false);
const showDataAssociationModal = ref(false);
const associationTargetComponent = ref<ScreenComponent | null>(null);
const showBatchAssociationModal = ref(false);
const batchAssociationComponents = ref<ScreenComponent[]>([]);
const batchAssociationCategory = ref<'yc' | 'yx'>('yc');
const showLoginModal = ref(false);
const showDiskStorageModal = ref(false);
const showSystemHealthModal = ref(false);
const loginNotice = ref('');
const componentsToSave = ref<ScreenComponent[]>([]);

// ---------------- Disk Storage Engine State (graph/) ----------------
const storageDirectory = ref('graph');
const diskFileCount = ref(PRESET_MULTI_SCREENS.length);
const isSavingDisk = ref(false);
const indexScreenId = ref<string>(bootstrapData.indexId);
const indexScreenName = ref<string>(bootstrapData.indexName);
const diskNotification = ref('');
let diskNotificationTimer: any = null;

// 底栏安全运行天数 (严格从 cfg/base.json 读取 SAFE_DATA_START 并在启动及每日零点计算)
const safetyDays = ref<number>(computeSafetyDays('2025-05-06'));
let cleanupMidnightTask: (() => void) | null = null;

const showDiskNotification = (msg: string) => {
  diskNotification.value = msg;
  if (diskNotificationTimer) clearTimeout(diskNotificationTimer);
  diskNotificationTimer = setTimeout(() => {
    diskNotification.value = '';
  }, 3500);
};

// Synchronize current components & screen configuration back to screens array
const syncActiveScreenToProject = () => {
  const target = screens.value.find(s => s.id === activeScreenId.value);
  if (target) {
    target.screen = { ...screen.value };
    target.components = components.value;
  }
};

// Switch active screen (in-memory only; no automatic disk saving)
const handleSwitchScreen = async (screenId: string) => {
  if (screenId === activeScreenId.value) return;
  syncActiveScreenToProject();

  const target = screens.value.find(s => s.id === screenId);
  if (!target) return;

  activeScreenId.value = screenId;
  screen.value = { ...target.screen };
  components.value = target.components || [];
  selectedIds.value = [];

  invalidateAssociatedPointsCache();

  // If in editor mode, fitToScreen and recordHistory; if in preview mode, don't spam history stack with deep clones
  if (!showPreviewModal.value) {
    fitToScreen();
    recordHistory();
  }
};

// Helper to enforce strictly unique screen names across the system
const getUniqueScreenName = (baseName: string, excludeId?: string): string => {
  let name = baseName.trim() || '新建画面';
  let counter = 1;
  const exists = (n: string) => screens.value.some(s => s.id !== excludeId && s.name.trim().toLowerCase() === n.trim().toLowerCase());
  
  if (!exists(name)) return name;
  
  while (exists(`${name} (${counter})`)) {
    counter++;
  }
  return `${name} (${counter})`;
};

// Add new screen (names must be unique, persistence on manual save)
const handleAddScreen = async (payload: { 
  name: string; 
  width: number; 
  height: number; 
  templateId?: string;
  templateModel?: any;
}) => {
  syncActiveScreenToProject();
  const newId = `screen-${Date.now()}`;
  const uniqueName = getUniqueScreenName(payload.name);
  const screenWidth = payload.width || 1980;
  const screenHeight = payload.height || 1100;

  let componentsToUse: ScreenComponent[] = [];
  let screenConfigFromTemplate: Partial<ScreenConfig> = {};

  // 1. 无模板创建：自动添加极简工控方框 (用户明确要求)
  if (!payload.templateId || payload.templateId === '__blank_minimal__') {
    const minimalBorder: ScreenComponent = {
      id: `comp-border-${Date.now()}`,
      name: '极简工控方框',
      type: 'deco-border-minimal',
      category: 'decoration',
      x: 20,
      y: 20,
      width: screenWidth - 40,
      height: screenHeight - 40,
      rotation: 0,
      zIndex: 1,
      style: {
        borderColor: 'rgba(0, 242, 255, 0.4)',
        borderWidth: 1,
        backgroundColor: 'transparent'
      },
      data: { mapping: {} }
    };
    componentsToUse = [minimalBorder];
  } else {
    // 2. 按模板创建：优先使用从 model/ 检索到的 templateModel，或从 PRESET_TEMPLATES 查找
    let rawComponents: any[] = [];
    let rawScreen: any = null;
    let rawDatasets: any[] = [];

    if (payload.templateModel) {
      rawComponents = payload.templateModel.components || [];
      rawScreen = payload.templateModel.screen;
      rawDatasets = payload.templateModel.datasets || [];
    } else {
      const tpl = PRESET_TEMPLATES.find(t => t.id === payload.templateId);
      if (tpl) {
        rawComponents = tpl.schema.components || [];
        rawScreen = tpl.schema.screen;
        rawDatasets = tpl.schema.datasets || [];
      }
    }

    if (rawComponents.length > 0) {
      // 深度拷贝并重新分配组件 ID
      componentsToUse = rawComponents.map((c, idx) => ({
        ...JSON.parse(JSON.stringify(c)),
        id: `comp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`
      }));
    }

    if (rawScreen) {
      screenConfigFromTemplate = JSON.parse(JSON.stringify(rawScreen));
    }

    // 合并数据集配置（如有）
    if (rawDatasets && rawDatasets.length > 0) {
      rawDatasets.forEach(tplDs => {
        const existingDs = datasets.value.find(d => d.id === tplDs.id);
        if (existingDs) {
          (tplDs.devices || []).forEach((dev: any) => {
            if (!existingDs.devices.some(d => d.id === dev.id)) {
              existingDs.devices.push(JSON.parse(JSON.stringify(dev)));
            }
          });
        } else {
          datasets.value.push(JSON.parse(JSON.stringify(tplDs)));
        }
      });
      syncDatasetFastIndex(datasets.value);
    }
  }

  // 严格过滤掉任何已废弃的旧版组件
  componentsToUse = componentsToUse.filter(c => (c.type as string) !== 'nav-tabs' && (c.type as string) !== 'metric-card');

  const newScreenItem: ScreenItem = {
    id: newId,
    name: uniqueName,
    screen: {
      id: newId,
      name: uniqueName,
      width: screenWidth,
      height: screenHeight,
      backgroundColor: screenConfigFromTemplate.backgroundColor || '#000000',
      backgroundGrid: true,
      gridSize: 20,
      gridColor: screenConfigFromTemplate.gridColor || 'rgba(255, 255, 255, 0.05)',
      theme: screenConfigFromTemplate.theme || 'cyber-dark',
      version: '2.0.0',
      updatedAt: new Date().toISOString()
    },
    components: componentsToUse
  };

  screens.value.push(newScreenItem);
  await handleSwitchScreen(newId);
  showDiskNotification(`已新建大屏「${uniqueName}」，点击保存按钮可同步至 graph/ 目录`);
};

// Duplicate screen (names must be unique)
const handleDuplicateScreen = async (screenId: string) => {
  syncActiveScreenToProject();
  const source = screens.value.find(s => s.id === screenId);
  if (!source) return;

  const newId = `screen-${Date.now()}`;
  const existingNames = screens.value.map(s => s.name);
  const uniqueName = generateUniqueDuplicateName(source.name, existingNames, '画面');
  const cloned: ScreenItem = {
    id: newId,
    name: uniqueName,
    description: source.description,
    screen: {
      ...JSON.parse(JSON.stringify(source.screen)),
      id: newId,
      name: uniqueName
    },
    components: JSON.parse(JSON.stringify(source.components))
  };

  screens.value.push(cloned);
  await handleSwitchScreen(newId);
  showDiskNotification(`已克隆大屏「${uniqueName}」，点击保存按钮可同步至 graph/ 目录`);
};

// Rename screen (names must be unique)
const handleRenameScreen = async (payload: { screenId: string; newName: string }) => {
  const target = screens.value.find(s => s.id === payload.screenId);
  if (target) {
    const oldName = target.name;
    const trimmed = payload.newName.trim();
    if (!trimmed) return;
    const isTaken = screens.value.some(s => s.id !== payload.screenId && s.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (isTaken) {
      showDiskNotification(`画面「${trimmed}」已存在，画面名称为唯一识别标识，不可重复！`);
      return;
    }
    target.name = trimmed;
    target.screen.name = trimmed;
    if (target.id === activeScreenId.value) {
      screen.value.name = trimmed;
    }
    if (target.id === indexScreenId.value || oldName === indexScreenName.value) {
      indexScreenName.value = trimmed;
      await setIndexScreen(trimmed, target.id);
    }
    showDiskNotification(`已重命名画面: ${oldName} -> ${trimmed} (保存生效)`);
  }
};

// Delete screen and its JSON file
const handleDeleteScreen = async (screenId: string) => {
  if (screens.value.length <= 1) {
    showDiskNotification('至少需要保留一个画面。');
    return;
  }
  const toDelete = screens.value.find(s => s.id === screenId);
  if (!safeConfirm(`确定要删除画面「${toDelete?.name || ''}」及其磁盘 JSON 文件吗？`)) return;

  if (toDelete) {
    await deleteScreenFromDisk(toDelete.name);
    showDiskNotification(`已删除磁盘大屏文件: ${toDelete.name}.json`);
  }

  screens.value = screens.value.filter(s => s.id !== screenId);
  diskFileCount.value = screens.value.length;
  if (activeScreenId.value === screenId) {
    const nextScreen = screens.value[0];
    activeScreenId.value = nextScreen.id;
    screen.value = JSON.parse(JSON.stringify(nextScreen.screen));
    components.value = JSON.parse(JSON.stringify(nextScreen.components));
    selectedIds.value = [];
  }
  recordHistory();
};

// Manual Save: Save ONLY the current active screen to graph/<name>.json
const handleSaveCurrentScreenToDisk = async () => {
  syncActiveScreenToProject();
  const cur = screens.value.find(s => s.id === activeScreenId.value);
  if (!cur) return;
  cur.screen = JSON.parse(JSON.stringify(screen.value));
  cur.components = JSON.parse(JSON.stringify(components.value));

  isSavingDisk.value = true;
  try {
    const res = await saveScreenToDisk(cur);
    if (res.success) {
      diskFileCount.value = screens.value.length;
      showDiskNotification(`已保存当前大屏「${cur.name}」到 graph/${res.filename || cur.name + '.json'}`);

      // 关键 SCADA 规则：只有保存后，修改才在实时监控中同步体现！
      if (monitorActiveScreenId.value === cur.id) {
        monitorScreen.value = JSON.parse(JSON.stringify(cur.screen));
        monitorComponents.value = JSON.parse(JSON.stringify(cur.components));
      }
    } else {
      showDiskNotification(`保存失败: ${res.error || ''}`);
    }
  } catch (err: any) {
    showDiskNotification(`保存异常: ${err?.message || ''}`);
  } finally {
    isSavingDisk.value = false;
  }
};

// 监控大屏独立切换与重载控制 (与图形编辑界面的未保存草稿彻底解耦)
const handleMonitorSwitchScreen = (screenId: string) => {
  const target = screens.value.find(s => s.id === screenId);
  if (!target) return;
  monitorActiveScreenId.value = screenId;
  monitorScreen.value = JSON.parse(JSON.stringify(target.screen));
  monitorComponents.value = JSON.parse(JSON.stringify(target.components));
};

const handleReloadCurrentMonitorScreen = async () => {
  try {
    const res = await loadScreensFromDisk();
    if (res.success && res.screens && res.screens.length > 0) {
      screens.value = res.screens;
      diskFileCount.value = res.screens.length;
      if (res.indexScreen?.indexScreenId || res.indexScreen?.indexScreenName) {
        indexScreenId.value = res.indexScreen.indexScreenId || indexScreenId.value;
        indexScreenName.value = res.indexScreen.indexScreenName || indexScreenName.value;
      }
    }
  } catch (err) {
    console.warn('[SCADA] 重新加载画面失败:', err);
  }
  const curId = monitorActiveScreenId.value || activeScreenId.value;
  const target = screens.value.find(s => s.id === curId) || screens.value[0];
  if (target) {
    monitorActiveScreenId.value = target.id;
    monitorScreen.value = JSON.parse(JSON.stringify(target.screen));
    monitorComponents.value = JSON.parse(JSON.stringify(target.components));
    showDiskNotification(`已重新加载大屏「${target.name}」`);
  }
};

// Set screen as main index screen for post-login display
const handleSetIndexScreen = async (screenId: string) => {
  const target = screens.value.find(s => s.id === screenId);
  if (!target) return;
  try {
    const res = await setIndexScreen(target.name, target.id);
    if (res.success) {
      indexScreenId.value = target.id;
      indexScreenName.value = target.name;
      showDiskNotification(`已配置「${target.name}」为用户登录成功后显示的主索引大屏`);
    } else {
      showDiskNotification(`配置主索引失败: ${res.error || ''}`);
    }
  } catch (e: any) {
    showDiskNotification(`配置异常: ${e?.message || ''}`);
  }
};

// Reload screens from disk files
const handleReloadScreensFromDisk = (newScreens: ScreenItem[], idxCfg?: { indexScreenName?: string; indexScreenId?: string }) => {
  if (!newScreens || newScreens.length === 0) return;
  screens.value = newScreens;
  diskFileCount.value = newScreens.length;
  if (idxCfg?.indexScreenId || idxCfg?.indexScreenName) {
    indexScreenId.value = idxCfg.indexScreenId || '';
    indexScreenName.value = idxCfg.indexScreenName || '';
  }
  const found = newScreens.find(s => s.id === activeScreenId.value) || newScreens[0];
  activeScreenId.value = found.id;
  screen.value = JSON.parse(JSON.stringify(found.screen));
  components.value = JSON.parse(JSON.stringify(found.components));
  selectedIds.value = [];
  fitToScreen();
  recordHistory();

  // 同时也刷新监控运行画面独立状态
  const monitorFound = newScreens.find(s => s.id === monitorActiveScreenId.value) || found;
  monitorActiveScreenId.value = monitorFound.id;
  monitorScreen.value = JSON.parse(JSON.stringify(monitorFound.screen));
  monitorComponents.value = JSON.parse(JSON.stringify(monitorFound.components));

  showDiskNotification(`已从 graph/ 目录重新加载 ${newScreens.length} 个大屏文件`);
};

// 2. Undo / Redo History System
interface HistorySnapshot {
  screen: ScreenConfig;
  components: ScreenComponent[];
  datasets: DatasetItem[];
  selectedId: string | null;
}

const historyStack = ref<HistorySnapshot[]>([]);
const historyIndex = ref<number>(-1);
const isPerformingHistory = ref(false);

const recordHistory = () => {
  if (isPerformingHistory.value || showPreviewModal.value) return;
  syncActiveScreenToProject();

  const snapshot: HistorySnapshot = {
    screen: { ...screen.value },
    components: components.value.map(c => ({ ...c })),
    datasets: datasets.value,
    selectedId: selectedIds.value[0] || null
  };

  if (historyIndex.value < historyStack.value.length - 1) {
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
  }

  historyStack.value.push(snapshot);
  if (historyStack.value.length > 25) {
    historyStack.value.shift();
  }
  historyIndex.value = historyStack.value.length - 1;
};

const handleUndo = () => {
  if (historyIndex.value > 0) {
    isPerformingHistory.value = true;
    historyIndex.value -= 1;
    const snapshot = historyStack.value[historyIndex.value];
    screen.value = JSON.parse(JSON.stringify(snapshot.screen));
    components.value = JSON.parse(JSON.stringify(snapshot.components));
    datasets.value = JSON.parse(JSON.stringify(snapshot.datasets));
    selectedIds.value = snapshot.selectedId ? [snapshot.selectedId] : [];
    syncActiveScreenToProject();
    setTimeout(() => {
      isPerformingHistory.value = false;
    }, 50);
  }
};

const handleRedo = () => {
  if (historyIndex.value < historyStack.value.length - 1) {
    isPerformingHistory.value = true;
    historyIndex.value += 1;
    const snapshot = historyStack.value[historyIndex.value];
    screen.value = JSON.parse(JSON.stringify(snapshot.screen));
    components.value = JSON.parse(JSON.stringify(snapshot.components));
    datasets.value = JSON.parse(JSON.stringify(snapshot.datasets));
    selectedIds.value = snapshot.selectedId ? [snapshot.selectedId] : [];
    syncActiveScreenToProject();
    setTimeout(() => {
      isPerformingHistory.value = false;
    }, 50);
  }
};

const canUndo = computed(() => historyIndex.value > 0);
const canRedo = computed(() => historyIndex.value < historyStack.value.length - 1);

// 3. Auto Fit to Screen helper: 严格计算包含所有组件的最小外接矩形，移至 (0,0) 并自适应缩放铺满视口
const fitToScreen = () => {
  nextTick(() => {
    if (canvasEditorRef.value?.fitAndCenter) {
      canvasEditorRef.value.fitAndCenter();
    } else if (canvasEditorRef.value?.centerView) {
      canvasEditorRef.value.centerView();
    }
  });
};

// 4. Component Operations (Click to select, then click & drag in canvas to determine start and end points)
const handleAddComponentFromPalette = (def: any) => {
  activePlacementDef.value = JSON.parse(JSON.stringify(def));
  activeShapeType.value = def.type;
  drawTool.value = 'place-component';
};

const handleSelectBasicShape = (shapeType: string) => {
  if (shapeType === 'select') {
    drawTool.value = 'select';
    activePlacementDef.value = null;
    activeShapeType.value = '';
    return;
  }
  if (shapeType === 'draw-polyline') {
    drawTool.value = 'draw-polyline';
    activePlacementDef.value = null;
    activeShapeType.value = 'draw-polyline';
    return;
  }
  if (shapeType === 'draw-arrow') {
    drawTool.value = 'draw-arrow';
    activePlacementDef.value = null;
    activeShapeType.value = 'draw-arrow';
    return;
  }

  const def = COMPONENT_DEFINITIONS.find(d => d.type === shapeType) || {
    type: shapeType,
    category: 'basic',
    name: shapeType.replace('draw-', ''),
    defaultWidth: 160,
    defaultHeight: 120,
    defaultStyle: {
      fill: drawingPreset.value.fill || 'transparent',
      fillOpacity: drawingPreset.value.fillOpacity !== undefined ? drawingPreset.value.fillOpacity : 1,
      stroke: drawingPreset.value.stroke || '#00f2ff',
      strokeWidth: drawingPreset.value.strokeWidth || 2,
      lineStyle: drawingPreset.value.lineStyle || 'solid'
    }
  };

  activePlacementDef.value = JSON.parse(JSON.stringify(def));
  activeShapeType.value = shapeType;
  drawTool.value = 'place-component';
};

const handleAddComponentAt = (def: any, x: number, y: number) => {
  const maxZ = components.value.reduce((max, c) => Math.max(max, c.zIndex || 1), 0);
  const compWidth = def.width || def.defaultWidth || 200;
  const compHeight = def.height || def.defaultHeight || 150;

  const newComp: ScreenComponent = {
    id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: `${def.name} #${components.value.length + 1}`,
    type: def.type,
    category: def.category,
    x,
    y,
    width: compWidth,
    height: compHeight,
    rotation: 0,
    zIndex: maxZ + 1,
    locked: false,
    visible: true,
    states: def.states ? JSON.parse(JSON.stringify(def.states)) : undefined,
    activeState: def.activeState || (def.states?.[0]?.id ?? '1'),
    children: def.children ? JSON.parse(JSON.stringify(def.children)) : (def.states?.[0]?.children ? JSON.parse(JSON.stringify(def.states[0].children)) : undefined),
    style: (() => {
      const st = JSON.parse(JSON.stringify(def.style || def.defaultStyle || {}));
      if (def.type === 'composite-symbol' || def.category === 'gb-standard' || def.category === 'electrical' || def.customProps?.isCustomSymbol || (def.children && def.children.length > 0) || (def.states && def.states.length > 0)) {
        st.fill = 'transparent';
        st.bgColor = 'transparent';
      }
      return st;
    })(),
    animation: def.animation ? JSON.parse(JSON.stringify(def.animation)) : (def.defaultAnimation ? JSON.parse(JSON.stringify(def.defaultAnimation)) : undefined),
    data: JSON.parse(JSON.stringify(def.data || def.defaultData || { mapping: {} })),
    customProps: def.customProps ? JSON.parse(JSON.stringify(def.customProps)) : (def.defaultCustomProps ? JSON.parse(JSON.stringify(def.defaultCustomProps)) : undefined)
  };

  components.value.push(newComp);
  // 绘制工具激活时保持清空选中，避免选框与手柄阻挡后续连续绘制的起始点点击
  if (drawTool.value === 'select') {
    selectedIds.value = [newComp.id];
  } else {
    selectedIds.value = [];
  }
  recordHistory();
};

const handleFinishDraw = () => {
  if (drawTool.value === 'place-component') {
    drawTool.value = 'select';
    activePlacementDef.value = null;
    activeShapeType.value = '';
  }
  // 折线与箭头工具绘制完一条后保持工具激活状态，支持连续快速画第二条线；按 ESC / 右击画布即可随时切回指针
};

const handleAddCustomSymbolToCanvas = (sym: CustomSymbolDef) => {
  const centerX = Math.max(0, Math.round((screen.value.width - sym.defaultWidth) / 2));
  const centerY = Math.max(0, Math.round((screen.value.height - sym.defaultHeight) / 2));
  const maxZ = components.value.reduce((max, c) => Math.max(max, c.zIndex || 1), 0);

  const newComp: ScreenComponent = {
    id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: `${sym.name}`,
    type: sym.type,
    category: sym.category,
    x: centerX,
    y: centerY,
    width: sym.defaultWidth,
    height: sym.defaultHeight,
    rotation: 0,
    zIndex: maxZ + 1,
    locked: false,
    visible: true,
    states: sym.states ? JSON.parse(JSON.stringify(sym.states)) : undefined,
    activeState: sym.activeState || (sym.states?.[0]?.id ?? '1'),
    children: sym.children ? JSON.parse(JSON.stringify(sym.children)) : undefined,
    style: (() => {
      const st = JSON.parse(JSON.stringify(sym.defaultStyle || {}));
      st.fill = 'transparent';
      st.bgColor = 'transparent';
      return st;
    })(),
    data: JSON.parse(JSON.stringify(sym.defaultData || { mapping: {} })),
    customProps: sym.defaultCustomProps ? JSON.parse(JSON.stringify(sym.defaultCustomProps)) : undefined
  };

  components.value.push(newComp);
  selectedIds.value = [newComp.id];
  recordHistory();
};

const handleUpdateComponent = (comp: ScreenComponent, record = false) => {
  const target = components.value.find(c => c.id === comp.id);
  if (target) {
    Object.assign(target, comp);
    components.value = [...components.value];
    if (record) recordHistory();
  }
};

const handleUpdateComponents = (updatedComps: ScreenComponent[], record = false) => {
  if (!Array.isArray(updatedComps) || updatedComps.length === 0) return;
  const map = new Map(updatedComps.map(c => [c.id, c]));
  const currentList = components.value;
  for (let i = 0; i < currentList.length; i++) {
    const updated = map.get(currentList[i].id);
    if (updated) {
      Object.assign(currentList[i], updated);
    }
  }
  components.value = [...components.value];
  if (record) recordHistory();
};

// =========================================================================
// 顶栏动态属性与画笔全局预设 (预设模式与选中模式双逻辑)
// =========================================================================
const drawingPreset = ref({
  stroke: '#00f2ff',
  fill: 'transparent',
  fillOpacity: 1,
  strokeWidth: 2,
  lineStyle: 'solid' as 'solid' | 'dashed' | 'dotted',
  fontSize: 14,
  fontWeight: 'bold' as 'normal' | 'bold'
});

const handleUpdateDrawingStyle = (payload: { key: string; value: any }) => {
  const { key, value } = payload;
  (drawingPreset.value as any)[key] = value;

  // 当有选中图元时：即时批量同步生效至选中的图元，并压入撤销历史栈
  if (selectedIds.value.length > 0) {
    const updatedList = selectedComponents.value.map(comp => {
      const st = { ...(comp.style || {}) };
      const isTextOrTelemetry = comp.type === 'draw-text' || 
        comp.type === 'metric-header' || 
        comp.type === 'metric-float' || 
        comp.type === 'metric-flipper' || 
        comp.type === 'metric-counter' || 
        comp.type === 'metric-digital' || 
        comp.type.includes('text') || 
        comp.type.includes('sign') || 
        comp.type.includes('metric');
      if (key === 'stroke') {
        st.stroke = value;
        st.borderColor = value;
        if (isTextOrTelemetry) {
          st.textColor = value;
          st.color = value;
        }
      } else if (key === 'fill') {
        st.fill = value;
        st.bgColor = value;
      } else if (key === 'fillOpacity') {
        st.fillOpacity = value;
        st.bgOpacity = value;
      } else if (key === 'strokeWidth') {
        st.strokeWidth = value;
        st.borderWidth = value;
      } else if (key === 'lineStyle') {
        st.lineStyle = value;
      } else if (key === 'fontSize') {
        st.fontSize = value;
        delete st.fontSizeMode;
      } else if (key === 'fontWeight') {
        st.fontWeight = value;
      }
      return {
        ...comp,
        style: st
      };
    });
    handleUpdateComponents(updatedList, true);
  }
};

// Component Clipboard Buffer
const clipboard = ref<ScreenComponent[]>([]);

const handleCopy = (target?: ScreenComponent | ScreenComponent[]) => {
  const items = target 
    ? (Array.isArray(target) ? target : [target]) 
    : selectedComponents.value;
  if (!items || items.length === 0) return;
  clipboard.value = JSON.parse(JSON.stringify(items));
};

const handleCut = (target?: ScreenComponent | ScreenComponent[]) => {
  const items = target 
    ? (Array.isArray(target) ? target : [target]) 
    : selectedComponents.value;
  if (!items || items.length === 0) return;
  handleCopy(items);
  handleDelete(items.map(c => c.id));
};

const handlePaste = (pos?: { x: number; y: number }) => {
  if (!clipboard.value || clipboard.value.length === 0) return;
  
  const maxZ = components.value.reduce((max, c) => Math.max(max, c.zIndex || 1), 0);
  
  let minX = Infinity;
  let minY = Infinity;
  clipboard.value.forEach(c => {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
  });

  const isSnap = snapToGrid.value && gridSize.value > 0;
  const gs = isSnap ? gridSize.value : 20;

  // 严格基于网格基准点进行位移计算：无论多选还是单选，严格保证对齐到物理格点
  let baseTargetX = 0;
  let baseTargetY = 0;
  if (pos) {
    baseTargetX = isSnap ? Math.round(pos.x / gs) * gs : pos.x;
    baseTargetY = isSnap ? Math.round(pos.y / gs) * gs : pos.y;
  } else {
    baseTargetX = isSnap ? Math.round((minX + gs) / gs) * gs : (minX + gs);
    baseTargetY = isSnap ? Math.round((minY + gs) / gs) * gs : (minY + gs);
  }

  const shiftX = baseTargetX - minX;
  const shiftY = baseTargetY - minY;

  const existingNames = components.value.map(c => c.name);
  const pasted: ScreenComponent[] = clipboard.value.map((comp, idx) => {
    let targetX = comp.x + shiftX;
    let targetY = comp.y + shiftY;

    if (isSnap) {
      targetX = Math.round(targetX / gs) * gs;
      targetY = Math.round(targetY / gs) * gs;
    }

    const uniqueName = generateUniqueDuplicateName(comp.name, existingNames, '组件');
    existingNames.push(uniqueName);
    return {
      ...JSON.parse(JSON.stringify(comp)),
      id: `comp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      name: uniqueName,
      x: targetX,
      y: targetY,
      zIndex: maxZ + idx + 1
    };
  });

  components.value.push(...pasted);
  selectedIds.value = pasted.map(p => p.id);
  recordHistory();
};

const handleDuplicate = (target: ScreenComponent | ScreenComponent[]) => {
  const items = Array.isArray(target) ? target : [target];
  if (!items || items.length === 0) return;

  const isSnap = snapToGrid.value && gridSize.value > 0;
  const gs = isSnap ? gridSize.value : 20;

  const maxZ = components.value.reduce((max, c) => Math.max(max, c.zIndex || 1), 0);
  const existingNames = components.value.map(c => c.name);

  // 以首个组件为吸附锚点，整体平移精确的格点步长，杜绝多选组件内部相对位置错位
  const anchor = items[0];
  const targetAnchorX = isSnap ? Math.round((anchor.x + gs) / gs) * gs : (anchor.x + gs);
  const targetAnchorY = isSnap ? Math.round((anchor.y + gs) / gs) * gs : (anchor.y + gs);
  const shiftX = targetAnchorX - anchor.x;
  const shiftY = targetAnchorY - anchor.y;

  const duplicates: ScreenComponent[] = items.map((comp, idx) => {
    let targetX = comp.x + shiftX;
    let targetY = comp.y + shiftY;
    if (isSnap) {
      targetX = Math.round(targetX / gs) * gs;
      targetY = Math.round(targetY / gs) * gs;
    }

    const uniqueName = generateUniqueDuplicateName(comp.name, existingNames, '组件');
    existingNames.push(uniqueName);
    return {
      ...JSON.parse(JSON.stringify(comp)),
      id: `comp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      name: uniqueName,
      x: targetX,
      y: targetY,
      zIndex: maxZ + idx + 1
    };
  });

  components.value.push(...duplicates);
  selectedIds.value = duplicates.map(d => d.id);
  recordHistory();
};

const handleDelete = (target: string | string[]) => {
  const idsToDelete = Array.isArray(target) ? target : [target];
  const set = new Set(idsToDelete);
  components.value = components.value.filter(c => !set.has(c.id));
  selectedIds.value = selectedIds.value.filter(i => !set.has(i));
  recordHistory();
};

const handleDeleteBatch = (ids: string[]) => {
  handleDelete(ids);
};

const handleClearCanvas = () => {
  if (safeConfirm('确定要清空当前画面中的所有组件吗？')) {
    components.value = [];
    selectedIds.value = [];
    recordHistory();
  }
};

// Z-index layer order (Normalized Stack Sequencing)
const handleBringToFront = (ids: string | string[]) => {
  const targetIds = Array.isArray(ids) ? ids : [ids];
  if (targetIds.length === 0) return;

  const currentStack = [...components.value].sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1));
  const nonTargets = currentStack.filter(c => !targetIds.includes(c.id));
  const targets = currentStack.filter(c => targetIds.includes(c.id));

  const newStack = [...nonTargets, ...targets];
  newStack.forEach((c, idx) => {
    c.zIndex = idx + 1;
  });
  components.value = newStack;
  recordHistory();
};

const handleSendToBack = (ids: string | string[]) => {
  const targetIds = Array.isArray(ids) ? ids : [ids];
  if (targetIds.length === 0) return;

  const currentStack = [...components.value].sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1));
  const nonTargets = currentStack.filter(c => !targetIds.includes(c.id));
  const targets = currentStack.filter(c => targetIds.includes(c.id));

  const newStack = [...targets, ...nonTargets];
  newStack.forEach((c, idx) => {
    c.zIndex = idx + 1;
  });
  components.value = newStack;
  recordHistory();
};

const handleMoveUp = (ids: string | string[]) => {
  const targetIds = Array.isArray(ids) ? ids : [ids];
  if (targetIds.length === 0) return;

  const currentStack = [...components.value].sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1));
  for (let i = currentStack.length - 2; i >= 0; i--) {
    if (targetIds.includes(currentStack[i].id) && !targetIds.includes(currentStack[i + 1].id)) {
      const temp = currentStack[i];
      currentStack[i] = currentStack[i + 1];
      currentStack[i + 1] = temp;
    }
  }

  currentStack.forEach((c, idx) => {
    c.zIndex = idx + 1;
  });
  components.value = currentStack;
  recordHistory();
};

const handleMoveDown = (ids: string | string[]) => {
  const targetIds = Array.isArray(ids) ? ids : [ids];
  if (targetIds.length === 0) return;

  const currentStack = [...components.value].sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1));
  for (let i = 1; i < currentStack.length; i++) {
    if (targetIds.includes(currentStack[i].id) && !targetIds.includes(currentStack[i - 1].id)) {
      const temp = currentStack[i];
      currentStack[i] = currentStack[i - 1];
      currentStack[i - 1] = temp;
    }
  }

  currentStack.forEach((c, idx) => {
    c.zIndex = idx + 1;
  });
  components.value = currentStack;
  recordHistory();
};

// Alignment & Equal Sizing tools (Supports single, multi-selection, equal sizing, and even distribution)
const handleAlignComponent = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v' | 'equal-width' | 'equal-height' | 'equal-size' | 'equal-max-size' | 'equal-min-size' | 'make-square') => {
  const targets = components.value.filter(c => selectedIds.value.includes(c.id) && !c.locked);
  if (targets.length === 0) return;

  if (targets.length === 1 && !type.startsWith('distribute') && !type.startsWith('equal') && type !== 'make-square') {
    const target = targets[0];
    if (type === 'left') target.x = 0;
    if (type === 'center') target.x = Math.round((screen.value.width - target.width) / 2);
    if (type === 'right') target.x = Math.round(screen.value.width - target.width);
    if (type === 'top') target.y = 0;
    if (type === 'middle') target.y = Math.round((screen.value.height - target.height) / 2);
    if (type === 'bottom') target.y = Math.round(screen.value.height - target.height);
  } else if (targets.length >= 1 && (type.startsWith('equal') || type === 'make-square')) {
    // Equal Sizing features
    if (type === 'equal-width') {
      const baseW = targets[0].width;
      targets.forEach(c => { c.width = baseW; });
    } else if (type === 'equal-height') {
      const baseH = targets[0].height;
      targets.forEach(c => { c.height = baseH; });
    } else if (type === 'equal-size') {
      const baseW = targets[0].width;
      const baseH = targets[0].height;
      targets.forEach(c => { c.width = baseW; c.height = baseH; });
    } else if (type === 'equal-max-size') {
      const maxW = Math.max(...targets.map(c => c.width));
      const maxH = Math.max(...targets.map(c => c.height));
      targets.forEach(c => { c.width = maxW; c.height = maxH; });
    } else if (type === 'equal-min-size') {
      const minW = Math.min(...targets.map(c => c.width));
      const minH = Math.min(...targets.map(c => c.height));
      targets.forEach(c => { c.width = minW; c.height = minH; });
    } else if (type === 'make-square') {
      targets.forEach(c => {
        const sz = Math.max(c.width, c.height);
        c.width = sz;
        c.height = sz;
      });
    }
    components.value = [...components.value];
  } else if (targets.length >= 2) {
    if (type === 'distribute-h') {
      if (targets.length >= 3) {
        const sorted = [...targets].sort((a, b) => a.x - b.x);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const totalSpan = (last.x + last.width) - first.x;
        const totalElemWidths = sorted.reduce((sum, c) => sum + c.width, 0);
        const availableGap = totalSpan - totalElemWidths;
        const gap = availableGap / (sorted.length - 1);
        
        let currX = first.x + first.width + gap;
        for (let i = 1; i < sorted.length - 1; i++) {
          sorted[i].x = Math.round(currX);
          currX += sorted[i].width + gap;
        }
      }
    } else if (type === 'distribute-v') {
      if (targets.length >= 3) {
        const sorted = [...targets].sort((a, b) => a.y - b.y);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const totalSpan = (last.y + last.height) - first.y;
        const totalElemHeights = sorted.reduce((sum, c) => sum + c.height, 0);
        const availableGap = totalSpan - totalElemHeights;
        const gap = availableGap / (sorted.length - 1);

        let currY = first.y + first.height + gap;
        for (let i = 1; i < sorted.length - 1; i++) {
          sorted[i].y = Math.round(currY);
          currY += sorted[i].height + gap;
        }
      }
    } else {
      // Multi-selection alignment
      const minX = Math.min(...targets.map(c => c.x));
      const maxX = Math.max(...targets.map(c => c.x + c.width));
      const minY = Math.min(...targets.map(c => c.y));
      const maxY = Math.max(...targets.map(c => c.y + c.height));
      const midX = minX + (maxX - minX) / 2;
      const midY = minY + (maxY - minY) / 2;

      targets.forEach(c => {
        if (type === 'left') c.x = minX;
        if (type === 'center') c.x = Math.round(midX - c.width / 2);
        if (type === 'right') c.x = Math.round(maxX - c.width);
        if (type === 'top') c.y = minY;
        if (type === 'middle') c.y = Math.round(midY - c.height / 2);
        if (type === 'bottom') c.y = Math.round(maxY - c.height);
      });
    }
  }

  recordHistory();
};

// Re-snap all components to grid nodes (吸附到点格)
const handleSnapAllToGrid = () => {
  const gs = gridSize.value || 40;
  components.value = components.value.map(c => ({
    ...c,
    x: Math.round(c.x / gs) * gs,
    y: Math.round(c.y / gs) * gs
  }));
  recordHistory();
};

// Group Components (组合多选图元为复合组件)
const handleGroup = (targets?: ScreenComponent[]) => {
  const compsToGroup = targets && targets.length > 0
    ? targets
    : components.value.filter(c => selectedIds.value.includes(c.id) && !c.locked);
  if (compsToGroup.length < 2) return;

  const minX = Math.min(...compsToGroup.map(c => c.x));
  const minY = Math.min(...compsToGroup.map(c => c.y));
  const maxX = Math.max(...compsToGroup.map(c => c.x + c.width));
  const maxY = Math.max(...compsToGroup.map(c => c.y + c.height));
  const groupW = Math.max(10, maxX - minX);
  const groupH = Math.max(10, maxY - minY);
  const maxZ = Math.max(...compsToGroup.map(c => c.zIndex || 1));

  const relativeChildren: ScreenComponent[] = compsToGroup.map(c => ({
    ...JSON.parse(JSON.stringify(c)),
    x: c.x - minX,
    y: c.y - minY
  }));

  const groupComp: ScreenComponent = {
    id: `comp-group-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: `组合图元 (${compsToGroup.length}项)`,
    type: 'composite-symbol',
    category: 'custom',
    x: minX,
    y: minY,
    width: groupW,
    height: groupH,
    rotation: 0,
    zIndex: maxZ,
    locked: false,
    visible: true,
    children: relativeChildren,
    style: {},
    data: { mapping: {} }
  };

  const toRemoveIds = new Set(compsToGroup.map(c => c.id));
  const remaining = components.value.filter(c => !toRemoveIds.has(c.id));
  components.value = [...remaining, groupComp];
  selectedIds.value = [groupComp.id];
  recordHistory();
};

// Ungroup Component (解散组合复合组件为散装图元)
const handleUngroup = (groupTarget?: ScreenComponent) => {
  const target = groupTarget || components.value.find(c => selectedIds.value.includes(c.id));
  if (!target || !target.children || target.children.length === 0) return;

  const baseMinX = Math.min(...target.children.map(c => c.x));
  const baseMinY = Math.min(...target.children.map(c => c.y));
  const baseMaxX = Math.max(...target.children.map(c => c.x + c.width));
  const baseMaxY = Math.max(...target.children.map(c => c.y + c.height));
  const baseW = Math.max(1, baseMaxX - baseMinX);
  const baseH = Math.max(1, baseMaxY - baseMinY);

  const scaleX = target.width / baseW;
  const scaleY = target.height / baseH;

  const unpackedChildren: ScreenComponent[] = target.children.map((c, idx) => ({
    ...JSON.parse(JSON.stringify(c)),
    id: `comp-ungrouped-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
    x: Math.round(target.x + c.x * scaleX),
    y: Math.round(target.y + c.y * scaleY),
    width: Math.max(10, Math.round(c.width * scaleX)),
    height: Math.max(6, Math.round(c.height * scaleY)),
    zIndex: (target.zIndex || 1) + idx
  }));

  const remaining = components.value.filter(c => c.id !== target.id);
  components.value = [...remaining, ...unpackedChildren];
  selectedIds.value = unpackedChildren.map(c => c.id);
  recordHistory();
};

const handleLockSelected = () => {
  if (selectedIds.value.length === 0) return;
  let changed = false;
  components.value.forEach(c => {
    if (selectedIds.value.includes(c.id) && !c.locked) {
      c.locked = true;
      changed = true;
    }
  });
  if (changed) recordHistory();
};

const handleUnlockSelected = () => {
  if (selectedIds.value.length === 0) return;
  let changed = false;
  components.value.forEach(c => {
    if (selectedIds.value.includes(c.id) && c.locked) {
      c.locked = false;
      changed = true;
    }
  });
  if (changed) recordHistory();
};

// Batch Point Generation & Binding Handlers (批量生成与批量绑定生效)
const handleBatchGenerateComps = (newComps: ScreenComponent[]) => {
  if (!newComps || newComps.length === 0) return;
  components.value.push(...newComps);
  selectedIds.value = newComps.map(c => c.id);
  recordHistory();
};

const handleBatchBindPoints = (bindings: Array<{ compId: string; point: any; category: string; deviceId: string; datasetId?: string }>) => {
  if (!bindings || bindings.length === 0) return;
  bindings.forEach(b => {
    const comp = components.value.find(c => c.id === b.compId);
    if (comp) {
      const pointKey = `${b.deviceId}_${b.category.toUpperCase()}_${b.point.pointId}`;
      if (!comp.data) comp.data = { mapping: {} };
      comp.data.datasetId = b.datasetId || 'ds-substation-scada';
      comp.data.mapping = {
        ...comp.data.mapping,
        deviceId: b.deviceId,
        pointCategory: b.category === 'yc' ? 'telemetry' : (b.category === 'yx' ? 'teleSignal' : 'energy'),
        pointId: b.point.pointId,
        valueKey: pointKey,
        stateKey: pointKey,
        statusKey: pointKey
      };
    }
  });
  recordHistory();
};

// Component Data Association Modal Flow (右键菜单级联关联测点：厂站/装置/五遥/测点)
const handleOpenDataAssociation = (comp?: ScreenComponent) => {
  if (comp) {
    associationTargetComponent.value = comp;
  } else if (selectedComponent.value) {
    associationTargetComponent.value = selectedComponent.value;
  } else if (components.value.length > 0) {
    associationTargetComponent.value = components.value[0];
  } else {
    associationTargetComponent.value = null;
  }
  if (associationTargetComponent.value) {
    showDataAssociationModal.value = true;
  }
};

const handleDataAssociationSubmit = (payload: {
  componentId: string;
  unbind?: boolean;
  datasetId?: string;
  deviceId?: string;
  deviceName?: string;
  category?: 'yc' | 'yx' | 'dd' | 'yk' | 'yt';
  point?: any;
  targetVerificationPointId?: number | string;
}) => {
  const comp = components.value.find(c => c.id === payload.componentId);
  if (!comp) {
    showDataAssociationModal.value = false;
    return;
  }

  if (payload.unbind) {
    // 解绑测点
    if (!comp.data) comp.data = { mapping: {} };
    comp.data.mapping = {};
    if (comp.data.bindings) {
      delete comp.data.bindings.value;
      delete comp.data.bindings.state;
    }
    if (comp.data.action && (comp.data.action.type === 'tele-control' || comp.data.action.type === 'tele-regulation')) {
      delete comp.data.action;
    }
    showDataAssociationModal.value = false;
    recordHistory();
    return;
  }

  if (!comp.data) comp.data = { mapping: {} };
  if (!comp.data.mapping) comp.data.mapping = {};
  if (!comp.data.bindings) comp.data.bindings = {};

  const datasetId = payload.datasetId || 'ds-substation-scada';
  const deviceId = payload.deviceId || '';
  const point = payload.point || {};
  const pointId = point.pointId;
  const pointName = point.name || '';
  const category = payload.category || 'yc';

  comp.data.datasetId = datasetId;

  if (category === 'yc') {
    const pointKey = `${deviceId}_YC_${pointId}`;
    comp.data.mapping = {
      ...comp.data.mapping,
      deviceId,
      deviceName: payload.deviceName,
      pointCategory: 'telemetry',
      pointId,
      pointName,
      valueKey: pointKey,
      unit: ''
    };
    comp.data.bindings = {
      ...comp.data.bindings,
      value: pointKey
    };
    const initialVal = resolveDataPointValue(datasets.value, datasetId, pointKey, 0);
    comp.data.value = initialVal;
    if (comp.customProps) {
      comp.customProps.value = initialVal;
    }
  } else if (category === 'yx') {
    const pointKey = `${deviceId}_YX_${pointId}`;
    comp.data.mapping = {
      ...comp.data.mapping,
      deviceId,
      deviceName: payload.deviceName,
      pointCategory: 'teleSignal',
      pointId,
      pointName,
      stateKey: pointKey
    };
    comp.data.bindings = {
      ...comp.data.bindings,
      state: pointKey
    };
    const initialVal = resolveDataPointValue(datasets.value, datasetId, pointKey, 0);
    comp.data.state = initialVal;
    comp.data.value = initialVal;
    if (comp.customProps) {
      comp.customProps.state = initialVal;
      comp.customProps.value = initialVal;
    }
    if (comp.states && comp.states.length > 0) {
      comp.activeState = String(initialVal);
    }
  } else if (category === 'dd') {
    const pointKey = `${deviceId}_DD_${pointId}`;
    comp.data.mapping = {
      ...comp.data.mapping,
      deviceId,
      deviceName: payload.deviceName,
      pointCategory: 'energy',
      pointId,
      pointName,
      valueKey: pointKey,
      unit: ''
    };
    comp.data.bindings = {
      ...comp.data.bindings,
      value: pointKey
    };
    const initialVal = resolveDataPointValue(datasets.value, datasetId, pointKey, 0);
    comp.data.value = initialVal;
    if (comp.customProps) {
      comp.customProps.value = initialVal;
    }
  } else if (category === 'yk') {
    const ykKey = `${deviceId}_YK_${pointId}`;
    comp.data.mapping = {
      ...comp.data.mapping,
      deviceId,
      deviceName: payload.deviceName,
      pointCategory: 'teleControl',
      pointId,
      ykPointId: pointId,
      yk_id: pointId,
      pointName,
      targetVerificationPointId: payload.targetVerificationPointId,
      targetVerificationType: 'yx',
      verificationTimeout: payload.verificationTimeout || 10
    };
    comp.data.action = {
      type: 'tele-control',
      deviceId,
      pointId,
      yk_id: pointId,
      targetPointId: payload.targetVerificationPointId,
      targetVerificationPointId: payload.targetVerificationPointId,
      targetVerificationType: 'yx',
      verificationTimeout: payload.verificationTimeout || 10
    };
    if (payload.targetVerificationPointId) {
      const yxKey = `${deviceId}_YX_${payload.targetVerificationPointId}`;
      comp.data.mapping.targetYxPointId = Number(payload.targetVerificationPointId);
      comp.data.mapping.stateKey = yxKey;
      comp.data.bindings = {
        ...comp.data.bindings,
        state: yxKey
      };
    }
  } else if (category === 'yt') {
    const ytKey = `${deviceId}_YT_${pointId}`;
    comp.data.mapping = {
      ...comp.data.mapping,
      deviceId,
      deviceName: payload.deviceName,
      pointCategory: 'teleRegulation',
      pointId,
      ytPointId: pointId,
      yt_id: pointId,
      pointName,
      targetVerificationPointId: payload.targetVerificationPointId,
      targetVerificationType: 'yc',
      verificationTimeout: payload.verificationTimeout || 10
    };
    comp.data.action = {
      type: 'tele-regulation',
      deviceId,
      pointId,
      yt_id: pointId,
      targetPointId: payload.targetVerificationPointId,
      targetVerificationPointId: payload.targetVerificationPointId,
      targetVerificationType: 'yc',
      verificationTimeout: payload.verificationTimeout || 10
    };
    if (payload.targetVerificationPointId) {
      const ycKey = `${deviceId}_YC_${payload.targetVerificationPointId}`;
      comp.data.mapping.targetYcPointId = Number(payload.targetVerificationPointId);
      comp.data.mapping.valueKey = ycKey;
      comp.data.bindings = {
        ...comp.data.bindings,
        value: ycKey
      };
    }
  }

  showDataAssociationModal.value = false;
  invalidateAssociatedPointsCache();
  syncDatasetFastIndex(datasets.value);
  scadaLiveTick.value++;
  recordHistory();
};

// Open Batch Data Association Modal (右键菜单批量关联遥测/遥信)
const handleOpenBatchAssociation = (payload: { components: ScreenComponent[]; category: 'yc' | 'yx' }) => {
  batchAssociationComponents.value = payload.components;
  batchAssociationCategory.value = payload.category;
  showBatchAssociationModal.value = true;
};

// Batch Data Association Submit
const handleBatchAssociationSubmit = (mappings: Array<{
  componentId: string;
  point: { pointId: number; name: string };
  deviceId: string;
  deviceName: string;
  datasetId: string;
  category: 'yc' | 'yx';
}>) => {
  if (!mappings || mappings.length === 0) {
    showBatchAssociationModal.value = false;
    return;
  }

  mappings.forEach(m => {
    const comp = components.value.find(c => c.id === m.componentId);
    if (!comp) return;

    if (!comp.data) comp.data = { mapping: {} };
    if (!comp.data.mapping) comp.data.mapping = {};
    if (!comp.data.bindings) comp.data.bindings = {};

    const datasetId = m.datasetId || 'ds-substation-scada';
    const deviceId = m.deviceId || '';
    const pointId = m.point.pointId;
    const pointName = m.point.name || '';
    const category = m.category;

    comp.data.datasetId = datasetId;

    if (category === 'yc') {
      const pointKey = `${deviceId}_YC_${pointId}`;
      comp.data.mapping = {
        ...comp.data.mapping,
        deviceId,
        deviceName: m.deviceName,
        pointCategory: 'telemetry',
        pointId,
        pointName,
        valueKey: pointKey,
        unit: ''
      };
      comp.data.bindings = {
        ...comp.data.bindings,
        value: pointKey
      };
      const initialVal = resolveDataPointValue(datasets.value, datasetId, pointKey, 0);
      comp.data.value = initialVal;
      if (comp.customProps) {
        comp.customProps.value = initialVal;
      }
    } else if (category === 'yx') {
      const pointKey = `${deviceId}_YX_${pointId}`;
      comp.data.mapping = {
        ...comp.data.mapping,
        deviceId,
        deviceName: m.deviceName,
        pointCategory: 'teleSignal',
        pointId,
        pointName,
        stateKey: pointKey
      };
      comp.data.bindings = {
        ...comp.data.bindings,
        state: pointKey
      };
      const initialVal = resolveDataPointValue(datasets.value, datasetId, pointKey, 0);
      comp.data.state = initialVal;
      comp.data.value = initialVal;
      if (comp.customProps) {
        comp.customProps.state = initialVal;
        comp.customProps.value = initialVal;
      }
      if (comp.states && comp.states.length > 0) {
        comp.activeState = String(initialVal);
      }
    }
  });

  showBatchAssociationModal.value = false;
  invalidateAssociatedPointsCache();
  syncDatasetFastIndex(datasets.value);
  scadaLiveTick.value++;
  recordHistory();
  showDiskNotification(`已成功批量关联 ${mappings.length} 个 ${batchAssociationCategory.value === 'yc' ? '遥测' : '遥信'} 测点`);
};

// Save as Custom Symbol Flow
const handleOpenSaveSymbolModal = (comps: ScreenComponent[]) => {
  if (comps.length === 0) return;
  componentsToSave.value = comps;
  showSaveSymbolModal.value = true;
};

const handleSymbolSaved = (sym: CustomSymbolDef) => {
  showDiskNotification(`图元「${sym.name}」已封装成功并保存至电力一次系统物料库`);
};

// Selected Components reactive computed
const selectedComponents = computed(() => {
  return components.value.filter(c => selectedIds.value.includes(c.id));
});

const selectedComponent = computed(() => {
  return selectedComponents.value.length === 1 ? selectedComponents.value[0] : null;
});

// Dynamic Dataset Simulation Loop & Jump Screen Event Listener
let simulationTimer: any = null;
let alarmSyncTimer: any = null;

// Tele-Control Execution (YK 遥控指令执行与遥信联动刷新)
const handleExecuteControl = (deviceId: string, pointId: number | string, targetValue: number) => {
  if (!Array.isArray(datasets.value)) return;
  datasets.value = datasets.value.map(ds => {
    const hasDevice = ds.devices?.some(d => d.deviceId === deviceId);
    if (hasDevice) {
      const res = executeSimulatedTeleControl(ds, deviceId, pointId, targetValue);
      return res.updatedDataset;
    }
    return ds;
  });
  recordHistory();
};

// Tele-Regulation Execution (YT 遥调定值下发与遥测联动)
const handleExecuteRegulation = (deviceId: string, pointId: number | string, targetValue: number) => {
  if (!Array.isArray(datasets.value)) return;
  datasets.value = datasets.value.map(ds => {
    const hasDevice = ds.devices?.some(d => d.deviceId === deviceId);
    if (hasDevice) {
      const res = executeSimulatedTeleRegulation(ds, deviceId, pointId, targetValue);
      return res.updatedDataset;
    }
    return ds;
  });
  recordHistory();
};

const handleGlobalJumpEvent = (e: any) => {
  if (e.detail) {
    handleSwitchScreen(e.detail);
  }
};

const handleGlobalScadaControlEvent = (e: any) => {
  controlInitialDeviceId.value = e.detail?.deviceId || undefined;
  controlInitialPointId.value = e.detail?.pointId || null;
  controlInitialTargetVerificationPointId.value = e.detail?.targetVerificationPointId || null;
  if (e.detail?.type === 'yt' || e.detail?.type === 'regulation') {
    showRegulationModal.value = true;
  } else {
    showControlModal.value = true;
  }
};

const handleOpenControlModalFromApp = (payload: any) => {
  if (typeof payload === 'string') {
    controlInitialDeviceId.value = payload;
    controlInitialPointId.value = null;
    controlInitialTargetVerificationPointId.value = null;
    showControlModal.value = true;
  } else if (payload) {
    controlInitialDeviceId.value = payload.deviceId || undefined;
    controlInitialPointId.value = payload.pointId || null;
    controlInitialTargetVerificationPointId.value = payload.targetVerificationPointId || null;
    if (payload.type === 'yt' || payload.type === 'regulation') {
      showRegulationModal.value = true;
    } else {
      showControlModal.value = true;
    }
  }
};

// Global keyboard shortcut: Ctrl+S to save active screen, F8 to toggle orthogonal lock
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.isComposing || e.keyCode === 229) return;
  if ((e.code === 'Space' || e.key === ' ' || e.keyCode === 32) && (e.ctrlKey || e.metaKey || e.altKey)) return;

  if (e.key === 'F8') {
    e.preventDefault();
    orthogonalLock.value = !orthogonalLock.value;
    showDiskNotification(orthogonalLock.value ? '已开启正交锁定模式 (F8)' : '已关闭正交锁定，可在任意格点自由连线 (F8)');
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 's') {
    e.preventDefault();
    handleSaveCurrentScreenToDisk();
  }
};

onMounted(async () => {
  // 1. 启动时自动扫描并读取 graph 目录下的所有独立大屏 JSON 文件 (确保至少有一个合规文件)
  try {
    const res = await loadScreensFromDisk();
    if (res.success && res.screens && res.screens.length > 0) {
      screens.value = res.screens;
      storageDirectory.value = res.storageDir || 'graph';
      diskFileCount.value = res.screens.length;
      if (res.indexScreen?.indexScreenId || res.indexScreen?.indexScreenName) {
        indexScreenId.value = res.indexScreen.indexScreenId || '';
        indexScreenName.value = res.indexScreen.indexScreenName || '';
        try {
          localStorage.setItem('scada_index_screen_id', indexScreenId.value);
          localStorage.setItem('scada_index_screen_name', indexScreenName.value);
        } catch {}
      }
      // 检索并应用 cfg/base.json 中的 SCREEN_ORDER
      await reloadAndApplyScreenOrder();
      try {
        const baseCfg = await fetchBaseConfig();
        if (!baseCfg?.SCREEN_ORDER || baseCfg.SCREEN_ORDER.length === 0) {
          await saveScreenOrder(screens.value.map(s => s.name));
        }
      } catch {}

      // 匹配已配置的主索引大屏作为初始界面，否则取首个大屏
      let targetScreen = res.screens[0];
      if (indexScreenId.value || indexScreenName.value) {
        const matched = res.screens.find(s => 
          (indexScreenId.value && s.id === indexScreenId.value) ||
          (indexScreenName.value && s.name.trim().toLowerCase() === indexScreenName.value.trim().toLowerCase())
        );
        if (matched) targetScreen = matched;
      }
      activeScreenId.value = targetScreen.id;
      screen.value = JSON.parse(JSON.stringify(targetScreen.screen));
      components.value = JSON.parse(JSON.stringify(targetScreen.components));
      selectedIds.value = [];

      // 初始化实时监控独立大屏状态（加载已发布保存大屏）
      monitorActiveScreenId.value = targetScreen.id;
      monitorScreen.value = JSON.parse(JSON.stringify(targetScreen.screen));
      monitorComponents.value = JSON.parse(JSON.stringify(targetScreen.components));

      showDiskNotification(`已自动加载 graph/ 目录: 共 ${res.screens.length} 个合规 JSON 大屏`);
    }
  } catch (err) {
    console.warn('[SCADA] 扫描 graph 磁盘大屏失败，回退到默认大屏:', err);
  } finally {
    isBootLoading.value = false;
  }

  // 2. 启动时自动检索并加载 cell/ 目录下的所有独立自定义图元 JSON 文件
  try {
    const loadedCells = await refreshCustomSymbolsFromDisk();
    if (loadedCells && loadedCells.length > 0) {
      console.log(`[SCADA] 启动已检索并同步 cell/ 目录: 共 ${loadedCells.length} 个规范化图元 JSON`);
    }
  } catch (err) {
    console.warn('[SCADA] 自动检索 cell/ 目录图元失败:', err);
  }

  // 3. 启动时自动检索并加载 data/ 目录下的所有独立数据集与装置点表 JSON 文件 (支持 C++ 程序 A 写入持久化)
  try {
    const loadedDatasets = await fetchAllDatasetsFromDisk();
    if (loadedDatasets && loadedDatasets.length > 0) {
      datasets.value = loadedDatasets;
      syncDatasetFastIndex(loadedDatasets);
      console.log(`[SCADA] 启动已成功从 data/ 目录加载 ${loadedDatasets.length} 个数据集与装置点表配置`);
    }
  } catch (err) {
    console.warn('[SCADA] 自动加载 data/ 目录数据集失败:', err);
  }

  // 4. 启动时加载本地持久化 scada_config.json 测点配置树，并自动发起请求向后台接口获取最新测点配置同步点表
  try {
    await loadLocalScadaConfigFile();
  } catch (err) {
    console.warn('[SCADA] 启动加载本地 scada_config.json 失败:', err);
  }

  // 每次程序启动时，自动调用发起一次获取配置请求，自动同步后台点表 (免去工程师手动点击获取配置)
  try {
    const cfgRes = await fetchScadaConfig();
    if (cfgRes.success && cfgRes.data && cfgRes.data.length > 0) {
      const syncedDatasets = convertFacilitiesToDatasets(scadaFacilities.value);
      if (syncedDatasets && syncedDatasets.length > 0) {
        datasets.value = syncedDatasets;
        syncDatasetFastIndex(syncedDatasets);
        console.log(`[SCADA] 启动已自动向后台接口同步测点配置点表: 共 ${cfgRes.data.length} 个厂站`);
      }
    }
  } catch (err) {
    console.warn('[SCADA] 启动自动同步后台点表配置失败 (保持本地已加载点表):', err);
  }

  recordHistory();
  fitToScreen();

  // Only start synthetic simulation timer if explicitly running offline demo mode without SCADA
  // In industrial SCADA mode, realtime polling is strictly handled by fetchScadaRealtime
  simulationTimer = null;

  // 严格从现场实际接口轮询同步告警未确认状态与数据 (绝不虚构)
  syncRealtimeAlarms().catch(() => {});
  alarmSyncTimer = setInterval(() => {
    syncRealtimeAlarms().catch(() => {});
  }, 2000);

  // 5. 启动时自动检索磁盘 cfg/base.json，并计算安全运行天数 (并在夜里 00:00:00 准时检索磁盘条目重新计算)
  const updateSafetyDaysFromDisk = async () => {
    try {
      const cfg = await fetchBaseConfig();
      if (cfg?.SAFE_DATA_START) {
        safetyDays.value = computeSafetyDays(cfg.SAFE_DATA_START);
      }
    } catch (err) {
      console.warn('[SCADA] 读取 cfg/base.json 失败:', err);
    }
  };
  updateSafetyDaysFromDisk();
  cleanupMidnightTask = scheduleMidnightTask(() => {
    updateSafetyDaysFromDisk();
  });

  window.addEventListener('resize', fitToScreen);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('datav:jump:screen', handleGlobalJumpEvent);
  window.addEventListener('scada:open:control', handleGlobalScadaControlEvent);
});

// Login and Logout Handlers
// 选个json大屏作为用户登陆成功后显示的主索引大屏界面 (手动预览不触发此逻辑)
const handleLoginSuccess = async () => {
  isLoggedIn.value = true;
  try {
    const idxCfg = await getIndexScreen();
    if (idxCfg && (idxCfg.indexScreenId || idxCfg.indexScreenName)) {
      indexScreenId.value = idxCfg.indexScreenId || '';
      indexScreenName.value = idxCfg.indexScreenName || '';
    }
    if (indexScreenId.value || indexScreenName.value) {
      const target = screens.value.find(s => 
        (indexScreenId.value && s.id === indexScreenId.value) ||
        (indexScreenName.value && s.name.trim().toLowerCase() === indexScreenName.value.trim().toLowerCase())
      );
      if (target) {
        activeScreenId.value = target.id;
        screen.value = JSON.parse(JSON.stringify(target.screen));
        components.value = JSON.parse(JSON.stringify(target.components));
        selectedIds.value = [];
      }
    }
  } catch (err) {
    console.warn('[SCADA] 登录获取主索引大屏配置失败:', err);
  }
  openWindow('graphic-editor');
  fitToScreen();
};

// 进入实时大屏监控：加载当前画面的已保存版本至监控窗口 (修改需保存后才在实时监控中体现)
const handleOpenPreview = async () => {
  await reloadAndApplyScreenOrder();
  const target = screens.value.find(s => s.id === activeScreenId.value) || screens.value[0];
  if (target) {
    monitorActiveScreenId.value = target.id;
    monitorScreen.value = JSON.parse(JSON.stringify(target.screen));
    monitorComponents.value = JSON.parse(JSON.stringify(target.components));
  }
  openWindow('monitor-screen');
  fitToScreen();
};

const handleLogout = () => {
  logoutUser();
};

const handleExitApp = async () => {
  try {
    await windowClose();
  } catch (err) {
    console.warn('[SCADA] 退出程序调用失败:', err);
  }
};

onBeforeUnmount(() => {
  if (simulationTimer) clearInterval(simulationTimer);
  if (alarmSyncTimer) clearInterval(alarmSyncTimer);
  if (cleanupMidnightTask) cleanupMidnightTask();
  if (diskNotificationTimer) clearTimeout(diskNotificationTimer);
  window.removeEventListener('resize', fitToScreen);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('datav:jump:screen', handleGlobalJumpEvent);
  window.removeEventListener('scada:open:control', handleGlobalScadaControlEvent);
});
</script>

<template>
  <!-- 1. GE-SCADA Industrial Login Interface (Startup view) -->
  <ScadaPvLogin
    v-if="!isLoggedIn"
    @login:success="handleLoginSuccess"
  />

  <!-- 2. SCADA Master Studio Workspace (After login) - GE-SCADA 多组态 MDI 独立窗口系统 (护眼偏暖白底色) -->
  <div v-else class="h-screen w-screen fixed inset-0 overflow-hidden bg-[#e5e7eb] text-slate-900 font-sans select-none">
    <!-- Desktop Area (from top to calc(100vh - 40px)) 护眼柔和暖白底色，杜绝刺眼纯白与冷黑大背景 -->
    <div class="fixed top-0 left-0 right-0 bottom-10 overflow-hidden bg-[#edf0f5]">
      <!-- ======================================================== -->
      <!-- A. 组态窗口 1: 图形编辑界面 (Graphic Editor)             -->
      <!-- ======================================================== -->
      <MdiWindow
        :id="'graphic-editor'"
        :title="'图形编辑界面 (SCADA Studio)'"
        :subtitle="currentScreenItem.name"
        :icon="PenTool"
        :isOpen="getWindow('graphic-editor').isOpen"
        :isMinimized="getWindow('graphic-editor').isMinimized"
        :isMaximized="getWindow('graphic-editor').isMaximized"
        :zIndex="getWindow('graphic-editor').zIndex"
        :x="getWindow('graphic-editor').x"
        :y="getWindow('graphic-editor').y"
        :width="getWindow('graphic-editor').width"
        :height="getWindow('graphic-editor').height"
        :headerTheme="'white'"
        :hideHeaderWhenMaximized="true"
        @focus="focusWindow('graphic-editor')"
        @close="closeWindow('graphic-editor')"
        @minimize="minimizeWindow('graphic-editor')"
        @maximize="maximizeWindow('graphic-editor')"
        @restore="restoreWindow('graphic-editor')"
        @update:x="val => updateWindowCoord('graphic-editor', 'x', val)"
        @update:y="val => updateWindowCoord('graphic-editor', 'y', val)"
        @update:width="val => updateWindowCoord('graphic-editor', 'width', val)"
        @update:height="val => updateWindowCoord('graphic-editor', 'height', val)"
        @update:isMaximized="val => updateWindowProp('graphic-editor', 'isMaximized', val)"
        @update:isMinimized="val => updateWindowProp('graphic-editor', 'isMinimized', val)"
      >
        <div class="w-full h-full flex flex-col bg-slate-100 text-slate-800 overflow-hidden font-sans select-none">
          <!-- Top Navbar (KND科能达 白色主题菜单与工具栏，最大化时自动平衡 Electron 顶栏) -->
          <Navbar
            :screen="screen"
            :zoom="zoom"
            :isStreaming="isStreaming"
            :canUndo="canUndo"
            :canRedo="canRedo"
            :drawTool="drawTool"
            :activeShapeType="activeShapeType"
            :selectedIds="selectedIds"
            :selectedComponents="selectedComponents"
            :showGrid="showGrid"
            :gridSize="gridSize"
            :snapToGrid="snapToGrid"
            :orthogonalLock="orthogonalLock"
            :showRuler="showRuler"
            :isMaximized="getWindow('graphic-editor').isMaximized"
            :drawingPreset="drawingPreset"
            @update:drawing-style="handleUpdateDrawingStyle"
            @minimize:window="minimizeWindow('graphic-editor')"
            @restore:window="restoreWindow('graphic-editor')"
            @maximize:window="maximizeWindow('graphic-editor')"
            @close:window="closeWindow('graphic-editor')"
            @update:screen="screen = $event; recordHistory();"
            @update:zoom="zoom = $event"
            @update:drawTool="drawTool = $event"
            @select:shape="handleSelectBasicShape"
            @update:showGrid="showGrid = $event"
            @update:gridSize="gridSize = $event"
            @update:snapToGrid="snapToGrid = $event"
            @update:orthogonalLock="orthogonalLock = $event"
            @update:showRuler="showRuler = $event"
            @toggle:streaming="isStreaming = !isStreaming"
            @save:screen="handleSaveCurrentScreenToDisk"
            @open:preview="handleOpenPreview"
            @open:datasets="showDatasetsModal = true"
            @open:control="showControlModal = true; controlInitialDeviceId = undefined;"
            @open:disk-storage="showDiskStorageModal = true"
            @open:symbols="showSymbolModal = true"
            @open:platform="showPlatformModal = true"
            @open:login="showLoginModal = true"
            @open:window="openWindow"
            @exit:app="handleExitApp"
            @tile:windows="tileWindows"
            @cascade:windows="cascadeWindows"
            @load:template="handleSwitchScreen"
            @clear:canvas="handleClearCanvas"
            @fit:screen="fitToScreen"
            @undo="handleUndo"
            @redo="handleRedo"
            @align="handleAlignComponent"
            @group="handleGroup"
            @ungroup="handleUngroup"
            @lock="handleLockSelected"
            @unlock="handleUnlockSelected"
            @save:symbol="() => handleOpenSaveSymbolModal(selectedComponents)"
            @center:all="fitToScreen"
            @snap:all="handleSnapAllToGrid"
          />

          <!-- Main Workspace Studio (Sidebar + Canvas + ScreenManagerBar) -->
          <div class="flex-1 flex overflow-hidden relative">
            <!-- Left Sidebar Navigation Tabs -->
            <div class="w-11 shrink-0 bg-[#f7f5ef] border-r border-[#e1ddd4] flex flex-col items-center py-2.5 gap-2.5 z-30">
              <button
                @click="leftSidebarTab = 'palette'"
                class="w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                :class="leftSidebarTab === 'palette' 
                  ? 'bg-[#efeae0] text-sky-700 border border-[#ded8cc] font-medium' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-[#e4ded2]'"
                title="图元浏览器"
              >
                <Box class="w-4.5 h-4.5 stroke-[2]" />
              </button>
              <button
                @click="leftSidebarTab = 'layers'"
                class="w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer relative"
                :class="leftSidebarTab === 'layers' 
                  ? 'bg-[#efeae0] text-sky-700 border border-[#ded8cc] font-medium' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-[#e4ded2]'"
                title="图层管理"
              >
                <Layers class="w-4.5 h-4.5 stroke-[2]" />
                <span 
                  v-if="components.length > 0" 
                  class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-sky-600 text-white text-[8px] font-mono font-medium flex items-center justify-center"
                >
                  {{ components.length }}
                </span>
              </button>
            </div>

            <!-- Left Tab Pane -->
            <ComponentPalette
              v-if="leftSidebarTab === 'palette'"
              @add:component="handleAddComponentFromPalette"
              @open:symbol-modal="showSymbolModal = true"
            />
            <LayerManager
              v-else
              :components="components"
              :selectedIds="selectedIds"
              @select="selectedIds = $event"
              @update:component="c => handleUpdateComponent(c, true)"
              @duplicate="handleDuplicate"
              @delete="handleDelete"
              @bring:front="handleBringToFront"
              @send:back="handleSendToBack"
              @move:up="handleMoveUp"
              @move:down="handleMoveDown"
            />

            <!-- Center Workspace Canvas + Bottom ScreenManagerBar -->
            <div class="flex-1 min-w-0 flex flex-col overflow-hidden relative bg-black">
              <CanvasEditor
                ref="canvasEditorRef"
                :screen="screen"
                :components="components"
                :selectedIds="selectedIds"
                :zoom="zoom"
                :datasets="datasets"
                :drawTool="drawTool"
                :activeComponentDef="activePlacementDef"
                :canPaste="clipboard.length > 0"
                :showGrid="showGrid"
                :gridSize="gridSize"
                :snapToGrid="snapToGrid"
                :orthogonalLock="orthogonalLock"
                :showRuler="showRuler"
                :drawingPreset="drawingPreset"
                @update:zoom="zoom = $event"
                @update:screen="screen = $event; recordHistory();"
                @update:drawTool="drawTool = $event"
                @select="selectedIds = $event"
                @update:component="c => handleUpdateComponent(c, false)"
                @update:components="cs => handleUpdateComponents(cs, false)"
                @add:component:at="handleAddComponentAt"
                @copy="handleCopy"
                @cut="handleCut"
                @paste="handlePaste"
                @duplicate="handleDuplicate"
                @delete="handleDelete"
                @bring:front="handleBringToFront"
                @send:back="handleSendToBack"
                @move:up="handleMoveUp"
                @move:down="handleMoveDown"
                @align="handleAlignComponent"
                @group="handleGroup"
                @ungroup="handleUngroup"
                @save:symbol="handleOpenSaveSymbolModal"
                @undo="handleUndo"
                @redo="handleRedo"
                @finish:draw="handleFinishDraw"
                @open:property-inspector="showPropertyInspector = true"
                @open:data-association="handleOpenDataAssociation"
                @open:batch-association="handleOpenBatchAssociation"
                @open:control-modal="handleOpenControlModalFromApp"
                @commit:history="recordHistory"
              />

              <ScreenManagerBar
                :screens="screens"
                :activeScreenId="activeScreenId"
                :storageDir="storageDirectory"
                :diskFileCount="diskFileCount"
                :isSavingDisk="isSavingDisk"
                :indexScreenId="indexScreenId"
                :indexScreenName="indexScreenName"
                @switch:screen="handleSwitchScreen"
                @add:screen="handleAddScreen"
                @duplicate:screen="handleDuplicateScreen"
                @rename:screen="handleRenameScreen"
                @delete:screen="handleDeleteScreen"
                @open:disk-storage="showDiskStorageModal = true"
                @save:current-disk="handleSaveCurrentScreenToDisk"
                @set:index-screen="handleSetIndexScreen"
                @reorder:screens="handleReorderScreens"
              />
            </div>

            <!-- Right PropertyInspector -->
            <PropertyInspector
              v-if="showPropertyInspector && selectedIds.length > 0"
              :component="selectedComponent"
              :selectedComponents="selectedComponents"
              :screen="screen"
              :datasets="datasets"
              :screens="screens"
              @close="showPropertyInspector = false"
              @update:component="c => handleUpdateComponent(c, true)"
              @update:components="cs => handleUpdateComponents(cs, true)"
              @update:datasets="datasets = $event"
              @update:screen="screen = $event; recordHistory();"
              @align:component="handleAlignComponent"
              @group="handleGroup"
              @ungroup="handleUngroup"
              @save:symbol="handleOpenSaveSymbolModal"
              @delete="handleDeleteBatch"
              @open:batch:points="showBatchPointModal = true"
              @open:data-association="handleOpenDataAssociation"
              @open:control="(devId) => { controlInitialDeviceId = devId; showControlModal = true; }"
            />
          </div>
        </div>
      </MdiWindow>

      <!-- ======================================================== -->
      <!-- B. 组态窗口 2: 实时监控主接线 (SCADA Monitoring)         -->
      <!-- ======================================================== -->
      <MdiWindow
        :id="'monitor-screen'"
        :title="'实时监控'"
        :subtitle="''"
        :icon="Zap"
        :isOpen="getWindow('monitor-screen').isOpen"
        :isMinimized="getWindow('monitor-screen').isMinimized"
        :isMaximized="getWindow('monitor-screen').isMaximized"
        :zIndex="getWindow('monitor-screen').zIndex"
        :x="getWindow('monitor-screen').x"
        :y="getWindow('monitor-screen').y"
        :width="getWindow('monitor-screen').width"
        :height="getWindow('monitor-screen').height"
        :headerTheme="'white'"
        @focus="focusWindow('monitor-screen')"
        @close="closeWindow('monitor-screen')"
        @minimize="minimizeWindow('monitor-screen')"
        @maximize="maximizeWindow('monitor-screen')"
        @restore="restoreWindow('monitor-screen')"
        @update:x="val => updateWindowCoord('monitor-screen', 'x', val)"
        @update:y="val => updateWindowCoord('monitor-screen', 'y', val)"
        @update:width="val => updateWindowCoord('monitor-screen', 'width', val)"
        @update:height="val => updateWindowCoord('monitor-screen', 'height', val)"
        @update:isMaximized="val => updateWindowProp('monitor-screen', 'isMaximized', val)"
        @update:isMinimized="val => updateWindowProp('monitor-screen', 'isMinimized', val)"
      >
        <div class="w-full h-full relative overflow-hidden bg-[#080f1e]">
          <PreviewScreen
            :screen="monitorScreen"
            :components="monitorComponents"
            :datasets="datasets"
            :isStreaming="isStreaming"
            :screens="screens"
            :activeScreenId="monitorActiveScreenId"
            :indexScreenId="indexScreenId"
            :indexScreenName="indexScreenName"
            :isEmbedded="true"
            @close="closeWindow('monitor-screen')"
            @toggle:streaming="isStreaming = !isStreaming"
            @switch:screen="handleMonitorSwitchScreen"
            @reload:current-screen="handleReloadCurrentMonitorScreen"
            @logout="handleLogout"
            @open:alarm="openWindow('alarm-window')"
            @open:window="openWindow"
            @reorder:screens="handleReorderScreens"
          />
          <!-- 极速冷启动闪烁屏蔽帘：在确认真实主索引大屏解析完成前提供平滑暗黑背景，彻底杜绝一次系统图一闪而过 -->
          <div 
            v-if="isBootLoading"
            class="absolute inset-0 bg-[#080f1e] z-50 flex flex-col items-center justify-center select-none pointer-events-none transition-opacity duration-300"
          >
            <div class="flex items-center gap-3 mb-4">
              <div class="w-7 h-7 rounded-md bg-[#d81e06] text-white flex items-center justify-center font-bold text-sm shadow-[0_0_10px_rgba(216,30,6,0.5)]">K</div>
              <span class="text-sm font-bold tracking-wider text-slate-200">系统就绪载入中...</span>
            </div>
            <div class="w-48 h-1 bg-[#1e293b] rounded-full overflow-hidden relative">
              <div class="absolute inset-y-0 left-0 bg-[#0284c7] rounded-full w-2/5 animate-pulse" />
            </div>
          </div>
        </div>
      </MdiWindow>

      <!-- ======================================================== -->
      <!-- C. 独立告警窗口: 全站告警 (可任意拖动/独立打开关闭/白色主题) -->
      <!-- ======================================================== -->
      <MdiWindow
        :id="'alarm-window'"
        :title="'全站告警'"
        :subtitle="''"
        :icon="Bell"
        :isOpen="getWindow('alarm-window').isOpen"
        :isMinimized="getWindow('alarm-window').isMinimized"
        :isMaximized="getWindow('alarm-window').isMaximized"
        :zIndex="getWindow('alarm-window').zIndex"
        :x="getWindow('alarm-window').x"
        :y="getWindow('alarm-window').y"
        :width="getWindow('alarm-window').width"
        :height="getWindow('alarm-window').height"
        :headerTheme="'white'"
        @focus="focusWindow('alarm-window')"
        @close="closeWindow('alarm-window')"
        @minimize="minimizeWindow('alarm-window')"
        @maximize="maximizeWindow('alarm-window')"
        @restore="restoreWindow('alarm-window')"
        @update:x="val => updateWindowCoord('alarm-window', 'x', val)"
        @update:y="val => updateWindowCoord('alarm-window', 'y', val)"
        @update:width="val => updateWindowCoord('alarm-window', 'width', val)"
        @update:height="val => updateWindowCoord('alarm-window', 'height', val)"
        @update:isMaximized="val => updateWindowProp('alarm-window', 'isMaximized', val)"
        @update:isMinimized="val => updateWindowProp('alarm-window', 'isMinimized', val)"
      >
        <RealtimeAlarmModal
          :visible="getWindow('alarm-window').isOpen && !getWindow('alarm-window').isMinimized"
          :isEmbedded="true"
          @close="closeWindow('alarm-window')"
        />
      </MdiWindow>

      <!-- ======================================================== -->
      <!-- D. 独立窗口: 历史曲线 (可任意拖动/独立打开关闭/白色主题)    -->
      <!-- ======================================================== -->
      <MdiWindow
        :id="'history-curve'"
        :title="'历史曲线'"
        :subtitle="''"
        :icon="LineChart"
        :isOpen="getWindow('history-curve').isOpen"
        :isMinimized="getWindow('history-curve').isMinimized"
        :isMaximized="getWindow('history-curve').isMaximized"
        :zIndex="getWindow('history-curve').zIndex"
        :x="getWindow('history-curve').x"
        :y="getWindow('history-curve').y"
        :width="getWindow('history-curve').width"
        :height="getWindow('history-curve').height"
        :headerTheme="'white'"
        @focus="focusWindow('history-curve')"
        @close="closeWindow('history-curve')"
        @minimize="minimizeWindow('history-curve')"
        @maximize="maximizeWindow('history-curve')"
        @restore="restoreWindow('history-curve')"
        @update:x="val => updateWindowCoord('history-curve', 'x', val)"
        @update:y="val => updateWindowCoord('history-curve', 'y', val)"
        @update:width="val => updateWindowCoord('history-curve', 'width', val)"
        @update:height="val => updateWindowCoord('history-curve', 'height', val)"
        @update:isMaximized="val => updateWindowProp('history-curve', 'isMaximized', val)"
        @update:isMinimized="val => updateWindowProp('history-curve', 'isMinimized', val)"
      >
        <HistoryCurveModal
          :visible="true"
          :isEmbedded="true"
          @close="closeWindow('history-curve')"
        />
      </MdiWindow>

      <!-- ======================================================== -->
      <!-- E. 独立窗口: 历史告警 (可任意拖动/独立打开关闭/白色主题)    -->
      <!-- ======================================================== -->
      <MdiWindow
        :id="'history-alarm'"
        :title="'历史告警'"
        :subtitle="''"
        :icon="History"
        :isOpen="getWindow('history-alarm').isOpen"
        :isMinimized="getWindow('history-alarm').isMinimized"
        :isMaximized="getWindow('history-alarm').isMaximized"
        :zIndex="getWindow('history-alarm').zIndex"
        :x="getWindow('history-alarm').x"
        :y="getWindow('history-alarm').y"
        :width="getWindow('history-alarm').width"
        :height="getWindow('history-alarm').height"
        :headerTheme="'white'"
        @focus="focusWindow('history-alarm')"
        @close="closeWindow('history-alarm')"
        @minimize="minimizeWindow('history-alarm')"
        @maximize="maximizeWindow('history-alarm')"
        @restore="restoreWindow('history-alarm')"
        @update:x="val => updateWindowCoord('history-alarm', 'x', val)"
        @update:y="val => updateWindowCoord('history-alarm', 'y', val)"
        @update:width="val => updateWindowCoord('history-alarm', 'width', val)"
        @update:height="val => updateWindowCoord('history-alarm', 'height', val)"
        @update:isMaximized="val => updateWindowProp('history-alarm', 'isMaximized', val)"
        @update:isMinimized="val => updateWindowProp('history-alarm', 'isMinimized', val)"
      >
        <HistoryAlarmModal
          :visible="true"
          :isEmbedded="true"
          @close="closeWindow('history-alarm')"
        />
      </MdiWindow>

      <!-- ======================================================== -->
      <!-- F. 独立窗口: 报表 (可任意拖动/独立打开关闭/白色主题)        -->
      <!-- ======================================================== -->
      <MdiWindow
        :id="'report-window'"
        :title="'报表'"
        :subtitle="''"
        :icon="FileSpreadsheet"
        :isOpen="getWindow('report-window').isOpen"
        :isMinimized="getWindow('report-window').isMinimized"
        :isMaximized="getWindow('report-window').isMaximized"
        :zIndex="getWindow('report-window').zIndex"
        :x="getWindow('report-window').x"
        :y="getWindow('report-window').y"
        :width="getWindow('report-window').width"
        :height="getWindow('report-window').height"
        :headerTheme="'white'"
        @focus="focusWindow('report-window')"
        @close="closeWindow('report-window')"
        @minimize="minimizeWindow('report-window')"
        @maximize="maximizeWindow('report-window')"
        @restore="restoreWindow('report-window')"
        @update:x="val => updateWindowCoord('report-window', 'x', val)"
        @update:y="val => updateWindowCoord('report-window', 'y', val)"
        @update:width="val => updateWindowCoord('report-window', 'width', val)"
        @update:height="val => updateWindowCoord('report-window', 'height', val)"
        @update:isMaximized="val => updateWindowProp('report-window', 'isMaximized', val)"
        @update:isMinimized="val => updateWindowProp('report-window', 'isMinimized', val)"
      >
        <ReportManagerModal
          :visible="true"
          :isEmbedded="true"
          @close="closeWindow('report-window')"
        />
      </MdiWindow>
    </div>

    <!-- ======================================================== -->
    <!-- 3. GE-SCADA 底部常驻功能栏 (定死在底部不会消失，纯白主题)  -->
    <!-- ======================================================== -->
    <PrsBottomBar
      :windows="bottomBarWindows"
      :activeWindowId="activeWindowId"
      :unconfirmedAlarmCount="globalUnconfirmedAlarmCount"
      :safetyDays="safetyDays"
      @open:window="openWindow"
      @toggle:window="toggleWindow"
      @close:window="closeWindow"
      @tile:windows="tileWindows"
      @cascade:windows="cascadeWindows"
      @minimize:all="minimizeAll"
      @restore:all="restoreAll"
      @toggle:sound="() => {}"
      @logout="handleLogout"
      @switch:user="showLoginModal = true"
      @open:login="showLoginModal = true"
      @open:health="showSystemHealthModal = true"
      @exit:app="handleExitApp"
    />

    <!-- ======================================================== -->
    <!-- 4. 全局弹窗模态框群 (数据集 / 图元工坊 / 测点关联 / 遥控遥调等) -->
    <!-- ======================================================== -->
    <!-- 4.1 数据集与测点配置中心 -->
    <DatasetManagerModal
      :visible="showDatasetsModal"
      :datasets="datasets"
      @close="showDatasetsModal = false"
      @update:datasets="datasets = $event"
    />

    <!-- 4.2 自定义多态图元工坊 (资产库与编辑器) -->
    <CustomSymbolModal
      :visible="showSymbolModal"
      @close="showSymbolModal = false"
      @use:symbol="handleAddCustomSymbolToCanvas"
      @update:symbols="() => {}"
    />

    <!-- 4.3 封装为自定义图元弹窗 -->
    <SaveSymbolModal
      v-if="showSaveSymbolModal"
      :visible="showSaveSymbolModal"
      :selectedComponents="componentsToSave"
      @close="showSaveSymbolModal = false"
      @saved="handleSymbolSaved"
    />

    <!-- 4.4 单图元测点数据关联配置 -->
    <DataAssociationModal
      v-if="showDataAssociationModal"
      :visible="showDataAssociationModal"
      :component="associationTargetComponent"
      @close="showDataAssociationModal = false"
      @submit="handleDataAssociationSubmit"
    />

    <!-- 4.5 批量图元测点关联配置 -->
    <BatchDataAssociationModal
      v-if="showBatchAssociationModal"
      :visible="showBatchAssociationModal"
      :components="batchAssociationComponents"
      :category="batchAssociationCategory"
      :datasets="datasets"
      @close="showBatchAssociationModal = false"
      @submit="handleBatchAssociationSubmit"
    />

    <!-- 4.6 工业遥控闭环操作弹窗 (YK) -->
    <ScadaTeleControlModal
      v-if="showControlModal"
      :visible="showControlModal"
      :initialDeviceId="controlInitialDeviceId"
      :initialPointId="controlInitialPointId"
      :initialTargetVerificationPointId="controlInitialTargetVerificationPointId"
      @close="showControlModal = false"
      @success="() => { showControlModal = false; scadaLiveTick++; }"
    />

    <!-- 4.7 工业遥调闭环操作弹窗 (YT) -->
    <ScadaTeleRegulationModal
      v-if="showRegulationModal"
      :visible="showRegulationModal"
      :initialDeviceId="controlInitialDeviceId"
      :initialPointId="controlInitialPointId"
      :initialTargetVerificationPointId="controlInitialTargetVerificationPointId"
      @close="showRegulationModal = false"
      @success="() => { showRegulationModal = false; scadaLiveTick++; }"
    />

    <!-- 4.8 批量测点总览管理与自动生成看板 -->
    <ScadaBatchPointModal
      v-if="showBatchPointModal"
      :visible="showBatchPointModal"
      :datasets="datasets"
      :selectedComponents="selectedComponents"
      @close="showBatchPointModal = false"
      @update:datasets="datasets = $event"
      @open:control="(devId, ptId, type) => {
        controlInitialDeviceId = devId;
        controlInitialPointId = ptId;
        if (type === 'regulation') {
          showRegulationModal = true;
        } else {
          showControlModal = true;
        }
      }"
    />

    <!-- 6. Multi-Platform Compatibility & Packaging Studio Modal -->
    <DesktopPlatformModal
      :visible="showPlatformModal"
      @close="showPlatformModal = false"
    />

    <!-- 7. SCADA User Auth & Login Modal -->
    <LoginModal
      v-if="showLoginModal"
      :notice="loginNotice"
      @close="showLoginModal = false; loginNotice = '';"
      @success="showLoginModal = false; loginNotice = '';"
      @logout="handleLogout"
    />

    <!-- 8. System SCADA Disk Storage & File-per-Screen Manager Modal -->
    <DiskStorageModal
      :visible="showDiskStorageModal"
      :screens="screens"
      :activeScreenId="activeScreenId"
      :indexScreenId="indexScreenId"
      :indexScreenName="indexScreenName"
      @close="showDiskStorageModal = false"
      @reload:screens="handleReloadScreensFromDisk"
      @update:index-screen="payload => { indexScreenName = payload.indexScreenName; indexScreenId = payload.indexScreenId; }"
      @notify="showDiskNotification"
    />

    <!-- 8.5 系统运行健康与重启黑匣子监控模态框 -->
    <SystemHealthModal
      :visible="showSystemHealthModal"
      @close="showSystemHealthModal = false"
    />

    <!-- Floating Disk Sync Status Toast -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="diskNotification"
        class="fixed bottom-12 right-6 z-50 px-3.5 py-2 rounded-lg bg-[#071328]/95 border border-cyan-400/60 shadow-[0_0_20px_rgba(0,242,255,0.25)] flex items-center gap-2.5 text-xs text-cyan-200 font-mono backdrop-blur-md"
      >
        <HardDrive class="w-4 h-4 text-cyan-400 shrink-0" />
        <span>{{ diskNotification }}</span>
      </div>
    </transition>
  </div>
</template>
