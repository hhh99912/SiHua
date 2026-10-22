<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { resolveDataPointValue, scadaLiveTick } from '../../utils/scadaResolver';
import WidgetRenderer from './WidgetRenderer.vue';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
  previewMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  previewMode: false
});

const emit = defineEmits<{
  (e: 'jump:screen', screenId: string): void;
}>();

const children = computed<ScreenComponent[]>(() => {
  if (props.previewMode) {
    const _tick = scadaLiveTick.value;
  }
  const { states, activeState, data, customProps } = props.component;
  
  if (states && states.length > 0) {
    // 1. Check live SCADA telemetry binding if point is mapped
    const ptKey = data?.bindings?.value || data?.bindings?.state || data?.mapping?.stateKey || data?.mapping?.valueKey;
    if (ptKey && data?.useStatic !== true) {
      const live = resolveDataPointValue(props.datasets, data?.datasetId, ptKey, undefined);
      if (live !== undefined) {
        const match = states.find(s => 
          String(s.matchValue ?? s.id) === String(live) ||
          String(s.id) === String(live) ||
          (s.stateValue !== undefined && String(s.stateValue) === String(live))
        );
        if (match && match.children) {
          return match.children;
        }
      }
    }

    // 2. Direct activeState (simulation test or editor selection)
    if (activeState !== undefined && activeState !== null) {
      const match = states.find(s => 
        String(s.id) === String(activeState) ||
        String(s.matchValue ?? s.id) === String(activeState) ||
        (s.stateValue !== undefined && String(s.stateValue) === String(activeState))
      );
      if (match && match.children) {
        return match.children;
      }
    }

    // 3. Static JSON payload value
    let staticVal: any = undefined;
    if (data?.staticData !== undefined && data?.staticData !== null) {
      if (typeof data.staticData === 'object' && !Array.isArray(data.staticData)) {
        staticVal = data.staticData.state !== undefined ? data.staticData.state : data.staticData.value;
      } else {
        staticVal = data.staticData;
      }
    }
    if (staticVal !== undefined) {
      const match = states.find(s => 
        String(s.matchValue ?? s.id) === String(staticVal) ||
        String(s.id) === String(staticVal) ||
        (s.stateValue !== undefined && String(s.stateValue) === String(staticVal))
      );
      if (match && match.children) {
        return match.children;
      }
    }

    // 4. CustomProps fallback
    const cpVal = customProps?.state ?? customProps?.value;
    if (cpVal !== undefined) {
      const match = states.find(s => 
        String(s.matchValue ?? s.id) === String(cpVal) ||
        String(s.id) === String(cpVal) ||
        (s.stateValue !== undefined && String(s.stateValue) === String(cpVal))
      );
      if (match && match.children) {
        return match.children;
      }
    }

    return states[0]?.children || [];
  }

  return props.component.children || props.component.customProps?.children || [];
});

// Calculate canonical base bounds of children
const baseBounds = computed(() => {
  const defW = (props.component as any).defaultWidth;
  const defH = (props.component as any).defaultHeight;
  if (children.value.length === 0) {
    return {
      width: Math.max(10, defW || props.component.width || 40),
      height: Math.max(10, defH || props.component.height || 80)
    };
  }
  let maxX = 0;
  let maxY = 0;
  for (const c of children.value) {
    maxX = Math.max(maxX, (c.x || 0) + (c.width || 0));
    maxY = Math.max(maxY, (c.y || 0) + (c.height || 0));
  }
  return {
    width: Math.max(10, Math.max(maxX, defW || 0)),
    height: Math.max(10, Math.max(maxY, defH || 0))
  };
});

// 几何比例自适应计算：将子零件坐标精准投影到当前组件尺寸，彻底摒弃 CSS transform scale
// 从根源消除拉伸变宽时竖线变粗、拉伸变窄时横线变粗的 2D 笔触非等比畸变！
const resolvedChildren = computed(() => {
  const compData = props.component.data;
  const compW = Math.max(2, props.component.width);
  const compH = Math.max(2, props.component.height);
  const baseW = Math.max(1, baseBounds.value.width);
  const baseH = Math.max(1, baseBounds.value.height);
  const rx = compW / baseW;
  const ry = compH / baseH;

  return children.value.map(child => {
    const hasChildData = child.data?.datasetId;
    const effectiveData = hasChildData ? child.data : (compData?.datasetId ? compData : child.data);

    // 1. Proportional position and dimension mapping
    const rawX = child.x ?? 0;
    const rawY = child.y ?? 0;
    const rawW = child.width ?? 10;
    const rawH = child.height ?? 10;

    let scaledX = Math.round(rawX * rx);
    let scaledY = Math.round(rawY * ry);
    let scaledW = Math.max(1, Math.round(rawW * rx));
    let scaledH = Math.max(1, Math.round(rawH * ry));

    // For circular elements (e.g. contact points in disconnectors), preserve 1:1 circle shape centered at mapped coordinate
    const isCircle = child.type === 'draw-circle';
    if (isCircle && rawW === rawH) {
      const circleDia = Math.max(2, Math.round(rawW * Math.min(rx, ry)));
      const centerX = Math.round((rawX + rawW / 2) * rx);
      const centerY = Math.round((rawY + rawH / 2) * ry);
      scaledX = centerX - Math.round(circleDia / 2);
      scaledY = centerY - Math.round(circleDia / 2);
      scaledW = circleDia;
      scaledH = circleDia;
    }

    // 2. Stroke width remains clean, uniform, and undistorted in physical pixels
    let strokeW = child.style?.strokeWidth !== undefined ? Number(child.style.strokeWidth) : 2;
    // On extreme micro scales (<= 4px), ensure stroke doesn't exceed half the width/height
    if (scaledW <= 4 || scaledH <= 4) {
      strokeW = 1;
    }

    return {
      child,
      renderComp: {
        ...child,
        x: scaledX,
        y: scaledY,
        width: scaledW,
        height: scaledH,
        style: {
          ...(child.style || {}),
          strokeWidth: strokeW
        },
        data: effectiveData
      }
    };
  });
});
</script>

<template>
  <div 
    class="w-full h-full relative overflow-visible select-none pointer-events-none"
    :style="{
      backgroundColor: component.style?.fill || 'transparent',
      borderRadius: (component.style?.borderRadius || 0) + 'px'
    }"
  >
    <!-- Geometric Proportional Canvas: 采用原生布局坐标投影，零 CSS 缩放，全向线宽物理恒定一致 -->
    <div
      v-for="item in resolvedChildren"
      :key="item.child.id"
      class="absolute pointer-events-auto"
      :style="{
        left: `${item.renderComp.x}px`,
        top: `${item.renderComp.y}px`,
        width: `${item.renderComp.width}px`,
        height: `${item.renderComp.height}px`,
        transform: item.child.rotation ? `rotate(${item.child.rotation}deg)` : 'none',
        zIndex: item.child.zIndex || 1
      }"
    >
      <WidgetRenderer
        :component="item.renderComp"
        :datasets="datasets"
        :preview-mode="previewMode"
        @jump:screen="emit('jump:screen', $event)"
      />
    </div>

    <!-- Fallback when no children are inside -->
    <div 
      v-if="children.length === 0" 
      class="w-full h-full border border-dashed border-cyan-500/40 rounded flex flex-col items-center justify-center p-2 text-center text-xs font-mono text-cyan-400 bg-cyan-950/20"
    >
      <span>{{ component.name }}</span>
      <span class="text-[10px] text-slate-500 mt-0.5">复合图元 (暂无子图元)</span>
    </div>
  </div>
</template>
