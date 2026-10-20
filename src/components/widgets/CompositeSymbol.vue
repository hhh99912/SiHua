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

// 自由刚性缩放比例：将图元内部作为一个不可拆分的整体进行几何变换，同时完全支持用户自由非等比拉伸宽高
const scaleX = computed(() => {
  const compW = Math.max(1, props.component.width);
  const baseW = Math.max(1, baseBounds.value.width);
  return compW / baseW;
});

const scaleY = computed(() => {
  const compH = Math.max(1, props.component.height);
  const baseH = Math.max(1, baseBounds.value.height);
  return compH / baseH;
});

// Memoize child objects with forwarded dataset/telemetry configuration to avoid inline object allocation churn
const resolvedChildren = computed(() => {
  const compData = props.component.data;
  return children.value.map(child => {
    const hasChildData = child.data?.datasetId;
    const effectiveData = hasChildData ? child.data : (compData?.datasetId ? compData : child.data);
    return {
      child,
      renderComp: {
        ...child,
        data: effectiveData
      }
    };
  });
});
</script>

<template>
  <div class="w-full h-full relative overflow-visible select-none flex items-center justify-center">
    <!-- Composite Container Canvas: 统一刚性画板 (作为整体缩放，内部零件相对位置绝对锁定，绝不分离散架) -->
    <div 
      class="relative"
      :style="{
        width: `${baseBounds.width}px`,
        height: `${baseBounds.height}px`,
        transform: `scale(${scaleX}, ${scaleY})`,
        transformOrigin: 'center center',
        backgroundColor: component.style?.fill || 'transparent',
        borderRadius: (component.style?.borderRadius || 0) + 'px'
      }"
    >
      <div
        v-for="item in resolvedChildren"
        :key="item.child.id"
        class="absolute"
        :style="{
          left: `${item.child.x}px`,
          top: `${item.child.y}px`,
          width: `${item.child.width}px`,
          height: `${item.child.height}px`,
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
  </div>
</template>
