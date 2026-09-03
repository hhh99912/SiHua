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
import { syncDatasetFastIndex, generateUniqueDuplicateName } from './utils/scadaResolver';
import { PRESET_MULTI_SCREENS } from './data/presetMultiScreens';
import { getCustomSymbols, addCustomSymbol } from './utils/customSymbolStorage';
import Navbar from './components/Navbar.vue';
import ComponentPalette from './components/ComponentPalette.vue';
import LayerManager from './components/LayerManager.vue';
import CanvasEditor from './components/CanvasEditor.vue';
import PropertyInspector from './components/PropertyInspector.vue';
import ScreenManagerBar from './components/ScreenManagerBar.vue';
import CustomSymbolModal from './components/CustomSymbolModal.vue';
import SaveSymbolModal from './components/SaveSymbolModal.vue';
import DatasetManagerModal from './components/DatasetManagerModal.vue';
import JsonExportImportModal from './components/JsonExportImportModal.vue';
import PreviewScreen from './components/PreviewScreen.vue';
import DesktopPlatformModal from './components/DesktopPlatformModal.vue';
import ScadaControlModal from './components/ScadaControlModal.vue';
import ScadaBatchPointModal from './components/ScadaBatchPointModal.vue';
import LoginModal from './components/LoginModal.vue';
import ScadaPvLogin from './components/ScadaPvLogin.vue';
import { currentUser, canEditCanvas, isLoggedIn, logoutUser } from './utils/auth';
import { Sparkles, Layers, Box, Zap } from 'lucide-vue-next';

// 1. Initial State: Load Multi-Screen Electrical Project
const screens = ref<ScreenItem[]>(JSON.parse(JSON.stringify(PRESET_MULTI_SCREENS)));
const activeScreenId = ref<string>(PRESET_MULTI_SCREENS[0].id);

// Current active screen object & components ref
const currentScreenItem = computed(() => {
  return screens.value.find(s => s.id === activeScreenId.value) || screens.value[0];
});

const screen = ref<ScreenConfig>({
  ...currentScreenItem.value.screen,
  updatedAt: new Date().toISOString()
});

const components = ref<ScreenComponent[]>([...currentScreenItem.value.components]);
const datasets = ref<DatasetItem[]>([...INITIAL_DATASETS]);
const selectedIds = ref<string[]>([]);
const zoom = ref<number>(0.62);
const isStreaming = ref<boolean>(true);
const leftSidebarTab = ref<'palette' | 'layers'>('palette');
const drawTool = ref<'select' | 'draw-polyline' | 'draw-arrow'>('select');

// Infinite Canvas & Snapping Controls
const showGrid = ref<boolean>(true);
const gridSize = ref<number>(40);
const snapToGrid = ref<boolean>(true);
const orthogonalLock = ref<boolean>(false);
const canvasEditorRef = ref<any>(null);
const showPropertyInspector = ref<boolean>(false);

// Watch selectedIds to automatically hide property inspector when nothing is selected
watch(selectedIds, (newIds) => {
  if (!newIds || newIds.length === 0) {
    showPropertyInspector.value = false;
  }
});

// Modals
const showDatasetsModal = ref(false);
const showControlModal = ref(false);
const controlInitialDeviceId = ref<string | undefined>(undefined);
const showJsonModal = ref(false);
const showPreviewModal = ref(true); // Automatically enter SCADA Dashboard on startup
const showSymbolModal = ref(false);
const showSaveSymbolModal = ref(false);
const showPlatformModal = ref(false);
const showBatchPointModal = ref(false);
const showLoginModal = ref(false);
const loginNotice = ref('');
const componentsToSave = ref<ScreenComponent[]>([]);

// Synchronize current components & screen configuration back to screens array
const syncActiveScreenToProject = () => {
  const target = screens.value.find(s => s.id === activeScreenId.value);
  if (target) {
    target.screen = JSON.parse(JSON.stringify(screen.value));
    target.components = JSON.parse(JSON.stringify(components.value));
  }
};

// Switch active screen
const handleSwitchScreen = (screenId: string) => {
  if (screenId === activeScreenId.value) return;
  // 1. Save current screen state
  syncActiveScreenToProject();

  // 2. Find target screen
  const target = screens.value.find(s => s.id === screenId);
  if (!target) return;

  activeScreenId.value = screenId;
  screen.value = JSON.parse(JSON.stringify(target.screen));
  components.value = JSON.parse(JSON.stringify(target.components));
  selectedIds.value = [];

  fitToScreen();
  recordHistory();
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

// Add new screen (names must be unique)
const handleAddScreen = (payload: { name: string; width: number; height: number }) => {
  syncActiveScreenToProject();
  const newId = `screen-${Date.now()}`;
  const uniqueName = getUniqueScreenName(payload.name);
  const newScreenItem: ScreenItem = {
    id: newId,
    name: uniqueName,
    screen: {
      id: newId,
      name: uniqueName,
      width: payload.width || 1920,
      height: payload.height || 1080,
      backgroundColor: '#040914',
      backgroundGrid: true,
      gridSize: 20,
      gridColor: 'rgba(0, 242, 255, 0.22)',
      theme: 'cyber-dark',
      version: '2.0.0',
      updatedAt: new Date().toISOString()
    },
    components: [
      {
        id: `comp-nav-${Date.now()}`,
        name: 'SCADA 导航条',
        type: 'nav-tabs',
        category: 'custom',
        x: 60,
        y: 20,
        width: payload.width - 120,
        height: 52,
        rotation: 0,
        zIndex: 10,
        style: {
          fill: 'rgba(6, 14, 28, 0.92)',
          stroke: '#00f2ff',
          strokeWidth: 1,
          borderRadius: 10
        },
        data: { mapping: {} }
      }
    ]
  };

  screens.value.push(newScreenItem);
  handleSwitchScreen(newId);
};

// Duplicate screen (names must be unique)
const handleDuplicateScreen = (screenId: string) => {
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
  handleSwitchScreen(newId);
};

// Rename screen (names must be unique)
const handleRenameScreen = (payload: { screenId: string; newName: string }) => {
  const target = screens.value.find(s => s.id === payload.screenId);
  if (target) {
    const trimmed = payload.newName.trim();
    if (!trimmed) return;
    const isTaken = screens.value.some(s => s.id !== payload.screenId && s.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (isTaken) {
      alert(`画面「${trimmed}」已存在，画面名称为唯一识别标识，不可重复！`);
      return;
    }
    target.name = trimmed;
    target.screen.name = trimmed;
    if (target.id === activeScreenId.value) {
      screen.value.name = trimmed;
    }
  }
};

// Delete screen
const handleDeleteScreen = (screenId: string) => {
  if (screens.value.length <= 1) {
    alert('至少需要保留一个画面。');
    return;
  }
  if (!confirm('确定要删除该画面及其所有组件吗？')) return;

  screens.value = screens.value.filter(s => s.id !== screenId);
  if (activeScreenId.value === screenId) {
    const nextScreen = screens.value[0];
    activeScreenId.value = nextScreen.id;
    screen.value = JSON.parse(JSON.stringify(nextScreen.screen));
    components.value = JSON.parse(JSON.stringify(nextScreen.components));
    selectedIds.value = [];
  }
  recordHistory();
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
  if (isPerformingHistory.value) return;
  syncActiveScreenToProject();

  const snapshot: HistorySnapshot = {
    screen: JSON.parse(JSON.stringify(screen.value)),
    components: JSON.parse(JSON.stringify(components.value)),
    datasets: JSON.parse(JSON.stringify(datasets.value)),
    selectedId: selectedIds.value[0] || null
  };

  if (historyIndex.value < historyStack.value.length - 1) {
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
  }

  historyStack.value.push(snapshot);
  if (historyStack.value.length > 50) {
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

// 4. Component Operations
const handleAddComponentFromPalette = (def: any) => {
  const compWidth = def.width || def.defaultWidth || 160;
  const compHeight = def.height || def.defaultHeight || 160;
  const centerX = Math.max(0, Math.round((screen.value.width - compWidth) / 2));
  const centerY = Math.max(0, Math.round((screen.value.height - compHeight) / 2));
  const maxZ = components.value.reduce((max, c) => Math.max(max, c.zIndex || 1), 0);

  const newComp: ScreenComponent = {
    id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: `${def.name} #${components.value.length + 1}`,
    type: def.type,
    category: def.category,
    x: centerX,
    y: centerY,
    width: compWidth,
    height: compHeight,
    rotation: 0,
    zIndex: maxZ + 1,
    locked: false,
    visible: true,
    states: def.states ? JSON.parse(JSON.stringify(def.states)) : undefined,
    activeState: def.activeState || (def.states?.[0]?.id ?? '1'),
    children: def.children ? JSON.parse(JSON.stringify(def.children)) : (def.states?.[0]?.children ? JSON.parse(JSON.stringify(def.states[0].children)) : undefined),
    style: JSON.parse(JSON.stringify(def.style || def.defaultStyle || {})),
    animation: def.animation ? JSON.parse(JSON.stringify(def.animation)) : (def.defaultAnimation ? JSON.parse(JSON.stringify(def.defaultAnimation)) : undefined),
    data: JSON.parse(JSON.stringify(def.data || def.defaultData || { mapping: {} })),
    customProps: def.customProps ? JSON.parse(JSON.stringify(def.customProps)) : (def.defaultCustomProps ? JSON.parse(JSON.stringify(def.defaultCustomProps)) : undefined)
  };

  components.value.push(newComp);
  selectedIds.value = [newComp.id];
  recordHistory();
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
    style: JSON.parse(JSON.stringify(def.style || def.defaultStyle || {})),
    animation: def.animation ? JSON.parse(JSON.stringify(def.animation)) : (def.defaultAnimation ? JSON.parse(JSON.stringify(def.defaultAnimation)) : undefined),
    data: JSON.parse(JSON.stringify(def.data || def.defaultData || { mapping: {} })),
    customProps: def.customProps ? JSON.parse(JSON.stringify(def.customProps)) : (def.defaultCustomProps ? JSON.parse(JSON.stringify(def.defaultCustomProps)) : undefined)
  };

  components.value.push(newComp);
  selectedIds.value = [newComp.id];
  recordHistory();
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
    style: JSON.parse(JSON.stringify(sym.defaultStyle || {})),
    data: JSON.parse(JSON.stringify(sym.defaultData || { mapping: {} })),
    customProps: sym.defaultCustomProps ? JSON.parse(JSON.stringify(sym.defaultCustomProps)) : undefined
  };

  components.value.push(newComp);
  selectedIds.value = [newComp.id];
  recordHistory();
};

const handleUpdateComponent = (comp: ScreenComponent, record = false) => {
  const idx = components.value.findIndex(c => c.id === comp.id);
  if (idx !== -1) {
    components.value[idx] = comp;
    if (record) recordHistory();
  }
};

const handleUpdateComponents = (updatedComps: ScreenComponent[], record = false) => {
  if (!Array.isArray(updatedComps)) return;
  const map = new Map(updatedComps.map(c => [c.id, c]));
  components.value = (components.value || []).map(c => map.has(c.id) ? map.get(c.id)! : c);
  if (record) recordHistory();
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

  const existingNames = components.value.map(c => c.name);
  const pasted: ScreenComponent[] = clipboard.value.map((comp, idx) => {
    const targetX = pos ? Math.max(0, pos.x + (comp.x - minX)) : (comp.x + 24);
    const targetY = pos ? Math.max(0, pos.y + (comp.y - minY)) : (comp.y + 24);
    const uniqueName = generateUniqueDuplicateName(comp.name, existingNames, '组件');
    existingNames.push(uniqueName); // Register immediately for consecutive items in same batch
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
  // Cascade next paste
  clipboard.value = pasted.map(p => ({ ...p, x: p.x + 20, y: p.y + 20 }));
  recordHistory();
};

const handleDuplicate = (target: ScreenComponent | ScreenComponent[]) => {
  const items = Array.isArray(target) ? target : [target];
  if (!items || items.length === 0) return;

  const maxZ = components.value.reduce((max, c) => Math.max(max, c.zIndex || 1), 0);
  const existingNames = components.value.map(c => c.name);
  const duplicates: ScreenComponent[] = items.map((comp, idx) => {
    const uniqueName = generateUniqueDuplicateName(comp.name, existingNames, '组件');
    existingNames.push(uniqueName);
    return {
      ...JSON.parse(JSON.stringify(comp)),
      id: `comp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      name: uniqueName,
      x: comp.x + 24,
      y: comp.y + 24,
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
  if (window.confirm('确定要清空当前画面中的所有组件吗？')) {
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

// Alignment tools (Supports single, multi-selection, and even distribution)
const handleAlignComponent = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v') => {
  const targets = components.value.filter(c => selectedIds.value.includes(c.id) && !c.locked);
  if (targets.length === 0) return;

  if (targets.length === 1 && !type.startsWith('distribute')) {
    const target = targets[0];
    if (type === 'left') target.x = 0;
    if (type === 'center') target.x = Math.round((screen.value.width - target.width) / 2);
    if (type === 'right') target.x = Math.round(screen.value.width - target.width);
    if (type === 'top') target.y = 0;
    if (type === 'middle') target.y = Math.round((screen.value.height - target.height) / 2);
    if (type === 'bottom') target.y = Math.round(screen.value.height - target.height);
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

// Save as Custom Symbol Flow
const handleOpenSaveSymbolModal = (comps: ScreenComponent[]) => {
  if (comps.length === 0) return;
  componentsToSave.value = comps;
  showSaveSymbolModal.value = true;
};

// Import Project JSON
const handleImportProject = (data: any) => {
  if (Array.isArray(data.screens) && data.screens.length > 0) {
    screens.value = JSON.parse(JSON.stringify(data.screens));
    const targetId = data.activeScreenId || data.screens[0].id;
    activeScreenId.value = targetId;
    const active = screens.value.find(s => s.id === targetId) || screens.value[0];
    screen.value = JSON.parse(JSON.stringify(active.screen));
    components.value = JSON.parse(JSON.stringify(active.components));
  } else if (data.screen && Array.isArray(data.components)) {
    screen.value = JSON.parse(JSON.stringify(data.screen));
    components.value = JSON.parse(JSON.stringify(data.components));
    screens.value = [
      {
        id: data.screen.id || `screen-${Date.now()}`,
        name: data.screen.name || '导入的 SCADA 工程',
        screen: JSON.parse(JSON.stringify(data.screen)),
        components: JSON.parse(JSON.stringify(data.components))
      }
    ];
    activeScreenId.value = screens.value[0].id;
  }

  if (Array.isArray(data.datasets) && data.datasets.length > 0) {
    datasets.value = JSON.parse(JSON.stringify(data.datasets));
  }

  selectedIds.value = [];
  fitToScreen();
  recordHistory();
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
  // If preview is active, PreviewScreen handles the modal directly in the preview layer
  if (showPreviewModal.value) return;
  controlInitialDeviceId.value = e.detail?.deviceId || undefined;
  showControlModal.value = true;
};

onMounted(() => {
  recordHistory();
  fitToScreen();

  simulationTimer = setInterval(() => {
    // Only refresh live simulation telemetry when preview mode is active!
    // This decouples editor performance from telemetry polling loops.
    if (showPreviewModal.value && isStreaming.value && Array.isArray(datasets.value) && datasets.value.length > 0) {
      const nextDatasets = datasets.value.map(ds => tickDataset(ds));
      syncDatasetFastIndex(nextDatasets);
      requestAnimationFrame(() => {
        datasets.value = nextDatasets;
      });
    }
  }, 1500);

  window.addEventListener('resize', fitToScreen);
  window.addEventListener('datav:jump:screen', handleGlobalJumpEvent);
  window.addEventListener('scada:open:control', handleGlobalScadaControlEvent);
});

// Login and Logout Handlers
const handleLoginSuccess = () => {
  isLoggedIn.value = true;
  showPreviewModal.value = true; // Enter Big Screen Dashboard directly on successful login
  fitToScreen();
};

const handleLogout = () => {
  logoutUser();
  showPreviewModal.value = false;
};

onBeforeUnmount(() => {
  if (simulationTimer) clearInterval(simulationTimer);
  window.removeEventListener('resize', fitToScreen);
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

  <!-- 2. SCADA Master Studio Workspace (After login) -->
  <div v-else class="h-screen w-screen flex flex-col bg-[#040810] text-slate-200 overflow-hidden font-sans select-none">
    <!-- Top Navigation & Global Controls -->
    <Navbar
      :screen="screen"
      :zoom="zoom"
      :isStreaming="isStreaming"
      :canUndo="canUndo"
      :canRedo="canRedo"
      :drawTool="drawTool"
      :selectedIds="selectedIds"
      :selectedComponents="selectedComponents"
      :showGrid="showGrid"
      :gridSize="gridSize"
      :snapToGrid="snapToGrid"
      :orthogonalLock="orthogonalLock"
      @update:screen="screen = $event; recordHistory();"
      @update:zoom="zoom = $event"
      @update:drawTool="drawTool = $event"
      @update:showGrid="showGrid = $event"
      @update:gridSize="gridSize = $event"
      @update:snapToGrid="snapToGrid = $event"
      @update:orthogonalLock="orthogonalLock = $event"
      @toggle:streaming="isStreaming = !isStreaming"
      @open:preview="showPreviewModal = true"
      @open:datasets="showDatasetsModal = true"
      @open:control="showControlModal = true; controlInitialDeviceId = undefined;"
      @open:json="showJsonModal = true"
      @open:symbols="showSymbolModal = true"
      @open:platform="showPlatformModal = true"
      @open:login="showLoginModal = true"
      @load:template="handleSwitchScreen"
      @clear:canvas="handleClearCanvas"
      @fit:screen="fitToScreen"
      @undo="handleUndo"
      @redo="handleRedo"
      @align="handleAlignComponent"
      @group="handleGroup"
      @ungroup="handleUngroup"
      @save:symbol="() => handleOpenSaveSymbolModal(selectedComponents)"
      @center:all="fitToScreen"
      @snap:all="handleSnapAllToGrid"
    />

    <!-- Main Workspace Studio -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Left Sidebar Navigation Tabs (Palette vs Layers) -->
      <div class="w-11 shrink-0 bg-[#050914] border-r border-cyan-500/20 flex flex-col items-center py-2.5 gap-2.5 z-30">
        <button
          @click="leftSidebarTab = 'palette'"
          class="w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer"
          :class="leftSidebarTab === 'palette' 
            ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.35)]' 
            : 'text-cyan-300 hover:text-white hover:bg-cyan-950/60'"
          title="组件物料库 (含电力一次图元)"
        >
          <Box class="w-4 h-4 stroke-[2]" />
        </button>

        <button
          @click="leftSidebarTab = 'layers'"
          class="w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer relative"
          :class="leftSidebarTab === 'layers' 
            ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.35)]' 
            : 'text-cyan-300 hover:text-white hover:bg-cyan-950/60'"
          title="图层层级列表"
        >
          <Layers class="w-4 h-4 stroke-[2]" />
          <span 
            v-if="components.length > 0" 
            class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-cyan-400 text-slate-950 text-[8px] font-mono font-bold flex items-center justify-center"
          >
            {{ components.length }}
          </span>
        </button>
      </div>

      <!-- Left Tab Pane Content -->
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

      <!-- Center Workspace (Canvas + Bottom Screen Manager Bar) -->
      <div class="flex-1 min-w-0 flex flex-col overflow-hidden relative">
        <CanvasEditor
          ref="canvasEditorRef"
          :screen="screen"
          :components="components"
          :selectedIds="selectedIds"
          :zoom="zoom"
          :datasets="datasets"
          :drawTool="drawTool"
          :canPaste="clipboard.length > 0"
          :showGrid="showGrid"
          :gridSize="gridSize"
          :snapToGrid="snapToGrid"
          :orthogonalLock="orthogonalLock"
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
          @finish:draw="drawTool = 'select'"
          @open:property-inspector="showPropertyInspector = true"
          @open:control-modal="(devId) => { controlInitialDeviceId = devId; showControlModal = true; }"
          @commit:history="recordHistory"
        />

        <!-- Bottom Multi-Screen Page Manager Bar -->
        <ScreenManagerBar
          :screens="screens"
          :activeScreenId="activeScreenId"
          @switch:screen="handleSwitchScreen"
          @add:screen="handleAddScreen"
          @duplicate:screen="handleDuplicateScreen"
          @rename:screen="handleRenameScreen"
          @delete:screen="handleDeleteScreen"
        />
      </div>

      <!-- Right Property & Data Inspector Panel (Opened via Right-Click Context Menu "查看/编辑属性面板") -->
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
        @update:screen="screen = $event; recordHistory();"
        @align:component="handleAlignComponent"
        @group="handleGroup"
        @ungroup="handleUngroup"
        @save:symbol="handleOpenSaveSymbolModal"
        @delete="handleDeleteBatch"
        @open:batch:points="showBatchPointModal = true"
        @open:control="(devId) => { controlInitialDeviceId = devId; showControlModal = true; }"
      />
    </div>

    <!-- 1. Datasets Management Modal -->
    <DatasetManagerModal
      :visible="showDatasetsModal"
      :datasets="datasets"
      @close="showDatasetsModal = false"
      @update:datasets="datasets = $event; recordHistory();"
    />

    <!-- 1.5. SCADA Tele-Control Center Modal (主界面遥控分合闸与遥调指令执行) -->
    <ScadaControlModal
      :visible="showControlModal"
      :datasets="datasets"
      :initialDeviceId="controlInitialDeviceId"
      @close="showControlModal = false"
      @execute:control="handleExecuteControl"
      @execute:regulation="handleExecuteRegulation"
      @update:datasets="datasets = $event; recordHistory();"
    />

    <!-- 1.8. SCADA Batch Point Generation & Binding Modal -->
    <ScadaBatchPointModal
      :visible="showBatchPointModal"
      :datasets="datasets"
      :selectedComponents="selectedComponents"
      @close="showBatchPointModal = false"
      @batch:generate="handleBatchGenerateComps"
      @batch:bind="handleBatchBindPoints"
    />

    <!-- 2. JSON Schema Export & Import Modal -->
    <JsonExportImportModal
      :visible="showJsonModal"
      :screen="screen"
      :components="components"
      :datasets="datasets"
      :screens="screens"
      :activeScreenId="activeScreenId"
      @close="showJsonModal = false"
      @import:project="handleImportProject"
    />

    <!-- 3. Reusable Custom Symbol Library & Studio Modal -->
    <CustomSymbolModal
      :visible="showSymbolModal"
      :selectedComponent="selectedComponent"
      @close="showSymbolModal = false"
      @use:symbol="handleAddCustomSymbolToCanvas"
    />

    <!-- 4. Save Selection as Multi-State Custom Symbol Modal -->
    <SaveSymbolModal
      :visible="showSaveSymbolModal"
      :selectedComponents="componentsToSave"
      @close="showSaveSymbolModal = false"
      @saved="handleAddCustomSymbolToCanvas"
    />

    <!-- 5. Fullscreen Big Screen Presentation Preview -->
    <PreviewScreen
      v-if="showPreviewModal"
      :screen="screen"
      :components="components"
      :datasets="datasets"
      :isStreaming="isStreaming"
      :screens="screens"
      :activeScreenId="activeScreenId"
      @close="showPreviewModal = false; nextTick(() => fitToScreen());"
      @toggle:streaming="isStreaming = !isStreaming"
      @switch:screen="handleSwitchScreen"
      @logout="handleLogout"
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
  </div>
</template>
