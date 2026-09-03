<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  Box, Plus, Trash2, Edit3, Copy, Download, Upload, X, Search,
  Check, ChevronDown, Layers, Move, ZoomIn, ZoomOut, Maximize2, Grid, Magnet,
  ArrowRight, ShieldCheck, Zap, Cpu, BookmarkPlus, Sliders, Type, Circle,
  Square, Minus, MousePointer, RotateCw, AlignLeft, AlignCenter, AlignRight,
  MoveRight, RefreshCw, AlertCircle, Eye, HelpCircle, Triangle, Hexagon, Star,
  Diamond, Heart, MessageSquare, Disc, ArrowLeftRight, CornerDownRight,
  Sparkles, Activity, ToggleRight, Database, CircleDot, ZapOff,
  PieChart, Workflow, Scissors, Clipboard, Undo, Redo, RotateCcw,
  ArrowUp, ArrowDown, CheckSquare, CornerUpLeft, CornerUpRight
} from 'lucide-vue-next';
import { CustomSymbolDef, ScreenComponent, SymbolState, ComponentType, ComponentCategory } from '../types';
import {
  getCustomSymbols,
  saveCustomSymbols,
  addCustomSymbol,
  updateCustomSymbol,
  deleteCustomSymbol,
  exportSymbolsAsJSON,
  importSymbolsFromJSON
} from '../utils/customSymbolStorage';
import { COMPONENT_DEFINITIONS, ComponentDefinition } from '../data/componentLibrary';
import { generateUniqueDuplicateName } from '../utils/scadaResolver';
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

// Workshop Mode: 'gallery' (资产库) | 'editor' (无限画布设计器)
const currentMode = ref<'gallery' | 'editor'>('gallery');

// 1. Gallery State
const symbols = ref<CustomSymbolDef[]>([]);
const activeCategory = ref<string>('all');
const searchQuery = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const previewActiveStates = ref<Record<string, string>>({});
const notificationMessage = ref('');
const notificationType = ref<'success' | 'error'>('success');

const showNotice = (msg: string, type: 'success' | 'error' = 'success') => {
  notificationMessage.value = msg;
  notificationType.value = type;
  setTimeout(() => {
    notificationMessage.value = '';
  }, 3200);
};

// 2. Editor State
const editingSymbolId = ref<string | null>(null);
const editorSymbolName = ref('新建自定义图元');
const editorSymbolCategory = ref<'electrical' | 'industrial' | 'custom'>('electrical');
const editorSymbolDesc = ref('');
const editorSymbolTags = ref('断路器, 电力图元');
const editorStates = ref<SymbolState[]>([]);
const activeStateId = ref<string>('0');

// Canvas transform & settings
const canvasZoom = ref(1.0);
const canvasPan = ref({ x: 120, y: 80 });
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0 });
const showEditorGrid = ref(true);
const editorGridSize = ref(20);
const snapToEditorGrid = ref(true);
const activeTool = ref<'select' | 'draw-polyline' | 'draw-arrow'>('select');

// Selection & Dragging on workshop canvas
const selectedCompIds = ref<string[]>([]);
const isDraggingComps = ref(false);
const dragStartMouse = ref({ x: 0, y: 0 });
const dragInitialPositions = ref<Record<string, { x: number; y: number }>>({});

// Clipboard & Context Menu & Undo/Redo Engine for Symbol Workshop
const symbolClipboard = ref<ScreenComponent[]>([]);
const contextMenu = ref<{
  visible: boolean;
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  targetCompId: string | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  canvasX: 0,
  canvasY: 0,
  targetCompId: null
});

const historyStack = ref<string[]>([]);
const historyIndex = ref(-1);
const isHistoryTraveling = ref(false);

// Component Resizing & Rotating on workshop canvas
const isResizingComp = ref(false);
const resizeCompHandle = ref<string | null>(null);
const resizeCompStart = ref<{
  mouseX: number;
  mouseY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
}>({
  mouseX: 0,
  mouseY: 0,
  x: 0,
  y: 0,
  width: 0,
  height: 0
});

const isRotatingComp = ref(false);
const rotateCompStart = ref<{
  mouseX: number;
  mouseY: number;
  startAngle: number;
  compAngle: number;
  cx: number;
  cy: number;
}>({
  mouseX: 0,
  mouseY: 0,
  startAngle: 0,
  compAngle: 0,
  cx: 0,
  cy: 0
});

const activeCursor = computed(() => {
  if (isRotatingComp.value) return 'grabbing';
  if (isResizingComp.value && resizeCompHandle.value) {
    const h = resizeCompHandle.value;
    if (h === 'n' || h === 's') return 'ns-resize';
    if (h === 'e' || h === 'w') return 'ew-resize';
    if (h === 'nw' || h === 'se') return 'nwse-resize';
    if (h === 'ne' || h === 'sw') return 'nesw-resize';
  }
  if (isPanning.value) return 'grabbing';
  if (activeTool.value === 'draw-polyline' || activeTool.value === 'draw-arrow') return 'crosshair';
  return 'default';
});

// Interactive Polyline Drawing Mode (consistent with CanvasEditor.vue)
const polylineDrawing = ref<{
  active: boolean;
  points: Array<{ x: number; y: number }>;
  currentX: number;
  currentY: number;
}>({
  active: false,
  points: [],
  currentX: 0,
  currentY: 0
});

// Interactive Arrow Drawing Mode (consistent with CanvasEditor.vue)
const arrowDrawing = ref<{
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}>({
  active: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0
});

// Left Sidebar Primitives Palette State
const primitiveCategory = ref<'all' | 'geometry' | 'wires' | 'controls' | 'electrical'>('all');
const primitiveSearch = ref('');

// Lucide Icon Resolver
const iconMap: Record<string, any> = {
  Square,
  Circle,
  Triangle,
  Hexagon,
  Star,
  Sparkles,
  Diamond,
  Heart,
  MessageSquare,
  Disc,
  Minus,
  CornerDownRight,
  MoveRight,
  ArrowLeftRight,
  Type,
  ToggleRight,
  CircleDot,
  Activity,
  ZapOff,
  Zap,
  Box,
  Database,
  Layers,
  Plus,
  PieChart,
  Workflow,
  Cpu
};

const getPrimitiveIcon = (iconName?: string) => {
  if (iconName && iconMap[iconName]) {
    return iconMap[iconName];
  }
  return Layers;
};

// Filtered basic primitives list for Left Sidebar (rich & matching main editor)
const allPrimitives = computed<ComponentDefinition[]>(() => {
  return COMPONENT_DEFINITIONS.filter(c => {
    return c.category === 'basic' || c.category === 'electrical' || c.category === 'control';
  });
});

const filteredPrimitives = computed(() => {
  const q = primitiveSearch.value.trim().toLowerCase();
  return allPrimitives.value.filter(p => {
    let matchCat = true;
    if (primitiveCategory.value === 'geometry') {
      matchCat = p.type.startsWith('draw-') &&
        !['draw-line', 'draw-polyline', 'draw-arrow', 'draw-double-arrow', 'draw-elbow', 'draw-text', 'draw-bubble'].includes(p.type);
    } else if (primitiveCategory.value === 'wires') {
      matchCat = ['draw-line', 'draw-polyline', 'draw-arrow', 'draw-double-arrow', 'draw-elbow'].includes(p.type);
    } else if (primitiveCategory.value === 'controls') {
      matchCat = ['draw-text', 'draw-bubble', 'ctrl-indicator', 'ctrl-button'].includes(p.type);
    } else if (primitiveCategory.value === 'electrical') {
      matchCat = p.category === 'electrical' || p.type.startsWith('elec-');
    }

    const matchText = !q ||
      p.name.toLowerCase().includes(q) ||
      p.nameEn.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q);

    return matchCat && matchText;
  });
});

// Load and normalize symbols
const loadSymbols = () => {
  symbols.value = getCustomSymbols();
};

const handleGlobalMouseUp = () => {
  if (isPanning.value || isDraggingComps.value || isResizingComp.value || isRotatingComp.value) {
    isPanning.value = false;
    isDraggingComps.value = false;
    isResizingComp.value = false;
    resizeCompHandle.value = null;
    isRotatingComp.value = false;
  }
};

onMounted(() => {
  loadSymbols();
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('mouseup', handleGlobalMouseUp);
  window.addEventListener('click', closeContextMenu);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('mouseup', handleGlobalMouseUp);
  window.removeEventListener('click', closeContextMenu);
});

watch(() => props.visible, (val) => {
  if (val) {
    loadSymbols();
    if (props.initialSymbol) {
      openEditorWithSymbol(props.initialSymbol);
    } else {
      currentMode.value = 'gallery';
    }
  }
});

// Filtered symbols in gallery
const filteredSymbols = computed(() => {
  return symbols.value.filter(s => {
    const matchCategory = activeCategory.value === 'all' || s.category === activeCategory.value;
    const matchSearch = !searchQuery.value.trim() ||
      s.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (s.tags && s.tags.some(t => t.toLowerCase().includes(searchQuery.value.toLowerCase()))) ||
      (s.description && s.description.toLowerCase().includes(searchQuery.value.toLowerCase()));
    return matchCategory && matchSearch;
  });
});

// Active state object
const activeState = computed<SymbolState | null>(() => {
  return editorStates.value.find(s => s.id === activeStateId.value) || editorStates.value[0] || null;
});

// Current active state's components
const currentEditingComponents = computed<ScreenComponent[]>({
  get() {
    return activeState.value?.children || [];
  },
  set(newChildren: ScreenComponent[]) {
    if (activeState.value) {
      activeState.value.children = newChildren;
    }
  }
});

// Single selected component for inspector
const selectedComponent = computed(() => {
  if (selectedCompIds.value.length === 0) return null;
  return currentEditingComponents.value.find(c => c.id === selectedCompIds.value[0]) || null;
});

// Real-time Bounding Box of all components on workshop canvas
const currentBoundingBox = computed(() => {
  const comps = currentEditingComponents.value;
  if (!comps || comps.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  comps.forEach(c => {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + c.height);
  });

  if (minX === Infinity) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(20, Math.round(maxX - minX)),
    height: Math.max(20, Math.round(maxY - minY))
  };
});

// Helper: Ensure all states have unique integer values
const normalizeStates = (rawStates: any[]): SymbolState[] => {
  if (!rawStates || rawStates.length === 0) {
    return [
      {
        id: 'state-0',
        name: '状态 0 (默认)',
        stateValue: 0,
        matchValue: 0,
        children: []
      }
    ];
  }

  const usedValues = new Set<number>();
  return rawStates.map((st, index) => {
    let intVal = typeof st.stateValue === 'number' ? st.stateValue : Number(st.matchValue);
    if (isNaN(intVal) || !Number.isInteger(intVal) || usedValues.has(intVal)) {
      let candidate = 0;
      while (usedValues.has(candidate)) {
        candidate++;
      }
      intVal = candidate;
    }
    usedValues.add(intVal);

    return {
      id: st.id || `state-${index}-${Date.now()}`,
      name: st.name || `状态 ${intVal}`,
      stateValue: intVal,
      matchValue: intVal,
      description: st.description || '',
      children: Array.isArray(st.children) ? JSON.parse(JSON.stringify(st.children)) : []
    };
  });
};

// Helper: Find next smallest non-negative unused unique integer
const getNextAvailableStateValue = (excludeStateId?: string): number => {
  const used = new Set<number>();
  editorStates.value.forEach(s => {
    if (s.id !== excludeStateId && typeof s.stateValue === 'number' && Number.isInteger(s.stateValue)) {
      used.add(s.stateValue);
    }
  });

  let candidate = 0;
  while (used.has(candidate)) {
    candidate++;
  }
  return candidate;
};

// Helper to open editor with a symbol
const openEditorWithSymbol = (sym: CustomSymbolDef) => {
  editingSymbolId.value = sym.id;
  editorSymbolName.value = sym.name;
  editorSymbolCategory.value = (sym.category as any) || 'electrical';
  editorSymbolDesc.value = sym.description || '';
  editorSymbolTags.value = sym.tags?.join(', ') || '电力图元';

  if (sym.states && sym.states.length > 0) {
    editorStates.value = normalizeStates(sym.states);
  } else if (sym.children && sym.children.length > 0) {
    editorStates.value = [
      {
        id: 'state-0',
        name: '工作状态',
        stateValue: 0,
        matchValue: 0,
        children: JSON.parse(JSON.stringify(sym.children))
      }
    ];
  } else {
    editorStates.value = [
      {
        id: 'state-0',
        name: '状态 0',
        stateValue: 0,
        matchValue: 0,
        children: []
      }
    ];
  }

  activeStateId.value = editorStates.value[0]?.id || 'state-0';
  selectedCompIds.value = [];
  activeTool.value = 'select';
  polylineDrawing.value.active = false;
  arrowDrawing.value.active = false;
  canvasZoom.value = 1.0;
  canvasPan.value = { x: 120, y: 80 };
  currentMode.value = 'editor';
};

// Open editor for a brand new blank symbol
const handleCreateNewBlankSymbol = () => {
  editingSymbolId.value = `custom-sym-${Date.now()}`;
  editorSymbolName.value = `自定义图元 #${symbols.value.length + 1}`;
  editorSymbolCategory.value = 'electrical';
  editorSymbolDesc.value = '由基础图元在工坊画布中自由构建组合';
  editorSymbolTags.value = '自定义, 基础图元';

  editorStates.value = [
    {
      id: `state-1-${Date.now()}`,
      name: '合闸 (带电运行)',
      stateValue: 1,
      matchValue: 1,
      children: [
        {
          id: `prim-${Date.now()}-1`,
          name: '灭弧室主体',
          type: 'draw-rect',
          category: 'basic',
          x: 40,
          y: 40,
          width: 50,
          height: 60,
          rotation: 0,
          zIndex: 1,
          style: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', strokeWidth: 2, borderRadius: 4 },
          data: { mapping: {} }
        },
        {
          id: `prim-${Date.now()}-2`,
          name: '主触头合闸线',
          type: 'draw-line',
          category: 'basic',
          x: 65,
          y: 20,
          width: 2,
          height: 100,
          rotation: 0,
          zIndex: 2,
          style: { stroke: '#ef4444', strokeWidth: 3 },
          data: { mapping: {} },
          customProps: { points: [{ xRatio: 0.5, yRatio: 0, x: 0, y: 0 }, { xRatio: 0.5, yRatio: 1, x: 0, y: 100 }] }
        }
      ]
    },
    {
      id: `state-0-${Date.now()}`,
      name: '分闸 (断开隔离)',
      stateValue: 0,
      matchValue: 0,
      children: [
        {
          id: `prim-${Date.now()}-3`,
          name: '灭弧室主体',
          type: 'draw-rect',
          category: 'basic',
          x: 40,
          y: 40,
          width: 50,
          height: 60,
          rotation: 0,
          zIndex: 1,
          style: { fill: 'rgba(16, 185, 129, 0.25)', stroke: '#10b981', strokeWidth: 2, borderRadius: 4 },
          data: { mapping: {} }
        },
        {
          id: `prim-${Date.now()}-4`,
          name: '分闸断开触刀',
          type: 'draw-polyline',
          category: 'basic',
          x: 45,
          y: 25,
          width: 40,
          height: 90,
          rotation: 0,
          zIndex: 2,
          style: { stroke: '#10b981', strokeWidth: 3 },
          data: { mapping: {} },
          customProps: {
            points: [
              { x: 20, y: 0, xRatio: 0.5, yRatio: 0 },
              { x: 5, y: 45, xRatio: 0.1, yRatio: 0.5 },
              { x: 20, y: 90, xRatio: 0.5, yRatio: 1 }
            ]
          }
        }
      ]
    }
  ];

  activeStateId.value = editorStates.value[0].id;
  selectedCompIds.value = [];
  activeTool.value = 'select';
  polylineDrawing.value.active = false;
  arrowDrawing.value.active = false;
  canvasZoom.value = 1.0;
  canvasPan.value = { x: 120, y: 80 };
  currentMode.value = 'editor';
};

// Add component from definition to canvas at specific coordinate
const addComponentFromDef = (def: ComponentDefinition, x: number, y: number) => {
  const currentList = [...currentEditingComponents.value];
  const maxZ = currentList.reduce((max, c) => Math.max(max, c.zIndex || 1), 0);
  const id = `prim-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

  const newComp: ScreenComponent = {
    id,
    name: `${def.name} #${currentList.length + 1}`,
    type: def.type,
    category: def.category || 'basic',
    x,
    y,
    width: def.defaultWidth || 80,
    height: def.defaultHeight || 60,
    rotation: 0,
    zIndex: maxZ + 1,
    style: JSON.parse(JSON.stringify(def.defaultStyle || { stroke: '#00f2ff', strokeWidth: 2, fill: 'rgba(0, 242, 255, 0.15)' })),
    data: JSON.parse(JSON.stringify(def.defaultData || { mapping: {} })),
    customProps: def.defaultCustomProps ? JSON.parse(JSON.stringify(def.defaultCustomProps)) : undefined
  };

  currentEditingComponents.value = [...currentList, newComp];
  selectedCompIds.value = [newComp.id];
  showNotice(`已添加图元: ${newComp.name}`);
};

// Left Sidebar Drag Start for Primitives
const handlePrimitiveDragStart = (e: DragEvent, item: ComponentDefinition) => {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('application/json', JSON.stringify({
    isPrimitive: true,
    item
  }));
};

// Left Sidebar Click for Primitives (Clicking drawing tools activates drawing mode; clicking normal items adds to canvas center)
const handlePrimitiveClick = (item: ComponentDefinition) => {
  if (item.type === 'draw-polyline') {
    activeTool.value = 'draw-polyline';
    polylineDrawing.value.active = false;
    polylineDrawing.value.points = [];
    showNotice('已激活折线走线工具：在画布单击确定拐点，移动查看虚线，双击或按Enter结束');
    return;
  }
  if (item.type === 'draw-arrow') {
    activeTool.value = 'draw-arrow';
    arrowDrawing.value.active = false;
    showNotice('已激活导向箭头工具：在画布单击确定起点，再次单击确定终点');
    return;
  }

  // Normal primitive: Add to center of visible canvas with point snap
  const gs = editorGridSize.value || 20;
  const rawX = -canvasPan.value.x / canvasZoom.value + 280;
  const rawY = -canvasPan.value.y / canvasZoom.value + 160;
  const targetX = snapToEditorGrid.value ? Math.round(rawX / gs) * gs : Math.round(rawX);
  const targetY = snapToEditorGrid.value ? Math.round(rawY / gs) * gs : Math.round(rawY);

  addComponentFromDef(item, targetX, targetY);
};

// Drop onto Canvas (snaps top-left strictly to grid point)
const handleCanvasDrop = (e: DragEvent) => {
  e.preventDefault();
  const rawData = e.dataTransfer?.getData('application/json');
  if (!rawData) return;
  try {
    const data = JSON.parse(rawData);
    if (!data.item) return;
    const def = data.item as ComponentDefinition;

    const canvasInner = document.getElementById('workshop-canvas-inner');
    if (!canvasInner) return;
    const rect = canvasInner.getBoundingClientRect();

    const compW = def.defaultWidth || 80;
    const compH = def.defaultHeight || 60;
    const rawX = (e.clientX - rect.left) / canvasZoom.value - compW / 2;
    const rawY = (e.clientY - rect.top) / canvasZoom.value - compH / 2;

    const gs = editorGridSize.value || 20;
    const targetX = snapToEditorGrid.value ? Math.round(rawX / gs) * gs : Math.round(rawX);
    const targetY = snapToEditorGrid.value ? Math.round(rawY / gs) * gs : Math.round(rawY);

    addComponentFromDef(def, targetX, targetY);
  } catch (err) {
    console.error('Failed to parse dropped primitive:', err);
  }
};

// Auto Crop & Tight Encapsulation
const handleAutoCropSymbol = () => {
  const comps = currentEditingComponents.value;
  if (!comps || comps.length === 0) {
    showNotice('当前画布无图元，无法截取', 'error');
    return;
  }

  const padding = 10;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  comps.forEach(c => {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + c.height);
  });

  const shiftX = minX - padding;
  const shiftY = minY - padding;

  // Apply coordinate shift to all states so states stay aligned!
  editorStates.value.forEach(st => {
    st.children = st.children.map(c => ({
      ...c,
      x: Math.max(0, Math.round(c.x - shiftX)),
      y: Math.max(0, Math.round(c.y - shiftY))
    }));
  });

  const finalW = Math.max(20, Math.round(maxX - minX + padding * 2));
  const finalH = Math.max(20, Math.round(maxY - minY + padding * 2));

  showNotice(`已自动截取并紧凑对齐！封装尺寸: ${finalW} × ${finalH} px`);
};

// Re-snap all components of current state to grid points (吸附在点上，而非格中间)
const handleReSnapToGrid = () => {
  const gs = editorGridSize.value || 20;
  currentEditingComponents.value = currentEditingComponents.value.map(c => ({
    ...c,
    x: Math.round(c.x / gs) * gs,
    y: Math.round(c.y / gs) * gs
  }));
  showNotice(`当前状态图元已全部重新吸附至 ${gs}px 点格！`);
};

// Re-snap all components across ALL states
const handleReSnapAllStatesToGrid = () => {
  const gs = editorGridSize.value || 20;
  editorStates.value.forEach(st => {
    st.children = st.children.map(c => ({
      ...c,
      x: Math.round(c.x / gs) * gs,
      y: Math.round(c.y / gs) * gs
    }));
  });
  showNotice(`全部 ${editorStates.value.length} 个状态的图元均已精准重新吸附至 ${gs}px 点格！`);
};

// Save Symbol and Store
const handleSaveSymbol = (andPlaceToCanvas = false) => {
  const trimmedName = editorSymbolName.value.trim();
  if (!trimmedName) {
    showNotice('请输入图元名称', 'error');
    return;
  }

  if (editorStates.value.length === 0 || editorStates.value.every(s => s.children.length === 0)) {
    showNotice('图元内无基础图元组件，请先绘制或添加图元！', 'error');
    return;
  }

  handleAutoCropSymbol();

  const firstStateChildren = editorStates.value[0]?.children || [];
  let maxW = 80;
  let maxH = 80;
  if (firstStateChildren.length > 0) {
    maxW = Math.max(...firstStateChildren.map(c => c.x + c.width)) + 10;
    maxH = Math.max(...firstStateChildren.map(c => c.y + c.height)) + 10;
  }

  const tagsArr = editorSymbolTags.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);

  const symDef: CustomSymbolDef = {
    id: editingSymbolId.value || `custom-sym-${Date.now()}`,
    name: trimmedName,
    category: editorSymbolCategory.value,
    iconName: editorSymbolCategory.value === 'electrical' ? 'Zap' : (editorSymbolCategory.value === 'industrial' ? 'Cpu' : 'Box'),
    description: editorSymbolDesc.value.trim() || '工坊自定义封装多态图元',
    tags: tagsArr.length > 0 ? tagsArr : ['自定义图元'],
    defaultWidth: maxW,
    defaultHeight: maxH,
    type: 'composite-symbol',
    defaultStyle: {
      fill: 'transparent',
      stroke: '#00f2ff',
      strokeWidth: 2,
      borderRadius: 4
    },
    states: JSON.parse(JSON.stringify(editorStates.value)),
    children: JSON.parse(JSON.stringify(editorStates.value[0]?.children || []))
  };

  const existingIndex = symbols.value.findIndex(s => s.id === symDef.id);
  if (existingIndex >= 0) {
    updateCustomSymbol(symDef);
  } else {
    addCustomSymbol(symDef);
  }

  loadSymbols();
  emit('update:symbols', symbols.value);
  showNotice(`图元「${symDef.name}」已成功保存并入库！`);

  if (andPlaceToCanvas) {
    emit('use:symbol', symDef);
    emit('close');
  } else {
    currentMode.value = 'gallery';
  }
};

// Multi-state Management with unique integers
const handleAddState = () => {
  const nextVal = getNextAvailableStateValue();
  const newId = `state-${Date.now()}`;
  const currentList = currentEditingComponents.value;

  const newState: SymbolState = {
    id: newId,
    name: `状态 ${nextVal}`,
    stateValue: nextVal,
    matchValue: nextVal,
    children: JSON.parse(JSON.stringify(currentList)) // clone current for convenient editing
  };

  editorStates.value.push(newState);
  activeStateId.value = newId;
  showNotice(`已新增状态: ${newState.name} (唯一数值: ${nextVal})`);
};

const handleDuplicateState = () => {
  const current = activeState.value;
  if (!current) return;
  const nextVal = getNextAvailableStateValue();
  const newId = `state-${Date.now()}`;
  const existingNames = editorStates.value.map(s => s.name);
  const uniqueName = generateUniqueDuplicateName(current.name, existingNames, '状态');

  const cloned: SymbolState = {
    id: newId,
    name: uniqueName,
    stateValue: nextVal,
    matchValue: nextVal,
    children: JSON.parse(JSON.stringify(current.children))
  };

  editorStates.value.push(cloned);
  activeStateId.value = newId;
  showNotice(`已复制状态: ${cloned.name} (分配数值: ${nextVal})`);
};

const handleDeleteState = (id: string) => {
  if (editorStates.value.length <= 1) {
    showNotice('至少需要保留一个图元状态', 'error');
    return;
  }
  editorStates.value = editorStates.value.filter(s => s.id !== id);
  if (activeStateId.value === id) {
    activeStateId.value = editorStates.value[0].id;
  }
  showNotice('已删除图元状态');
};

// Update State Unique Integer Value with strict validation
const handleUpdateStateValue = (stateId: string, inputVal: string | number) => {
  const target = editorStates.value.find(s => s.id === stateId);
  if (!target) return;

  const num = typeof inputVal === 'number' ? inputVal : parseInt(String(inputVal).trim(), 10);
  if (isNaN(num) || !Number.isInteger(num)) {
    showNotice('状态值必须是有效整数！', 'error');
    return;
  }

  // Check uniqueness across other states
  const conflict = editorStates.value.find(s => s.id !== stateId && s.stateValue === num);
  if (conflict) {
    showNotice(`状态整数 ${num} 已被「${conflict.name}」使用，状态值必须唯一！`, 'error');
    return;
  }

  target.stateValue = num;
  target.matchValue = num;
  showNotice(`已更新「${target.name}」的状态数值为 ${num}`);
};

// Canvas Mouse Interactions (Pan, Zoom, Drag components)
const handleCanvasWheel = (e: WheelEvent) => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  const newZoom = Math.min(3.0, Math.max(0.3, canvasZoom.value * zoomFactor));
  canvasZoom.value = Number(newZoom.toFixed(2));
};

const getCanvasInnerCoords = (clientX: number, clientY: number) => {
  const canvasInner = document.getElementById('workshop-canvas-inner');
  if (!canvasInner) return { x: 0, y: 0 };
  const rect = canvasInner.getBoundingClientRect();
  const rawX = (clientX - rect.left) / canvasZoom.value;
  const rawY = (clientY - rect.top) / canvasZoom.value;
  const gs = editorGridSize.value || 20;

  return {
    rawX,
    rawY,
    x: snapToEditorGrid.value ? Math.round(rawX / gs) * gs : Math.round(rawX),
    y: snapToEditorGrid.value ? Math.round(rawY / gs) * gs : Math.round(rawY)
  };
};

const handleCanvasMouseDown = (e: MouseEvent) => {
  // Polyline drawing mode: Add vertex
  if (activeTool.value === 'draw-polyline') {
    const coords = getCanvasInnerCoords(e.clientX, e.clientY);
    if (!polylineDrawing.value.active) {
      polylineDrawing.value.active = true;
      polylineDrawing.value.points = [{ x: coords.x, y: coords.y }];
      polylineDrawing.value.currentX = coords.x;
      polylineDrawing.value.currentY = coords.y;
    } else {
      polylineDrawing.value.points.push({ x: coords.x, y: coords.y });
    }
    return;
  }

  // Arrow drawing mode: Set start or finish
  if (activeTool.value === 'draw-arrow') {
    const coords = getCanvasInnerCoords(e.clientX, e.clientY);
    if (!arrowDrawing.value.active) {
      arrowDrawing.value.active = true;
      arrowDrawing.value.startX = coords.x;
      arrowDrawing.value.startY = coords.y;
      arrowDrawing.value.currentX = coords.x;
      arrowDrawing.value.currentY = coords.y;
    } else {
      arrowDrawing.value.currentX = coords.x;
      arrowDrawing.value.currentY = coords.y;
      finishArrowDrawing();
    }
    return;
  }

  if (isResizingComp.value || isRotatingComp.value) return;

  // Middle mouse click, Alt key, or background click initiates Pan
  if (e.button === 1 || e.altKey || (e.target as HTMLElement).id === 'workshop-canvas-bg' || (e.target as HTMLElement).id === 'workshop-canvas-inner') {
    isPanning.value = true;
    panStart.value = { x: e.clientX - canvasPan.value.x, y: e.clientY - canvasPan.value.y };
    if ((e.target as HTMLElement).id === 'workshop-canvas-bg' || (e.target as HTMLElement).id === 'workshop-canvas-inner') {
      selectedCompIds.value = [];
    }
  }
};

// Start Resizing Component via Handle
const handleStartResizeComp = (comp: ScreenComponent, handle: string, e: MouseEvent) => {
  e.stopPropagation();
  e.preventDefault();
  selectedCompIds.value = [comp.id];
  isResizingComp.value = true;
  resizeCompHandle.value = handle;
  resizeCompStart.value = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    x: comp.x,
    y: comp.y,
    width: comp.width,
    height: comp.height,
    fontSize: comp.style?.fontSize || Math.max(12, Math.round(comp.height * 0.65))
  };
};

// Start Rotating Component via Top Handle
const handleStartRotateComp = (comp: ScreenComponent, e: MouseEvent) => {
  e.stopPropagation();
  e.preventDefault();
  selectedCompIds.value = [comp.id];
  isRotatingComp.value = true;
  const cx = comp.x + comp.width / 2;
  const cy = comp.y + comp.height / 2;
  const coords = getCanvasInnerCoords(e.clientX, e.clientY);
  const startAngle = Math.atan2(coords.rawY - cy, coords.rawX - cx) * (180 / Math.PI);
  rotateCompStart.value = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    startAngle,
    compAngle: comp.rotation || 0,
    cx,
    cy
  };
};

const handleCanvasMouseMove = (e: MouseEvent) => {
  if (isPanning.value) {
    canvasPan.value = {
      x: e.clientX - panStart.value.x,
      y: e.clientY - panStart.value.y
    };
    return;
  }

  if (activeTool.value === 'draw-polyline') {
    const coords = getCanvasInnerCoords(e.clientX, e.clientY);
    polylineDrawing.value.currentX = coords.x;
    polylineDrawing.value.currentY = coords.y;
    return;
  }

  if (activeTool.value === 'draw-arrow' && arrowDrawing.value.active) {
    const coords = getCanvasInnerCoords(e.clientX, e.clientY);
    arrowDrawing.value.currentX = coords.x;
    arrowDrawing.value.currentY = coords.y;
    return;
  }

  // Handle Component Rotation
  if (isRotatingComp.value && selectedComponent.value) {
    const comp = selectedComponent.value;
    const coords = getCanvasInnerCoords(e.clientX, e.clientY);
    const currentAngle = Math.atan2(coords.rawY - rotateCompStart.value.cy, coords.rawX - rotateCompStart.value.cx) * (180 / Math.PI);
    const diffAngle = currentAngle - rotateCompStart.value.startAngle;
    let finalAngle = Math.round(rotateCompStart.value.compAngle + diffAngle);
    finalAngle = ((finalAngle % 360) + 360) % 360;

    if (e.shiftKey) {
      finalAngle = Math.round(finalAngle / 15) * 15;
    }

    currentEditingComponents.value = currentEditingComponents.value.map(c => {
      if (c.id === comp.id) {
        return { ...c, rotation: finalAngle };
      }
      return c;
    });
    return;
  }

  // Handle Component Resizing & Stretching with exact grid point snap
  if (isResizingComp.value && selectedComponent.value && resizeCompHandle.value) {
    const comp = selectedComponent.value;
    const handle = resizeCompHandle.value;
    const gs = editorGridSize.value || 20;

    const dx = (e.clientX - resizeCompStart.value.mouseX) / canvasZoom.value;
    const dy = (e.clientY - resizeCompStart.value.mouseY) / canvasZoom.value;

    let newX = resizeCompStart.value.x;
    let newY = resizeCompStart.value.y;
    let newW = resizeCompStart.value.width;
    let newH = resizeCompStart.value.height;

    if (!comp.rotation) {
      // East (right) handle
      if (handle.includes('e')) {
        if (snapToEditorGrid.value) {
          const targetRight = Math.round((resizeCompStart.value.x + resizeCompStart.value.width + dx) / gs) * gs;
          newW = Math.max(gs, targetRight - newX);
        } else {
          newW = Math.max(10, Math.round(resizeCompStart.value.width + dx));
        }
      }

      // South (bottom) handle
      if (handle.includes('s')) {
        if (snapToEditorGrid.value) {
          const targetBottom = Math.round((resizeCompStart.value.y + resizeCompStart.value.height + dy) / gs) * gs;
          newH = Math.max(gs, targetBottom - newY);
        } else {
          newH = Math.max(10, Math.round(resizeCompStart.value.height + dy));
        }
      }

      // West (left) handle
      if (handle.includes('w')) {
        const origRight = resizeCompStart.value.x + resizeCompStart.value.width;
        if (snapToEditorGrid.value) {
          const targetLeft = Math.round((resizeCompStart.value.x + dx) / gs) * gs;
          if (origRight - targetLeft >= gs) {
            newX = targetLeft;
            newW = origRight - targetLeft;
          }
        } else {
          const potW = resizeCompStart.value.width - dx;
          if (potW >= 10) {
            newW = Math.round(potW);
            newX = Math.round(resizeCompStart.value.x + dx);
          }
        }
      }

      // North (top) handle
      if (handle.includes('n')) {
        const origBottom = resizeCompStart.value.y + resizeCompStart.value.height;
        if (snapToEditorGrid.value) {
          const targetTop = Math.round((resizeCompStart.value.y + dy) / gs) * gs;
          if (origBottom - targetTop >= gs) {
            newY = targetTop;
            newH = origBottom - targetTop;
          }
        } else {
          const potH = resizeCompStart.value.height - dy;
          if (potH >= 10) {
            newH = Math.round(potH);
            newY = Math.round(resizeCompStart.value.y + dy);
          }
        }
      }
    } else {
      // Rotated component: transform dx/dy into local coordinate system
      const rad = ((comp.rotation || 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const localDx = dx * cos + dy * sin;
      const localDy = -dx * sin + dy * cos;

      let deltaW = 0;
      let deltaH = 0;

      if (handle.includes('e')) deltaW = localDx;
      if (handle.includes('w')) deltaW = -localDx;
      if (handle.includes('s')) deltaH = localDy;
      if (handle.includes('n')) deltaH = -localDy;

      newW = Math.max(10, Math.round(resizeCompStart.value.width + deltaW));
      newH = Math.max(10, Math.round(resizeCompStart.value.height + deltaH));
    }

    // Auto font-size scaling for text and button
    let updatedStyle = { ...comp.style };
    if (comp.type === 'draw-text' || comp.type === 'ctrl-button') {
      const initH = resizeCompStart.value.height || 36;
      const initFontSize = resizeCompStart.value.fontSize || comp.style?.fontSize || Math.max(12, Math.round(initH * 0.65));
      const scaleFactor = newH / initH;
      const newFontSize = Math.max(10, Math.min(Math.round(initFontSize * scaleFactor), 96));
      updatedStyle.fontSize = newFontSize;
    }

    currentEditingComponents.value = currentEditingComponents.value.map(c => {
      if (c.id === comp.id) {
        return {
          ...c,
          x: newX,
          y: newY,
          width: newW,
          height: newH,
          style: updatedStyle
        };
      }
      return c;
    });
    return;
  }

  if (isDraggingComps.value) {
    const dx = (e.clientX - dragStartMouse.value.x) / canvasZoom.value;
    const dy = (e.clientY - dragStartMouse.value.y) / canvasZoom.value;
    const gs = editorGridSize.value || 20;

    currentEditingComponents.value = currentEditingComponents.value.map(c => {
      if (selectedCompIds.value.includes(c.id) && dragInitialPositions.value[c.id]) {
        let newX = dragInitialPositions.value[c.id].x + dx;
        let newY = dragInitialPositions.value[c.id].y + dy;

        if (snapToEditorGrid.value) {
          newX = Math.round(newX / gs) * gs;
          newY = Math.round(newY / gs) * gs;
        }

        return {
          ...c,
          x: Math.round(newX),
          y: Math.round(newY)
        };
      }
      return c;
    });
  }
};

const handleCanvasMouseUp = () => {
  isPanning.value = false;
  isDraggingComps.value = false;
  isResizingComp.value = false;
  resizeCompHandle.value = null;
  isRotatingComp.value = false;
};

// Finish Polyline Drawing (Consistent with CanvasEditor.vue)
const finishPolylineDrawing = () => {
  if (!polylineDrawing.value.active) return;
  const pts = polylineDrawing.value.points;
  if (pts.length < 2) {
    polylineDrawing.value.active = false;
    polylineDrawing.value.points = [];
    activeTool.value = 'select';
    return;
  }

  const minX = Math.min(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y));
  const maxX = Math.max(...pts.map(p => p.x));
  const maxY = Math.max(...pts.map(p => p.y));

  const compW = Math.max(12, maxX - minX);
  const compH = Math.max(12, maxY - minY);

  const relPoints = pts.map(p => ({
    xRatio: compW > 0 ? (p.x - minX) / compW : 0,
    yRatio: compH > 0 ? (p.y - minY) / compH : 0,
    x: p.x - minX,
    y: p.y - minY
  }));

  const currentList = [...currentEditingComponents.value];
  const maxZ = currentList.reduce((max, c) => Math.max(max, c.zIndex || 1), 0);

  const newComp: ScreenComponent = {
    id: `prim-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: `折线走线 #${currentList.length + 1}`,
    type: 'draw-polyline',
    category: 'basic',
    x: minX,
    y: minY,
    width: compW,
    height: compH,
    rotation: 0,
    zIndex: maxZ + 1,
    style: {
      stroke: '#00f2ff',
      strokeWidth: 3,
      lineType: 'step-horizontal',
      lineStyle: 'solid'
    },
    data: { mapping: {} },
    customProps: {
      points: relPoints
    }
  };

  currentEditingComponents.value = [...currentList, newComp];
  selectedCompIds.value = [newComp.id];
  polylineDrawing.value.active = false;
  polylineDrawing.value.points = [];
  activeTool.value = 'select';
  showNotice(`已创建折线走线 (${pts.length} 点)`);
};

// Finish Arrow Drawing (Consistent with CanvasEditor.vue)
const finishArrowDrawing = () => {
  if (!arrowDrawing.value.active) return;
  const { startX, startY, currentX, currentY } = arrowDrawing.value;
  const dist = Math.hypot(currentX - startX, currentY - startY);
  if (dist < 5) {
    arrowDrawing.value.active = false;
    activeTool.value = 'select';
    return;
  }

  const pad = 12;
  const minX = Math.min(startX, currentX) - pad;
  const minY = Math.min(startY, currentY) - pad;
  const maxX = Math.max(startX, currentX) + pad;
  const maxY = Math.max(startY, currentY) + pad;

  const compW = Math.max(24, maxX - minX);
  const compH = Math.max(24, maxY - minY);

  const relPoints = [
    { xRatio: (startX - minX) / compW, yRatio: (startY - minY) / compH, x: startX - minX, y: startY - minY },
    { xRatio: (currentX - minX) / compW, yRatio: (currentY - minY) / compH, x: currentX - minX, y: currentY - minY }
  ];

  const currentList = [...currentEditingComponents.value];
  const maxZ = currentList.reduce((max, c) => Math.max(max, c.zIndex || 1), 0);

  const newComp: ScreenComponent = {
    id: `prim-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: `导向箭头 #${currentList.length + 1}`,
    type: 'draw-arrow',
    category: 'basic',
    x: minX,
    y: minY,
    width: compW,
    height: compH,
    rotation: 0,
    zIndex: maxZ + 1,
    style: {
      stroke: '#00f2ff',
      strokeWidth: 3,
      endArrow: true,
      startArrow: false,
      lineStyle: 'solid'
    },
    data: { mapping: {} },
    customProps: {
      points: relPoints
    }
  };

  currentEditingComponents.value = [...currentList, newComp];
  selectedCompIds.value = [newComp.id];
  arrowDrawing.value.active = false;
  activeTool.value = 'select';
  showNotice(`已创建导向箭头`);
};

// Double click on canvas finishes polyline/arrow
const handleCanvasDblClick = () => {
  if (activeTool.value === 'draw-polyline' && polylineDrawing.value.active) {
    finishPolylineDrawing();
  } else if (activeTool.value === 'draw-arrow' && arrowDrawing.value.active) {
    finishArrowDrawing();
  }
};

// Component Click / Drag Start
const handleCompMouseDown = (comp: ScreenComponent, e: MouseEvent) => {
  e.stopPropagation();
  if (activeTool.value !== 'select') return;
  if (isResizingComp.value || isRotatingComp.value) return;

  if (e.shiftKey) {
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

  isDraggingComps.value = true;
  dragStartMouse.value = { x: e.clientX, y: e.clientY };
  dragInitialPositions.value = {};
  currentEditingComponents.value.forEach(c => {
    dragInitialPositions.value[c.id] = { x: c.x, y: c.y };
  });
};

// ==================== WORKSHOP HISTORY & CLIPBOARD & SHORTCUTS ====================

const recordHistory = () => {
  if (isHistoryTraveling.value) return;
  try {
    const snapshot = JSON.stringify({
      states: editorStates.value,
      activeStateId: activeStateId.value
    });
    if (historyIndex.value >= 0 && historyStack.value[historyIndex.value] === snapshot) return;
    
    if (historyIndex.value < historyStack.value.length - 1) {
      historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
    }
    historyStack.value.push(snapshot);
    if (historyStack.value.length > 40) historyStack.value.shift();
    historyIndex.value = historyStack.value.length - 1;
  } catch (err) {
    console.error('Record history failed:', err);
  }
};

const handleUndo = () => {
  if (historyIndex.value > 0) {
    isHistoryTraveling.value = true;
    historyIndex.value--;
    try {
      const state = JSON.parse(historyStack.value[historyIndex.value]);
      editorStates.value = state.states;
      activeStateId.value = state.activeStateId;
      showNotice('已撤销 (Undo)');
    } catch (err) {
      console.error(err);
    } finally {
      isHistoryTraveling.value = false;
    }
  } else {
    showNotice('已至最早历史记录');
  }
};

const handleRedo = () => {
  if (historyIndex.value < historyStack.value.length - 1) {
    isHistoryTraveling.value = true;
    historyIndex.value++;
    try {
      const state = JSON.parse(historyStack.value[historyIndex.value]);
      editorStates.value = state.states;
      activeStateId.value = state.activeStateId;
      showNotice('已重做 (Redo)');
    } catch (err) {
      console.error(err);
    } finally {
      isHistoryTraveling.value = false;
    }
  } else {
    showNotice('已至最新历史记录');
  }
};

const handleCopySelected = () => {
  if (selectedCompIds.value.length === 0) {
    showNotice('请先选择要复制的基础图元');
    return;
  }
  const toCopy = currentEditingComponents.value.filter(c => selectedCompIds.value.includes(c.id));
  symbolClipboard.value = JSON.parse(JSON.stringify(toCopy));
  showNotice(`已复制 ${toCopy.length} 个图元组件 (Ctrl+C)`);
};

const handleCutSelected = () => {
  if (selectedCompIds.value.length === 0) return;
  handleCopySelected();
  handleDeleteSelectedPrimitives();
  showNotice('已剪切选中图元 (Ctrl+X)');
};

const handlePastePrimitives = (targetCanvasX?: number, targetCanvasY?: number) => {
  if (symbolClipboard.value.length === 0) {
    showNotice('剪贴板为空，请先复制图元 (Ctrl+C)');
    return;
  }

  const gs = editorGridSize.value || 20;
  let offsetX = 20;
  let offsetY = 20;

  if (targetCanvasX !== undefined && targetCanvasY !== undefined && symbolClipboard.value.length > 0) {
    const firstComp = symbolClipboard.value[0];
    offsetX = targetCanvasX - firstComp.x;
    offsetY = targetCanvasY - firstComp.y;
    if (snapToEditorGrid.value) {
      offsetX = Math.round(offsetX / gs) * gs;
      offsetY = Math.round(offsetY / gs) * gs;
    }
  }

  const newIds: string[] = [];
  const existingNames = currentEditingComponents.value.map(c => c.name);
  const pasted: ScreenComponent[] = symbolClipboard.value.map(c => {
    const newId = `sub-${c.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    newIds.push(newId);
    const uniqueName = generateUniqueDuplicateName(c.name, existingNames, '图元');
    existingNames.push(uniqueName);
    return {
      ...JSON.parse(JSON.stringify(c)),
      id: newId,
      name: uniqueName,
      x: c.x + offsetX,
      y: c.y + offsetY,
      zIndex: currentEditingComponents.value.length + 1
    };
  });

  currentEditingComponents.value = [...currentEditingComponents.value, ...pasted];
  selectedCompIds.value = newIds;
  recordHistory();
  showNotice(`已粘贴 ${pasted.length} 个图元 (Ctrl+V)`);
};

const handleDuplicateSelected = () => {
  if (selectedCompIds.value.length === 0) return;
  handleCopySelected();
  handlePastePrimitives();
};

const handleSelectAll = () => {
  selectedCompIds.value = currentEditingComponents.value.map(c => c.id);
  showNotice(`已全选 ${selectedCompIds.value.length} 个图元 (Ctrl+A)`);
};

const handleRotateSelected = (degrees = 90) => {
  if (selectedCompIds.value.length === 0) return;
  currentEditingComponents.value = currentEditingComponents.value.map(c => {
    if (selectedCompIds.value.includes(c.id)) {
      const nextAngle = ((c.rotation || 0) + degrees) % 360;
      return { ...c, rotation: nextAngle };
    }
    return c;
  });
  recordHistory();
  showNotice(`已旋转 ${degrees}°`);
};

const handleSnapSelectedToGrid = () => {
  if (selectedCompIds.value.length === 0) return;
  const gs = editorGridSize.value || 20;
  currentEditingComponents.value = currentEditingComponents.value.map(c => {
    if (selectedCompIds.value.includes(c.id)) {
      return {
        ...c,
        x: Math.round(c.x / gs) * gs,
        y: Math.round(c.y / gs) * gs,
        width: Math.max(gs, Math.round(c.width / gs) * gs),
        height: Math.max(gs, Math.round(c.height / gs) * gs)
      };
    }
    return c;
  });
  recordHistory();
  showNotice('选中图元已对齐网格点');
};

// Context Menu Event Handlers
const handleCanvasContextMenu = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  const coords = getCanvasInnerCoords(e.clientX, e.clientY);
  contextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    canvasX: coords.x,
    canvasY: coords.y,
    targetCompId: null
  };
};

const handleCompContextMenu = (comp: ScreenComponent, e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (!selectedCompIds.value.includes(comp.id)) {
    selectedCompIds.value = [comp.id];
  }
  const coords = getCanvasInnerCoords(e.clientX, e.clientY);
  contextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    canvasX: coords.x,
    canvasY: coords.y,
    targetCompId: comp.id
  };
};

const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

// Keyboard handler: micro-adjustments & full shortcut suite
const handleKeyDown = (e: KeyboardEvent) => {
  if (currentMode.value !== 'editor') return;

  const target = e.target as HTMLElement;
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
    return;
  }

  const isCtrlOrCmd = e.ctrlKey || e.metaKey;

  // Ctrl + C: Copy
  if (isCtrlOrCmd && (e.key === 'c' || e.key === 'C')) {
    if (selectedCompIds.value.length > 0) {
      e.preventDefault();
      handleCopySelected();
      return;
    }
  }

  // Ctrl + V: Paste
  if (isCtrlOrCmd && (e.key === 'v' || e.key === 'V')) {
    e.preventDefault();
    handlePastePrimitives();
    return;
  }

  // Ctrl + X: Cut
  if (isCtrlOrCmd && (e.key === 'x' || e.key === 'X')) {
    if (selectedCompIds.value.length > 0) {
      e.preventDefault();
      handleCutSelected();
      return;
    }
  }

  // Ctrl + D: Duplicate
  if (isCtrlOrCmd && (e.key === 'd' || e.key === 'D')) {
    if (selectedCompIds.value.length > 0) {
      e.preventDefault();
      handleDuplicateSelected();
      return;
    }
  }

  // Ctrl + A: Select All
  if (isCtrlOrCmd && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault();
    handleSelectAll();
    return;
  }

  // Ctrl + Z: Undo / Ctrl + Shift + Z: Redo
  if (isCtrlOrCmd && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    if (e.shiftKey) {
      handleRedo();
    } else {
      handleUndo();
    }
    return;
  }

  // Ctrl + Y: Redo
  if (isCtrlOrCmd && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    handleRedo();
    return;
  }

  // Ctrl + S: Quick Save
  if (isCtrlOrCmd && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    handleSaveSymbol(false);
    return;
  }

  // R: Rotate 90 degrees
  if (!isCtrlOrCmd && (e.key === 'r' || e.key === 'R')) {
    if (selectedCompIds.value.length > 0) {
      e.preventDefault();
      handleRotateSelected(90);
      return;
    }
  }

  // G: Toggle Grid Snap
  if (!isCtrlOrCmd && (e.key === 'g' || e.key === 'G')) {
    e.preventDefault();
    snapToEditorGrid.value = !snapToEditorGrid.value;
    showNotice(snapToEditorGrid.value ? '已开启点格吸附' : '已关闭点格吸附');
    return;
  }

  // Layer shortcuts: [ and ]
  if (e.key === '[') {
    if (selectedCompIds.value.length > 0) {
      e.preventDefault();
      handleMoveLayer(e.shiftKey ? 'bottom' : 'down');
      return;
    }
  }
  if (e.key === ']') {
    if (selectedCompIds.value.length > 0) {
      e.preventDefault();
      handleMoveLayer(e.shiftKey ? 'top' : 'up');
      return;
    }
  }

  // Escape: cancel drawing or clear selection or close context menu
  if (e.key === 'Escape') {
    if (contextMenu.value.visible) {
      closeContextMenu();
      return;
    }
    if (activeTool.value === 'draw-polyline' || polylineDrawing.value.active) {
      polylineDrawing.value.active = false;
      polylineDrawing.value.points = [];
      activeTool.value = 'select';
      showNotice('已取消折线绘制');
      return;
    }
    if (activeTool.value === 'draw-arrow' || arrowDrawing.value.active) {
      arrowDrawing.value.active = false;
      activeTool.value = 'select';
      showNotice('已取消箭头绘制');
      return;
    }
    selectedCompIds.value = [];
    return;
  }

  // Enter: finish drawing
  if (e.key === 'Enter') {
    if (activeTool.value === 'draw-polyline' && polylineDrawing.value.active) {
      finishPolylineDrawing();
      return;
    }
    if (activeTool.value === 'draw-arrow' && arrowDrawing.value.active) {
      finishArrowDrawing();
      return;
    }
  }

  // Delete / Backspace: delete selected
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedCompIds.value.length > 0) {
      e.preventDefault();
      handleDeleteSelectedPrimitives();
      return;
    }
  }

  // Arrow keys: micro-adjustments with minimal step 1px (or 10px if Shift held)
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    if (selectedCompIds.value.length === 0) return;
    e.preventDefault();

    const step = e.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowUp') dy = -step;
    if (e.key === 'ArrowDown') dy = step;
    if (e.key === 'ArrowLeft') dx = -step;
    if (e.key === 'ArrowRight') dx = step;

    currentEditingComponents.value = currentEditingComponents.value.map(c => {
      if (selectedCompIds.value.includes(c.id)) {
        return {
          ...c,
          x: c.x + dx,
          y: c.y + dy
        };
      }
      return c;
    });
    recordHistory();
  }
};

// Delete selected primitive
const handleDeleteSelectedPrimitives = () => {
  if (selectedCompIds.value.length === 0) return;
  const toDelete = new Set(selectedCompIds.value);
  currentEditingComponents.value = currentEditingComponents.value.filter(c => !toDelete.has(c.id));
  selectedCompIds.value = [];
  recordHistory();
  showNotice('已删除选中基础图元');
};

// Layer reordering
const handleMoveLayer = (direction: 'up' | 'down' | 'top' | 'bottom') => {
  if (selectedCompIds.value.length === 0) return;
  const list = [...currentEditingComponents.value];
  const targetId = selectedCompIds.value[0];
  const idx = list.findIndex(c => c.id === targetId);
  if (idx < 0) return;

  if (direction === 'up' && idx < list.length - 1) {
    const temp = list[idx];
    list[idx] = list[idx + 1];
    list[idx + 1] = temp;
  } else if (direction === 'down' && idx > 0) {
    const temp = list[idx];
    list[idx] = list[idx - 1];
    list[idx - 1] = temp;
  } else if (direction === 'top') {
    const item = list.splice(idx, 1)[0];
    list.push(item);
  } else if (direction === 'bottom') {
    const item = list.splice(idx, 1)[0];
    list.unshift(item);
  }

  list.forEach((c, i) => {
    c.zIndex = i + 1;
  });
  currentEditingComponents.value = list;
  recordHistory();
};

// Gallery Operations
const handleUseSymbol = (sym: CustomSymbolDef) => {
  emit('use:symbol', sym);
  emit('close');
};

const handleDuplicateSymbol = (sym: CustomSymbolDef) => {
  const cloned: CustomSymbolDef = {
    ...JSON.parse(JSON.stringify(sym)),
    id: `custom-sym-${Date.now()}`,
    name: `${sym.name} (副本)`
  };
  addCustomSymbol(cloned);
  loadSymbols();
  emit('update:symbols', symbols.value);
  showNotice(`已复制图元: ${cloned.name}`);
};

const handleDeleteSymbol = (id: string, name: string) => {
  if (!confirm(`确定要删除图元「${name}」吗？`)) return;
  deleteCustomSymbol(id);
  loadSymbols();
  emit('update:symbols', symbols.value);
  showNotice(`已删除图元: ${name}`);
};

const handleExportSymbols = () => {
  exportSymbolsAsJSON();
  showNotice('图元资产包已导出');
};

const handleImportClick = () => {
  fileInputRef.value?.click();
};

const handleFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  const file = target.files[0];
  const success = await importSymbolsFromJSON(file);
  if (success) {
    loadSymbols();
    emit('update:symbols', symbols.value);
    showNotice('图元资产包导入成功！');
  } else {
    showNotice('导入失败，请检查 JSON 文件格式', 'error');
  }
  target.value = '';
};
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs select-none">
    <!-- Notification Toast -->
    <div
      v-if="notificationMessage"
      class="fixed top-5 left-1/2 -translate-x-1/2 z-70 px-4 py-2 rounded-xl text-xs font-mono font-bold shadow-2xl flex items-center gap-2 transition-all"
      :class="notificationType === 'success' ? 'bg-cyan-950 border border-cyan-400 text-cyan-200' : 'bg-rose-950 border border-rose-400 text-rose-200'"
    >
      <AlertCircle class="w-4 h-4" />
      <span>{{ notificationMessage }}</span>
    </div>

    <!-- Hidden file input for import -->
    <input
      type="file"
      ref="fileInputRef"
      accept=".json"
      class="hidden"
      @change="handleFileChange"
    />

    <!-- Main Container -->
    <div class="w-[96vw] h-[94vh] bg-[#03060f] border border-cyan-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <!-- ==================== VIEW 1: SYMBOLS GALLERY / ASSET MANAGER ==================== -->
      <div v-if="currentMode === 'gallery'" class="flex-1 flex flex-col overflow-hidden">
        <!-- Top Bar -->
        <div class="h-14 bg-[#060b18] border-b border-slate-800 px-6 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Box class="w-5 h-5" />
            </div>
            <div>
              <h2 class="text-sm font-bold text-slate-100 font-mono tracking-wide">
                SCADA 工业图元资产库与设计工坊
              </h2>
              <p class="text-[11px] text-slate-400 font-mono">
                管理多态工业图元、电气微元，支持在无限画布中自由绘制与状态调度
              </p>
            </div>
          </div>

          <!-- Header Actions -->
          <div class="flex items-center gap-2.5">
            <button
              @click="handleCreateNewBlankSymbol"
              class="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all font-mono"
            >
              <Plus class="w-4 h-4" />
              <span>新建自定义图元</span>
            </button>

            <button
              @click="handleImportClick"
              class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-cyan-500/50 text-xs flex items-center gap-1.5 cursor-pointer transition-all"
              title="导入图元 JSON 资产包"
            >
              <Upload class="w-3.5 h-3.5" />
              <span>导入资产包</span>
            </button>

            <button
              @click="handleExportSymbols"
              class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-cyan-500/50 text-xs flex items-center gap-1.5 cursor-pointer transition-all"
              title="导出全部图元为 JSON 文件"
            >
              <Download class="w-3.5 h-3.5" />
              <span>导出资产包</span>
            </button>

            <div class="h-4 w-[1px] bg-slate-800 mx-1" />

            <button
              @click="emit('close')"
              class="w-8 h-8 rounded-lg bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-300 border border-slate-800 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Filter Controls -->
        <div class="p-4 bg-[#060b18] border-b border-slate-800/80 flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <button
              @click="activeCategory = 'all'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              :class="activeCategory === 'all' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'"
            >
              全部图元 ({{ symbols.length }})
            </button>
            <button
              @click="activeCategory = 'electrical'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
              :class="activeCategory === 'electrical' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'"
            >
              <Zap class="w-3 h-3" />
              <span>电力一次设备</span>
            </button>
            <button
              @click="activeCategory = 'industrial'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
              :class="activeCategory === 'industrial' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'"
            >
              <Cpu class="w-3 h-3" />
              <span>工业光储</span>
            </button>
            <button
              @click="activeCategory = 'custom'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
              :class="activeCategory === 'custom' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'"
            >
              <BookmarkPlus class="w-3 h-3" />
              <span>自定义封装图元</span>
            </button>
          </div>

          <!-- Search Input -->
          <div class="relative w-72">
            <Search class="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索图元名称或标签..."
              class="w-full bg-[#040810] border border-slate-800 focus:border-cyan-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-hidden font-mono"
            />
          </div>
        </div>

        <!-- Symbols Grid View -->
        <div class="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <div v-if="filteredSymbols.length === 0" class="h-full flex flex-col items-center justify-center text-slate-500 gap-3 py-16">
            <Box class="w-12 h-12 text-slate-700" />
            <div class="text-sm">暂无匹配的自定义图元</div>
            <button
              @click="handleCreateNewBlankSymbol"
              class="px-4 py-2 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-xs font-bold hover:bg-cyan-900 cursor-pointer"
            >
              在设计工坊中创建第一个图元
            </button>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div
              v-for="sym in filteredSymbols"
              :key="sym.id"
              class="bg-[#070c18] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 flex flex-col justify-between transition-all group hover:shadow-[0_4px_25px_rgba(0,242,255,0.08)]"
            >
              <!-- Card Top -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Zap v-if="sym.category === 'electrical'" class="w-4 h-4" />
                      <Cpu v-else-if="sym.category === 'industrial'" class="w-4 h-4" />
                      <Box v-else class="w-4 h-4" />
                    </div>
                    <div>
                      <h3 class="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors font-mono">
                        {{ sym.name }}
                      </h3>
                      <div class="text-[10px] text-slate-500 font-mono">
                        {{ sym.defaultWidth }} × {{ sym.defaultHeight }} px
                      </div>
                    </div>
                  </div>

                  <!-- States Pill Counter -->
                  <span
                    v-if="sym.states && sym.states.length > 1"
                    class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                  >
                    {{ sym.states.length }} 态
                  </span>
                </div>

                <p class="text-[11px] text-slate-400 line-clamp-2 min-h-8 mb-2">
                  {{ sym.description || '支持动态遥信遥测绑定的工业矢量图元' }}
                </p>

                <!-- State Switcher in Card -->
                <div v-if="sym.states && sym.states.length > 1" class="mb-2 bg-slate-950/80 p-1 rounded-md border border-slate-800/80">
                  <div class="text-[9px] text-slate-400 mb-1 flex items-center justify-between">
                    <span>状态预览:</span>
                    <span class="text-cyan-400 font-mono">
                      数值: {{ sym.states.find(s => s.id === (previewActiveStates[sym.id] || sym.states?.[0]?.id))?.stateValue ?? 0 }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1 flex-wrap">
                    <button
                      v-for="st in sym.states"
                      :key="st.id"
                      @click="previewActiveStates[sym.id] = st.id"
                      class="px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors"
                      :class="(previewActiveStates[sym.id] || sym.states[0]?.id) === st.id ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white bg-slate-900'"
                    >
                      {{ st.name }}
                    </button>
                  </div>
                </div>

                <!-- Preview Area -->
                <div class="h-32 bg-[#02050b] rounded-lg border border-slate-900 flex items-center justify-center p-3 relative overflow-hidden group-hover:border-cyan-500/20 transition-colors">
                  <div
                    class="relative origin-center transform scale-75"
                    :style="{
                      width: `${sym.defaultWidth || 100}px`,
                      height: `${sym.defaultHeight || 100}px`
                    }"
                  >
                    <template v-if="sym.states && sym.states.length > 0">
                      <template v-for="child in (sym.states.find(s => s.id === (previewActiveStates[sym.id] || sym.states?.[0]?.id))?.children || sym.children || [])" :key="child.id">
                        <div
                          class="absolute"
                          :style="{
                            left: `${child.x}px`,
                            top: `${child.y}px`,
                            width: `${child.width}px`,
                            height: `${child.height}px`,
                            transform: `rotate(${child.rotation || 0}deg)`,
                            zIndex: child.zIndex || 1
                          }"
                        >
                          <WidgetRenderer :component="child" />
                        </div>
                      </template>
                    </template>
                    <template v-else-if="sym.children">
                      <div
                        v-for="child in sym.children"
                        :key="child.id"
                        class="absolute"
                        :style="{
                          left: `${child.x}px`,
                          top: `${child.y}px`,
                          width: `${child.width}px`,
                          height: `${child.height}px`,
                          transform: `rotate(${child.rotation || 0}deg)`,
                          zIndex: child.zIndex || 1
                        }"
                      >
                        <WidgetRenderer :component="child" />
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Tags list -->
                <div class="flex items-center gap-1.5 flex-wrap my-1.5">
                  <span
                    v-for="tag in sym.tags"
                    :key="tag"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/80 text-cyan-400/80 border border-cyan-500/20 font-mono"
                  >
                    #{{ tag }}
                  </span>
                </div>
              </div>

              <!-- Card Bottom Actions -->
              <div class="flex items-center justify-between pt-3 border-t border-slate-900 mt-2">
                <div class="flex items-center gap-1">
                  <button
                    @click="openEditorWithSymbol(sym)"
                    class="p-1.5 rounded-md bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 cursor-pointer"
                    title="在工坊画布中编辑图元"
                  >
                    <Edit3 class="w-3.5 h-3.5" />
                  </button>
                  <button
                    @click="handleDuplicateSymbol(sym)"
                    class="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 cursor-pointer"
                    title="复制图元"
                  >
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                  <button
                    @click="handleDeleteSymbol(sym.id, sym.name)"
                    class="p-1.5 rounded-md bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800 cursor-pointer"
                    title="删除图元"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  @click="handleUseSymbol(sym)"
                  class="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors font-mono"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>放置到主画布</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== VIEW 2: INFINITE CANVAS SYMBOL WORKSHOP EDITOR ==================== -->
      <div v-else class="flex-1 flex flex-col overflow-hidden bg-[#03060f]">
        <!-- Top Toolbar of Canvas Editor -->
        <div class="h-12 bg-[#070c18] border-b border-slate-800 px-4 flex items-center justify-between z-20">
          <!-- Left: Back & Symbol Info -->
          <div class="flex items-center gap-3">
            <button
              @click="currentMode = 'gallery'"
              class="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer font-mono"
            >
              <span>← 返回图元库</span>
            </button>

            <div class="flex items-center gap-2">
              <input
                v-model="editorSymbolName"
                type="text"
                placeholder="图元名称"
                class="bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded px-2.5 py-1 text-xs text-cyan-300 font-bold w-48 font-mono focus:outline-hidden"
              />
              <select
                v-model="editorSymbolCategory"
                class="bg-slate-950 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs font-mono focus:outline-hidden"
              >
                <option value="electrical">电力一次设备</option>
                <option value="industrial">工业SCADA</option>
                <option value="custom">自定义资产</option>
              </select>
            </div>
          </div>

          <!-- Center: Active Drawing Status Notification & Quick Operation Buttons -->
          <div class="flex items-center gap-2">
            <!-- Quick Action Toolbar Group -->
            <div class="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-md border border-slate-800">
              <button
                @click="handleUndo"
                class="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-900 cursor-pointer transition-colors"
                title="撤销 (Ctrl+Z)"
              >
                <Undo class="w-3.5 h-3.5" />
              </button>
              <button
                @click="handleRedo"
                class="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-900 cursor-pointer transition-colors"
                title="重做 (Ctrl+Y)"
              >
                <Redo class="w-3.5 h-3.5" />
              </button>
              <div class="w-px h-3.5 bg-slate-800 mx-0.5" />
              <button
                @click="handleCopySelected"
                :disabled="selectedCompIds.length === 0"
                class="p-1 rounded cursor-pointer transition-colors"
                :class="selectedCompIds.length > 0 ? 'text-slate-300 hover:text-white hover:bg-slate-900' : 'text-slate-600 cursor-not-allowed'"
                title="复制选中图元 (Ctrl+C)"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
              <button
                @click="handlePastePrimitives()"
                class="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-900 cursor-pointer transition-colors"
                title="粘贴图元 (Ctrl+V)"
              >
                <Clipboard class="w-3.5 h-3.5" />
              </button>
              <button
                @click="handleDuplicateSelected"
                :disabled="selectedCompIds.length === 0"
                class="p-1 rounded cursor-pointer transition-colors"
                :class="selectedCompIds.length > 0 ? 'text-slate-300 hover:text-white hover:bg-slate-900' : 'text-slate-600 cursor-not-allowed'"
                title="创建副本 (Ctrl+D)"
              >
                <Copy class="w-3.5 h-3.5 text-cyan-400" />
              </button>
              <button
                @click="handleRotateSelected(90)"
                :disabled="selectedCompIds.length === 0"
                class="p-1 rounded cursor-pointer transition-colors"
                :class="selectedCompIds.length > 0 ? 'text-slate-300 hover:text-white hover:bg-slate-900' : 'text-slate-600 cursor-not-allowed'"
                title="顺时针旋转90° (R)"
              >
                <RotateCw class="w-3.5 h-3.5" />
              </button>
              <button
                @click="handleDeleteSelectedPrimitives"
                :disabled="selectedCompIds.length === 0"
                class="p-1 rounded cursor-pointer transition-colors"
                :class="selectedCompIds.length > 0 ? 'text-rose-400 hover:bg-rose-950' : 'text-slate-600 cursor-not-allowed'"
                title="删除选中图元 (Del)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              v-if="activeTool === 'draw-polyline'"
              class="px-3 py-1 rounded-full bg-cyan-950/90 border border-cyan-400 text-cyan-200 text-xs font-mono flex items-center gap-2 shadow-[0_0_10px_rgba(0,242,255,0.2)] animate-pulse"
            >
              <CornerDownRight class="w-3.5 h-3.5 text-cyan-400" />
              <span>折线走线模式：单击画布添加拐点，双击或按Enter完成，按Esc取消</span>
              <button
                v-if="polylineDrawing.points.length >= 2"
                @click="finishPolylineDrawing"
                class="px-2 py-0.5 bg-cyan-500 text-slate-950 font-bold rounded text-[10px] cursor-pointer"
              >
                完成
              </button>
            </div>

            <div
              v-else-if="activeTool === 'draw-arrow'"
              class="px-3 py-1 rounded-full bg-cyan-950/90 border border-cyan-400 text-cyan-200 text-xs font-mono flex items-center gap-2 shadow-[0_0_10px_rgba(0,242,255,0.2)] animate-pulse"
            >
              <MoveRight class="w-3.5 h-3.5 text-cyan-400" />
              <span>导向箭头模式：单击确定起点，移动查看拉伸，再次单击完成</span>
              <button
                @click="activeTool = 'select'; arrowDrawing.active = false;"
                class="px-2 py-0.5 bg-slate-800 text-slate-300 hover:text-white rounded text-[10px] cursor-pointer"
              >
                取消
              </button>
            </div>

            <div v-else class="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 hidden xl:flex">
              <MousePointer class="w-3.5 h-3.5 text-cyan-400" />
              <span>支持右键菜单 · 快捷键 Ctrl+C/V/D/Z · 方向键微调</span>
            </div>
          </div>

          <!-- Right: Grid Snap & Re-snap & Zoom & Save -->
          <div class="flex items-center gap-2">
            <!-- Grid Point Size Selector (吸附都在点上) -->
            <div class="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-md border border-slate-800 text-[11px] font-mono">
              <span class="text-slate-400">点格:</span>
              <select
                v-model.number="editorGridSize"
                class="bg-transparent text-cyan-300 focus:outline-hidden cursor-pointer"
                title="选择点格密度 (吸附点位于点格交点上)"
              >
                <option :value="10">10px</option>
                <option :value="20">20px (推荐)</option>
                <option :value="30">30px</option>
                <option :value="40">40px</option>
                <option :value="50">50px</option>
              </select>
            </div>

            <!-- Manual Re-snap to Grid Button (当网格密度变化时一键重新吸附到点格) -->
            <button
              @click="handleReSnapToGrid"
              class="px-2.5 py-1 rounded-md bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
              title="一键将当前状态所有图元重新吸附至点格"
            >
              <RefreshCw class="w-3 h-3 text-cyan-400" />
              <span>重新吸附</span>
            </button>

            <!-- Grid and Snap Toggles -->
            <button
              @click="showEditorGrid = !showEditorGrid"
              class="p-1.5 rounded-md border text-xs cursor-pointer"
              :class="showEditorGrid ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40' : 'bg-slate-900 text-slate-500 border-slate-800'"
              title="显示点格"
            >
              <Grid class="w-3.5 h-3.5" />
            </button>

            <button
              @click="snapToEditorGrid = !snapToEditorGrid"
              class="p-1.5 rounded-md border text-xs cursor-pointer"
              :class="snapToEditorGrid ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40' : 'bg-slate-900 text-slate-500 border-slate-800'"
              title="点格吸附开/关 (对齐到点而非格中间)"
            >
              <Magnet class="w-3.5 h-3.5" />
            </button>

            <!-- Zoom -->
            <div class="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-md border border-slate-800 text-[11px] font-mono">
              <button @click="canvasZoom = Math.max(0.3, Number((canvasZoom - 0.1).toFixed(2)))" class="hover:text-white cursor-pointer px-1">-</button>
              <span class="text-cyan-300 w-10 text-center">{{ Math.round(canvasZoom * 100) }}%</span>
              <button @click="canvasZoom = Math.min(3.0, Number((canvasZoom + 0.1).toFixed(2)))" class="hover:text-white cursor-pointer px-1">+</button>
            </div>

            <!-- Auto Crop Button -->
            <button
              @click="handleAutoCropSymbol"
              class="px-2.5 py-1 rounded-md bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-500/50 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
              title="自动截取图元最小包围盒并紧凑归零"
            >
              <Box class="w-3.5 h-3.5" />
              <span>截取包围盒</span>
            </button>

            <!-- Save & Publish -->
            <button
              @click="handleSaveSymbol(false)"
              class="px-3 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
            >
              <Check class="w-3.5 h-3.5" />
              <span>保存入库</span>
            </button>

            <!-- Save & Place on Canvas -->
            <button
              @click="handleSaveSymbol(true)"
              class="px-3 py-1 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md transition-all font-mono"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>保存并放置</span>
            </button>
          </div>
        </div>

        <!-- ==================== MULTI-STATE MANAGEMENT RIBBON (排版美化 & 唯一整数值编辑) ==================== -->
        <div class="bg-[#050914] border-b border-slate-800/80 px-4 py-2 flex items-center justify-between z-10 select-none">
          <!-- Left: State selector pills -->
          <div class="flex items-center gap-2 overflow-x-auto custom-scrollbar">
            <div class="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-300 shrink-0 mr-2">
              <Layers class="w-3.5 h-3.5 text-cyan-400" />
              <span>图元多状态调度器 (共 {{ editorStates.length }} 态):</span>
            </div>

            <!-- State Pill Buttons -->
            <div class="flex items-center gap-1.5">
              <div
                v-for="st in editorStates"
                :key="st.id"
                @click="activeStateId = st.id; selectedCompIds = [];"
                class="px-3 py-1 rounded-lg text-xs font-mono flex items-center gap-2 cursor-pointer transition-all border"
                :class="activeStateId === st.id 
                  ? 'bg-cyan-950/80 text-cyan-200 border-cyan-400 shadow-[0_0_12px_rgba(0,242,255,0.25)] font-bold' 
                  : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'"
              >
                <span>{{ st.name }}</span>
                <span
                  class="px-1.5 py-0.2 rounded text-[10px] font-bold"
                  :class="activeStateId === st.id ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'"
                >
                  数值: {{ st.stateValue }}
                </span>
              </div>

              <!-- Add New State -->
              <button
                @click="handleAddState"
                class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/40 text-cyan-300 text-xs font-mono flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                title="新增状态 (自动分配下一个唯一可用整数)"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>新增状态</span>
              </button>
            </div>
          </div>

          <!-- Right: Active State Detail Property Editor (Editable Name & Unique Integer) -->
          <div v-if="activeState" class="flex items-center gap-3 shrink-0 pl-4 border-l border-slate-800">
            <div class="flex items-center gap-1.5 text-xs font-mono">
              <span class="text-slate-400 text-[11px]">当前名称:</span>
              <input
                v-model="activeState.name"
                type="text"
                placeholder="状态名称"
                class="w-32 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded px-2 py-0.5 text-xs text-cyan-300 font-mono focus:outline-hidden"
              />
            </div>

            <!-- Unique Integer Input Field with Validation -->
            <div class="flex items-center gap-1.5 bg-slate-950 border border-slate-700 px-2 py-1 rounded-md">
              <span class="text-[11px] text-cyan-400 font-mono font-medium">状态唯一整数值:</span>
              <input
                type="number"
                step="1"
                :value="activeState.stateValue"
                @change="handleUpdateStateValue(activeStateId, ($event.target as HTMLInputElement).value)"
                class="w-16 bg-slate-900 border border-slate-600 focus:border-cyan-400 rounded px-1.5 py-0.5 text-center font-mono font-bold text-amber-300 text-xs focus:outline-hidden"
                title="每个状态映射唯一整数（例如：0=分闸，1=合闸，2=故障，3=试验）"
              />
            </div>

            <!-- Duplicate and Delete Current State -->
            <div class="flex items-center gap-1">
              <button
                @click="handleDuplicateState"
                class="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 cursor-pointer"
                title="复制当前状态"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
              <button
                v-if="editorStates.length > 1"
                @click="handleDeleteState(activeStateId)"
                class="p-1 rounded bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 cursor-pointer"
                title="删除当前状态"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Main Body of Canvas Editor: Left Palette + Center Infinite Canvas + Right Inspector -->
        <div class="flex-1 flex overflow-hidden">
          <!-- ==================== LEFT PALETTE: RICH PRIMITIVES LIBRARY (NO FLOATING MENU) ==================== -->
          <div class="w-72 bg-[#060b18] border-r border-slate-800/80 flex flex-col p-3 gap-2.5 overflow-y-auto custom-scrollbar select-none z-10">
            <!-- Palette Header -->
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div class="text-xs font-bold text-cyan-300 font-mono flex items-center gap-1.5">
                <Layers class="w-4 h-4 text-cyan-400" />
                <span>基础构成图元库</span>
              </div>
              <span class="text-[10px] font-mono text-slate-500">拖拽或点击添加</span>
            </div>

            <!-- Category Filter Tabs -->
            <div class="grid grid-cols-3 gap-1 text-[11px] font-mono">
              <button
                @click="primitiveCategory = 'all'"
                class="px-2 py-1 rounded text-center transition-colors cursor-pointer"
                :class="primitiveCategory === 'all' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white'"
              >
                全部
              </button>
              <button
                @click="primitiveCategory = 'geometry'"
                class="px-2 py-1 rounded text-center transition-colors cursor-pointer"
                :class="primitiveCategory === 'geometry' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white'"
              >
                基础几何
              </button>
              <button
                @click="primitiveCategory = 'wires'"
                class="px-2 py-1 rounded text-center transition-colors cursor-pointer"
                :class="primitiveCategory === 'wires' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white'"
              >
                走线连线
              </button>
              <button
                @click="primitiveCategory = 'controls'"
                class="px-2 py-1 rounded text-center transition-colors cursor-pointer"
                :class="primitiveCategory === 'controls' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white'"
              >
                标注控制
              </button>
              <button
                @click="primitiveCategory = 'electrical'"
                class="px-2 py-1 rounded text-center transition-colors cursor-pointer col-span-2"
                :class="primitiveCategory === 'electrical' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white'"
              >
                电气微元
              </button>
            </div>

            <!-- Search input -->
            <div class="relative">
              <Search class="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                v-model="primitiveSearch"
                type="text"
                placeholder="搜索基础图元..."
                class="w-full pl-7 pr-2.5 py-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-lg text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-hidden"
              />
            </div>

            <!-- Primitives Card List -->
            <div class="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-0.5">
              <div
                v-for="item in filteredPrimitives"
                :key="item.type"
                :draggable="item.type !== 'draw-polyline' && item.type !== 'draw-arrow'"
                @dragstart="handlePrimitiveDragStart($event, item)"
                @click="handlePrimitiveClick(item)"
                class="group p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 relative"
                :class="[
                  (activeTool === 'draw-polyline' && item.type === 'draw-polyline') || (activeTool === 'draw-arrow' && item.type === 'draw-arrow')
                    ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(0,242,255,0.25)]'
                    : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-cyan-500/40'
                ]"
              >
                <!-- Icon badge -->
                <div
                  class="w-8 h-8 rounded-lg bg-[#040812] border flex items-center justify-center shrink-0 transition-colors"
                  :class="[
                    (activeTool === 'draw-polyline' && item.type === 'draw-polyline') || (activeTool === 'draw-arrow' && item.type === 'draw-arrow')
                      ? 'border-cyan-400 text-cyan-300'
                      : 'border-cyan-500/25 text-cyan-400 group-hover:border-cyan-400'
                  ]"
                >
                  <component :is="getPrimitiveIcon(item.iconName)" class="w-4 h-4" />
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span
                      class="text-xs font-mono font-bold truncate transition-colors"
                      :class="[
                        (activeTool === 'draw-polyline' && item.type === 'draw-polyline') || (activeTool === 'draw-arrow' && item.type === 'draw-arrow')
                          ? 'text-cyan-300'
                          : 'text-slate-200 group-hover:text-cyan-300'
                      ]"
                    >
                      {{ item.name }}
                    </span>
                    <span
                      v-if="item.type === 'draw-polyline' || item.type === 'draw-arrow'"
                      class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold"
                      :class="activeTool === item.type ? 'bg-cyan-500 text-slate-950 animate-pulse' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'"
                    >
                      {{ activeTool === item.type ? '绘制中' : '矢量交互' }}
                    </span>
                    <span
                      v-else
                      class="text-[9px] text-slate-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      可拖拽
                    </span>
                  </div>

                  <p class="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                    {{ item.description }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Auto Crop Bounding Box Info Card -->
            <div class="bg-slate-950/90 border border-slate-800 p-2.5 rounded-lg text-[10px] space-y-1 font-mono text-slate-400 shrink-0">
              <div class="text-cyan-300 font-bold flex items-center justify-between">
                <span class="flex items-center gap-1">
                  <Box class="w-3 h-3" />
                  <span>截取包围盒尺寸</span>
                </span>
                <span class="text-slate-500">点格 {{ editorGridSize }}px</span>
              </div>
              <div>宽: <strong class="text-white">{{ currentBoundingBox.width }} px</strong> · 高: <strong class="text-white">{{ currentBoundingBox.height }} px</strong></div>
              <div class="text-[9px] text-slate-500 pt-1 border-t border-slate-800">
                吸附于点格交点 · 方向键1px微调 · 密度变动可点击「重新吸附」
              </div>
            </div>
          </div>

          <!-- ==================== CENTER: INFINITE CANVAS WORKSPACE (DOT GRID) ==================== -->
          <div
            id="workshop-canvas-bg"
            class="flex-1 relative overflow-hidden select-none"
            :style="{
              backgroundColor: '#02050b',
              backgroundImage: showEditorGrid 
                ? `radial-gradient(circle, rgba(0, 242, 255, 0.22) 1.2px, transparent 1.2px)` 
                : 'none',
              backgroundSize: `${editorGridSize * canvasZoom}px ${editorGridSize * canvasZoom}px`,
              backgroundPosition: `${canvasPan.x - (editorGridSize * canvasZoom) / 2}px ${canvasPan.y - (editorGridSize * canvasZoom) / 2}px`,
              cursor: activeCursor
            }"
            @wheel="handleCanvasWheel"
            @mousedown="handleCanvasMouseDown"
            @mousemove="handleCanvasMouseMove"
            @mouseup="handleCanvasMouseUp"
            @dblclick="handleCanvasDblClick"
            @contextmenu="handleCanvasContextMenu"
            @dragover.prevent
            @drop.prevent="handleCanvasDrop"
          >
            <!-- Canvas Scaled & Panned Content Container -->
            <div
              id="workshop-canvas-inner"
              class="absolute origin-top-left"
              :style="{
                transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`
              }"
            >
              <!-- Real-time Bounding Box Visual Outline (自动截取边界框预览) -->
              <div
                v-if="currentEditingComponents.length > 0"
                class="absolute border border-dashed border-cyan-400/60 rounded pointer-events-none transition-all duration-75"
                :style="{
                  left: `${currentBoundingBox.minX - 6}px`,
                  top: `${currentBoundingBox.minY - 6}px`,
                  width: `${currentBoundingBox.width + 12}px`,
                  height: `${currentBoundingBox.height + 12}px`
                }"
              >
                <div class="absolute -top-5 left-0 px-1.5 py-0.2 rounded bg-cyan-950/90 border border-cyan-500/40 text-[9px] text-cyan-300 font-mono whitespace-nowrap">
                  自动封装尺寸: {{ currentBoundingBox.width }} × {{ currentBoundingBox.height }} px
                </div>
              </div>

              <!-- Render All Basic Primitives in Current State -->
              <div
                v-for="comp in currentEditingComponents"
                :key="comp.id"
                class="absolute cursor-move group select-none"
                :class="{
                  'ring-2 ring-cyan-400 ring-offset-1 ring-offset-transparent': selectedCompIds.includes(comp.id)
                }"
                :style="{
                  left: `${comp.x}px`,
                  top: `${comp.y}px`,
                  width: `${comp.width}px`,
                  height: `${comp.height}px`,
                  transform: comp.rotation ? `rotate(${comp.rotation}deg)` : 'none',
                  zIndex: comp.zIndex || 1
                }"
                @mousedown.stop="handleCompMouseDown(comp, $event)"
                @contextmenu.stop="handleCompContextMenu(comp, $event)"
              >
                <WidgetRenderer :component="comp" />

                <!-- Interactive 8-point Stretch Handles & Rotation Handle -->
                <template v-if="selectedCompIds.includes(comp.id)">
                  <!-- 8 Interactive Resize Handles -->
                  <div
                    @mousedown.stop="handleStartResizeComp(comp, 'nw', $event)"
                    class="pointer-events-auto absolute -top-1.5 -left-1.5 w-3 h-3 bg-cyan-400 border border-slate-950 cursor-nwse-resize rounded-[2px] z-30 shadow hover:scale-125 transition-transform"
                    title="拉伸 (左上角)"
                  />
                  <div
                    @mousedown.stop="handleStartResizeComp(comp, 'n', $event)"
                    class="pointer-events-auto absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-400 border border-slate-950 cursor-ns-resize rounded-[2px] z-30 shadow hover:scale-125 transition-transform"
                    title="拉伸 (上边)"
                  />
                  <div
                    @mousedown.stop="handleStartResizeComp(comp, 'ne', $event)"
                    class="pointer-events-auto absolute -top-1.5 -right-1.5 w-3 h-3 bg-cyan-400 border border-slate-950 cursor-nesw-resize rounded-[2px] z-30 shadow hover:scale-125 transition-transform"
                    title="拉伸 (右上角)"
                  />
                  <div
                    @mousedown.stop="handleStartResizeComp(comp, 'e', $event)"
                    class="pointer-events-auto absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-cyan-400 border border-slate-950 cursor-ew-resize rounded-[2px] z-30 shadow hover:scale-125 transition-transform"
                    title="拉伸 (右边)"
                  />
                  <div
                    @mousedown.stop="handleStartResizeComp(comp, 'se', $event)"
                    class="pointer-events-auto absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-cyan-400 border border-slate-950 cursor-nwse-resize rounded-[2px] z-30 shadow hover:scale-125 transition-transform"
                    title="拉伸 (右下角)"
                  />
                  <div
                    @mousedown.stop="handleStartResizeComp(comp, 's', $event)"
                    class="pointer-events-auto absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-400 border border-slate-950 cursor-ns-resize rounded-[2px] z-30 shadow hover:scale-125 transition-transform"
                    title="拉伸 (下边)"
                  />
                  <div
                    @mousedown.stop="handleStartResizeComp(comp, 'sw', $event)"
                    class="pointer-events-auto absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-cyan-400 border border-slate-950 cursor-nesw-resize rounded-[2px] z-30 shadow hover:scale-125 transition-transform"
                    title="拉伸 (左下角)"
                  />
                  <div
                    @mousedown.stop="handleStartResizeComp(comp, 'w', $event)"
                    class="pointer-events-auto absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-cyan-400 border border-slate-950 cursor-ew-resize rounded-[2px] z-30 shadow hover:scale-125 transition-transform"
                    title="拉伸 (左边)"
                  />

                  <!-- Rotation Handle -->
                  <div
                    @mousedown.stop="handleStartRotateComp(comp, $event)"
                    class="pointer-events-auto absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-30 group/rot"
                    title="旋转角度 (按住拖拽，Shift 键以 15° 步长对齐)"
                  >
                    <div class="w-4 h-4 rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow group-hover/rot:scale-110 group-hover/rot:border-white transition-transform">
                      <RotateCw class="w-2.5 h-2.5 stroke-[2.5]" />
                    </div>
                    <div class="w-[1.5px] h-3 bg-cyan-400" />
                  </div>
                </template>
              </div>

              <!-- ==================== Interactive Polyline Drawing Live SVG Overlay ==================== -->
              <svg
                v-if="activeTool === 'draw-polyline'"
                class="absolute top-0 left-0 pointer-events-none z-50 overflow-visible"
                style="width: 1px; height: 1px;"
              >
                <template v-if="polylineDrawing.points.length > 0">
                  <!-- Rubber-band line from last point to current mouse -->
                  <line
                    :x1="polylineDrawing.points[polylineDrawing.points.length - 1].x"
                    :y1="polylineDrawing.points[polylineDrawing.points.length - 1].y"
                    :x2="polylineDrawing.currentX"
                    :y2="polylineDrawing.currentY"
                    stroke="#00f2ff"
                    stroke-width="2.5"
                    stroke-dasharray="5 3"
                  />

                  <!-- Connected fixed segments -->
                  <polyline
                    v-if="polylineDrawing.points.length > 1"
                    :points="polylineDrawing.points.map(p => `${p.x},${p.y}`).join(' ')"
                    fill="none"
                    stroke="#00f2ff"
                    stroke-width="3"
                  />

                  <!-- Vertex Circles with numbered badges -->
                  <g v-for="(p, idx) in polylineDrawing.points" :key="idx">
                    <circle
                      :cx="p.x"
                      :cy="p.y"
                      r="5"
                      fill="#00f2ff"
                      stroke="#040810"
                      stroke-width="2"
                    />
                    <rect
                      :x="p.x + 8"
                      :y="p.y - 18"
                      width="28"
                      height="14"
                      rx="3"
                      fill="#090f1d"
                      fill-opacity="0.9"
                      stroke="#00f2ff"
                      stroke-width="0.8"
                    />
                    <text
                      :x="p.x + 12"
                      :y="p.y - 8"
                      fill="#00f2ff"
                      font-size="8"
                      font-family="monospace"
                      font-weight="bold"
                    >
                      #{{ idx + 1 }}
                    </text>
                  </g>
                </template>

                <!-- Current moving cursor vertex indicator (snapped to dot) -->
                <g :transform="`translate(${polylineDrawing.currentX}, ${polylineDrawing.currentY})`">
                  <circle cx="0" cy="0" r="5" fill="#00e5a3" stroke="#040810" stroke-width="2" />
                  <circle cx="0" cy="0" r="10" fill="none" stroke="#00e5a3" stroke-width="1.5" stroke-dasharray="3 3" />
                </g>
              </svg>

              <!-- ==================== Interactive Arrow Drawing Live SVG Overlay ==================== -->
              <svg
                v-if="activeTool === 'draw-arrow'"
                class="absolute top-0 left-0 pointer-events-none z-50 overflow-visible"
                style="width: 1px; height: 1px;"
              >
                <defs>
                  <marker
                    id="preview-arrow-head-ws"
                    markerWidth="10"
                    markerHeight="10"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L9,3 z" fill="#00f2ff" />
                  </marker>
                </defs>

                <template v-if="arrowDrawing.active">
                  <!-- Outer glowing aura path -->
                  <line
                    :x1="arrowDrawing.startX"
                    :y1="arrowDrawing.startY"
                    :x2="arrowDrawing.currentX"
                    :y2="arrowDrawing.currentY"
                    stroke="#00f2ff"
                    stroke-width="6"
                    stroke-opacity="0.3"
                    stroke-linecap="round"
                  />
                  <!-- Main dashed vector line with arrowhead -->
                  <line
                    :x1="arrowDrawing.startX"
                    :y1="arrowDrawing.startY"
                    :x2="arrowDrawing.currentX"
                    :y2="arrowDrawing.currentY"
                    stroke="#00f2ff"
                    stroke-width="3"
                    stroke-dasharray="5 3"
                    stroke-linecap="round"
                    marker-end="url(#preview-arrow-head-ws)"
                  />
                  <!-- Start vertex circle -->
                  <circle
                    :cx="arrowDrawing.startX"
                    :cy="arrowDrawing.startY"
                    r="5"
                    fill="#00f2ff"
                    stroke="#040810"
                    stroke-width="2"
                  />
                </template>

                <!-- Current moving cursor vertex indicator -->
                <g :transform="`translate(${arrowDrawing.currentX}, ${arrowDrawing.currentY})`">
                  <circle cx="0" cy="0" r="5" fill="#00e5a3" stroke="#040810" stroke-width="2" />
                  <circle cx="0" cy="0" r="10" fill="none" stroke="#00e5a3" stroke-width="1.5" stroke-dasharray="3 3" />
                </g>
              </svg>
            </div>
          </div>

          <!-- ==================== RIGHT SIDEBAR: PROPERTIES & LAYERS INSPECTOR ==================== -->
          <div class="w-68 bg-[#060b18] border-l border-slate-800/80 flex flex-col p-3 gap-3 overflow-y-auto custom-scrollbar font-mono text-xs select-none z-10">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="font-bold text-slate-200">图元属性与图层</span>
              <button
                v-if="selectedCompIds.length > 0"
                @click="handleDeleteSelectedPrimitives"
                class="p-1 rounded hover:bg-rose-950 text-rose-400 cursor-pointer"
                title="删除选中图元"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Selected Component Props -->
            <div v-if="selectedComponent" class="space-y-3">
              <div class="text-[11px] text-cyan-400 font-bold flex items-center gap-1">
                <Sliders class="w-3.5 h-3.5" />
                <span class="truncate">选中: {{ selectedComponent.name }}</span>
              </div>

              <!-- Component Name -->
              <div>
                <label class="text-slate-400 block mb-0.5 text-[11px]">图元名称</label>
                <input
                  type="text"
                  v-model="selectedComponent.name"
                  class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"
                />
              </div>

              <!-- Position & Size -->
              <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <label class="text-slate-400 block mb-0.5">X 坐标 (点格)</label>
                  <input
                    type="number"
                    v-model.number="selectedComponent.x"
                    class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label class="text-slate-400 block mb-0.5">Y 坐标 (点格)</label>
                  <input
                    type="number"
                    v-model.number="selectedComponent.y"
                    class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label class="text-slate-400 block mb-0.5">宽度 W</label>
                  <input
                    type="number"
                    v-model.number="selectedComponent.width"
                    class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label class="text-slate-400 block mb-0.5">高度 H</label>
                  <input
                    type="number"
                    v-model.number="selectedComponent.height"
                    class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <!-- Rotation -->
              <div>
                <label class="text-slate-400 block mb-0.5 text-[11px]">旋转角度 (°)</label>
                <input
                  type="number"
                  v-model.number="selectedComponent.rotation"
                  class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                />
              </div>

              <!-- Styling Props -->
              <div v-if="selectedComponent.style" class="space-y-2 pt-2 border-t border-slate-800 text-[11px]">
                <div>
                  <label class="text-slate-400 block mb-0.5">填充颜色</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="color"
                      v-model="selectedComponent.style.fill"
                      class="w-7 h-7 bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      v-model="selectedComponent.style.fill"
                      class="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label class="text-slate-400 block mb-0.5">描边颜色</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="color"
                      v-model="selectedComponent.style.stroke"
                      class="w-7 h-7 bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      v-model="selectedComponent.style.stroke"
                      class="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-slate-400 block mb-0.5">描边粗细</label>
                    <input
                      type="number"
                      v-model.number="selectedComponent.style.strokeWidth"
                      class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label class="text-slate-400 block mb-0.5">圆角半径</label>
                    <input
                      type="number"
                      v-model.number="selectedComponent.style.borderRadius"
                      class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                    />
                  </div>
                </div>
              </div>

              <!-- Layer Order Actions -->
              <div class="pt-2 border-t border-slate-800">
                <label class="text-slate-400 block mb-1 text-[11px]">图层层级顺序</label>
                <div class="grid grid-cols-2 gap-1.5 text-[10px]">
                  <button @click="handleMoveLayer('up')" class="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-700 text-slate-300 cursor-pointer">
                    上移一层
                  </button>
                  <button @click="handleMoveLayer('down')" class="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-700 text-slate-300 cursor-pointer">
                    下移一层
                  </button>
                  <button @click="handleMoveLayer('top')" class="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-700 text-slate-300 cursor-pointer">
                    置于顶层
                  </button>
                  <button @click="handleMoveLayer('bottom')" class="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-700 text-slate-300 cursor-pointer">
                    置于底层
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="text-center text-slate-500 py-6 text-[11px]">
              点击画布上的基础图元查看并调整属性<br/>
              <span class="text-[10px] text-slate-600 mt-1 block">可使用键盘 ↑ ↓ ← → 键进行 1px 精准微调</span>
            </div>

            <!-- Layer List of Current State -->
            <div class="mt-auto pt-3 border-t border-slate-800 space-y-1.5">
              <div class="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                <span>当前状态图层 ({{ currentEditingComponents.length }})</span>
                <button
                  @click="handleReSnapToGrid"
                  class="text-[10px] text-cyan-400 hover:underline cursor-pointer flex items-center gap-0.5"
                  title="将本状态所有图元对齐到最近点格"
                >
                  <RefreshCw class="w-2.5 h-2.5" />
                  <span>吸附点格</span>
                </button>
              </div>
              <div class="max-h-36 overflow-y-auto custom-scrollbar space-y-1">
                <button
                  v-for="c in currentEditingComponents"
                  :key="c.id"
                  @click="selectedCompIds = [c.id]"
                  class="w-full px-2 py-1 rounded text-left text-[11px] flex items-center justify-between cursor-pointer transition-colors"
                  :class="selectedCompIds.includes(c.id) ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-900'"
                >
                  <span class="truncate">{{ c.name }}</span>
                  <span class="text-[9px] text-slate-500 font-mono">z:{{ c.zIndex || 1 }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== FLOATING WORKSHOP CONTEXT MENU ==================== -->
    <div
      v-if="contextMenu.visible && currentMode === 'editor'"
      class="fixed z-[9999] bg-[#070d1e]/95 backdrop-blur-md border border-cyan-500/30 rounded-xl shadow-2xl py-1.5 min-w-[200px] text-xs font-mono select-none"
      :style="{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`
      }"
      @click.stop
      @contextmenu.prevent
    >
      <!-- Target Primitive Name Header if Right-Clicked on Comp -->
      <div v-if="contextMenu.targetCompId" class="px-3 py-1 text-[10px] text-cyan-400 font-bold border-b border-slate-800/80 mb-1 flex items-center gap-1.5 truncate">
        <Sliders class="w-3 h-3 text-cyan-400 shrink-0" />
        <span class="truncate">{{ currentEditingComponents.find(c => c.id === contextMenu.targetCompId)?.name || '图元组件' }}</span>
      </div>

      <!-- Copy -->
      <button
        @click="handleCopySelected(); closeContextMenu();"
        :disabled="selectedCompIds.length === 0"
        class="w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer"
        :class="selectedCompIds.length > 0 ? 'text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200' : 'text-slate-600 cursor-not-allowed'"
      >
        <span class="flex items-center gap-2">
          <Copy class="w-3.5 h-3.5 text-slate-400" />
          <span>复制</span>
        </span>
        <kbd class="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Ctrl+C</kbd>
      </button>

      <!-- Cut -->
      <button
        @click="handleCutSelected(); closeContextMenu();"
        :disabled="selectedCompIds.length === 0"
        class="w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer"
        :class="selectedCompIds.length > 0 ? 'text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200' : 'text-slate-600 cursor-not-allowed'"
      >
        <span class="flex items-center gap-2">
          <Scissors class="w-3.5 h-3.5 text-slate-400" />
          <span>剪切</span>
        </span>
        <kbd class="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Ctrl+X</kbd>
      </button>

      <!-- Paste -->
      <button
        @click="handlePastePrimitives(contextMenu.canvasX, contextMenu.canvasY); closeContextMenu();"
        :disabled="symbolClipboard.length === 0"
        class="w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer"
        :class="symbolClipboard.length > 0 ? 'text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200' : 'text-slate-600 cursor-not-allowed'"
      >
        <span class="flex items-center gap-2">
          <Clipboard class="w-3.5 h-3.5 text-slate-400" />
          <span>粘贴在此处</span>
        </span>
        <kbd class="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Ctrl+V</kbd>
      </button>

      <!-- Duplicate -->
      <button
        @click="handleDuplicateSelected(); closeContextMenu();"
        :disabled="selectedCompIds.length === 0"
        class="w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer"
        :class="selectedCompIds.length > 0 ? 'text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200' : 'text-slate-600 cursor-not-allowed'"
      >
        <span class="flex items-center gap-2">
          <Copy class="w-3.5 h-3.5 text-cyan-400" />
          <span>创建副本</span>
        </span>
        <kbd class="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Ctrl+D</kbd>
      </button>

      <div class="h-px bg-slate-800/80 my-1 mx-2" />

      <!-- Select All -->
      <button
        @click="handleSelectAll(); closeContextMenu();"
        :disabled="currentEditingComponents.length === 0"
        class="w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer"
        :class="currentEditingComponents.length > 0 ? 'text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200' : 'text-slate-600 cursor-not-allowed'"
      >
        <span class="flex items-center gap-2">
          <CheckSquare class="w-3.5 h-3.5 text-slate-400" />
          <span>全选图元</span>
        </span>
        <kbd class="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">Ctrl+A</kbd>
      </button>

      <!-- Rotate -->
      <button
        @click="handleRotateSelected(90); closeContextMenu();"
        :disabled="selectedCompIds.length === 0"
        class="w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer"
        :class="selectedCompIds.length > 0 ? 'text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200' : 'text-slate-600 cursor-not-allowed'"
      >
        <span class="flex items-center gap-2">
          <RotateCw class="w-3.5 h-3.5 text-slate-400" />
          <span>顺时针旋转 90°</span>
        </span>
        <kbd class="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">R</kbd>
      </button>

      <!-- Snap to Grid -->
      <button
        @click="handleSnapSelectedToGrid(); closeContextMenu();"
        :disabled="selectedCompIds.length === 0"
        class="w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer"
        :class="selectedCompIds.length > 0 ? 'text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200' : 'text-slate-600 cursor-not-allowed'"
      >
        <span class="flex items-center gap-2">
          <Magnet class="w-3.5 h-3.5 text-slate-400" />
          <span>对齐到点格</span>
        </span>
      </button>

      <div class="h-px bg-slate-800/80 my-1 mx-2" />

      <!-- Layer Ordering -->
      <div v-if="selectedCompIds.length > 0" class="space-y-0.5">
        <button
          @click="handleMoveLayer('top'); closeContextMenu();"
          class="w-full px-3 py-1 text-slate-300 hover:bg-slate-800/80 flex items-center justify-between text-left cursor-pointer"
        >
          <span class="flex items-center gap-2">
            <ArrowUp class="w-3 h-3 text-cyan-400" />
            <span>置于顶层</span>
          </span>
          <kbd class="text-[9px] text-slate-500 bg-slate-900 px-1 rounded">Shift+]</kbd>
        </button>
        <button
          @click="handleMoveLayer('bottom'); closeContextMenu();"
          class="w-full px-3 py-1 text-slate-300 hover:bg-slate-800/80 flex items-center justify-between text-left cursor-pointer"
        >
          <span class="flex items-center gap-2">
            <ArrowDown class="w-3 h-3 text-cyan-400" />
            <span>置于底层</span>
          </span>
          <kbd class="text-[9px] text-slate-500 bg-slate-900 px-1 rounded">Shift+[</kbd>
        </button>
        <button
          @click="handleMoveLayer('up'); closeContextMenu();"
          class="w-full px-3 py-1 text-slate-300 hover:bg-slate-800/80 flex items-center justify-between text-left cursor-pointer"
        >
          <span class="flex items-center gap-2">
            <ArrowUp class="w-3 h-3 text-slate-400" />
            <span>上移一层</span>
          </span>
          <kbd class="text-[9px] text-slate-500 bg-slate-900 px-1 rounded">]</kbd>
        </button>
        <button
          @click="handleMoveLayer('down'); closeContextMenu();"
          class="w-full px-3 py-1 text-slate-300 hover:bg-slate-800/80 flex items-center justify-between text-left cursor-pointer"
        >
          <span class="flex items-center gap-2">
            <ArrowDown class="w-3 h-3 text-slate-400" />
            <span>下移一层</span>
          </span>
          <kbd class="text-[9px] text-slate-500 bg-slate-900 px-1 rounded">[</kbd>
        </button>
      </div>

      <div class="h-px bg-slate-800/80 my-1 mx-2" />

      <!-- Delete -->
      <button
        @click="handleDeleteSelectedPrimitives(); closeContextMenu();"
        :disabled="selectedCompIds.length === 0"
        class="w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer"
        :class="selectedCompIds.length > 0 ? 'text-rose-400 hover:bg-rose-950/60 hover:text-rose-200' : 'text-slate-600 cursor-not-allowed'"
      >
        <span class="flex items-center gap-2">
          <Trash2 class="w-3.5 h-3.5 text-rose-400" />
          <span>删除基础图元</span>
        </span>
        <kbd class="text-[10px] text-rose-400/80 bg-rose-950/40 px-1 py-0.5 rounded border border-rose-800/40">Del</kbd>
      </button>
    </div>
  </div>
</template>
