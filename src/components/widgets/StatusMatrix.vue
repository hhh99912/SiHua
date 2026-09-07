<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const defaultDevices = [
  { id: 'dev-1', name: '1#数控CNC', status: 'RUNNING', temp: '48°C', load: '82%' },
  { id: 'dev-2', name: '2#冲压机床', status: 'RUNNING', temp: '52°C', load: '91%' },
  { id: 'dev-3', name: '3#焊接机械臂', status: 'WARNING', temp: '74°C', load: '98%' },
  { id: 'dev-4', name: '4#注塑成型', status: 'RUNNING', temp: '41°C', load: '65%' },
  { id: 'dev-5', name: '5#回流焊炉', status: 'STOPPED', temp: '25°C', load: '0%' },
  { id: 'dev-6', name: '6#激光切割', status: 'RUNNING', temp: '46°C', load: '78%' },
];

const matrixState = computed(() => {
  const { data, style } = props.component;
  const boundDataset = props.datasets?.find(d => d.id === data.datasetId);
  const activeData = boundDataset?.data || data.staticData || {};

  const devices = activeData.devices || defaultDevices;
  const themeColor = style.stroke || '#00f2ff';
  const title = props.component.name || '车间设备矩阵工况';

  return {
    devices,
    themeColor,
    title
  };
});
</script>

<template>
  <div 
    class="w-full h-full p-2 rounded-xl bg-[#060e22] border border-cyan-400/60 flex flex-col justify-between select-none shadow-[0_4px_20px_rgba(0,0,0,0.8)] overflow-hidden"
    :style="{ borderColor: matrixState.themeColor }"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-cyan-400/30 pb-1.5 mb-1.5 shrink-0">
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_6px_#00f2ff]" />
        <span class="text-xs font-bold text-white tracking-wider">
          {{ matrixState.title }}
        </span>
      </div>
      <div class="flex items-center gap-2 text-[10px] font-mono font-bold">
        <span class="text-emerald-300">● 运行</span>
        <span class="text-amber-300">▲ 预警</span>
        <span class="text-sky-300">○ 停机</span>
      </div>
    </div>

    <!-- Matrix Cells Grid -->
    <div class="grid grid-cols-3 gap-1.5 flex-1 overflow-hidden">
      <div
        v-for="dev in matrixState.devices"
        :key="dev.id"
        class="p-1.5 rounded-lg bg-slate-900 border text-xs font-mono flex flex-col justify-between"
        :class="{
          'border-emerald-400 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]': dev.status === 'RUNNING',
          'border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]': dev.status === 'WARNING',
          'border-slate-700 text-slate-200': dev.status === 'STOPPED'
        }"
      >
        <div class="flex items-center justify-between font-bold">
          <span class="truncate text-white">{{ dev.name }}</span>
          <span 
            class="w-2 h-2 rounded-full shrink-0"
            :class="{
              'bg-emerald-300 shadow-[0_0_6px_#10b981]': dev.status === 'RUNNING',
              'bg-amber-300 shadow-[0_0_6px_#f59e0b]': dev.status === 'WARNING',
              'bg-sky-400 shadow-[0_0_6px_#38bdf8]': dev.status === 'STOPPED'
            }"
          />
        </div>
        <div class="flex items-center justify-between mt-1 text-[10px] text-cyan-200 font-bold">
          <span>负荷: {{ dev.load }}</span>
          <span class="text-amber-300">{{ dev.temp }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
