<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';
import { withAlpha } from '../../utils/color';
import { resolveDataPointValue } from '../../utils/scadaResolver';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const meterData = computed(() => {
  const { data, style, customProps } = props.component;
  const boundDs = props.datasets?.find(d => d.id === data?.datasetId);

  const title = style.feederName || customProps?.name || data?.mapping?.titleKey || props.component.name || '101 进线多功能测控表';

  // Default Telemetry Sample
  let Ua = 5.98, Ub = 6.01, Uc = 5.97, Uab = 10.35;
  let Ia = 142.5, Ib = 141.8, Ic = 143.2;
  let P = 2450.0, Q = 480.0, cosPhi = 0.98, freq = 50.01;

  // 1. Resolve from specific mappings (e.g. voltageKey, currentKey, powerKey)
  const vKey = data?.mapping?.voltageKey || data?.mapping?.valueKey;
  const iKey = data?.mapping?.currentKey;
  const pKey = data?.mapping?.powerKey;

  if (vKey) {
    const val = resolveDataPointValue(props.datasets, data?.datasetId, vKey);
    if (val !== undefined && !isNaN(Number(val))) {
      Uab = Number(val);
      Ua = Number((Uab / 1.732).toFixed(2));
      Ub = Number(((Uab / 1.732) * 1.002).toFixed(2));
      Uc = Number(((Uab / 1.732) * 0.998).toFixed(2));
    }
  }

  if (iKey) {
    const val = resolveDataPointValue(props.datasets, data?.datasetId, iKey);
    if (val !== undefined && !isNaN(Number(val))) {
      Ia = Number(val);
      Ib = Number((Ia * 0.995).toFixed(1));
      Ic = Number((Ia * 1.005).toFixed(1));
    }
  }

  if (pKey) {
    const val = resolveDataPointValue(props.datasets, data?.datasetId, pKey);
    if (val !== undefined && !isNaN(Number(val))) {
      P = Number(val);
      Q = Number((P * 0.2).toFixed(1));
    }
  }

  // 2. Direct device point lookup if raw telemetry available
  if (boundDs && boundDs.data) {
    const d = boundDs.data;
    if (d.Ua !== undefined) Ua = Number(d.Ua);
    if (d.Ub !== undefined) Ub = Number(d.Ub);
    if (d.Uc !== undefined) Uc = Number(d.Uc);
    if (d.Uab !== undefined) Uab = Number(d.Uab);
    if (d.voltage_kv !== undefined && !vKey) Uab = Number(d.voltage_kv);

    if (d.Ia !== undefined) Ia = Number(d.Ia);
    if (d.Ib !== undefined) Ib = Number(d.Ib);
    if (d.Ic !== undefined) Ic = Number(d.Ic);
    if (d.current_a !== undefined && !iKey) {
      Ia = Number(d.current_a);
      Ib = Number((Ia * 0.99).toFixed(1));
      Ic = Number((Ia * 1.01).toFixed(1));
    }

    if (d.active_power_kw !== undefined && !pKey) P = Number(d.active_power_kw);
    if (d.power_consumption_kw !== undefined && !pKey) P = Number(d.power_consumption_kw);
    if (d.reactive_power_kvar !== undefined) Q = Number(d.reactive_power_kvar);
    if (d.power_factor !== undefined) cosPhi = Number(d.power_factor);
    if (d.frequency_hz !== undefined) freq = Number(d.frequency_hz);
  }

  const themeColor = style.stroke || '#00f2ff';
  const bgColor = style.fill || 'rgba(6, 14, 28, 0.92)';

  return {
    title,
    themeColor,
    bgColor,
    Ua: Ua.toFixed(2),
    Ub: Ub.toFixed(2),
    Uc: Uc.toFixed(2),
    Uab: Uab.toFixed(2),
    Ia: Ia.toFixed(1),
    Ib: Ib.toFixed(1),
    Ic: Ic.toFixed(1),
    P: P.toFixed(1),
    Q: Q.toFixed(1),
    cosPhi: cosPhi.toFixed(2),
    freq: freq.toFixed(2)
  };
});
</script>

<template>
  <div 
    class="w-full h-full flex flex-col justify-between p-2 rounded-xl border select-none relative overflow-hidden backdrop-blur-xs shadow-lg transition-all"
    :style="{
      backgroundColor: meterData.bgColor,
      borderColor: withAlpha(meterData.themeColor, 0.4),
      boxShadow: `0 0 16px ${withAlpha(meterData.themeColor, 0.1)}`
    }"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-cyan-500/20 pb-1 font-mono">
      <div class="flex items-center gap-1.5 min-w-0">
        <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        <span class="text-xs font-bold text-slate-100 truncate">{{ meterData.title }}</span>
      </div>
      <span class="text-[9px] text-cyan-300 font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30">
        PM-3000
      </span>
    </div>

    <!-- 3-Phase Voltage & Current Telemetry Matrix Grid -->
    <div class="grid grid-cols-2 gap-1.5 my-1 font-mono text-[10px]">
      <!-- Voltage Block -->
      <div class="p-1.5 rounded bg-slate-950/80 border border-slate-800 space-y-0.5">
        <div class="flex justify-between text-slate-200 font-bold border-b border-slate-800 pb-0.5">
          <span>三相电压</span>
          <span class="text-amber-300 font-bold">{{ meterData.Uab }} kV</span>
        </div>
        <div class="flex justify-between text-yellow-300 font-semibold"><span>Ua:</span><span>{{ meterData.Ua }} kV</span></div>
        <div class="flex justify-between text-emerald-300 font-semibold"><span>Ub:</span><span>{{ meterData.Ub }} kV</span></div>
        <div class="flex justify-between text-rose-400 font-semibold"><span>Uc:</span><span>{{ meterData.Uc }} kV</span></div>
      </div>

      <!-- Current Block -->
      <div class="p-1.5 rounded bg-slate-950/80 border border-slate-800 space-y-0.5">
        <div class="flex justify-between text-slate-200 font-bold border-b border-slate-800 pb-0.5">
          <span>三相电流</span>
          <span class="text-cyan-300 font-bold">cosφ {{ meterData.cosPhi }}</span>
        </div>
        <div class="flex justify-between text-yellow-300 font-semibold"><span>Ia:</span><span>{{ meterData.Ia }} A</span></div>
        <div class="flex justify-between text-emerald-300 font-semibold"><span>Ib:</span><span>{{ meterData.Ib }} A</span></div>
        <div class="flex justify-between text-rose-400 font-semibold"><span>Ic:</span><span>{{ meterData.Ic }} A</span></div>
      </div>
    </div>

    <!-- Power & Frequency Bottom Row -->
    <div class="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/80 text-[10px] font-mono text-center">
      <div class="p-1 rounded bg-slate-900/80 border border-slate-800">
        <div class="text-slate-300 text-[9px] font-semibold">有功 P</div>
        <div class="text-emerald-300 font-bold">{{ meterData.P }} kW</div>
      </div>
      <div class="p-1 rounded bg-slate-900/80 border border-slate-800">
        <div class="text-slate-300 text-[9px] font-semibold">无功 Q</div>
        <div class="text-cyan-300 font-bold">{{ meterData.Q }} kVar</div>
      </div>
      <div class="p-1 rounded bg-slate-900/80 border border-slate-800">
        <div class="text-slate-300 text-[9px] font-semibold">频率 f</div>
        <div class="text-amber-300 font-bold">{{ meterData.freq }} Hz</div>
      </div>
    </div>
  </div>
</template>
