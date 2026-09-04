<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { 
  Copy, Scissors, Clipboard, Trash2, Layers, CheckSquare, 
  ArrowUpToLine, ArrowDownToLine, ChevronUp, ChevronDown, 
  Lock, Unlock, BookmarkPlus, RotateCw, Radio,
  AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  Crosshair, Sliders, Workflow
} from 'lucide-vue-next';
import { ScreenComponent, ScreenConfig, DatasetConfig } from '../types';
import WidgetRenderer from './widgets/WidgetRenderer.vue';
import Ruler from './Ruler.vue';
import { useCanvasEngine } from '../composables/useCanvasEngine';

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
}

const props = withDefaults(defineProps<Props>(), {
  drawTool: 'select',
  canPaste: false,
  showGrid: true,
  gridSize: 40,
  snapToGrid: true,
  orthogonalLock: false
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
  (e: 'open:control-modal', deviceId?: string): void;
  (e: 'open:property-inspector'): void;
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
  initialSnapToGrid: props.snapToGrid ?? true,
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
watch(() => props.showGrid, (val) => { if (val !== undefined) showGrid.value = val; });
watch(() => props.gridSize, (val) => { if (val !== undefined) gridSize.value = val; });
watch(() => props.snapToGrid, (val) => { if (val !== undefined) snapToGrid.value = val; });
watch(() => props.orthogonalLock, (val) => { if (val !== undefined) orthogonalLock.value = val; });
watch(() => props.drawTool, (newTool) => {
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

// Dragging & Resizing & Rotating state
const isDragging = ref(false);
const hasMovedDrag = ref(false);
const dragStartPositions = ref<Map<string, { x: number; y: number }>>(new Map());
const dragStartMouse = ref({ x: 0, y: 0 });

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

  const minX = Math.min(placeDrawing.value.startX, placeDrawing.value.currentX);
  const minY = Math.min(placeDrawing.value.startY, placeDrawing.value.currentY);
  const rawW = Math.abs(placeDrawing.value.currentX - placeDrawing.value.startX);
  const rawH = Math.abs(placeDrawing.value.currentY - placeDrawing.value.startY);
  const w = Math.max(6, rawW);
  const h = Math.max(6, rawH);

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
    style: JSON.parse(JSON.stringify(def.style || def.defaultStyle || { fill: '#00f2ff', fillOpacity: 0.15, stroke: '#00f2ff', strokeWidth: 2 })),
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

// Selection Order Index
const getSelectionIndex = (id: string) => {
  const idx = props.selectedIds.indexOf(id);
  return idx >= 0 ? idx + 1 : 0;
};

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

  const coords = getCanvasCoords(e.clientX, e.clientY);
  mousePos.value = coords;

  // 2. Polyline Drawing Preview (with optional orthogonal lock)
  if (props.drawTool === 'draw-polyline') {
    if (polylineDrawing.value.active && polylineDrawing.value.points.length > 0) {
      const lastPt = polylineDrawing.value.points[polylineDrawing.value.points.length - 1];
      if (lastPt && (orthogonalLock.value || e.shiftKey)) {
        const ortho = calculateOrthogonalPoint(lastPt.x, lastPt.y, coords.x, coords.y);
        polylineDrawing.value.currentX = ortho.x;
        polylineDrawing.value.currentY = ortho.y;
      } else {
        polylineDrawing.value.currentX = coords.x;
        polylineDrawing.value.currentY = coords.y;
      }
    } else {
      polylineDrawing.value.currentX = coords.x;
      polylineDrawing.value.currentY = coords.y;
    }
    return;
  }

  // 3. Arrow Drawing Preview (with optional orthogonal lock)
  if (props.drawTool === 'draw-arrow') {
    if (arrowDrawing.value.active) {
      if (orthogonalLock.value || e.shiftKey) {
        const ortho = calculateOrthogonalPoint(arrowDrawing.value.startX, arrowDrawing.value.startY, coords.x, coords.y);
        arrowDrawing.value.currentX = ortho.x;
        arrowDrawing.value.currentY = ortho.y;
      } else {
        arrowDrawing.value.currentX = coords.x;
        arrowDrawing.value.currentY = coords.y;
      }
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

  // 4. Marquee Selection Drag (拉框多选：完全包围整个组件才判定为选中)
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

      const selected = props.components.filter(c => {
        if (c.visible === false) return false;
        const aabb = getComponentAABB(c);
        // 严格全包围判定：只有当拉框区域完全容纳该图元的全部包围盒边界时才判定为选中，触碰不算选中
        return (
          aabb.minX >= boxLeft &&
          aabb.maxX <= boxRight &&
          aabb.minY >= boxTop &&
          aabb.maxY <= boxBottom
        );
      });
      emit('select', selected.map(c => c.id));
    }
    return;
  }

  // 5. Batch Component Dragging (高性能帧级平移，过滤无效零位移更新)
  if (isDragging.value && props.selectedIds.length > 0) {
    let dx = (e.clientX - dragStartMouse.value.x) / (props.zoom || 1);
    let dy = (e.clientY - dragStartMouse.value.y) / (props.zoom || 1);

    if (snapToGrid.value && gridSize.value > 0) {
      dx = Math.round(dx / gridSize.value) * gridSize.value;
      dy = Math.round(dy / gridSize.value) * gridSize.value;
    }

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      hasMovedDrag.value = true;
    }

    const updatedComps = props.components
      .filter(c => props.selectedIds.includes(c.id) && !c.locked && dragStartPositions.value.has(c.id))
      .map(c => {
        const startPos = dragStartPositions.value.get(c.id)!;
        let newX = Math.round(startPos.x + dx);
        let newY = Math.round(startPos.y + dy);
        if (snapToGrid.value && gridSize.value > 0) {
          newX = Math.round(newX / gridSize.value) * gridSize.value;
          newY = Math.round(newY / gridSize.value) * gridSize.value;
        }
        return {
          ...c,
          x: newX,
          y: newY
        };
      });

    if (updatedComps.length > 0) {
      // 避免当组件实际坐标未变时重复 emit 产生冗余重绘
      const isChanged = updatedComps.some(uc => {
        const orig = props.components.find(c => c.id === uc.id);
        return !orig || orig.x !== uc.x || orig.y !== uc.y;
      });
      if (isChanged) {
        emit('update:components', updatedComps);
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
    const isTextOrButton = comp.type === 'draw-text' || comp.type === 'ctrl-button' || comp.type === 'metric-header';
    let updatedStyle = { ...comp.style };
    if (isTextOrButton) {
      const initH = resizeStart.value.height || 36;
      const initFontSize = resizeStart.value.fontSize || comp.style?.fontSize || Math.max(12, Math.round(initH * 0.65));
      const scaleFactor = newH / initH;
      const newFontSize = Math.max(10, Math.min(Math.round(initFontSize * scaleFactor), 96));
      updatedStyle.fontSize = newFontSize;
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
    if (hasMovedDrag.value) {
      emit('commit:history');
      setTimeout(() => {
        suppressNextCanvasClick.value = false;
        hasMovedDrag.value = false;
      }, 200);
    } else {
      hasMovedDrag.value = false;
      setTimeout(() => {
        suppressNextCanvasClick.value = false;
      }, 200);
    }
    isDragging.value = false;
  }

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

  isDragging.value = true;
  hasMovedDrag.value = false;
  dragStartMouse.value = { x: e.clientX, y: e.clientY };
  
  const map = new Map<string, { x: number; y: number }>();
  props.components.forEach(c => {
    if (activeIds.includes(c.id) || c.id === comp.id) {
      map.set(c.id, { x: c.x, y: c.y });
    }
  });
  dragStartPositions.value = map;
};

// Component Click Handler (maintains sustained selection on click)
const handleCompClick = (e: MouseEvent, comp: ScreenComponent) => {
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
  // If user just interacted with a component, handle, or drag/resize/rotate, DO NOT deselect!
  if (suppressNextCanvasClick.value || (Date.now() - lastInteractionTime.value) < 260) {
    suppressNextCanvasClick.value = false;
    return;
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
      polylineDrawing.value.points.push({ x: nextX, y: nextY });
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
      placeDrawing.value.currentX = coords.x;
      placeDrawing.value.currentY = coords.y;
      finishPlaceDrawing();
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

// Finish Arrow Drawing & Auto-crop to minimal bounding box
const finishArrowDrawing = () => {
  if (!arrowDrawing.value.active) return;
  const { startX, startY, currentX, currentY } = arrowDrawing.value;
  const dist = Math.hypot(currentX - startX, currentY - startY);
  if (dist < 5) {
    arrowDrawing.value.active = false;
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

  emit('add:component:at', {
    type: 'draw-arrow',
    category: 'basic',
    name: '导向箭头',
    width: compW,
    height: compH,
    style: { 
      stroke: '#00f2ff', 
      strokeWidth: 3, 
      endArrow: true,
      startArrow: false,
      lineStyle: 'solid'
    },
    customProps: {
      points: relPoints
    }
  }, minX, minY);

  arrowDrawing.value.active = false;
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

  // If user made a fast single click (distance < 12px), use component's default width and height
  if (w < 12 && h < 12) {
    w = def.defaultWidth || def.width || 140;
    h = def.defaultHeight || def.height || 100;
  } else {
    w = Math.max(16, w);
    h = Math.max(16, h);
  }

  const compPayload = {
    ...def,
    width: w,
    height: h
  };

  emit('add:component:at', compPayload, minX, minY);
  placeDrawing.value.active = false;
  emit('finish:draw');
};

// Polyline Double Click / Enter to Finish
const handleCanvasDblClick = () => {
  if (props.drawTool === 'draw-arrow' && arrowDrawing.value.active) {
    finishArrowDrawing();
    return;
  }
  if (props.drawTool === 'draw-polyline' && polylineDrawing.value.active) {
    const pts = polylineDrawing.value.points;
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
          stroke: '#00f2ff', 
          strokeWidth: 3, 
          lineType: 'step-horizontal',
          lineStyle: 'solid'
        },
        customProps: {
          points: relPoints
        }
      }, minX, minY);
    }

    polylineDrawing.value.active = false;
    polylineDrawing.value.points = [];
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
    fontSize: comp.style?.fontSize || Math.max(12, Math.round(comp.height * 0.65))
  };
};

// Start Rotating (自由旋转功能)
const handleStartRotate = (e: MouseEvent) => {
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

  if (compId && !props.selectedIds.includes(compId)) {
    emit('select', [compId]);
  }

  const coords = getCanvasCoords(e.clientX, e.clientY);

  const menuWidth = 240;
  const menuHeight = 440;
  const winWidth = window.innerWidth;
  const winHeight = window.innerHeight;

  let x = e.clientX;
  let y = e.clientY;

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
    x,
    y,
    canvasX: coords.x,
    canvasY: coords.y,
    targetCompId: compId
  };
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
  return props.selectedIds || [];
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

// Keyboard Shortcuts
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.code === 'Space' && !isSpacePressed.value) {
    const target = e.target as HTMLElement;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) {
      isSpacePressed.value = true;
    }
  }

  const target = e.target as HTMLElement;
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

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

  // Arrow key micro-nudges: always moves with minimal 1px step, independent of grid density
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
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
      emit('commit:history');
    }
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
  if (e.code === 'Space') {
    isSpacePressed.value = false;
  }
};

const handleWindowBlur = () => {
  isSpacePressed.value = false;
  isDragging.value = false;
  hasMovedDrag.value = false;
  isPanning.value = false;
  isSelectingMarquee.value = false;
  hasMovedMarquee.value = false;
  isResizing.value = false;
  isRotating.value = false;
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
    class="flex-1 h-full bg-[#0d1f38] relative overflow-hidden select-none flex flex-col"
    :class="{
      'cursor-move': isSpacePressed || isPanning,
      'cursor-crosshair': drawTool !== 'select'
    }"
  >
    <!-- Rulers on Top & Left -->
    <Ruler
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
        'cursor-crosshair': drawTool !== 'select',
        'cursor-move': isSpacePressed || isPanning,
        'cursor-default': drawTool === 'select' && !isSpacePressed && !isPanning
      }"
      :style="{
        backgroundColor: screen.backgroundColor || '#0f223d',
        backgroundImage: showGrid 
          ? `radial-gradient(circle, ${effectiveGridColor} 1.2px, transparent 1.2px)` 
          : 'none',
        backgroundPosition: `${panOffset.x - (gridSize * zoom) / 2}px ${panOffset.y - (gridSize * zoom) / 2}px`,
        backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`
      }"
      @mousedown="handleCanvasMouseDown"
      @click="handleCanvasClick"
      @dblclick="handleCanvasDblClick"
      @contextmenu="handleCanvasContextMenu"
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
        <!-- Render All Screen Components in Layer Order -->
        <div
          v-for="comp in components"
          :key="comp.id"
          :data-component-id="comp.id"
          @mousedown.stop="drawTool === 'select' && handleStartDrag($event, comp)"
          @click.stop="drawTool === 'select' && handleCompClick($event, comp)"
          @contextmenu="drawTool === 'select' && handleContextMenu($event, comp.id)"
          class="absolute group component-node select-none"
          :class="{
            'cursor-move': drawTool === 'select' && !comp.locked,
            'pointer-events-auto': drawTool === 'select' && comp.visible !== false,
            'pointer-events-none': drawTool !== 'select' || comp.visible === false,
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
            transform: comp.rotation ? `rotate(${comp.rotation}deg)` : 'translateZ(0)',
            transformOrigin: 'center center',
            zIndex: comp.zIndex || 1,
            contain: 'layout style',
            willChange: selectedIds.includes(comp.id) ? 'transform' : 'auto'
          }"
        >
          <!-- Invisible Expanded Hit Area (at least 24px) for ultra-thin or single-line compressed widgets -->
          <div 
            v-if="drawTool === 'select' && (comp.width <= 14 || comp.height <= 14)"
            class="absolute -inset-3 pointer-events-auto cursor-move z-10"
            title="点击选中图元"
          />

          <!-- Component Content -->
          <WidgetRenderer
            :component="comp"
            :datasets="datasets"
            :preview-mode="false"
          />

          <!-- Locked Indicator Badge -->
          <div v-if="comp.locked" class="absolute top-1 right-1 p-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-500/40 z-30 pointer-events-auto">
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
            class="absolute pointer-events-none selection-box"
            :style="{
              left: `${comp.x}px`,
              top: `${comp.y}px`,
              width: `${Math.max(4, comp.width)}px`,
              height: `${Math.max(4, comp.height)}px`,
              transform: comp.rotation ? `rotate(${comp.rotation}deg)` : 'translateZ(0)',
              transformOrigin: 'center center',
              zIndex: 99999
            }"
          >
            <!-- 1. Single Selection Active State: 4 Edge Hit Bars + 8 Resizers + Rotation Grip + Border -->
            <div 
              v-if="selectedIds.length === 1"
              class="absolute -inset-0.5 border-2 border-cyan-400 pointer-events-none rounded-xs shadow-[0_0_14px_rgba(0,242,255,0.75)]"
            >
              <!-- Top Rotation Handle (自由旋转控件) -->
              <template v-if="!comp.locked">
                <div class="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-50">
                  <div 
                    @mousedown="handleStartRotate"
                    class="w-6 h-6 bg-cyan-400 text-slate-950 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg hover:scale-115 transition-transform"
                    title="按住旋转 (按Shift吸附15°)"
                  >
                    <RotateCw class="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <div class="w-[1.5px] h-2 bg-cyan-400" />
                </div>

                <!-- 4 Interactive Edge Resize Bars (四边框超大易触发拉伸区域) -->
                <!-- Top Edge -->
                <div 
                  @mousedown="handleStartResize($event, 'n')"
                  class="pointer-events-auto absolute -top-2 left-2 right-2 h-4 cursor-ns-resize z-40 group/edge hover:bg-cyan-400/20 rounded-xs transition-colors"
                  title="拖动调整高度 (上边框)"
                />
                <!-- Bottom Edge -->
                <div 
                  @mousedown="handleStartResize($event, 's')"
                  class="pointer-events-auto absolute -bottom-2 left-2 right-2 h-4 cursor-ns-resize z-40 group/edge hover:bg-cyan-400/20 rounded-xs transition-colors"
                  title="拖动调整高度 (下边框)"
                />
                <!-- Left Edge -->
                <div 
                  @mousedown="handleStartResize($event, 'w')"
                  class="pointer-events-auto absolute top-2 bottom-2 -left-2 w-4 cursor-ew-resize z-40 group/edge hover:bg-cyan-400/20 rounded-xs transition-colors"
                  title="拖动调整宽度 (左边框)"
                />
                <!-- Right Edge -->
                <div 
                  @mousedown="handleStartResize($event, 'e')"
                  class="pointer-events-auto absolute top-2 bottom-2 -right-2 w-4 cursor-ew-resize z-40 group/edge hover:bg-cyan-400/20 rounded-xs transition-colors"
                  title="拖动调整宽度 (右边框)"
                />

                <!-- 8 Resize Corner & Mid-point Handles (扩展20px高灵敏度触控热区) -->
                <!-- NW (Top-Left) -->
                <div 
                  @mousedown="handleStartResize($event, 'nw')"
                  class="group pointer-events-auto absolute -top-2.5 -left-2.5 w-5 h-5 flex items-center justify-center cursor-nwse-resize z-50"
                  title="缩放调整 (左上角)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-130 transition-transform" />
                </div>

                <!-- N (Top-Center) -->
                <div 
                  @mousedown="handleStartResize($event, 'n')"
                  class="group pointer-events-auto absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 flex items-center justify-center cursor-ns-resize z-50"
                  title="调整高度 (上中点)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-130 transition-transform" />
                </div>

                <!-- NE (Top-Right) -->
                <div 
                  @mousedown="handleStartResize($event, 'ne')"
                  class="group pointer-events-auto absolute -top-2.5 -right-2.5 w-5 h-5 flex items-center justify-center cursor-nesw-resize z-50"
                  title="缩放调整 (右上角)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-130 transition-transform" />
                </div>

                <!-- E (Right-Center) -->
                <div 
                  @mousedown="handleStartResize($event, 'e')"
                  class="group pointer-events-auto absolute top-1/2 -translate-y-1/2 -right-2.5 w-5 h-5 flex items-center justify-center cursor-ew-resize z-50"
                  title="调整宽度 (右中点)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-130 transition-transform" />
                </div>

                <!-- SE (Bottom-Right) -->
                <div 
                  @mousedown="handleStartResize($event, 'se')"
                  class="group pointer-events-auto absolute -bottom-2.5 -right-2.5 w-5 h-5 flex items-center justify-center cursor-nwse-resize z-50"
                  title="缩放调整 (右下角)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-130 transition-transform" />
                </div>

                <!-- S (Bottom-Center) -->
                <div 
                  @mousedown="handleStartResize($event, 's')"
                  class="group pointer-events-auto absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 flex items-center justify-center cursor-ns-resize z-50"
                  title="调整高度 (下中点)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-130 transition-transform" />
                </div>

                <!-- SW (Bottom-Left) -->
                <div 
                  @mousedown="handleStartResize($event, 'sw')"
                  class="group pointer-events-auto absolute -bottom-2.5 -left-2.5 w-5 h-5 flex items-center justify-center cursor-nesw-resize z-50"
                  title="缩放调整 (左下角)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-130 transition-transform" />
                </div>

                <!-- W (Left-Center) -->
                <div 
                  @mousedown="handleStartResize($event, 'w')"
                  class="group pointer-events-auto absolute top-1/2 -translate-y-1/2 -left-2.5 w-5 h-5 flex items-center justify-center cursor-ew-resize z-50"
                  title="调整宽度 (左中点)"
                >
                  <div class="w-2.5 h-2.5 bg-cyan-400 border-[1.5px] border-slate-950 rounded-[2px] shadow-[0_0_6px_rgba(0,242,255,0.8)] group-hover:scale-130 transition-transform" />
                </div>
              </template>
            </div>

            <!-- 2. Multi-Selection Active State: High-contrast Cyan Outline + Area Tint + 4 Corner Accents + Numbered Tag -->
            <div 
              v-else
              class="absolute -inset-0.5 border-2 border-cyan-400 bg-cyan-400/15 pointer-events-none rounded-xs shadow-[0_0_16px_rgba(0,242,255,0.7)]"
            >
              <!-- 4 White Corner Brackets for Maximum Visibility -->
              <div class="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-white shadow-xs" />
              <div class="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-white shadow-xs" />
              <div class="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-white shadow-xs" />
              <div class="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-white shadow-xs" />

              <!-- High-visibility Multi-Select Index & Name Tag -->
              <div class="absolute -top-6 left-0 flex items-center gap-1 bg-[#050b18]/95 border border-cyan-300 text-cyan-200 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow-[0_2px_8px_rgba(0,0,0,0.8)] pointer-events-none whitespace-nowrap z-50">
                <span class="px-1 py-0.2 bg-cyan-400 text-slate-950 rounded-[2px] font-bold text-[9px] leading-tight">
                  #{{ getSelectionIndex(comp.id) }}
                </span>
                <span class="truncate max-w-[100px] text-white">{{ comp.name }}</span>
                <Lock v-if="comp.locked" class="w-2.5 h-2.5 text-amber-400 ml-0.5" />
              </div>
            </div>
          </div>
        </div>

        <!-- Overall Multi-Selection Group Bounding Box (Visual Only, No Floating Menu) -->
        <div
          v-if="drawTool === 'select' && selectedGroupBBox && selectedIds.length > 1"
          class="absolute border-2 border-dashed border-cyan-300/80 bg-cyan-400/[0.04] pointer-events-none z-45 shadow-[0_0_25px_rgba(0,242,255,0.25)] rounded-xs transition-all duration-75"
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
              stroke="#00f2ff"
              stroke-width="7"
              stroke-opacity="0.35"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <!-- Main dashed vector line -->
            <polyline
              :points="getPolylinePreviewPoints()"
              fill="none"
              stroke="#00f2ff"
              stroke-width="3"
              stroke-dasharray="8 4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <!-- Dynamic connecting line from last vertex to moving cursor -->
            <line
              :x1="polylineDrawing.points[polylineDrawing.points.length - 1].x"
              :y1="polylineDrawing.points[polylineDrawing.points.length - 1].y"
              :x2="polylineDrawing.currentX"
              :y2="polylineDrawing.currentY"
              stroke="#00e5a3"
              stroke-width="2"
              stroke-dasharray="4 3"
            />
            <!-- Placed vertices -->
            <g v-for="(p, idx) in polylineDrawing.points" :key="idx">
              <circle 
                :cx="p.x" 
                :cy="p.y" 
                r="5" 
                fill="#00f2ff" 
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
              stroke-width="7"
              stroke-opacity="0.35"
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
              stroke-dasharray="6 3"
              stroke-linecap="round"
              marker-end="url(#preview-arrow-head)"
            />
            <!-- Start vertex circle -->
            <circle
              :cx="arrowDrawing.startX"
              :cy="arrowDrawing.startY"
              r="6"
              fill="#00f2ff"
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

    <!-- Right-Click Context Menu -->
    <div
      v-if="contextMenu.visible"
      class="fixed bg-[#132745] border border-cyan-400/60 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.9)] p-1.5 z-50 backdrop-blur-md w-56 max-h-[calc(100vh-20px)] overflow-y-auto custom-scrollbar text-xs font-sans text-cyan-100"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
    >
      <template v-if="effectiveContextMenuIds.length > 0">
        <!-- Multi-Selection or Single Selection Header -->
        <div class="px-2.5 py-1.5 text-xs font-light text-cyan-300 border-b border-cyan-500/30 flex items-center justify-between">
          <span class="truncate">{{ effectiveContextMenuIds.length === 1 ? effectivePrimaryComponent?.name : `已选中 ${effectiveContextMenuIds.length} 个元件` }}</span>
          <span v-if="effectiveContextMenuIds.length === 1" class="text-[11px] text-cyan-300 font-mono">{{ effectivePrimaryComponent?.rotation || 0 }}°</span>
        </div>

        <div class="py-1 space-y-0.5">
          <!-- View / Edit Properties Inspector (选中右击查看属性) -->
          <button
            @click="emit('open:property-inspector'); closeContextMenu();"
            class="w-full text-left px-2.5 py-1.5 bg-[#1c3a66] hover:bg-cyan-600 hover:text-slate-950 rounded-md text-cyan-200 hover:text-white cursor-pointer flex items-center justify-between group transition-colors border border-cyan-400/50"
          >
            <div class="flex items-center gap-2 font-normal">
              <Sliders class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
              <span>查看/编辑属性面板</span>
            </div>
            <span class="text-[10px] text-cyan-300 font-mono font-light">打开</span>
          </button>

          <!-- Copy (Ctrl+C) -->
          <button
            @click="emit('copy', effectiveContextMenuComponents); closeContextMenu();"
            class="w-full text-left px-2.5 py-1.5 hover:bg-cyan-950/60 rounded-md text-cyan-200 hover:text-white cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2 font-light">
              <Copy class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
              <span>复制</span>
            </div>
            <span class="text-[10px] text-cyan-300 font-mono group-hover:text-cyan-100 font-light">Ctrl+C</span>
          </button>

          <!-- Cut (Ctrl+X) -->
          <button
            @click="emit('cut', effectiveContextMenuComponents); closeContextMenu();"
            class="w-full text-left px-2.5 py-1.5 hover:bg-cyan-950/60 rounded-md text-cyan-200 hover:text-white cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2 font-light">
              <Scissors class="w-3.5 h-3.5 text-amber-300 stroke-[2]" />
              <span>剪切</span>
            </div>
            <span class="text-[10px] text-cyan-300 font-mono group-hover:text-cyan-100 font-light">Ctrl+X</span>
          </button>

          <!-- Paste (Ctrl+V) -->
          <button
            v-if="canPaste"
            @click="emit('paste', { x: contextMenu.canvasX, y: contextMenu.canvasY }); closeContextMenu();"
            class="w-full text-left px-2.5 py-1.5 hover:bg-cyan-950/60 rounded-md text-cyan-200 hover:text-white cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2 font-light">
              <Clipboard class="w-3.5 h-3.5 text-emerald-300 stroke-[2]" />
              <span>粘贴到此处</span>
            </div>
            <span class="text-[10px] text-cyan-300 font-mono group-hover:text-cyan-100 font-light">Ctrl+V</span>
          </button>

          <!-- Duplicate (Ctrl+D) -->
          <button
            @click="emit('duplicate', effectiveContextMenuComponents); closeContextMenu();"
            class="w-full text-left px-2.5 py-1.5 hover:bg-cyan-950/60 rounded-md text-cyan-200 hover:text-white cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2 font-light">
              <Copy class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
              <span>创建副本</span>
            </div>
            <span class="text-[10px] text-cyan-300 font-mono group-hover:text-cyan-100 font-light">Ctrl+D</span>
          </button>
        </div>

        <div class="h-[1px] bg-cyan-500/30 my-1" />

        <div class="py-0.5 space-y-0.5">
          <!-- SCADA YK/YT Execution -->
          <button
            v-if="primarySelectedHasControl"
            @click="emit('open:control-modal', effectivePrimaryComponent?.data?.mapping?.deviceId); closeContextMenu();"
            class="w-full text-left px-2.5 py-1.5 hover:bg-amber-500/20 rounded-md hover:text-amber-200 cursor-pointer text-amber-300 font-normal flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2">
              <Radio class="w-3.5 h-3.5 text-amber-300 stroke-[2]" />
              <span>执行遥控遥调操作 (YK / YT)</span>
            </div>
            <span class="text-[10px] text-amber-300 font-mono font-light">SCADA控制</span>
          </button>

          <!-- Group components (Ctrl+G) -->
          <button
            v-if="effectiveContextMenuIds.length >= 2"
            @click="emit('group', effectiveContextMenuComponents); closeContextMenu();"
            class="w-full text-left px-2.5 py-1.5 hover:bg-cyan-950/60 rounded-md hover:text-cyan-100 cursor-pointer text-cyan-200 font-normal flex items-center justify-between transition-colors"
          >
            <div class="flex items-center gap-2 font-light">
              <span>🧩 组合为群组</span>
            </div>
            <span class="text-[10px] text-cyan-300 font-mono font-light">Ctrl+G</span>
          </button>

          <!-- Ungroup component (Ctrl+U) -->
          <button
            v-if="effectiveContextMenuIds.length === 1 && (effectivePrimaryComponent?.children?.length || effectivePrimaryComponent?.type === 'composite-symbol')"
            @click="emit('ungroup', effectivePrimaryComponent!);"
            class="w-full text-left px-2.5 py-1.5 hover:bg-amber-500/20 rounded-md hover:text-amber-200 cursor-pointer text-amber-300 font-normal flex items-center justify-between transition-colors"
          >
            <div class="flex items-center gap-2 font-light">
              <span>🔓 取消组合为散装图元</span>
            </div>
            <span class="text-[10px] text-amber-300 font-mono font-light">Ctrl+U</span>
          </button>

          <button
            @click="emit('save:symbol', effectiveContextMenuComponents); closeContextMenu();"
            class="w-full text-left px-2.5 py-1.5 hover:bg-emerald-500/20 rounded-md hover:text-emerald-200 cursor-pointer text-emerald-300 font-light flex items-center gap-2 transition-colors"
          >
            <BookmarkPlus class="w-3.5 h-3.5 stroke-[2]" />
            <span>封装为自定义图元</span>
          </button>

          <!-- Lock / Unlock component (锁定/解锁图元) -->
          <button
            @click="handleToggleLockContext"
            class="w-full text-left px-2.5 py-1.5 hover:bg-cyan-950/60 rounded-md text-cyan-200 hover:text-white cursor-pointer flex items-center gap-2 font-light transition-colors"
          >
            <Lock class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
            <span>{{ isAnyEffectiveLocked ? '解锁图元' : '锁定图元' }}</span>
          </button>
        </div>

        <!-- Layer Ordering -->
        <div class="h-[1px] bg-cyan-500/30 my-1" />
        <div class="px-2 py-0.5 text-[10px] text-cyan-300 font-light">图层层级</div>
        <div class="py-0.5 space-y-0.5">
          <button
            @click="emit('bring:front', effectiveContextMenuIds); closeContextMenu();"
            class="w-full text-left px-2.5 py-1 hover:bg-cyan-950/60 rounded-md text-cyan-200 hover:text-white cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2 font-light">
              <ArrowUpToLine class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
              <span>置于顶层</span>
            </div>
            <span class="text-[10px] text-cyan-300 font-mono group-hover:text-cyan-100 font-light">Ctrl+Shift+]</span>
          </button>
          <button
            @click="emit('move:up', effectiveContextMenuIds); closeContextMenu();"
            class="w-full text-left px-2.5 py-1 hover:bg-cyan-950/60 rounded-md text-cyan-200 hover:text-white cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2 font-light">
              <ChevronUp class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
              <span>上移一层</span>
            </div>
            <span class="text-[10px] text-cyan-300 font-mono group-hover:text-cyan-100 font-light">Ctrl+]</span>
          </button>
          <button
            @click="emit('move:down', effectiveContextMenuIds); closeContextMenu();"
            class="w-full text-left px-2.5 py-1 hover:bg-cyan-950/60 rounded-md text-cyan-200 hover:text-white cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2 font-light">
              <ChevronDown class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
              <span>下移一层</span>
            </div>
            <span class="text-[10px] text-cyan-300 font-mono group-hover:text-cyan-100 font-light">Ctrl+[</span>
          </button>
          <button
            @click="emit('send:back', effectiveContextMenuIds); closeContextMenu();"
            class="w-full text-left px-2.5 py-1 hover:bg-cyan-950/60 rounded-md text-cyan-200 hover:text-white cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center gap-2 font-light">
              <ArrowDownToLine class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
              <span>置于底层</span>
            </div>
            <span class="text-[10px] text-cyan-300 font-mono group-hover:text-cyan-100 font-light">Ctrl+Shift+[</span>
          </button>
        </div>

        <!-- Multi-Item Alignment & Equal Size Options -->
        <template v-if="effectiveContextMenuIds.length > 1">
          <div class="h-[1px] bg-cyan-500/30 my-1" />
          <div class="px-2 py-0.5 text-[10px] text-cyan-300 font-light flex items-center justify-between">
            <span>尺寸统一 (等大小)</span>
          </div>
          <div class="grid grid-cols-3 gap-1 px-1 py-1">
            <button @click="emit('align', 'equal-width'); closeContextMenu();" class="p-1 rounded bg-[#173055] hover:bg-cyan-600 hover:text-slate-950 border border-cyan-500/40 text-cyan-200 text-center text-[11px] font-light cursor-pointer" title="所有选中元件统一为相同宽度 (以主选为主)">等宽</button>
            <button @click="emit('align', 'equal-height'); closeContextMenu();" class="p-1 rounded bg-[#173055] hover:bg-cyan-600 hover:text-slate-950 border border-cyan-500/40 text-cyan-200 text-center text-[11px] font-light cursor-pointer" title="所有选中元件统一为相同高度 (以主选为主)">等高</button>
            <button @click="emit('align', 'equal-size'); closeContextMenu();" class="p-1 rounded bg-cyan-500/30 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-400 text-cyan-100 text-center text-[11px] font-medium cursor-pointer" title="所有选中元件统一为相同宽高 (完全等大小)">等大小</button>
          </div>

          <div class="px-2 py-0.5 text-[10px] text-cyan-300 font-light mt-0.5">对齐与等间距分布</div>
          <div class="grid grid-cols-4 gap-1 px-1 py-1">
            <button @click="emit('align', 'left'); closeContextMenu();" class="p-1 rounded bg-[#173055] hover:bg-[#1f4273] border border-cyan-500/40 text-cyan-200 hover:text-white text-center text-[11px] font-light cursor-pointer" title="左对齐">左对齐</button>
            <button @click="emit('align', 'center'); closeContextMenu();" class="p-1 rounded bg-[#173055] hover:bg-[#1f4273] border border-cyan-500/40 text-cyan-200 hover:text-white text-center text-[11px] font-light cursor-pointer" title="水平居中">居中</button>
            <button @click="emit('align', 'right'); closeContextMenu();" class="p-1 rounded bg-[#173055] hover:bg-[#1f4273] border border-cyan-500/40 text-cyan-200 hover:text-white text-center text-[11px] font-light cursor-pointer" title="右对齐">右对齐</button>
            <button @click="emit('align', 'distribute-h'); closeContextMenu();" class="p-1 rounded bg-[#173055] hover:bg-[#1f4273] border border-cyan-500/40 text-cyan-200 hover:text-white text-center text-[11px] font-light cursor-pointer" title="水平等间距分布">水平均布</button>

            <button @click="emit('align', 'top'); closeContextMenu();" class="p-1 rounded bg-[#173055] hover:bg-[#1f4273] border border-cyan-500/40 text-cyan-200 hover:text-white text-center text-[11px] font-light cursor-pointer" title="顶对齐">顶对齐</button>
            <button @click="emit('align', 'middle'); closeContextMenu();" class="p-1 rounded bg-[#173055] hover:bg-[#1f4273] border border-cyan-500/40 text-cyan-200 hover:text-white text-center text-[11px] font-light cursor-pointer" title="垂直居中">垂直居中</button>
            <button @click="emit('align', 'bottom'); closeContextMenu();" class="p-1 rounded bg-[#173055] hover:bg-[#1f4273] border border-cyan-500/40 text-cyan-200 hover:text-white text-center text-[11px] font-light cursor-pointer" title="底对齐">底对齐</button>
            <button @click="emit('align', 'distribute-v'); closeContextMenu();" class="p-1 rounded bg-[#173055] hover:bg-[#1f4273] border border-cyan-500/40 text-cyan-200 hover:text-white text-center text-[11px] font-light cursor-pointer" title="垂直等间距分布">垂直均布</button>
          </div>
        </template>

        <div class="h-[1px] bg-cyan-500/30 my-1" />
        <button
          @click="emit('delete', effectiveContextMenuIds); closeContextMenu();"
          class="w-full text-left px-2.5 py-1.5 hover:bg-red-950/80 text-rose-300 rounded-md cursor-pointer flex items-center justify-between font-light transition-colors"
        >
          <div class="flex items-center gap-2">
            <Trash2 class="w-3.5 h-3.5 text-rose-400 stroke-[2]" />
            <span>删除选中元件</span>
          </div>
          <span class="text-[10px] text-rose-400 font-mono">Del</span>
        </button>
      </template>
      <template v-else>
        <!-- Canvas Blank Area Context Menu -->
        <div class="px-2.5 py-1.5 text-xs font-light text-cyan-300 border-b border-cyan-500/30">
          画布全局操作
        </div>
        <div class="py-1 space-y-0.5">
          <button
            v-if="canPaste"
            @click="emit('paste', { x: contextMenu.canvasX, y: contextMenu.canvasY }); closeContextMenu();"
            class="w-full text-left px-2.5 py-1.5 hover:bg-cyan-950/60 rounded-md text-emerald-300 hover:text-emerald-200 cursor-pointer flex items-center justify-between group font-light transition-colors"
          >
            <div class="flex items-center gap-2">
              <Clipboard class="w-3.5 h-3.5 text-emerald-300 stroke-[2]" />
              <span>粘贴图元到此处</span>
            </div>
            <span class="text-[10px] text-cyan-300 font-mono group-hover:text-emerald-300 font-light">Ctrl+V</span>
          </button>
          
          <button
            v-if="components.length > 0"
            @click="emit('select', components.map(c => c.id)); closeContextMenu();"
            class="w-full text-left px-2.5 py-1.5 hover:bg-cyan-950/60 rounded-md text-cyan-200 hover:text-white cursor-pointer flex items-center justify-between group font-light transition-colors"
          >
            <div class="flex items-center gap-2">
              <CheckSquare class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
              <span>全选画布图元</span>
            </div>
            <span class="text-[10px] text-cyan-300 font-mono group-hover:text-cyan-100 font-light">Ctrl+A</span>
          </button>

          <button
            @click="handleAlignToOrigin(); closeContextMenu();"
            class="w-full text-left px-2.5 py-1.5 hover:bg-cyan-950/60 rounded-md text-cyan-200 hover:text-white cursor-pointer flex items-center justify-between group font-light transition-colors"
          >
            <div class="flex items-center gap-2">
              <Crosshair class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
              <span>一键定位原点 (0, 0)</span>
            </div>
          </button>

          <div class="px-2.5 py-1 text-[11px] text-cyan-300/80 font-light">
            按住 Ctrl 或 空格 键拖拽平移无限画布，按住 Ctrl + 滚轮缩放
          </div>
        </div>
      </template>
    </div>

    <!-- Bottom Status Bar -->
    <div class="h-7 bg-[#132745] border-t border-cyan-400/50 px-3 flex items-center justify-between text-[11px] font-mono text-cyan-200 z-30 select-none shadow-md">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-1.5 text-cyan-200 font-light">
          <span class="text-cyan-300">光标坐标:</span>
          <span>X: {{ mousePos.x }} px, Y: {{ mousePos.y }} px</span>
          <span v-if="snapToGrid" class="text-emerald-300 text-[10px]">(已吸附{{ gridSize }}px)</span>
        </div>
        <div class="h-3 w-[1px] bg-cyan-500/40" />
        <div class="font-light">
          <span class="text-cyan-300">画面尺寸:</span>
          <span class="text-cyan-100 ml-1">{{ screen.width }} × {{ screen.height }}</span>
        </div>
        <div v-if="selectedIds.length > 0" class="flex items-center gap-2">
          <div class="h-3 w-[1px] bg-cyan-500/40" />
          <span class="text-cyan-300 font-light">选中:</span>
          <span class="text-cyan-200 font-normal">
            {{ selectedIds.length === 1 ? primarySelected?.name : `已多选 ${selectedIds.length} 个元件` }}
          </span>
          <span v-if="selectedIds.length === 1" class="text-cyan-300 font-light">
            ({{ Math.round(primarySelected?.width || 0) }} × {{ Math.round(primarySelected?.height || 0) }}, {{ primarySelected?.rotation || 0 }}°)
          </span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span v-if="drawTool === 'draw-polyline'" class="text-amber-300 font-normal animate-pulse">
          ⚡ 折线绘制中: 单击添加拐点，双击或回车结束 (ESC取消, {{ orthogonalLock ? '正交已锁定' : '按Shift正交' }})
        </span>
        <span v-else class="text-cyan-300 font-light">
          💡 Ctrl/空格+拖拽平移画布 | Ctrl+滚轮缩放 | 点格吸附成图
        </span>
        <div class="h-3 w-[1px] bg-cyan-500/40" />
        <span class="text-cyan-200 font-light">缩放: {{ Math.round(zoom * 100) }}%</span>
      </div>
    </div>
  </div>
</template>
