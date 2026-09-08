<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { resolveDataPointValue } from '../../utils/scadaResolver';
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

// Calculate bounding box of children if defined to scale appropriately
const baseBounds = computed(() => {
  if (children.value.length === 0) return { width: props.component.width, height: props.component.height };
  const maxX = children.value.reduce((max, c) => Math.max(max, c.x + c.width), 0);
  const maxY = children.value.reduce((max, c) => Math.max(max, c.y + c.height), 0);
  return {
    width: Math.max(10, maxX),
    height: Math.max(10, maxY)
  };
});

const scaleX = computed(() => props.component.width / (baseBounds.value.width || 1));
const scaleY = computed(() => props.component.height / (baseBounds.value.height || 1));
</script>

<template>
  <div class="w-full h-full relative overflow-visible select-none">
    <!-- Composite Container Canvas -->
    <div 
      class="w-full h-full relative"
      :style="{
        backgroundColor: component.style?.fill || 'transparent',
        borderRadius: (component.style?.borderRadius || 0) + 'px'
      }"
    >
      <div
        v-for="child in children"
        :key="child.id"
        class="absolute"
        :style="{
          left: `${child.x * scaleX}px`,
          top: `${child.y * scaleY}px`,
          width: `${child.width * scaleX}px`,
          height: `${child.height * scaleY}px`,
          transform: child.rotation ? `rotate(${child.rotation}deg)` : 'none',
          zIndex: child.zIndex || 1
        }"
      >
        <WidgetRenderer
          :component="{
            ...child,
            // Forward dataset or telemetry override if configured
            data: child.data?.datasetId ? child.data : (component.data?.datasetId ? component.data : child.data)
          }"
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
