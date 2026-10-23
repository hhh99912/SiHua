<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { 
  Copy, Scissors, Clipboard, Trash2, Layers, CheckSquare, 
  ArrowUpToLine, ArrowDownToLine, ChevronUp, ChevronDown, 
  Lock, Unlock, BookmarkPlus, RotateCw, Radio, Move,
  AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  Crosshair, Sliders, Workflow, Database, Zap,
  Image as ImageIcon
} from 'lucide-vue-next';
import { ScreenComponent, ScreenConfig, DatasetConfig } from '../types';
import WidgetRenderer from './widgets/WidgetRenderer.vue';
import Ruler from './Ruler.vue';
import { useCanvasEngine } from '../composables/useCanvasEngine';
import { 
  isLineComponent, 
  isCyberBorderComponent,
  isHollowComponent, 
  getStraightLinePoints, 
  getPolylinePoints 
} from '../utils/linePathUtils';
import { isComponentBoundToControlOrRegulation } from '../utils/scadaClient';

interface Props {
  screen: ScreenConfig;
  components: ScreenComponent[];
  selectedIds: string[];
  zoom: number;
  datasets: DatasetConfig[];
  drawTool: string;
  activeComponentDef?: any;
  canPaste?: boolean;
  showGrid?: boolean;
  gridSize?: number;
  snapToGrid?: boolean;
  orthogonalLock?: boolean;
  showRuler?: boolean;
  drawingPreset?: {
    stroke: string;
    fill: string;
    strokeWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

const props = withDefaults(defineProps<Props>(), {
  drawTool: 'select',
  canPaste: false,
  showGrid: true,
  gridSize: 40,
  snapToGrid: false,
  orthogonalLock: false,
  showRuler: false,
  drawingPreset: () => ({
    stroke: '#00f2ff',
    fill: 'transparent',
    strokeWidth: 2,
    lineStyle: 'solid',
    fontSize: 14,
    fontWeight: 'bold'
  })
});

const emit = defineEmits<{
  (e: 'update:drawTool', tool: string): void;
  (e: 'update:zoom', zoom: number): void;
  (e: 'update:screen', screen: ScreenConfig): void;
  (e: 'select', ids: string[]): void;
  (e: 'update:component', comp: ScreenComponent): void;
  (e: 'update:components', comps: ScreenComponent[]): void;
  (e: 'add:component:at', def: any, x: number, y: number): void;
  (e: 'copy', comps: ScreenComponent[]): void;
  (e: 'cut', comps: ScreenComponent[]): void;
  (e: 'paste', position?: { x: number; y: number }): void;
  (e: 'duplicate', comps: ScreenComponent[]): void;
  (e: 'delete', ids: string[]): void;
  (e: 'bring:front', id: string | string[]): void;
  (e: 'send:back', id: string | string[]): void;
  (e: 'move:up', id: string | string[]): void;
  (e: 'move:down', id: string | string[]): void;
  (e: 'save:symbol', comps: ScreenComponent[]): void;
  (e: 'group', comps?: ScreenComponent[]): void;
  (e: 'ungroup', comp: ScreenComponent): void;
  (e: 'align', type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v'): void;
  (e: 'finish:draw'): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'open:control-modal', payload?: any): void;
  (e: 'open:property-inspector'): void;
  (e: 'open:data-association', component?: ScreenComponent): void;
  (e: 'open:batch-association', payload: { components: ScreenComponent[]; category: 'yc' | 'yx' }): void;
  (e: 'commit:history'): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const infinitePlaneRef = ref<HTMLDivElement | null>(null);
const canvasWrapperRef = ref<HTMLDivElement | null>(null);
const mousePos = ref({ x: 0, y: 0, rawX: 0, rawY: 0 });

// Shared Canvas Engine for Pan/Zoom, Grid Snapping & Crop
const {
  zoom,
  panOffset,
  isPanning,
  showGrid,
  gridSize,
  snapToGrid,
  orthogonalLock,
  clientToCanvas,
  calculateOrthogonalPoint,
  handleWheelZoom,
  startPan,
  updatePan,
  endPan,
  centerCanvasInViewport,
  fitCanvasToViewport,
  getContentBoundingBox,
  calculateComponentsBoundingBox,
  fitAndCenterContentInViewport,
  snapAllToGrid,
  centerAllInCanvas,
  alignContentToOrigin,
  normalizeNegativeCoordinates,
  cropCanvasToContent
} = useCanvasEngine({
  initialZoom: props.zoom || 1,
  initialGridSize: props.gridSize || 40,
  initialShowGrid: props.showGrid ?? true,
  initialSnapToGrid: props.snapToGrid ?? false,
  initialOrthogonalLock: props.orthogonalLock ?? false
});

// Component Click-to-Place State (单机选中后在屏幕自己确定起始和终止点)
const placeDrawing = ref<{
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  def?: any;
}>({
  active: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  def: null
});

// Sync prop changes into canvas engine
watch(() => props.zoom, (val) => {
  if (val !== undefined && val > 0 && val !== zoom.value) {
    zoom.value = val;
  }
});

// 保持抓手与节点在物理屏幕上的绝对恒定像素尺寸 (不随画面缩放而放大或缩小，无论放大到 300% 还是 500%，抓手均保持标准手感，绝不遮挡小组件)
const invZoom = computed(() => {
  const z = Number(props.zoom) || Number(zoom.value) || 1;
  return z > 0 ? (1 / z) : 1;
});
watch(() => props.showGrid, (val) => { if (val !== undefined) showGrid.value = val; });
watch(() => props.gridSize, (val) => { if (val !== undefined) gridSize.value = val; });
watch(() => props.snapToGrid, (val) => { if (val !== undefined) snapToGrid.value = val; });
watch(() => props.orthogonalLock, (val) => { if (val !== undefined) orthogonalLock.value = val; });
watch(() => props.drawTool, (newTool) => {
  suppressNextCanvasClick.value = false;
  lastInteractionTime.value = 0;
  if (newTool === 'draw-polyline') {
    emit('select', []);
    isDragging.value = false;
    isResizing.value = false;
    isRotating.value = false;
    isSelectingMarquee.value = false;
    arrowDrawing.value.active = false;
    placeDrawing.value.active = false;
    polylineDrawing.value = {
      active: false,
      points: [],
      currentX: mousePos.value.x,
      currentY: mousePos.value.y
    };
  } else if (newTool === 'draw-arrow') {
    emit('select', []);
    isDragging.value = false;
    isResizing.value = false;
    isRotating.value = false;
    isSelectingMarquee.value = false;
    polylineDrawing.value.active = false;
    polylineDrawing.value.points = [];
    placeDrawing.value.active = false;
    arrowDrawing.value = {
      active: false,
      startX: mousePos.value.x,
      startY: mousePos.value.y,
      currentX: mousePos.value.x,
      currentY: mousePos.value.y
    };
  } else if (newTool === 'place-component') {
    emit('select', []);
    isDragging.value = false;
    isResizing.value = false;
    isRotating.value = false;
    isSelectingMarquee.value = false;
    polylineDrawing.value.active = false;
    polylineDrawing.value.points = [];
    arrowDrawing.value.active = false;
    placeDrawing.value = {
      active: false,
      startX: mousePos.value.x,
      startY: mousePos.value.y,
      currentX: mousePos.value.x,
      currentY: mousePos.value.y,
      def: props.activeComponentDef
    };
  } else {
    polylineDrawing.value.active = false;
    polylineDrawing.value.points = [];
    arrowDrawing.value.active = false;
    placeDrawing.value.active = false;
  }
});


// Space key pan state
const isSpacePressed = ref(false);

// Multi-selection Box Drag (拉框多选)
const isSelectingMarquee = ref(false);
const hasMovedMarquee = ref(false);
const suppressNextCanvasClick = ref(false);
const lastInteractionTime = ref(0);
const marqueeBox = ref<{ startX: number; startY: number; x: number; y: number; width: number; height: number }>({
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
  width: 0,
  height: 0
});

let cachedMarqueeAABBs: Array<{ id: string; minX: number; maxX: number; minY: number; maxY: number }> = [];

// Dragging & Resizing & Rotating state
const isDragging = ref(false);
const isDragCandidate = ref(false);
let pendingDragSelSet = new Set<string>();
const hasMovedDrag = ref(false);
let dragOffset = { dx: 0, dy: 0 };
const dragStartPositions = ref<Map<string, { x: number; y: number }>>(new Map());
const dragStartMouse = ref({ x: 0, y: 0 });

// 极速 Compositor 零重绘图元直接拖拽节点缓存
interface DragNodeItem {
  el: HTMLElement;
  baseTransform: string;
}
let cachedDragNodes: DragNodeItem[] = [];

// 仅在真实发生超过 3px 的鼠标位移时才批量提升 willChange 与收集 DOM，彻底杜绝单纯点击导致的文字模糊与微晃
const collectDragNodes = () => {
  cachedDragNodes = [];
  if (canvasWrapperRef.value && pendingDragSelSet.size > 0) {
    pendingDragSelSet.forEach(cid => {
      const els = canvasWrapperRef.value!.querySelectorAll<HTMLElement>(`[data-component-id="${cid}"]`);
      els.forEach(el => {
        const targetComp = props.components.find(c => c.id === cid);
        const rot = targetComp?.rotation || 0;
        const baseTransform = rot ? `rotate(${rot}deg)` : '';
        el.style.willChange = 'transform';
        cachedDragNodes.push({ el, baseTransform });
      });
    });
    const groupBbox = canvasWrapperRef.value.querySelector<HTMLElement>('.selected-group-bbox');
    if (groupBbox) {
      groupBbox.style.willChange = 'transform';
      cachedDragNodes.push({ el: groupBbox, baseTransform: '' });
    }
  }
};

const isResizing = ref(false);
const hasMovedResize = ref(false);
const resizeHandle = ref<string | null>(null);
const resizeStart = ref<{ mouseX: number; mouseY: number; x: number; y: number; width: number; height: number; fontSize?: number }>({ 
  mouseX: 0, 
  mouseY: 0, 
  x: 0, 
  y: 0, 
  width: 0, 
  height: 0,
  fontSize: 16
});

const isRotating = ref(false);
const hasMovedRotate = ref(false);
const rotateStart = ref({ cx: 0, cy: 0, initialAngle: 0, startRotation: 0 });

// Line / Polyline / Arrow Vertex Node Drag & Stretch State
const isDraggingVertex = ref(false);
const hasMovedVertex = ref(false);
const activeVertexCompId = ref<string | null>(null);
const activeVertexIdx = ref<number | null>(null);
const vertexDragStart = ref<{
  mouseX: number;
  mouseY: number;
  compX: number;
  compY: number;
  compW: number;
  compH: number;
  points: Array<{ x: number; y: number }>;
}>({
  mouseX: 0,
  mouseY: 0,
  compX: 0,
  compY: 0,
  compW: 0,
  compH: 0,
  points: []
});

// Interactive Drawing Tool State (折线走线绘制)
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

// Interactive Drawing Tool State (箭头走线绘制)
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

const getPolylinePreviewPoints = () => {
  if (!polylineDrawing.value.points || polylineDrawing.value.points.length === 0) return '';
  const pts = polylineDrawing.value.points.map(p => `${p.x},${p.y}`).join(' ');
  return `${pts} ${polylineDrawing.value.currentX},${polylineDrawing.value.currentY}`;
};

const isBorderComponent = (comp: ScreenComponent) => {
  return comp.category === 'decoration' ||
         comp.type === 'deco-border-neon' ||
         comp.type === 'deco-border-tech' ||
         comp.type === 'deco-hazard-stripe' ||
         comp.type === 'deco-mech-panel' ||
         comp.type.startsWith('deco-border');
};

// Soft, Comfortable SCADA Dot Grid (Pleasantly visible without glare)
const effectiveGridColor = computed(() => {
  const col = props.screen.gridColor;
  if (!col || col.includes('0.05') || col.includes('0.08') || col.includes('0.45') || col.includes('0.75')) {
    return 'rgba(0, 242, 255, 0.22)';
  }
  return col;
});

// 防止双击完成绘制时的残留点击事件引发幽灵折线/箭头
const lastFinishDrawTime = ref<number>(0);

// 数学级精确对齐的背景网格边界（严格按 gridSize 的整数倍扩充，确保网格交点与画布坐标绝对 1:1 重合）
const gridSvgBounds = computed(() => {
  const gs = gridSize.value || 40;
  const pad = Math.ceil(8000 / gs) * gs;
  const w = (props.screen?.width || 1920) + pad * 2;
  const h = (props.screen?.height || 1080) + pad * 2;
  return {
    x: -pad,
    y: -pad,
    width: w,
    height: h
  };
});

// Context Menu
const contextMenu = ref<{ visible: boolean; x: number; y: number; canvasX: number; canvasY: number; targetCompId: string | null }>({
  visible: false,
  x: 0,
  y: 0,
  canvasX: 0,
  canvasY: 0,
  targetCompId: null
});

// Calculate Canvas coordinates from Client mouse coordinates using the infinite plane element
const getCanvasCoords = (clientX: number, clientY: number, forceRaw = false) => {
  const targetElement = infinitePlaneRef.value || containerRef.value;
  return clientToCanvas(clientX, clientY, targetElement, forceRaw, props.zoom);
};

// Calculate component exact Axis-Aligned Bounding Box (AABB) taking rotation into account
const getComponentAABB = (c: ScreenComponent) => {
  const x = c.x ?? 0;
  const y = c.y ?? 0;
  const w = Math.max(1, c.width ?? 0);
  const h = Math.max(1, c.height ?? 0);

  if (!c.rotation || c.rotation % 360 === 0) {
    return {
      minX: x,
      minY: y,
      maxX: x + w,
      maxY: y + h
    };
  }

  const rad = (c.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const rotatedHalfW = (w / 2) * cos + (h / 2) * sin;
  const rotatedHalfH = (w / 2) * sin + (h / 2) * cos;
  const centerX = x + w / 2;
  const centerY = y + h / 2;

  return {
    minX: centerX - rotatedHalfW,
    minY: centerY - rotatedHalfH,
    maxX: centerX + rotatedHalfW,
    maxY: centerY + rotatedHalfH
  };
};

// Live Component Placement Real-Time Visual Preview Component Object (用户拉框确定起止点时实时同步显示真实图形)
const placementPreviewComponent = computed<ScreenComponent | null>(() => {
  if (props.drawTool !== 'place-component' || !placeDrawing.value.active) {
    return null;
  }
  const def = placeDrawing.value.def || props.activeComponentDef;
  if (!def) return null;

  const is1to1 = def.type === 'draw-circle' || def.type === 'draw-square';
  const rawW = Math.abs(placeDrawing.value.currentX - placeDrawing.value.startX);
  const rawH = Math.abs(placeDrawing.value.currentY - placeDrawing.value.startY);
  let w = Math.max(6, rawW);
  let h = Math.max(6, rawH);
  let minX = Math.min(placeDrawing.value.startX, placeDrawing.value.currentX);
  let minY = Math.min(placeDrawing.value.startY, placeDrawing.value.currentY);

  if (is1to1) {
    const size = Math.max(w, h);
    w = size;
    h = size;
    minX = placeDrawing.value.currentX >= placeDrawing.value.startX ? placeDrawing.value.startX : placeDrawing.value.startX - size;
    minY = placeDrawing.value.currentY >= placeDrawing.value.startY ? placeDrawing.value.startY : placeDrawing.value.startY - size;
  }

  return {
    id: 'placement-live-preview-temp',
    name: def.name || '图元',
    type: def.type,
    category: def.category || 'basic',
    x: minX,
    y: minY,
    width: w,
    height: h,
    rotation: 0,
    zIndex: 99999,
    locked: false,
    visible: true,
    states: def.states ? JSON.parse(JSON.stringify(def.states)) : undefined,
    activeState: def.activeState || (def.states?.[0]?.id ?? '1'),
    children: def.children ? JSON.parse(JSON.stringify(def.children)) : (def.states?.[0]?.children ? JSON.parse(JSON.stringify(def.states[0].children)) : undefined),
    style: {
      ...JSON.parse(JSON.stringify(def.style || def.defaultStyle || { fill: '#00f2ff', fillOpacity: 0.15, stroke: '#00f2ff', strokeWidth: 2 })),
      ...(props.drawingPreset ? {
        stroke: props.drawingPreset.stroke || '#00f2ff',
        borderColor: props.drawingPreset.stroke || '#00f2ff',
        ...(props.drawingPreset.fill !== undefined ? { fill: props.drawingPreset.fill, bgColor: props.drawingPreset.fill } : {}),
        strokeWidth: props.drawingPreset.strokeWidth || 2,
        borderWidth: props.drawingPreset.strokeWidth || 2,
        lineStyle: props.drawingPreset.lineStyle || 'solid'
      } : {})
    },
    animation: def.animation ? JSON.parse(JSON.stringify(def.animation)) : (def.defaultAnimation ? JSON.parse(JSON.stringify(def.defaultAnimation)) : undefined),
    data: JSON.parse(JSON.stringify(def.data || def.defaultData || { mapping: {} })),
    customProps: def.customProps ? JSON.parse(JSON.stringify(def.customProps)) : (def.defaultCustomProps ? JSON.parse(JSON.stringify(def.defaultCustomProps)) : undefined)
  };
});

// O(1) Selected IDs Set
const selectedSet = computed(() => new Set(props.selectedIds));

// Selected Components Array (O(N) computed only when selection changes)
const selectedComponents = computed(() => {
  if (!props.selectedIds || props.selectedIds.length === 0) return [];
  const set = selectedSet.value;
  return props.components.filter(c => set.has(c.id));
});


// Combined bounding box of all currently selected components in multi-select mode
const selectedGroupBBox = computed(() => {
  if (props.selectedIds.length <= 1) return null;
  const set = selectedSet.value;
  const selectedList = props.components.filter(c => set.has(c.id) && c.visible !== false);
  if (selectedList.length <= 1) return null;
  return calculateComponentsBoundingBox(selectedList);
});

// Primary selected component (if 1 selected)
const primarySelected = computed(() => {
  if (props.selectedIds.length === 1) {
    const targetId = props.selectedIds[0];
    return props.components.find(c => c.id === targetId) || null;
  }
  return null;
});

const primarySelectedHasControl = computed(() => {
  if (!primarySelected.value) return false;
  const c = primarySelected.value;
  const actionType = c.data?.action?.type;
  if (actionType === 'tele-control' || actionType === 'tele-regulation') return true;
  const mapping = c.data?.mapping;
  if (mapping?.pointCategory === 'teleControl' || mapping?.pointCategory === 'teleRegulation') return true;
  if (mapping?.ykPointId || mapping?.ytPointId || (c.data as any)?.control?.pointId) return true;
  return false;
});

// Wheel Zoom ONLY when Ctrl is pressed (ctrl + 滚轮缩放)
const onWheelWorkspace = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    handleWheelZoom(e, containerRef.value, (newZoom) => {
      emit('update:zoom', newZoom);
    });
  }
};

// 一键居中 / 铺满画布：严格计算包含所有可见组件的最小外接矩形，将整体平移至 (0,0)，并自适应缩放铺满整个编辑界面（消除多余留白）
const handleFitAndCenter = () => {
  const container = infinitePlaneRef.value || containerRef.value;
  if (!container) return;

  const activeComps = props.components || [];
  const bbox = calculateComponentsBoundingBox(activeComps);

  if (bbox && activeComps.length > 0) {
    const dx = -bbox.minX;
    const dy = -bbox.minY;
    
    let updatedComps = activeComps;
    if (dx !== 0 || dy !== 0) {
      updatedComps = activeComps.map(c => ({
        ...c,
        x: Math.round((c.x || 0) + dx),
        y: Math.round((c.y || 0) + dy)
      }));
      emit('update:components', updatedComps);
      emit('commit:history');
    }

    // 动态调整画面尺寸为所有组件的最小外接矩形，彻底消除扩大或缩小后的留白区域
    if (bbox.width !== props.screen.width || bbox.height !== props.screen.height) {
      emit('update:screen', {
        ...props.screen,
        width: bbox.width,
        height: bbox.height
      });
      emit('commit:history');
    }

    fitCanvasToViewport(
      bbox.width,
      bbox.height,
      container,
      updatedComps,
      (newZoom) => {
        emit('update:zoom', newZoom);
      }
    );
  } else {
    fitCanvasToViewport(
      props.screen.width || 1980,
      props.screen.height || 1100,
      container,
      activeComps,
      (newZoom) => {
        emit('update:zoom', newZoom);
      }
    );
  }
};

// 视口复位至标尺原点坐标 (0, 0)
const handleResetViewport = () => {
  panOffset.value = { x: 30, y: 30 };
};

// 一键定位：平移全图图元左上角至 (0, 0) 原点坐标
const handleAlignToOrigin = () => {
  handleFitAndCenter();
};

// 仅在切换画面 (screen.id 改变) 时触发自动居中，撤回/重做或修改尺寸时绝不自动触发
watch(() => props.screen.id, (newId, oldId) => {
  if (newId && oldId && newId !== oldId) {
    nextTick(() => {
      handleFitAndCenter();
    });
  }
});

onMounted(() => {
  nextTick(() => {
    handleFitAndCenter();
  });
});

// Precision Operations
const handleSnapAllToGrid = () => {
  if (props.components.length === 0) return;
  const updated = snapAllToGrid(props.components, gridSize.value);
  emit('update:components', updated);
};

const handleCenterAllInCanvas = () => {
  if (props.components.length === 0) return;
  const updated = centerAllInCanvas(props.components, props.screen.width, props.screen.height);
  emit('update:components', updated);
};

let mouseMoveRaf: number | null = null;
let lastMouseMoveEvent: MouseEvent | null = null;

const handleMouseMoveWorkspace = (e: MouseEvent) => {
  lastMouseMoveEvent = e;
  if (mouseMoveRaf === null) {
    mouseMoveRaf = requestAnimationFrame(() => {
      mouseMoveRaf = null;
      if (lastMouseMoveEvent) {
        processMouseMove(lastMouseMoveEvent);
      }
    });
  }
};

const processMouseMove = (e: MouseEvent) => {
  // 1. Pan Workspace if panning
  if (isPanning.value) {
    updatePan(e.clientX, e.clientY);
    return;
  }

  // 1.5. Batch Component Dragging (延迟拖拽判定：仅当鼠标移动超过 3px 阈值才启动拖拽，杜绝单击抖动与字体模糊)
  if (isDragCandidate.value && !isDragging.value && props.selectedIds.length > 0) {
    const rawDx = (e.clientX - dragStartMouse.value.x) / (props.zoom || 1);
    const rawDy = (e.clientY - dragStartMouse.value.y) / (props.zoom || 1);
    if (Math.hypot(rawDx, rawDy) >= 3) {
      isDragging.value = true;
      hasMovedDrag.value = true;
      collectDragNodes();
    }
  }

  if (isDragging.value && props.selectedIds.length > 0) {
    const rawDx = (e.clientX - dragStartMouse.value.x) / (props.zoom || 1);
    const rawDy = (e.clientY - dragStartMouse.value.y) / (props.zoom || 1);

    let dx = rawDx;
    let dy = rawDy;

    if (snapToGrid.value && gridSize.value > 0) {
      // 锚定选中组件的绝对坐标吸附到最近格点，确保拖动后组件 100% 严丝合缝吸在格点上，绝不错位
      const primaryId = primarySelected.value?.id || props.selectedIds[0];
      const anchorStart = dragStartPositions.value.get(primaryId) || { x: 0, y: 0 };
      const targetX = anchorStart.x + rawDx;
      const targetY = anchorStart.y + rawDy;
      const snappedTargetX = Math.round(targetX / gridSize.value) * gridSize.value;
      const snappedTargetY = Math.round(targetY / gridSize.value) * gridSize.value;
      dx = snappedTargetX - anchorStart.x;
      dy = snappedTargetY - anchorStart.y;
    } else {
      dx = Math.round(rawDx);
      dy = Math.round(rawDy);
    }

    if (Math.abs(rawDx) > 1 || Math.abs(rawDy) > 1) {
      hasMovedDrag.value = true;
    }

    if (dragOffset.dx !== dx || dragOffset.dy !== dy) {
      dragOffset.dx = dx;
      dragOffset.dy = dy;
      for (let i = 0; i < cachedDragNodes.length; i++) {
        const item = cachedDragNodes[i];
        if (item.baseTransform) {
          item.el.style.transform = `translate3d(${dx}px, ${dy}px, 0) ${item.baseTransform}`;
        } else {
          item.el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        }
      }
    }
    return;
  }

  const coords = getCanvasCoords(e.clientX, e.clientY);
  mousePos.value = coords;

  // 2. Polyline Drawing Preview (仅当开启正交锁定按钮或按住 Shift 时强制正交，默认可在任意格点自由连线)
  if (props.drawTool === 'draw-polyline') {
    if (polylineDrawing.value.active && polylineDrawing.value.points.length > 0) {
      const lastPt = polylineDrawing.value.points[polylineDrawing.value.points.length - 1];
      let pX = coords.x;
      let pY = coords.y;
      if (lastPt && (orthogonalLock.value || e.shiftKey)) {
        const ortho = calculateOrthogonalPoint(lastPt.x, lastPt.y, pX, pY);
        pX = ortho.x;
        pY = ortho.y;
      }
      polylineDrawing.value.currentX = pX;
      polylineDrawing.value.currentY = pY;
    } else {
      polylineDrawing.value.currentX = coords.x;
      polylineDrawing.value.currentY = coords.y;
    }
    return;
  }

  // 3. Arrow Drawing Preview (仅当开启正交锁定按钮或按住 Shift 时强制正交，默认可在任意格点自由连线)
  if (props.drawTool === 'draw-arrow') {
    if (arrowDrawing.value.active) {
      let pX = coords.x;
      let pY = coords.y;
      if (orthogonalLock.value || e.shiftKey) {
        const ortho = calculateOrthogonalPoint(arrowDrawing.value.startX, arrowDrawing.value.startY, pX, pY);
        pX = ortho.x;
        pY = ortho.y;
      }
      arrowDrawing.value.currentX = pX;
      arrowDrawing.value.currentY = pY;
    } else {
      arrowDrawing.value.startX = coords.x;
      arrowDrawing.value.startY = coords.y;
      arrowDrawing.value.currentX = coords.x;
      arrowDrawing.value.currentY = coords.y;
    }
    return;
  }

  // 3.5. Component Click-to-Place Preview (Start & End Point Determination)
  if (props.drawTool === 'place-component') {
    placeDrawing.value.currentX = coords.x;
    placeDrawing.value.currentY = coords.y;
    if (!placeDrawing.value.active) {
      placeDrawing.value.startX = coords.x;
      placeDrawing.value.startY = coords.y;
    }
    return;
  }

  // 4. Marquee Selection Drag (拉框多选：完全包围整个组件才判定为选中，预缓存AABB与去重触发)
  if (isSelectingMarquee.value) {
    const minX = Math.min(marqueeBox.value.startX, coords.rawX);
    const minY = Math.min(marqueeBox.value.startY, coords.rawY);
    const w = Math.abs(coords.rawX - marqueeBox.value.startX);
    const h = Math.abs(coords.rawY - marqueeBox.value.startY);

    if (w > 4 || h > 4) {
      hasMovedMarquee.value = true;
    }

    marqueeBox.value.x = minX;
    marqueeBox.value.y = minY;
    marqueeBox.value.width = w;
    marqueeBox.value.height = h;

    if (hasMovedMarquee.value) {
      const boxLeft = minX;
      const boxTop = minY;
      const boxRight = minX + w;
      const boxBottom = minY + h;

      const newSelectedIds: string[] = [];
      for (let i = 0; i < cachedMarqueeAABBs.length; i++) {
        const item = cachedMarqueeAABBs[i];
        if (
          item.minX >= boxLeft &&
          item.maxX <= boxRight &&
          item.minY >= boxTop &&
          item.maxY <= boxBottom
        ) {
          newSelectedIds.push(item.id);
        }
      }

      // Check if selected IDs changed before emitting to prevent massive reactive re-rendering
      const prevIds = props.selectedIds;
      if (prevIds.length !== newSelectedIds.length || !newSelectedIds.every((id, idx) => id === prevIds[idx])) {
        emit('select', newSelectedIds);
      }
    }
    return;
  }

  // 6. Component Resizing
  if (isResizing.value && primarySelected.value && resizeHandle.value && !primarySelected.value.locked) {
    let dx = (e.clientX - resizeStart.value.mouseX) / (props.zoom || 1);
    let dy = (e.clientY - resizeStart.value.mouseY) / (props.zoom || 1);

    if (snapToGrid.value && gridSize.value > 0) {
      dx = Math.round(dx / gridSize.value) * gridSize.value;
      dy = Math.round(dy / gridSize.value) * gridSize.value;
    }

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      hasMovedResize.value = true;
    }

    const handle = resizeHandle.value;
    let newX = resizeStart.value.x;
    let newY = resizeStart.value.y;
    let newW = resizeStart.value.width;
    let newH = resizeStart.value.height;

    if (handle.includes('e')) newW = Math.max(10, Math.round(resizeStart.value.width + dx));
    if (handle.includes('s')) newH = Math.max(10, Math.round(resizeStart.value.height + dy));
    if (handle.includes('w')) {
      const potW = resizeStart.value.width - dx;
      if (potW >= 10) {
        newW = Math.round(potW);
        newX = Math.round(resizeStart.value.x + dx);
      }
    }
    if (handle.includes('n')) {
      const potH = resizeStart.value.height - dy;
      if (potH >= 10) {
        newH = Math.round(potH);
        newY = Math.round(resizeStart.value.y + dy);
      }
    }

    const comp = primarySelected.value;
    const is1to1 = comp.type === 'draw-circle' || comp.type === 'draw-square';
    // 仅在圆形/正方形或用户显式按住 Shift 键时锁定等比拉伸；平时完全支持自由拉伸宽高
    if (is1to1 || (e.shiftKey && ['nw', 'ne', 'se', 'sw'].includes(handle) && resizeStart.value.width > 0 && resizeStart.value.height > 0)) {
      const baseRatio = resizeStart.value.width / resizeStart.value.height;
      if (is1to1) {
        const s = Math.max(newW, newH);
        if (handle.includes('w')) {
          newX = Math.round(resizeStart.value.x + (resizeStart.value.width - s));
        }
        if (handle.includes('n')) {
          newY = Math.round(resizeStart.value.y + (resizeStart.value.height - s));
        }
        newW = s;
        newH = s;
      } else {
        const scale = Math.max(newW / resizeStart.value.width, newH / resizeStart.value.height);
        newW = Math.max(10, Math.round(resizeStart.value.width * scale));
        newH = Math.max(10, Math.round(resizeStart.value.height * scale));
        if (handle.includes('w')) {
          newX = Math.round(resizeStart.value.x + resizeStart.value.width - newW);
        }
        if (handle.includes('n')) {
          newY = Math.round(resizeStart.value.y + resizeStart.value.height - newH);
        }
      }
    }

    const isTelemetry = comp.type === 'metric-float' || comp.type === 'metric-flipper' || comp.type === 'metric-counter' || comp.type === 'metric-digital';
    const isTextWidget = comp.type === 'draw-text' || comp.category === 'text';
    const isButtonWidget = comp.type === 'ctrl-button' || comp.category === 'buttons';
    const isTextOrButton = isTextWidget || isButtonWidget || comp.type === 'metric-header' || isTelemetry;
    let updatedStyle = { ...comp.style };
    if (isTextOrButton) {
      if (isTelemetry) {
        // 遥测框：自适应高宽，顶满抓手框
        const valStr = String(comp.data?.value ?? '10.00');
        const charLen = Math.max(3.5, valStr.length);
        const fitH = Math.floor(newH * 0.88);
        const fitW = Math.floor((newW - 2) / (charLen * 0.58));
        updatedStyle.fontSize = Math.max(10, Math.min(fitH, fitW, 300));
      } else if (isButtonWidget) {
        // 按钮框：自适应高宽，文字刚好顶满组件抓手框
        const text = String(comp.style?.buttonText || comp.customProps?.label || comp.name || '控制按钮');
        let vLen = 0;
        for (let i = 0; i < text.length; i++) {
          vLen += text.charCodeAt(i) > 255 ? 1.0 : 0.55;
        }
        vLen = Math.max(1, vLen);
        const fitH = Math.floor(newH * 0.75);
        const fitW = Math.floor((newW - 4) / vLen);
        const minBtnSize = newW < 32 ? 6 : 8;
        updatedStyle.fontSize = Math.max(minBtnSize, Math.min(fitH, fitW, 300));
      } else {
        // 文本框：自适应高宽（支持多行），文字刚好顶满组件抓手框
        const text = String(comp.style?.text || comp.data?.staticData?.text || comp.name || '文本');
        const lines = text.split('\n');
        const lineCount = Math.max(1, lines.length);
        let maxVisualLen = 0;
        for (const line of lines) {
          let vLen = 0;
          for (let i = 0; i < line.length; i++) {
            vLen += line.charCodeAt(i) > 255 ? 1.0 : 0.55;
          }
          if (vLen > maxVisualLen) maxVisualLen = vLen;
        }
        maxVisualLen = Math.max(1, maxVisualLen);
        const fitH = Math.floor((newH * 0.88) / lineCount);
        const fitW = Math.floor((newW - 2) / maxVisualLen);
        updatedStyle.fontSize = Math.max(10, Math.min(fitH, fitW, 300));
      }
      delete updatedStyle.fontSizeMode;
    }

    if (newX !== comp.x || newY !== comp.y || newW !== comp.width || newH !== comp.height) {
      emit('update:component', {
        ...comp,
        x: newX,
        y: newY,
        width: newW,
        height: newH,
        style: updatedStyle
      });
    }
    return;
  }

  // 6.5 Vertex / Node Dragging on Line/Polyline/Arrow (节点选中拉伸)
  if (isDraggingVertex.value && activeVertexCompId.value && activeVertexIdx.value !== null) {
    const comp = props.components.find(c => c.id === activeVertexCompId.value);
    if (!comp || comp.locked) return;

    let targetX = coords.rawX;
    let targetY = coords.rawY;

    if (props.snapToGrid && props.gridSize > 0) {
      targetX = Math.round(targetX / props.gridSize) * props.gridSize;
      targetY = Math.round(targetY / props.gridSize) * props.gridSize;
    }

    // Orthogonal snap support for straight lines, arrows & polylines (仅在正交开启时生效)
    if ((props.orthogonalLock || e.shiftKey)) {
      if (comp.type === 'draw-line' || comp.type === 'draw-arrow' || comp.type === 'straight-line') {
        const otherIdx = 1 - activeVertexIdx.value;
        const otherPt = vertexDragStart.value.points[otherIdx];
        if (otherPt) {
          const ortho = calculateOrthogonalPoint(otherPt.x, otherPt.y, targetX, targetY);
          targetX = ortho.x;
          targetY = ortho.y;
        }
      } else if (comp.type === 'draw-polyline' || comp.type === 'polyline') {
        const adjIdx = activeVertexIdx.value > 0 ? activeVertexIdx.value - 1 : 1;
        const adjPt = vertexDragStart.value.points[adjIdx];
        if (adjPt) {
          const ortho = calculateOrthogonalPoint(adjPt.x, adjPt.y, targetX, targetY);
          targetX = ortho.x;
          targetY = ortho.y;
        }
      }
    }

    const newAbsPts = vertexDragStart.value.points.map((p, idx) => {
      if (idx === activeVertexIdx.value) {
        return { x: targetX, y: targetY };
      }
      return { x: p.x, y: p.y };
    });

    const minX = Math.min(...newAbsPts.map(p => p.x));
    const minY = Math.min(...newAbsPts.map(p => p.y));
    const maxX = Math.max(...newAbsPts.map(p => p.x));
    const maxY = Math.max(...newAbsPts.map(p => p.y));
    const newW = Math.max(8, maxX - minX);
    const newH = Math.max(8, maxY - minY);

    const newRelativePoints = newAbsPts.map(p => ({
      xRatio: newW > 0 ? (p.x - minX) / newW : 0,
      yRatio: newH > 0 ? (p.y - minY) / newH : 0,
      x: p.x - minX,
      y: p.y - minY
    }));

    hasMovedVertex.value = true;
    emit('update:component', {
      ...comp,
      x: minX,
      y: minY,
      width: newW,
      height: newH,
      customProps: {
        ...(comp.customProps || {}),
        points: newRelativePoints
      }
    });
    return;
  }

  // 7. Free Rotation Handle Drag (高性能丝滑旋转，过滤同度数更新)
  if (isRotating.value && primarySelected.value && !primarySelected.value.locked) {
    const curX = coords.rawX;
    const curY = coords.rawY;
    const cx = rotateStart.value.cx;
    const cy = rotateStart.value.cy;

    const rad = Math.atan2(curY - cy, curX - cx);
    let deg = Math.round((rad * 180) / Math.PI + 90);
    deg = (deg % 360 + 360) % 360;

    if (e.shiftKey) {
      deg = Math.round(deg / 15) * 15;
    }

    if (primarySelected.value.rotation !== deg) {
      hasMovedRotate.value = true;
      emit('update:component', {
        ...primarySelected.value,
        rotation: deg
      });
    }
  }
};

const handleMouseUpWorkspace = () => {
  if (mouseMoveRaf !== null) {
    cancelAnimationFrame(mouseMoveRaf);
    mouseMoveRaf = null;
  }
  if (lastMouseMoveEvent) {
    processMouseMove(lastMouseMoveEvent);
    lastMouseMoveEvent = null;
  }

  if (isPanning.value) {
    endPan();
  }

  if (props.drawTool === 'place-component' && placeDrawing.value.active) {
    const w = Math.abs(placeDrawing.value.currentX - placeDrawing.value.startX);
    const h = Math.abs(placeDrawing.value.currentY - placeDrawing.value.startY);
    if (w >= 12 || h >= 12) {
      suppressNextCanvasClick.value = true;
      lastInteractionTime.value = Date.now();
      finishPlaceDrawing();
      setTimeout(() => {
        suppressNextCanvasClick.value = false;
      }, 200);
      return;
    }
  }

  if (isSelectingMarquee.value) {
    if (hasMovedMarquee.value) {
      suppressNextCanvasClick.value = true;
      lastInteractionTime.value = Date.now();
      setTimeout(() => {
        suppressNextCanvasClick.value = false;
        hasMovedMarquee.value = false;
      }, 200);
    } else {
      hasMovedMarquee.value = false;
    }
    isSelectingMarquee.value = false;
  }

  if (isDragging.value) {
    suppressNextCanvasClick.value = true;
    lastInteractionTime.value = Date.now();
    const finalDx = dragOffset.dx;
    const finalDy = dragOffset.dy;

    for (let i = 0; i < cachedDragNodes.length; i++) {
      const item = cachedDragNodes[i];
      item.el.style.transform = item.baseTransform;
      item.el.style.willChange = '';
    }
    cachedDragNodes = [];

    if (hasMovedDrag.value && (finalDx !== 0 || finalDy !== 0)) {
      const updatedComps = props.components
        .filter(c => props.selectedIds.includes(c.id) && !c.locked && dragStartPositions.value.has(c.id))
        .map(c => {
          const startPos = dragStartPositions.value.get(c.id)!;
          let finalX = startPos.x + finalDx;
          let finalY = startPos.y + finalDy;
          if (snapToGrid.value && gridSize.value > 0) {
            finalX = Math.round(finalX / gridSize.value) * gridSize.value;
            finalY = Math.round(finalY / gridSize.value) * gridSize.value;
          } else {
            finalX = Math.round(finalX);
            finalY = Math.round(finalY);
          }
          return {
            ...c,
            x: finalX,
            y: finalY
          };
        });

      if (updatedComps.length > 0) {
        emit('update:components', updatedComps);
        emit('commit:history');
      }
    }

    isDragging.value = false;
    hasMovedDrag.value = false;
    dragOffset = { dx: 0, dy: 0 };
    dragStartPositions.value.clear();

    setTimeout(() => {
      suppressNextCanvasClick.value = false;
    }, 200);
  }

  isDragCandidate.value = false;
  pendingDragSelSet.clear();

  if (isResizing.value) {
    suppressNextCanvasClick.value = true;
    lastInteractionTime.value = Date.now();
    if (hasMovedResize.value) {
      emit('commit:history');
      hasMovedResize.value = false;
    }
    isResizing.value = false;
    resizeHandle.value = null;
    setTimeout(() => {
      suppressNextCanvasClick.value = false;
    }, 200);
  }

  if (isDraggingVertex.value) {
    suppressNextCanvasClick.value = true;
    lastInteractionTime.value = Date.now();
    if (hasMovedVertex.value) {
      emit('commit:history');
      hasMovedVertex.value = false;
    }
    isDraggingVertex.value = false;
    activeVertexCompId.value = null;
    activeVertexIdx.value = null;
    setTimeout(() => {
      suppressNextCanvasClick.value = false;
    }, 200);
  }

  if (isRotating.value) {
    suppressNextCanvasClick.value = true;
    lastInteractionTime.value = Date.now();
    if (hasMovedRotate.value) {
      emit('commit:history');
      hasMovedRotate.value = false;
    }
    isRotating.value = false;
    setTimeout(() => {
      suppressNextCanvasClick.value = false;
    }, 200);
  }
};

// Component Drag Start
const handleStartDrag = (e: MouseEvent, comp: ScreenComponent) => {
  if (e.button !== 0) return;
  if (isSpacePressed.value || e.ctrlKey || e.metaKey) {
    // If holding space or ctrl/cmd, initiate infinite canvas pan even when clicking directly on components
    e.preventDefault();
    startPan(e.clientX, e.clientY);
    return;
  }
  if (props.drawTool !== 'select') return;
  e.stopPropagation();

  lastInteractionTime.value = Date.now();
  suppressNextCanvasClick.value = true;
  contextMenu.value.visible = false;

  let activeIds = [...props.selectedIds];

  if (e.shiftKey) {
    // Toggle selection with Shift
    if (activeIds.includes(comp.id)) {
      activeIds = activeIds.filter(id => id !== comp.id);
    } else {
      activeIds = [...activeIds, comp.id];
    }
    emit('select', activeIds);
  } else {
    // Standard click without shift:
    // If clicking an already selected component in multi-selection, keep current group selected for batch dragging
    // If clicking an unselected component, select only this one
    if (!activeIds.includes(comp.id)) {
      activeIds = [comp.id];
      emit('select', activeIds);
    }
  }

  if (comp.locked) return;

  isDragCandidate.value = true;
  isDragging.value = false;
  hasMovedDrag.value = false;
  dragOffset = { dx: 0, dy: 0 };
  dragStartMouse.value = { x: e.clientX, y: e.clientY };
  
  const map = new Map<string, { x: number; y: number }>();
  props.components.forEach(c => {
    if (activeIds.includes(c.id) || c.id === comp.id) {
      map.set(c.id, { x: c.x, y: c.y });
    }
  });
  dragStartPositions.value = map;

  // 记录候选待拖拽图元 ID 集合，仅在真实发生超过 3px 位移时才收集提升 DOM 节点
  const selSet = new Set(activeIds);
  selSet.add(comp.id);
  pendingDragSelSet = selSet;
};

// Component Mouse Down & Click Handlers (仅指针模式下有效，绘制模式下完全穿透到画布用于拾取起点)
const handleCompMouseDown = (e: MouseEvent, comp: ScreenComponent) => {
  // 严格限制：仅鼠标左键 (e.button === 0) 允许触发拖拽或选中！
  // 鼠标右键 (e.button === 2) 严禁启动任何组件拖动与位移，直接返回让 @contextmenu 专心接管右键菜单
  if (e.button !== 0) return;
  if (props.drawTool !== 'select') return;
  e.stopPropagation();
  handleStartDrag(e, comp);
};

const handleCompClick = (e: MouseEvent, comp: ScreenComponent) => {
  if (props.drawTool !== 'select') return;
  e.stopPropagation();
  lastInteractionTime.value = Date.now();
  suppressNextCanvasClick.value = true;

  if (isPanning.value || hasMovedDrag.value || hasMovedMarquee.value) {
    return;
  }
  if (e.shiftKey) {
    // Shift click was already toggled in handleStartDrag
    return;
  }
  // If clicking an unselected component, select it
  if (!props.selectedIds.includes(comp.id)) {
    emit('select', [comp.id]);
  }
};

// Canvas Background Click & Drawing Tool Handlers
const handleCanvasClick = (e: MouseEvent) => {
  // 刚结束上一次绘制后的 220ms 冷却期内，吸收丢弃双击操作留下的残留事件，杜绝产生幽灵折线/箭头
  if (Date.now() - lastFinishDrawTime.value < 220) {
    return;
  }

  // 绘制模式下点击为明确的起点/拐点确定动作，绝不能被 suppress 拦截！
  if (props.drawTool !== 'select') {
    suppressNextCanvasClick.value = false;
  } else {
    // 仅指针选择模式（用于点击空白处取消选中）在拖拽/框选后需做防误触拦截
    if (suppressNextCanvasClick.value || (Date.now() - lastInteractionTime.value) < 260) {
      suppressNextCanvasClick.value = false;
      return;
    }
  }

  const coords = getCanvasCoords(e.clientX, e.clientY);

  // Polyline Drawing Mode (单击添加拐点，双击结束)
  if (props.drawTool === 'draw-polyline') {
    if (!polylineDrawing.value.active) {
      polylineDrawing.value.active = true;
      polylineDrawing.value.points = [{ x: coords.x, y: coords.y }];
      polylineDrawing.value.currentX = coords.x;
      polylineDrawing.value.currentY = coords.y;
    } else {
      const lastPt = polylineDrawing.value.points[polylineDrawing.value.points.length - 1];
      let nextX = coords.x;
      let nextY = coords.y;
      if (lastPt && (orthogonalLock.value || e.shiftKey)) {
        const ortho = calculateOrthogonalPoint(lastPt.x, lastPt.y, nextX, nextY);
        nextX = ortho.x;
        nextY = ortho.y;
      }
      // 避免连续快速点击添加重叠点（最小位移阈值 4px）
      if (!lastPt || Math.hypot(nextX - lastPt.x, nextY - lastPt.y) >= 4) {
        polylineDrawing.value.points.push({ x: nextX, y: nextY });
      }
    }
    return;
  }

  // Arrow Drawing Mode (单击确定起点，再次单击/双击确定终点)
  if (props.drawTool === 'draw-arrow') {
    if (!arrowDrawing.value.active) {
      arrowDrawing.value.active = true;
      arrowDrawing.value.startX = coords.x;
      arrowDrawing.value.startY = coords.y;
      arrowDrawing.value.currentX = coords.x;
      arrowDrawing.value.currentY = coords.y;
    } else {
      let finalX = coords.x;
      let finalY = coords.y;
      if (orthogonalLock.value || e.shiftKey) {
        const ortho = calculateOrthogonalPoint(arrowDrawing.value.startX, arrowDrawing.value.startY, finalX, finalY);
        finalX = ortho.x;
        finalY = ortho.y;
      }
      arrowDrawing.value.currentX = finalX;
      arrowDrawing.value.currentY = finalY;
      finishArrowDrawing();
    }
    return;
  }

  // Component Click-to-Place Mode (单击确定起点，在屏幕自己确定终点完成放置)
  if (props.drawTool === 'place-component') {
    if (!placeDrawing.value.active) {
      placeDrawing.value.active = true;
      placeDrawing.value.startX = coords.x;
      placeDrawing.value.startY = coords.y;
      placeDrawing.value.currentX = coords.x;
      placeDrawing.value.currentY = coords.y;
      placeDrawing.value.def = props.activeComponentDef;
    } else {
      const distW = Math.abs(coords.x - placeDrawing.value.startX);
      const distH = Math.abs(coords.y - placeDrawing.value.startY);
      // 必须产生有效位移才确定终止点，避免在起点原地误触直接完成
      if (distW >= 10 || distH >= 10) {
        placeDrawing.value.currentX = coords.x;
        placeDrawing.value.currentY = coords.y;
        finishPlaceDrawing();
      }
    }
    return;
  }

  // Selection clear ONLY when clicking blank canvas background
  const target = e.target as HTMLElement;
  const isInsideInteractiveComp = 
    target.closest('[data-component-id]') ||
    target.closest('.component-node') ||
    target.closest('.group') ||
    target.closest('.selection-overlay') ||
    target.closest('.cursor-move') ||
    target.closest('.rotate-handle') ||
    target.closest('.resize-handle');

  if (isInsideInteractiveComp) {
    return;
  }

  if (!isSelectingMarquee.value && !hasMovedMarquee.value && !isPanning.value && !hasMovedDrag.value && !isResizing.value && !isRotating.value) {
    emit('select', []);
  }
};

// Finish Arrow Drawing & Auto-crop to minimal bounding box (精确对齐格点，杜绝内边距偏移导致的错位)
const finishArrowDrawing = () => {
  if (!arrowDrawing.value.active) return;
  const { startX, startY, currentX, currentY } = arrowDrawing.value;
  const dist = Math.hypot(currentX - startX, currentY - startY);
  if (dist < 5) {
    arrowDrawing.value.active = false;
    return;
  }

  // 严格贴合格点边缘，不添加伪内边距，确保组件 top-left 100% 严谨吸附在格点坐标上
  const minX = Math.min(startX, currentX);
  const minY = Math.min(startY, currentY);
  const maxX = Math.max(startX, currentX);
  const maxY = Math.max(startY, currentY);

  const compW = Math.max(20, maxX - minX);
  const compH = Math.max(20, maxY - minY);

  const relPoints = [
    { xRatio: compW > 0 ? (startX - minX) / compW : 0, yRatio: compH > 0 ? (startY - minY) / compH : 0, x: startX - minX, y: startY - minY },
    { xRatio: compW > 0 ? (currentX - minX) / compW : 0, yRatio: compH > 0 ? (currentY - minY) / compH : 0, x: currentX - minX, y: currentY - minY }
  ];

  emit('add:component:at', {
    type: 'draw-arrow',
    category: 'basic',
    name: '导向箭头',
    width: compW,
    height: compH,
    style: { 
      stroke: props.drawingPreset?.stroke || '#00f2ff', 
      strokeWidth: props.drawingPreset?.strokeWidth || 3, 
      endArrow: true,
      startArrow: false,
      lineStyle: props.drawingPreset?.lineStyle || 'solid'
    },
    customProps: {
      points: relPoints
    }
  }, minX, minY);

  arrowDrawing.value.active = false;
  suppressNextCanvasClick.value = false;
  lastInteractionTime.value = 0;
  lastFinishDrawTime.value = Date.now();
  emit('finish:draw');
};

// Finish Component Placement (确定起始与终止点，完成组件实例化)
const finishPlaceDrawing = () => {
  if (!placeDrawing.value.active) return;
  const def = placeDrawing.value.def || props.activeComponentDef;
  if (!def) {
    placeDrawing.value.active = false;
    emit('finish:draw');
    return;
  }

  const { startX, startY, currentX, currentY } = placeDrawing.value;
  let minX = Math.min(startX, currentX);
  let minY = Math.min(startY, currentY);
  let w = Math.abs(currentX - startX);
  let h = Math.abs(currentY - startY);

  const isTelemetry = def.type === 'metric-float' || def.type === 'metric-flipper' || def.type === 'metric-counter' || def.type === 'metric-digital';
  const is1to1 = def.type === 'draw-circle' || def.type === 'draw-square';

  // If user made a fast single click (distance < 12px), use component's default width and height
  if (w < 12 && h < 12) {
    w = def.defaultWidth || def.width || (isTelemetry ? 72 : (is1to1 ? 100 : 140));
    h = def.defaultHeight || def.height || (isTelemetry ? 26 : (is1to1 ? 100 : 100));
  } else {
    w = Math.max(16, w);
    h = Math.max(16, h);
    if (is1to1) {
      const size = Math.max(w, h);
      w = size;
      h = size;
      minX = currentX >= startX ? startX : startX - size;
      minY = currentY >= startY ? startY : startY - size;
    }
  }

  const isCompositeOrCustom = 
    def.type === 'composite-symbol' || 
    def.category === 'gb-standard' || 
    def.category === 'electrical' ||
    def.category === 'status' ||
    def.category === 'charts' ||
    def.category === 'industrial' ||
    def.customProps?.isCustomSymbol ||
    def.customProps?.isGbStandard ||
    Boolean(def.states?.length) ||
    Boolean(def.children?.length);

  let finalStyle = { ...(def.defaultStyle || def.style || {}) };

  if (isCompositeOrCustom) {
    // 复合图元、自定义图元与电力设备其外轮廓底色必须严格保持透明，杜绝被全局画笔底色污染
    if (def.type === 'composite-symbol' || def.customProps?.isCustomSymbol || def.category === 'gb-standard' || def.category === 'electrical') {
      finalStyle.fill = 'transparent';
      finalStyle.bgColor = 'transparent';
    }
  } else if (props.drawingPreset) {
    // 全局画笔预设继承 (仅适用于用户绘制单体基础几何图形：矩形、圆形等)
    if (props.drawingPreset.stroke) {
      finalStyle.stroke = props.drawingPreset.stroke;
      finalStyle.borderColor = props.drawingPreset.stroke;
    }
    if (props.drawingPreset.fill && props.drawingPreset.fill !== 'transparent') {
      finalStyle.fill = props.drawingPreset.fill;
      finalStyle.bgColor = props.drawingPreset.fill;
    } else if (props.drawingPreset.fill === 'transparent') {
      finalStyle.fill = 'transparent';
      finalStyle.bgColor = 'transparent';
    }
    if (props.drawingPreset.strokeWidth) {
      finalStyle.strokeWidth = props.drawingPreset.strokeWidth;
      finalStyle.borderWidth = props.drawingPreset.strokeWidth;
    }
    if (props.drawingPreset.lineStyle) {
      finalStyle.lineStyle = props.drawingPreset.lineStyle;
    }
    if (def.type === 'draw-text' || def.type === 'ctrl-button') {
      if (props.drawingPreset.fontSize) finalStyle.fontSize = props.drawingPreset.fontSize;
      if (props.drawingPreset.fontWeight) finalStyle.fontWeight = props.drawingPreset.fontWeight;
    }
  }

  if (isTelemetry) {
    // 遥测组件矩形拉框自适应计算：无论是单点创建还是拉框创建很大矩形，
    // 立即根据所绘边框高宽计算字号，使数字始终紧紧贴合抓手矩形边框，杜绝数字小小的挤在中间
    const fitByH = Math.max(10, Math.floor(h * 0.88));
    const fitByW = Math.max(10, Math.floor((w - 2) / (4.5 * 0.58)));
    finalStyle.fontSize = Math.max(10, Math.min(300, Math.min(fitByH, fitByW)));
  } else if (def.type === 'ctrl-button') {
    const text = ((finalStyle as any).buttonText || def.name || '控制按钮') as string;
    let vLen = 0;
    for (let i = 0; i < text.length; i++) vLen += text.charCodeAt(i) > 255 ? 1.0 : 0.55;
    vLen = Math.max(1, vLen);
    finalStyle.fontSize = Math.max(10, Math.min(300, Math.min(Math.floor(h * 0.80), Math.floor((w - 8) / vLen))));
  } else if (def.type === 'draw-text') {
    const text = ((finalStyle as any).text || def.name || '文本') as string;
    let vLen = 0;
    for (let i = 0; i < text.length; i++) vLen += text.charCodeAt(i) > 255 ? 1.0 : 0.55;
    vLen = Math.max(1, vLen);
    finalStyle.fontSize = Math.max(10, Math.min(300, Math.min(Math.floor(h * 0.88), Math.floor((w - 2) / vLen))));
  }

  const compPayload = {
    ...def,
    width: w,
    height: h,
    style: finalStyle
  };

  emit('add:component:at', compPayload, minX, minY);
  placeDrawing.value.active = false;
  suppressNextCanvasClick.value = false;
  lastInteractionTime.value = 0;
  lastFinishDrawTime.value = Date.now();
  emit('finish:draw');
};

// Polyline Double Click / Enter to Finish
const handleCanvasDblClick = () => {
  if (props.drawTool === 'draw-arrow' && arrowDrawing.value.active) {
    finishArrowDrawing();
    return;
  }
  if (props.drawTool === 'draw-polyline' && polylineDrawing.value.active) {
    // 严格清洗顶点：过滤掉因双击连续触发 click 而产生的重复尾部顶点及相邻微小重合节点 (<= 4px)
    const rawPts = polylineDrawing.value.points;
    const pts: Array<{ x: number; y: number }> = [];
    for (const p of rawPts) {
      if (pts.length === 0) {
        pts.push(p);
      } else {
        const prev = pts[pts.length - 1];
        if (Math.hypot(p.x - prev.x, p.y - prev.y) >= 4) {
          pts.push(p);
        }
      }
    }

    if (pts.length >= 2) {
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

      emit('add:component:at', {
        type: 'draw-polyline',
        category: 'basic',
        name: '折线走线',
        width: compW,
        height: compH,
        style: { 
          stroke: props.drawingPreset?.stroke || '#00f2ff', 
          strokeWidth: props.drawingPreset?.strokeWidth || 3, 
          lineType: 'direct',
          lineStyle: props.drawingPreset?.lineStyle || 'solid'
        },
        customProps: {
          points: relPoints
        }
      }, minX, minY);
    }

    polylineDrawing.value.active = false;
    polylineDrawing.value.points = [];
    suppressNextCanvasClick.value = false;
    lastInteractionTime.value = 0;
    lastFinishDrawTime.value = Date.now();
    emit('finish:draw');
  }
};

// Canvas Mouse Down: Supports Pan (Ctrl / Space / Middle Click) OR Marquee Selection
const handleCanvasMouseDown = (e: MouseEvent) => {
  // Middle click (button === 1) or Ctrl+Click or Space+Click initiates Pan
  if (e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey || isSpacePressed.value))) {
    e.preventDefault();
    startPan(e.clientX, e.clientY);
    return;
  }

  if (e.button !== 0) return;
  if (props.drawTool !== 'select') return;

  const target = e.target as HTMLElement;
  const isInsideInteractiveComp = 
    target.closest('[data-component-id]') ||
    target.closest('.component-node') ||
    target.closest('.group') ||
    target.closest('.selection-overlay') ||
    target.closest('.cursor-move') ||
    target.closest('.rotate-handle') ||
    target.closest('.resize-handle');

  if (!isInsideInteractiveComp) {
    const coords = getCanvasCoords(e.clientX, e.clientY, true);
    isSelectingMarquee.value = true;
    hasMovedMarquee.value = false;
    cachedMarqueeAABBs = props.components
      .filter(c => c.visible !== false)
      .map(c => ({ id: c.id, ...getComponentAABB(c) }));
    marqueeBox.value = {
      startX: coords.rawX,
      startY: coords.rawY,
      x: coords.rawX,
      y: coords.rawY,
      width: 0,
      height: 0
    };
  }
};

// Start Resizing
const handleStartResize = (e: MouseEvent, handle: string) => {
  // 严格限制：仅允许鼠标左键 (e.button === 0) 触发尺寸缩放调整！右键严禁触发缩放
  if (e.button !== 0) return;
  if (isSpacePressed.value || e.ctrlKey || e.metaKey) {
    e.preventDefault();
    startPan(e.clientX, e.clientY);
    return;
  }
  e.stopPropagation();
  e.preventDefault();
  lastInteractionTime.value = Date.now();
  suppressNextCanvasClick.value = true;
  if (!primarySelected.value || primarySelected.value.locked) return;

  const comp = primarySelected.value;
  const isTelemetry = comp.type === 'metric-float' || comp.type === 'metric-flipper' || comp.type === 'metric-counter' || comp.type === 'metric-digital';
  const ratio = isTelemetry ? 0.82 : 0.65;
  isResizing.value = true;
  hasMovedResize.value = false;
  resizeHandle.value = handle;
  resizeStart.value = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    x: comp.x,
    y: comp.y,
    width: comp.width,
    height: comp.height,
    fontSize: comp.style?.fontSize || Math.max(12, Math.round(comp.height * ratio))
  };
};

// Start Rotating (自由旋转功能)
const handleStartRotate = (e: MouseEvent) => {
  // 严格限制：仅允许鼠标左键 (e.button === 0) 触发旋转调整！右键严禁触发旋转
  if (e.button !== 0) return;
  if (isSpacePressed.value || e.ctrlKey || e.metaKey) {
    e.preventDefault();
    startPan(e.clientX, e.clientY);
    return;
  }
  e.stopPropagation();
  e.preventDefault();
  lastInteractionTime.value = Date.now();
  suppressNextCanvasClick.value = true;
  if (!primarySelected.value || primarySelected.value.locked) return;

  const comp = primarySelected.value;
  const cx = comp.x + comp.width / 2;
  const cy = comp.y + comp.height / 2;

  isRotating.value = true;
  hasMovedRotate.value = false;
  rotateStart.value = {
    cx,
    cy,
    initialAngle: 0,
    startRotation: comp.rotation || 0
  };
};

// Start Dragging/Stretching a specific Vertex Node on Line/Polyline/Arrow (折线、箭头、直线节点拖动拉伸)
const handleStartVertexDrag = (e: MouseEvent, comp: ScreenComponent, vertexIndex: number) => {
  // 核心修复：仅允许鼠标左键 (e.button === 0) 拖动拐点与端点！
  // 鼠标右键 (e.button === 2) 绝不能启动拉伸拖动，杜绝右击准备打开菜单时误移动组件节点！
  if (e.button !== 0) return;
  if (isSpacePressed.value || e.ctrlKey || e.metaKey) {
    e.preventDefault();
    startPan(e.clientX, e.clientY);
    return;
  }
  e.stopPropagation();
  e.preventDefault();
  lastInteractionTime.value = Date.now();
  suppressNextCanvasClick.value = true;
  if (comp.locked) return;

  if (!props.selectedIds.includes(comp.id)) {
    emit('select', [comp.id]);
  }

  let absPts: Array<{ x: number; y: number }> = [];
  if (comp.type === 'draw-polyline' || comp.type === 'polyline') {
    const localPts = getPolylinePoints(comp);
    absPts = localPts.map(p => ({ x: comp.x + p.x, y: comp.y + p.y }));
  } else {
    const linePts = getStraightLinePoints(comp);
    absPts = [
      { x: comp.x + linePts.x1, y: comp.y + linePts.y1 },
      { x: comp.x + linePts.x2, y: comp.y + linePts.y2 }
    ];
  }

  isDraggingVertex.value = true;
  hasMovedVertex.value = false;
  activeVertexCompId.value = comp.id;
  activeVertexIdx.value = vertexIndex;
  vertexDragStart.value = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    compX: comp.x,
    compY: comp.y,
    compW: comp.width,
    compH: comp.height,
    points: absPts
  };
};

// Drag Drop from palette
const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (!e.dataTransfer) return;

  // 1. 深度适配 Linux (凝思等) 桌面与外部拖拽媒体文件至画布
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    const coords = getCanvasCoords(e.clientX, e.clientY);
    let x = coords.x;
    let y = coords.y;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const w = 480;
        const h = 320;
        let posX = x - Math.round(w / 2);
        let posY = y - Math.round(h / 2);
        if (snapToGrid.value && gridSize.value > 0) {
          posX = Math.round(posX / gridSize.value) * gridSize.value;
          posY = Math.round(posY / gridSize.value) * gridSize.value;
        }
        emit('add:component:at', {
          name: file.name.replace(/\.[^/.]+$/, '') || '图片展示',
          type: 'media-image',
          category: 'media',
          width: w,
          height: h,
          style: {
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0,
            stroke: 'transparent',
            strokeWidth: 0,
            backgroundColor: 'transparent'
          },
          customProps: {
            src: base64,
            objectFit: 'contain',
            imageFilter: 'none',
            linxCompat: true
          }
        }, posX, posY);
      };
      reader.readAsDataURL(file);
      return;
    }
  }

  // 2. 左侧组件面板拖放
  const rawData = e.dataTransfer.getData('application/json');
  if (!rawData) return;

  try {
    const compDef = JSON.parse(rawData);
    const coords = getCanvasCoords(e.clientX, e.clientY);
    let x = coords.x - Math.round((compDef.width || 120) / 2);
    let y = coords.y - Math.round((compDef.height || 80) / 2);

    if (snapToGrid.value && gridSize.value > 0) {
      x = Math.round(x / gridSize.value) * gridSize.value;
      y = Math.round(y / gridSize.value) * gridSize.value;
    }

    emit('add:component:at', compDef, x, y);
  } catch (err) {
    console.error('Failed to drop component', err);
  }
};

// Right-click context menu
const handleContextMenu = (e: MouseEvent, compId: string | null) => {
  e.preventDefault();
  e.stopPropagation();

  // If in drawing mode, exit drawing mode
  if (props.drawTool !== 'select') {
    emit('finish:draw');
  }

  if (compId && !props.selectedIds.includes(compId)) {
    emit('select', [compId]);
  }

  const coords = getCanvasCoords(e.clientX, e.clientY);

  const menuWidth = 240;
  const menuHeight = 440;
  const winWidth = window.innerWidth;
  const winHeight = window.innerHeight;

  let x = Math.round(e.clientX);
  let y = Math.round(e.clientY);

  // Prevent right edge overflow (flip to left or clamp within screen)
  if (x + menuWidth > winWidth - 10) {
    x = Math.max(10, winWidth - menuWidth - 10);
  }
  // Prevent bottom edge overflow (flip up or clamp within screen)
  if (y + menuHeight > winHeight - 10) {
    y = Math.max(10, winHeight - menuHeight - 10);
  }

  contextMenu.value = {
    visible: true,
    x: Math.round(x),
    y: Math.round(y),
    canvasX: Math.round(coords.x),
    canvasY: Math.round(coords.y),
    targetCompId: compId
  };
};

// Handle right-click on blank canvas background
const handleCanvasContextMenu = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (props.drawTool !== 'select') {
    emit('finish:draw');
  }

  // Clear selection when right-clicking on empty canvas so canvas operations appear
  emit('select', []);

  handleContextMenu(e, null);
};

const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

// Effective target IDs and components for context menu
// Ensures immediate operation on the clicked component even before props.selectedIds syncs
const effectiveContextMenuIds = computed(() => {
  if (contextMenu.value.targetCompId) {
    if (props.selectedIds && props.selectedIds.includes(contextMenu.value.targetCompId)) {
      return props.selectedIds;
    }
    return [contextMenu.value.targetCompId];
  }
  return [];
});

const effectiveContextMenuComponents = computed(() => {
  const ids = effectiveContextMenuIds.value;
  if (!ids || ids.length === 0) return [];
  const idSet = new Set(ids);
  return props.components.filter(c => idSet.has(c.id));
});

const effectivePrimaryComponent = computed(() => {
  if (contextMenu.value.targetCompId) {
    return props.components.find(c => c.id === contextMenu.value.targetCompId) || effectiveContextMenuComponents.value[0];
  }
  return primarySelected.value || effectiveContextMenuComponents.value[0];
});

// 仅具备 SCADA 数据测点绑定意义的组件（电气一次、状态、遥测/数值、工业SCADA、图表、自定义复合多状态等）支持右键关联测点
// 基础几何形状、科技边框装饰、按钮等不展示“关联测点数据”菜单项
const canEffectivePrimaryAssociateData = computed(() => {
  const comp = effectivePrimaryComponent.value;
  if (!comp) return false;

  if (comp.category === 'basic' || comp.category === 'decoration' || comp.category === 'buttons' || comp.category === 'drawing') {
    return false;
  }
  if (comp.type.startsWith('draw-') || comp.type.startsWith('deco-') || comp.type === 'ctrl-button') {
    return false;
  }

  return true;
});

// Helper to classify component into 'yc' (遥测) | 'yx' (遥信) | 'other'
const getComponentScadaType = (comp: ScreenComponent): 'yc' | 'yx' | 'other' => {
  if (!comp) return 'other';

  // 1. Explicit mapping takes highest precedence
  if (comp.data?.mapping?.pointCategory === 'teleSignal' || comp.data?.bindings?.state) {
    return 'yx';
  }
  if (comp.data?.mapping?.pointCategory === 'telemetry' || (comp.data?.bindings?.value && !comp.data?.bindings?.state)) {
    return 'yc';
  }

  // 2. Component type and category check
  const t = comp.type || '';
  const cat = comp.category || '';

  // Telemetry (遥测) types
  if (
    t === 'metric-float' ||
    t === 'metric-flipper' ||
    t === 'metric-counter' ||
    t === 'metric-digital' ||
    t === 'ind-counter' ||
    t === 'ind-tank' ||
    t === 'chart-line' ||
    t === 'chart-bar' ||
    t === 'chart-pie' ||
    t === 'chart-gauge' ||
    cat === 'charts' ||
    t.startsWith('chart-')
  ) {
    return 'yc';
  }

  // Telesignal (遥信) types
  if (
    t === 'ctrl-indicator' ||
    t === 'ind-indicator' ||
    t === 'status-indicator' ||
    t === 'elec-breaker' ||
    t === 'elec-disconnector' ||
    t === 'elec-grounding' ||
    t === 'elec-handcart' ||
    t === 'elec-transformer' ||
    t === 'elec-ct' ||
    t === 'elec-pt' ||
    t === 'elec-arrester' ||
    t === 'ind-matrix' ||
    cat === 'status' ||
    (cat === 'electrical' && t !== 'elec-busbar') ||
    (comp.states && comp.states.length > 0) ||
    t === 'composite-symbol'
  ) {
    return 'yx';
  }

  if (cat === 'metrics' && !['metric-clock', 'metric-time-banner', 'metric-clock-analog', 'metric-countdown'].includes(t)) {
    return 'yc';
  }

  return 'other';
};

// Batch SCADA Association Check
// 当用户批选遥测或者批选遥信时(要么全部选择遥测，要么全部选择遥信，还不能包含其他组件)，右击菜单才会出现批选
const batchScadaType = computed<'yc' | 'yx' | null>(() => {
  const comps = effectiveContextMenuComponents.value;
  if (!comps || comps.length < 2) return null;

  const types = comps.map(c => getComponentScadaType(c));
  
  // If any component is 'other' (e.g. geometric shape, line, button, image, border), batch association is not allowed
  if (types.includes('other')) return null;

  // All must be 'yc'
  if (types.every(t => t === 'yc')) {
    return 'yc';
  }

  // All must be 'yx'
  if (types.every(t => t === 'yx')) {
    return 'yx';
  }

  return null;
});

const isAnyEffectiveLocked = computed(() => {
  return effectiveContextMenuComponents.value.some(c => c.locked);
});

// Dedicated context menu toggle lock
const handleToggleLockContext = () => {
  const comps = effectiveContextMenuComponents.value;
  if (comps.length === 0) return;
  const anyLocked = comps.some(c => c.locked);
  const targetLocked = !anyLocked;

  const updated = comps.map(c => ({
    ...c,
    locked: targetLocked
  }));

  // Update in parent and record history
  emit('update:components', updated);
  emit('commit:history');
  closeContextMenu();
};

// Active Arrow Keys Nudge Engine (Optimized for Linux/Electron & High-Frequency Auto-Repeat)
const activeArrowKeys = new Set<string>();
let isShiftPressedForNudge = false;
let arrowNudgeRafId: number | null = null;
let arrowNudgeHistoryTimer: any = null;
let hasArrowNudgePendingHistory = false;

const startArrowNudgeLoop = () => {
  if (arrowNudgeRafId !== null) return;

  const nudgeLoop = () => {
    if (activeArrowKeys.size === 0 || props.selectedIds.length === 0) {
      if (arrowNudgeRafId !== null) {
        cancelAnimationFrame(arrowNudgeRafId);
        arrowNudgeRafId = null;
      }
      return;
    }

    const step = isShiftPressedForNudge ? 5 : 1;
    let dx = 0;
    let dy = 0;
    if (activeArrowKeys.has('ArrowUp')) dy -= step;
    if (activeArrowKeys.has('ArrowDown')) dy += step;
    if (activeArrowKeys.has('ArrowLeft')) dx -= step;
    if (activeArrowKeys.has('ArrowRight')) dx += step;

    if (dx !== 0 || dy !== 0) {
      const updated = selectedComponents.value
        .filter(c => !c.locked)
        .map(c => ({
          ...c,
          x: c.x + dx,
          y: c.y + dy
        }));

      if (updated.length > 0) {
        emit('update:components', updated);
        hasArrowNudgePendingHistory = true;
      }
    }

    arrowNudgeRafId = requestAnimationFrame(nudgeLoop);
  };

  arrowNudgeRafId = requestAnimationFrame(nudgeLoop);
};

const stopArrowNudgeKey = (key?: string) => {
  if (key) {
    activeArrowKeys.delete(key);
  } else {
    activeArrowKeys.clear();
  }

  if (activeArrowKeys.size === 0) {
    if (arrowNudgeRafId !== null) {
      cancelAnimationFrame(arrowNudgeRafId);
      arrowNudgeRafId = null;
    }
    if (hasArrowNudgePendingHistory) {
      clearTimeout(arrowNudgeHistoryTimer);
      arrowNudgeHistoryTimer = setTimeout(() => {
        if (hasArrowNudgePendingHistory) {
          emit('commit:history');
          hasArrowNudgePendingHistory = false;
        }
      }, 150);
    }
  }
};

// Keyboard Shortcuts
const handleKeyDown = (e: KeyboardEvent) => {
  // 1. 放行中文输入法正在输入状态 (IME Composition)
  if (e.isComposing || e.keyCode === 229) return;

  // 2. 核心修复：放行系统输入法切换快捷键 (如 Linux 凝思系统的 Ctrl+Space, Shift+Space, Alt+Space, Ctrl+Shift)
  // 绝对不拦截、不 preventDefault，也不触发空格画布拖拽
  if ((e.code === 'Space' || e.key === ' ' || e.keyCode === 32) && (e.ctrlKey || e.metaKey || e.altKey)) {
    return;
  }

  // 3. 仅当单独按下空格键 (无 Ctrl/Meta/Alt) 且未聚焦在输入控件时，才激活画布抓手平移模式
  if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey && !isSpacePressed.value) {
    const target = e.target as HTMLElement;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) && !target?.isContentEditable) {
      isSpacePressed.value = true;
    }
  }

  const target = e.target as HTMLElement;
  if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;

  // Arrow key micro-nudges: robust continuous nudge on both Web & Linux Electron
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    if (props.selectedIds.length === 0) return;

    isShiftPressedForNudge = e.shiftKey;
    const wasEmpty = activeArrowKeys.size === 0;
    activeArrowKeys.add(e.key);

    // Initial nudge step on first press
    if (wasEmpty || !e.repeat) {
      const step = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp') dy = -step;
      if (e.key === 'ArrowDown') dy = step;
      if (e.key === 'ArrowLeft') dx = -step;
      if (e.key === 'ArrowRight') dx = step;

      const updated = selectedComponents.value
        .filter(c => !c.locked)
        .map(c => ({
          ...c,
          x: c.x + dx,
          y: c.y + dy
        }));

      if (updated.length > 0) {
        emit('update:components', updated);
        hasArrowNudgePendingHistory = true;
      }
    }

    startArrowNudgeLoop();
    return;
  }

  const isCtrlOrMeta = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  // Undo (Ctrl+Z)
  if (isCtrlOrMeta && !e.shiftKey && key === 'z') {
    e.preventDefault();
    emit('undo');
    return;
  }

  // Redo (Ctrl+Y or Ctrl+Shift+Z)
  if ((isCtrlOrMeta && key === 'y') || (isCtrlOrMeta && e.shiftKey && key === 'z')) {
    e.preventDefault();
    emit('redo');
    return;
  }

  // Select all (Ctrl+A)
  if (isCtrlOrMeta && key === 'a') {
    e.preventDefault();
    if (props.components.length > 0) {
      emit('select', props.components.map(c => c.id));
    }
    return;
  }

  // Paste (Ctrl+V)
  if (isCtrlOrMeta && key === 'v') {
    e.preventDefault();
    emit('paste', { x: mousePos.value.x, y: mousePos.value.y });
    return;
  }

  // Escape to cancel drawing or clear selection
  if (e.key === 'Escape') {
    if (polylineDrawing.value.active || arrowDrawing.value.active) {
      polylineDrawing.value.active = false;
      polylineDrawing.value.points = [];
      arrowDrawing.value.active = false;
      emit('finish:draw');
    } else {
      emit('select', []);
    }
    return;
  }

  // Enter to finish polyline or arrow
  if (e.key === 'Enter') {
    if (polylineDrawing.value.active) {
      handleCanvasDblClick();
      return;
    }
    if (arrowDrawing.value.active) {
      finishArrowDrawing();
      return;
    }
  }

  if (props.selectedIds.length === 0) return;

  // Copy (Ctrl+C)
  if (isCtrlOrMeta && key === 'c') {
    e.preventDefault();
    emit('copy', selectedComponents.value);
    return;
  }

  // Cut (Ctrl+X)
  if (isCtrlOrMeta && key === 'x') {
    e.preventDefault();
    emit('cut', selectedComponents.value);
    return;
  }

  // Duplicate (Ctrl+D)
  if (isCtrlOrMeta && key === 'd') {
    e.preventDefault();
    emit('duplicate', selectedComponents.value);
    return;
  }

  // Delete
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    emit('delete', props.selectedIds);
    return;
  }

  // Group (Ctrl+G)
  if (isCtrlOrMeta && !e.shiftKey && key === 'g') {
    if (props.selectedIds.length >= 2) {
      e.preventDefault();
      emit('group', selectedComponents.value);
      return;
    }
  }

  // Ungroup (Ctrl+Shift+G or Ctrl+U)
  if ((isCtrlOrMeta && e.shiftKey && key === 'g') || (isCtrlOrMeta && key === 'u')) {
    if (props.selectedIds.length === 1 && (primarySelected.value?.children?.length || primarySelected.value?.type === 'composite-symbol')) {
      e.preventDefault();
      emit('ungroup', primarySelected.value!);
      return;
    }
  }

  // Layer shortcuts
  if (isCtrlOrMeta && (key === ']' || key === '}')) {
    e.preventDefault();
    if (e.shiftKey) {
      emit('bring:front', props.selectedIds);
    } else {
      emit('move:up', props.selectedIds);
    }
    return;
  }

  if (isCtrlOrMeta && (key === '[' || key === '{')) {
    e.preventDefault();
    if (e.shiftKey) {
      emit('send:back', props.selectedIds);
    } else {
      emit('move:down', props.selectedIds);
    }
    return;
  }
};

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
    isSpacePressed.value = false;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    stopArrowNudgeKey(e.key);
  }
};

const handleWindowBlur = () => {
  isSpacePressed.value = false;
  for (let i = 0; i < cachedDragNodes.length; i++) {
    const item = cachedDragNodes[i];
    item.el.style.transform = item.baseTransform;
  }
  cachedDragNodes = [];
  dragOffset = { dx: 0, dy: 0 };
  isDragging.value = false;
  hasMovedDrag.value = false;
  isPanning.value = false;
  isSelectingMarquee.value = false;
  hasMovedMarquee.value = false;
  isResizing.value = false;
  isRotating.value = false;
  stopArrowNudgeKey();
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('mousemove', handleMouseMoveWorkspace);
  window.addEventListener('mouseup', handleMouseUpWorkspace);
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('resize', handleFitAndCenter);
});

onBeforeUnmount(() => {
  stopArrowNudgeKey();
  if (arrowNudgeHistoryTimer) {
    clearTimeout(arrowNudgeHistoryTimer);
  }
  if (mouseMoveRaf !== null) {
    cancelAnimationFrame(mouseMoveRaf);
    mouseMoveRaf = null;
  }
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('blur', handleWindowBlur);
  window.removeEventListener('mousemove', handleMouseMoveWorkspace);
  window.removeEventListener('mouseup', handleMouseUpWorkspace);
  window.removeEventListener('click', closeContextMenu);
  window.removeEventListener('resize', handleFitAndCenter);
});

defineExpose({
  snapAllToGrid: handleSnapAllToGrid,
  centerAll: handleFitAndCenter,
  centerView: handleFitAndCenter,
  fitAndCenter: handleFitAndCenter,
  fitToScreen: handleFitAndCenter,
  alignToOrigin: handleAlignToOrigin,
  resetOrigin: handleResetViewport
});
</script>

<template>
  <div 
    ref="containerRef"
    @wheel.prevent="onWheelWorkspace"
    @contextmenu.prevent="handleCanvasContextMenu"
    class="flex-1 h-full bg-black relative overflow-hidden select-none flex flex-col"
    :class="{
      'cursor-move': isSpacePressed || isPanning,
      'cursor-crosshair': drawTool !== 'select'
    }"
  >
    <!-- Rulers on Top & Left (Toggleable via top switch) -->
    <Ruler
      v-if="showRuler"
      :width="screen.width"
      :height="screen.height"
      :zoom="zoom"
      :panOffset="panOffset"
      :cursorPos="mousePos"
    />

    <!-- Infinite Canvas Viewport Stage -->
    <div 
      ref="infinitePlaneRef"
      class="flex-1 w-full h-full relative overflow-hidden infinite-canvas-plane"
      :class="{
        'drawing-mode-active': drawTool !== 'select',
        'cursor-crosshair': drawTool !== 'select',
        'cursor-move': isSpacePressed || isPanning,
        'cursor-default': drawTool === 'select' && !isSpacePressed && !isPanning
      }"
      :style="{
        backgroundColor: (screen.backgroundColor && screen.backgroundColor !== '#0f223d') ? screen.backgroundColor : '#000000'
      }"
      @mousedown="handleCanvasMouseDown"
      @click="handleCanvasClick"
      @dblclick="handleCanvasDblClick"
      @contextmenu.stop.prevent="handleCanvasContextMenu"
      @wheel="onWheelWorkspace"
      @dragover="handleDragOver"
      @drop="handleDrop"
    >
      <!-- Components Transformation Layer (Translates & Scales smoothly) -->
      <div
        ref="canvasWrapperRef"
        class="absolute origin-top-left transition-none pointer-events-none w-0 h-0"
        :style="{
          left: `${panOffset.x}px`,
          top: `${panOffset.y}px`,
          transform: `scale(${zoom})`
        }"
      >
        <!-- Strict Mathematical Canvas Grid (严格一致的格点尺寸，与图元坐标空间 100% 同步缩放，彻底消除亚像素位移与伪歪斜) -->
        <svg
          v-if="showGrid"
          class="absolute pointer-events-none overflow-visible select-none -z-10"
          :style="{
            left: `${gridSvgBounds.x}px`,
            top: `${gridSvgBounds.y}px`,
            width: `${gridSvgBounds.width}px`,
            height: `${gridSvgBounds.height}px`
          }"
        >
          <defs>
            <pattern
              :id="`scada-strict-grid-${gridSize}`"
              :width="gridSize"
              :height="gridSize"
              patternUnits="userSpaceOnUse"
              overflow="visible"
            >
              <!-- 在网格交点 (0,0) 及四角完整绘制微调圆点，shape-rendering crispEdges 保障每个交点格点尺寸绝对严格一致 -->
              <circle
                :cx="0"
                :cy="0"
                r="1.25"
                :fill="effectiveGridColor"
                shape-rendering="crispEdges"
              />
              <circle
                :cx="gridSize"
                :cy="0"
                r="1.25"
                :fill="effectiveGridColor"
                shape-rendering="crispEdges"
              />
              <circle
                :cx="0"
                :cy="gridSize"
                r="1.25"
                :fill="effectiveGridColor"
                shape-rendering="crispEdges"
              />
              <circle
                :cx="gridSize"
                :cy="gridSize"
                r="1.25"
                :fill="effectiveGridColor"
                shape-rendering="crispEdges"
              />
            </pattern>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            :fill="`url(#scada-strict-grid-${gridSize})`"
          />
        </svg>

        <!-- Render All Screen Components in Layer Order -->
        <div
          v-for="comp in components"
          :key="comp.id"
          :data-component-id="comp.id"
          @mousedown="handleCompMouseDown($event, comp)"
          @click="handleCompClick($event, comp)"
          @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
          class="absolute group component-node select-none"
          :class="{
            'cursor-move': drawTool === 'select' && !comp.locked && !isLineComponent(comp.type),
            'pointer-events-auto': drawTool === 'select' && comp.visible !== false && !isLineComponent(comp.type),
            'pointer-events-none': drawTool !== 'select' || comp.visible === false || isLineComponent(comp.type),
            'opacity-40': comp.visible === false,
            'cursor-default': comp.locked && drawTool === 'select'
          }"
          :style="{
            left: `${comp.x}px`,
            top: `${comp.y}px`,
            width: `${Math.max(2, comp.width)}px`,
            height: `${Math.max(2, comp.height)}px`,
            minWidth: '4px',
            minHeight: '4px',
            transform: comp.rotation ? `rotate(${comp.rotation}deg)` : undefined,
            transformOrigin: 'center center',
            zIndex: comp.zIndex || 1
          }"
        >
          <!-- Component Content -->
          <WidgetRenderer
            :component="comp"
            :datasets="datasets"
            :preview-mode="false"
          />

          <!-- Locked Indicator Badge -->
          <div 
            v-if="comp.locked" 
            @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
            class="absolute top-1 right-1 p-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-500/40 z-30 pointer-events-auto cursor-pointer"
            :style="{ transform: `scale(${invZoom})`, transformOrigin: 'top right' }"
            title="图元已锁定 (右击可解锁)"
          >
            <Lock class="w-3 h-3 stroke-[2]" />
          </div>
        </div>

        <!-- High-Performance Dedicated Selection & Transform Overlay (Iterates ONLY over selectedComponents: 0, 1, or few items) -->
        <div 
          v-if="drawTool === 'select' && selectedComponents.length > 0"
          class="pointer-events-none selection-overlay"
        >
          <div
            v-for="comp in selectedComponents"
            :key="'sel-' + comp.id"
            :data-component-id="comp.id"
            @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
            class="absolute pointer-events-none selection-box"
            :style="{
              left: `${comp.x}px`,
              top: `${comp.y}px`,
              width: `${Math.max(4, comp.width)}px`,
              height: `${Math.max(4, comp.height)}px`,
              transform: comp.rotation ? `rotate(${comp.rotation}deg)` : undefined,
              transformOrigin: 'center center',
              zIndex: 99999
            }"
          >
            <!-- 1. Line / Polyline Dedicated Selection & Transform State (Preserve real stroke color, show vertex nodes) -->
            <template v-if="isLineComponent(comp.type)">
              <!-- Polyline Vertex Control Node Handles (Inflection points & endpoints: 恒定屏幕物理像素尺寸，放大不膨胀) -->
              <template v-if="comp.type === 'draw-polyline' || comp.type === 'polyline'">
                <div
                  v-for="(pt, idx) in getPolylinePoints(comp)"
                  :key="idx"
                  class="absolute pointer-events-auto flex items-center justify-center group/node cursor-crosshair z-50 select-none"
                  :style="{
                    left: `${pt.x}px`,
                    top: `${pt.y}px`,
                    width: '22px',
                    height: '22px',
                    transform: `translate(-50%, -50%) scale(${invZoom})`,
                    transformOrigin: 'center center'
                  }"
                  @mousedown="handleStartVertexDrag($event, comp, idx)"
                  @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                  :title="`拖动拐点/端点 ${idx + 1} 进行拉伸调整`"
                >
                  <div 
                    class="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-[0_0_8px_rgba(0,242,255,0.9)] group-hover/node:scale-125 group-hover/node:bg-amber-400 active:scale-135 transition-transform"
                  />
                </div>
              </template>

              <!-- Straight Line / Arrow Endpoint Handles (恒定屏幕像素尺寸) -->
              <template v-else-if="comp.type === 'draw-line' || comp.type === 'draw-arrow' || comp.type === 'straight-line'">
                <!-- Start Node -->
                <div
                  class="absolute pointer-events-auto flex items-center justify-center group/node cursor-crosshair z-50 select-none"
                  :style="{
                    left: `${getStraightLinePoints(comp).x1}px`,
                    top: `${getStraightLinePoints(comp).y1}px`,
                    width: '22px',
                    height: '22px',
                    transform: `translate(-50%, -50%) scale(${invZoom})`,
                    transformOrigin: 'center center'
                  }"
                  @mousedown="handleStartVertexDrag($event, comp, 0)"
                  @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                  title="拖动起点进行拉伸调整"
                >
                  <div 
                    class="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-[0_0_8px_rgba(0,242,255,0.9)] group-hover/node:scale-125 group-hover/node:bg-amber-400 active:scale-135 transition-transform"
                  />
                </div>
                <!-- End Node -->
                <div
                  class="absolute pointer-events-auto flex items-center justify-center group/node cursor-crosshair z-50 select-none"
                  :style="{
                    left: `${getStraightLinePoints(comp).x2}px`,
                    top: `${getStraightLinePoints(comp).y2}px`,
                    width: '22px',
                    height: '22px',
                    transform: `translate(-50%, -50%) scale(${invZoom})`,
                    transformOrigin: 'center center'
                  }"
                  @mousedown="handleStartVertexDrag($event, comp, 1)"
                  @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                  title="拖动终点进行拉伸调整"
                >
                  <div 
                    class="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-[0_0_8px_rgba(0,242,255,0.9)] group-hover/node:scale-125 group-hover/node:bg-amber-400 active:scale-135 transition-transform"
                  />
                </div>
              </template>

              <!-- Line Rotation Grip (恒定屏幕大小) -->
              <div 
                v-if="!comp.locked" 
                class="absolute left-1/2 flex flex-col items-center pointer-events-auto z-50 select-none"
                :style="{
                  top: '0px',
                  transform: `translate(-50%, -100%) scale(${invZoom})`,
                  transformOrigin: 'bottom center',
                  paddingBottom: '6px'
                }"
                @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
              >
                <div 
                  @mousedown="handleStartRotate"
                  class="w-6 h-6 bg-cyan-400 text-slate-950 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg hover:scale-115 transition-transform"
                  title="按住旋转 (按Shift吸附15°)"
                >
                  <RotateCw class="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div class="w-[1.5px] h-2 bg-cyan-400" />
              </div>
            </template>

            <!-- 2. Non-Line Components Single Selection: Clean Corner & Edge Grips without rectangular solid border -->
            <div 
              v-else-if="selectedIds.length === 1"
              class="absolute inset-0 pointer-events-none"
            >
              <!-- 4 Subtle Corner Accent Markers (恒定屏幕细度) -->
              <div class="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400 pointer-events-none" :style="{ transform: `scale(${invZoom})`, transformOrigin: 'top left' }" />
              <div class="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-400 pointer-events-none" :style="{ transform: `scale(${invZoom})`, transformOrigin: 'top right' }" />
              <div class="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-400 pointer-events-none" :style="{ transform: `scale(${invZoom})`, transformOrigin: 'bottom left' }" />
              <div class="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400 pointer-events-none" :style="{ transform: `scale(${invZoom})`, transformOrigin: 'bottom right' }" />

              <!-- Top Rotation Handle (恒定屏幕大小) -->
              <template v-if="!comp.locked">
                <div 
                  class="absolute left-1/2 flex flex-col items-center pointer-events-auto z-50 select-none"
                  :style="{
                    top: '0px',
                    transform: `translate(-50%, -100%) scale(${invZoom})`,
                    transformOrigin: 'bottom center',
                    paddingBottom: '6px'
                  }"
                  @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                >
                  <div 
                    @mousedown="handleStartRotate"
                    class="w-6 h-6 bg-cyan-400 text-slate-950 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg hover:scale-115 transition-transform"
                    title="按住旋转 (按Shift吸附15°)"
                  >
                    <RotateCw class="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <div class="w-[1.5px] h-2 bg-cyan-400" />
                </div>

                <!-- 4 Interactive Edge Resize Bars (For Solid Components: 恒定屏幕触控宽度) -->
                <template v-if="!isHollowComponent(comp)">
                  <div 
                    v-if="comp.height * (Number(props.zoom) || Number(zoom) || 1) >= 24"
                    @mousedown="handleStartResize($event, 'n')"
                    @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                    class="pointer-events-auto absolute left-2 right-2 cursor-ns-resize z-40 group/edge hover:bg-cyan-400/20 rounded-xs transition-colors"
                    :style="{
                      top: '0px',
                      height: `${12 * invZoom}px`,
                      transform: 'translateY(-50%)'
                    }"
                    title="拖动调整高度 (上边框)"
                  />
                  <div 
                    v-if="comp.height * (Number(props.zoom) || Number(zoom) || 1) >= 24"
                    @mousedown="handleStartResize($event, 's')"
                    @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                    class="pointer-events-auto absolute left-2 right-2 cursor-ns-resize z-40 group/edge hover:bg-cyan-400/20 rounded-xs transition-colors"
                    :style="{
                      bottom: '0px',
                      height: `${12 * invZoom}px`,
                      transform: 'translateY(50%)'
                    }"
                    title="拖动调整高度 (下边框)"
                  />
                  <div 
                    v-if="comp.width * (Number(props.zoom) || Number(zoom) || 1) >= 24"
                    @mousedown="handleStartResize($event, 'w')"
                    @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                    class="pointer-events-auto absolute top-2 bottom-2 cursor-ew-resize z-40 group/edge hover:bg-cyan-400/20 rounded-xs transition-colors"
                    :style="{
                      left: '0px',
                      width: `${12 * invZoom}px`,
                      transform: 'translateX(-50%)'
                    }"
                    title="拖动调整宽度 (左边框)"
                  />
                  <div 
                    v-if="comp.width * (Number(props.zoom) || Number(zoom) || 1) >= 24"
                    @mousedown="handleStartResize($event, 'e')"
                    @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                    class="pointer-events-auto absolute top-2 bottom-2 cursor-ew-resize z-40 group/edge hover:bg-cyan-400/20 rounded-xs transition-colors"
                    :style="{
                      right: '0px',
                      width: `${12 * invZoom}px`,
                      transform: 'translateX(50%)'
                    }"
                    title="拖动调整宽度 (右边框)"
                  />
                </template>

                <!-- For Hollow / Cyber Border Components: 4 Edge Drag Strips & Move Grip so the selected border is effortless to drag -->
                <template v-else>
                  <div 
                    @mousedown.stop="handleStartDrag($event, comp)"
                    @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                    class="pointer-events-auto absolute -top-2.5 left-4 right-4 h-5 cursor-move z-30 group/edge-drag hover:bg-cyan-400/20 transition-colors"
                    title="按住边框拖动位置"
                  />
                  <div 
                    @mousedown.stop="handleStartDrag($event, comp)"
                    @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                    class="pointer-events-auto absolute -bottom-2.5 left-4 right-4 h-5 cursor-move z-30 group/edge-drag hover:bg-cyan-400/20 transition-colors"
                    title="按住边框拖动位置"
                  />
                  <div 
                    @mousedown.stop="handleStartDrag($event, comp)"
                    @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                    class="pointer-events-auto absolute top-4 bottom-4 -left-2.5 w-5 cursor-move z-30 group/edge-drag hover:bg-cyan-400/20 transition-colors"
                    title="按住边框拖动位置"
                  />
                  <div 
                    @mousedown.stop="handleStartDrag($event, comp)"
                    @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                    class="pointer-events-auto absolute top-4 bottom-4 -right-2.5 w-5 cursor-move z-30 group/edge-drag hover:bg-cyan-400/20 transition-colors"
                    title="按住边框拖动位置"
                  />

                  <!-- Dedicated Floating Move Grip Badge for Cyber Border (恒定屏幕大小) -->
                  <div 
                    @mousedown.stop="handleStartDrag($event, comp)"
                    @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                    class="pointer-events-auto absolute left-3 px-2 py-0.5 rounded-t bg-cyan-950/95 text-cyan-300 border border-b-0 border-cyan-500/60 text-[11px] font-mono flex items-center gap-1.5 cursor-move shadow-md z-40 hover:bg-cyan-900 transition-colors select-none"
                    :style="{
                      top: '0px',
                      transform: `translateY(-100%) scale(${invZoom})`,
                      transformOrigin: 'bottom left'
                    }"
                    title="按住拖动科技边框"
                  >
                    <Move class="w-3 h-3 text-cyan-400" />
                    <span>边框拖动</span>
                  </div>
                </template>

                <!-- 8 Resize Corner & Mid-point Handles (严格恒定 10px 物理屏幕抓手尺寸，放大绝不膨胀遮挡小图元) -->
                <!-- NW (Top-Left) -->
                <div 
                  @mousedown="handleStartResize($event, 'nw')"
                  @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                  class="group pointer-events-auto absolute w-5 h-5 flex items-center justify-center cursor-nwse-resize z-50 select-none"
                  :style="{
                    left: '0%',
                    top: '0%',
                    transform: `translate(-50%, -50%) scale(${invZoom})`,
                    transformOrigin: 'center center'
                  }"
                  title="缩放调整 (左上角)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-125 transition-transform" />
                </div>

                <!-- N (Top-Center) -->
                <div 
                  v-if="comp.height * (Number(props.zoom) || Number(zoom) || 1) >= 28"
                  @mousedown="handleStartResize($event, 'n')"
                  @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                  class="group pointer-events-auto absolute w-5 h-5 flex items-center justify-center cursor-ns-resize z-50 select-none"
                  :style="{
                    left: '50%',
                    top: '0%',
                    transform: `translate(-50%, -50%) scale(${invZoom})`,
                    transformOrigin: 'center center'
                  }"
                  title="调整高度 (上中点)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-125 transition-transform" />
                </div>

                <!-- NE (Top-Right) -->
                <div 
                  @mousedown="handleStartResize($event, 'ne')"
                  @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                  class="group pointer-events-auto absolute w-5 h-5 flex items-center justify-center cursor-nesw-resize z-50 select-none"
                  :style="{
                    left: '100%',
                    top: '0%',
                    transform: `translate(-50%, -50%) scale(${invZoom})`,
                    transformOrigin: 'center center'
                  }"
                  title="缩放调整 (右上角)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-125 transition-transform" />
                </div>

                <!-- E (Right-Center) -->
                <div 
                  v-if="comp.width * (Number(props.zoom) || Number(zoom) || 1) >= 28"
                  @mousedown="handleStartResize($event, 'e')"
                  @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                  class="group pointer-events-auto absolute w-5 h-5 flex items-center justify-center cursor-ew-resize z-50 select-none"
                  :style="{
                    left: '100%',
                    top: '50%',
                    transform: `translate(-50%, -50%) scale(${invZoom})`,
                    transformOrigin: 'center center'
                  }"
                  title="调整宽度 (右中点)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-125 transition-transform" />
                </div>

                <!-- SE (Bottom-Right) -->
                <div 
                  @mousedown="handleStartResize($event, 'se')"
                  @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                  class="group pointer-events-auto absolute w-5 h-5 flex items-center justify-center cursor-nwse-resize z-50 select-none"
                  :style="{
                    left: '100%',
                    top: '100%',
                    transform: `translate(-50%, -50%) scale(${invZoom})`,
                    transformOrigin: 'center center'
                  }"
                  title="缩放调整 (右下角)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-125 transition-transform" />
                </div>

                <!-- S (Bottom-Center) -->
                <div 
                  v-if="comp.height * (Number(props.zoom) || Number(zoom) || 1) >= 28"
                  @mousedown="handleStartResize($event, 's')"
                  @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                  class="group pointer-events-auto absolute w-5 h-5 flex items-center justify-center cursor-ns-resize z-50 select-none"
                  :style="{
                    left: '50%',
                    top: '100%',
                    transform: `translate(-50%, -50%) scale(${invZoom})`,
                    transformOrigin: 'center center'
                  }"
                  title="调整高度 (下中点)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-125 transition-transform" />
                </div>

                <!-- SW (Bottom-Left) -->
                <div 
                  @mousedown="handleStartResize($event, 'sw')"
                  @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                  class="group pointer-events-auto absolute w-5 h-5 flex items-center justify-center cursor-nesw-resize z-50 select-none"
                  :style="{
                    left: '0%',
                    top: '100%',
                    transform: `translate(-50%, -50%) scale(${invZoom})`,
                    transformOrigin: 'center center'
                  }"
                  title="缩放调整 (左下角)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-125 transition-transform" />
                </div>

                <!-- W (Left-Center) -->
                <div 
                  v-if="comp.width * (Number(props.zoom) || Number(zoom) || 1) >= 28"
                  @mousedown="handleStartResize($event, 'w')"
                  @contextmenu.stop.prevent="handleContextMenu($event, comp.id)"
                  class="group pointer-events-auto absolute w-5 h-5 flex items-center justify-center cursor-ew-resize z-50 select-none"
                  :style="{
                    left: '0%',
                    top: '50%',
                    transform: `translate(-50%, -50%) scale(${invZoom})`,
                    transformOrigin: 'center center'
                  }"
                  title="调整宽度 (左中点)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-125 transition-transform" />
                </div>
              </template>
            </div>

            <!-- 3. Multi-Selection Active State: Clean subtle corner accents (恒定屏幕大小) -->
            <div 
              v-else
              class="absolute inset-0 pointer-events-none"
            >
              <div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400/80 pointer-events-none" :style="{ transform: `scale(${invZoom})`, transformOrigin: 'top left' }" />
              <div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-400/80 pointer-events-none" :style="{ transform: `scale(${invZoom})`, transformOrigin: 'top right' }" />
              <div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-400/80 pointer-events-none" :style="{ transform: `scale(${invZoom})`, transformOrigin: 'bottom left' }" />
              <div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400/80 pointer-events-none" :style="{ transform: `scale(${invZoom})`, transformOrigin: 'bottom right' }" />
            </div>
          </div>
        </div>

        <!-- Overall Multi-Selection Group Bounding Box (Visual Only, No Floating Menu) -->
        <div
          v-if="drawTool === 'select' && selectedGroupBBox && selectedIds.length > 1"
          class="absolute border-2 border-dashed border-cyan-300/80 bg-cyan-400/[0.04] pointer-events-none z-45 shadow-[0_0_25px_rgba(0,242,255,0.25)] rounded-xs selected-group-bbox"
          :style="{
            left: `${selectedGroupBBox.minX - 4}px`,
            top: `${selectedGroupBBox.minY - 4}px`,
            width: `${selectedGroupBBox.width + 8}px`,
            height: `${selectedGroupBBox.height + 8}px`
          }"
        >
          <!-- 4 Corner Grip Markers for Group Frame -->
          <div class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-cyan-300 border-2 border-slate-950 rounded-xs shadow-xs" />
          <div class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-cyan-300 border-2 border-slate-950 rounded-xs shadow-xs" />
          <div class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-cyan-300 border-2 border-slate-950 rounded-xs shadow-xs" />
          <div class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-cyan-300 border-2 border-slate-950 rounded-xs shadow-xs" />
        </div>

        <!-- Marquee Drag Selection Box (拉框多选框: 需全包围) -->
        <div
          v-if="isSelectingMarquee"
          class="absolute border-2 border-cyan-400 bg-cyan-500/20 pointer-events-none z-50 border-dashed shadow-[0_0_15px_rgba(0,242,255,0.35)]"
          :style="{
            left: `${marqueeBox.x}px`,
            top: `${marqueeBox.y}px`,
            width: `${marqueeBox.width}px`,
            height: `${marqueeBox.height}px`
          }"
        >
          <!-- Live Marquee Tag Tooltip (实时提示已包围选中数量) -->
          <div
            v-if="marqueeBox.width > 20 && marqueeBox.height > 20"
            class="absolute -top-6 left-0 bg-[#060c18]/90 border border-cyan-400/80 text-cyan-300 px-1.5 py-0.5 rounded text-[10px] font-mono shadow-md whitespace-nowrap flex items-center gap-1"
          >
            <span>全包围选中: </span>
            <span class="font-bold text-white">{{ selectedIds.length }} 个元件</span>
          </div>
        </div>

        <!-- Interactive Polyline Drawing Live SVG Overlay (Rendered in Canvas Coordinate Space) -->
        <svg 
          v-if="drawTool === 'draw-polyline'" 
          class="absolute top-0 left-0 pointer-events-none z-50 overflow-visible"
          style="width: 1px; height: 1px;"
        >
          <!-- Active placed polyline segments -->
          <template v-if="polylineDrawing.active && polylineDrawing.points.length > 0">
            <!-- Outer glowing aura path -->
            <polyline
              :points="getPolylinePreviewPoints()"
              fill="none"
              :stroke="props.drawingPreset?.stroke || '#00f2ff'"
              :stroke-width="(props.drawingPreset?.strokeWidth || 3) + 4"
              stroke-opacity="0.35"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <!-- Main dashed vector line -->
            <polyline
              :points="getPolylinePreviewPoints()"
              fill="none"
              :stroke="props.drawingPreset?.stroke || '#00f2ff'"
              :stroke-width="props.drawingPreset?.strokeWidth || 3"
              :stroke-dasharray="props.drawingPreset?.lineStyle === 'dashed' ? '8 4' : (props.drawingPreset?.lineStyle === 'dotted' ? '3 3' : undefined)"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <!-- Dynamic connecting line from last vertex to moving cursor -->
            <line
              :x1="polylineDrawing.points[polylineDrawing.points.length - 1].x"
              :y1="polylineDrawing.points[polylineDrawing.points.length - 1].y"
              :x2="polylineDrawing.currentX"
              :y2="polylineDrawing.currentY"
              :stroke="props.drawingPreset?.stroke || '#00e5a3'"
              :stroke-width="props.drawingPreset?.strokeWidth || 2"
              stroke-dasharray="4 3"
            />
            <!-- Placed vertices -->
            <g v-for="(p, idx) in polylineDrawing.points" :key="idx">
              <circle 
                :cx="p.x" 
                :cy="p.y" 
                r="5" 
                :fill="props.drawingPreset?.stroke || '#00f2ff'" 
                stroke="#040810"
                stroke-width="1.5"
              />
            </g>
          </template>

          <!-- Current moving cursor vertex indicator -->
          <g :transform="`translate(${polylineDrawing.currentX}, ${polylineDrawing.currentY})`">
            <circle 
              cx="0" 
              cy="0" 
              r="6" 
              :fill="props.drawingPreset?.stroke || '#00e5a3'" 
              stroke="#040810"
              stroke-width="2"
            />
            <circle 
              cx="0" 
              cy="0" 
              r="12" 
              fill="none" 
              :stroke="props.drawingPreset?.stroke || '#00e5a3'" 
              stroke-width="1.5"
              stroke-dasharray="3 3"
            />
          </g>
        </svg>

        <!-- Interactive Arrow Drawing Live SVG Overlay (Rendered in Canvas Coordinate Space) -->
        <svg 
          v-if="drawTool === 'draw-arrow'" 
          class="absolute top-0 left-0 pointer-events-none z-50 overflow-visible"
          style="width: 1px; height: 1px;"
        >
          <defs>
            <marker
              id="preview-arrow-head"
              markerWidth="10"
              markerHeight="10"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L9,3 z" :fill="props.drawingPreset?.stroke || '#00f2ff'" />
            </marker>
          </defs>
          <template v-if="arrowDrawing.active">
            <!-- Outer glowing aura path -->
            <line
              :x1="arrowDrawing.startX"
              :y1="arrowDrawing.startY"
              :x2="arrowDrawing.currentX"
              :y2="arrowDrawing.currentY"
              :stroke="props.drawingPreset?.stroke || '#00f2ff'"
              :stroke-width="(props.drawingPreset?.strokeWidth || 3) + 4"
              stroke-opacity="0.35"
              stroke-linecap="round"
            />
            <!-- Main dashed vector line with arrowhead -->
            <line
              :x1="arrowDrawing.startX"
              :y1="arrowDrawing.startY"
              :x2="arrowDrawing.currentX"
              :y2="arrowDrawing.currentY"
              :stroke="props.drawingPreset?.stroke || '#00f2ff'"
              :stroke-width="props.drawingPreset?.strokeWidth || 3"
              :stroke-dasharray="props.drawingPreset?.lineStyle === 'dashed' ? '6 3' : (props.drawingPreset?.lineStyle === 'dotted' ? '3 3' : undefined)"
              stroke-linecap="round"
              marker-end="url(#preview-arrow-head)"
            />
            <!-- Start vertex circle -->
            <circle
              :cx="arrowDrawing.startX"
              :cy="arrowDrawing.startY"
              r="6"
              :fill="props.drawingPreset?.stroke || '#00f2ff'"
              stroke="#040810"
              stroke-width="2"
            />
          </template>

          <!-- Current moving cursor vertex indicator -->
          <g :transform="`translate(${arrowDrawing.currentX}, ${arrowDrawing.currentY})`">
            <circle 
              cx="0" 
              cy="0" 
              r="6" 
              fill="#00e5a3" 
              stroke="#040810"
              stroke-width="2"
            />
            <circle 
              cx="0" 
              cy="0" 
              r="12" 
              fill="none" 
              stroke="#00e5a3" 
              stroke-width="1.5"
              stroke-dasharray="3 3"
            />
          </g>
        </svg>

        <!-- Real-Time Synchronous Component Visual Preview (实时同步扩大显示组件/图形本体，不再画斜线) -->
        <div
          v-if="placementPreviewComponent"
          class="absolute pointer-events-none z-45"
          :style="{
            left: `${placementPreviewComponent.x}px`,
            top: `${placementPreviewComponent.y}px`,
            width: `${placementPreviewComponent.width}px`,
            height: `${placementPreviewComponent.height}px`
          }"
        >
          <!-- Real component rendering (scales dynamically in real-time) -->
          <WidgetRenderer
            :component="placementPreviewComponent"
            :datasets="datasets"
            :preview-mode="false"
          />

          <!-- Subtle glowing boundary box with 4 cyan corner accents -->
          <div class="absolute -inset-0.5 border border-cyan-400 border-dashed bg-cyan-400/10 pointer-events-none rounded-xs shadow-[0_0_12px_rgba(0,242,255,0.45)]">
            <div class="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-cyan-300" />
            <div class="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-cyan-300" />
            <div class="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-cyan-300" />
            <div class="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-cyan-300" />
          </div>
        </div>

        <!-- Interactive Component Placement Live SVG Overlay (单机选中后在屏幕自己确定起始和终止点) -->
        <svg 
          v-if="drawTool === 'place-component'" 
          class="absolute top-0 left-0 pointer-events-none z-50 overflow-visible"
          style="width: 1px; height: 1px;"
        >
          <template v-if="placeDrawing.active && placementPreviewComponent">
            <!-- Start Point Circle -->
            <circle
              :cx="placeDrawing.startX"
              :cy="placeDrawing.startY"
              r="6"
              fill="#00e5a3"
              stroke="#040810"
              stroke-width="2"
            />
            <circle
              :cx="placeDrawing.startX"
              :cy="placeDrawing.startY"
              r="11"
              fill="none"
              stroke="#00e5a3"
              stroke-width="1.5"
              stroke-dasharray="3 3"
            />

            <!-- End Point / Cursor Circle -->
            <circle
              :cx="placeDrawing.currentX"
              :cy="placeDrawing.currentY"
              r="6"
              fill="#00f2ff"
              stroke="#040810"
              stroke-width="2"
            />
            <circle
              :cx="placeDrawing.currentX"
              :cy="placeDrawing.currentY"
              r="12"
              fill="none"
              stroke="#00f2ff"
              stroke-width="1.5"
              stroke-dasharray="3 3"
            />
          </template>

          <!-- Cursor Hint when awaiting first click -->
          <template v-else>
            <g :transform="`translate(${placeDrawing.currentX}, ${placeDrawing.currentY})`">
              <circle 
                cx="0" 
                cy="0" 
                r="6" 
                fill="#00f2ff" 
                stroke="#040810" 
                stroke-width="2" 
              />
              <circle 
                cx="0" 
                cy="0" 
                r="14" 
                fill="none" 
                stroke="#00f2ff" 
                stroke-width="1.5" 
                stroke-dasharray="3 3" 
              />
            </g>
          </template>
        </svg>
      </div>
    </div>

    <!-- Right-Click Context Menu (去蓝色边框，不显示组件名称) -->
    <div
      v-if="contextMenu.visible"
      class="fixed bg-[#0b1322] border border-slate-700/80 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.95)] p-2 z-50 w-72 max-h-[calc(100vh-20px)] overflow-y-auto custom-scrollbar text-sm font-sans divide-y divide-slate-700/60"
      :style="{
        left: `${Math.round(contextMenu.x)}px`,
        top: `${Math.round(contextMenu.y)}px`,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'geometricPrecision',
        transform: 'translateZ(0)'
      }"
      @click.stop
      @contextmenu.stop.prevent
    >
      <template v-if="effectiveContextMenuIds.length > 0">
        <!-- 多选时仅提示数量，绝不显示具体组件名称 -->
        <div
          v-if="effectiveContextMenuIds.length > 1"
          class="px-3 py-1.5 text-xs font-medium text-slate-400 flex items-center justify-between tracking-wide"
        >
          <span>已选中 {{ effectiveContextMenuIds.length }} 个元件</span>
        </div>

        <div class="py-1.5 space-y-1">
          <!-- 批量关联测点数据 (当且仅当全部选中的为遥测或全部为遥信，且不含其他组件时出现) -->
          <button
            v-if="batchScadaType"
            @click="emit('open:batch-association', { components: effectiveContextMenuComponents, category: batchScadaType }); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#fbbf24]/20 rounded-lg text-[#fbbf24] hover:text-[#fde047] cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <Zap v-if="batchScadaType === 'yc'" class="w-4 h-4 text-[#fbbf24] stroke-[2]" />
              <Radio v-else class="w-4 h-4 text-[#c084fc] stroke-[2]" />
              <span class="font-bold text-[#fbbf24] group-hover:text-[#fde047] tracking-wide text-sm">
                {{ batchScadaType === 'yc' ? '批量关联遥测测点 (YC)' : '批量关联遥信测点 (YX)' }}
              </span>
            </div>
            <span class="text-xs font-mono font-bold text-[#fbbf24]/90">
              {{ effectiveContextMenuComponents.length }} 个元件
            </span>
          </button>

          <!-- Associate SCADA Data Point (单选时关联测点数据：厂站/装置/五遥/测点) -->
          <button
            v-if="canEffectivePrimaryAssociateData"
            @click="emit('open:data-association', effectivePrimaryComponent || undefined); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#00f2ff]/20 rounded-lg text-[#00f2ff] hover:text-[#38bdf8] cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <Database class="w-4 h-4 text-[#00f2ff] stroke-[2]" />
              <span class="font-bold text-[#00f2ff] group-hover:text-[#38bdf8] tracking-wide text-sm">关联测点数据</span>
            </div>
            <span class="text-xs text-[#38bdf8] font-mono font-bold tracking-wide">级联选择</span>
          </button>

          <!-- View / Edit Properties Inspector (选中右击查看属性) -->
          <button
            @click="emit('open:property-inspector'); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#38bdf8]/20 rounded-lg text-[#38bdf8] hover:text-[#00f2ff] cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <Sliders class="w-4 h-4 text-[#38bdf8] stroke-[2]" />
              <span class="font-bold text-[#38bdf8] group-hover:text-[#00f2ff] tracking-wide text-sm">查看属性面板</span>
            </div>
            <span class="text-xs text-[#00f2ff] font-mono font-bold">打开</span>
          </button>

          <!-- Copy (Ctrl+C) -->
          <button
            @click="emit('copy', effectiveContextMenuComponents); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#00f2ff]/20 rounded-lg text-[#00f2ff] hover:text-[#38bdf8] cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <Copy class="w-4 h-4 text-[#00f2ff] stroke-[2]" />
              <span class="font-bold text-[#00f2ff] tracking-wide text-sm">复制</span>
            </div>
            <span class="text-xs text-[#38bdf8] font-mono font-bold">Ctrl+C</span>
          </button>

          <!-- Cut (Ctrl+X) -->
          <button
            @click="emit('cut', effectiveContextMenuComponents); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#fbbf24]/20 rounded-lg text-[#fbbf24] hover:text-[#fde047] cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <Scissors class="w-4 h-4 text-[#fbbf24] stroke-[2]" />
              <span class="font-bold text-[#fbbf24] tracking-wide text-sm">剪切</span>
            </div>
            <span class="text-xs text-[#fbbf24] font-mono font-bold">Ctrl+X</span>
          </button>

          <!-- Paste (Ctrl+V) -->
          <button
            v-if="canPaste"
            @click="emit('paste', { x: contextMenu.canvasX, y: contextMenu.canvasY }); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#34d399]/20 rounded-lg text-[#34d399] hover:text-[#6ee7b7] cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <Clipboard class="w-4 h-4 text-[#34d399] stroke-[2]" />
              <span class="font-bold text-[#34d399] tracking-wide text-sm">粘贴到此处</span>
            </div>
            <span class="text-xs text-[#34d399] font-mono font-bold">Ctrl+V</span>
          </button>

          <!-- Duplicate (Ctrl+D) -->
          <button
            @click="emit('duplicate', effectiveContextMenuComponents); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#00f2ff]/20 rounded-lg text-[#00f2ff] hover:text-[#38bdf8] cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <Copy class="w-4 h-4 text-[#00f2ff] stroke-[2]" />
              <span class="font-bold text-[#00f2ff] tracking-wide text-sm">创建副本</span>
            </div>
            <span class="text-xs text-[#38bdf8] font-mono font-bold">Ctrl+D</span>
          </button>
        </div>

        <div class="py-1.5 space-y-1">
          <!-- SCADA YK/YT Execution -->
          <button
            v-if="primarySelectedHasControl"
            @click="() => {
              const comp = effectivePrimaryComponent;
              const bound = isComponentBoundToControlOrRegulation(comp);
              const data = comp?.data || {};
              const mapping = data.mapping || {};
              const action = data.action;
              const devId = String(bound.device?.dev_id || bound.device?.id || action?.deviceId || mapping.deviceId || '7000001');
              const ptId = bound.pointId || action?.pointId || action?.yk_id || action?.yt_id || mapping.pointId || mapping.yk_id || mapping.yt_id || null;
              const targetVId = bound.targetVerificationPointId || action?.targetVerificationPointId || action?.targetPointId || mapping.targetVerificationPointId || mapping.targetYcPointId || null;
              const type = bound.type || (mapping.pointCategory === 'teleRegulation' || action?.type === 'tele-regulation' ? 'yt' : 'yk');
              emit('open:control-modal', {
                deviceId: devId,
                pointId: ptId,
                targetVerificationPointId: targetVId,
                type
              });
              closeContextMenu();
            }"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#fbbf24]/20 rounded-lg text-[#fbbf24] hover:text-[#fde047] cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <Radio class="w-4 h-4 text-[#fbbf24] stroke-[2]" />
              <span class="font-bold text-[#fbbf24] group-hover:text-[#fde047] tracking-wide text-sm">执行遥控遥调 (YK/YT)</span>
            </div>
            <span class="text-xs text-[#fbbf24] font-mono font-bold">SCADA控制</span>
          </button>

          <!-- Group components (Ctrl+G) -->
          <button
            v-if="effectiveContextMenuIds.length >= 2"
            @click="emit('group', effectiveContextMenuComponents); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#c084fc]/20 rounded-lg text-[#c084fc] hover:text-[#d8b4fe] cursor-pointer flex items-center justify-between transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <span class="text-[#c084fc] font-bold tracking-wide text-sm">🧩 组合为群组</span>
            </div>
            <span class="text-xs text-[#c084fc] font-mono font-bold">Ctrl+G</span>
          </button>

          <!-- Ungroup component (Ctrl+U) -->
          <button
            v-if="effectiveContextMenuIds.length === 1 && (effectivePrimaryComponent?.children?.length || effectivePrimaryComponent?.type === 'composite-symbol')"
            @click="emit('ungroup', effectivePrimaryComponent!);"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#fbbf24]/20 rounded-lg text-[#fbbf24] hover:text-[#fde047] cursor-pointer flex items-center justify-between transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <span class="text-[#fbbf24] font-bold tracking-wide text-sm">🔓 取消组合为散装图元</span>
            </div>
            <span class="text-xs text-[#fbbf24] font-mono font-bold">Ctrl+U</span>
          </button>

          <button
            @click="emit('save:symbol', effectiveContextMenuComponents); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#34d399]/20 rounded-lg text-[#34d399] hover:text-[#6ee7b7] cursor-pointer flex items-center gap-2.5 transition-colors"
          >
            <BookmarkPlus class="w-4 h-4 stroke-[2] text-[#34d399]" />
            <span class="text-[#34d399] font-bold tracking-wide text-sm">封装为自定义图元</span>
          </button>

          <!-- Lock / Unlock component (锁定/解锁图元) -->
          <button
            @click="handleToggleLockContext"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#00f2ff]/20 rounded-lg text-[#00f2ff] hover:text-[#38bdf8] cursor-pointer flex items-center gap-2.5 transition-colors"
          >
            <Lock class="w-4 h-4 text-[#00f2ff] stroke-[2]" />
            <span class="text-[#00f2ff] font-bold tracking-wide text-sm">{{ isAnyEffectiveLocked ? '解锁图元' : '锁定图元' }}</span>
          </button>
        </div>

        <!-- Layer Ordering -->
        <div class="py-1.5 space-y-1">
          <div class="px-2.5 py-0.5 text-xs text-[#38bdf8] font-bold uppercase tracking-wider">图层层级</div>
          <button
            @click="emit('bring:front', effectiveContextMenuIds); closeContextMenu();"
            class="w-full text-left px-3 py-1 bg-transparent hover:bg-[#00f2ff]/20 rounded-lg text-[#00f2ff] hover:text-[#38bdf8] cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <ArrowUpToLine class="w-4 h-4 text-[#00f2ff] stroke-[2]" />
              <span class="text-[#00f2ff] font-bold tracking-wide text-sm">置于顶层</span>
            </div>
            <span class="text-xs text-[#38bdf8] font-mono font-bold">Ctrl+Shift+]</span>
          </button>
          <button
            @click="emit('move:up', effectiveContextMenuIds); closeContextMenu();"
            class="w-full text-left px-3 py-1 bg-transparent hover:bg-[#00f2ff]/20 rounded-lg text-[#00f2ff] hover:text-[#38bdf8] cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <ChevronUp class="w-4 h-4 text-[#00f2ff] stroke-[2]" />
              <span class="text-[#00f2ff] font-bold tracking-wide text-sm">上移一层</span>
            </div>
            <span class="text-xs text-[#38bdf8] font-mono font-bold">Ctrl+]</span>
          </button>
          <button
            @click="emit('move:down', effectiveContextMenuIds); closeContextMenu();"
            class="w-full text-left px-3 py-1 bg-transparent hover:bg-[#00f2ff]/20 rounded-lg text-[#00f2ff] hover:text-[#38bdf8] cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <ChevronDown class="w-4 h-4 text-[#00f2ff] stroke-[2]" />
              <span class="text-[#00f2ff] font-bold tracking-wide text-sm">下移一层</span>
            </div>
            <span class="text-xs text-[#38bdf8] font-mono font-bold">Ctrl+[</span>
          </button>
          <button
            @click="emit('send:back', effectiveContextMenuIds); closeContextMenu();"
            class="w-full text-left px-3 py-1 bg-transparent hover:bg-[#00f2ff]/20 rounded-lg text-[#00f2ff] hover:text-[#38bdf8] cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <ArrowDownToLine class="w-4 h-4 text-[#00f2ff] stroke-[2]" />
              <span class="text-[#00f2ff] font-bold tracking-wide text-sm">置于底层</span>
            </div>
            <span class="text-xs text-[#38bdf8] font-mono font-bold">Ctrl+Shift+[</span>
          </button>
        </div>

        <!-- Multi-Item Alignment & Equal Size Options -->
        <template v-if="effectiveContextMenuIds.length > 1">
          <div class="py-1.5">
            <div class="px-2.5 py-0.5 text-xs text-[#38bdf8] font-bold flex items-center justify-between tracking-wider">
              <span>尺寸统一 (等大小)</span>
            </div>
            <div class="grid grid-cols-3 gap-1.5 px-1 py-1">
              <button @click="emit('align', 'equal-width'); closeContextMenu();" class="py-1.5 px-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white text-center text-xs font-semibold cursor-pointer transition-colors" title="所有选中元件统一为相同宽度 (以主选为主)">等宽</button>
              <button @click="emit('align', 'equal-height'); closeContextMenu();" class="py-1.5 px-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white text-center text-xs font-semibold cursor-pointer transition-colors" title="所有选中元件统一为相同高度 (以主选为主)">等高</button>
              <button @click="emit('align', 'equal-size'); closeContextMenu();" class="py-1.5 px-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white text-center text-xs font-semibold cursor-pointer transition-colors" title="所有选中元件统一为相同宽高 (完全等大小)">等大小</button>
            </div>

            <div class="px-2.5 py-0.5 text-xs text-slate-400 font-bold mt-1 tracking-wider">对齐与等间距分布</div>
            <div class="grid grid-cols-4 gap-1 px-1 py-1">
              <button @click="emit('align', 'left'); closeContextMenu();" class="py-1 px-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white text-center text-xs font-semibold cursor-pointer transition-colors" title="左对齐">左对齐</button>
              <button @click="emit('align', 'center'); closeContextMenu();" class="py-1 px-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white text-center text-xs font-semibold cursor-pointer transition-colors" title="水平居中">居中</button>
              <button @click="emit('align', 'right'); closeContextMenu();" class="py-1 px-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white text-center text-xs font-semibold cursor-pointer transition-colors" title="右对齐">右对齐</button>
              <button @click="emit('align', 'distribute-h'); closeContextMenu();" class="py-1 px-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white text-center text-xs font-semibold cursor-pointer transition-colors" title="水平等间距分布">水平均布</button>

              <button @click="emit('align', 'top'); closeContextMenu();" class="py-1 px-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white text-center text-xs font-semibold cursor-pointer transition-colors" title="顶对齐">顶对齐</button>
              <button @click="emit('align', 'middle'); closeContextMenu();" class="py-1 px-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white text-center text-xs font-semibold cursor-pointer transition-colors" title="垂直居中">垂直居中</button>
              <button @click="emit('align', 'bottom'); closeContextMenu();" class="py-1 px-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white text-center text-xs font-semibold cursor-pointer transition-colors" title="底对齐">底对齐</button>
              <button @click="emit('align', 'distribute-v'); closeContextMenu();" class="py-1 px-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white text-center text-xs font-semibold cursor-pointer transition-colors" title="垂直等间距分布">垂直均布</button>
            </div>
          </div>
        </template>

        <div class="py-1.5">
          <button
            @click="emit('delete', effectiveContextMenuIds); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 rounded-lg cursor-pointer flex items-center justify-between font-bold group transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <Trash2 class="w-4 h-4 text-rose-400 stroke-[2]" />
              <span class="text-rose-300 group-hover:text-rose-100 font-bold tracking-wide text-sm">删除选中元件</span>
            </div>
            <span class="text-xs text-rose-400/80 font-mono font-bold">Del</span>
          </button>
        </div>
      </template>
      <template v-else>
        <!-- Canvas Blank Area Context Menu -->
        <div class="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          画布全局操作
        </div>
        <div class="py-1.5 space-y-1">
          <button
            v-if="canPaste"
            @click="emit('paste', { x: contextMenu.canvasX, y: contextMenu.canvasY }); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-[#34d399]/20 rounded-lg text-[#34d399] hover:text-[#6ee7b7] cursor-pointer flex items-center justify-between group font-bold transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <Clipboard class="w-4 h-4 text-[#34d399] stroke-[2]" />
              <span class="text-[#34d399] font-bold tracking-wide text-sm">粘贴图元到此处</span>
            </div>
            <span class="text-xs text-[#34d399] font-mono font-bold">Ctrl+V</span>
          </button>
          
          <button
            v-if="components.length > 0"
            @click="emit('select', components.map(c => c.id)); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-slate-800/60 rounded-lg text-slate-200 hover:text-white cursor-pointer flex items-center justify-between group font-bold transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <CheckSquare class="w-4 h-4 text-sky-400 stroke-[2]" />
              <span class="text-slate-200 hover:text-white font-bold tracking-wide text-sm">全选画布图元</span>
            </div>
            <span class="text-xs text-slate-400 font-mono font-bold">Ctrl+A</span>
          </button>

          <button
            @click="handleAlignToOrigin(); closeContextMenu();"
            class="w-full text-left px-3 py-1.5 bg-transparent hover:bg-slate-800/60 rounded-lg text-slate-200 hover:text-white cursor-pointer flex items-center justify-between group font-bold transition-colors"
          >
            <div class="flex items-center gap-2.5">
              <Crosshair class="w-4 h-4 text-sky-400 stroke-[2]" />
              <span class="text-slate-200 hover:text-white font-bold tracking-wide text-sm">一键定位原点 (0, 0)</span>
            </div>
          </button>

          <div class="px-3 py-2 text-xs text-slate-400 font-medium leading-relaxed">
            按住 Ctrl 或 空格 键拖拽平移无限画布，按住 Ctrl + 滚轮缩放
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.drawing-mode-active,
.drawing-mode-active * {
  cursor: crosshair !important;
}

.drawing-mode-active .component-node,
.drawing-mode-active .component-node * {
  pointer-events: none !important;
  cursor: crosshair !important;
}
</style>
