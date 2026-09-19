import { ScreenComponent } from '../types';

export interface Point2D {
  x: number;
  y: number;
}

export function isLineComponent(type?: string): boolean {
  if (!type) return false;
  return (
    type === 'draw-polyline' ||
    type === 'polyline' ||
    type === 'draw-line' ||
    type === 'draw-arrow' ||
    type === 'straight-line' ||
    type === 'pipe-flow' ||
    type === 'ind-pipe' ||
    type === 'draw-pipe'
  );
}

export function isCyberBorderComponent(type?: string, category?: string): boolean {
  if (!type && !category) return false;
  if (category === 'decoration') return true;
  return (
    typeof type === 'string' && (
      type.startsWith('deco-border') ||
      type.startsWith('deco-') ||
      type === 'cyber-border' ||
      type === 'cyber-box'
    )
  );
}

export function isHollowComponent(comp: ScreenComponent): boolean {
  if (isCyberBorderComponent(comp.type, comp.category)) {
    return true;
  }
  if (comp.type === 'draw-rect' || comp.type === 'draw-rounded-rect') {
    const fill = comp.style?.fill;
    const fillOpacity = comp.style?.fillOpacity;
    return (!fill || fill === 'transparent') || fillOpacity === 0;
  }
  return false;
}

export function getPolylinePoints(comp: ScreenComponent): Point2D[] {
  const customPts = comp.customProps?.points || (comp.style as any)?.points;
  const w = comp.width || 100;
  const h = comp.height || 100;

  if (Array.isArray(customPts) && customPts.length >= 2) {
    const hasRatios = customPts[0].xRatio !== undefined && customPts[0].yRatio !== undefined;
    
    if (hasRatios) {
      return customPts.map((p: any) => ({
        x: p.xRatio * w,
        y: p.yRatio * h
      }));
    } else {
      const minX = Math.min(...customPts.map((p: any) => p.x ?? 0));
      const maxX = Math.max(...customPts.map((p: any) => p.x ?? 0));
      const minY = Math.min(...customPts.map((p: any) => p.y ?? 0));
      const maxY = Math.max(...customPts.map((p: any) => p.y ?? 0));
      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);
      
      return customPts.map((p: any) => ({
        x: ((p.x - minX) / spanX) * w,
        y: ((p.y - minY) / spanY) * h
      }));
    }
  }

  // Fallback presets
  const lineType = comp.style?.lineType || 'step-horizontal';
  if (lineType === 'step-horizontal') {
    const midX = Math.round(w / 2);
    return [
      { x: 0, y: 0 },
      { x: midX, y: 0 },
      { x: midX, y: h },
      { x: w, y: h }
    ];
  } else if (lineType === 'step-vertical') {
    const midY = Math.round(h / 2);
    return [
      { x: 0, y: 0 },
      { x: 0, y: midY },
      { x: w, y: midY },
      { x: w, y: h }
    ];
  } else if (lineType === 'multi-step') {
    const stepX = Math.round(w * 0.3);
    const stepX2 = Math.round(w * 0.7);
    return [
      { x: 0, y: h },
      { x: stepX, y: h },
      { x: stepX, y: 0 },
      { x: stepX2, y: 0 },
      { x: stepX2, y: h },
      { x: w, y: h }
    ];
  } else {
    return [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h }
    ];
  }
}

export function getPolylineSvgPath(comp: ScreenComponent): string {
  const pts = getPolylinePoints(comp);
  if (!pts || pts.length === 0) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

export function getStraightLinePoints(comp: ScreenComponent): { x1: number; y1: number; x2: number; y2: number } {
  const customPts = comp.customProps?.points || (comp.style as any)?.points;
  const w = comp.width || 100;
  const h = comp.height || 100;

  if (Array.isArray(customPts) && customPts.length >= 2) {
    const pt0 = customPts[0];
    const pt1 = customPts[1];
    
    if (pt0.xRatio !== undefined && pt0.yRatio !== undefined) {
      return {
        x1: pt0.xRatio * w,
        y1: pt0.yRatio * h,
        x2: pt1.xRatio * w,
        y2: pt1.yRatio * h
      };
    }
    
    const minX = Math.min(pt0.x ?? 0, pt1.x ?? 0);
    const maxX = Math.max(pt0.x ?? 0, pt1.x ?? 0);
    const minY = Math.min(pt0.y ?? 0, pt1.y ?? 0);
    const maxY = Math.max(pt0.y ?? 0, pt1.y ?? 0);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    
    return {
      x1: ((pt0.x - minX) / spanX) * w,
      y1: ((pt0.y - minY) / spanY) * h,
      x2: ((pt1.x - minX) / spanX) * w,
      y2: ((pt1.y - minY) / spanY) * h
    };
  }

  if (w >= h * 2.5) {
    return { x1: 0, y1: h / 2, x2: w, y2: h / 2 };
  } else if (h >= w * 2.5) {
    return { x1: w / 2, y1: 0, x2: w / 2, y2: h };
  } else {
    return { x1: 0, y1: 0, x2: w, y2: h };
  }
}
