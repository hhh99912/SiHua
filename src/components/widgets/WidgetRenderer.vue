<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import EChartWidget from './EChartWidget.vue';
import FluidTank from './FluidTank.vue';
import PipeFlow from './PipeFlow.vue';
import DigitalCounter from './DigitalCounter.vue';
import FloatMetric from './FloatMetric.vue';
import CustomSvgWidget from './CustomSvgWidget.vue';
import CustomHtmlWidget from './CustomHtmlWidget.vue';
import StatusMatrix from './StatusMatrix.vue';
import CyberBorder from './CyberBorder.vue';
import CustomLeaferCanvas from './CustomLeaferCanvas.vue';
import ElectricalBreaker from './ElectricalBreaker.vue';
import ElectricalHandcart from './ElectricalHandcart.vue';
import ElectricalDisconnector from './ElectricalDisconnector.vue';
import ElectricalTransformer from './ElectricalTransformer.vue';
import ElectricalSensor from './ElectricalSensor.vue';
import ElectricalBusbar from './ElectricalBusbar.vue';
import ControlButton from './ControlButton.vue';
import StraightLine from './StraightLine.vue';
import PolyLine from './PolyLine.vue';
import StatusIndicator from './StatusIndicator.vue';
import CompositeSymbol from './CompositeSymbol.vue';
import TimeClockWidget from './TimeClockWidget.vue';

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

const compType = computed(() => props.component?.type || '');
const compCategory = computed(() => props.component?.category || '');
const isComposite = computed(() => props.component?.type === 'composite-symbol' || Boolean(props.component?.children?.length));
</script>

<template>
  <div v-if="component" class="w-full h-full relative overflow-hidden pointer-events-none">
    <!-- 1. Float Metric Fast Route (Most Common SCADA Component - 400+ points fast-path) -->
    <FloatMetric 
      v-if="compType === 'metric-float'"
      :component="component"
      :datasets="datasets"
    />

    <!-- 2. Composite & Grouped SCADA Custom Symbol -->
    <CompositeSymbol
      v-else-if="isComposite"
      :component="component"
      :datasets="datasets"
      :preview-mode="previewMode"
      @jump:screen="emit('jump:screen', $event)"
      class="pointer-events-auto"
    />

    <!-- 3. Control Button -->
    <ControlButton
      v-else-if="compType === 'ctrl-button'"
      :component="component"
      :datasets="datasets"
      :preview-mode="previewMode"
      @jump:screen="emit('jump:screen', $event)"
      class="pointer-events-auto"
    />

    <!-- 4. Straight Electrical Conductor Line & Arrows -->
    <StraightLine
      v-else-if="compType === 'draw-line' || compType === 'draw-arrow'"
      :component="component"
      :datasets="datasets"
    />

    <!-- 5. Polyline / Orthogonal Bus Routing -->
    <PolyLine
      v-else-if="compType === 'draw-polyline'"
      :component="component"
      :datasets="datasets"
    />

    <!-- 6. Status Indicator / Signal LED Light (0: 停止/分闸, 1: 运行/合闸, 2: 故障/告警) -->
    <StatusIndicator
      v-else-if="compType === 'ctrl-indicator' || (compCategory === 'status' && compType !== 'ind-matrix')"
      :component="component"
      :datasets="datasets"
    />

    <!-- 7. Digital Counter / Tabular Readout -->
    <DigitalCounter 
      v-else-if="compType === 'ind-counter' || compType === 'metric-counter' || compType === 'metric-digital'"
      :component="component"
      :datasets="datasets"
    />

    <!-- 8. ECharts Visualizations -->
    <EChartWidget 
      v-else-if="compCategory === 'charts' || compType.startsWith('chart-')"
      :component="component"
      :datasets="datasets"
    />

    <!-- 9. Electrical Power Primary System Symbols -->
    <div v-else-if="compCategory === 'electrical' || compType.startsWith('elec-')" class="w-full h-full">
      <ElectricalBreaker
        v-if="compType === 'elec-breaker'"
        :component="component"
        :datasets="datasets"
      />
      <ElectricalHandcart
        v-else-if="compType === 'elec-handcart'"
        :component="component"
        :datasets="datasets"
      />
      <ElectricalDisconnector
        v-else-if="compType === 'elec-disconnector' || compType === 'elec-grounding'"
        :component="component"
        :datasets="datasets"
      />
      <ElectricalTransformer
        v-else-if="compType === 'elec-transformer'"
        :component="component"
        :datasets="datasets"
      />
      <ElectricalSensor
        v-else-if="compType === 'elec-ct' || compType === 'elec-pt' || compType === 'elec-arrester'"
        :component="component"
        :datasets="datasets"
      />
      <ElectricalBusbar
        v-else-if="compType === 'elec-busbar'"
        :component="component"
        :datasets="datasets"
      />
    </div>

    <!-- 10. Metrics & Digital Displays & Time Clocks -->
    <div v-else-if="compCategory === 'metrics' || compType.startsWith('metric-')" class="w-full h-full">
      <TimeClockWidget
        v-if="compType === 'metric-clock' || compType === 'metric-time-banner' || compType === 'metric-clock-analog' || compType === 'metric-countdown'"
        :component="component"
        :datasets="datasets"
        :preview-mode="previewMode"
      />
      <DigitalCounter 
        v-else
        :component="component"
        :datasets="datasets"
      />
    </div>

    <!-- 11. Industrial & SCADA Components -->
    <div v-else-if="compCategory === 'industrial' || compType.startsWith('ind-')" class="w-full h-full">
      <FluidTank 
        v-if="compType === 'ind-tank'"
        :component="component"
        :datasets="datasets"
      />
      <PipeFlow 
        v-else-if="compType === 'ind-pipe' || compType === 'draw-pipe'"
        :component="component"
        :datasets="datasets"
      />
      <StatusMatrix 
        v-else-if="compType === 'ind-matrix'"
        :component="component"
        :datasets="datasets"
      />
      <DigitalCounter 
        v-else
        :component="component"
        :datasets="datasets"
      />
    </div>

    <!-- 12. Custom User Primitives & Graphics -->
    <div v-else-if="compCategory === 'custom' || compType === 'custom-svg' || compType === 'custom-html'" class="w-full h-full">
      <CustomSvgWidget 
        v-if="compType === 'custom-svg'"
        :component="component"
        :datasets="datasets"
      />
      <CustomHtmlWidget 
        v-else-if="compType === 'custom-html'"
        :component="component"
        :datasets="datasets"
      />
      <div 
        v-else
        class="w-full h-full border border-cyan-500/40 rounded flex items-center justify-center p-2 text-xs font-mono text-cyan-300 bg-cyan-950/30"
      >
        {{ component.name }}
      </div>
    </div>

    <!-- 14. Cyber Decorations & Borders -->
    <CyberBorder 
      v-else-if="compCategory === 'decoration' || compType.startsWith('deco-')"
      :component="component"
    />

    <!-- 15. Comprehensive Vector Drawing (All conventional basic primitives) -->
    <CustomLeaferCanvas 
      v-else
      :component="component"
    />
  </div>
</template>
