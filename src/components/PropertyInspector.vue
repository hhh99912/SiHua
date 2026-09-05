<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  SlidersHorizontal,
  Palette,
  Database,
  Move,
  RotateCw,
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalSpaceAround,
  AlignHorizontalSpaceAround,
  Layers,
  Activity,
  Check,
  Zap,
  BookmarkPlus,
  ExternalLink,
  Navigation,
  Lock,
  Trash2,
  Copy,
  Workflow,
  ToggleRight,
  CircleDot,
  Binary,
  Search,
  Cpu,
  Radio,
  Sliders,
  HelpCircle,
  BarChart2,
  FileCode,
  CheckCircle2,
  ShieldCheck,
  Info,
  Type,
  X,
  Crosshair,
  LocateFixed,
  Link2,
  Unlink,
  AlertTriangle,
  TrendingUp,
  ListPlus,
  Gauge,
  Clock,
  Code2,
  Wand2,
  RefreshCw,
  Play,
  ChevronDown,
  ChevronRight,
  MoveHorizontal,
  MoveVertical,
  Scaling,
  Square,
  Maximize,
  Minimize,
  ArrowUpToLine,
  ArrowDownToLine,
  Eye,
  EyeOff,
  Paintbrush
} from 'lucide-vue-next';
import { ScreenComponent, ScreenConfig, DatasetItem, ScreenItem, ScadaDeviceItem } from '../types';
import {
  COMPONENT_JSON_SCHEMAS,
  getComponentSchemaInfo,
  injectScadaPointToJson,
  injectTimestampToJson,
  injectQualityToJson,
  generate24hWaveformPayload,
  generateRandomSimulationData,
  getFormattedTimestamp,
  ComponentJsonSchemaInfo
} from '../data/componentJsonSchemas';
import { resolveComponentDynamicData, parseStrictNumber } from '../utils/scadaResolver';

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
  (e: 'update:component', comp: ScreenComponent): void;
  (e: 'update:components', comps: ScreenComponent[]): void;
  (e: 'update:screen', screen: ScreenConfig): void;
  (e: 'align:component', type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v' | 'equal-width' | 'equal-height' | 'equal-size' | 'equal-max-size' | 'equal-min-size' | 'make-square'): void;
  (e: 'group', comps?: ScreenComponent[]): void;
  (e: 'ungroup', comp?: ScreenComponent): void;
  (e: 'save:symbol', comps: ScreenComponent[]): void;
  (e: 'delete', ids: string[]): void;
  (e: 'open:batch:points'): void;
  (e: 'open:control', deviceId: string): void;
  (e: 'close'): void;
}>();

const activeTab = ref<'geometry' | 'style' | 'data' | 'interaction'>('geometry');

// Unified SCADA & JSON Data Association State
const targetBindProperty = ref<string>('value');
const dataInspectTab = ref<'live' | 'schema'>('live');
const selectedDeviceId = ref<string>('DEV-101');
const selectedTeleCategory = ref<'yc' | 'yx' | 'dd' | 'yk' | 'yt'>('yc');
const pointSearchQuery = ref<string>('');
const staticJsonInput = ref<string>('');
const staticJsonMsg = ref<string>('');

// JSON Schema & Ingestion Controls
const isSchemaDocOpen = ref<boolean>(false);
const isScadaPointInjectorOpen = ref<boolean>(false);
const scadaInjectorDeviceId = ref<string>('DEV-101');
const scadaInjectorCategory = ref<'yc' | 'yx' | 'dd' | 'yk' | 'yt'>('yc');
const jsonValidationStatus = ref<'valid' | 'invalid' | 'empty'>('valid');
const jsonErrorMessage = ref<string>('');

// Live dynamically resolved JSON payload for current component
const liveDynamicData = computed(() => {
  if (!props.component) return {};
  return resolveComponentDynamicData(props.component, props.datasets);
});

// Current Component's JSON Schema Framework
const currentSchemaInfo = computed<ComponentJsonSchemaInfo>(() => {
  if (!props.component) return COMPONENT_JSON_SCHEMAS['generic'];
  return getComponentSchemaInfo(props.component.type, props.component.category);
});

// Available component properties for target binding
const availableProperties = computed(() => {
  const schema = currentSchemaInfo.value;
  const set = new Set<string>();
  if (schema.fields) {
    schema.fields.forEach(f => set.add(f.field));
  }
  // Standard properties for SCADA
  ['value', 'state', 'unit', 'level', 'activeState', 'label', 'min', 'max', 'color', 'capacity', 'title'].forEach(k => set.add(k));
  return Array.from(set);
});

// Active dynamic property bindings list with live resolved values
const activeBindingsList = computed(() => {
  const comp = props.component;
  if (!comp || !comp.data) return [];
  const bindings = comp.data.bindings || {};
  const entries = Object.entries(bindings);
  
  // If no explicit bindings but mapping exists, include mapping as 'value' or 'state'
  if (entries.length === 0 && comp.data.mapping) {
    const m = comp.data.mapping;
    const targetKey = m.stateKey ? 'state' : 'value';
    const pointKey = m.valueKey || m.stateKey || (m.deviceId && m.pointId ? `${m.deviceId}_YC_${m.pointId}` : '');
    if (pointKey) {
      entries.push([targetKey, pointKey]);
    }
  }

  return entries.map(([propKey, pointKey]) => {
    const match = String(pointKey).match(/^([A-Za-z0-9_-]+)_(YC|YX|DD|YK|YT)_(\d+)/i);
    let devId = match ? match[1] : (comp.data.mapping?.deviceId || 'DEV-101');
    let cat = match ? match[2].toLowerCase() : (comp.data.mapping?.pointCategory || 'yc');
    let ptId = match ? match[3] : (comp.data.mapping?.pointId || '');

    const dev = currentDatasetDevices.value.find(d => d.deviceId === devId);
    let pointName = `${devId}_${cat.toUpperCase()}_${ptId}`;
    let liveVal: any = liveDynamicData.value[propKey] ?? '--';
    let unit = '';

    if (dev) {
      if (cat === 'yc') {
        const pt = dev.telemetries?.find((m: any) => String(m.pointId) === String(ptId));
        if (pt) {
          pointName = pt.name;
          unit = pt.unit || '';
        }
      } else if (cat === 'yx') {
        const pt = dev.teleSignals?.find((s: any) => String(s.pointId) === String(ptId));
        if (pt) {
          pointName = pt.name;
          liveVal = pt.statusText || (pt.value === 1 ? '合闸 (1)' : '分闸 (0)');
        }
      } else if (cat === 'dd') {
        const pt = dev.energies?.find((e: any) => String(e.pointId) === String(ptId));
        if (pt) {
          pointName = pt.name;
          unit = pt.unit || 'kWh';
        }
      }
    }

    return {
      propKey,
      pointKey,
      devId,
      cat,
      ptId,
      pointName,
      liveVal,
      unit
    };
  });
});

const themeColors = [
  '#00f2ff', // Cyber Cyan
  '#3b82f6', // Electric Blue
  '#00e5a3', // Tech Emerald
  '#f59e0b', // Industrial Amber
  '#ef4444', // Crimson Alert
  '#a855f7', // Cyber Purple
  '#ffffff', // Clean White
  '#1e293b', // Deep Slate
];

const boundDataset = computed(() => {
  if (!props.component?.data?.datasetId) {
    return props.datasets[0] || null;
  }
  return props.datasets.find(d => d.id === props.component?.data?.datasetId) || props.datasets[0] || null;
});

// Extract devices from the active dataset
const currentDatasetDevices = computed<ScadaDeviceItem[]>(() => {
  const ds = boundDataset.value;
  if (!ds) return [];
  if (Array.isArray(ds.devices) && ds.devices.length > 0) {
    return ds.devices;
  }
  // Fallback check in data.devices
  if (ds.data && Array.isArray((ds.data as any).devices)) {
    return (ds.data as any).devices;
  }
  return [];
});

// Currently selected device in the picker
const selectedDevice = computed<ScadaDeviceItem | undefined>(() => {
  return currentDatasetDevices.value.find(d => d.deviceId === selectedDeviceId.value) || currentDatasetDevices.value[0];
});

// Filtered points under current device and category
const filteredPoints = computed(() => {
  const dev = selectedDevice.value;
  if (!dev) return [];
  let list: any[] = [];
  if (selectedTeleCategory.value === 'yc') {
    list = dev.telemetries || [];
  } else if (selectedTeleCategory.value === 'yx') {
    list = dev.teleSignals || [];
  } else if (selectedTeleCategory.value === 'dd') {
    list = dev.energies || [];
  } else if (selectedTeleCategory.value === 'yk') {
    list = dev.teleControls || [];
  } else if (selectedTeleCategory.value === 'yt') {
    list = dev.teleRegulations || [];
  }

  if (!pointSearchQuery.value.trim()) return list;
  const q = pointSearchQuery.value.toLowerCase().trim();
  return list.filter(item => 
    String(item.pointId).includes(q) || 
    (item.name && item.name.toLowerCase().includes(q)) ||
    (item.description && item.description.toLowerCase().includes(q))
  );
});

// Component type checks
const isChartComponent = computed(() => {
  if (!props.component) return false;
  return ['chart-line', 'chart-bar', 'chart-pie', 'chart-gauge', 'chart-radar', 'gauge-dashboard', 'tank-level'].includes(props.component.type);
});

const isElectricalSwitch = computed(() => {
  if (!props.component) return false;
  return ['elec-breaker', 'elec-disconnector', 'elec-grounding', 'elec-handcart', 'ctrl-indicator'].includes(props.component.type);
});

const isSystemStatusComponent = computed(() => {
  if (!props.component) return false;
  if (props.component.states && props.component.states.length > 0) return false;
  const t = props.component.type;
  const c = props.component.category;
  return isElectricalSwitch.value || 
    c === 'status' || 
    t === 'ctrl-indicator' || 
    t.startsWith('elec-') || 
    t.includes('valve') ||
    t.includes('pump') ||
    t.includes('motor') ||
    t.includes('switch') ||
    t === 'pipe-flow' ||
    props.component.customProps?.state !== undefined ||
    props.component.style?.indicatorState !== undefined;
});

const currentResolvedBinaryState = computed(() => {
  if (!props.component) return 0;
  const comp = props.component;
  const cp = comp.customProps || {};
  const st = comp.style || {};
  if (cp.state !== undefined) {
    if (typeof cp.state === 'string') {
      const lower = cp.state.toLowerCase();
      if (lower === '1' || lower === 'closed' || lower === 'on' || lower.includes('合')) return 1;
      return 0;
    }
    return Number(cp.state) === 1 ? 1 : 0;
  }
  if (st.indicatorState !== undefined) {
    if (st.indicatorState === 'normal' || st.indicatorState === 1 || String(st.indicatorState) === '1') return 1;
    return 0;
  }
  if (comp.activeState !== undefined) {
    return Number(comp.activeState) === 1 ? 1 : 0;
  }
  return 0;
});

const testBinaryState = (val: number) => {
  if (!props.component) return;
  const isElec = ['elec-breaker', 'elec-disconnector', 'elec-grounding'].includes(props.component.type);
  const stateStr = isElec ? (val === 1 ? 'closed' : 'open') : val;
  
  updateComponentProps({ activeState: val });
  updateComponentCustomProps({
    state: stateStr,
    position: val,
    status: val
  });
  updateComponentStyle({
    indicatorState: val === 1 ? 'normal' : 'off'
  });
  if (props.component.data?.staticData && typeof props.component.data.staticData === 'object') {
    updateComponentData({
      staticData: {
        ...props.component.data.staticData,
        state: val,
        value: val
      }
    });
  }

  // Synchronize live telemetry dataset point if bound
  const sKey = props.component.data?.mapping?.statusKey || props.component.data?.mapping?.stateKey || props.component.data?.mapping?.valueKey;
  if (sKey && boundDataset.value?.devices) {
    for (const dev of boundDataset.value.devices) {
      const sig = dev.teleSignals?.find((s: any) => `${dev.deviceId}_YX_${s.pointId}` === sKey || String(s.pointId) === String(sKey));
      if (sig) {
        sig.value = val;
        sig.statusText = val === 1 ? '合闸 (1)' : '分闸 (0)';
      }
    }
  }
};

const testMultiState = (stateId: string, matchVal?: any) => {
  if (!props.component) return;
  updateComponentProps({ activeState: stateId });
  if (matchVal !== undefined) {
    updateComponentCustomProps({ state: matchVal });
    if (props.component.data?.staticData && typeof props.component.data.staticData === 'object') {
      updateComponentData({
        staticData: {
          ...props.component.data.staticData,
          state: matchVal,
          value: matchVal
        }
      });
    }
  }
};

// SCADA Full Binding Details Inspector
const currentBindingDetails = computed(() => {
  const comp = props.component;
  if (!comp || !comp.data) {
    return {
      isBound: false,
      category: 'none' as const,
      categoryLabel: '未指定',
      categoryBadgeColor: 'bg-slate-800 text-slate-400 border-slate-700',
      isControl: false,
      isRegulation: false,
      currentDisplayValue: '--',
      pointKey: '',
      pointName: '未绑定',
      deviceName: '未选择装置'
    };
  }

  const mapping = comp.data.mapping || {};
  const action = comp.data.action;
  
  let devId = mapping.deviceId || action?.deviceId;
  let rawKey = mapping.valueKey || mapping.stateKey || mapping.statusKey || '';
  
  if (!devId && rawKey) {
    const match = rawKey.match(/^([A-Za-z0-9_-]+)_(YC|YX|DD|YK|YT)_/);
    if (match) devId = match[1];
  }
  
  const dev = currentDatasetDevices.value.find(d => d.deviceId === devId) || 
    (devId ? { deviceId: devId, deviceName: mapping.deviceName || `装置 [${devId}]`, telemetries: [], teleSignals: [], energies: [], teleControls: [], teleRegulations: [] } as any : undefined);

  let category: 'yc' | 'yx' | 'dd' | 'yk' | 'yt' | 'none' = 'none';
  let isControl = false;
  let isRegulation = false;

  if (mapping.pointCategory === 'teleControl' || action?.type === 'tele-control' || mapping.ykPointId || rawKey.includes('_YK_')) {
    category = 'yk';
    isControl = true;
  } else if (mapping.pointCategory === 'teleRegulation' || action?.type === 'tele-regulation' || mapping.ytPointId || rawKey.includes('_YT_')) {
    category = 'yt';
    isRegulation = true;
  } else if (mapping.pointCategory === 'teleSignal' || rawKey.includes('_YX_') || mapping.stateKey || isElectricalSwitch.value) {
    category = 'yx';
  } else if (mapping.pointCategory === 'energy' || rawKey.includes('_DD_')) {
    category = 'dd';
  } else if (mapping.pointCategory === 'telemetry' || rawKey.includes('_YC_') || mapping.valueKey) {
    category = 'yc';
  }

  let pointId: any = undefined;
  if (category === 'yk') {
    pointId = mapping.ykPointId || action?.pointId || mapping.pointId;
  } else if (category === 'yt') {
    pointId = mapping.ytPointId || action?.pointId || mapping.pointId;
  } else {
    pointId = mapping.pointId;
  }
  if (pointId === undefined && rawKey) {
    const m = rawKey.match(/_(?:YC|YX|DD|YK|YT)_(\d+)/i);
    if (m) pointId = Number(m[1]);
  }

  const isBound = !!(devId && pointId !== undefined);

  let pointEntity: any = null;
  let verificationInfo: any = null;
  let currentDisplayValue: any = '--';
  let unit = '';
  let statusText = '';

  if (dev) {
    if (category === 'yk') {
      pointEntity = dev.teleControls?.find((c: any) => String(c.pointId) === String(pointId)) || dev.teleControls?.[0];
      const targetYxId = action?.targetPointId || mapping.targetYxPointId || pointEntity?.targetPointId || 1;
      const targetYx = dev.teleSignals?.find((s: any) => String(s.pointId) === String(targetYxId));
      if (targetYx) {
        statusText = targetYx.statusText || (targetYx.value === 1 ? '合闸 (1)' : '分闸 (0)');
        currentDisplayValue = statusText;
        verificationInfo = {
          type: 'yx',
          typeLabel: '闭环校验遥信 (YX)',
          pointId: targetYxId,
          pointName: targetYx.name,
          currentValue: targetYx.value,
          statusText: targetYx.statusText || (targetYx.value === 1 ? '合闸运行' : '分闸停止')
        };
      } else {
        currentDisplayValue = '未配置校验遥信';
      }
    } else if (category === 'yt') {
      pointEntity = dev.teleRegulations?.find((r: any) => String(r.pointId) === String(pointId)) || dev.teleRegulations?.[0];
      const targetYcId = action?.targetPointId || mapping.targetYcPointId || pointEntity?.targetYcPointId || 1;
      const targetYc = dev.telemetries?.find((m: any) => String(m.pointId) === String(targetYcId));
      if (targetYc) {
        unit = targetYc.unit || pointEntity?.unit || '';
        currentDisplayValue = `${targetYc.value} ${unit}`;
        verificationInfo = {
          type: 'yc',
          typeLabel: '闭环校验遥测 (YC)',
          pointId: targetYcId,
          pointName: targetYc.name,
          currentValue: targetYc.value,
          unit: targetYc.unit
        };
      } else {
        currentDisplayValue = '未配置校验遥测';
      }
    } else if (category === 'yx') {
      pointEntity = dev.teleSignals?.find((s: any) => String(s.pointId) === String(pointId));
      if (pointEntity) {
        statusText = pointEntity.statusText || (pointEntity.value === 1 ? '合闸 (1)' : '分闸 (0)');
        currentDisplayValue = statusText;
      }
    } else if (category === 'dd') {
      pointEntity = dev.energies?.find((e: any) => String(e.pointId) === String(pointId));
      if (pointEntity) {
        unit = pointEntity.unit || 'kWh';
        currentDisplayValue = `${pointEntity.value} ${unit}`;
      }
    } else if (category === 'yc') {
      pointEntity = dev.telemetries?.find((m: any) => String(m.pointId) === String(pointId));
      if (pointEntity) {
        unit = pointEntity.unit || '';
        currentDisplayValue = `${pointEntity.value} ${unit}`;
      }
    }
  }

  const categoryLabelMap = {
    yc: '遥测 YC (模拟量)',
    yx: '遥信 YX (状态量)',
    dd: '电度 DD (电能量)',
    yk: '遥控 YK (控制输出)',
    yt: '遥调 YT (定值输出)',
    none: '未指定'
  };

  const categoryColorMap = {
    yc: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    yx: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    dd: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    yk: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    yt: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    none: 'bg-slate-800 text-slate-400 border-slate-700'
  };

  return {
    isBound,
    deviceId: dev?.deviceId || devId,
    deviceName: dev?.deviceName || mapping.deviceName || (devId ? `装置 ${devId}` : '未指定装置'),
    device: dev,
    category,
    categoryLabel: categoryLabelMap[category],
    categoryBadgeColor: categoryColorMap[category],
    pointId,
    pointName: pointEntity?.name || mapping.pointName || (pointId ? `测点 #${pointId}` : '未指定点名'),
    pointKey: rawKey || (devId && pointId ? `${devId}_${category.toUpperCase()}_${pointId}` : ''),
    currentDisplayValue,
    unit,
    statusText,
    isControl,
    isRegulation,
    verificationPoint: verificationInfo
  };
});

// Helper functions for reading verification values in the point table
const getTargetYxStatusText = (targetYxId: number | string) => {
  const dev = selectedDevice.value;
  if (!dev || !dev.teleSignals) return '无遥信';
  const yx = dev.teleSignals.find(s => String(s.pointId) === String(targetYxId));
  if (!yx) return `未找到 [YX_${targetYxId}]`;
  return `${yx.statusText || (yx.value === 1 ? '合闸' : '分闸')} (${yx.value})`;
};

const getTargetYcValueText = (targetYcId: number | string) => {
  const dev = selectedDevice.value;
  if (!dev || !dev.telemetries) return '无遥测';
  const yc = dev.telemetries.find(m => String(m.pointId) === String(targetYcId));
  if (!yc) return `未找到 [YC_${targetYcId}]`;
  return `${yc.value} ${yc.unit || ''}`;
};

// Locate point in table & smooth scroll
const scrollToPointInTable = (pointId?: number | string) => {
  if (!pointId) return;
  pointSearchQuery.value = '';
  nextTick(() => {
    const el = document.getElementById(`scada-point-row-${pointId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-cyan-400', 'bg-cyan-950/80');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-cyan-400', 'bg-cyan-950/80');
      }, 2500);
    }
  });
};

const handleLocateBoundPoint = () => {
  const details = currentBindingDetails.value;
  if (!details.isBound) return;
  if (details.deviceId && currentDatasetDevices.value.some(d => d.deviceId === details.deviceId)) {
    selectedDeviceId.value = details.deviceId;
  }
  if (details.category && details.category !== 'none') {
    selectedTeleCategory.value = details.category as any;
  }
  scrollToPointInTable(details.pointId);
};

// Automatic reverse synchronization when component changes
const syncCurrentComponentMapping = (autoScroll = false) => {
  if (!props.component) return;
  const details = currentBindingDetails.value;
  if (details.isBound) {
    if (details.deviceId && currentDatasetDevices.value.some(d => d.deviceId === details.deviceId)) {
      selectedDeviceId.value = details.deviceId;
    }
    if (details.category && details.category !== 'none') {
      selectedTeleCategory.value = details.category as any;
    }
    if (autoScroll && details.pointId) {
      scrollToPointInTable(details.pointId);
    }
  } else {
    // 智能默认
    if (isElectricalSwitch.value) {
      selectedTeleCategory.value = 'yx';
    } else if (props.component.type === 'ctrl-button') {
      selectedTeleCategory.value = 'yk';
    } else if (props.component.category === 'metrics') {
      selectedTeleCategory.value = 'yc';
    }
  }
};

watch(
  () => props.component?.id,
  (newId) => {
    if (newId && props.component) {
      syncCurrentComponentMapping(activeTab.value === 'data');
      if (props.component.data?.staticData !== undefined && props.component.data.staticData !== null) {
        staticJsonInput.value = typeof props.component.data.staticData === 'object'
          ? JSON.stringify(props.component.data.staticData, null, 2)
          : String(props.component.data.staticData);
        jsonValidationStatus.value = 'valid';
      } else {
        const schema = getComponentSchemaInfo(props.component.type, props.component.category);
        staticJsonInput.value = JSON.stringify(schema.defaultPayload, null, 2);
        jsonValidationStatus.value = 'valid';
      }
    }
  },
  { immediate: true }
);

watch(
  () => activeTab.value,
  (newTab) => {
    if (newTab === 'data') {
      syncCurrentComponentMapping(true);
    }
  }
);

// Direct Smart Point Binding Action (严格遵循 SCADA 规范：自动将测点与目标属性如 value, state, level, unit 等关联)
const handleBindPointToComponent = (point: any) => {
  if (!props.component) return;
  const dev = selectedDevice.value;
  if (!dev) return;

  const datasetId = boundDataset.value?.id || 'ds-substation-scada';
  const cat = selectedTeleCategory.value;
  let pointKey = '';
  let pointCat: any = 'telemetry';

  if (cat === 'yc') {
    pointKey = `${dev.deviceId}_YC_${point.pointId}`;
    pointCat = 'telemetry';
  } else if (cat === 'yx') {
    pointKey = `${dev.deviceId}_YX_${point.pointId}`;
    pointCat = 'teleSignal';
  } else if (cat === 'dd') {
    pointKey = `${dev.deviceId}_DD_${point.pointId}`;
    pointCat = 'energy';
  } else if (cat === 'yk') {
    pointKey = `${dev.deviceId}_YK_${point.pointId}`;
    pointCat = 'teleControl';
  } else if (cat === 'yt') {
    pointKey = `${dev.deviceId}_YT_${point.pointId}`;
    pointCat = 'teleRegulation';
  }

  // Determine property to bind
  const propToBind = targetBindProperty.value || (cat === 'yx' ? 'state' : 'value');
  const currentBindings = { ...(props.component.data?.bindings || {}) };
  currentBindings[propToBind] = pointKey;

  // Auto-bind unit property if present and not explicitly overridden
  if (point.unit && !currentBindings['unit']) {
    currentBindings['unit'] = `${pointKey}_unit`;
  }

  const mappingUpdates: Record<string, any> = {
    deviceId: dev.deviceId,
    pointCategory: pointCat,
    pointId: point.pointId,
    deviceName: dev.deviceName,
    pointName: point.name,
    valueKey: pointKey
  };

  // 1. 遥信/开关类图元自动映射状态键
  if (isElectricalSwitch.value || cat === 'yx') {
    mappingUpdates.stateKey = pointKey;
    mappingUpdates.statusKey = pointKey;
    mappingUpdates.valueKey = pointKey;
  }

  // 2. 遥控/遥调类图元：遥控遥调本身无采样值，画面状态和显示数值严格取校验点
  let newAction = props.component.data?.action;
  if (cat === 'yk') {
    const defaultYxId = point.targetPointId !== undefined ? point.targetPointId : (dev.teleSignals?.[0]?.pointId ?? 1);
    newAction = {
      type: 'tele-control',
      deviceId: dev.deviceId,
      pointId: point.pointId,
      targetPointId: defaultYxId,
      verifyType: 'yx',
      autoSyncState: true
    };
    // 严谨 SCADA 规范：图元状态直接取闭环校验遥信
    mappingUpdates.stateKey = `${dev.deviceId}_YX_${defaultYxId}`;
    mappingUpdates.statusKey = `${dev.deviceId}_YX_${defaultYxId}`;
    mappingUpdates.valueKey = `${dev.deviceId}_YX_${defaultYxId}`;
    mappingUpdates.ykPointId = point.pointId;
    mappingUpdates.targetYxPointId = defaultYxId;
  } else if (cat === 'yt') {
    const defaultYcId = point.targetYcPointId !== undefined ? point.targetYcPointId : (dev.telemetries?.[0]?.pointId ?? 1);
    newAction = {
      type: 'tele-regulation',
      deviceId: dev.deviceId,
      pointId: point.pointId,
      targetPointId: defaultYcId,
      verifyType: 'yc',
      autoSyncState: true
    };
    // 严谨 SCADA 规范：图元实测读数直接取闭环校验遥测
    mappingUpdates.valueKey = `${dev.deviceId}_YC_${defaultYcId}`;
    mappingUpdates.ytPointId = point.pointId;
    mappingUpdates.targetYcPointId = defaultYcId;
  }

  if (point.unit) {
    mappingUpdates.unitKey = `${pointKey}_unit`;
  }

  updateComponentData({
    datasetId,
    useStatic: false,
    bindings: currentBindings,
    mapping: {
      ...props.component.data.mapping,
      ...mappingUpdates
    },
    action: newAction
  });
};

// Quick Unbind Specific Property
const handleUnbindProperty = (propKey: string) => {
  if (!props.component) return;
  const currentBindings = { ...(props.component.data?.bindings || {}) };
  delete currentBindings[propKey];

  // If no bindings left, clean up mapping
  const remainingKeys = Object.keys(currentBindings);
  const mapping = remainingKeys.length === 0 ? {} : props.component.data?.mapping;

  updateComponentData({
    bindings: currentBindings,
    mapping: mapping
  });
};

// Set Verification Point for YK / YT (切换校验点时同步刷新图元的数据显示源)
const handleSetVerificationPoint = (verifyPointId: number | string) => {
  if (!props.component) return;
  const action = props.component.data?.action;
  const devId = action?.deviceId || props.component.data.mapping?.deviceId || selectedDevice.value?.deviceId || 'DEV-101';
  
  if (selectedTeleCategory.value === 'yk' || action?.type === 'tele-control') {
    updateComponentData({
      mapping: {
        ...props.component.data.mapping,
        targetYxPointId: verifyPointId,
        stateKey: `${devId}_YX_${verifyPointId}`,
        statusKey: `${devId}_YX_${verifyPointId}`,
        valueKey: `${devId}_YX_${verifyPointId}`
      },
      action: {
        ...(action || { type: 'tele-control', deviceId: devId, pointId: props.component.data.mapping?.ykPointId || 1 }),
        type: 'tele-control',
        deviceId: devId,
        targetPointId: verifyPointId,
        verifyType: 'yx',
        autoSyncState: true
      }
    });
  } else if (selectedTeleCategory.value === 'yt' || action?.type === 'tele-regulation') {
    updateComponentData({
      mapping: {
        ...props.component.data.mapping,
        targetYcPointId: verifyPointId,
        valueKey: `${devId}_YC_${verifyPointId}`
      },
      action: {
        ...(action || { type: 'tele-regulation', deviceId: devId, pointId: props.component.data.mapping?.ytPointId || 1 }),
        type: 'tele-regulation',
        deviceId: devId,
        targetPointId: verifyPointId,
        verifyType: 'yc',
        autoSyncState: true
      }
    });
  }
};

// Quick Unbind All Points
const handleUnbindPoint = () => {
  if (!props.component) return;
  updateComponentData({
    useStatic: false,
    bindings: {},
    mapping: {},
    action: undefined
  });
};

// Chart Preset & Standard Template Binding Helpers
const handleBindChartPreset = (presetType: 'power-trend' | 'voltage-trend' | 'load-bar') => {
  if (!props.component) return;
  const datasetId = boundDataset.value?.id || 'ds-substation-scada';

  if (presetType === 'power-trend') {
    updateComponentData({
      datasetId,
      useStatic: false,
      mapping: {
        ...props.component.data.mapping,
        categoriesKey: 'series_time',
        seriesKey: 'series_power'
      }
    });
  } else if (presetType === 'voltage-trend') {
    updateComponentData({
      datasetId,
      useStatic: false,
      mapping: {
        ...props.component.data.mapping,
        categoriesKey: 'series_time',
        seriesKey: 'series_voltage'
      }
    });
  } else if (presetType === 'load-bar') {
    updateComponentData({
      datasetId,
      useStatic: false,
      mapping: {
        ...props.component.data.mapping,
        categoriesKey: 'series_device_names',
        seriesKey: 'series_device_load'
      }
    });
  }
};

// ================= JSON SCHEMA DATA INGESTION & BINDING HANDLERS =================

// Realtime non-blocking JSON validator & injector
const handleJsonInput = (val: string) => {
  staticJsonInput.value = val;
  if (!val.trim()) {
    jsonValidationStatus.value = 'empty';
    jsonErrorMessage.value = '请输入有效的 JSON 数据对象或数组';
    return;
  }
  try {
    const parsed = JSON.parse(val);
    jsonValidationStatus.value = 'valid';
    jsonErrorMessage.value = '';
    
    // Non-blocking real-time data update to component
    if (props.component) {
      updateComponentData({
        useStatic: true,
        staticData: parsed
      });
    }
  } catch (err: any) {
    jsonValidationStatus.value = 'invalid';
    jsonErrorMessage.value = err.message || 'JSON 语法解析错误';
  }
};

// Reset to Default JSON Schema Framework
const handleResetToDefaultSchema = () => {
  const schema = currentSchemaInfo.value;
  const payload = JSON.parse(JSON.stringify(schema.defaultPayload));
  staticJsonInput.value = JSON.stringify(payload, null, 2);
  jsonValidationStatus.value = 'valid';
  jsonErrorMessage.value = '';
  if (props.component) {
    updateComponentData({
      useStatic: true,
      staticData: payload
    });
  }
  staticJsonMsg.value = `✓ 已重置为【${schema.title}】标准规范契约`;
  setTimeout(() => { staticJsonMsg.value = ''; }, 3000);
};

// Inject Selected SCADA Point into JSON Framework
const handleInjectPointToJson = (point: any, cat: 'yc' | 'yx' | 'dd' | 'yk' | 'yt') => {
  const dev = currentDatasetDevices.value.find(d => d.deviceId === scadaInjectorDeviceId.value) || selectedDevice.value;
  const devId = dev?.deviceId || 'DEV-101';
  let currentObj: any = {};
  try {
    currentObj = JSON.parse(staticJsonInput.value || '{}');
  } catch {
    currentObj = currentSchemaInfo.value.defaultPayload;
  }
  
  const updated = injectScadaPointToJson(currentObj, point, cat, devId);
  staticJsonInput.value = JSON.stringify(updated, null, 2);
  jsonValidationStatus.value = 'valid';
  jsonErrorMessage.value = '';
  if (props.component) {
    updateComponentData({
      useStatic: true,
      staticData: updated
    });
  }
  isScadaPointInjectorOpen.value = false;
  staticJsonMsg.value = `✓ 已将测点 [${point.name || point.pointId}] 注入图元 JSON 框架`;
  setTimeout(() => { staticJsonMsg.value = ''; }, 3000);
};

// Inject Current Timestamp
const handleInjectTimestamp = () => {
  let currentObj: any = {};
  try {
    currentObj = JSON.parse(staticJsonInput.value || '{}');
  } catch {
    currentObj = currentSchemaInfo.value.defaultPayload;
  }
  const updated = injectTimestampToJson(currentObj);
  staticJsonInput.value = JSON.stringify(updated, null, 2);
  jsonValidationStatus.value = 'valid';
  if (props.component) {
    updateComponentData({ useStatic: true, staticData: updated });
  }
  staticJsonMsg.value = `✓ 已注入实时采样时间戳: ${getFormattedTimestamp()}`;
  setTimeout(() => { staticJsonMsg.value = ''; }, 3000);
};

// Inject Quality Code
const handleInjectQuality = (code: string = '0x00 (GOOD 优)') => {
  let currentObj: any = {};
  try {
    currentObj = JSON.parse(staticJsonInput.value || '{}');
  } catch {
    currentObj = currentSchemaInfo.value.defaultPayload;
  }
  const updated = injectQualityToJson(currentObj, code);
  staticJsonInput.value = JSON.stringify(updated, null, 2);
  jsonValidationStatus.value = 'valid';
  if (props.component) {
    updateComponentData({ useStatic: true, staticData: updated });
  }
  staticJsonMsg.value = `✓ 已注入规约通信质量码: ${code}`;
  setTimeout(() => { staticJsonMsg.value = ''; }, 3000);
};

// Inject 24h Waveform Data
const handleInject24hWaveform = () => {
  const payload = generate24hWaveformPayload();
  staticJsonInput.value = JSON.stringify(payload, null, 2);
  jsonValidationStatus.value = 'valid';
  if (props.component) {
    updateComponentData({ useStatic: true, staticData: payload });
  }
  staticJsonMsg.value = '✓ 已注入 24h 电力负荷双峰时序波形数据';
  setTimeout(() => { staticJsonMsg.value = ''; }, 3000);
};

// Random SCADA Condition Simulation
const handleInjectRandomSim = () => {
  if (!props.component) return;
  let currentObj: any = {};
  try {
    currentObj = JSON.parse(staticJsonInput.value || '{}');
  } catch {
    currentObj = currentSchemaInfo.value.defaultPayload;
  }
  const updated = generateRandomSimulationData(props.component.type, props.component.category, currentObj);
  staticJsonInput.value = JSON.stringify(updated, null, 2);
  jsonValidationStatus.value = 'valid';
  updateComponentData({ useStatic: true, staticData: updated });
  staticJsonMsg.value = '✓ 仿真工况采样已注入';
  setTimeout(() => { staticJsonMsg.value = ''; }, 3000);
};

// Beautify / Format JSON
const handleFormatJson = () => {
  try {
    const parsed = JSON.parse(staticJsonInput.value);
    staticJsonInput.value = JSON.stringify(parsed, null, 2);
    jsonValidationStatus.value = 'valid';
    jsonErrorMessage.value = '';
    staticJsonMsg.value = '✓ JSON 代码已格式化排版';
    setTimeout(() => { staticJsonMsg.value = ''; }, 2000);
  } catch (err: any) {
    jsonValidationStatus.value = 'invalid';
    jsonErrorMessage.value = err.message;
  }
};

// Copy JSON to Clipboard
const handleCopyJson = () => {
  navigator.clipboard.writeText(staticJsonInput.value);
  staticJsonMsg.value = '✓ 已复制 JSON 数据到剪贴板';
  setTimeout(() => { staticJsonMsg.value = ''; }, 2000);
};

// Apply Standard Preset Template
const handleApplySchemaTemplate = (payload: any) => {
  staticJsonInput.value = JSON.stringify(payload, null, 2);
  jsonValidationStatus.value = 'valid';
  jsonErrorMessage.value = '';
  if (props.component) {
    updateComponentData({
      useStatic: true,
      staticData: payload
    });
  }
  staticJsonMsg.value = '✓ 已应用预设业务模板';
  setTimeout(() => { staticJsonMsg.value = ''; }, 3000);
};

// Manual Apply Button Action
const handleApplyStaticData = () => {
  if (!props.component) return;
  try {
    const parsed = JSON.parse(staticJsonInput.value || '{}');
    updateComponentData({
      useStatic: true,
      staticData: parsed
    });
    jsonValidationStatus.value = 'valid';
    jsonErrorMessage.value = '';
    staticJsonMsg.value = '✓ JSON 数据已生效并驱动图元渲染';
    setTimeout(() => { staticJsonMsg.value = ''; }, 3000);
  } catch (err: any) {
    jsonValidationStatus.value = 'invalid';
    jsonErrorMessage.value = err.message;
    staticJsonMsg.value = '❌ JSON 格式错误: ' + err.message;
  }
};

// Update component helper
const updateComponentProps = (updates: Partial<ScreenComponent>) => {
  if (!props.component) return;
  emit('update:component', {
    ...props.component,
    ...updates
  });
};

const updateComponentStyle = (styleUpdates: Partial<ScreenComponent['style']>) => {
  if (!props.component) return;
  emit('update:component', {
    ...props.component,
    style: {
      ...props.component.style,
      ...styleUpdates
    }
  });
};

const updateComponentCustomProps = (customPropsUpdates: Record<string, any>) => {
  if (!props.component) return;
  emit('update:component', {
    ...props.component,
    customProps: {
      ...(props.component.customProps || {}),
      ...customPropsUpdates
    }
  });
};

const updateComponentStyleAndCustomProps = (
  styleUpdates: Partial<ScreenComponent['style']>, 
  customPropsUpdates?: Record<string, any>
) => {
  if (!props.component) return;
  emit('update:component', {
    ...props.component,
    style: {
      ...props.component.style,
      ...styleUpdates
    },
    customProps: {
      ...(props.component.customProps || {}),
      ...(customPropsUpdates || {})
    }
  });
};

const handleTextTitleChange = (newVal: string) => {
  if (!props.component) return;
  if (props.component.type === 'ctrl-button') {
    updateComponentStyle({ buttonText: newVal });
  } else if (['metric-clock', 'metric-time-banner', 'metric-clock-analog', 'metric-countdown'].includes(props.component.type)) {
    updateComponentCustomProps({ title: newVal });
  } else {
    updateComponentProps({ name: newVal });
    updateComponentStyle({ text: newVal });
  }
};

const updateComponentData = (dataUpdates: Partial<ScreenComponent['data']>) => {
  if (!props.component) return;
  emit('update:component', {
    ...props.component,
    data: {
      ...props.component.data,
      ...dataUpdates,
      mapping: {
        ...props.component.data.mapping,
        ...(dataUpdates.mapping || {})
      }
    }
  });
};

const updateComponentAction = (actionUpdates: Record<string, any>) => {
  if (!props.component) return;
  const currentAction = props.component.data.action || { type: 'none' };
  emit('update:component', {
    ...props.component,
    data: {
      ...props.component.data,
      action: {
        ...currentAction,
        ...actionUpdates
      }
    }
  });
};

// Batch Lock/Unlock
const toggleBatchLock = () => {
  const anyLocked = props.selectedComponents.some(c => c.locked);
  const updated = props.selectedComponents.map(c => ({
    ...c,
    locked: !anyLocked
  }));
  emit('update:components', updated);
};

// ==========================================
// BATCH / MULTI-SELECTION STATE & METHODS
// ==========================================
const batchTab = ref<'geometry' | 'style' | 'align' | 'manage'>('geometry');

const isAllSameType = computed(() => {
  if (props.selectedComponents.length <= 1) return true;
  const firstType = props.selectedComponents[0].type;
  return props.selectedComponents.every(c => c.type === firstType);
});

const sameTypeName = computed(() => {
  if (!isAllSameType.value || props.selectedComponents.length === 0) return '';
  const first = props.selectedComponents[0];
  return first.name.replace(/\s*\d+$/, '') || first.type;
});

const distinctTypeCount = computed(() => {
  const set = new Set(props.selectedComponents.map(c => c.type));
  return set.size;
});

const batchPrimaryComponent = computed(() => props.selectedComponents[0] || props.component);

const batchUniformWidth = computed(() => {
  if (props.selectedComponents.length === 0) return '';
  const firstW = Math.round(props.selectedComponents[0].width);
  return props.selectedComponents.every(c => Math.round(c.width) === firstW) ? firstW : '';
});

const batchUniformHeight = computed(() => {
  if (props.selectedComponents.length === 0) return '';
  const firstH = Math.round(props.selectedComponents[0].height);
  return props.selectedComponents.every(c => Math.round(c.height) === firstH) ? firstH : '';
});

const batchUniformRotation = computed(() => {
  if (props.selectedComponents.length === 0) return '';
  const firstR = props.selectedComponents[0].rotation || 0;
  return props.selectedComponents.every(c => (c.rotation || 0) === firstR) ? firstR : '';
});

const batchUniformFill = computed(() => {
  if (props.selectedComponents.length === 0) return '';
  const firstF = props.selectedComponents[0].style?.fill || '';
  return props.selectedComponents.every(c => (c.style?.fill || '') === firstF) ? firstF : '';
});

const batchUniformStroke = computed(() => {
  if (props.selectedComponents.length === 0) return '';
  const firstS = props.selectedComponents[0].style?.stroke || '';
  return props.selectedComponents.every(c => (c.style?.stroke || '') === firstS) ? firstS : '';
});

const batchUniformStrokeWidth = computed(() => {
  if (props.selectedComponents.length === 0) return '';
  const firstSW = props.selectedComponents[0].style?.strokeWidth ?? 1;
  return props.selectedComponents.every(c => (c.style?.strokeWidth ?? 1) === firstSW) ? firstSW : '';
});

const batchUniformStrokeDasharray = computed(() => {
  if (props.selectedComponents.length === 0) return '';
  const firstSD = props.selectedComponents[0].style?.strokeDasharray || 'none';
  return props.selectedComponents.every(c => (c.style?.strokeDasharray || 'none') === firstSD) ? firstSD : '';
});

const batchUniformBorderRadius = computed(() => {
  if (props.selectedComponents.length === 0) return '';
  const firstBR = props.selectedComponents[0].style?.borderRadius ?? 0;
  return props.selectedComponents.every(c => (c.style?.borderRadius ?? 0) === firstBR) ? firstBR : '';
});

const batchUniformOpacity = computed(() => {
  if (props.selectedComponents.length === 0) return '';
  const firstOp = props.selectedComponents[0].style?.opacity ?? 1;
  return props.selectedComponents.every(c => (c.style?.opacity ?? 1) === firstOp) ? firstOp : '';
});

const batchUniformColor = computed(() => {
  if (props.selectedComponents.length === 0) return '';
  const firstCol = props.selectedComponents[0].style?.textColor || props.selectedComponents[0].style?.color || '';
  return props.selectedComponents.every(c => (c.style?.textColor || c.style?.color || '') === firstCol) ? firstCol : '';
});

const batchUniformFontSize = computed(() => {
  if (props.selectedComponents.length === 0) return '';
  const firstFS = props.selectedComponents[0].style?.fontSize || 14;
  return props.selectedComponents.every(c => (c.style?.fontSize || 14) === firstFS) ? firstFS : '';
});

// Batch Actions
const handleBatchSetWidth = (w: number) => {
  if (isNaN(w) || w <= 0) return;
  const updated = props.selectedComponents.map(c => ({
    ...c,
    width: Math.round(w)
  }));
  emit('update:components', updated);
};

const handleBatchSetHeight = (h: number) => {
  if (isNaN(h) || h <= 0) return;
  const updated = props.selectedComponents.map(c => ({
    ...c,
    height: Math.round(h)
  }));
  emit('update:components', updated);
};

const handleBatchSetRotation = (deg: number) => {
  if (isNaN(deg)) return;
  const normalized = ((Math.round(deg) % 360) + 360) % 360;
  const updated = props.selectedComponents.map(c => ({
    ...c,
    rotation: normalized
  }));
  emit('update:components', updated);
};

const handleBatchRotateDelta = (delta: number) => {
  const updated = props.selectedComponents.map(c => ({
    ...c,
    rotation: (((c.rotation || 0) + delta) % 360 + 360) % 360
  }));
  emit('update:components', updated);
};

const handleBatchMoveDelta = (dx: number, dy: number) => {
  const updated = props.selectedComponents.map(c => ({
    ...c,
    x: Math.max(0, c.x + dx),
    y: Math.max(0, c.y + dy)
  }));
  emit('update:components', updated);
};

const handleBatchEqualSize = (mode: 'width' | 'height' | 'both' | 'max' | 'min' | 'square') => {
  if (props.selectedComponents.length === 0) return;
  const first = props.selectedComponents[0];
  let updated: ScreenComponent[] = [];

  if (mode === 'width') {
    const baseW = first.width;
    updated = props.selectedComponents.map(c => ({ ...c, width: baseW }));
  } else if (mode === 'height') {
    const baseH = first.height;
    updated = props.selectedComponents.map(c => ({ ...c, height: baseH }));
  } else if (mode === 'both') {
    const baseW = first.width;
    const baseH = first.height;
    updated = props.selectedComponents.map(c => ({ ...c, width: baseW, height: baseH }));
  } else if (mode === 'max') {
    const maxW = Math.max(...props.selectedComponents.map(c => c.width));
    const maxH = Math.max(...props.selectedComponents.map(c => c.height));
    updated = props.selectedComponents.map(c => ({ ...c, width: maxW, height: maxH }));
  } else if (mode === 'min') {
    const minW = Math.min(...props.selectedComponents.map(c => c.width));
    const minH = Math.min(...props.selectedComponents.map(c => c.height));
    updated = props.selectedComponents.map(c => ({ ...c, width: minW, height: minH }));
  } else if (mode === 'square') {
    updated = props.selectedComponents.map(c => {
      const sz = Math.max(c.width, c.height);
      return { ...c, width: sz, height: sz };
    });
  }

  emit('update:components', updated);
};

const handleBatchUpdateStyle = (styleUpdates: Record<string, any>, customPropsUpdates?: Record<string, any>) => {
  const updated = props.selectedComponents.map(c => ({
    ...c,
    style: {
      ...c.style,
      ...styleUpdates
    },
    customProps: {
      ...(c.customProps || {}),
      ...(customPropsUpdates || {})
    }
  }));
  emit('update:components', updated);
};

const handleBatchApplyTheme = (themeKey: 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'dark' | 'glass') => {
  const presets: Record<string, { fill: string; stroke: string; strokeWidth: number; textColor?: string; color?: string }> = {
    cyan: { fill: 'rgba(0, 242, 255, 0.12)', stroke: '#00f2ff', strokeWidth: 2, textColor: '#00f2ff', color: '#00f2ff' },
    green: { fill: 'rgba(16, 185, 129, 0.12)', stroke: '#10b981', strokeWidth: 2, textColor: '#10b981', color: '#10b981' },
    amber: { fill: 'rgba(245, 158, 11, 0.12)', stroke: '#f59e0b', strokeWidth: 2, textColor: '#f59e0b', color: '#f59e0b' },
    red: { fill: 'rgba(239, 68, 68, 0.15)', stroke: '#ef4444', strokeWidth: 2, textColor: '#ef4444', color: '#ef4444' },
    purple: { fill: 'rgba(168, 85, 247, 0.15)', stroke: '#a855f7', strokeWidth: 2, textColor: '#a855f7', color: '#a855f7' },
    dark: { fill: '#081224', stroke: '#1c3560', strokeWidth: 1.5, textColor: '#93c5fd', color: '#93c5fd' },
    glass: { fill: 'rgba(9, 21, 43, 0.65)', stroke: 'rgba(0, 242, 255, 0.4)', strokeWidth: 1, textColor: '#e0f2fe', color: '#e0f2fe' }
  };
  const theme = presets[themeKey];
  if (!theme) return;
  handleBatchUpdateStyle(theme);
};

const toggleBatchVisibility = () => {
  const anyHidden = props.selectedComponents.some(c => c.visible === false);
  const updated = props.selectedComponents.map(c => ({
    ...c,
    visible: anyHidden ? true : false
  }));
  emit('update:components', updated);
};
</script>

<template>
  <aside class="w-80 h-full bg-[#10213b] border-l border-cyan-500/40 flex flex-col select-none z-30 shadow-xl overflow-hidden font-mono">
    <!-- Header -->
    <div class="p-3 border-b border-cyan-500/30 bg-[#142c4e]">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 font-mono font-normal text-xs text-cyan-200">
          <SlidersHorizontal class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
          <span v-if="selectedComponents.length > 1">多选元件配置 ({{ selectedComponents.length }})</span>
          <span v-else-if="component">组件属性配置</span>
          <span v-else>属性配置面板</span>
        </div>

        <div class="flex items-center gap-1.5">
          <button
            v-if="selectedComponents.length > 0"
            @click="emit('save:symbol', selectedComponents.length > 0 ? selectedComponents : (component ? [component] : []))"
            class="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-400/60 text-emerald-200 hover:bg-emerald-900 text-[10px] font-mono font-light cursor-pointer transition-colors shadow-sm"
            title="将选中图元封装为多态自定义图元"
          >
            <BookmarkPlus class="w-3.5 h-3.5 text-emerald-300 stroke-[2]" />
            <span>存为图元</span>
          </button>
          
          <button
            @click="emit('close')"
            class="p-1 rounded bg-[#183761] hover:bg-rose-500/30 text-cyan-300 hover:text-rose-200 border border-cyan-500/40 hover:border-rose-400/60 cursor-pointer transition-colors"
            title="关闭属性面板"
          >
            <X class="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>
      </div>
    </div>

    <!-- ================= 1. MULTI-SELECTION BATCH INSPECTOR ================= -->
    <template v-if="selectedComponents.length > 1">
      <!-- Batch Tabs Selector -->
      <div class="flex items-center border-b border-cyan-500/30 bg-[#142c4e] px-1">
        <button
          @click="batchTab = 'geometry'"
          class="flex-1 py-2.5 text-xs font-normal flex items-center justify-center gap-1 transition-colors cursor-pointer border-b-2"
          :class="batchTab === 'geometry' ? 'border-cyan-400 text-cyan-200 bg-[#183761] font-normal' : 'border-transparent text-cyan-300/80 hover:text-cyan-100 font-light'"
        >
          <Scaling class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
          <span>几何等大</span>
        </button>
        <button
          @click="batchTab = 'style'"
          class="flex-1 py-2.5 text-xs font-normal flex items-center justify-center gap-1 transition-colors cursor-pointer border-b-2"
          :class="batchTab === 'style' ? 'border-cyan-400 text-cyan-200 bg-[#183761] font-normal' : 'border-transparent text-cyan-300/80 hover:text-cyan-100 font-light'"
        >
          <Palette class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
          <span>批量样式</span>
        </button>
        <button
          @click="batchTab = 'align'"
          class="flex-1 py-2.5 text-xs font-normal flex items-center justify-center gap-1 transition-colors cursor-pointer border-b-2"
          :class="batchTab === 'align' ? 'border-cyan-400 text-cyan-200 bg-[#183761] font-normal' : 'border-transparent text-cyan-300/80 hover:text-cyan-100 font-light'"
        >
          <AlignCenter class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
          <span>对齐分布</span>
        </button>
        <button
          @click="batchTab = 'manage'"
          class="flex-1 py-2.5 text-xs font-normal flex items-center justify-center gap-1 transition-colors cursor-pointer border-b-2"
          :class="batchTab === 'manage' ? 'border-cyan-400 text-cyan-200 bg-[#183761] font-normal' : 'border-transparent text-cyan-300/80 hover:text-cyan-100 font-light'"
        >
          <Layers class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
          <span>管理图层</span>
        </button>
      </div>

      <!-- Batch Content Area -->
      <div class="flex-1 overflow-y-auto p-3 space-y-4 font-mono text-xs custom-scrollbar">
        
        <!-- Selection Summary Card -->
        <div class="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-400/40 space-y-1.5">
          <div class="flex items-center justify-between text-xs font-normal text-cyan-200">
            <span class="flex items-center gap-1.5">
              <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400 stroke-[2]" />
              <span>已选中 {{ selectedComponents.length }} 个元件</span>
            </span>
            <span
              v-if="isAllSameType"
              class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px]"
            >
              同种类: {{ sameTypeName }}
            </span>
            <span
              v-else
              class="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px]"
            >
              混合 {{ distinctTypeCount }} 种图元
            </span>
          </div>
          <div class="text-[10px] text-cyan-300/70 font-light flex items-center justify-between">
            <span class="truncate max-w-[200px]">基准: {{ batchPrimaryComponent?.name }}</span>
            <span class="text-cyan-400/90 font-mono">{{ Math.round(batchPrimaryComponent?.width || 0) }}×{{ Math.round(batchPrimaryComponent?.height || 0) }}px</span>
          </div>
        </div>

        <!-- 1. TAB: GEOMETRY & EQUAL SIZE (几何与等大小) -->
        <div v-if="batchTab === 'geometry'" class="space-y-3.5">
          
          <!-- Equal Sizing Quick Buttons -->
          <div class="p-2.5 rounded-xl bg-[#09152b] border border-cyan-500/30 space-y-2">
            <label class="text-[11px] text-cyan-200 font-normal flex items-center justify-between">
              <span class="flex items-center gap-1">
                <Scaling class="w-3.5 h-3.5 text-cyan-300" />
                <span>批量一键等大小</span>
              </span>
              <span class="text-[10px] text-cyan-400/70 font-light">以第1个为基准</span>
            </label>

            <div class="grid grid-cols-3 gap-1.5">
              <button
                @click="handleBatchEqualSize('width')"
                class="py-1.5 px-2 rounded-lg bg-[#050e1f] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                title="所有选中组件宽度与首个组件相同"
              >
                <MoveHorizontal class="w-3.5 h-3.5 text-cyan-400 stroke-[2]" />
                <span class="text-[10px]">统一等宽</span>
              </button>

              <button
                @click="handleBatchEqualSize('height')"
                class="py-1.5 px-2 rounded-lg bg-[#050e1f] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                title="所有选中组件高度与首个组件相同"
              >
                <MoveVertical class="w-3.5 h-3.5 text-cyan-400 stroke-[2]" />
                <span class="text-[10px]">统一等高</span>
              </button>

              <button
                @click="handleBatchEqualSize('both')"
                class="py-1.5 px-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-400/60 text-cyan-100 text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                title="所有选中组件宽高均与首个组件相同"
              >
                <Scaling class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
                <span class="text-[10px] font-normal">宽高全等</span>
              </button>

              <button
                @click="handleBatchEqualSize('max')"
                class="py-1.5 px-2 rounded-lg bg-[#050e1f] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                title="将所有组件调整为选集中的最大宽和最大高"
              >
                <Maximize class="w-3.5 h-3.5 text-cyan-400 stroke-[2]" />
                <span class="text-[10px]">取最大尺寸</span>
              </button>

              <button
                @click="handleBatchEqualSize('min')"
                class="py-1.5 px-2 rounded-lg bg-[#050e1f] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                title="将所有组件调整为选集中的最小宽和最小高"
              >
                <Minimize class="w-3.5 h-3.5 text-cyan-400 stroke-[2]" />
                <span class="text-[10px]">取最小尺寸</span>
              </button>

              <button
                @click="handleBatchEqualSize('square')"
                class="py-1.5 px-2 rounded-lg bg-[#050e1f] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                title="将每个选中的组件调整为正方形"
              >
                <Square class="w-3.5 h-3.5 text-cyan-400 stroke-[2]" />
                <span class="text-[10px]">转正方形</span>
              </button>
            </div>
          </div>

          <!-- Batch Width & Height Numeric Setting -->
          <div class="space-y-2">
            <label class="text-[11px] text-cyan-200 font-normal block">精确设置所有组件尺寸 (px)</label>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-cyan-300/80 block mb-1">统一宽度 (W)</label>
                <input
                  type="number"
                  min="4"
                  max="4000"
                  step="1"
                  :value="batchUniformWidth"
                  :placeholder="batchUniformWidth !== '' ? String(batchUniformWidth) : '不同宽度'"
                  @input="handleBatchSetWidth(Number(($event.target as HTMLInputElement).value))"
                  class="w-full bg-[#09152b] border border-cyan-500/40 focus:border-cyan-300 rounded-lg px-2.5 py-1.5 text-cyan-200 font-mono text-xs outline-hidden"
                />
              </div>

              <div>
                <label class="text-[10px] text-cyan-300/80 block mb-1">统一高度 (H)</label>
                <input
                  type="number"
                  min="4"
                  max="4000"
                  step="1"
                  :value="batchUniformHeight"
                  :placeholder="batchUniformHeight !== '' ? String(batchUniformHeight) : '不同高度'"
                  @input="handleBatchSetHeight(Number(($event.target as HTMLInputElement).value))"
                  class="w-full bg-[#09152b] border border-cyan-500/40 focus:border-cyan-300 rounded-lg px-2.5 py-1.5 text-cyan-200 font-mono text-xs outline-hidden"
                />
              </div>
            </div>
          </div>

          <!-- Batch Rotation Setting -->
          <div class="space-y-2 pt-1">
            <label class="text-[11px] text-cyan-200 font-normal flex items-center justify-between">
              <span class="flex items-center gap-1">
                <RotateCw class="w-3.5 h-3.5 text-cyan-300" />
                <span>批量旋转角度</span>
              </span>
              <span class="text-[10px] text-cyan-400 font-mono">{{ batchUniformRotation !== '' ? `${batchUniformRotation}°` : '多角度' }}</span>
            </label>

            <div class="grid grid-cols-4 gap-1.5">
              <button
                @click="handleBatchSetRotation(0)"
                class="py-1 px-1.5 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-[10px] cursor-pointer text-center"
              >
                0° 正置
              </button>
              <button
                @click="handleBatchSetRotation(90)"
                class="py-1 px-1.5 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-[10px] cursor-pointer text-center"
              >
                90° 顺时
              </button>
              <button
                @click="handleBatchSetRotation(180)"
                class="py-1 px-1.5 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-[10px] cursor-pointer text-center"
              >
                180° 倒置
              </button>
              <button
                @click="handleBatchSetRotation(270)"
                class="py-1 px-1.5 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-[10px] cursor-pointer text-center"
              >
                270° 逆时
              </button>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1">
              <button
                @click="handleBatchRotateDelta(-90)"
                class="py-1 px-2 rounded bg-[#050e1f] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <RotateCw class="w-3 h-3 -scale-x-100" />
                <span>逆时针 90°</span>
              </button>
              <button
                @click="handleBatchRotateDelta(90)"
                class="py-1 px-2 rounded bg-[#050e1f] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <RotateCw class="w-3 h-3" />
                <span>顺时针 90°</span>
              </button>
            </div>
          </div>

          <!-- Batch Position Fine-Tuning Offset -->
          <div class="space-y-2 pt-1 border-t border-cyan-500/20">
            <label class="text-[11px] text-cyan-200 font-normal block">批量位置微调 (步进移动)</label>
            <div class="grid grid-cols-4 gap-1.5">
              <button
                @click="handleBatchMoveDelta(-10, 0)"
                class="py-1.5 px-2 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-200 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                ← 左移10
              </button>
              <button
                @click="handleBatchMoveDelta(10, 0)"
                class="py-1.5 px-2 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-200 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                右移10 →
              </button>
              <button
                @click="handleBatchMoveDelta(0, -10)"
                class="py-1.5 px-2 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-200 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                ↑ 上移10
              </button>
              <button
                @click="handleBatchMoveDelta(0, 10)"
                class="py-1.5 px-2 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-200 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                下移10 ↓
              </button>
            </div>
          </div>

        </div>

        <!-- 2. TAB: STYLE & PALETTE (批量样式与颜色) -->
        <div v-if="batchTab === 'style'" class="space-y-3.5">
          
          <!-- Quick SCADA Industrial Color Themes -->
          <div class="p-2.5 rounded-xl bg-[#09152b] border border-cyan-500/30 space-y-2">
            <label class="text-[11px] text-cyan-200 font-normal flex items-center justify-between">
              <span class="flex items-center gap-1">
                <Paintbrush class="w-3.5 h-3.5 text-cyan-300" />
                <span>一键工业 SCADA 主题色系</span>
              </span>
              <span class="text-[10px] text-cyan-400/70 font-light">全选作用</span>
            </label>

            <div class="grid grid-cols-4 gap-1.5">
              <button
                @click="handleBatchApplyTheme('cyan')"
                class="py-1 px-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-400 text-cyan-300 text-[10px] cursor-pointer flex items-center justify-center gap-1"
              >
                <div class="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f2ff]"></div>
                <span>赛博青</span>
              </button>

              <button
                @click="handleBatchApplyTheme('green')"
                class="py-1 px-1.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-400 text-emerald-300 text-[10px] cursor-pointer flex items-center justify-center gap-1"
              >
                <div class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]"></div>
                <span>安全绿</span>
              </button>

              <button
                @click="handleBatchApplyTheme('amber')"
                class="py-1 px-1.5 rounded bg-amber-950 hover:bg-amber-900 border border-amber-400 text-amber-300 text-[10px] cursor-pointer flex items-center justify-center gap-1"
              >
                <div class="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]"></div>
                <span>告警黄</span>
              </button>

              <button
                @click="handleBatchApplyTheme('red')"
                class="py-1 px-1.5 rounded bg-red-950 hover:bg-red-900 border border-red-400 text-red-300 text-[10px] cursor-pointer flex items-center justify-center gap-1"
              >
                <div class="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_#ef4444]"></div>
                <span>事故红</span>
              </button>

              <button
                @click="handleBatchApplyTheme('purple')"
                class="py-1 px-1.5 rounded bg-purple-950 hover:bg-purple-900 border border-purple-400 text-purple-300 text-[10px] cursor-pointer flex items-center justify-center gap-1"
              >
                <div class="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_6px_#a855f7]"></div>
                <span>电压紫</span>
              </button>

              <button
                @click="handleBatchApplyTheme('glass')"
                class="py-1 px-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-cyan-500/50 text-cyan-200 text-[10px] cursor-pointer flex items-center justify-center gap-1"
              >
                <div class="w-2 h-2 rounded-full bg-cyan-200"></div>
                <span>玻璃蓝</span>
              </button>

              <button
                @click="handleBatchApplyTheme('dark')"
                class="py-1 px-1.5 rounded bg-[#050c1a] hover:bg-[#08152e] border border-cyan-800 text-slate-300 text-[10px] cursor-pointer flex items-center justify-center gap-1"
              >
                <div class="w-2 h-2 rounded-full bg-slate-600"></div>
                <span>深灰底</span>
              </button>

              <button
                @click="handleBatchUpdateStyle({ fill: 'transparent' })"
                class="py-1 px-1.5 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-[10px] cursor-pointer flex items-center justify-center gap-1"
              >
                <span>无填充</span>
              </button>
            </div>
          </div>

          <!-- Batch Fill Color & Opacity -->
          <div class="space-y-2">
            <label class="text-[11px] text-cyan-200 font-normal block">批量填充颜色与不透明度</label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                :value="batchUniformFill && batchUniformFill.startsWith('#') ? batchUniformFill : '#00f2ff'"
                @input="handleBatchUpdateStyle({ fill: ($event.target as HTMLInputElement).value })"
                class="w-8 h-8 rounded border border-cyan-500/40 bg-transparent cursor-pointer"
              />
              <input
                type="text"
                :value="batchUniformFill"
                :placeholder="batchUniformFill || '多个不同填充色'"
                @change="handleBatchUpdateStyle({ fill: ($event.target as HTMLInputElement).value })"
                class="flex-1 bg-[#09152b] border border-cyan-500/40 focus:border-cyan-300 rounded-lg px-2.5 py-1.5 text-cyan-200 text-xs outline-hidden"
              />
              <button
                @click="handleBatchUpdateStyle({ fill: 'transparent' })"
                class="px-2 py-1.5 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-[10px] cursor-pointer whitespace-nowrap"
              >
                透明
              </button>
            </div>

            <!-- Quick Swatches for Fill -->
            <div class="flex items-center gap-1 pt-1">
              <button
                v-for="color in themeColors"
                :key="`fill-${color}`"
                @click="handleBatchUpdateStyle({ fill: color })"
                class="flex-1 h-5 rounded border border-cyan-500/30 hover:scale-110 transition-transform cursor-pointer"
                :style="{ backgroundColor: color }"
                :title="color"
              />
            </div>
          </div>

          <!-- Batch Stroke (Color, Width, Dash) -->
          <div class="space-y-2 pt-1 border-t border-cyan-500/20">
            <label class="text-[11px] text-cyan-200 font-normal block">批量边框描边 (Stroke)</label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                :value="batchUniformStroke && batchUniformStroke.startsWith('#') ? batchUniformStroke : '#00f2ff'"
                @input="handleBatchUpdateStyle({ stroke: ($event.target as HTMLInputElement).value })"
                class="w-8 h-8 rounded border border-cyan-500/40 bg-transparent cursor-pointer"
              />
              <input
                type="text"
                :value="batchUniformStroke"
                :placeholder="batchUniformStroke || '多个不同描边色'"
                @change="handleBatchUpdateStyle({ stroke: ($event.target as HTMLInputElement).value })"
                class="flex-1 bg-[#09152b] border border-cyan-500/40 focus:border-cyan-300 rounded-lg px-2.5 py-1.5 text-cyan-200 text-xs outline-hidden"
              />
            </div>

            <!-- Quick Swatches for Stroke -->
            <div class="flex items-center gap-1 pt-1">
              <button
                v-for="color in themeColors"
                :key="`stroke-${color}`"
                @click="handleBatchUpdateStyle({ stroke: color })"
                class="flex-1 h-5 rounded border border-cyan-500/30 hover:scale-110 transition-transform cursor-pointer"
                :style="{ backgroundColor: color }"
                :title="color"
              />
            </div>

            <!-- Stroke Width Buttons -->
            <div class="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label class="text-[10px] text-cyan-300/80 block mb-1">描边线宽 (px)</label>
                <div class="grid grid-cols-4 gap-1">
                  <button
                    v-for="sw in [0, 1, 2, 4]"
                    :key="sw"
                    @click="handleBatchUpdateStyle({ strokeWidth: sw })"
                    class="py-1 px-1 rounded text-[10px] border cursor-pointer text-center"
                    :class="batchUniformStrokeWidth === sw ? 'bg-cyan-500 text-slate-950 font-normal border-cyan-400' : 'bg-[#09152b] text-cyan-300 border-cyan-500/40 hover:border-cyan-300'"
                  >
                    {{ sw }}px
                  </button>
                </div>
              </div>

              <div>
                <label class="text-[10px] text-cyan-300/80 block mb-1">虚线样式 (Dash)</label>
                <select
                  :value="batchUniformStrokeDasharray || 'none'"
                  @change="handleBatchUpdateStyle({ strokeDasharray: ($event.target as HTMLSelectElement).value })"
                  class="w-full bg-[#09152b] border border-cyan-500/40 focus:border-cyan-300 rounded-lg px-2 py-1 text-cyan-200 text-xs outline-hidden cursor-pointer"
                >
                  <option value="none">实线 (Solid)</option>
                  <option value="4,4">细虚线 (4,4)</option>
                  <option value="8,4">标准虚线 (8,4)</option>
                  <option value="2,2">密集点线 (2,2)</option>
                  <option value="12,6">长划线 (12,6)</option>
                </select>
              </div>
            </div>

            <!-- Border Radius -->
            <div class="pt-1">
              <label class="text-[10px] text-cyan-300/80 block mb-1">圆角半径 (Border Radius)</label>
              <div class="grid grid-cols-5 gap-1">
                <button
                  v-for="br in [0, 4, 8, 16, 999]"
                  :key="br"
                  @click="handleBatchUpdateStyle({ borderRadius: br })"
                  class="py-1 px-1 rounded text-[10px] border cursor-pointer text-center"
                  :class="batchUniformBorderRadius === br ? 'bg-cyan-500 text-slate-950 font-normal border-cyan-400' : 'bg-[#09152b] text-cyan-300 border-cyan-500/40 hover:border-cyan-300'"
                >
                  {{ br === 999 ? '全圆' : `${br}px` }}
                </button>
              </div>
            </div>
          </div>

          <!-- Batch Text Styling -->
          <div class="space-y-2 pt-1 border-t border-cyan-500/20">
            <label class="text-[11px] text-cyan-200 font-normal block">批量文字属性 (Text & Font)</label>
            
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-cyan-300/80 block mb-1">字号 (Font Size)</label>
                <select
                  :value="batchUniformFontSize || 14"
                  @change="handleBatchUpdateStyle({ fontSize: Number(($event.target as HTMLSelectElement).value) })"
                  class="w-full bg-[#09152b] border border-cyan-500/40 focus:border-cyan-300 rounded-lg px-2 py-1 text-cyan-200 text-xs outline-hidden cursor-pointer"
                >
                  <option :value="10">10px 极小</option>
                  <option :value="12">12px 标注</option>
                  <option :value="14">14px 标准</option>
                  <option :value="16">16px 标题</option>
                  <option :value="18">18px 放大</option>
                  <option :value="24">24px 数显</option>
                  <option :value="32">32px 特大</option>
                </select>
              </div>

              <div>
                <label class="text-[10px] text-cyan-300/80 block mb-1">字重 (Weight)</label>
                <div class="grid grid-cols-2 gap-1">
                  <button
                    @click="handleBatchUpdateStyle({ fontWeight: 'normal' })"
                    class="py-1 px-1 rounded text-[10px] bg-[#09152b] border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-center cursor-pointer"
                  >
                    常规
                  </button>
                  <button
                    @click="handleBatchUpdateStyle({ fontWeight: 'bold' })"
                    class="py-1 px-1 rounded text-[10px] bg-[#09152b] border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-center cursor-pointer font-bold"
                  >
                    加粗
                  </button>
                </div>
              </div>
            </div>

            <!-- Text Color -->
            <div class="flex items-center gap-2 pt-1">
              <span class="text-[10px] text-cyan-300/80 whitespace-nowrap">文字颜色:</span>
              <input
                type="color"
                :value="batchUniformColor && batchUniformColor.startsWith('#') ? batchUniformColor : '#ffffff'"
                @input="handleBatchUpdateStyle({ textColor: ($event.target as HTMLInputElement).value, color: ($event.target as HTMLInputElement).value })"
                class="w-6 h-6 rounded border border-cyan-500/40 bg-transparent cursor-pointer"
              />
              <input
                type="text"
                :value="batchUniformColor"
                :placeholder="batchUniformColor || '保持各自文字色'"
                @change="handleBatchUpdateStyle({ textColor: ($event.target as HTMLInputElement).value, color: ($event.target as HTMLInputElement).value })"
                class="flex-1 bg-[#09152b] border border-cyan-500/40 focus:border-cyan-300 rounded-lg px-2 py-1 text-cyan-200 text-xs outline-hidden"
              />
            </div>
          </div>

        </div>

        <!-- 3. TAB: ALIGNMENT & DISTRIBUTION (对齐与等间距分布) -->
        <div v-if="batchTab === 'align'" class="space-y-3.5">
          <label class="text-[11px] text-cyan-200 font-normal block">多选对齐与等间距分布</label>
          <div class="grid grid-cols-4 gap-1.5">
            <button @click="emit('align:component', 'left')" class="p-2 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white flex flex-col items-center justify-center gap-1 cursor-pointer font-light transition-colors" title="左对齐">
              <AlignLeft class="w-4 h-4 text-cyan-300 stroke-[2]" />
              <span class="text-[10px]">左对齐</span>
            </button>
            <button @click="emit('align:component', 'center')" class="p-2 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white flex flex-col items-center justify-center gap-1 cursor-pointer font-light transition-colors" title="水平居中">
              <AlignCenter class="w-4 h-4 text-cyan-300 stroke-[2]" />
              <span class="text-[10px]">水平居中</span>
            </button>
            <button @click="emit('align:component', 'right')" class="p-2 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white flex flex-col items-center justify-center gap-1 cursor-pointer font-light transition-colors" title="右对齐">
              <AlignRight class="w-4 h-4 text-cyan-300 stroke-[2]" />
              <span class="text-[10px]">右对齐</span>
            </button>
            <button @click="emit('align:component', 'distribute-h')" class="p-2 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white flex flex-col items-center justify-center gap-1 cursor-pointer font-light transition-colors" title="水平等间距分布">
              <AlignHorizontalSpaceAround class="w-4 h-4 text-cyan-300 stroke-[2]" />
              <span class="text-[10px]">水平均布</span>
            </button>

            <button @click="emit('align:component', 'top')" class="p-2 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white flex flex-col items-center justify-center gap-1 cursor-pointer font-light transition-colors" title="顶对齐">
              <AlignVerticalSpaceAround class="w-4 h-4 rotate-90 text-cyan-300 stroke-[2]" />
              <span class="text-[10px]">顶对齐</span>
            </button>
            <button @click="emit('align:component', 'middle')" class="p-2 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white flex flex-col items-center justify-center gap-1 cursor-pointer font-light transition-colors" title="垂直居中">
              <AlignHorizontalSpaceAround class="w-4 h-4 text-cyan-300 stroke-[2]" />
              <span class="text-[10px]">垂直居中</span>
            </button>
            <button @click="emit('align:component', 'bottom')" class="p-2 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white flex flex-col items-center justify-center gap-1 cursor-pointer font-light transition-colors" title="底对齐">
              <AlignVerticalSpaceAround class="w-4 h-4 -rotate-90 text-cyan-300 stroke-[2]" />
              <span class="text-[10px]">底对齐</span>
            </button>
            <button @click="emit('align:component', 'distribute-v')" class="p-2 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white flex flex-col items-center justify-center gap-1 cursor-pointer font-light transition-colors" title="垂直等间距分布">
              <AlignVerticalSpaceAround class="w-4 h-4 text-cyan-300 stroke-[2]" />
              <span class="text-[10px]">垂直均布</span>
            </button>
          </div>

          <!-- Quick Equal Size in Align Tab as Well -->
          <div class="p-3 rounded-xl bg-[#09152b] border border-cyan-500/30 space-y-2 mt-2">
            <div class="text-[11px] text-cyan-200 font-normal">快速等大小与统一</div>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                @click="handleBatchEqualSize('width')"
                class="py-1.5 px-2 rounded bg-[#050e1f] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-200 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <MoveHorizontal class="w-3 h-3 text-cyan-400" />
                <span>等宽</span>
              </button>
              <button
                @click="handleBatchEqualSize('height')"
                class="py-1.5 px-2 rounded bg-[#050e1f] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-200 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <MoveVertical class="w-3 h-3 text-cyan-400" />
                <span>等高</span>
              </button>
              <button
                @click="handleBatchEqualSize('both')"
                class="py-1.5 px-2 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-400 text-cyan-100 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Scaling class="w-3 h-3 text-cyan-300" />
                <span>宽高全等</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 4. TAB: LAYERS & GROUP MANAGEMENT (管理与图层) -->
        <div v-if="batchTab === 'manage'" class="space-y-3">
          <label class="text-[11px] text-cyan-200 font-normal block">批量图层与组件管理</label>
          
          <div class="space-y-2">
            <button
              @click="emit('group', selectedComponents)"
              class="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-normal flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,242,255,0.25)] transition-all"
            >
              <Layers class="w-4 h-4 stroke-[2]" />
              <span>📦 组合为群组 (Ctrl+G)</span>
            </button>

            <button
              @click="emit('save:symbol', selectedComponents)"
              class="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-normal flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.25)] transition-all"
            >
              <BookmarkPlus class="w-4 h-4 stroke-[2]" />
              <span>⭐ 存为自定义图元 (支持多态)</span>
            </button>

            <div class="grid grid-cols-2 gap-2 pt-1">
              <button
                @click="toggleBatchLock"
                class="py-2 px-2.5 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-200 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer font-light transition-colors text-xs"
              >
                <Lock class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
                <span>批量锁定/解锁</span>
              </button>

              <button
                @click="toggleBatchVisibility"
                class="py-2 px-2.5 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-200 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer font-light transition-colors text-xs"
              >
                <Eye class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
                <span>批量显隐切换</span>
              </button>
            </div>

            <button
              @click="emit('delete', selectedComponents.map(c => c.id))"
              class="w-full py-2 px-3 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-400/60 text-red-200 font-normal flex items-center justify-center gap-2 cursor-pointer transition-colors mt-2"
            >
              <Trash2 class="w-3.5 h-3.5 text-red-300 stroke-[2]" />
              <span>批量删除选中元件 (Del)</span>
            </button>
          </div>
        </div>

      </div>
    </template>

    <!-- ================= 2. SINGLE COMPONENT INSPECTOR VIEW ================= -->
    <template v-else-if="component">
      <!-- Tabs Selector -->
      <div class="flex items-center border-b border-cyan-500/30 bg-[#142c4e] px-1">
        <button
          @click="activeTab = 'geometry'"
          class="flex-1 py-2.5 text-xs font-normal flex items-center justify-center gap-1 transition-colors cursor-pointer border-b-2"
          :class="activeTab === 'geometry' ? 'border-cyan-400 text-cyan-200 bg-[#183761] font-normal' : 'border-transparent text-cyan-300/80 hover:text-cyan-100 font-light'"
        >
          <Move class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
          <span>几何</span>
        </button>
        <button
          @click="activeTab = 'style'"
          class="flex-1 py-2.5 text-xs font-normal flex items-center justify-center gap-1 transition-colors cursor-pointer border-b-2"
          :class="activeTab === 'style' ? 'border-cyan-400 text-cyan-200 bg-[#183761] font-normal' : 'border-transparent text-cyan-300/80 hover:text-cyan-100 font-light'"
        >
          <Palette class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
          <span>样式</span>
        </button>
        <button
          @click="activeTab = 'data'"
          class="flex-1 py-2.5 text-xs font-normal flex items-center justify-center gap-1 transition-colors cursor-pointer border-b-2"
          :class="activeTab === 'data' ? 'border-cyan-400 text-cyan-200 bg-[#183761] font-normal' : 'border-transparent text-cyan-300/80 hover:text-cyan-100 font-light'"
        >
          <Database class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
          <span>数据</span>
        </button>
        <button
          @click="activeTab = 'interaction'"
          class="flex-1 py-2.5 text-xs font-normal flex items-center justify-center gap-1 transition-colors cursor-pointer border-b-2"
          :class="activeTab === 'interaction' ? 'border-cyan-400 text-cyan-200 bg-[#183761] font-normal' : 'border-transparent text-cyan-300/80 hover:text-cyan-100 font-light'"
        >
          <Navigation class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
          <span>交互跳转</span>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar text-xs font-mono font-light">
        
        <!-- TAB 1: GEOMETRY & ALIGNMENT -->
        <div v-if="activeTab === 'geometry'" class="space-y-4">
          <!-- Component Name -->
          <div>
            <label class="text-xs font-normal text-cyan-200 block mb-1">组件标识名称</label>
            <input
              :value="component.name"
              @input="updateComponentProps({ name: ($event.target as HTMLInputElement).value })"
              class="w-full bg-[#09152b] border border-cyan-500/50 focus:border-cyan-300 rounded-lg px-2.5 py-1.5 text-cyan-100 font-light text-xs outline-hidden"
            />
          </div>

          <!-- Position (X, Y) -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs font-normal text-cyan-200 block mb-1">X 坐标 (px)</label>
              <input
                type="number"
                :value="Math.round(component.x)"
                @input="updateComponentProps({ x: Number(($event.target as HTMLInputElement).value) })"
                class="w-full bg-[#09152b] border border-cyan-500/50 focus:border-cyan-300 rounded-lg px-2.5 py-1.5 text-cyan-100 font-light text-xs outline-hidden"
              />
            </div>
            <div>
              <label class="text-xs font-normal text-cyan-200 block mb-1">Y 坐标 (px)</label>
              <input
                type="number"
                :value="Math.round(component.y)"
                @input="updateComponentProps({ y: Number(($event.target as HTMLInputElement).value) })"
                class="w-full bg-[#09152b] border border-cyan-500/50 focus:border-cyan-300 rounded-lg px-2.5 py-1.5 text-cyan-100 font-light text-xs outline-hidden"
              />
            </div>
          </div>

          <!-- Size (Width, Height) -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs font-normal text-cyan-200 block mb-1">宽度 (px)</label>
              <input
                type="number"
                min="6"
                :value="Math.round(component.width)"
                @input="updateComponentProps({ width: Number(($event.target as HTMLInputElement).value) })"
                class="w-full bg-[#09152b] border border-cyan-500/50 focus:border-cyan-300 rounded-lg px-2.5 py-1.5 text-cyan-100 font-light text-xs outline-hidden"
              />
            </div>
            <div>
              <label class="text-xs font-normal text-cyan-200 block mb-1">高度 (px)</label>
              <input
                type="number"
                min="4"
                :value="Math.round(component.height)"
                @input="updateComponentProps({ height: Number(($event.target as HTMLInputElement).value) })"
                class="w-full bg-[#09152b] border border-cyan-500/50 focus:border-cyan-300 rounded-lg px-2.5 py-1.5 text-cyan-100 font-light text-xs outline-hidden"
              />
            </div>
          </div>

          <!-- Rotation & Z-Index -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs font-normal text-cyan-200 block mb-1">旋转角度 (°)</label>
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="360"
                  :value="component.rotation || 0"
                  @input="updateComponentProps({ rotation: Number(($event.target as HTMLInputElement).value) })"
                  class="w-full bg-[#09152b] border border-cyan-500/50 focus:border-cyan-300 rounded-lg px-2.5 py-1.5 text-cyan-100 font-light text-xs outline-hidden"
                />
                <button
                  @click="updateComponentProps({ rotation: ((component.rotation || 0) + 90) % 360 })"
                  class="p-1.5 rounded bg-[#09152b] hover:bg-cyan-950 text-cyan-300 border border-cyan-500/50 hover:border-cyan-300 cursor-pointer transition-colors"
                  title="顺时针旋转90°"
                >
                  <RotateCw class="w-4 h-4 text-cyan-300 stroke-[2]" />
                </button>
              </div>
            </div>
            <div>
              <label class="text-xs font-normal text-cyan-200 block mb-1">图层层级 (zIndex)</label>
              <input
                type="number"
                min="0"
                max="1000"
                :value="component.zIndex || 1"
                @input="updateComponentProps({ zIndex: Number(($event.target as HTMLInputElement).value) })"
                class="w-full bg-[#09152b] border border-cyan-500/50 focus:border-cyan-300 rounded-lg px-2.5 py-1.5 text-cyan-100 font-light text-xs outline-hidden"
              />
            </div>
          </div>

          <!-- Quick Alignment Tools -->
          <div>
            <label class="text-xs font-normal text-cyan-200 block mb-1.5">快速对齐工具</label>
            <div class="grid grid-cols-6 gap-1 bg-[#071024] p-1.5 rounded-lg border border-cyan-500/40">
              <button @click="emit('align:component', 'left')" class="p-1.5 rounded hover:bg-cyan-950 text-cyan-200 hover:text-white flex justify-center cursor-pointer transition-colors" title="左对齐"><AlignLeft class="w-4 h-4 text-cyan-300 stroke-[2]" /></button>
              <button @click="emit('align:component', 'center')" class="p-1.5 rounded hover:bg-cyan-950 text-cyan-200 hover:text-white flex justify-center cursor-pointer transition-colors" title="水平居中"><AlignCenter class="w-4 h-4 text-cyan-300 stroke-[2]" /></button>
              <button @click="emit('align:component', 'right')" class="p-1.5 rounded hover:bg-cyan-950 text-cyan-200 hover:text-white flex justify-center cursor-pointer transition-colors" title="右对齐"><AlignRight class="w-4 h-4 text-cyan-300 stroke-[2]" /></button>
              <button @click="emit('align:component', 'top')" class="p-1.5 rounded hover:bg-cyan-950 text-cyan-200 hover:text-white flex justify-center cursor-pointer transition-colors" title="顶对齐"><AlignVerticalSpaceAround class="w-4 h-4 rotate-90 text-cyan-300 stroke-[2]" /></button>
              <button @click="emit('align:component', 'middle')" class="p-1.5 rounded hover:bg-cyan-950 text-cyan-200 hover:text-white flex justify-center cursor-pointer transition-colors" title="垂直居中"><AlignHorizontalSpaceAround class="w-4 h-4 text-cyan-300 stroke-[2]" /></button>
              <button @click="emit('align:component', 'bottom')" class="p-1.5 rounded hover:bg-cyan-950 text-cyan-200 hover:text-white flex justify-center cursor-pointer transition-colors" title="底对齐"><AlignVerticalSpaceAround class="w-4 h-4 -rotate-90 text-cyan-300 stroke-[2]" /></button>
            </div>
          </div>

          <!-- Component Actions (Lock / Delete) -->
          <div class="pt-2 border-t border-cyan-500/30 space-y-2">
            <label class="text-xs font-normal text-cyan-200 block mb-1">元件控制与删除</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                @click="updateComponentProps({ locked: !component.locked })"
                class="py-1.5 px-2 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 font-light flex items-center justify-center gap-1.5 cursor-pointer text-xs transition-colors"
              >
                <Lock class="w-3.5 h-3.5 stroke-[2]" :class="component.locked ? 'text-amber-300' : 'text-cyan-300'" />
                <span>{{ component.locked ? '解除锁定' : '锁定元件' }}</span>
              </button>

              <button
                @click="emit('delete', [component.id])"
                class="py-1.5 px-2 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-400/60 text-red-200 font-normal flex items-center justify-center gap-1.5 cursor-pointer text-xs transition-colors"
              >
                <Trash2 class="w-3.5 h-3.5 text-red-300 stroke-[2]" />
                <span>删除此组件</span>
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 2: STYLE & PALETTE -->
        <div v-if="activeTab === 'style'" class="space-y-4">
          <!-- 0. SPECIAL: Float Metric & Numeric Display Controls (极简等宽遥测数值专用配置 - 置顶展示) -->
          <div v-if="component.type === 'metric-float' || component.type === 'metric-flipper'" class="p-3 rounded-xl bg-[#050e1f] border border-cyan-500/40 space-y-3 shadow-sm">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
              <div class="flex items-center gap-1.5">
                <Hash class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">极简等宽遥测数值参数配置</span>
              </div>
              <span class="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-light">
                零边距等宽数码
              </span>
            </div>

            <!-- Decimals & Fixed Font Size -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">
                  小数位数 (直接截断不进位)
                </label>
                <select
                  :value="component.style.decimals ?? component.customProps?.decimals ?? 2"
                  @change="updateComponentStyleAndCustomProps({ decimals: Number(($event.target as HTMLSelectElement).value) }, { decimals: Number(($event.target as HTMLSelectElement).value) })"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
                >
                  <option :value="0">0 位 (纯整数截断如: 0.98 -> 0)</option>
                  <option :value="1">截断 1 位 (如: 0.98 -> 0.9)</option>
                  <option :value="2">截断 2 位 (如: 0.98 -> 0.98)</option>
                  <option :value="3">截断 3 位 (如: 0.9814 -> 0.981)</option>
                  <option :value="4">截断 4 位 (如: 0.98142 -> 0.9814)</option>
                  <option :value="5">截断 5 位 (最多 5 位)</option>
                  <option :value="6">截断 6 位 (最多 6 位)</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">
                  固定数字字号 ({{ component.style.fontSize || 22 }}px)
                </label>
                <div class="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="10"
                    max="120"
                    step="1"
                    :value="component.style.fontSize || 22"
                    @input="updateComponentStyleAndCustomProps({ fontSize: Number(($event.target as HTMLInputElement).value) })"
                    class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1.5 text-cyan-300 font-mono font-light text-xs outline-hidden"
                  />
                </div>
              </div>
            </div>

            <!-- Trailing Zeros Option -->
            <div class="p-2 rounded-lg bg-[#050c1c] border border-cyan-500/20 flex items-center justify-between">
              <div>
                <div class="text-xs font-light text-cyan-200">自动去除末尾无效 0</div>
                <div class="text-[11px] text-cyan-400/70 font-light">如 120.50 显示为 120.5，120.00 显示为 120</div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="component.style.trimZeros ?? component.customProps?.trimZeros ?? true"
                  @change="updateComponentStyleAndCustomProps({ trimZeros: ($event.target as HTMLInputElement).checked }, { trimZeros: ($event.target as HTMLInputElement).checked })"
                  class="sr-only peer"
                />
                <div class="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            <!-- Text Align & Font Weight -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">对齐方式</label>
                <div class="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    @click="updateComponentStyleAndCustomProps({ textAlign: 'left' })"
                    class="py-1 px-1.5 rounded text-[11px] font-light border text-center cursor-pointer transition-all"
                    :class="(component.style.textAlign || 'center') === 'left' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400 shadow-xs' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                  >
                    居左
                  </button>
                  <button
                    type="button"
                    @click="updateComponentStyleAndCustomProps({ textAlign: 'center' })"
                    class="py-1 px-1.5 rounded text-[11px] font-light border text-center cursor-pointer transition-all"
                    :class="(component.style.textAlign || 'center') === 'center' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400 shadow-xs' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                  >
                    居中
                  </button>
                  <button
                    type="button"
                    @click="updateComponentStyleAndCustomProps({ textAlign: 'right' })"
                    class="py-1 px-1.5 rounded text-[11px] font-light border text-center cursor-pointer transition-all"
                    :class="(component.style.textAlign || 'center') === 'right' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400 shadow-xs' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                  >
                    居右
                  </button>
                </div>
              </div>
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">字重 (Weight)</label>
                <select
                  :value="component.style.fontWeight || 'bold'"
                  @change="updateComponentStyleAndCustomProps({ fontWeight: ($event.target as HTMLSelectElement).value as any })"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1.5 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
                >
                  <option value="normal">常规 (400)</option>
                  <option value="600">半粗 (600)</option>
                  <option value="bold">粗体 (700)</option>
                  <option value="900">极粗 (900)</option>
                </select>
              </div>
            </div>

            <!-- Colors: Text Color & Background Color with Prominent Large Swatches -->
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-cyan-500/20">
              <!-- Text Color -->
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">数值文字颜色</label>
                <div class="flex items-center gap-2">
                  <label 
                    class="relative flex items-center justify-center w-8 h-8 rounded-md border border-cyan-500/40 hover:border-cyan-400 bg-[#050c1c] cursor-pointer overflow-hidden shrink-0 shadow-md transition-colors"
                    title="点击选取文字颜色"
                  >
                    <div 
                      class="w-full h-full"
                      :style="{ backgroundColor: component.style.textColor || component.customProps?.textColor || '#00f2ff' }"
                    />
                    <input
                      type="color"
                      :value="component.style.textColor || component.customProps?.textColor || '#00f2ff'"
                      @input="updateComponentStyleAndCustomProps({ textColor: ($event.target as HTMLInputElement).value }, { textColor: ($event.target as HTMLInputElement).value })"
                      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <input
                    type="text"
                    :value="component.style.textColor || component.customProps?.textColor || '#00f2ff'"
                    @input="updateComponentStyleAndCustomProps({ textColor: ($event.target as HTMLInputElement).value }, { textColor: ($event.target as HTMLInputElement).value })"
                    class="flex-1 min-w-0 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1.5 text-cyan-200 font-mono font-light text-xs outline-hidden"
                  />
                </div>
              </div>

              <!-- Component Background Color -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-light text-cyan-200">组件背景底色</label>
                  <button
                    type="button"
                    @click="updateComponentStyleAndCustomProps({ fill: 'transparent' }, { bgColor: 'transparent' })"
                    class="px-1.5 py-0.5 bg-[#050c1c] hover:bg-cyan-950 text-[10px] text-cyan-300 rounded border border-cyan-500/30 cursor-pointer transition-colors"
                    :class="component.style.fill === 'transparent' || (!component.style.fill && (!component.customProps?.bgColor || component.customProps?.bgColor === 'transparent')) ? 'border-cyan-400 text-cyan-300 font-medium bg-cyan-950/60' : ''"
                  >
                    透明
                  </button>
                </div>
                <div class="flex items-center gap-2">
                  <label 
                    class="relative flex items-center justify-center w-8 h-8 rounded-md border border-cyan-500/40 hover:border-cyan-400 bg-[#050c1c] cursor-pointer overflow-hidden shrink-0 shadow-md transition-colors"
                    title="点击选取背景底色"
                  >
                    <div 
                      v-if="component.style.fill && component.style.fill !== 'transparent'"
                      class="w-full h-full"
                      :style="{ backgroundColor: component.style.fill }"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-cyan-400/60 font-mono bg-[#050c1c]">
                      透明
                    </div>
                    <input
                      type="color"
                      :value="component.style.fill && component.style.fill !== 'transparent' ? component.style.fill : '#050c1c'"
                      @input="updateComponentStyleAndCustomProps({ fill: ($event.target as HTMLInputElement).value }, { bgColor: ($event.target as HTMLInputElement).value })"
                      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <input
                    type="text"
                    :value="component.style.fill || 'transparent'"
                    @input="updateComponentStyleAndCustomProps({ fill: ($event.target as HTMLInputElement).value }, { bgColor: ($event.target as HTMLInputElement).value })"
                    class="flex-1 min-w-0 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1.5 text-cyan-200 font-mono font-light text-xs outline-hidden"
                  />
                </div>
              </div>
            </div>

            <!-- Border Stroke & Width (No roundness) -->
            <div class="space-y-1.5 pt-2 border-t border-cyan-500/20">
              <div class="flex items-center justify-between">
                <label class="text-xs font-light text-cyan-200">边框描边与粗细</label>
                <button
                  type="button"
                  @click="updateComponentStyleAndCustomProps({ stroke: 'transparent', strokeWidth: 0 }, { borderColor: 'transparent', borderWidth: 0 })"
                  class="px-2 py-0.5 bg-[#050c1c] hover:bg-cyan-950 text-[10px] text-cyan-300 rounded border border-cyan-500/30 cursor-pointer transition-colors"
                  :class="(!component.style.stroke || component.style.stroke === 'transparent' || component.style.strokeWidth === 0) ? 'border-cyan-400 text-cyan-300 font-medium bg-cyan-950/60' : ''"
                >
                  无边框
                </button>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <!-- Stroke Color Swatch & Input -->
                <div class="flex items-center gap-2">
                  <label 
                    class="relative flex items-center justify-center w-8 h-8 rounded-md border border-cyan-500/40 hover:border-cyan-400 bg-[#050c1c] cursor-pointer overflow-hidden shrink-0 shadow-md transition-colors"
                    title="点击选取边框颜色"
                  >
                    <div 
                      v-if="component.style.stroke && component.style.stroke !== 'transparent' && (component.style.strokeWidth ?? 1) > 0"
                      class="w-full h-full"
                      :style="{ backgroundColor: component.style.stroke }"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-cyan-400/60 font-mono bg-[#050c1c]">
                      无
                    </div>
                    <input
                      type="color"
                      :value="component.style.stroke && component.style.stroke !== 'transparent' ? component.style.stroke : '#00f2ff'"
                      @input="updateComponentStyleAndCustomProps({ stroke: ($event.target as HTMLInputElement).value, strokeWidth: component.style.strokeWidth || 1 }, { borderColor: ($event.target as HTMLInputElement).value, borderWidth: component.style.strokeWidth || 1 })"
                      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <input
                    type="text"
                    :value="component.style.stroke && component.style.stroke !== 'transparent' ? component.style.stroke : 'transparent'"
                    @input="updateComponentStyleAndCustomProps({ stroke: ($event.target as HTMLInputElement).value, strokeWidth: component.style.strokeWidth || 1 }, { borderColor: ($event.target as HTMLInputElement).value, borderWidth: component.style.strokeWidth || 1 })"
                    class="flex-1 min-w-0 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1.5 text-cyan-200 font-mono font-light text-xs outline-hidden"
                  />
                </div>

                <!-- Stroke Width Selector -->
                <div>
                  <select
                    :value="component.style.strokeWidth ?? (component.style.stroke && component.style.stroke !== 'transparent' ? 1 : 0)"
                    @change="updateComponentStyleAndCustomProps({ strokeWidth: Number(($event.target as HTMLSelectElement).value), stroke: component.style.stroke && component.style.stroke !== 'transparent' ? component.style.stroke : '#00f2ff' }, { borderWidth: Number(($event.target as HTMLSelectElement).value) })"
                    class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
                  >
                    <option :value="0">0px (无边框)</option>
                    <option :value="1">1px 细边框</option>
                    <option :value="2">2px 标准边框</option>
                    <option :value="3">3px 加粗边框</option>
                    <option :value="4">4px 粗边框</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Control Button Exclusive Appearance (控制按钮专属形态与风格) -->
          <div v-if="component.type === 'ctrl-button'" class="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40 space-y-3">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
              <span class="flex items-center gap-1.5">
                <Sliders class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">控制按钮专属形态与主题</span>
              </span>
              <span class="text-[10px] text-cyan-400/70 font-mono font-light">高保真工业控制机构</span>
            </div>

            <!-- Button Variant Selection -->
            <div>
              <label class="text-xs font-light text-cyan-200 block mb-1">按键控制机构形态</label>
              <select
                :value="component.style.buttonVariant || 'solid'"
                @change="updateComponentStyle({ buttonVariant: ($event.target as HTMLSelectElement).value })"
                class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-200 outline-hidden cursor-pointer font-light text-xs"
              >
                <option value="flip-cover">🔒 翻盖防误触安全按钮 (Flip-Cover Safety)</option>
                <option value="key-lock">🔑 五防钥匙闭锁旋转开关 (Key Interlock Switch)</option>
                <option value="rotary-3pos">🎛️ 三档工况选择旋钮 (3-Position Knob)</option>
                <option value="rocker-switch">⚡ 双向机械互锁翘板 (Dual Seesaw Rocker)</option>
                <option value="charge-hold">⏳ 长按充能防误动按钮 (Charge-to-Fire Hold)</option>
                <option value="latch-estop">🛑 旋转复位自锁急停钮 (Twist-Reset E-Stop)</option>
                <option value="slide-confirm">🛡️ 滑动解锁确认执行滑块 (Slide-to-Confirm)</option>
                <option value="two-hand">🖐️ 双人双键同押确认器 (Two-Hand Permissive)</option>
                <option value="solid">◽ 工业微晶标准按键 (Standard Button)</option>
                <option value="outline">✨ 科技微晶线框按键 (Cyber Outline)</option>
              </select>
            </div>

            <!-- Button Color Theme Preset -->
            <div>
              <label class="text-xs font-light text-cyan-200 block mb-1">快速色彩主题 (可被文字/背景颜色覆盖)</label>
              <div class="grid grid-cols-6 gap-1">
                <button
                  v-for="th in [
                    { id: 'cyan', label: '青', color: '#00f2ff' },
                    { id: 'emerald', label: '绿', color: '#10b981' },
                    { id: 'amber', label: '黄', color: '#f59e0b' },
                    { id: 'rose', label: '红', color: '#f43f5e' },
                    { id: 'indigo', label: '蓝', color: '#6366f1' },
                    { id: 'slate', label: '灰', color: '#94a3b8' }
                  ]"
                  :key="th.id"
                  type="button"
                  @click="updateComponentStyle({ buttonColorTheme: th.id })"
                  class="py-1 rounded text-[10px] font-mono border transition-all text-center cursor-pointer flex flex-col items-center gap-0.5"
                  :class="(component.style.buttonColorTheme || 'cyan') === th.id
                    ? 'border-cyan-400 bg-cyan-950/80 text-white font-bold'
                    : 'border-cyan-500/20 bg-[#050c1c] text-slate-300 hover:border-cyan-400'"
                >
                  <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: th.color }"></span>
                  <span>{{ th.label }}</span>
                </button>
              </div>
            </div>

            <!-- Explicit Button Text Color & Background Color Pickers -->
            <div class="grid grid-cols-2 gap-2 pt-1 border-t border-cyan-500/20">
              <div>
                <label class="text-[11px] font-light text-cyan-200 block mb-1">文字颜色</label>
                <div class="flex items-center gap-1.5">
                  <input
                    type="color"
                    :value="component.style.textColor || component.style.color || '#00f2ff'"
                    @input="updateComponentStyle({ textColor: ($event.target as HTMLInputElement).value, color: ($event.target as HTMLInputElement).value })"
                    class="w-6 h-6 rounded bg-transparent border-0 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    :value="component.style.textColor || component.style.color || ''"
                    @input="updateComponentStyle({ textColor: ($event.target as HTMLInputElement).value, color: ($event.target as HTMLInputElement).value })"
                    placeholder="默认主题"
                    class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded px-1.5 py-1 text-cyan-100 font-mono text-[11px] outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label class="text-[11px] font-light text-cyan-200 block mb-1">按键背景底色</label>
                <div class="flex items-center gap-1.5">
                  <input
                    type="color"
                    :value="component.style.fill || component.style.backgroundColor || '#07101e'"
                    @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value, backgroundColor: ($event.target as HTMLInputElement).value })"
                    class="w-6 h-6 rounded bg-transparent border-0 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    :value="component.style.fill || component.style.backgroundColor || ''"
                    @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value, backgroundColor: ($event.target as HTMLInputElement).value })"
                    placeholder="默认主题"
                    class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded px-1.5 py-1 text-cyan-100 font-mono text-[11px] outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Typography & Text Styling (适用于所有通用文本、按钮、标签组件) -->
          <div v-if="!['metric-float', 'metric-flipper'].includes(component.type)" class="p-3 rounded-xl bg-[#050c1c] border border-cyan-500/30 space-y-3">
            <div class="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
              <Type class="w-4 h-4 text-cyan-400" />
              <span class="font-normal text-cyan-200">文本与排版样式 (Typography)</span>
            </div>

            <!-- Text Content -->
            <div v-if="component.type === 'draw-text' || component.type === 'ctrl-button' || component.type === 'metric-header' || component.type === 'metric-clock' || component.type === 'metric-time-banner' || component.type === 'metric-clock-analog' || component.type === 'metric-countdown'">
              <label class="text-xs font-light text-cyan-200 block mb-1">展示标题 / 文本内容</label>
              <input
                type="text"
                :value="component.customProps?.title || (component.type === 'ctrl-button' ? (component.style.buttonText || component.name) : (component.style.text || component.name))"
                @input="handleTextTitleChange(($event.target as HTMLInputElement).value)"
                class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-100 outline-hidden text-xs font-light"
              />
            </div>

            <!-- Font Size & Font Weight -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">字号: {{ component.style.fontSize || 14 }}px</label>
                <input
                  type="range"
                  min="10"
                  max="96"
                  step="1"
                  :value="component.style.fontSize || 14"
                  @input="updateComponentStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })"
                  class="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">字重 (Weight)</label>
                <select
                  :value="component.style.fontWeight || 'normal'"
                  @change="updateComponentStyle({ fontWeight: ($event.target as HTMLSelectElement).value as any })"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
                >
                  <option value="300">细体 (Light 300)</option>
                  <option value="normal">常规 (Regular 400)</option>
                  <option value="600">半粗 (SemiBold 600)</option>
                  <option value="bold">粗体 (Bold 700)</option>
                  <option value="900">极粗 (Black 900)</option>
                </select>
              </div>
            </div>

            <!-- Font Family & Text Align -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">字体系列</label>
                <select
                  :value="component.style.fontFamily || 'monospace'"
                  @change="updateComponentStyle({ fontFamily: ($event.target as HTMLSelectElement).value })"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
                >
                  <option value="Chakra Petch, monospace">Chakra Petch (工业科技)</option>
                  <option value="JetBrains Mono, monospace">JetBrains Mono (等宽)</option>
                  <option value="Noto Sans SC, sans-serif">Noto Sans (标准黑体)</option>
                  <option value="system-ui, sans-serif">系统无衬线 (System UI)</option>
                </select>
              </div>

              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">对齐方式</label>
                <select
                  :value="component.style.textAlign || 'left'"
                  @change="updateComponentStyle({ textAlign: ($event.target as HTMLSelectElement).value as any })"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
                >
                  <option value="left">居左对齐</option>
                  <option value="center">居中对齐</option>
                  <option value="right">居右对齐</option>
                </select>
              </div>
            </div>

            <!-- Text Color -->
            <div>
              <label class="text-xs font-light text-cyan-200 block mb-1">文字颜色</label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  :value="component.style.textColor || component.style.stroke || '#00f2ff'"
                  @input="updateComponentStyle({ textColor: ($event.target as HTMLInputElement).value })"
                  class="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
                />
                <input
                  type="text"
                  :value="component.style.textColor || component.style.stroke || '#00f2ff'"
                  @input="updateComponentStyle({ textColor: ($event.target as HTMLInputElement).value })"
                  class="flex-1 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-cyan-100 font-light text-xs outline-hidden"
                />
              </div>
            </div>
          </div>

          <!-- 3. Line & Stroke Styling (线条与描边) -->
          <div v-if="!['metric-float', 'metric-flipper'].includes(component.type)" class="p-3 rounded-xl bg-[#050c1c] border border-cyan-500/30 space-y-3">
            <div class="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
              <Workflow class="w-4 h-4 text-cyan-400" />
              <span class="font-normal text-cyan-200">线条与描边属性 (Line & Stroke)</span>
            </div>

            <!-- Line Width Slider & Input -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-light text-cyan-200">线宽粗细</label>
                <span class="text-xs font-mono font-light text-cyan-400">{{ component.style.strokeWidth ?? (component.type.startsWith('draw-line') ? 3 : 2) }}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="32"
                step="1"
                :value="component.style.strokeWidth ?? (component.type.startsWith('draw-line') ? 3 : 2)"
                @input="updateComponentStyle({ strokeWidth: Number(($event.target as HTMLInputElement).value) })"
                class="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <!-- Stroke Color -->
            <div>
              <label class="text-xs font-light text-cyan-200 block mb-1">描边 / 线条颜色</label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  :value="component.style.stroke || '#00f2ff'"
                  @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value, voltageLevel: undefined })"
                  class="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
                />
                <input
                  type="text"
                  :value="component.style.stroke || '#00f2ff'"
                  @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value, voltageLevel: undefined })"
                  class="flex-1 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-cyan-100 font-light text-xs outline-hidden"
                />
              </div>
            </div>

            <!-- Line Style (Solid, Dashed, Dotted) -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">线条虚实样式</label>
                <select
                  :value="component.style.lineStyle || 'solid'"
                  @change="updateComponentStyle({ lineStyle: ($event.target as HTMLSelectElement).value as any })"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
                >
                  <option value="solid">实线 (Solid)</option>
                  <option value="dashed">虚线 (Dashed)</option>
                  <option value="dotted">点线 (Dotted)</option>
                </select>
              </div>

              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">走线转角模式</label>
                <select
                  :value="component.style.lineType || 'direct'"
                  @change="updateComponentStyle({ lineType: ($event.target as HTMLSelectElement).value as any })"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
                >
                  <option value="direct">直线 (Direct)</option>
                  <option value="orthogonal-h">水平直角折线</option>
                  <option value="orthogonal-v">垂直直角折线</option>
                </select>
              </div>
            </div>

            <!-- Arrow Endings for Lines -->
            <div v-if="['draw-line', 'draw-polyline', 'draw-arrow'].includes(component.type)" class="grid grid-cols-2 gap-2">
              <label class="flex items-center gap-2 text-xs text-cyan-300 cursor-pointer font-light">
                <input
                  type="checkbox"
                  :checked="Boolean(component.style.startArrow)"
                  @change="updateComponentStyle({ startArrow: ($event.target as HTMLInputElement).checked })"
                  class="rounded accent-cyan-400"
                />
                <span>始端箭头</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-cyan-300 cursor-pointer font-light">
                <input
                  type="checkbox"
                  :checked="Boolean(component.style.endArrow ?? (component.type === 'draw-arrow'))"
                  @change="updateComponentStyle({ endArrow: ($event.target as HTMLInputElement).checked })"
                  class="rounded accent-cyan-400"
                />
                <span>末端箭头</span>
              </label>
            </div>
          </div>

          <!-- 4. Fill, Background & Roundness (填充与容器样式) -->
          <div v-if="!['metric-float', 'metric-flipper'].includes(component.type)" class="p-3 rounded-xl bg-[#050c1c] border border-cyan-500/30 space-y-3">
            <div class="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
              <Palette class="w-4 h-4 text-cyan-400" />
              <span class="font-normal text-cyan-200">填充、背景与圆角 (Fill & Container)</span>
            </div>

            <!-- Fill Color Input -->
            <div v-if="!['draw-line', 'draw-polyline', 'draw-arrow', 'elec-busbar'].includes(component.type)">
              <label class="text-xs font-light text-cyan-200 block mb-1">填充背景色</label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  :value="component.style.fill || '#00f2ff'"
                  @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value })"
                  class="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
                />
                <input
                  type="text"
                  :value="component.style.fill || 'transparent'"
                  @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value })"
                  class="flex-1 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-cyan-100 font-light text-xs outline-hidden"
                />
              </div>
            </div>

            <!-- Border Radius & Opacity -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">圆角: {{ component.style.borderRadius || 0 }}px</label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  :value="component.style.borderRadius || 0"
                  @input="updateComponentStyle({ borderRadius: Number(($event.target as HTMLInputElement).value) })"
                  class="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">透明度: {{ Math.round((component.style.opacity ?? 1) * 100) }}%</label>
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  :value="component.style.opacity ?? 1"
                  @input="updateComponentStyle({ opacity: Number(($event.target as HTMLInputElement).value) })"
                  class="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <!-- SPECIAL: Status Indicator Atomic Style Controls (保留状态颜色定制，移除冗余切换测试) -->
          <div v-if="component.type === 'ctrl-indicator' || component.category === 'status' || component.type.startsWith('elec-')" class="p-3 rounded-xl bg-[#050c1c] border border-cyan-500/40 space-y-3">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
              <span class="flex items-center gap-1.5">
                <CircleDot class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">双态状态颜色定制 (0态分闸 / 1态合闸)</span>
              </span>
              <span class="text-[10px] text-cyan-400/70 font-mono font-light">外观配置</span>
            </div>

            <!-- Custom 0/1 State Colors -->
            <div class="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label class="text-[11px] font-light text-emerald-400 block mb-1">🟢 0 态显示颜色 (分闸/常态)</label>
                <div class="flex items-center gap-1.5">
                  <input
                    type="color"
                    :value="component.customProps?.color0 || '#00e676'"
                    @input="updateComponentCustomProps({ color0: ($event.target as HTMLInputElement).value })"
                    class="w-7 h-7 rounded border border-cyan-500/40 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    :value="component.customProps?.color0 || '#00e676'"
                    @input="updateComponentCustomProps({ color0: ($event.target as HTMLInputElement).value })"
                    class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded px-2 py-1 text-cyan-200 text-xs font-mono font-light"
                  />
                </div>
              </div>
              <div>
                <label class="text-[11px] font-light text-red-400 block mb-1">🔴 1 态显示颜色 (合闸/动作)</label>
                <div class="flex items-center gap-1.5">
                  <input
                    type="color"
                    :value="component.customProps?.color1 || '#ff2233'"
                    @input="updateComponentCustomProps({ color1: ($event.target as HTMLInputElement).value })"
                    class="w-7 h-7 rounded border border-cyan-500/40 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    :value="component.customProps?.color1 || '#ff2233'"
                    @input="updateComponentCustomProps({ color1: ($event.target as HTMLInputElement).value })"
                    class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded px-2 py-1 text-cyan-200 text-xs font-mono font-light"
                  />
                </div>
              </div>
            </div>

            <!-- Custom 0/1 State Text Labels -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[11px] font-light text-cyan-200 block mb-1">0 态文本标签</label>
                <input
                  type="text"
                  :value="component.customProps?.text0 || '分闸 0'"
                  @input="updateComponentCustomProps({ text0: ($event.target as HTMLInputElement).value })"
                  placeholder="如: 分闸 0, OFF"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded px-2 py-1 text-cyan-200 text-xs font-light"
                />
              </div>
              <div>
                <label class="text-[11px] font-light text-cyan-200 block mb-1">1 态文本标签</label>
                <input
                  type="text"
                  :value="component.customProps?.text1 || '合闸 1'"
                  @input="updateComponentCustomProps({ text1: ($event.target as HTMLInputElement).value })"
                  placeholder="如: 合闸 1, ON"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded px-2 py-1 text-cyan-200 text-xs font-light"
                />
              </div>
            </div>

            <!-- Indicator Style Preset -->
            <div>
              <label class="text-xs font-light text-cyan-200 block mb-1">指示灯图元形态</label>
              <div class="grid grid-cols-2 gap-1.5">
                <button
                  @click="updateComponentCustomProps({ indicatorStyle: 'bezel-circle' })"
                  class="py-1.5 px-2 rounded-lg text-xs font-light border text-left cursor-pointer transition-all flex items-center gap-1.5"
                  :class="(component.customProps?.indicatorStyle || 'bezel-circle') === 'bezel-circle' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  <span class="w-2.5 h-2.5 rounded-full border border-current"></span>
                  <span>金属高光圆灯</span>
                </button>
                <button
                  @click="updateComponentCustomProps({ indicatorStyle: 'flat-led' })"
                  class="py-1.5 px-2 rounded-lg text-xs font-light border text-left cursor-pointer transition-all flex items-center gap-1.5"
                  :class="component.customProps?.indicatorStyle === 'flat-led' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  <span class="w-2.5 h-2.5 rounded-full bg-current"></span>
                  <span>扁平发光LED</span>
                </button>
                <button
                  @click="updateComponentCustomProps({ indicatorStyle: 'square-lamp' })"
                  class="py-1.5 px-2 rounded-lg text-xs font-light border text-left cursor-pointer transition-all flex items-center gap-1.5"
                  :class="component.customProps?.indicatorStyle === 'square-lamp' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  <span class="w-2.5 h-2.5 rounded-xs bg-current"></span>
                  <span>方型工业信号灯</span>
                </button>
                <button
                  @click="updateComponentCustomProps({ indicatorStyle: 'pill-tag' })"
                  class="py-1.5 px-2 rounded-lg text-xs font-light border text-left cursor-pointer transition-all flex items-center gap-1.5"
                  :class="component.customProps?.indicatorStyle === 'pill-tag' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  <span class="w-4 h-2 rounded-full border border-current"></span>
                  <span>胶囊指示灯</span>
                </button>
                <button
                  @click="updateComponentCustomProps({ indicatorStyle: 'ring-pulse' })"
                  class="py-1.5 px-2 rounded-lg text-xs font-light border text-left cursor-pointer transition-all flex items-center gap-1.5"
                  :class="component.customProps?.indicatorStyle === 'ring-pulse' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  <span class="w-3 h-3 rounded-full border border-dashed border-current"></span>
                  <span>科技脉冲光环</span>
                </button>
                <button
                  @click="updateComponentCustomProps({ indicatorStyle: 'diamond-badge' })"
                  class="py-1.5 px-2 rounded-lg text-xs font-light border text-left cursor-pointer transition-all flex items-center gap-1.5"
                  :class="component.customProps?.indicatorStyle === 'diamond-badge' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  <span class="w-2.5 h-2.5 rotate-45 border border-current"></span>
                  <span>菱形联锁灯</span>
                </button>
                <button
                  @click="updateComponentCustomProps({ indicatorStyle: 'hexagon-pilot' })"
                  class="py-1.5 px-2 rounded-lg text-xs font-light border text-left cursor-pointer transition-all flex items-center gap-1.5"
                  :class="component.customProps?.indicatorStyle === 'hexagon-pilot' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  <span class="w-3 h-2.5 border border-current"></span>
                  <span>蜂巢六角灯</span>
                </button>
                <button
                  @click="updateComponentCustomProps({ indicatorStyle: 'crosshair-target' })"
                  class="py-1.5 px-2 rounded-lg text-xs font-light border text-left cursor-pointer transition-all flex items-center gap-1.5"
                  :class="component.customProps?.indicatorStyle === 'crosshair-target' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  <span class="text-xs font-mono font-medium">+</span>
                  <span>拓扑准星定位</span>
                </button>
                <button
                  @click="updateComponentCustomProps({ indicatorStyle: 'neon-dot' })"
                  class="py-1.5 px-2 rounded-lg text-xs font-light border text-left cursor-pointer transition-all flex items-center gap-1.5"
                  :class="component.customProps?.indicatorStyle === 'neon-dot' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  <span class="w-2 h-2 rounded-full bg-current shadow-[0_0_6px_currentColor]"></span>
                  <span>荧光高亮微点</span>
                </button>
                <button
                  @click="updateComponentCustomProps({ indicatorStyle: 'status-plate' })"
                  class="py-1.5 px-2 rounded-lg text-xs font-light border text-left cursor-pointer transition-all flex items-center gap-1.5"
                  :class="component.customProps?.indicatorStyle === 'status-plate' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  <span class="w-3 h-2 rounded-xs border border-current"></span>
                  <span>铭牌状态码</span>
                </button>
              </div>
            </div>

            <!-- Blink Animation -->
            <div>
              <label class="text-xs font-light text-cyan-200 block mb-1">闪烁动画速率</label>
              <select
                :value="component.customProps?.blink || 'none'"
                @change="updateComponentCustomProps({ blink: ($event.target as HTMLSelectElement).value })"
                class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1.5 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
              >
                <option value="none">常亮不闪烁</option>
                <option value="slow">慢闪 (1.0 Hz)</option>
                <option value="fast">急闪 (2.5 Hz)</option>
                <option value="auto">1或2状态时自动闪烁</option>
              </select>
            </div>
          </div>

          <!-- SPECIAL: Cyber Border & Frame Controls (科技边框配置) -->
          <div v-if="component.category === 'decoration' || component.type.startsWith('deco-')" class="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40 space-y-3">
            <div class="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
              <Frame class="w-4 h-4 text-cyan-400" />
              <span class="font-normal text-cyan-200">科技边框与容器外观 (Cyber Frame)</span>
            </div>

            <!-- Border Style Grid -->
            <div>
              <label class="text-xs font-light text-cyan-200 block mb-1.5">边框视觉样式 (11+ 工业科技风格)</label>
              <div class="grid grid-cols-2 gap-1.5">
                <button
                  v-for="bStyle in [
                    { id: 'deco-border-neon', name: '霓虹四角标框' },
                    { id: 'deco-border-tech', name: '科技切角装甲框' },
                    { id: 'deco-border-mech', name: '重装机甲铆钉框' },
                    { id: 'deco-border-hud-double', name: '双线流光HUD框' },
                    { id: 'deco-border-cyber-corner', name: '四角发光斜切框' },
                    { id: 'deco-border-gradient-pulse', name: '渐变律动发光框' },
                    { id: 'deco-border-hazard', name: '工业警示斜纹框' },
                    { id: 'deco-border-bracket', name: '极简对角卡尺框' },
                    { id: 'deco-border-matrix-panel', name: '点阵发光机箱板' },
                    { id: 'deco-border-quantum-box', name: '量子悬浮光条框' },
                    { id: 'deco-border-scada-card', name: 'SCADA标准工控框' }
                  ]"
                  :key="bStyle.id"
                  @click="updateComponentCustomProps({ borderStyle: bStyle.id }), updateComponentProps({ type: bStyle.id as any })"
                  class="py-1.5 px-2 rounded-lg text-xs font-light border text-left cursor-pointer transition-all truncate"
                  :class="(component.customProps?.borderStyle || component.type) === bStyle.id ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  {{ bStyle.name }}
                </button>
              </div>
            </div>

            <!-- Border Title -->
            <div>
              <label class="text-xs font-light text-cyan-200 block mb-1">边框抬头标题 (Title)</label>
              <input
                type="text"
                :value="component.customProps?.title || ''"
                @input="updateComponentCustomProps({ title: ($event.target as HTMLInputElement).value })"
                placeholder="如: #1主变压器监控单元"
                class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-100 text-xs outline-hidden font-light"
              />
            </div>

            <!-- Border Main & Fill Color -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">科技线条颜色</label>
                <div class="flex items-center gap-1.5">
                  <input
                    type="color"
                    :value="component.style.stroke || component.customProps?.color || '#00f2ff'"
                    @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value }), updateComponentCustomProps({ color: ($event.target as HTMLInputElement).value })"
                    class="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    :value="component.style.stroke || component.customProps?.color || '#00f2ff'"
                    @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value }), updateComponentCustomProps({ color: ($event.target as HTMLInputElement).value })"
                    class="flex-1 bg-[#050c1c] border border-cyan-500/30 rounded px-2 py-1 text-cyan-100 font-mono font-light text-xs outline-hidden"
                  />
                </div>
              </div>
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">容器背景底色</label>
                <div class="flex items-center gap-1.5">
                  <input
                    type="color"
                    :value="component.style.fill && component.style.fill !== 'transparent' ? component.style.fill : (component.customProps?.bgColor || '#040814')"
                    @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value }), updateComponentCustomProps({ bgColor: ($event.target as HTMLInputElement).value })"
                    class="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
                  />
                  <button
                    @click="updateComponentStyle({ fill: 'transparent' }), updateComponentCustomProps({ bgColor: 'transparent' })"
                    class="px-2 py-1 bg-[#050c1c] hover:bg-cyan-950 text-[10px] text-cyan-300 rounded border border-cyan-500/30 cursor-pointer"
                  >
                    透明
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- SPECIAL: ECharts Advanced Style & Threshold Lines Controls -->
          <div v-if="isChartComponent" class="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40 space-y-3">
            <div class="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
              <TrendingUp class="w-4 h-4 text-cyan-400" />
              <span class="font-normal text-cyan-200">图表视觉与告警标线配置</span>
            </div>

            <!-- Visual Toggles -->
            <div class="grid grid-cols-2 gap-2 text-xs font-light">
              <label class="flex items-center gap-1.5 cursor-pointer text-cyan-200 hover:text-white">
                <input
                  type="checkbox"
                  :checked="component.customProps?.smooth !== false"
                  @change="updateComponentCustomProps({ smooth: ($event.target as HTMLInputElement).checked })"
                  class="accent-cyan-400 rounded"
                />
                <span>平滑曲线 (Smooth)</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer text-cyan-200 hover:text-white">
                <input
                  type="checkbox"
                  :checked="component.customProps?.showArea || false"
                  @change="updateComponentCustomProps({ showArea: ($event.target as HTMLInputElement).checked })"
                  class="accent-cyan-400 rounded"
                />
                <span>渐变面积填充</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer text-cyan-200 hover:text-white">
                <input
                  type="checkbox"
                  :checked="component.customProps?.showDataLabels || false"
                  @change="updateComponentCustomProps({ showDataLabels: ($event.target as HTMLInputElement).checked })"
                  class="accent-cyan-400 rounded"
                />
                <span>显示数值标签</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer text-cyan-200 hover:text-white">
                <input
                  type="checkbox"
                  :checked="component.customProps?.showLegend !== false"
                  @change="updateComponentCustomProps({ showLegend: ($event.target as HTMLInputElement).checked })"
                  class="accent-cyan-400 rounded"
                />
                <span>显示图表图例</span>
              </label>
            </div>

            <!-- Threshold Alarm Lines (MarkLines) -->
            <div class="pt-2 border-t border-cyan-500/20 space-y-2">
              <div class="flex items-center justify-between text-xs font-light text-cyan-200">
                <span class="flex items-center gap-1 text-amber-300">
                  <AlertTriangle class="w-3.5 h-3.5" />
                  <span>上限/下限预警参考标线 (MarkLine)</span>
                </span>
              </div>

              <!-- Upper Threshold -->
              <div class="grid grid-cols-3 gap-1.5 items-center">
                <label class="flex items-center gap-1 cursor-pointer text-xs text-red-300 col-span-1 font-light">
                  <input
                    type="checkbox"
                    :checked="component.customProps?.enableUpperLimit || false"
                    @change="updateComponentCustomProps({ enableUpperLimit: ($event.target as HTMLInputElement).checked })"
                    class="accent-red-500 rounded"
                  />
                  <span>上限报警线</span>
                </label>
                <input
                  type="number"
                  placeholder="阈值(如:90)"
                  :value="component.customProps?.upperLimitValue ?? 90"
                  @input="updateComponentCustomProps({ upperLimitValue: Number(($event.target as HTMLInputElement).value) })"
                  class="bg-[#050c1c] border border-cyan-500/30 focus:border-red-400 rounded px-2 py-1 text-cyan-100 text-xs font-mono font-light outline-hidden col-span-1"
                />
                <input
                  type="text"
                  placeholder="标签(如:过载上限)"
                  :value="component.customProps?.upperLimitLabel || '上限预警'"
                  @input="updateComponentCustomProps({ upperLimitLabel: ($event.target as HTMLInputElement).value })"
                  class="bg-[#050c1c] border border-cyan-500/30 focus:border-red-400 rounded px-2 py-1 text-cyan-100 text-xs font-light outline-hidden col-span-1"
                />
              </div>

              <!-- Lower Threshold -->
              <div class="grid grid-cols-3 gap-1.5 items-center">
                <label class="flex items-center gap-1 cursor-pointer text-xs text-cyan-300 col-span-1 font-light">
                  <input
                    type="checkbox"
                    :checked="component.customProps?.enableLowerLimit || false"
                    @change="updateComponentCustomProps({ enableLowerLimit: ($event.target as HTMLInputElement).checked })"
                    class="accent-cyan-400 rounded"
                  />
                  <span>下限报警线</span>
                </label>
                <input
                  type="number"
                  placeholder="阈值(如:20)"
                  :value="component.customProps?.lowerLimitValue ?? 20"
                  @input="updateComponentCustomProps({ lowerLimitValue: Number(($event.target as HTMLInputElement).value) })"
                  class="bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded px-2 py-1 text-cyan-100 text-xs font-mono font-light outline-hidden col-span-1"
                />
                <input
                  type="text"
                  placeholder="标签(如:低压下限)"
                  :value="component.customProps?.lowerLimitLabel || '下限预警'"
                  @input="updateComponentCustomProps({ lowerLimitLabel: ($event.target as HTMLInputElement).value })"
                  class="bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded px-2 py-1 text-cyan-100 text-xs font-light outline-hidden col-span-1"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 3: DATA BINDING -->
        <div v-if="activeTab === 'data'" class="space-y-4">
          <!-- Consolidated State Simulation Test (数据菜单中唯一且集成的状态测试，支持自定义多状态图元与普通系统自带0/1状态图元) -->
          <div v-if="(component.states && component.states.length > 0) || isSystemStatusComponent" class="p-3 rounded-xl bg-cyan-950/40 border border-cyan-400/50 space-y-2.5">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
              <span class="flex items-center gap-1.5">
                <Workflow class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">
                  {{ component.states && component.states.length > 0 ? '自定义图元多状态测试' : '设备状态模拟测试 (0/1切换)' }}
                </span>
              </span>
              <span class="text-[10px] font-mono font-light text-cyan-300 px-1.5 py-0.5 rounded bg-[#050c1c] border border-cyan-500/30">
                当前: {{ component.states && component.states.length > 0 ? (component.activeState ?? '1') : currentResolvedBinaryState }}
              </span>
            </div>

            <!-- Case A: Custom Multi-State Symbols -->
            <div v-if="component.states && component.states.length > 0" class="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                v-for="st in component.states"
                :key="st.id"
                type="button"
                @click="testMultiState(st.id, st.matchValue)"
                class="py-1.5 px-2 rounded-lg text-xs font-mono cursor-pointer border transition-all truncate text-left flex items-center justify-between gap-1"
                :class="String(component.activeState ?? '1') === String(st.id)
                  ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.4)]'
                  : 'bg-[#050c1c] text-cyan-200 border-cyan-500/30 hover:border-cyan-400 font-light'"
              >
                <span class="truncate">{{ st.name }}</span>
                <span class="text-[9px] px-1 rounded font-mono" :class="String(component.activeState ?? '1') === String(st.id) ? 'bg-slate-950/30 text-slate-950' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'">
                  ={{ st.matchValue ?? st.id }}
                </span>
              </button>
            </div>

            <!-- Case B: Standard System Stateful Components (0 / 1 切换) -->
            <div v-else-if="isSystemStatusComponent" class="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                @click="testBinaryState(0)"
                class="py-2 px-2.5 rounded-lg text-xs font-light cursor-pointer border transition-all flex items-center justify-center gap-2"
                :class="currentResolvedBinaryState === 0
                  ? 'bg-slate-700 text-white font-medium border-slate-300 shadow-[0_0_12px_rgba(148,163,184,0.4)]'
                  : 'bg-[#050c1c] text-slate-300 border-cyan-500/30 hover:border-slate-400'"
              >
                <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: component.customProps?.color0 || '#00e676' }"></span>
                <span>0: 分闸 / 断开 / 常态</span>
              </button>

              <button
                type="button"
                @click="testBinaryState(1)"
                class="py-2 px-2.5 rounded-lg text-xs font-light cursor-pointer border transition-all flex items-center justify-center gap-2"
                :class="currentResolvedBinaryState === 1
                  ? 'bg-emerald-500 text-slate-950 font-medium border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'bg-[#050c1c] text-emerald-300 border-cyan-500/30 hover:border-emerald-400'"
              >
                <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: component.customProps?.color1 || '#ff2233' }"></span>
                <span>1: 合闸 / 导通 / 动作</span>
              </button>
            </div>
          </div>

          <!-- 1. 目标属性选择 (Target Property to Dynamically Bind) -->
          <div class="p-3 rounded-xl bg-[#050c1c] border border-cyan-500/40 space-y-2.5">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
              <span class="flex items-center gap-1.5">
                <Crosshair class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">绑定目标属性 (Target Property)</span>
              </span>
              <span class="text-[10px] text-cyan-400/70 font-mono font-light">点表点击后将绑定到此属性</span>
            </div>

            <!-- Quick property tags -->
            <div class="flex flex-wrap gap-1">
              <button
                v-for="propKey in ['value', 'state', 'unit', 'level', 'activeState', 'label', 'min', 'max']"
                :key="propKey"
                @click="targetBindProperty = propKey"
                class="px-2 py-1 rounded text-[11px] font-mono font-light cursor-pointer border transition-all"
                :class="targetBindProperty === propKey
                  ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400 shadow-xs'
                  : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400 hover:text-white'"
              >
                {{ propKey }}
              </button>
            </div>

            <div class="flex items-center gap-1.5 pt-1">
              <label class="text-[11px] text-cyan-300 shrink-0 font-light">指定属性键名:</label>
              <input
                type="text"
                v-model="targetBindProperty"
                placeholder="例如: value, level, state..."
                class="flex-1 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded px-2 py-1 text-cyan-200 font-mono font-light text-xs outline-hidden"
              />
            </div>
          </div>

          <!-- 2. 当前已生效的动态关联列表 (Active Dynamic Bindings) -->
          <div class="p-3 rounded-xl bg-[#050c1c] border border-cyan-500/40 space-y-2.5 shadow-sm">
            <div class="flex items-center justify-between border-b border-cyan-500/20 pb-2">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse"></div>
                <span class="font-normal text-xs text-cyan-200">
                  动态属性关联表 ({{ activeBindingsList.length }})
                </span>
              </div>
              <button
                v-if="activeBindingsList.length > 0"
                @click="handleUnbindPoint"
                class="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer font-light"
                title="清除所有动态绑定"
              >
                <Unlink class="w-3 h-3" />
                <span>全部解绑</span>
              </button>
            </div>

            <!-- Dynamic bindings cards -->
            <div v-if="activeBindingsList.length > 0" class="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-0.5">
              <div
                v-for="b in activeBindingsList"
                :key="b.propKey"
                class="p-2 rounded-lg bg-[#050c1c] border border-cyan-500/30 hover:border-cyan-400 flex items-center justify-between gap-2 transition-colors font-mono text-xs font-light"
              >
                <div class="min-w-0 flex-1 space-y-0.5">
                  <div class="flex items-center gap-1.5 truncate">
                    <span class="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono">
                      .{{ b.propKey }}
                    </span>
                    <span class="text-cyan-400 text-[10px]">➔</span>
                    <span class="text-cyan-100 truncate font-light">{{ b.pointName }}</span>
                  </div>
                  <div class="flex items-center gap-2 text-[10px] text-cyan-300/70">
                    <span>测点: {{ b.pointKey }}</span>
                    <span class="text-emerald-400 font-mono">
                      实时值: {{ b.liveVal }} {{ b.unit }}
                    </span>
                  </div>
                </div>

                <button
                  @click="handleUnbindProperty(b.propKey)"
                  class="p-1 rounded bg-[#050c1c] hover:bg-rose-950/80 text-cyan-400 hover:text-rose-300 border border-cyan-500/30 hover:border-rose-500/50 cursor-pointer shrink-0"
                  :title="`解绑属性 .${b.propKey}`"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div v-else class="p-2.5 rounded-lg bg-[#050c1c] border border-cyan-500/20 text-center text-cyan-300/70 text-xs font-light">
              暂未关联测点，点击下方点表行即可自动绑定至目标属性
            </div>
          </div>

          <!-- 3. SCADA 点表与四遥通道选择 (Point Selector) -->
          <div class="space-y-3 pt-1">
              <!-- Step 1: Substation & IED Device -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <span class="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono font-bold">1</span>
                    <span class="font-normal text-cyan-200">受控间隔与测控装置 (IED Device)</span>
                  </label>
                  <span class="text-[10px] text-emerald-400 font-mono flex items-center gap-1 font-light">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    通信在线
                  </span>
                </div>
                <select
                  v-model="selectedDeviceId"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-200 font-light text-xs outline-hidden cursor-pointer"
                >
                  <option v-for="dev in currentDatasetDevices" :key="dev.deviceId" :value="dev.deviceId">
                    [{{ dev.deviceId }}] {{ dev.deviceName }} ({{ dev.deviceType || '测控保护' }})
                  </option>
                </select>
              </div>

              <!-- Step 2: Telemetry Classification (四遥严格分流) -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <span class="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono font-bold">2</span>
                    <span class="font-normal text-cyan-200">四遥测点分类 (Tele-Category)</span>
                  </label>
                  <span class="text-[10px] text-cyan-400/70 font-mono font-light">
                    当前装置包含 {{ selectedDevice ? (selectedDevice.telemetries?.length || 0) + (selectedDevice.teleSignals?.length || 0) + (selectedDevice.energies?.length || 0) + (selectedDevice.teleControls?.length || 0) + (selectedDevice.teleRegulations?.length || 0) : 0 }} 个测点
                  </span>
                </div>

                <div class="grid grid-cols-5 gap-1 bg-[#050c1c] p-1 rounded-lg border border-cyan-500/30 text-[11px] font-light">
                  <button
                    @click="selectedTeleCategory = 'yc'"
                    class="py-1.5 rounded text-center cursor-pointer transition-all flex flex-col items-center justify-center"
                    :class="selectedTeleCategory === 'yc' ? 'bg-cyan-500 text-slate-950 font-medium shadow-xs' : 'text-cyan-300 hover:text-white'"
                  >
                    <span>遥测 YC</span>
                    <span class="text-[9px] font-mono opacity-80">模拟量 ({{ selectedDevice?.telemetries?.length || 0 }})</span>
                  </button>
                  <button
                    @click="selectedTeleCategory = 'yx'"
                    class="py-1.5 rounded text-center cursor-pointer transition-all flex flex-col items-center justify-center"
                    :class="selectedTeleCategory === 'yx' ? 'bg-emerald-500 text-slate-950 font-medium shadow-xs' : 'text-emerald-300 hover:text-white'"
                  >
                    <span>遥信 YX</span>
                    <span class="text-[9px] font-mono opacity-80">状态量 ({{ selectedDevice?.teleSignals?.length || 0 }})</span>
                  </button>
                  <button
                    @click="selectedTeleCategory = 'dd'"
                    class="py-1.5 rounded text-center cursor-pointer transition-all flex flex-col items-center justify-center"
                    :class="selectedTeleCategory === 'dd' ? 'bg-amber-500 text-slate-950 font-medium shadow-xs' : 'text-amber-300 hover:text-white'"
                  >
                    <span>电度 DD</span>
                    <span class="text-[9px] font-mono opacity-80">电能量 ({{ selectedDevice?.energies?.length || 0 }})</span>
                  </button>
                  <button
                    @click="selectedTeleCategory = 'yk'"
                    class="py-1.5 rounded text-center cursor-pointer transition-all flex flex-col items-center justify-center"
                    :class="selectedTeleCategory === 'yk' ? 'bg-purple-500 text-white font-medium shadow-xs' : 'text-purple-300 hover:text-white'"
                  >
                    <span>遥控 YK</span>
                    <span class="text-[9px] font-mono opacity-80">控制 ({{ selectedDevice?.teleControls?.length || 0 }})</span>
                  </button>
                  <button
                    @click="selectedTeleCategory = 'yt'"
                    class="py-1.5 rounded text-center cursor-pointer transition-all flex flex-col items-center justify-center"
                    :class="selectedTeleCategory === 'yt' ? 'bg-blue-500 text-white font-medium shadow-xs' : 'text-cyan-300 hover:text-white'"
                  >
                    <span>遥调 YT</span>
                    <span class="text-[9px] font-mono opacity-80">定值 ({{ selectedDevice?.teleRegulations?.length || 0 }})</span>
                  </button>
                </div>
              </div>

              <!-- Step 3: SCADA Point Table Mapping (标准工业点表) -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <span class="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono font-bold">3</span>
                    <span class="font-normal text-cyan-200">工业规约点表检索与关联 (Point Library)</span>
                  </label>
                  <span class="text-[10px] text-cyan-400 font-mono font-light">共 {{ filteredPoints.length }} 个测点</span>
                </div>

                <!-- Search Input -->
                <div class="relative">
                  <Search class="w-3.5 h-3.5 text-cyan-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    v-model="pointSearchQuery"
                    placeholder="按点号、中文点名、规约标识搜索..."
                    class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-cyan-100 outline-hidden font-light"
                  />
                </div>

                <!-- Scrollable Point List -->
                <div class="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-0.5">
                  <div
                    v-for="pt in filteredPoints"
                    :key="pt.pointId"
                    :id="`scada-point-row-${pt.pointId}`"
                    @click="handleBindPointToComponent(pt)"
                    class="p-2 rounded-lg bg-[#050c1c] border text-xs cursor-pointer transition-all flex items-center justify-between group font-light"
                    :class="[
                      currentBindingDetails.isBound &&
                      currentBindingDetails.deviceId === selectedDevice?.deviceId &&
                      currentBindingDetails.category === selectedTeleCategory &&
                      String(currentBindingDetails.pointId) === String(pt.pointId)
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_12px_rgba(0,242,255,0.25)] ring-1 ring-cyan-400'
                        : 'border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-950/30'
                    ]"
                  >
                    <div class="flex items-center gap-2 overflow-hidden">
                      <span class="font-mono text-cyan-400 text-[11px] shrink-0 font-light">#{{ pt.pointId }}</span>
                      <div class="truncate">
                        <div class="flex items-center gap-1.5">
                          <span class="font-light text-cyan-100 block truncate group-hover:text-cyan-300">{{ pt.name }}</span>
                          <span
                            v-if="currentBindingDetails.isBound && currentBindingDetails.deviceId === selectedDevice?.deviceId && currentBindingDetails.category === selectedTeleCategory && String(currentBindingDetails.pointId) === String(pt.pointId)"
                            class="px-1 py-0.2 rounded text-[9px] bg-cyan-500 text-slate-950 font-medium shrink-0"
                          >
                            已关联
                          </span>
                        </div>
                        <span class="text-[10px] text-cyan-400/70 block truncate font-mono">
                          {{ selectedDevice?.deviceId }}_{{ selectedTeleCategory.toUpperCase() }}_{{ pt.pointId }}
                        </span>
                      </div>
                    </div>

                    <!-- Right Side: Rigorous Value & Status Handling (YK/YT shows verification point) -->
                    <div class="text-right shrink-0 pl-2">
                      <!-- Case YC / DD -->
                      <span
                        v-if="selectedTeleCategory === 'yc' || selectedTeleCategory === 'dd'"
                        class="font-mono text-emerald-400 text-xs block font-light"
                      >
                        {{ pt.value }} <span class="text-[10px] text-cyan-300 font-normal">{{ pt.unit || '' }}</span>
                      </span>

                      <!-- Case YX -->
                      <span
                        v-else-if="selectedTeleCategory === 'yx'"
                        class="px-1.5 py-0.5 rounded text-[10px] font-mono inline-block font-light"
                        :class="pt.value === 1 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : (pt.value === 2 ? 'bg-amber-950 text-amber-300 border border-amber-500/40' : 'bg-[#050c1c] text-cyan-400 border border-cyan-500/30')"
                      >
                        {{ pt.value }} ({{ pt.statusText || (pt.value === 1 ? '合闸' : '分闸') }})
                      </span>

                      <!-- Case YK: Rigorous industrial presentation - No raw sampled value, displays verification YX state -->
                      <div v-else-if="selectedTeleCategory === 'yk'" class="space-y-0.5">
                        <span class="inline-block px-1.5 py-0.2 rounded text-[9px] font-mono font-light bg-purple-950/80 text-purple-300 border border-purple-500/40">
                          控制通道 (无采样值)
                        </span>
                        <span class="text-[10px] text-cyan-200 block font-mono font-light">
                          ➔ 校验 [YX_{{ pt.targetPointId || 1 }}]: <span class="text-emerald-400 font-medium">{{ getTargetYxStatusText(pt.targetPointId || 1) }}</span>
                        </span>
                      </div>

                      <!-- Case YT: Rigorous industrial presentation - No raw sampled value, displays verification YC value -->
                      <div v-else-if="selectedTeleCategory === 'yt'" class="space-y-0.5">
                        <span class="inline-block px-1.5 py-0.2 rounded text-[9px] font-mono font-light bg-blue-950/80 text-blue-300 border border-blue-500/40">
                          调节通道 (无采样值)
                        </span>
                        <span class="text-[10px] text-cyan-200 block font-mono font-light">
                          ➔ 校验 [YC_{{ pt.targetYcPointId || 1 }}]: <span class="text-cyan-300 font-medium">{{ getTargetYcValueText(pt.targetYcPointId || 1) }}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div v-if="filteredPoints.length === 0" class="p-4 text-center text-xs text-cyan-400/70 font-light">
                    未找到符合条件的规约测点
                  </div>
                </div>
              </div>

              <!-- Step 4: Closed-Loop Verification & Safety Interlock (针对遥控遥调的严密闭环校验) -->
              <div
                v-if="component.data.action?.type === 'tele-control' || component.data.action?.type === 'tele-regulation' || selectedTeleCategory === 'yk' || selectedTeleCategory === 'yt'"
                class="p-3 rounded-xl bg-purple-950/30 border border-purple-500/50 space-y-2.5"
              >
                <div class="flex items-center justify-between text-xs font-bold text-purple-300">
                  <span class="flex items-center gap-1.5">
                    <span class="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 text-[10px] flex items-center justify-center font-mono font-bold">4</span>
                    <ShieldCheck class="w-4 h-4 text-purple-400" />
                    <span class="font-normal text-purple-200">闭环校验点与状态源设定 (Closed-Loop Verification)</span>
                  </span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-400/40 font-mono">
                    {{ (component.data.action?.type === 'tele-control' || selectedTeleCategory === 'yk') ? '遥控 ➔ 校验遥信 (YX)' : '遥调 ➔ 校验遥测 (YC)' }}
                  </span>
                </div>

                <div class="text-[11px] text-cyan-200/90 leading-relaxed font-light">
                  严谨 SCADA 规约要求：下发指令后必须通过现场测点校验闭环生效。图元画面中显示的开合状态或实测数值将严格绑定于此校验点：
                </div>

                <!-- Select corresponding YX for YK -->
                <div v-if="component.data.action?.type === 'tele-control' || selectedTeleCategory === 'yk'">
                  <label class="text-[11px] font-light text-purple-300 block mb-1">
                    对应状态校验遥信点 (YX) - 驱动图元画面开合显示
                  </label>
                  <select
                    :value="component.data.action?.targetPointId ?? component.data.mapping?.targetYxPointId ?? selectedDevice?.teleSignals?.[0]?.pointId ?? ''"
                    @change="handleSetVerificationPoint(Number(($event.target as HTMLSelectElement).value))"
                    class="w-full bg-[#050c1c] border border-purple-500/40 focus:border-purple-300 rounded-lg px-2.5 py-1.5 text-purple-200 font-mono font-light text-xs outline-hidden cursor-pointer"
                  >
                    <option v-for="yx in selectedDevice?.teleSignals || []" :key="yx.pointId" :value="yx.pointId">
                      [YX_{{ yx.pointId }}] {{ yx.name }} (实时反馈: {{ yx.value }} - {{ yx.statusText || (yx.value === 1 ? '合闸' : '分闸') }})
                    </option>
                  </select>
                </div>

                <!-- Select corresponding YC for YT -->
                <div v-if="component.data.action?.type === 'tele-regulation' || selectedTeleCategory === 'yt'">
                  <label class="text-[11px] font-light text-cyan-300 block mb-1">
                    对应实测校验遥测点 (YC) - 驱动图元画面定值显示
                  </label>
                  <select
                    :value="component.data.action?.targetPointId ?? component.data.mapping?.targetYcPointId ?? selectedDevice?.telemetries?.[0]?.pointId ?? ''"
                    @change="handleSetVerificationPoint(Number(($event.target as HTMLSelectElement).value))"
                    class="w-full bg-[#050c1c] border border-cyan-500/40 focus:border-cyan-300 rounded-lg px-2.5 py-1.5 text-cyan-200 font-mono font-light text-xs outline-hidden cursor-pointer"
                  >
                    <option v-for="yc in selectedDevice?.telemetries || []" :key="yc.pointId" :value="yc.pointId">
                      [YC_{{ yc.pointId }}] {{ yc.name }} (现场实测: {{ yc.value }} {{ yc.unit || '' }})
                    </option>
                  </select>
                </div>

                <!-- Quick Test Button in Step 4 -->
                <button
                  @click="emit('open:control', selectedDevice?.deviceId || component.data.action?.deviceId || 'DEV-101')"
                  class="w-full py-1.5 px-2.5 rounded-lg bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/50 font-light text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  <Zap class="w-3.5 h-3.5 text-purple-400" />
                  <span>立即在控制台预演下发并校验变位</span>
                </button>
              </div>

              <!-- Quick shortcut to bulk points manager -->
              <div class="pt-1">
                <button
                  @click="emit('open:batch:points')"
                  class="w-full py-2 px-3 rounded-lg bg-[#050c1c] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-light text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                >
                  <Sparkles class="w-3.5 h-3.5 text-cyan-400" />
                  <span>打开批量遥测/遥信关联与生成</span>
                </button>
              </div>
            </div>

            <!-- SPECIAL SECTION: Chart Binding Explanation & Presets -->
            <div v-if="isChartComponent" class="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40 space-y-2.5">
              <div class="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                <BarChart2 class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">图表数据绑定生效指南与预设</span>
              </div>

              <div class="text-[11px] text-cyan-200/90 leading-relaxed space-y-1 font-light">
                <p>💡 <strong class="text-cyan-100 font-normal">SCADA 绑定机制：</strong> 图表数据由 <code class="text-cyan-300 bg-[#050c1c] px-1 py-0.5 rounded border border-cyan-500/30">X轴 (categoriesKey)</code> 与 <code class="text-cyan-300 bg-[#050c1c] px-1 py-0.5 rounded border border-cyan-500/30">Y轴系列 (seriesKey)</code> 自动关联全站时序曲线或装置负荷。</p>
              </div>

              <!-- Quick Presets for Charts -->
              <div class="space-y-1.5 pt-1 border-t border-cyan-500/20">
                <label class="text-[11px] font-light text-cyan-300 block">一键绑定 SCADA 实时时序与负荷曲线：</label>
                <div class="grid grid-cols-1 gap-1.5">
                  <button
                    @click="handleBindChartPreset('power-trend')"
                    class="py-1.5 px-2 rounded-lg bg-[#050c1c] hover:bg-cyan-950 border border-cyan-500/30 hover:border-cyan-400 text-left text-xs font-light text-cyan-200 hover:text-cyan-300 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <span>📈 绑定进线有功功率 24h 时序曲线</span>
                    <span class="text-[10px] text-cyan-400 font-mono">series_power</span>
                  </button>

                  <button
                    @click="handleBindChartPreset('voltage-trend')"
                    class="py-1.5 px-2 rounded-lg bg-[#050c1c] hover:bg-cyan-950 border border-cyan-500/30 hover:border-cyan-400 text-left text-xs font-light text-cyan-200 hover:text-cyan-300 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <span>📉 绑定母线电压 24h 波动曲线</span>
                    <span class="text-[10px] text-cyan-400 font-mono">series_voltage</span>
                  </button>

                  <button
                    @click="handleBindChartPreset('load-bar')"
                    class="py-1.5 px-2 rounded-lg bg-[#050c1c] hover:bg-cyan-950 border border-cyan-500/30 hover:border-cyan-400 text-left text-xs font-light text-cyan-200 hover:text-cyan-300 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <span>📊 绑定各装置实时负荷对比柱状图</span>
                    <span class="text-[10px] text-cyan-400 font-mono">series_device_load</span>
                  </button>
                </div>
              </div>
            </div>

          <!-- 4. 实时动态数据响应与契约结构 (Live JSON & Schema Specification) -->
          <div class="p-3 rounded-xl bg-[#050c1c] border border-cyan-500/40 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1 bg-[#050c1c] p-0.5 rounded-lg border border-cyan-500/30">
                <button
                  @click="dataInspectTab = 'live'"
                  class="py-1 px-2 rounded text-[11px] font-light cursor-pointer transition-all flex items-center gap-1.5"
                  :class="dataInspectTab === 'live' ? 'bg-cyan-500 text-slate-950 font-medium shadow-xs' : 'text-cyan-300 hover:text-white'"
                >
                  <Activity class="w-3 h-3" />
                  <span>实时动态数据</span>
                </button>
                <button
                  @click="dataInspectTab = 'schema'"
                  class="py-1 px-2 rounded text-[11px] font-light cursor-pointer transition-all flex items-center gap-1.5"
                  :class="dataInspectTab === 'schema' ? 'bg-cyan-500 text-slate-950 font-medium shadow-xs' : 'text-cyan-300 hover:text-white'"
                >
                  <FileCode class="w-3 h-3" />
                  <span>标准契约 / 模板</span>
                </button>
              </div>

              <div v-if="dataInspectTab === 'live'" class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span class="text-[10px] text-emerald-400 font-mono font-light">LIVE SYNC</span>
              </div>
            </div>

            <!-- TAB A: Live Dynamic JSON (Fully resolved with SCADA points in real-time) -->
            <div v-if="dataInspectTab === 'live'" class="space-y-2">
              <div class="flex items-center justify-between text-[11px] text-cyan-300 font-light">
                <span>实时运算所得的图元数据结构 (自动注入四遥测点)：</span>
                <button
                  @click="handleCopyJson"
                  class="text-[10px] text-cyan-300 hover:text-white bg-[#050c1c] px-2 py-0.5 rounded border border-cyan-500/30 cursor-pointer"
                >
                  复制 JSON
                </button>
              </div>

              <pre class="w-full max-h-56 overflow-y-auto bg-[#050c1c] border border-cyan-500/30 rounded-lg p-2.5 text-[11px] font-mono text-cyan-200 custom-scrollbar leading-relaxed font-light">{{ JSON.stringify(liveDynamicData, null, 2) }}</pre>
            </div>

            <!-- TAB B: Schema Contract & Static Fallback Template Editor -->
            <div v-else class="space-y-3">
              <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
                <span class="font-normal text-cyan-200">标准契约规范: {{ currentSchemaInfo.title }}</span>
                <button
                  @click="isSchemaDocOpen = !isSchemaDocOpen"
                  class="text-[10px] text-cyan-400 hover:text-cyan-300 cursor-pointer font-light"
                >
                  {{ isSchemaDocOpen ? '收起字段' : '展开字段' }}
                </button>
              </div>

              <!-- Schema Fields Specification Table -->
              <div v-if="isSchemaDocOpen" class="space-y-1 max-h-40 overflow-y-auto custom-scrollbar border border-cyan-500/30 rounded-lg bg-[#050c1c] p-1.5 text-[11px] font-mono font-light">
                <div v-for="field in currentSchemaInfo.fields" :key="field.field" class="p-1.5 border-b border-cyan-500/20 last:border-0 flex flex-col gap-0.5">
                  <div class="flex items-center justify-between">
                    <span class="text-cyan-300 font-normal">{{ field.field }}</span>
                    <span class="text-[9px] px-1 rounded bg-[#050c1c] text-cyan-400 border border-cyan-500/30">{{ field.type }}</span>
                  </div>
                  <div class="text-[10px] text-cyan-300/80 font-sans font-light">{{ field.description }}</div>
                </div>
              </div>

              <!-- Reset to default schema button -->
              <div class="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  @click="handleResetToDefaultSchema"
                  class="py-1.5 px-2 rounded-lg bg-[#050c1c] hover:bg-cyan-950 text-cyan-200 border border-cyan-500/30 font-light flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RefreshCw class="w-3 h-3 text-cyan-400" />
                  <span>恢复标准结构</span>
                </button>
                <button
                  @click="handleInjectTimestamp"
                  class="py-1.5 px-2 rounded-lg bg-[#050c1c] hover:bg-cyan-950 text-cyan-200 border border-cyan-500/30 font-light flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Clock class="w-3 h-3 text-emerald-400" />
                  <span>注入当前时戳</span>
                </button>
              </div>

              <!-- Static JSON Fallback Editor -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <label class="text-cyan-200 font-light">静态缺省模板数据 (Fallback Defaults)</label>
                  <button
                    @click="handleFormatJson"
                    class="text-[10px] text-cyan-400 hover:text-cyan-300 cursor-pointer font-light"
                  >
                    格式化
                  </button>
                </div>
                <textarea
                  :value="staticJsonInput"
                  @input="handleJsonInput(($event.target as HTMLTextAreaElement).value)"
                  placeholder="请输入静态缺省 JSON 数据..."
                  rows="7"
                  class="w-full bg-[#050c1c] border focus:border-cyan-400 rounded-lg p-2 text-xs font-mono font-light outline-hidden resize-y leading-relaxed text-cyan-200"
                  :class="jsonValidationStatus === 'invalid' ? 'border-red-500 text-red-300' : 'border-cyan-500/30'"
                ></textarea>
              </div>

              <div v-if="staticJsonMsg" class="text-xs font-light" :class="staticJsonMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'">
                {{ staticJsonMsg }}
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 4: INTERACTION & SCREEN NAVIGATION -->
        <div v-if="activeTab === 'interaction'" class="space-y-4">
          <div>
            <label class="text-xs font-light text-cyan-200 block mb-1">点击触发行为 (Action)</label>
            <select
              :value="(component.data.action?.type === 'switch-screen' ? 'jump-screen' : component.data.action?.type) || 'none'"
              @change="updateComponentAction({ type: ($event.target as HTMLSelectElement).value })"
              class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-200 outline-hidden cursor-pointer font-light text-xs"
            >
              <option value="none">无交互事件</option>
              <option value="jump-screen">🔗 切换跳转至目标子画面</option>
              <option value="link">🌐 打开外部系统链接</option>
            </select>
          </div>

          <!-- Target Screen Selector -->
          <div v-if="component.data.action?.type === 'jump-screen' || component.data.action?.type === 'switch-screen'" class="space-y-2 p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40">
            <label class="text-xs text-cyan-300 font-bold block">选择目标子画面</label>
            <select
              :value="component.data.action?.targetScreenId || ''"
              @change="updateComponentAction({ targetScreenId: ($event.target as HTMLSelectElement).value })"
              class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-200 font-light outline-hidden cursor-pointer text-xs"
            >
              <option value="" disabled>请选择要跳转的画面...</option>
              <option v-for="sc in screens" :key="sc.id" :value="sc.id">
                {{ sc.name }} ({{ sc.screen.width }} × {{ sc.screen.height }})
              </option>
            </select>
            <p class="text-[11px] text-cyan-200/90 leading-relaxed font-light">设置后，在 SCADA 预览演示或点击按钮时将自动平滑切换至目标画面。</p>
          </div>

          <!-- External Link Input -->
          <div v-if="component.data.action?.type === 'link'" class="space-y-2 p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40">
            <label class="text-xs text-cyan-300 font-bold block">外部系统链接 (URL)</label>
            <input
              type="url"
              :value="component.data.action?.url || ''"
              @input="updateComponentAction({ url: ($event.target as HTMLInputElement).value })"
              placeholder="https://..."
              class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-100 font-light outline-hidden text-xs"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- ================= 3. EMPTY STATE (NO SELECTION) ================= -->
    <template v-else>
      <div class="flex-1 flex flex-col items-center justify-center p-6 text-center text-cyan-400/80">
        <div class="w-12 h-12 rounded-xl bg-[#050c1c] border border-cyan-500/40 flex items-center justify-center mb-3 text-cyan-400 shadow-[0_0_15px_rgba(0,242,255,0.15)]">
          <Sliders class="w-6 h-6" />
        </div>
        <div class="text-xs font-normal text-cyan-200 mb-1">未选中图元组件</div>
        <p class="text-[11px] text-cyan-400/70 leading-relaxed max-w-[200px] font-light">
          在左侧画布中单击或框选图元，即可在此配置几何参数、电气样式与测点绑定
        </p>
      </div>
    </template>
  </aside>
</template>
