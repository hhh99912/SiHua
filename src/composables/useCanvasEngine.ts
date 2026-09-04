import { ref, computed, Ref } from 'vue';

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasEngineOptions {
  initialZoom?: number;
  initialGridSize?: number;
  initialShowGrid?: boolean;
  initialSnapToGrid?: boolean;
  initialOrthogonalLock?: boolean;
  minZoom?: number;
  maxZoom?: number;
}

export function useCanvasEngine(options: CanvasEngineOptions = {}) {
  const zoom = ref<number>(options.initialZoom ?? 1);
  const minZoom = options.minZoom ?? 0.1;
  const maxZoom = options.maxZoom ?? 3.0;

  const panOffset = ref<CanvasPoint>({ x: 0, y: 0 });
  const isPanning = ref<boolean>(false);
  const panStartMouse = ref<CanvasPoint>({ x: 0, y: 0 });
  const panStartOffset = ref<CanvasPoint>({ x: 0, y: 0 });

  // Grid & Snapping State
  const showGrid = ref<boolean>(options.initialShowGrid ?? true);
  const gridSize = ref<number>(options.initialGridSize ?? 40);
  const snapToGrid = ref<boolean>(options.initialSnapToGrid ?? true);
  const orthogonalLock = ref<boolean>(options.initialOrthogonalLock ?? false);

  // Convert Client viewport coordinates (e.clientX, e.clientY) to Canvas coordinates (snapped or raw)
  const clientToCanvas = (
    clientX: number,
    clientY: number,
    containerElement: HTMLElement | null,
    forceRaw: boolean = false,
    customZoom?: number
  ): { x: number; y: number; rawX: number; rawY: number } => {
    if (!containerElement) {
      return { x: 0, y: 0, rawX: 0, rawY: 0 };
    }
    const rect = containerElement.getBoundingClientRect();
    const mouseViewportX = clientX - rect.left;
    const mouseViewportY = clientY - rect.top;

    const currentZoom = customZoom || zoom.value || 1;
    const rawX = (mouseViewportX - panOffset.value.x) / currentZoom;
    const rawY = (mouseViewportY - panOffset.value.y) / currentZoom;

    let x = Math.round(rawX);
    let y = Math.round(rawY);

    if (!forceRaw && snapToGrid.value && gridSize.value > 0) {
      x = Math.round(rawX / gridSize.value) * gridSize.value;
      y = Math.round(rawY / gridSize.value) * gridSize.value;
    }

    return { x, y, rawX, rawY };
  };

  // Convert Canvas coordinates to Container viewport coordinates
  const canvasToViewport = (canvasX: number, canvasY: number): CanvasPoint => {
    return {
      x: canvasX * zoom.value + panOffset.value.x,
      y: canvasY * zoom.value + panOffset.value.y
    };
  };

  // Orthogonal lock calculation (0°, 90°, 45°)
  const calculateOrthogonalPoint = (
    startX: number,
    startY: number,
    currentX: number,
    currentY: number
  ): CanvasPoint => {
    const dx = currentX - startX;
    const dy = currentY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Horizontal lock
    if (absDx >= 2.2 * absDy) {
      return { x: currentX, y: startY };
    }
    // Vertical lock
    if (absDy >= 2.2 * absDx) {
      return { x: startX, y: currentY };
    }
    // 45 degree diagonal lock
    const dist = Math.round((absDx + absDy) / 2);
    const signX = dx >= 0 ? 1 : -1;
    const signY = dy >= 0 ? 1 : -1;
    return {
      x: startX + dist * signX,
      y: startY + dist * signY
    };
  };

  // Mouse Wheel Zoom centered on cursor
  const handleWheelZoom = (
    e: WheelEvent,
    containerElement: HTMLElement | null,
    onZoomChange?: (newZoom: number) => void
  ) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    const oldZoom = zoom.value;
    const newZoom = Math.min(maxZoom, Math.max(minZoom, Number((oldZoom + delta).toFixed(2))));
    if (newZoom === oldZoom) return;

    if (containerElement) {
      const rect = containerElement.getBoundingClientRect();
      const mouseViewportX = e.clientX - rect.left;
      const mouseViewportY = e.clientY - rect.top;

      // Keep point under mouse fixed:
      const canvasX = (mouseViewportX - panOffset.value.x) / oldZoom;
      const canvasY = (mouseViewportY - panOffset.value.y) / oldZoom;

      panOffset.value.x = Math.round(mouseViewportX - canvasX * newZoom);
      panOffset.value.y = Math.round(mouseViewportY - canvasY * newZoom);
    }

    zoom.value = newZoom;
    if (onZoomChange) {
      onZoomChange(newZoom);
    }
  };

  // Start Canvas Pan
  const startPan = (clientX: number, clientY: number) => {
    isPanning.value = true;
    panStartMouse.value = { x: clientX, y: clientY };
    panStartOffset.value = { ...panOffset.value };
  };

  // Update Canvas Pan
  const updatePan = (clientX: number, clientY: number) => {
    if (!isPanning.value) return;
    const dx = clientX - panStartMouse.value.x;
    const dy = clientY - panStartMouse.value.y;
    panOffset.value = {
      x: Math.round(panStartOffset.value.x + dx),
      y: Math.round(panStartOffset.value.y + dy)
    };
  };

  // End Canvas Pan
  const endPan = () => {
    isPanning.value = false;
  };

  // Calculate Strict Content Bounding Box of all visible components (accounting for rotation)
  const calculateComponentsBoundingBox = (
    components?: Array<{ x: number; y: number; width: number; height: number; rotation?: number; visible?: boolean }>
  ) => {
    const visible = (components || []).filter(c => c.visible !== false);
    if (!visible || visible.length === 0) {
      return null;
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

    const width = Math.max(20, Math.round(maxX - minX));
    const height = Math.max(20, Math.round(maxY - minY));

    return {
      minX: Math.round(minX),
      minY: Math.round(minY),
      maxX: Math.round(maxX),
      maxY: Math.round(maxY),
      width,
      height
    };
  };

  // Reset Pan & Center View
  const centerCanvasInViewport = (
    canvasWidth: number,
    canvasHeight: number,
    containerElement: HTMLElement | null,
    components?: Array<{ x: number; y: number; width: number; height: number; rotation?: number; visible?: boolean }>,
    onZoomChange?: (newZoom: number) => void
  ) => {
    fitCanvasToViewport(canvasWidth, canvasHeight, containerElement, components, onZoomChange);
  };

  // Fit canvas: calculates strict minimal bounding box containing all components or canvas,
  // scales to tightly fill the editing viewport from (0,0) with no wasted blank space.
  const fitCanvasToViewport = (
    canvasWidth: number,
    canvasHeight: number,
    containerElement: HTMLElement | null,
    components?: Array<{ x: number; y: number; width: number; height: number; rotation?: number; visible?: boolean }>,
    onZoomChange?: (newZoom: number) => void
  ) => {
    if (!containerElement) return;
    const rect = containerElement.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    // Available viewport space (minus 30px top & left rulers and 8px margin)
    const rulerOffset = 30;
    const availableW = Math.max(100, rect.width - rulerOffset - 8);
    const availableH = Math.max(100, rect.height - rulerOffset - 8);

    const bbox = calculateComponentsBoundingBox(components);
    let targetW = canvasWidth || 1980;
    let targetH = canvasHeight || 1100;

    if (bbox && bbox.width > 20 && bbox.height > 20) {
      targetW = bbox.width;
      targetH = bbox.height;
    }

    const zoomW = availableW / targetW;
    const zoomH = availableH / targetH;
    const rawZoom = Math.min(zoomW, zoomH);
    
    // Fit zoom ensures all components neatly fill the available viewport
    const fitZoom = Math.min(3.5, Math.max(0.05, Number((Math.floor(rawZoom * 100) / 100).toFixed(2))));

    zoom.value = fitZoom;
    if (onZoomChange) {
      onZoomChange(fitZoom);
    }
    // Origin is placed strictly at (30, 30) matching the ruler's (0, 0) tick
    panOffset.value = { x: rulerOffset, y: rulerOffset };
  };

  // Calculate Content Bounding Box of all components
  const getContentBoundingBox = (
    components: Array<{ x: number; y: number; width: number; height: number }>
  ) => {
    if (!components || components.length === 0) {
      return null;
    }
    const minX = Math.min(...components.map(c => c.x));
    const minY = Math.min(...components.map(c => c.y));
    const maxX = Math.max(...components.map(c => c.x + c.width));
    const maxY = Math.max(...components.map(c => c.y + c.height));
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(10, maxX - minX),
      height: Math.max(10, maxY - minY)
    };
  };

  // Snap All Components to nearest grid nodes (snaps x, y to exact grid points)
  const snapAllToGrid = <T extends { x: number; y: number; width?: number; height?: number }>(
    components: T[],
    customGridSize?: number
  ): T[] => {
    const gs = customGridSize || gridSize.value || 10;
    return components.map(c => ({
      ...c,
      x: Math.round(c.x / gs) * gs,
      y: Math.round(c.y / gs) * gs
    }));
  };

  // Center All Components in canvas
  const centerAllInCanvas = <T extends { x: number; y: number; width: number; height: number }>(
    components: T[],
    canvasWidth: number,
    canvasHeight: number
  ): T[] => {
    const bbox = getContentBoundingBox(components);
    if (!bbox) return components;

    const targetX = Math.round((canvasWidth - bbox.width) / 2);
    const targetY = Math.round((canvasHeight - bbox.height) / 2);
    const dx = targetX - bbox.minX;
    const dy = targetY - bbox.minY;

    return components.map(c => ({
      ...c,
      x: c.x + dx,
      y: c.y + dy
    }));
  };

  // Crop Canvas to content minimal bounding box
  const cropCanvasToContent = <T extends { x: number; y: number; width: number; height: number }>(
    components: T[],
    padding: number = 20,
    minDimension: number = 40
  ): {
    newWidth: number;
    newHeight: number;
    updatedComponents: T[];
  } | null => {
    const bbox = getContentBoundingBox(components);
    if (!bbox) return null;

    const gs = gridSize.value || 10;
    const pad = Math.max(gs, Math.round(padding / gs) * gs);

    const calculatedW = bbox.width + pad * 2;
    const calculatedH = bbox.height + pad * 2;

    const newWidth = Math.max(minDimension, Math.ceil(calculatedW / gs) * gs);
    const newHeight = Math.max(minDimension, Math.ceil(calculatedH / gs) * gs);

    const dx = pad - bbox.minX;
    const dy = pad - bbox.minY;

    const updatedComponents = components.map(c => ({
      ...c,
      x: c.x + dx,
      y: c.y + dy
    }));

    return {
      newWidth,
      newHeight,
      updatedComponents
    };
  };

  // Translate all components so content top-left starts at (0, 0)
  const alignContentToOrigin = <T extends { x: number; y: number; width: number; height: number }>(
    components: T[],
    targetOriginX: number = 0,
    targetOriginY: number = 0
  ): T[] => {
    const bbox = getContentBoundingBox(components);
    if (!bbox) return components;

    const dx = targetOriginX - bbox.minX;
    const dy = targetOriginY - bbox.minY;

    if (dx === 0 && dy === 0) return components;

    return components.map(c => ({
      ...c,
      x: Math.round(c.x + dx),
      y: Math.round(c.y + dy)
    }));
  };

  // Shift any components that have negative coordinates into the positive quadrant (x >= 0, y >= 0)
  const normalizeNegativeCoordinates = <T extends { x: number; y: number; width?: number; height?: number; rotation?: number; visible?: boolean }>(
    components: T[]
  ): { components: T[]; shifted: boolean; shiftX: number; shiftY: number } => {
    if (!components || components.length === 0) {
      return { components, shifted: false, shiftX: 0, shiftY: 0 };
    }

    let minX = 0;
    let minY = 0;
    let hasNegative = false;

    components.forEach(c => {
      if (c.visible !== false) {
        let left = c.x ?? 0;
        let top = c.y ?? 0;

        if (c.rotation) {
          const rad = (c.rotation * Math.PI) / 180;
          const cos = Math.abs(Math.cos(rad));
          const sin = Math.abs(Math.sin(rad));
          const w = c.width || 0;
          const h = c.height || 0;
          const rotatedHalfW = (w / 2) * cos + (h / 2) * sin;
          const rotatedHalfH = (w / 2) * sin + (h / 2) * cos;
          const centerX = left + w / 2;
          const centerY = top + h / 2;
          left = centerX - rotatedHalfW;
          top = centerY - rotatedHalfH;
        }

        if (left < minX) {
          minX = left;
          hasNegative = true;
        }
        if (top < minY) {
          minY = top;
          hasNegative = true;
        }
      }
    });

    if (!hasNegative) {
      return { components, shifted: false, shiftX: 0, shiftY: 0 };
    }

    const shiftX = minX < 0 ? Math.ceil(-minX) : 0;
    const shiftY = minY < 0 ? Math.ceil(-minY) : 0;

    const shiftedComponents = components.map(c => ({
      ...c,
      x: Math.round(c.x + shiftX),
      y: Math.round(c.y + shiftY)
    }));

    return {
      components: shiftedComponents,
      shifted: true,
      shiftX,
      shiftY
    };
  };

  // Fit and Center All Content in Viewport (自动计算所有图形最大缩放与居中视口坐标)
  const fitAndCenterContentInViewport = <T extends { x: number; y: number; width: number; height: number }>(
    components: T[],
    canvasWidth: number,
    canvasHeight: number,
    containerElement: HTMLElement | null,
    onZoomChange?: (newZoom: number) => void
  ) => {
    if (!containerElement) return;
    const rect = containerElement.getBoundingClientRect();
    const availableW = Math.max(100, rect.width - 24); // Deduct ruler width (24px)
    const availableH = Math.max(100, rect.height - 24); // Deduct ruler height (24px)

    const bbox = getContentBoundingBox(components);
    let targetBounds = {
      minX: 0,
      minY: 0,
      width: canvasWidth,
      height: canvasHeight,
      centerX: canvasWidth / 2,
      centerY: canvasHeight / 2
    };

    if (bbox && bbox.width > 10 && bbox.height > 10) {
      targetBounds = {
        minX: bbox.minX,
        minY: bbox.minY,
        width: bbox.width,
        height: bbox.height,
        centerX: bbox.minX + bbox.width / 2,
        centerY: bbox.minY + bbox.height / 2
      };
    }

    // Add margin around graphics
    const margin = 80;
    const scaleX = (availableW - margin) / targetBounds.width;
    const scaleY = (availableH - margin) / targetBounds.height;
    const optimalZoom = Math.min(2.5, Math.max(0.15, Number(Math.min(scaleX, scaleY).toFixed(2))));

    zoom.value = optimalZoom;
    if (onZoomChange) {
      onZoomChange(optimalZoom);
    }

    // Viewport center point (offset by ruler 24px)
    const vpCenterX = 24 + availableW / 2;
    const vpCenterY = 24 + availableH / 2;

    panOffset.value = {
      x: Math.round(vpCenterX - targetBounds.centerX * optimalZoom),
      y: Math.round(vpCenterY - targetBounds.centerY * optimalZoom)
    };
  };

  return {
    zoom,
    minZoom,
    maxZoom,
    panOffset,
    isPanning,
    showGrid,
    gridSize,
    snapToGrid,
    orthogonalLock,
    clientToCanvas,
    canvasToViewport,
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
  };
}
