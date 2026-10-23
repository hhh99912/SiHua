<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { 
  X, Check, Plus, Trash2, Edit3, Copy, Search, ZoomIn, ZoomOut,
  Grid, ArrowLeft, Move, AlignLeft, AlignCenter, AlignRight,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  RefreshCw, Zap, Square, Circle, Type, Minus, Sliders, Layers,
  ChevronDown, AlertCircle, Scissors, Clipboard, ArrowUpToLine, ArrowDownToLine,
  ChevronUp, ShieldCheck, Box, Activity
} from 'lucide-vue-next';
import { 
  CustomSymbolDef, 
  CustomSymbolStateDef, 
  ScreenComponent, 
  ComponentType 
} from '../types';
import { 
  getCustomSymbols, 
  addCustomSymbol, 
  deleteCustomSymbol,
  refreshCustomSymbolsFromDisk, 
  normalizeSymbolZeroMargin,
  saveCustomSymbolWithRename
} from '../utils/customSymbolStorage';
import { saveCellToDisk, deleteCellFromDisk } from '../utils/cellFileService';
import WidgetRenderer from './widgets/WidgetRenderer.vue';

interface Props {
  visible: boolean;
  initialSymbol?: CustomSymbolDef | null;
  selectedComponent?: ScreenComponent | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'use:symbol', symbol: CustomSymbolDef): void;
  (e: 'update:symbols', symbols: CustomSymbolDef[]): void;
}>();

// ==========================================
// 1. 视图模式：'gallery' (资产库) | 'editor' (编辑工作台)
// ==========================================
const currentView = ref<'gallery' | 'editor'>('gallery');
const symbols = ref<CustomSymbolDef[]>([]);
const searchQuery = ref('');
const isLoading = ref(false);

// 加载图元列表
const loadSymbols = async () => {
  isLoading.value = true;
  try {
    const list = await refreshCustomSymbolsFromDisk();
    symbols.value = list;
    emit('update:symbols', list);
  } catch (err) {
    console.warn('[CustomSymbolModal] 加载图元失败:', err);
    symbols.value = getCustomSymbols();
  } finally {
    isLoading.value = false;
  }
};

const filteredSymbols = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return symbols.value;
  return symbols.value.filter(s => s.name.toLowerCase().includes(q));
});

// ==========================================
// 2. 自定义安全删除弹窗 (解决 iframe sandbox 下 confirm 被吞导致删除失效的问题)
// ==========================================
const deleteConfirmModal = ref<{ visible: boolean; symbol: CustomSymbolDef | null }>({
  visible: false,
  symbol: null
});

const openDeleteConfirm = (sym: CustomSymbolDef) => {
  deleteConfirmModal.value = { visible: true, symbol: sym };
};

const confirmDeleteSymbol = async () => {
  const sym = deleteConfirmModal.value.symbol;
  if (!sym) return;
  deleteConfirmModal.value.visible = false;

  try {
    // 1. 删除磁盘文件 (同时针对 name, id, filename 尝试确保物理文件彻底清理)
    if (sym.name) await deleteCellFromDisk(sym.name);
    if (sym.id && sym.id !== sym.name) await deleteCellFromDisk(sym.id);
    if ((sym as any).filename) await deleteCellFromDisk((sym as any).filename);

    // 2. 清除内存与本地缓存
    deleteCustomSymbol(sym.name);
    deleteCustomSymbol(sym.id);

    await loadSymbols();
    showNotice(`已删除图元: ${sym.name}`);
  } catch (err: any) {
    console.error('删除图元失败:', err);
    showNotice(`删除失败: ${err?.message || '未知错误'}`);
  }
};

// ==========================================
// 3. 图元工作台编辑器状态 (对齐主编辑界面能力)
// ==========================================
const editingSymbol = ref<CustomSymbolDef | null>(null);
const originalSymbolName = ref<string>(''); // 记录初始名称，用于重命名时删除旧文件
const editorStates = ref<CustomSymbolStateDef[]>([]);
const activeStateId = ref<string>('0');
const editorComponents = ref<ScreenComponent[]>([]);
const selectedCompIds = ref<string[]>([]);

// 画布视口缩放与网格
const zoom = ref(1);
const showGrid = ref(true);
const snapToGrid = ref(true);
const gridSize = 10;
const canvasContainerRef = ref<HTMLElement | null>(null);

// 剪贴板缓存
const clipboardComponents = ref<ScreenComponent[]>([]);

// 历史记录栈 (Undo/Redo)
const undoStack = ref<string[]>([]);
const redoStack = ref<string[]>([]);

const recordHistory = () => {
  const snapshot = JSON.stringify(editorComponents.value);
  undoStack.value.push(snapshot);
  if (undoStack.value.length > 30) undoStack.value.shift();
  redoStack.value = [];
};

const handleUndo = () => {
  if (undoStack.value.length === 0) return;
  const current = JSON.stringify(editorComponents.value);
  redoStack.value.push(current);
  const prev = undoStack.value.pop()!;
  editorComponents.value = JSON.parse(prev);
  selectedCompIds.value = [];
};

const handleRedo = () => {
  if (redoStack.value.length === 0) return;
  const current = JSON.stringify(editorComponents.value);
  undoStack.value.push(current);
  const next = redoStack.value.pop()!;
  editorComponents.value = JSON.parse(next);
  selectedCompIds.value = [];
};

// 当前单选组件 (若多选则为第一个)
const primarySelectedComponent = computed(() => {
  if (selectedCompIds.value.length === 0) return null;
  return editorComponents.value.find(c => c.id === selectedCompIds.value[0]) || null;
});

// 计算当前全部组件的包围盒宽高
const computedSymbolBounds = computed(() => {
  if (editorComponents.value.length === 0) {
    return { width: 140, height: 140 };
  }
  const minX = Math.min(...editorComponents.value.map(c => c.x));
  const minY = Math.min(...editorComponents.value.map(c => c.y));
  const maxX = Math.max(...editorComponents.value.map(c => c.x + c.width));
  const maxY = Math.max(...editorComponents.value.map(c => c.y + c.height));
  return {
    width: Math.max(30, Math.round(maxX - minX)),
    height: Math.max(30, Math.round(maxY - minY))
  };
});

// ==========================================
// 4. 丰富完备的物料零件库 (按常用分类组织，满足所有电力与工业图元绘制)
// ==========================================
interface MicroPart {
  type: string;
  name: string;
  icon: any;
  defaultW: number;
  defaultH: number;
  style: any;
  customProps?: any;
}

const activePaletteTab = ref<'basic' | 'electrical' | 'control'>('electrical');

const PALETTE_CATEGORIES: Record<'basic' | 'electrical' | 'control', { title: string; parts: MicroPart[] }> = {
  basic: {
    title: '基础绘图',
    parts: [
      {
        type: 'draw-rect',
        name: '矩形底座',
        icon: Square,
        defaultW: 80,
        defaultH: 50,
        style: { fill: 'rgba(0, 242, 255, 0.1)', stroke: '#00f2ff', strokeWidth: 2, borderRadius: 2 }
      },
      {
        type: 'draw-circle',
        name: '圆形 / 节点',
        icon: Circle,
        defaultW: 40,
        defaultH: 40,
        style: { fill: 'rgba(0, 242, 255, 0.1)', stroke: '#00f2ff', strokeWidth: 2 }
      },
      {
        type: 'draw-text',
        name: '文本标注',
        icon: Type,
        defaultW: 70,
        defaultH: 26,
        style: { text: '文本', textColor: '#ffffff', stroke: '#ffffff', color: '#ffffff', fontSize: 13, fontWeight: 'bold', fill: 'transparent' }
      },
      {
        type: 'straight-line',
        name: '导电母线 / 直线',
        icon: Minus,
        defaultW: 80,
        defaultH: 6,
        style: { stroke: '#ef4444', strokeWidth: 3 },
        customProps: { points: [{ xRatio: 0, yRatio: 0.5 }, { xRatio: 1, yRatio: 0.5 }] }
      },
      {
        type: 'poly-line',
        name: '转角连线 / 折线',
        icon: Minus,
        defaultW: 60,
        defaultH: 60,
        style: { stroke: '#00f2ff', strokeWidth: 2 }
      }
    ]
  },
  electrical: {
    title: '电力一次与开关元件',
    parts: [
      {
        type: 'electrical-breaker',
        name: '高压断路器',
        icon: Zap,
        defaultW: 44,
        defaultH: 44,
        style: { stroke: '#ef4444', strokeWidth: 2 }
      },
      {
        type: 'electrical-disconnector',
        name: '隔离开关',
        icon: Zap,
        defaultW: 44,
        defaultH: 44,
        style: { stroke: '#eab308', strokeWidth: 2 }
      },
      {
        type: 'electrical-handcart',
        name: '抽出式手车',
        icon: Square,
        defaultW: 54,
        defaultH: 54,
        style: { stroke: '#00f2ff', strokeWidth: 2 }
      },
      {
        type: 'electrical-transformer',
        name: '双绕组变压器',
        icon: Circle,
        defaultW: 50,
        defaultH: 50,
        style: { stroke: '#3b82f6', strokeWidth: 2 }
      },
      {
        type: 'electrical-busbar',
        name: '高压主母线',
        icon: Minus,
        defaultW: 140,
        defaultH: 8,
        style: { fill: '#ef4444', stroke: '#ef4444', strokeWidth: 2 }
      },
      {
        type: 'electrical-sensor',
        name: '互感器 (PT/CT)',
        icon: Circle,
        defaultW: 40,
        defaultH: 40,
        style: { stroke: '#a855f7', strokeWidth: 2 }
      },
      // 动触头滑动插头
      {
        type: 'straight-line',
        name: '动触头插头',
        icon: Minus,
        defaultW: 8,
        defaultH: 26,
        style: { stroke: '#ef4444', strokeWidth: 4 }
      },
      // 静触头插头套管
      {
        type: 'draw-rect',
        name: '静触头插座',
        icon: Square,
        defaultW: 18,
        defaultH: 14,
        style: { fill: 'rgba(239, 68, 68, 0.4)', stroke: '#ef4444', strokeWidth: 2, borderRadius: 2 }
      }
    ]
  },
  control: {
    title: '测量与控制部件',
    parts: [
      {
        type: 'status-indicator',
        name: '信号指示灯',
        icon: Circle,
        defaultW: 32,
        defaultH: 32,
        style: { fill: '#22c55e', stroke: '#15803d', strokeWidth: 2 }
      },
      {
        type: 'digital-counter',
        name: '数码测量屏',
        icon: Type,
        defaultW: 84,
        defaultH: 30,
        style: { fill: '#0a101d', stroke: '#3b82f6', color: '#00f2ff', fontSize: 14 }
      },
      {
        type: 'ctrl-button',
        name: '控制按钮',
        icon: Square,
        defaultW: 76,
        defaultH: 32,
        style: { fill: '#0284c7', stroke: '#38bdf8', color: '#ffffff', borderRadius: 4 }
      }
    ]
  }
};

// 向当前状态画布添加零件
const addPartToCanvas = (part: MicroPart) => {
  recordHistory();
  const targetX = 60;
  const targetY = 60;

  const newComp: ScreenComponent = {
    id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    type: part.type as ComponentType,
    name: part.name,
    x: targetX,
    y: targetY,
    width: part.defaultW,
    height: part.defaultH,
    style: {
      fill: part.style.fill || 'transparent',
      stroke: part.style.stroke || '#00f2ff',
      strokeWidth: part.style.strokeWidth || 2,
      borderRadius: part.style.borderRadius || 0,
      opacity: 1,
      textColor: part.style.textColor || '#ffffff',
      color: part.style.color || '#ffffff',
      fontSize: part.style.fontSize || 13,
      fontWeight: part.style.fontWeight || 'bold',
      textAlign: 'center',
      ...part.style
    },
    data: { mapping: {} },
    customProps: part.customProps ? JSON.parse(JSON.stringify(part.customProps)) : {},
    zIndex: editorComponents.value.length + 1
  };

  editorComponents.value.push(newComp);
  selectedCompIds.value = [newComp.id];
};

// ==========================================
// 5. 交互核心：框选 (Marquee) 与多组件平移/缩放
// ==========================================
const isMarqueeSelecting = ref(false);
const marqueeBox = ref({ startX: 0, startY: 0, x: 0, y: 0, width: 0, height: 0 });

// 鼠标在画布空白处按下 -> 开始框选或取消选择
const onCanvasMouseDown = (e: MouseEvent) => {
  // 如果是右键点击，让 contextmenu 专心接管
  if (e.button === 2) return;
  closeContextMenu();

  // 点击在画布空白处：未按 Shift 时清空已有选中
  if (!e.shiftKey && !e.ctrlKey) {
    selectedCompIds.value = [];
  }

  // 启动框选
  isMarqueeSelecting.value = true;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const rawX = (e.clientX - rect.left) / zoom.value;
  const rawY = (e.clientY - rect.top) / zoom.value;

  marqueeBox.value = {
    startX: rawX,
    startY: rawY,
    x: rawX,
    y: rawY,
    width: 0,
    height: 0
  };

  const onMouseMove = (ev: MouseEvent) => {
    if (!isMarqueeSelecting.value) return;
    const curX = (ev.clientX - rect.left) / zoom.value;
    const curY = (ev.clientY - rect.top) / zoom.value;

    const minX = Math.min(marqueeBox.value.startX, curX);
    const minY = Math.min(marqueeBox.value.startY, curY);
    const w = Math.abs(curX - marqueeBox.value.startX);
    const h = Math.abs(curY - marqueeBox.value.startY);

    marqueeBox.value.x = minX;
    marqueeBox.value.y = minY;
    marqueeBox.value.width = w;
    marqueeBox.value.height = h;

    // 框选相交判定：矩形重叠即选中
    if (w > 4 || h > 4) {
      const selected: string[] = [];
      for (const c of editorComponents.value) {
        // 组件坐标已偏移 56px 用于原点留白
        const cx = c.x + 56;
        const cy = c.y + 56;
        if (
          cx + c.width >= minX &&
          cx <= minX + w &&
          cy + c.height >= minY &&
          cy <= minY + h
        ) {
          selected.push(c.id);
        }
      }
      selectedCompIds.value = selected;
    }
  };

  const onMouseUp = () => {
    isMarqueeSelecting.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

// 点击或拖拽组件 (支持单选、Shift加选，以及多选组件同时移动)
let isDraggingComponents = false;
let dragMouseStart = { x: 0, y: 0 };
let initialPositions: { id: string; x: number; y: number }[] = [];

const onComponentMouseDown = (comp: ScreenComponent, e: MouseEvent) => {
  if (e.button === 2) return; // 右键由 contextmenu 接管
  e.stopPropagation();
  closeContextMenu();

  // Shift 多选
  if (e.shiftKey || e.ctrlKey) {
    if (selectedCompIds.value.includes(comp.id)) {
      selectedCompIds.value = selectedCompIds.value.filter(id => id !== comp.id);
    } else {
      selectedCompIds.value.push(comp.id);
    }
  } else {
    if (!selectedCompIds.value.includes(comp.id)) {
      selectedCompIds.value = [comp.id];
    }
  }

  // 记录所有已选组件的起始坐标，支持多选同时平移
  isDraggingComponents = true;
  dragMouseStart = { x: e.clientX, y: e.clientY };
  initialPositions = selectedCompIds.value.map(id => {
    const c = editorComponents.value.find(item => item.id === id);
    return { id, x: c ? c.x : 0, y: c ? c.y : 0 };
  });

  const onMouseMove = (ev: MouseEvent) => {
    if (!isDraggingComponents) return;
    const dx = (ev.clientX - dragMouseStart.x) / zoom.value;
    const dy = (ev.clientY - dragMouseStart.y) / zoom.value;

    for (const init of initialPositions) {
      const c = editorComponents.value.find(item => item.id === init.id);
      if (c) {
        let newX = init.x + dx;
        let newY = init.y + dy;
        if (snapToGrid.value) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }
        c.x = Math.max(0, Math.round(newX));
        c.y = Math.max(0, Math.round(newY));
      }
    }
  };

  const onMouseUp = () => {
    if (isDraggingComponents) {
      isDraggingComponents = false;
      recordHistory();
    }
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

// 尺寸缩放手柄拖动
let isResizingHandle = false;
let resizeHandleDir = '';
let resizeTargetBox = { x: 0, y: 0, width: 0, height: 0 };

const onResizeHandleMouseDown = (dir: string, e: MouseEvent) => {
  e.stopPropagation();
  e.preventDefault();
  const c = primarySelectedComponent.value;
  if (!c) return;

  isResizingHandle = true;
  resizeHandleDir = dir;
  dragMouseStart = { x: e.clientX, y: e.clientY };
  resizeTargetBox = { x: c.x, y: c.y, width: c.width, height: c.height };

  const onMouseMove = (ev: MouseEvent) => {
    if (!isResizingHandle || !primarySelectedComponent.value) return;
    const comp = primarySelectedComponent.value;
    const dx = (ev.clientX - dragMouseStart.x) / zoom.value;
    const dy = (ev.clientY - dragMouseStart.y) / zoom.value;

    let newW = resizeTargetBox.width;
    let newH = resizeTargetBox.height;
    let newX = resizeTargetBox.x;
    let newY = resizeTargetBox.y;

    if (resizeHandleDir.includes('e')) newW = Math.max(10, resizeTargetBox.width + dx);
    if (resizeHandleDir.includes('s')) newH = Math.max(10, resizeTargetBox.height + dy);
    if (resizeHandleDir.includes('w')) {
      const deltaW = Math.min(resizeTargetBox.width - 10, dx);
      newW = resizeTargetBox.width - deltaW;
      newX = resizeTargetBox.x + deltaW;
    }
    if (resizeHandleDir.includes('n')) {
      const deltaH = Math.min(resizeTargetBox.height - 10, dy);
      newH = resizeTargetBox.height - deltaH;
      newY = resizeTargetBox.y + deltaH;
    }

    if (snapToGrid.value) {
      newW = Math.round(newW / gridSize) * gridSize;
      newH = Math.round(newH / gridSize) * gridSize;
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }

    comp.x = Math.max(0, newX);
    comp.y = Math.max(0, newY);
    comp.width = Math.max(10, newW);
    comp.height = Math.max(10, newH);
  };

  const onMouseUp = () => {
    if (isResizingHandle) {
      isResizingHandle = false;
      recordHistory();
    }
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

// ==========================================
// 6. 右键上下文菜单系统 (对齐主界面完整能力)
// ==========================================
const contextMenu = ref<{ visible: boolean; x: number; y: number; targetCompId: string | null }>({
  visible: false,
  x: 0,
  y: 0,
  targetCompId: null
});

const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

// 在组件上右击
const handleComponentContextMenu = (comp: ScreenComponent, e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (!selectedCompIds.value.includes(comp.id)) {
    selectedCompIds.value = [comp.id];
  }
  contextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    targetCompId: comp.id
  };
};

// 在画布空白处右击
const handleCanvasContextMenu = (e: MouseEvent) => {
  e.preventDefault();
  contextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    targetCompId: null
  };
};

// 复制 / 剪切 / 粘贴 / 副本 / 删除
const handleCopy = () => {
  closeContextMenu();
  const selected = editorComponents.value.filter(c => selectedCompIds.value.includes(c.id));
  if (selected.length === 0) return;
  clipboardComponents.value = JSON.parse(JSON.stringify(selected));
};

const handleCut = () => {
  handleCopy();
  handleDeleteSelected();
};

const handlePaste = () => {
  closeContextMenu();
  if (clipboardComponents.value.length === 0) return;
  recordHistory();
  const pasted: ScreenComponent[] = [];
  const offset = 20;

  for (const item of clipboardComponents.value) {
    const clone: ScreenComponent = {
      ...JSON.parse(JSON.stringify(item)),
      id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      x: item.x + offset,
      y: item.y + offset,
      zIndex: editorComponents.value.length + 1
    };
    editorComponents.value.push(clone);
    pasted.push(clone);
  }
  selectedCompIds.value = pasted.map(p => p.id);
};

const handleDuplicate = () => {
  handleCopy();
  handlePaste();
};

const handleDeleteSelected = () => {
  closeContextMenu();
  if (selectedCompIds.value.length === 0) return;
  recordHistory();
  editorComponents.value = editorComponents.value.filter(c => !selectedCompIds.value.includes(c.id));
  selectedCompIds.value = [];
};

// 图层顺序控制
const bringToFront = () => {
  closeContextMenu();
  if (selectedCompIds.value.length === 0) return;
  recordHistory();
  const maxZ = Math.max(...editorComponents.value.map(c => c.zIndex || 1), 1);
  for (const id of selectedCompIds.value) {
    const c = editorComponents.value.find(item => item.id === id);
    if (c) c.zIndex = maxZ + 1;
  }
};

const sendToBack = () => {
  closeContextMenu();
  if (selectedCompIds.value.length === 0) return;
  recordHistory();
  const minZ = Math.min(...editorComponents.value.map(c => c.zIndex || 1), 1);
  for (const id of selectedCompIds.value) {
    const c = editorComponents.value.find(item => item.id === id);
    if (c) c.zIndex = Math.max(1, minZ - 1);
  }
};

// 对齐控制
const alignSelected = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
  closeContextMenu();
  const comps = editorComponents.value.filter(c => selectedCompIds.value.includes(c.id));
  if (comps.length < 2) return;
  recordHistory();

  const minX = Math.min(...comps.map(c => c.x));
  const maxX = Math.max(...comps.map(c => c.x + c.width));
  const minY = Math.min(...comps.map(c => c.y));
  const maxY = Math.max(...comps.map(c => c.y + c.height));
  const centerX = minX + (maxX - minX) / 2;
  const centerY = minY + (maxY - minY) / 2;

  comps.forEach(c => {
    if (type === 'left') c.x = minX;
    if (type === 'center') c.x = Math.round(centerX - c.width / 2);
    if (type === 'right') c.x = maxX - c.width;
    if (type === 'top') c.y = minY;
    if (type === 'middle') c.y = Math.round(centerY - c.height / 2);
    if (type === 'bottom') c.y = maxY - c.height;
  });
};

// ==========================================
// 7. 文本样式与内容实时双向响应处理
// ==========================================
const updateTextContent = (text: string) => {
  if (!primarySelectedComponent.value) return;
  const c = primarySelectedComponent.value;
  c.name = text;
  if (!c.style) c.style = {};
  c.style.text = text;
  if (!c.customProps) c.customProps = {};
  c.customProps.text = text;
};

const updateTextColor = (color: string) => {
  if (!primarySelectedComponent.value) return;
  const c = primarySelectedComponent.value;
  if (!c.style) c.style = {};
  c.style.textColor = color;
  c.style.stroke = color;
  c.style.color = color;
};

// ==========================================
// 8. 多状态管理 (分合闸多态)
// ==========================================
const syncCurrentComponentsToState = () => {
  const curState = editorStates.value.find(s => s.id === activeStateId.value);
  if (curState) {
    curState.children = JSON.parse(JSON.stringify(editorComponents.value));
  }
};

const switchState = (stateId: string) => {
  if (stateId === activeStateId.value) return;
  syncCurrentComponentsToState();
  activeStateId.value = stateId;

  const targetState = editorStates.value.find(s => s.id === stateId);
  if (targetState) {
    editorComponents.value = JSON.parse(JSON.stringify(targetState.children || []));
  } else {
    editorComponents.value = [];
  }
  selectedCompIds.value = [];
  undoStack.value = [];
  redoStack.value = [];
};

const addNewState = () => {
  syncCurrentComponentsToState();
  const existingNums = editorStates.value
    .map(s => parseInt(s.id, 10))
    .filter(n => !isNaN(n));
  const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
  const newId = String(nextNum);

  // 自动克隆当前状态组件，方便微调
  const cloned = JSON.parse(JSON.stringify(editorComponents.value));
  const newState: CustomSymbolStateDef = {
    id: newId,
    name: `状态 ${newId}`,
    matchValue: newId,
    stateValue: nextNum,
    children: cloned
  };
  editorStates.value.push(newState);
  switchState(newId);
};

const deleteCurrentState = () => {
  if (editorStates.value.length <= 1) return;
  const idx = editorStates.value.findIndex(s => s.id === activeStateId.value);
  if (idx !== -1) {
    editorStates.value.splice(idx, 1);
    const next = editorStates.value[Math.max(0, idx - 1)] || editorStates.value[0];
    activeStateId.value = next.id;
    editorComponents.value = JSON.parse(JSON.stringify(next.children || []));
    selectedCompIds.value = [];
  }
};

// ==========================================
// 9. 保存图元 (智能重命名修复：删除原图元文件，绝不生成冗余副本)
// ==========================================
const saveNotice = ref('');
let noticeTimer: any = null;
const showNotice = (msg: string) => {
  saveNotice.value = msg;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    saveNotice.value = '';
  }, 2200);
};

const handleSaveSymbol = async () => {
  if (!editingSymbol.value) return;
  syncCurrentComponentsToState();

  const newName = editingSymbol.value.name.trim();
  if (!newName) {
    showNotice('保存失败: 图元名称不能为空');
    return;
  }

  const rawSymbol: CustomSymbolDef = {
    ...editingSymbol.value,
    name: newName,
    states: editorStates.value,
    children: editorStates.value[0]?.children || editorComponents.value,
    updatedAt: new Date().toISOString()
  };

  // 0 边距紧致对齐
  const normalized = normalizeSymbolZeroMargin(rawSymbol);

  // 核心重命名处理：如果名称变更，清除旧名称文件与内存数据
  await saveCustomSymbolWithRename(normalized, originalSymbolName.value);
  originalSymbolName.value = newName;
  editingSymbol.value = normalized;

  showNotice('图元保存成功');
  await loadSymbols();
};

// ==========================================
// 10. 资产库模式操作 (新建 / 编辑 / 复制 / 删除 / 使用)
// ==========================================
const handleCreateNewSymbol = () => {
  const newSym: CustomSymbolDef = {
    id: `cell-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: `新图元_${symbols.value.length + 1}`,
    category: 'electrical',
    iconName: 'Zap',
    description: '',
    defaultWidth: 100,
    defaultHeight: 100,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2,
      borderRadius: 2
    },
    states: [
      {
        id: '1',
        name: '状态 1',
        matchValue: '1',
        stateValue: 1,
        children: []
      }
    ],
    children: [],
    activeStateId: '1'
  };

  editingSymbol.value = newSym;
  originalSymbolName.value = ''; // 新建无旧名称
  editorStates.value = JSON.parse(JSON.stringify(newSym.states || []));
  activeStateId.value = '1';
  editorComponents.value = [];
  selectedCompIds.value = [];
  zoom.value = 1;
  currentView.value = 'editor';
};

const handleEditSymbol = (sym: CustomSymbolDef) => {
  editingSymbol.value = JSON.parse(JSON.stringify(sym));
  originalSymbolName.value = sym.name; // 锁定原始名称
  editorStates.value = JSON.parse(JSON.stringify(sym.states && sym.states.length > 0 ? sym.states : [
    { id: '1', name: '状态 1', matchValue: '1', stateValue: 1, children: sym.children || [] }
  ]));
  activeStateId.value = editorStates.value[0].id;
  editorComponents.value = JSON.parse(JSON.stringify(editorStates.value[0].children || []));
  selectedCompIds.value = [];
  zoom.value = 1;
  currentView.value = 'editor';
};

const handleCloneSymbol = async (sym: CustomSymbolDef) => {
  const cloned: CustomSymbolDef = {
    ...JSON.parse(JSON.stringify(sym)),
    id: `cell-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: `${sym.name}_副本`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  addCustomSymbol(cloned);
  await saveCellToDisk(cloned).catch(() => {});
  await loadSymbols();
  showNotice(`已复制: ${cloned.name}`);
};

const handleUseSymbol = (sym: CustomSymbolDef) => {
  emit('use:symbol', sym);
  emit('close');
};

const handleBackToGallery = () => {
  currentView.value = 'gallery';
  selectedCompIds.value = [];
  closeContextMenu();
};

// 快捷键监听 (Ctrl+C, Ctrl+V, Delete, Ctrl+Z, 方向键)
const handleKeyDown = (e: KeyboardEvent) => {
  if (currentView.value !== 'editor') return;
  if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
    return;
  }

  // Delete
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    handleDeleteSelected();
  }
  // Ctrl+C
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    e.preventDefault();
    handleCopy();
  }
  // Ctrl+V
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    e.preventDefault();
    handlePaste();
  }
  // Ctrl+X
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
    e.preventDefault();
    handleCut();
  }
  // Ctrl+D
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    handleDuplicate();
  }
  // Ctrl+Z / Ctrl+Y
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) handleRedo();
    else handleUndo();
  }
  // Ctrl+A (全选)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    selectedCompIds.value = editorComponents.value.map(c => c.id);
  }
  // 方向键微调
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    if (selectedCompIds.value.length === 0) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const comps = editorComponents.value.filter(c => selectedCompIds.value.includes(c.id));
    comps.forEach(c => {
      if (e.key === 'ArrowLeft') c.x = Math.max(0, c.x - step);
      if (e.key === 'ArrowRight') c.x = c.x + step;
      if (e.key === 'ArrowUp') c.y = Math.max(0, c.y - step);
      if (e.key === 'ArrowDown') c.y = c.y + step;
    });
  }
};

watch(() => props.visible, (val) => {
  if (val) {
    loadSymbols();
    currentView.value = 'gallery';
    if (props.initialSymbol) {
      handleEditSymbol(props.initialSymbol);
    }
  }
}, { immediate: true });

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-2 z-[9999] bg-[#080f1e] text-slate-100 rounded-xl border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden select-none font-sans"
      @click="closeContextMenu"
    >
      <!-- ============================================================ -->
      <!-- A. 顶栏：自适应资产库 vs 专业工作台编辑器                     -->
      <!-- ============================================================ -->
      <header class="h-12 px-4 bg-[#0d1627] border-b border-slate-800 flex items-center justify-between shrink-0">
        <!-- 资产库模式顶栏 -->
        <template v-if="currentView === 'gallery'">
          <div class="flex items-center gap-3">
            <div class="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>
            <span class="text-base font-bold text-white tracking-wide">
              图元工坊
            </span>
            <span class="text-xs text-slate-400 font-mono">
              (共 {{ symbols.length }} 个图元)
            </span>
          </div>

          <div class="flex items-center gap-3">
            <div class="relative w-64">
              <Search class="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索图元名称..."
                class="w-full bg-[#050b14] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-hidden"
              />
            </div>

            <button
              @click="loadSymbols"
              class="p-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
              title="刷新图元列表"
            >
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
            </button>

            <button
              @click="handleCreateNewSymbol"
              class="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
            >
              <Plus class="w-4 h-4 stroke-[2.5]" />
              <span>新建图元</span>
            </button>

            <button
              @click="emit('close')"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="关闭"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </template>

        <!-- 工作台编辑器顶栏 (严格对齐主编辑界面风格) -->
        <template v-else>
          <div class="flex items-center gap-3">
            <button
              @click="handleBackToGallery"
              class="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowLeft class="w-3.5 h-3.5" />
              <span>返回图元库</span>
            </button>

            <div class="h-4 w-[1px] bg-slate-700"></div>

            <!-- 图元名称重命名输入 -->
            <div class="flex items-center gap-2" v-if="editingSymbol">
              <input
                v-model="editingSymbol.name"
                type="text"
                class="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-cyan-400 text-sm font-bold text-white px-1.5 py-0.5 focus:outline-hidden transition-colors w-44"
                placeholder="图元名称"
                title="修改图元名称"
              />
              <span class="text-xs text-slate-400 font-mono">
                {{ computedSymbolBounds.width }} × {{ computedSymbolBounds.height }} px
              </span>
            </div>
          </div>

          <!-- 分合闸多态管理切换器 -->
          <div class="flex items-center gap-1 bg-[#050b14] border border-slate-800 rounded-lg p-0.5">
            <button
              v-for="st in editorStates"
              :key="st.id"
              @click="switchState(st.id)"
              class="px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer"
              :class="activeStateId === st.id 
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'"
            >
              状态 {{ st.id }}
            </button>
            <button
              @click="addNewState"
              class="px-2 py-1 rounded text-xs text-slate-400 hover:text-cyan-300 hover:bg-slate-800 cursor-pointer flex items-center gap-1"
              title="添加新状态 (自动复制当前状态组件)"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>
            <button
              v-if="editorStates.length > 1"
              @click="deleteCurrentState"
              class="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
              title="删除当前状态"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- 右侧操作区：缩放、网格、对齐与保存 -->
          <div class="flex items-center gap-2">
            <!-- 缩放控制 -->
            <div class="flex items-center gap-1 border border-slate-700 rounded-lg px-2 py-1 bg-[#050b14] text-xs font-mono">
              <button @click="zoom = Math.max(0.5, zoom - 0.1)" class="hover:text-cyan-400 cursor-pointer">-</button>
              <span class="w-10 text-center">{{ Math.round(zoom * 100) }}%</span>
              <button @click="zoom = Math.min(2.5, zoom + 0.1)" class="hover:text-cyan-400 cursor-pointer">+</button>
            </div>

            <!-- 网格开关 -->
            <button
              @click="showGrid = !showGrid"
              class="p-1.5 rounded-lg border border-slate-700 cursor-pointer transition-colors"
              :class="showGrid ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'text-slate-400 hover:bg-slate-800'"
              title="网格显示与对齐"
            >
              <Grid class="w-4 h-4" />
            </button>

            <!-- 保存图元 -->
            <button
              @click="handleSaveSymbol"
              class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
            >
              <Check class="w-4 h-4 stroke-[2.5]" />
              <span>保存图元</span>
            </button>

            <button
              @click="emit('close')"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
              title="关闭"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </template>
      </header>

      <!-- ============================================================ -->
      <!-- B. 内容主体区域                                               -->
      <!-- ============================================================ -->
      <div class="flex-1 flex overflow-hidden">
        <!-- ==================== 1. 资产库展示网格 (Gallery) ==================== -->
        <template v-if="currentView === 'gallery'">
          <div class="flex-1 p-6 overflow-y-auto">
            <div v-if="filteredSymbols.length === 0" class="h-full flex flex-col items-center justify-center text-slate-500">
              <Zap class="w-12 h-12 stroke-[1.5] text-slate-600 mb-3" />
              <div class="text-sm font-medium">未找到匹配的图元</div>
              <button
                @click="handleCreateNewSymbol"
                class="mt-4 px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus class="w-4 h-4" />
                <span>立即新建图元</span>
              </button>
            </div>

            <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              <div
                v-for="sym in filteredSymbols"
                :key="sym.id"
                class="bg-[#0b1424] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-3 flex flex-col justify-between transition-all group"
              >
                <!-- 卡片顶部缩略图预览 -->
                <div class="w-full h-32 bg-[#040811] rounded-lg border border-slate-800/80 flex items-center justify-center overflow-hidden relative mb-2.5">
                  <div
                    class="relative"
                    :style="{
                      width: `${sym.defaultWidth || 80}px`,
                      height: `${sym.defaultHeight || 80}px`,
                      transform: `scale(${Math.min(1, 100 / Math.max(sym.defaultWidth || 80, sym.defaultHeight || 80))})`,
                      transformOrigin: 'center center'
                    }"
                  >
                    <div
                      v-for="(child, idx) in (sym.states?.[0]?.children || sym.children || [])"
                      :key="idx"
                      class="absolute pointer-events-none select-none"
                      :style="{
                        left: `${child.x}px`,
                        top: `${child.y}px`,
                        width: `${child.width}px`,
                        height: `${child.height}px`,
                        zIndex: child.zIndex || 1
                      }"
                    >
                      <WidgetRenderer :component="child" />
                    </div>
                  </div>

                  <span class="absolute bottom-1 right-1.5 text-[10px] font-mono text-slate-500 bg-slate-900/80 px-1 rounded">
                    {{ sym.defaultWidth }}×{{ sym.defaultHeight }}
                  </span>
                </div>

                <!-- 图元信息 -->
                <div class="mb-2">
                  <div class="text-sm font-bold text-white truncate" :title="sym.name">
                    {{ sym.name }}
                  </div>
                  <div class="text-[11px] text-slate-400 font-mono mt-0.5">
                    {{ sym.states?.length || 1 }} 个状态
                  </div>
                </div>

                <!-- 底部操作按钮 -->
                <div class="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
                  <button
                    @click="handleUseSymbol(sym)"
                    class="flex-1 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    title="在当前组态画面中使用此图元"
                  >
                    <span>使用</span>
                  </button>
                  <button
                    @click="handleEditSymbol(sym)"
                    class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
                    title="编辑图元结构与状态"
                  >
                    <Edit3 class="w-3.5 h-3.5" />
                  </button>
                  <button
                    @click="handleCloneSymbol(sym)"
                    class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
                    title="复制图元"
                  >
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                  <button
                    @click="openDeleteConfirm(sym)"
                    class="p-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400 cursor-pointer transition-colors"
                    title="删除图元"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ==================== 2. 专业图元工作台编辑器 (Editor) ==================== -->
        <template v-else>
          <!-- 左侧物料库 (具备常用基础、电力一次、控制测量三分类，丰富完备) -->
          <div class="w-60 bg-[#0a1220] border-r border-slate-800 flex flex-col shrink-0">
            <!-- 分类切换标签栏 -->
            <div class="grid grid-cols-3 border-b border-slate-800 text-[11px] font-bold bg-[#070d17]">
              <button
                @click="activePaletteTab = 'electrical'"
                class="py-2 text-center transition-colors cursor-pointer border-b-2"
                :class="activePaletteTab === 'electrical' ? 'border-cyan-400 text-cyan-300 bg-[#0a1220]' : 'border-transparent text-slate-400 hover:text-slate-200'"
              >
                电力一次
              </button>
              <button
                @click="activePaletteTab = 'basic'"
                class="py-2 text-center transition-colors cursor-pointer border-b-2"
                :class="activePaletteTab === 'basic' ? 'border-cyan-400 text-cyan-300 bg-[#0a1220]' : 'border-transparent text-slate-400 hover:text-slate-200'"
              >
                基础形状
              </button>
              <button
                @click="activePaletteTab = 'control'"
                class="py-2 text-center transition-colors cursor-pointer border-b-2"
                :class="activePaletteTab === 'control' ? 'border-cyan-400 text-cyan-300 bg-[#0a1220]' : 'border-transparent text-slate-400 hover:text-slate-200'"
              >
                指示控制
              </button>
            </div>

            <!-- 物料列表 -->
            <div class="flex-1 p-2 overflow-y-auto space-y-1.5">
              <button
                v-for="part in PALETTE_CATEGORIES[activePaletteTab].parts"
                :key="part.name"
                @click="addPartToCanvas(part)"
                class="w-full px-2.5 py-2 rounded-lg bg-[#0e192c] hover:bg-[#162542] border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white flex items-center gap-2.5 cursor-pointer transition-colors text-left"
              >
                <div class="w-6 h-6 rounded bg-slate-900 flex items-center justify-center shrink-0 text-cyan-400">
                  <component :is="part.icon" class="w-3.5 h-3.5" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium truncate">{{ part.name }}</div>
                  <div class="text-[10px] text-slate-500 font-mono">{{ part.defaultW }}×{{ part.defaultH }}</div>
                </div>
              </button>
            </div>
          </div>

          <!-- 中间主编辑画布区 (支持框选、右键菜单、多组件同时平移与吸附) -->
          <div 
            ref="canvasContainerRef"
            @mousedown="onCanvasMouseDown"
            @contextmenu.prevent="handleCanvasContextMenu"
            class="flex-1 bg-[#060c18] relative overflow-hidden flex items-center justify-center cursor-default select-none"
          >
            <!-- 背景点状工业网格 -->
            <div
              v-if="showGrid"
              class="absolute inset-0 pointer-events-none opacity-25"
              style="background-size: 20px 20px; background-image: radial-gradient(circle, #38bdf8 1px, transparent 1px);"
            ></div>

            <!-- 画布主视口 -->
            <div
              class="relative border border-slate-700/80 bg-[#091122]/90 rounded-lg shadow-2xl transition-all"
              :style="{
                width: `${computedSymbolBounds.width + 120}px`,
                height: `${computedSymbolBounds.height + 120}px`,
                transform: `scale(${zoom})`,
                transformOrigin: 'center center'
              }"
            >
              <!-- 零刻度原点辅助虚线框 -->
              <div class="absolute inset-14 border border-dashed border-cyan-500/25 pointer-events-none rounded"></div>

              <!-- 渲染子组件 -->
              <div
                v-for="comp in editorComponents"
                :key="comp.id"
                @mousedown="onComponentMouseDown(comp, $event)"
                @contextmenu.stop.prevent="handleComponentContextMenu(comp, $event)"
                class="absolute cursor-move select-none"
                :style="{
                  left: `${comp.x + 56}px`,
                  top: `${comp.y + 56}px`,
                  width: `${comp.width}px`,
                  height: `${comp.height}px`,
                  zIndex: comp.zIndex || 1
                }"
              >
                <!-- 元件本体渲染 -->
                <WidgetRenderer :component="comp" />

                <!-- 选中态边框与控制手柄 -->
                <template v-if="selectedCompIds.includes(comp.id)">
                  <div class="absolute inset-0 border-2 border-cyan-400 pointer-events-none rounded-xs shadow-[0_0_8px_rgba(0,242,255,0.4)]"></div>
                  
                  <!-- 单选时展示 8 个尺寸缩放手柄 -->
                  <template v-if="selectedCompIds.length === 1">
                    <div
                      @mousedown="onResizeHandleMouseDown('nw', $event)"
                      class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-cyan-500 rounded-full cursor-nwse-resize z-30"
                    ></div>
                    <div
                      @mousedown="onResizeHandleMouseDown('ne', $event)"
                      class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-cyan-500 rounded-full cursor-nesw-resize z-30"
                    ></div>
                    <div
                      @mousedown="onResizeHandleMouseDown('se', $event)"
                      class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-cyan-500 rounded-full cursor-nwse-resize z-30"
                    ></div>
                    <div
                      @mousedown="onResizeHandleMouseDown('sw', $event)"
                      class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-cyan-500 rounded-full cursor-nesw-resize z-30"
                    ></div>

                    <div
                      @mousedown="onResizeHandleMouseDown('n', $event)"
                      class="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2 bg-white border border-cyan-500 rounded-xs cursor-ns-resize z-30"
                    ></div>
                    <div
                      @mousedown="onResizeHandleMouseDown('s', $event)"
                      class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2 bg-white border border-cyan-500 rounded-xs cursor-ns-resize z-30"
                    ></div>
                    <div
                      @mousedown="onResizeHandleMouseDown('w', $event)"
                      class="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2.5 bg-white border border-cyan-500 rounded-xs cursor-ew-resize z-30"
                    ></div>
                    <div
                      @mousedown="onResizeHandleMouseDown('e', $event)"
                      class="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2.5 bg-white border border-cyan-500 rounded-xs cursor-ew-resize z-30"
                    ></div>
                  </template>
                </template>
              </div>
            </div>

            <!-- 框选蓝色虚线半透明矩形 -->
            <div
              v-if="isMarqueeSelecting"
              class="absolute border border-cyan-400 bg-cyan-500/15 pointer-events-none rounded-xs z-50"
              :style="{
                left: `${marqueeBox.x * zoom}px`,
                top: `${marqueeBox.y * zoom}px`,
                width: `${marqueeBox.width * zoom}px`,
                height: `${marqueeBox.height * zoom}px`
              }"
            ></div>

            <!-- 顶部对齐工具栏 -->
            <div class="absolute top-3 left-1/2 -translate-x-1/2 bg-[#0c1626]/95 border border-slate-700/80 rounded-lg px-2 py-1 flex items-center gap-1 shadow-lg text-slate-300 z-40">
              <button @click="alignSelected('left')" class="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded cursor-pointer" title="左对齐"><AlignLeft class="w-3.5 h-3.5" /></button>
              <button @click="alignSelected('center')" class="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded cursor-pointer" title="水平居中"><AlignCenter class="w-3.5 h-3.5" /></button>
              <button @click="alignSelected('right')" class="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded cursor-pointer" title="右对齐"><AlignRight class="w-3.5 h-3.5" /></button>
              <div class="h-3 w-[1px] bg-slate-700 mx-0.5"></div>
              <button @click="bringToFront" class="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded cursor-pointer text-xs" title="置于顶层">上移</button>
              <button @click="sendToBack" class="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded cursor-pointer text-xs" title="置于底层">下移</button>
              <div class="h-3 w-[1px] bg-slate-700 mx-0.5"></div>
              <button 
                :disabled="selectedCompIds.length === 0"
                @click="handleDeleteSelected" 
                class="p-1 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer disabled:opacity-30" 
                title="删除选中元件 (Delete)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- 右侧属性参数检查器 (支持文本颜色/字号/内容、线宽/描边/背景、几何尺寸) -->
          <div class="w-64 bg-[#0a1220] border-l border-slate-800 flex flex-col shrink-0 text-xs">
            <div class="px-3.5 py-2.5 border-b border-slate-800 text-xs font-bold text-slate-400 flex items-center justify-between">
              <span>属性配置</span>
              <span v-if="selectedCompIds.length > 1" class="text-cyan-400 font-mono">已选 {{ selectedCompIds.length }} 个元件</span>
              <span v-else-if="primarySelectedComponent" class="text-cyan-400 font-mono truncate max-w-[120px]">{{ primarySelectedComponent.name }}</span>
              <span v-else class="text-slate-500">图元全局</span>
            </div>

            <!-- 多选批量操作面板 -->
            <div v-if="selectedCompIds.length > 1" class="flex-1 p-3.5 space-y-4">
              <div class="p-2.5 rounded bg-[#0e192c] border border-slate-800 text-slate-300 space-y-2">
                <div class="text-[11px] font-bold text-cyan-300">多选对齐与分布</div>
                <div class="grid grid-cols-3 gap-1.5 pt-1">
                  <button @click="alignSelected('left')" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-center">左对齐</button>
                  <button @click="alignSelected('center')" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-center">水平居中</button>
                  <button @click="alignSelected('right')" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-center">右对齐</button>
                  <button @click="alignSelected('top')" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-center">顶端对齐</button>
                  <button @click="alignSelected('middle')" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-center">垂直居中</button>
                  <button @click="alignSelected('bottom')" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-center">底端对齐</button>
                </div>
              </div>

              <button
                @click="handleDeleteSelected"
                class="w-full py-1.5 rounded bg-rose-950/40 hover:bg-rose-900 border border-rose-800/80 text-rose-300 font-semibold cursor-pointer transition-colors"
              >
                批量删除已选元件
              </button>
            </div>

            <!-- 单选组件属性调节面板 -->
            <div v-else-if="primarySelectedComponent" class="flex-1 p-3.5 overflow-y-auto space-y-3.5">
              <!-- 文本专属字段 (全面解决文本改颜色与内容问题) -->
              <div v-if="primarySelectedComponent.type === 'draw-text'" class="space-y-2 p-2.5 rounded bg-[#0e192c] border border-cyan-500/20">
                <div class="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                  <Type class="w-3.5 h-3.5" />
                  <span>文字配置</span>
                </div>

                <div>
                  <label class="text-[10px] text-slate-400 block mb-1">文字内容</label>
                  <input
                    :value="primarySelectedComponent.style.text || primarySelectedComponent.name"
                    @input="updateTextContent(($event.target as HTMLInputElement).value)"
                    type="text"
                    class="w-full bg-[#050b14] border border-slate-700 rounded px-2 py-1 text-white focus:border-cyan-400 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label class="text-[10px] text-slate-400 block mb-1">文字颜色</label>
                  <div class="flex items-center gap-2">
                    <input
                      :value="primarySelectedComponent.style.textColor || primarySelectedComponent.style.stroke || '#ffffff'"
                      @input="updateTextColor(($event.target as HTMLInputElement).value)"
                      type="color"
                      class="w-7 h-7 bg-transparent border-0 rounded cursor-pointer"
                    />
                    <input
                      :value="primarySelectedComponent.style.textColor || primarySelectedComponent.style.stroke || '#ffffff'"
                      @input="updateTextColor(($event.target as HTMLInputElement).value)"
                      type="text"
                      class="flex-1 bg-[#050b14] border border-slate-700 rounded px-2 py-1 text-white font-mono uppercase focus:border-cyan-400 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] text-slate-400 block mb-1">字号 (px)</label>
                    <input
                      v-model.number="primarySelectedComponent.style.fontSize"
                      type="number"
                      min="10"
                      max="48"
                      class="w-full bg-[#050b14] border border-slate-700 rounded px-2 py-1 text-white font-mono focus:border-cyan-400 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] text-slate-400 block mb-1">字重粗细</label>
                    <select
                      v-model="primarySelectedComponent.style.fontWeight"
                      class="w-full bg-[#050b14] border border-slate-700 rounded px-2 py-1 text-white focus:border-cyan-400 focus:outline-hidden cursor-pointer"
                    >
                      <option value="normal">常规</option>
                      <option value="bold">粗体</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- 位置与尺寸 -->
              <div class="space-y-2">
                <div class="text-[11px] font-bold text-slate-400">几何位置与尺寸</div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] text-slate-500">X (水平坐标)</label>
                    <input
                      v-model.number="primarySelectedComponent.x"
                      type="number"
                      class="w-full bg-[#050b14] border border-slate-700 rounded px-2 py-1 text-white font-mono focus:border-cyan-400 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] text-slate-500">Y (垂直坐标)</label>
                    <input
                      v-model.number="primarySelectedComponent.y"
                      type="number"
                      class="w-full bg-[#050b14] border border-slate-700 rounded px-2 py-1 text-white font-mono focus:border-cyan-400 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] text-slate-500">宽 (Width)</label>
                    <input
                      v-model.number="primarySelectedComponent.width"
                      type="number"
                      class="w-full bg-[#050b14] border border-slate-700 rounded px-2 py-1 text-white font-mono focus:border-cyan-400 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] text-slate-500">高 (Height)</label>
                    <input
                      v-model.number="primarySelectedComponent.height"
                      type="number"
                      class="w-full bg-[#050b14] border border-slate-700 rounded px-2 py-1 text-white font-mono focus:border-cyan-400 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <!-- 颜色与描边样式 (图形类) -->
              <div class="space-y-2 pt-2 border-t border-slate-800">
                <div class="text-[11px] font-bold text-slate-400">描边与填充</div>
                
                <div>
                  <label class="text-[10px] text-slate-500 block mb-1">线条描边颜色</label>
                  <div class="flex items-center gap-2">
                    <input
                      v-model="primarySelectedComponent.style.stroke"
                      type="color"
                      class="w-7 h-7 bg-transparent border-0 rounded cursor-pointer"
                    />
                    <input
                      v-model="primarySelectedComponent.style.stroke"
                      type="text"
                      class="flex-1 bg-[#050b14] border border-slate-700 rounded px-2 py-1 text-white font-mono uppercase focus:border-cyan-400 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label class="text-[10px] text-slate-500 block mb-1">背景填充颜色</label>
                  <div class="flex items-center gap-2">
                    <input
                      :value="primarySelectedComponent.style.fill === 'transparent' ? '#000000' : primarySelectedComponent.style.fill"
                      @input="primarySelectedComponent.style.fill = ($event.target as HTMLInputElement).value"
                      type="color"
                      class="w-7 h-7 bg-transparent border-0 rounded cursor-pointer"
                    />
                    <input
                      v-model="primarySelectedComponent.style.fill"
                      type="text"
                      class="flex-1 bg-[#050b14] border border-slate-700 rounded px-2 py-1 text-white font-mono uppercase focus:border-cyan-400 focus:outline-hidden"
                    />
                    <button
                      @click="primarySelectedComponent.style.fill = 'transparent'"
                      class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] rounded text-slate-300"
                    >
                      透明
                    </button>
                  </div>
                </div>

                <div>
                  <label class="text-[10px] text-slate-500 block mb-1">线宽 (粗细)</label>
                  <input
                    v-model.number="primarySelectedComponent.style.strokeWidth"
                    type="number"
                    min="1"
                    max="12"
                    class="w-full bg-[#050b14] border border-slate-700 rounded px-2 py-1 text-white font-mono focus:border-cyan-400 focus:outline-hidden"
                  />
                </div>
              </div>

              <!-- 操作 -->
              <div class="pt-3 border-t border-slate-800">
                <button
                  @click="handleDeleteSelected"
                  class="w-full py-1.5 rounded bg-rose-950/40 hover:bg-rose-900 border border-rose-800/80 text-rose-300 font-semibold cursor-pointer transition-colors"
                >
                  删除此元件
                </button>
              </div>
            </div>

            <!-- 未选中组件时的全局信息 -->
            <div v-else class="flex-1 p-3.5 space-y-3.5 text-slate-400">
              <div class="space-y-2">
                <div class="text-[11px] font-bold text-slate-300">图元概况</div>
                <div class="p-2.5 rounded-lg bg-[#050b14] border border-slate-800 space-y-1.5 font-mono text-[11px]">
                  <div class="flex justify-between">
                    <span class="text-slate-500">当前编辑状态:</span>
                    <span class="text-cyan-300">状态 {{ activeStateId }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">状态数量:</span>
                    <span class="text-white">{{ editorStates.length }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">当前状态元件数:</span>
                    <span class="text-white">{{ editorComponents.length }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">紧致尺寸:</span>
                    <span class="text-white">{{ computedSymbolBounds.width }} × {{ computedSymbolBounds.height }}</span>
                  </div>
                </div>
              </div>

              <div class="text-[11px] text-slate-500 leading-relaxed space-y-1">
                <div>• 点击左侧零件添加至画布</div>
                <div>• 画布空白处拖拽可拉框多选</div>
                <div>• 支持右键菜单 (复制/剪切/粘贴/对齐)</div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- ============================================================ -->
      <!-- C. 右键上下文菜单 (Context Menu)                             -->
      <!-- ============================================================ -->
      <div
        v-if="contextMenu.visible"
        class="fixed z-[10000] w-48 bg-[#0d1627] border border-slate-700/80 rounded-lg shadow-2xl py-1 text-xs text-slate-200 select-none divide-y divide-slate-800"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        @click.stop
      >
        <!-- 剪贴板动作 -->
        <div class="py-1">
          <button
            :disabled="selectedCompIds.length === 0"
            @click="handleCopy"
            class="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white flex items-center justify-between cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            <span class="flex items-center gap-2"><Copy class="w-3.5 h-3.5" /> 复制</span>
            <span class="text-[10px] text-slate-500 font-mono">Ctrl+C</span>
          </button>
          <button
            :disabled="selectedCompIds.length === 0"
            @click="handleCut"
            class="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white flex items-center justify-between cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            <span class="flex items-center gap-2"><Scissors class="w-3.5 h-3.5" /> 剪切</span>
            <span class="text-[10px] text-slate-500 font-mono">Ctrl+X</span>
          </button>
          <button
            :disabled="clipboardComponents.length === 0"
            @click="handlePaste"
            class="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white flex items-center justify-between cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            <span class="flex items-center gap-2"><Clipboard class="w-3.5 h-3.5" /> 粘贴</span>
            <span class="text-[10px] text-slate-500 font-mono">Ctrl+V</span>
          </button>
          <button
            :disabled="selectedCompIds.length === 0"
            @click="handleDuplicate"
            class="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white flex items-center justify-between cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            <span class="flex items-center gap-2"><Copy class="w-3.5 h-3.5" /> 复制副本</span>
            <span class="text-[10px] text-slate-500 font-mono">Ctrl+D</span>
          </button>
        </div>

        <!-- 层级控制 -->
        <div class="py-1" v-if="selectedCompIds.length > 0">
          <button
            @click="bringToFront"
            class="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <ArrowUpToLine class="w-3.5 h-3.5" /> 置于顶层
          </button>
          <button
            @click="sendToBack"
            class="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <ArrowDownToLine class="w-3.5 h-3.5" /> 置于底层
          </button>
        </div>

        <!-- 对齐动作 (多选有效) -->
        <div class="py-1" v-if="selectedCompIds.length >= 2">
          <button @click="alignSelected('left')" class="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer">
            <AlignLeft class="w-3.5 h-3.5" /> 左对齐
          </button>
          <button @click="alignSelected('center')" class="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer">
            <AlignCenter class="w-3.5 h-3.5" /> 水平居中
          </button>
          <button @click="alignSelected('right')" class="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer">
            <AlignRight class="w-3.5 h-3.5" /> 右对齐
          </button>
          <button @click="alignSelected('top')" class="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer">
            <AlignVerticalJustifyStart class="w-3.5 h-3.5" /> 顶端对齐
          </button>
          <button @click="alignSelected('middle')" class="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer">
            <AlignVerticalJustifyCenter class="w-3.5 h-3.5" /> 垂直居中
          </button>
          <button @click="alignSelected('bottom')" class="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer">
            <AlignVerticalJustifyEnd class="w-3.5 h-3.5" /> 底端对齐
          </button>
        </div>

        <!-- 删除 -->
        <div class="py-1" v-if="selectedCompIds.length > 0">
          <button
            @click="handleDeleteSelected"
            class="w-full px-3 py-1.5 text-left text-rose-400 hover:bg-rose-950 hover:text-rose-300 flex items-center justify-between cursor-pointer"
          >
            <span class="flex items-center gap-2"><Trash2 class="w-3.5 h-3.5" /> 删除</span>
            <span class="text-[10px] text-slate-500 font-mono">Del</span>
          </button>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- D. 安全删除确认模态框 (解决 iframe sandbox 下 confirm 被阻拦)  -->
      <!-- ============================================================ -->
      <div
        v-if="deleteConfirmModal.visible"
        class="fixed inset-0 z-[10001] bg-black/70 flex items-center justify-center p-4"
        @click.self="deleteConfirmModal.visible = false"
      >
        <div class="bg-[#0e172a] border border-rose-500/40 rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4">
          <div class="flex items-center gap-2.5 text-rose-400 font-bold text-sm">
            <AlertCircle class="w-5 h-5" />
            <span>确认删除图元</span>
          </div>

          <p class="text-xs text-slate-300 leading-relaxed">
            确定要从项目中删除图元 <strong class="text-white underline">「{{ deleteConfirmModal.symbol?.name }}」</strong> 及其磁盘 JSON 文件吗？此操作不可逆。
          </p>

          <div class="flex items-center justify-end gap-2.5 pt-2">
            <button
              @click="deleteConfirmModal.visible = false"
              class="px-4 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs cursor-pointer"
            >
              取消
            </button>
            <button
              @click="confirmDeleteSymbol"
              class="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-md"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>

      <!-- 全局浮动操作反馈提示 -->
      <div
        v-if="saveNotice"
        class="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-[#0d1627] border border-cyan-500/60 text-cyan-300 font-bold text-xs shadow-2xl flex items-center gap-2 z-50 animate-fade-in"
      >
        <Check class="w-4 h-4 text-cyan-400" />
        <span>{{ saveNotice }}</span>
      </div>
    </div>
  </Teleport>
</template>
