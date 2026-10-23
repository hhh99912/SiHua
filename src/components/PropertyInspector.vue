<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  Settings2,
  Zap,
  RotateCcw,
  Save,
  X,
  Layers,
  Trash2,
  BookmarkPlus,
  Activity,
  Type,
  Square,
  Workflow,
  Check,
  TrendingUp,
  BarChart3,
  Plus,
  Database,
  Edit3
} from 'lucide-vue-next';
import { ScreenComponent, ScreenConfig, DatasetItem, ScreenItem, ScadaChartPoint } from '../types';
import { scadaFacilities, findScadaPointDef, getScadaPointDisplayName } from '../utils/scadaClient';
import { GB_STANDARD_SYMBOLS } from '../data/gbStandardSymbols';
import { getCustomSymbols } from '../utils/customSymbolStorage';
import ChartPointAssociationModal from './ChartPointAssociationModal.vue';

interface Props {
  component: ScreenComponent | null;
  selectedComponents?: ScreenComponent[];
  screen: ScreenConfig;
  datasets: DatasetItem[];
  screens?: ScreenItem[];
}

const props = withDefaults(defineProps<Props>(), {
  selectedComponents: () => [],
  screens: () => []
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:component', comp: ScreenComponent): void;
  (e: 'update:components', comps: ScreenComponent[]): void;
  (e: 'update:datasets', datasets: DatasetItem[]): void;
  (e: 'update:screen', screen: ScreenConfig): void;
  (e: 'align:component', direction: any): void;
  (e: 'group', targets?: ScreenComponent[]): void;
  (e: 'ungroup', target?: ScreenComponent): void;
  (e: 'save:symbol', targets?: ScreenComponent[]): void;
  (e: 'delete', ids: string[]): void;
  (e: 'open:batch:points'): void;
  (e: 'open:data-association', comp: ScreenComponent): void;
  (e: 'open:control', devId: string): void;
}>();

// 事务提交控制机制 (Draft-Commit 机制)
const draftComponent = ref<ScreenComponent | null>(null);
const originalComponentJson = ref<string>('');
const showSaveToast = ref(false);
let toastTimer: any = null;

// Deep Clone Helper
const cloneComponent = (comp: ScreenComponent | null): ScreenComponent | null => {
  if (!comp) return null;
  return JSON.parse(JSON.stringify(comp));
};

// Initialize & Track Props Changes
watch(
  () => props.component?.id,
  () => {
    if (props.component) {
      draftComponent.value = cloneComponent(props.component);
      if (draftComponent.value) {
        if (!draftComponent.value.data) draftComponent.value.data = { mapping: {} };
        if (!draftComponent.value.data.mapping) draftComponent.value.data.mapping = {};
        if (!draftComponent.value.customProps) draftComponent.value.customProps = {};
        if (!draftComponent.value.style) draftComponent.value.style = {};
      }
      originalComponentJson.value = JSON.stringify(draftComponent.value);
    } else {
      draftComponent.value = null;
      originalComponentJson.value = '';
    }
  },
  { immediate: true }
);

// Determine Dirty Status
const isDirty = computed(() => {
  if (!draftComponent.value || !originalComponentJson.value) return false;
  return JSON.stringify(draftComponent.value) !== originalComponentJson.value;
});

// Commit / Apply Draft Transaction
const handleApply = () => {
  if (!draftComponent.value) return;

  const compToSubmit = cloneComponent(draftComponent.value);
  if (!compToSubmit) return;

  emit('update:component', compToSubmit);
  originalComponentJson.value = JSON.stringify(compToSubmit);

  showSaveToast.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    showSaveToast.value = false;
  }, 1800);
};

// Revert / Discard Draft
const handleCancel = () => {
  if (originalComponentJson.value) {
    draftComponent.value = JSON.parse(originalComponentJson.value);
  }
};

// Keyboard shortcut Ctrl+S or Cmd+S to submit
const handleGlobalKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    if (isDirty.value) {
      e.preventDefault();
      e.stopPropagation();
      handleApply();
    }
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  clearTimeout(toastTimer);
});

// SCADA 实时曲线与实时柱状图识别
const isRealtimeChart = computed(() => {
  if (!draftComponent.value) return false;
  const t = draftComponent.value.type;
  return t === 'chart-realtime-curve' || t === 'chart-realtime-bar';
});

// 默认调色板 (纯白、青色、琥珀黄、浅绿、天蓝、粉紫等亮白高对比色)
const CHART_PALETTE = ['#ffffff', '#00f2ff', '#fbbf24', '#34d399', '#38bdf8', '#c084fc', '#f472b6', '#f97316'];

const ensurePointsArray = () => {
  if (!draftComponent.value) return [];
  if (!draftComponent.value.customProps) draftComponent.value.customProps = {};
  if (!Array.isArray(draftComponent.value.customProps.points)) {
    draftComponent.value.customProps.points = [];
  }
  return draftComponent.value.customProps.points;
};

// 图表测点数据关联模态框状态 (严格遵循普通遥测的厂站-间隔-装置-点表4级关联体系)
const showChartPointModal = ref(false);
const chartPointModalMode = ref<'add' | 'edit'>('add');
const chartPointModalTargetIndex = ref<number | null>(null);
const chartPointModalInitialPoint = ref<ScadaChartPoint | null>(null);

// 打开添加关联测点
const handleOpenAddChartPoint = () => {
  chartPointModalMode.value = 'add';
  chartPointModalTargetIndex.value = null;
  chartPointModalInitialPoint.value = null;
  showChartPointModal.value = true;
};

// 打开修改测点关联
const handleOpenEditChartPoint = (pt: ScadaChartPoint, idx: number) => {
  chartPointModalMode.value = 'edit';
  chartPointModalTargetIndex.value = idx;
  chartPointModalInitialPoint.value = { ...pt };
  showChartPointModal.value = true;
};

// 提交测点数据关联 (添加或修改)
const handleChartPointModalSubmit = (payload: { point: ScadaChartPoint; targetIndex?: number | null }) => {
  const pts = ensurePointsArray();
  if (payload.targetIndex !== undefined && payload.targetIndex !== null && payload.targetIndex >= 0) {
    pts[payload.targetIndex] = payload.point;
  } else {
    const existIdx = pts.findIndex((p: any) => p.id === payload.point.id);
    if (existIdx >= 0) {
      pts[existIdx] = payload.point;
    } else {
      pts.push(payload.point);
    }
  }
  showChartPointModal.value = false;
};

const handleRemovePoint = (index: number) => {
  if (!draftComponent.value?.customProps?.points) return;
  draftComponent.value.customProps.points.splice(index, 1);
};

// 元件类型特化分类识别
const isBreakerOrSwitch = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  return (
    t.includes('breaker') ||
    t.includes('switch') ||
    t.includes('disconnector') ||
    t.includes('ground') ||
    t.includes('circuit') ||
    t === 'cb' ||
    t === 'iso' ||
    t === 'es'
  );
});

const isTelemetry = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  return t.includes('metric') || t.includes('floatmetric') || t.includes('telemetry') || t.includes('analog') || t.includes('gauge');
});

const isTransformer = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  return t.includes('transformer') || t.includes('trans');
});

const isLineOrBusbar = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  return t.includes('line') || t.includes('busbar') || t.includes('polyline');
});

const isControlButton = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  return t.includes('button') || t.includes('btn') || draftComponent.value.category === 'buttons';
});

const isTextLabel = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  return t.includes('text') || t === 'draw-text' || t.includes('label');
});

const isBasicGeometry = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  return t.startsWith('draw-') && !t.includes('text') && !t.includes('line');
});

export interface AvailableStateItem {
  id: string | number;
  name: string;
  matchValue?: string | number;
  stateValue?: string | number;
  children?: ScreenComponent[];
  type?: 'open' | 'close' | 'fault' | 'test' | 'default';
}

// 识别是否支持状态测试的图元 (国标图元 / 遥信与状态图元 / 自定义组合图元)
const isComponentStateCapable = (comp: ScreenComponent | null): boolean => {
  if (!comp) return false;
  // 1. 已显式定义 states 列表
  if (comp.states && comp.states.length > 0) return true;
  // 2. 自定义组合图元
  if (comp.type === 'composite-symbol' || comp.category === 'custom' || comp.category === 'custom-cell' || comp.customProps?.isCustomSymbol) {
    return true;
  }
  // 3. 国标图元 (GB Standard)
  if (comp.category === 'gb-standard' || comp.customProps?.isGbStandard || GB_STANDARD_SYMBOLS.some(s => s.name === comp.name)) {
    return true;
  }
  // 4. 遥信与状态图元 (开关、断路器、隔离开关、手车、接地刀闸、信号灯/指示灯、状态矩阵等)
  const t = (comp.type || '').toLowerCase();
  const cat = (comp.category || '').toLowerCase();
  const name = comp.name || '';
  if (
    t.includes('breaker') ||
    t.includes('switch') ||
    t.includes('disconnector') ||
    t.includes('ground') ||
    t.includes('handcart') ||
    t.includes('indicator') ||
    t.includes('matrix') ||
    t === 'cb' ||
    t === 'iso' ||
    t === 'es' ||
    cat === 'status' ||
    cat === 'electrical' ||
    name.includes('断路器') ||
    name.includes('隔离开关') ||
    name.includes('接地') ||
    name.includes('手车') ||
    name.includes('指示灯') ||
    name.includes('信号灯') ||
    comp.data?.mapping?.stateKey ||
    comp.data?.mapping?.statusKey ||
    comp.data?.mapping?.yx
  ) {
    return true;
  }
  return false;
};

// 提取当前图元的所有可用已定义状态列表
const availableStates = computed<AvailableStateItem[]>(() => {
  if (!draftComponent.value || !isComponentStateCapable(draftComponent.value)) return [];

  const comp = draftComponent.value;

  // 1. 当前组件已挂载的 states
  if (comp.states && comp.states.length > 0) {
    return comp.states.map(s => ({
      id: s.id,
      name: s.name,
      matchValue: s.matchValue ?? s.id,
      stateValue: s.stateValue ?? s.matchValue ?? s.id,
      children: s.children
    }));
  }

  // 2. 在国标图元库 GB_STANDARD_SYMBOLS 中寻找同名已定义图元的 states
  const gbDef = GB_STANDARD_SYMBOLS.find(s => s.name === comp.name);
  if (gbDef?.states && gbDef.states.length > 0) {
    return gbDef.states.map(s => ({
      id: s.id,
      name: s.name,
      matchValue: s.matchValue ?? s.id,
      stateValue: s.stateValue ?? s.matchValue ?? s.id,
      children: s.children
    }));
  }

  // 3. 在自定义图元库中寻找同名已定义图元的 states
  try {
    const customSymbols = getCustomSymbols();
    const customDef = customSymbols.find(s => s.name === comp.name || s.name === comp.customProps?.cellName);
    if (customDef?.states && customDef.states.length > 0) {
      return customDef.states.map(s => ({
        id: s.id,
        name: s.name,
        matchValue: s.matchValue ?? s.id,
        stateValue: s.stateValue ?? s.matchValue ?? s.id,
        children: s.children
      }));
    }
  } catch (e) {
    // ignore
  }

  // 4. 电力断路器 (elec-breaker 等)
  const t = (comp.type || '').toLowerCase();
  const name = comp.name || '';
  if (t === 'elec-breaker' || t.includes('breaker') || name.includes('断路器')) {
    return [
      { id: 0, matchValue: 0, name: '分闸 / 隔离 (0)', type: 'open' },
      { id: 1, matchValue: 1, name: '合闸 / 运行 (1)', type: 'close' },
      { id: 2, matchValue: 2, name: '故障 / 告警 (2)', type: 'fault' }
    ];
  }

  // 5. 电力隔离开关 / 负荷开关
  if (t === 'elec-disconnector' || t.includes('disconnector') || name.includes('隔离开关') || name.includes('负荷开关')) {
    return [
      { id: 0, matchValue: 0, name: '分闸 / 开断 (0)', type: 'open' },
      { id: 1, matchValue: 1, name: '合闸 / 导通 (1)', type: 'close' },
      { id: 2, matchValue: 2, name: '故障 / 告警 (2)', type: 'fault' }
    ];
  }

  // 6. 接地刀闸
  if (t === 'elec-grounding' || t.includes('ground') || name.includes('接地')) {
    return [
      { id: 0, matchValue: 0, name: '分闸 / 释放 (0)', type: 'open' },
      { id: 1, matchValue: 1, name: '接地合闸 (1)', type: 'close' }
    ];
  }

  // 7. 手车断路器
  if (t === 'elec-handcart' || t.includes('handcart') || name.includes('手车')) {
    return [
      { id: 1, matchValue: 1, name: '工作位置 (1)', type: 'close' },
      { id: 0, matchValue: 0, name: '试验位置 (0)', type: 'open' },
      { id: 2, matchValue: 2, name: '检修抽出 (2)', type: 'fault' }
    ];
  }

  // 8. 信号指示灯 / 状态点
  if (t === 'ctrl-indicator' || comp.category === 'status' || t.includes('indicator') || name.includes('指示灯') || name.includes('信号灯')) {
    return [
      { id: 0, matchValue: 0, name: '分闸 / 熄灭 (0)', type: 'open' },
      { id: 1, matchValue: 1, name: '合闸 / 点亮 (1)', type: 'close' },
      { id: 2, matchValue: 2, name: '故障 / 告警 (2)', type: 'fault' }
    ];
  }

  // 9. 通用国标图元
  if (comp.category === 'gb-standard' || comp.customProps?.isGbStandard) {
    return [
      { id: 0, matchValue: 0, name: '分闸 / 隔离 (0)', type: 'open' },
      { id: 1, matchValue: 1, name: '合闸 / 运行 (1)', type: 'close' },
      { id: 2, matchValue: 2, name: '故障 / 告警 (2)', type: 'fault' }
    ];
  }

  // 10. 绑定遥信测点图元
  if (comp.data?.mapping?.stateKey || comp.data?.mapping?.statusKey || comp.data?.mapping?.yx) {
    return [
      { id: 0, matchValue: 0, name: '分闸 / 0 态', type: 'open' },
      { id: 1, matchValue: 1, name: '合闸 / 1 态', type: 'close' },
      { id: 2, matchValue: 2, name: '告警 / 2 态', type: 'fault' }
    ];
  }

  return [];
});

// 检查当前状态是否被选中激活
const isStateActive = (st: AvailableStateItem) => {
  if (!draftComponent.value) return false;
  const targetVal = String(st.matchValue ?? st.stateValue ?? st.id);

  if (draftComponent.value.activeState !== undefined && draftComponent.value.activeState !== null) {
    if (String(draftComponent.value.activeState) === targetVal || String(draftComponent.value.activeState) === String(st.id)) {
      return true;
    }
  }

  const sd = draftComponent.value.data?.staticData;
  if (sd !== undefined && sd !== null) {
    const sVal = typeof sd === 'object' ? (sd.state ?? sd.value) : sd;
    if (sVal !== undefined && (String(sVal) === targetVal || String(sVal) === String(st.id))) {
      return true;
    }
  }

  const cpVal = draftComponent.value.customProps?.state ?? draftComponent.value.customProps?.position;
  if (cpVal !== undefined && (String(cpVal) === targetVal || String(cpVal) === String(st.id))) {
    return true;
  }

  const indVal = draftComponent.value.style?.indicatorState;
  if (indVal !== undefined && (String(indVal) === targetVal || String(indVal) === String(st.id))) {
    return true;
  }

  return false;
};

// 当前激活状态的名称标签
const currentActiveStateLabel = computed(() => {
  if (!availableStates.value.length) return '';
  const active = availableStates.value.find(st => isStateActive(st));
  return active ? active.name : '';
});

// 点击即时切换图元至指定状态，并立即触发主画布更新
const applyComponentState = (st: AvailableStateItem) => {
  if (!draftComponent.value) return;

  const rawVal = st.matchValue !== undefined ? st.matchValue : (st.stateValue !== undefined ? st.stateValue : st.id);
  const numVal = !isNaN(Number(rawVal)) ? Number(rawVal) : rawVal;

  draftComponent.value.activeState = numVal;
  if (!draftComponent.value.customProps) draftComponent.value.customProps = {};
  draftComponent.value.customProps.state = numVal;
  draftComponent.value.customProps.position = numVal;

  if (!draftComponent.value.data) draftComponent.value.data = { mapping: {} };
  draftComponent.value.data.useStatic = true;
  if (!draftComponent.value.data.staticData || typeof draftComponent.value.data.staticData !== 'object') {
    draftComponent.value.data.staticData = {};
  }
  draftComponent.value.data.staticData.state = numVal;
  draftComponent.value.data.staticData.value = numVal;

  if (!draftComponent.value.style) draftComponent.value.style = {};
  if (typeof numVal === 'number') {
    draftComponent.value.style.indicatorState = numVal;
  }

  // 若该状态自带几何子图元定义，则直接装载
  if (st.children && Array.isArray(st.children) && st.children.length > 0) {
    draftComponent.value.children = JSON.parse(JSON.stringify(st.children));
  }

  // 若组件本身没有 states 字段，补充挂载匹配的 states
  if (!draftComponent.value.states || draftComponent.value.states.length === 0) {
    const gbDef = GB_STANDARD_SYMBOLS.find(s => s.name === draftComponent.value?.name);
    if (gbDef?.states && gbDef.states.length > 0) {
      draftComponent.value.states = JSON.parse(JSON.stringify(gbDef.states));
    } else {
      try {
        const customSymbols = getCustomSymbols();
        const customDef = customSymbols.find(s => s.name === draftComponent.value?.name || s.name === draftComponent.value?.customProps?.cellName);
        if (customDef?.states && customDef.states.length > 0) {
          draftComponent.value.states = JSON.parse(JSON.stringify(customDef.states));
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // 针对通用组合图元（未单独提供子图元几何分支时），根据状态切换标准红绿告警主描边颜色
  if (draftComponent.value.type === 'composite-symbol' && (!st.children || st.children.length === 0)) {
    const targetColor = numVal === 1 ? '#ef4444' : (numVal === 0 ? '#10b981' : '#f59e0b');
    if (draftComponent.value.style) {
      draftComponent.value.style.stroke = targetColor;
    }
    if (Array.isArray(draftComponent.value.children)) {
      draftComponent.value.children.forEach((c: any) => {
        if (c.style?.stroke && c.style.stroke !== 'transparent') {
          const old = (c.style.stroke || '').toLowerCase();
          if (old.includes('ef4444') || old.includes('10b981') || old.includes('f59e0b') || old.includes('00f2ff') || old.includes('ff3344') || old.includes('00e676')) {
            c.style.stroke = targetColor;
          }
        }
      });
    }
  }

  // 关键：立即提交至主编辑界面画布，实现点击即时切换
  const compToSubmit = cloneComponent(draftComponent.value);
  if (compToSubmit) {
    emit('update:component', compToSubmit);
    originalComponentJson.value = JSON.stringify(compToSubmit);
  }
};

const getStateDotClass = (st: AvailableStateItem) => {
  const active = isStateActive(st);
  const val = String(st.matchValue ?? st.stateValue ?? st.id);
  const name = st.name || '';
  const isClose = val === '1' || name.includes('合') || name.includes('工作') || name.includes('点亮');
  const isOpen = val === '0' || name.includes('分') || name.includes('试验') || name.includes('熄灭') || name.includes('正常') || name.includes('释放');
  const isFault = val === '2' || name.includes('故障') || name.includes('告警') || name.includes('抽出') || name.includes('异常');

  if (active) {
    return 'bg-white shadow-[0_0_8px_#ffffff]';
  }

  if (isClose) return 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]';
  if (isOpen) return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]';
  if (isFault) return 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]';
  return 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]';
};

const getStateButtonClass = (st: AvailableStateItem) => {
  const active = isStateActive(st);
  const val = String(st.matchValue ?? st.stateValue ?? st.id);
  const name = st.name || '';
  const isClose = val === '1' || name.includes('合') || name.includes('工作') || name.includes('点亮');
  const isOpen = val === '0' || name.includes('分') || name.includes('试验') || name.includes('熄灭') || name.includes('正常') || name.includes('释放');
  const isFault = val === '2' || name.includes('故障') || name.includes('告警') || name.includes('抽出') || name.includes('异常');

  if (active) {
    if (isClose) return 'bg-rose-600 text-white border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]';
    if (isOpen) return 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]';
    if (isFault) return 'bg-amber-600 text-white border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]';
    return 'bg-sky-600 text-white border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.4)]';
  }

  if (isClose) return 'bg-[#080d1a] text-rose-300 border-rose-950/70 hover:border-rose-500/60 hover:bg-rose-950/20';
  if (isOpen) return 'bg-[#080d1a] text-emerald-300 border-emerald-950/70 hover:border-emerald-500/60 hover:bg-emerald-950/20';
  if (isFault) return 'bg-[#080d1a] text-amber-300 border-amber-950/70 hover:border-amber-500/60 hover:bg-amber-950/20';
  return 'bg-[#080d1a] text-slate-300 border-[#2b3a55] hover:border-sky-500/60 hover:bg-[#131f38]';
};

const getStateTagClass = (st: AvailableStateItem) => {
  const active = isStateActive(st);
  if (active) {
    return 'bg-white/20 text-white border border-white/30';
  }
  return 'bg-[#050914] text-slate-400 border border-[#1e293b]';
};

// 仿真状态测试兼容方法
const setBreakerSimulationState = (stateVal: number) => {
  const match = availableStates.value.find(s => Number(s.matchValue ?? s.id) === stateVal);
  if (match) {
    applyComponentState(match);
  } else {
    applyComponentState({ id: stateVal, matchValue: stateVal, name: `状态 ${stateVal}` });
  }
};

// 遥测字体颜色双向绑定计算属性 (严格修改字体颜色，绝不修改背景底色 style.fill)
const telemetryTextColor = computed(() => {
  if (!draftComponent.value) return '#00f2ff';
  const s = draftComponent.value.style || {};
  const cp = draftComponent.value.customProps || {};
  return s.textColor || s.color || cp.textColor || cp.color || '#00f2ff';
});

const handleTelemetryTextColorChange = (color: string) => {
  if (!draftComponent.value) return;
  if (!draftComponent.value.style) draftComponent.value.style = {};
  if (!draftComponent.value.customProps) draftComponent.value.customProps = {};
  draftComponent.value.style.textColor = color;
  draftComponent.value.style.color = color;
  draftComponent.value.customProps.textColor = color;
  // 清理历史误设的背景填充色，确保遥测底板保持透明
  if (draftComponent.value.style.fill === color) {
    draftComponent.value.style.fill = 'transparent';
  }
};

// 按钮标题双向绑定计算属性
const controlButtonLabel = computed({
  get: () => {
    if (!draftComponent.value) return '';
    return draftComponent.value.customProps?.label || draftComponent.value.name || '';
  },
  set: (val: string) => {
    if (!draftComponent.value) return;
    if (!draftComponent.value.customProps) draftComponent.value.customProps = {};
    draftComponent.value.customProps.label = val;
    draftComponent.value.name = val;
  }
});

// 按钮跳转目标画面双向绑定 (按钮唯一功能：界面跳转)
const targetScreenId = computed({
  get: () => {
    if (!draftComponent.value) return '';
    return draftComponent.value.customProps?.targetScreenId || draftComponent.value.data?.action?.targetScreenId || '';
  },
  set: (val: string) => {
    if (!draftComponent.value) return;
    if (!draftComponent.value.customProps) draftComponent.value.customProps = {};
    draftComponent.value.customProps.targetScreenId = val;
    if (!draftComponent.value.data) draftComponent.value.data = { mapping: {} };
    if (!draftComponent.value.data.action) {
      draftComponent.value.data.action = { type: 'jump-screen', targetScreenId: val };
    } else {
      draftComponent.value.data.action.type = 'jump-screen';
      draftComponent.value.data.action.targetScreenId = val;
    }
  }
});

// 静态标牌内容双向绑定计算属性
const textLabelContent = computed({
  get: () => {
    if (!draftComponent.value) return '';
    return draftComponent.value.customProps?.text || draftComponent.value.name || '';
  },
  set: (val: string) => {
    if (!draftComponent.value) return;
    if (!draftComponent.value.customProps) draftComponent.value.customProps = {};
    draftComponent.value.customProps.text = val;
  }
});
</script>

<template>
  <!-- 宽度设定为 w-[328px]，仅比原来的 320px 宽一点，尺寸紧凑精炼 -->
  <aside 
    class="w-[328px] shrink-0 bg-[#0c1427] border-l border-[#1e293b] flex flex-col h-full text-slate-200 select-none z-30 shadow-2xl relative font-sans text-xs tracking-wide"
    style="contain: layout style;"
  >
    <!-- 1. 属性检查器顶栏 (字体加粗加大) -->
    <div class="h-13 px-4 bg-[#080d1a] border-b border-[#1e293b] flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2.5 min-w-0">
        <Settings2 class="w-5 h-5 text-sky-400 shrink-0 stroke-[2.2]" />
        <div class="flex flex-col min-w-0">
          <span class="text-sm font-extrabold text-white tracking-wide truncate">
            组件属性
          </span>
          <span class="text-xs text-slate-400 font-mono font-bold truncate">
            {{ selectedComponents.length > 1 ? `已选定 ${selectedComponents.length} 项图元` : (draftComponent?.name || '未选定图元') }}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span 
          v-if="isDirty"
          class="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-extrabold bg-amber-950/90 text-amber-300 border border-amber-600/80 animate-pulse"
        >
          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          未保存
        </span>
        <button
          @click="emit('close')"
          class="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          title="关闭属性面板"
        >
          <X class="w-4.5 h-4.5 stroke-[2]" />
        </button>
      </div>
    </div>

    <!-- 2. 主属性展示区 (提示极简、字体加大加粗) -->
    <div class="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3.5 custom-scrollbar pb-24">
      <!-- 多选模式处理 -->
      <div v-if="selectedComponents.length > 1" class="space-y-3">
        <div class="p-3.5 bg-[#131f38] border border-sky-500/40 rounded-xl text-slate-200">
          <div class="flex items-center gap-2 text-sky-400 font-extrabold mb-2 text-sm">
            <Layers class="w-4.5 h-4.5 stroke-[2]" />
            <span>已选定 {{ selectedComponents.length }} 个图元</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs font-bold pt-1">
            <button
              @click="emit('group')"
              class="px-3 py-2 rounded-lg bg-sky-600/25 hover:bg-sky-600/40 text-sky-300 border border-sky-500/50 flex items-center justify-center gap-2 cursor-pointer font-bold transition-colors"
            >
              <BookmarkPlus class="w-4 h-4" />
              <span>组合 (Ctrl+G)</span>
            </button>
            <button
              @click="emit('delete', selectedComponents.map(c => c.id))"
              class="px-3 py-2 rounded-lg bg-rose-600/25 hover:bg-rose-600/40 text-rose-300 border border-rose-500/50 flex items-center justify-center gap-2 cursor-pointer font-bold transition-colors"
            >
              <Trash2 class="w-4 h-4" />
              <span>删除 (Del)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 单选模式 -->
      <template v-else-if="draftComponent">
        <!-- 基础属性卡片 -->
        <div class="p-3 bg-[#101b31] border border-[#1e293b] rounded-xl space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <span class="text-xs font-extrabold text-sky-400">基础属性</span>
            <span class="text-xs font-mono font-bold text-slate-400">{{ draftComponent.id }}</span>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-200 font-bold">图元名称</label>
            <input
              v-model="draftComponent.name"
              type="text"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-sky-400 font-bold"
            />
          </div>

          <!-- 坐标与尺寸 -->
          <div class="grid grid-cols-2 gap-2 pt-1 border-t border-[#1e293b]">
            <div class="space-y-1">
              <span class="text-xs text-slate-300 font-bold">位置 (X, Y)</span>
              <div class="flex items-center gap-1.5">
                <input
                  v-model.number="draftComponent.x"
                  type="number"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold"
                />
                <input
                  v-model.number="draftComponent.y"
                  type="number"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold"
                />
              </div>
            </div>
            <div class="space-y-1">
              <span class="text-xs text-slate-300 font-bold">尺寸 (宽 × 高)</span>
              <div class="flex items-center gap-1.5">
                <input
                  v-model.number="draftComponent.width"
                  type="number"
                  min="4"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold"
                />
                <input
                  v-model.number="draftComponent.height"
                  type="number"
                  min="4"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <!-- 旋转角度 -->
          <div class="flex items-center justify-between pt-1 text-xs">
            <span class="text-slate-300 font-bold">旋转角度</span>
            <select
              v-model.number="draftComponent.rotation"
              class="bg-[#080d1a] border border-[#2b3a55] rounded-lg px-3 py-1 text-xs text-white font-mono font-bold"
            >
              <option :value="0">0°</option>
              <option :value="90">90°</option>
              <option :value="180">180°</option>
              <option :value="270">270°</option>
            </select>
          </div>
        </div>

        <!-- 状态测试 (国标图元 / 遥信与状态图元 / 自定义组合图元已定义状态即时测试) -->
        <div 
          v-if="availableStates.length > 0" 
          class="p-3 bg-[#101b31] border border-cyan-500/40 rounded-xl space-y-2.5 shadow-[0_0_15px_rgba(6,182,212,0.12)]"
        >
          <div class="pb-1.5 border-b border-[#1e293b]">
            <span class="text-cyan-300 font-extrabold text-xs">状态测试</span>
          </div>

          <div class="grid gap-1.5" :class="availableStates.length > 3 ? 'grid-cols-4' : 'grid-cols-3'">
            <button
              v-for="st in availableStates"
              :key="st.id"
              type="button"
              @click="applyComponentState(st)"
              class="py-1.5 px-2 rounded-lg font-mono font-extrabold transition-all cursor-pointer border text-center text-xs select-none"
              :class="getStateButtonClass(st)"
            >
              {{ st.matchValue ?? st.id }}
            </button>
          </div>
        </div>

        <!-- 0. SCADA 工业多测点实时曲线 / 实时柱状图 (支持关联多个遥测或电度测点、风格与实时曲线弹框一致) -->
        <div v-if="isRealtimeChart" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-xl space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-cyan-400 font-extrabold text-xs">
              <TrendingUp v-if="draftComponent.type === 'chart-realtime-curve'" class="w-4 h-4 text-cyan-400 stroke-[2.2]" />
              <BarChart3 v-else class="w-4 h-4 text-cyan-400 stroke-[2.2]" />
              <span>{{ draftComponent.type === 'chart-realtime-curve' ? '实时曲线配置' : '实时柱状图配置' }}</span>
            </div>
            <span class="text-[11px] font-mono text-cyan-300 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-700/50">
              已关联 {{ draftComponent.customProps?.points?.length || 0 }} 个测点
            </span>
          </div>

          <!-- 曲线专有配置 -->
          <div v-if="draftComponent.type === 'chart-realtime-curve'" class="space-y-2 pt-1 border-t border-[#1e293b]">
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <label class="text-xs text-slate-200 font-bold">记录时长窗口</label>
                <select
                  v-model.number="draftComponent.customProps.timeWindow"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2 py-1 text-xs text-white font-bold cursor-pointer"
                >
                  <option :value="1">最新 1 分钟</option>
                  <option :value="5">最新 5 分钟</option>
                  <option :value="10">最新 10 分钟 (标准)</option>
                  <option :value="30">最新 30 分钟</option>
                  <option :value="60">最新 60 分钟</option>
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-xs text-slate-200 font-bold">采样频率</label>
                <select
                  v-model.number="draftComponent.customProps.sampleInterval"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2 py-1 text-xs text-white font-bold cursor-pointer"
                >
                  <option :value="1">每 1 秒采 1 点 (标准)</option>
                  <option :value="2">每 2 秒采 1 点</option>
                  <option :value="5">每 5 秒采 1 点</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1">
              <div class="space-y-1">
                <label class="text-xs text-slate-200 font-bold">坐标轴数字字号 (px)</label>
                <input
                  v-model.number="draftComponent.customProps.axisFontSize"
                  type="number"
                  min="8"
                  max="24"
                  placeholder="默认 10"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2.5 py-1 text-xs text-white font-mono font-bold"
                />
              </div>
            </div>

            <div class="flex items-center justify-between text-xs font-bold text-slate-200 pt-1">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" v-model="draftComponent.customProps.smooth" class="rounded text-cyan-500" />
                <span>曲线平滑拟合</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" v-model="draftComponent.customProps.showArea" class="rounded text-cyan-500" />
                <span>面积着色</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" v-model="draftComponent.customProps.showLegend" class="rounded text-cyan-500" />
                <span>显示图例</span>
              </label>
            </div>
          </div>

          <!-- 柱状图专有配置 -->
          <div v-else class="space-y-2.5 pt-1 border-t border-[#1e293b]">
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <label class="text-xs text-slate-200 font-bold">柱体宽度 (px)</label>
                <input
                  v-model.number="draftComponent.customProps.barWidth"
                  type="number"
                  min="8"
                  max="80"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2.5 py-1 text-xs text-white font-mono font-bold"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs text-slate-200 font-bold">数值标签</label>
                <div class="h-7 flex items-center">
                  <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      v-model="draftComponent.customProps.showValueLabel"
                      class="rounded text-cyan-500 w-4 h-4 cursor-pointer"
                    />
                    <span>柱顶显示数值</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- 控制柱顶数字大小与横纵轴数字大小 -->
            <div class="grid grid-cols-3 gap-2 pt-1 border-t border-[#1e293b]/60">
              <div class="space-y-1">
                <label class="text-[11px] text-slate-200 font-bold truncate" title="柱顶数字字号">柱顶数字字号</label>
                <input
                  v-model.number="draftComponent.customProps.valueFontSize"
                  type="number"
                  min="8"
                  max="32"
                  placeholder="11"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2 py-1 text-xs text-white font-mono font-bold text-center"
                />
              </div>

              <div class="space-y-1">
                <label class="text-[11px] text-slate-200 font-bold truncate" title="横轴文字字号">横轴文字字号</label>
                <input
                  v-model.number="draftComponent.customProps.xAxisFontSize"
                  type="number"
                  min="8"
                  max="24"
                  placeholder="10"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2 py-1 text-xs text-white font-mono font-bold text-center"
                />
              </div>

              <div class="space-y-1">
                <label class="text-[11px] text-slate-200 font-bold truncate" title="纵轴刻度字号">纵轴刻度字号</label>
                <input
                  v-model.number="draftComponent.customProps.yAxisFontSize"
                  type="number"
                  min="8"
                  max="24"
                  placeholder="10"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2 py-1 text-xs text-white font-mono font-bold text-center"
                />
              </div>
            </div>
          </div>

          <!-- Y 轴量程范围 -->
          <div class="space-y-1 pt-1 border-t border-[#1e293b]">
            <span class="text-xs text-slate-200 font-bold">Y轴量程范围 (留空则自动自适应)</span>
            <div class="grid grid-cols-2 gap-2">
              <input
                v-model="draftComponent.customProps.yAxisMin"
                type="number"
                placeholder="Y轴最小值 (如 0)"
                class="bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2.5 py-1 text-xs text-white font-mono font-bold"
              />
              <input
                v-model="draftComponent.customProps.yAxisMax"
                type="number"
                placeholder="Y轴最大值 (如 100)"
                class="bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2.5 py-1 text-xs text-white font-mono font-bold"
              />
            </div>
          </div>

          <!-- 已关联测点列表 (多测点管理) -->
          <div class="space-y-1.5 pt-2 border-t border-[#1e293b]">
            <div class="flex items-center justify-between">
              <label class="text-xs text-slate-200 font-bold">已关联测点 ({{ draftComponent.customProps?.points?.length || 0 }})</label>
              <span class="text-[10px] text-slate-400">支持遥测 YC / 电度 DD</span>
            </div>

            <div class="max-h-44 overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5">
              <div
                v-for="(pt, idx) in (draftComponent.customProps?.points || [])"
                :key="pt.id + '-' + idx"
                class="p-2 bg-[#080d1a] border border-[#23334d] hover:border-cyan-500/50 rounded-lg flex items-center justify-between gap-2 text-xs transition-colors"
              >
                <div class="flex items-center gap-1.5 truncate flex-1 min-w-0">
                  <div class="truncate flex-1 min-w-0">
                    <div class="text-white font-bold truncate flex items-center gap-1" :title="getScadaPointDisplayName(pt)">
                      <span class="truncate">{{ getScadaPointDisplayName(pt) }}</span>
                      <span v-if="pt.unit" class="text-white/80 font-mono text-[10px] shrink-0">({{ pt.unit }})</span>
                    </div>
                    <div v-if="pt.bayName || pt.devName" class="text-[10px] text-white/80 truncate mt-0.5">
                      {{ pt.bayName || '' }} {{ pt.devName ? '· ' + pt.devName : '' }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <!-- 颜色选择器 -->
                  <input
                    type="color"
                    v-model="pt.color"
                    class="w-5 h-5 rounded cursor-pointer border border-[#1e293b] p-0 bg-transparent shrink-0"
                    title="选择柱体/曲线颜色"
                  />
                  <!-- 修改关联按钮 -->
                  <button
                    type="button"
                    @click="handleOpenEditChartPoint(pt, idx)"
                    class="px-2 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 rounded text-[11px] font-bold text-cyan-300 hover:text-cyan-100 flex items-center gap-1 cursor-pointer transition-colors"
                    title="修改测点数据关联 (从厂站装置点表重新选点)"
                  >
                    <Database class="w-3 h-3 text-cyan-400" />
                    <span>修改</span>
                  </button>
                  <!-- 删除按钮 -->
                  <button
                    type="button"
                    @click="handleRemovePoint(idx)"
                    class="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-rose-950/30 cursor-pointer transition-colors"
                    title="移除此测点"
                  >
                    <Trash2 class="w-3.5 h-3.5 stroke-[2]" />
                  </button>
                </div>
              </div>

              <div 
                v-if="!draftComponent.customProps?.points || draftComponent.customProps.points.length === 0"
                class="text-center py-4 text-slate-500 text-xs italic bg-[#080d1a] border border-dashed border-[#1e293b] rounded-lg"
              >
                尚未关联测点，请点击下方按钮关联测点
              </div>
            </div>
          </div>

          <!-- 添加新关联测点按钮 (采用普通遥测相同的 4 级级联关联体系) -->
          <div class="pt-1">
            <button
              type="button"
              @click="handleOpenAddChartPoint"
              class="w-full py-2 bg-[#0c162c] hover:bg-cyan-950/80 border border-dashed border-cyan-500/60 hover:border-cyan-400 rounded-lg text-cyan-300 hover:text-cyan-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
            >
              <Plus class="w-4 h-4 stroke-[2.5]" />
              <span>添加关联测点 (从厂站装置点表选择)</span>
            </button>
          </div>
        </div>

        <!-- 1. 高压断路器 / 开关 -->
        <div v-else-if="isBreakerOrSwitch" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-xl space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-amber-400 font-extrabold text-xs">
              <Zap class="w-4 h-4 text-amber-400 stroke-[2.2]" />
              <span>开关电气属性</span>
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-200 font-bold">电压等级</label>
            <select
              v-model="draftComponent.customProps.voltageLevel"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-3 py-1.5 text-xs text-white font-bold cursor-pointer"
            >
              <option value="10kV">10kV</option>
              <option value="35kV">35kV</option>
              <option value="110kV">110kV</option>
              <option value="220kV">220kV</option>
              <option value="500kV">500kV</option>
            </select>
          </div>

          <div class="p-2 bg-[#080d1a] rounded-lg border border-[#2b3a55] flex items-center justify-between">
            <span class="text-xs text-slate-200 font-bold">防误闭锁</span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                v-model="draftComponent.customProps.interlockBlocked" 
                class="sr-only peer"
              />
              <div class="w-9 h-5 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          <!-- 动作仿真测试 (0分/1合/2异常) -->
          <div class="space-y-1.5 pt-1 border-t border-[#1e293b]">
            <label class="text-xs text-slate-200 font-bold">仿真状态</label>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                @click="setBreakerSimulationState(0)"
                class="py-1.5 rounded-lg font-extrabold transition-colors cursor-pointer border text-center text-xs"
                :class="draftComponent.customProps?.state === 0 
                  ? 'bg-emerald-600 text-white border-emerald-400' 
                  : 'bg-[#080d1a] text-emerald-400 border-emerald-900/60 hover:bg-emerald-950/40'"
              >
                分闸 (0)
              </button>
              <button
                type="button"
                @click="setBreakerSimulationState(1)"
                class="py-1.5 rounded-lg font-extrabold transition-colors cursor-pointer border text-center text-xs"
                :class="draftComponent.customProps?.state === 1 
                  ? 'bg-rose-600 text-white border-rose-400' 
                  : 'bg-[#080d1a] text-rose-400 border-rose-900/60 hover:bg-rose-950/40'"
              >
                合闸 (1)
              </button>
              <button
                type="button"
                @click="setBreakerSimulationState(2)"
                class="py-1.5 rounded-lg font-extrabold transition-colors cursor-pointer border text-center text-xs"
                :class="draftComponent.customProps?.state === 2 
                  ? 'bg-amber-600 text-white border-amber-400' 
                  : 'bg-[#080d1a] text-amber-400 border-amber-900/60 hover:bg-amber-950/40'"
              >
                异常 (2)
              </button>
            </div>
          </div>
        </div>

        <!-- 2. 遥测数字牌 (严格修改字体颜色，绝不改变背景底色) -->
        <div v-else-if="isTelemetry" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-xl space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-sky-400 font-extrabold text-xs">
              <Activity class="w-4 h-4 text-sky-400 stroke-[2.2]" />
              <span>遥测属性</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-xs text-slate-200 font-bold">字体颜色</label>
              <div class="flex items-center gap-1.5 bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2 py-1">
                <input
                  type="color"
                  :value="telemetryTextColor"
                  @input="handleTelemetryTextColorChange(($event.target as HTMLInputElement).value)"
                  class="w-5 h-5 rounded cursor-pointer border border-[#1e293b] p-0 bg-transparent shrink-0"
                />
                <input
                  type="text"
                  :value="telemetryTextColor"
                  @input="handleTelemetryTextColorChange(($event.target as HTMLInputElement).value)"
                  class="w-full bg-transparent text-xs text-white font-mono font-bold focus:outline-hidden"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-xs text-slate-200 font-bold">字号 (px)</label>
              <input
                v-model.number="draftComponent.style.fontSize"
                type="number"
                min="8"
                max="300"
                class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2.5 py-1 text-xs text-white font-mono font-bold"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-xs text-slate-200 font-bold">小数保留位数</label>
              <select
                v-model.number="draftComponent.style.decimals"
                class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2 py-1 text-xs text-white font-mono font-bold cursor-pointer"
              >
                <option :value="0">0位 (整数)</option>
                <option :value="1">1位小数</option>
                <option :value="2">2位小数 (标准)</option>
                <option :value="3">3位小数</option>
                <option :value="4">4位小数</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-xs text-slate-200 font-bold">剔除无效零</label>
              <div class="h-7 flex items-center">
                <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-200">
                  <input
                    type="checkbox"
                    v-model="draftComponent.style.trimZeros"
                    class="rounded border-slate-700 text-sky-500 w-4 h-4 cursor-pointer"
                  />
                  <span>自动剔除 0</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. 主变压器 -->
        <div v-else-if="isTransformer" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-xl space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-indigo-400 font-extrabold text-xs">
              <Zap class="w-4 h-4 text-indigo-400 stroke-[2.2]" />
              <span>变压器参数</span>
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-200 font-bold">额定容量 (MVA)</label>
            <input
              v-model="draftComponent.customProps.ratedCapacity"
              type="text"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold"
              placeholder="例如: 50MVA"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-200 font-bold">接线型式</label>
            <select
              v-model="draftComponent.customProps.windingType"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold cursor-pointer"
            >
              <option value="Y/△-11">Y/△-11</option>
              <option value="Yn/△-11">Yn/△-11</option>
              <option value="YN/yn0/d11">YN/yn0/d11</option>
              <option value="Y/Y">Y/Y</option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-200 font-bold">分接头档位 (Tap)</label>
            <input
              v-model.number="draftComponent.customProps.currentTap"
              type="number"
              min="1"
              max="27"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold"
            />
          </div>
        </div>

        <!-- 4. 母线 / 走线 -->
        <div v-else-if="isLineOrBusbar" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-xl space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-cyan-400 font-extrabold text-xs">
              <Workflow class="w-4 h-4 text-cyan-400 stroke-[2.2]" />
              <span>母线与走线</span>
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-200 font-bold">母线段编号</label>
            <input
              v-model="draftComponent.customProps.busbarCode"
              type="text"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-3 py-1.5 text-xs text-white font-bold"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-200 font-bold">转角正交模式</label>
            <select
              v-model="draftComponent.customProps.cornerMode"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-3 py-1.5 text-xs text-white font-bold cursor-pointer"
            >
              <option value="direct">自由折线</option>
              <option value="ortho-h">水平优先</option>
              <option value="ortho-v">垂直优先</option>
            </select>
          </div>

          <div class="p-2 bg-[#080d1a] rounded-lg border border-[#2b3a55] space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-200 font-bold">潮流动画</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  v-model="draftComponent.customProps.flowAnimation" 
                  class="sr-only peer"
                />
                <div class="w-9 h-5 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>
            <div v-if="draftComponent.customProps.flowAnimation" class="flex items-center justify-between pt-1 border-t border-[#1e293b]">
              <span class="text-xs text-slate-300 font-bold">流向</span>
              <div class="flex items-center gap-3">
                <label class="flex items-center gap-1 text-xs text-white font-bold cursor-pointer">
                  <input type="radio" value="forward" v-model="draftComponent.customProps.flowDirection" />
                  <span>正向</span>
                </label>
                <label class="flex items-center gap-1 text-xs text-white font-bold cursor-pointer">
                  <input type="radio" value="reverse" v-model="draftComponent.customProps.flowDirection" />
                  <span>反向</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. 交互按钮 (动作类型与双人复核已删，唯一功能：界面跳转) -->
        <div v-else-if="isControlButton" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-xl space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-purple-400 font-extrabold text-xs">
              <Square class="w-4 h-4 text-purple-400 stroke-[2.2]" />
              <span>按钮属性</span>
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-200 font-bold">按钮文字</label>
            <input
              v-model="controlButtonLabel"
              type="text"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-3 py-1.5 text-xs text-white font-bold"
              placeholder="例如: 调阅一次接线图"
            />
          </div>

          <!-- 跳转目标画面下拉选择 -->
          <div class="space-y-1">
            <label class="text-xs text-slate-200 font-bold">跳转目标画面</label>
            <select
              v-model="targetScreenId"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-3 py-1.5 text-xs text-white font-bold cursor-pointer"
            >
              <option value="">-- 请选择跳转画面 --</option>
              <option
                v-for="s in screens"
                :key="s.id"
                :value="s.id"
              >
                {{ s.title || s.name || s.id }}
              </option>
            </select>
          </div>
        </div>

        <!-- 6. 文本标牌 (发光特效已彻底删除) -->
        <div v-else-if="isTextLabel" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-xl space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-emerald-400 font-extrabold text-xs">
              <Type class="w-4 h-4 text-emerald-400 stroke-[2.2]" />
              <span>标牌文本</span>
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-200 font-bold">标牌显示内容</label>
            <textarea
              v-model="textLabelContent"
              rows="3"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg p-2 text-xs text-white font-mono font-bold leading-relaxed resize-y"
            ></textarea>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-xs text-slate-200 font-bold">文字颜色</label>
              <div class="flex items-center gap-1.5 bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2 py-1">
                <input
                  type="color"
                  :value="draftComponent.style.textColor || draftComponent.style.color || '#00f2ff'"
                  @input="draftComponent.style.textColor = ($event.target as HTMLInputElement).value; draftComponent.style.color = ($event.target as HTMLInputElement).value;"
                  class="w-5 h-5 rounded cursor-pointer border border-[#1e293b] p-0 bg-transparent shrink-0"
                />
                <input
                  type="text"
                  :value="draftComponent.style.textColor || draftComponent.style.color || '#00f2ff'"
                  @input="draftComponent.style.textColor = ($event.target as HTMLInputElement).value; draftComponent.style.color = ($event.target as HTMLInputElement).value;"
                  class="w-full bg-transparent text-xs text-white font-mono font-bold focus:outline-hidden"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-xs text-slate-200 font-bold">字号 (px)</label>
              <input
                v-model.number="draftComponent.style.fontSize"
                type="number"
                min="8"
                max="120"
                class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2.5 py-1 text-xs text-white font-mono font-bold"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-xs text-slate-200 font-bold">对齐方式</label>
              <select
                v-model="draftComponent.style.textAlign"
                class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2.5 py-1 text-xs text-white font-bold cursor-pointer"
              >
                <option value="left">左对齐</option>
                <option value="center">居中对齐</option>
                <option value="right">右对齐</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-xs text-slate-200 font-bold">字体粗细</label>
              <select
                v-model="draftComponent.style.fontWeight"
                class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2.5 py-1 text-xs text-white font-bold cursor-pointer"
              >
                <option value="normal">常规</option>
                <option value="bold">加粗</option>
              </select>
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-200 font-bold">字体系列</label>
            <select
              v-model="draftComponent.style.fontFamily"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-2.5 py-1 text-xs text-white font-bold cursor-pointer font-mono"
            >
              <option value="'JetBrains Mono', monospace">等宽工控 (JetBrains Mono)</option>
              <option value="system-ui, sans-serif">标准黑体 (Sans)</option>
              <option value="'Digital-7', monospace">数码液晶 (Digital LED)</option>
              <option value="SimSun, serif">标准宋体 (SongTi)</option>
            </select>
          </div>
        </div>

        <!-- 7. 基础几何图元 -->
        <div v-else-if="isBasicGeometry" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-xl space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-sky-400 font-extrabold text-xs">
              <Square class="w-4 h-4 text-sky-400 stroke-[2.2]" />
              <span>几何外形</span>
            </div>
          </div>

          <div class="space-y-1" v-if="draftComponent.type.includes('rect')">
            <label class="text-xs text-slate-200 font-bold">圆角半径 (px)</label>
            <input
              v-model.number="draftComponent.style.borderRadius"
              type="number"
              min="0"
              max="100"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-200 font-bold">填充不透明度 (0 ~ 1.0)</label>
            <input
              v-model.number="draftComponent.style.fillOpacity"
              type="number"
              step="0.05"
              min="0"
              max="1"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold"
            />
          </div>
        </div>
      </template>

      <!-- 空白未选提示 -->
      <div v-else class="text-center py-16 text-slate-400 space-y-2">
        <Settings2 class="w-8 h-8 mx-auto opacity-35" />
        <p class="text-xs font-bold text-slate-300">请右击图元选择【查看属性面板】</p>
      </div>
    </div>

    <!-- 3. 事务控制底栏 (字体加大加粗) -->
    <div 
      v-if="draftComponent"
      class="h-15 px-4 bg-[#080d1a] border-t border-[#1e293b] flex items-center justify-between shrink-0 absolute bottom-0 left-0 right-0 z-40"
    >
      <button
        @click="handleCancel"
        :disabled="!isDirty"
        class="px-3 py-2 rounded-lg text-xs font-extrabold border transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        :class="isDirty ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-[#0c1427] text-slate-600 border-[#1e293b]'"
      >
        <RotateCcw class="w-3.5 h-3.5 stroke-[2.2]" />
        <span>取消</span>
      </button>

      <div class="flex items-center gap-2">
        <span v-if="showSaveToast" class="text-xs text-emerald-400 font-extrabold flex items-center gap-1">
          <Check class="w-4 h-4 stroke-[2.5]" />
          <span>已保存</span>
        </span>

        <button
          @click="handleApply"
          :disabled="!isDirty"
          class="px-5 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          :class="isDirty 
            ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 border border-sky-300 shadow-sky-900/50' 
            : 'bg-slate-800 text-slate-400 border border-slate-700'"
        >
          <Save class="w-4 h-4 stroke-[2.2]" />
          <span>保存修改</span>
          <span class="text-[11px] font-mono opacity-85">(Ctrl+S)</span>
        </button>
      </div>
    </div>

    <!-- 4. 测点数据关联弹窗 (用于添加与修改图表关联测点，支持4级级联点表体系) -->
    <ChartPointAssociationModal
      v-if="showChartPointModal"
      :visible="showChartPointModal"
      :mode="chartPointModalMode"
      :initial-point="chartPointModalInitialPoint"
      :target-index="chartPointModalTargetIndex"
      @close="showChartPointModal = false"
      @submit="handleChartPointModalSubmit"
    />
  </aside>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #080d1a;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #1e293b;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #334155;
}
</style>
