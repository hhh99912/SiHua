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
  Hash,
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
  Paintbrush,
  Image as ImageIcon,
  UploadCloud
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
import { resolveComponentDynamicData, parseStrictNumber, updateScadaPointTelemetry, resolveDataPointValue } from '../utils/scadaResolver';

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
  (e: 'update:datasets', datasets: DatasetItem[]): void;
  (e: 'align:component', type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v' | 'equal-width' | 'equal-height' | 'equal-size' | 'equal-max-size' | 'equal-min-size' | 'make-square'): void;
  (e: 'group', comps?: ScreenComponent[]): void;
  (e: 'ungroup', comp?: ScreenComponent): void;
  (e: 'save:symbol', comps: ScreenComponent[]): void;
  (e: 'delete', ids: string[]): void;
  (e: 'open:batch:points'): void;
  (e: 'open:control', deviceId: string): void;
  (e: 'open:data-association', component?: ScreenComponent): void;
  (e: 'close'): void;
}>();

const activeTab = ref<'geometry' | 'style' | 'interaction'>('geometry');

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

// 样式分类判定 (精准匹配当前组件相关样式，排除非相关样式、排除形态切换和双态颜色)
const isCustomOrStatusComponent = computed(() => {
  if (!props.component) return false;
  const t = props.component.type;
  const c = props.component.category;
  if (t === 'composite-symbol' || c === 'custom' || props.component.customProps?.isCustomSymbol || props.component.customProps?.symbolId || (props.component.states && props.component.states.length > 0)) {
    return true;
  }
  if (isSystemStatusComponent.value) {
    return true;
  }
  return false;
});

const isMediaImageComponent = computed(() => {
  if (!props.component) return false;
  return props.component.type === 'media-image';
});

const isNoStyleComponent = computed(() => {
  if (!props.component) return false;
  const t = props.component.type;
  const c = props.component.category;
  if (isCustomOrStatusComponent.value) {
    return true;
  }
  // 多媒体图片拥有专属高级配置，不作为普通无样式组件
  if (isMediaImageComponent.value) {
    return false;
  }
  // 图标组件
  if (t.startsWith('icon-') || t === 'icon') {
    return true;
  }
  // 电力一次系统固定结构矢量设备 (主变、互感器、避雷器)
  if (['elec-transformer', 'elec-ct', 'elec-pt', 'elec-arrester'].includes(t)) {
    return true;
  }
  return false;
});

// Image Upload Handler for Property Inspector (Local Upload Only)
const handleInspectorImageUpload = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('请选择有效的图片文件 (PNG, JPG, JPEG, SVG, WebP, GIF, BMP)');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const result = event.target?.result as string;
    updateComponentProps({
      customProps: {
        ...(props.component?.customProps || {}),
        src: result,
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB'
      },
      style: {
        ...(props.component?.style || {}),
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 0,
        borderColor: 'transparent',
        borderWidth: 0
      }
    });
  };
  reader.readAsDataURL(file);
};

const handleClearInspectorImage = () => {
  updateComponentProps({
    customProps: {
      ...(props.component?.customProps || {}),
      src: '',
      fileName: '',
      fileSize: ''
    }
  });
};

const isNumericMetricComponent = computed(() => {
  if (!props.component) return false;
  return ['metric-float', 'metric-flipper'].includes(props.component.type);
});

const isShapeOrBoxComponent = computed(() => {
  if (!props.component) return false;
  return [
    'draw-rect', 'draw-rounded-rect', 'draw-circle', 'draw-ellipse',
    'draw-triangle', 'draw-triangle-down', 'draw-triangle-right', 'draw-diamond',
    'draw-pentagon', 'draw-hexagon', 'draw-polygon', 'draw-octagon',
    'draw-star', 'draw-star4', 'draw-trapezoid', 'draw-parallelogram',
    'draw-cross', 'draw-ring', 'draw-sector', 'draw-heart', 'draw-bubble',
    'draw-cube', 'draw-cylinder'
  ].includes(props.component.type);
});

const isLineComponent = computed(() => {
  if (!props.component) return false;
  return ['draw-line', 'draw-polyline', 'draw-arrow', 'draw-double-arrow', 'draw-arc', 'draw-elbow', 'draw-pipe', 'elec-busbar'].includes(props.component.type);
});

const isTextComponent = computed(() => {
  if (!props.component) return false;
  return ['draw-text', 'metric-header', 'metric-clock', 'metric-time-banner', 'metric-clock-analog', 'metric-countdown'].includes(props.component.type);
});

const isButtonComponent = computed(() => {
  if (!props.component) return false;
  return props.component.type === 'ctrl-button';
});

const isDecoBorderComponent = computed(() => {
  if (!props.component) return false;
  return props.component.category === 'decoration' || props.component.type.startsWith('deco-');
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
  const sKey = comp.data?.mapping?.stateKey || 
               comp.data?.mapping?.statusKey || 
               comp.data?.mapping?.valueKey ||
               comp.data?.bindings?.state ||
               comp.data?.bindings?.value;

  if (sKey && comp.data?.useStatic !== true) {
    const live = resolveDataPointValue(props.datasets, comp.data?.datasetId, sKey, undefined);
    if (live !== undefined) {
      if (typeof live === 'number') return live;
      const str = String(live).toLowerCase();
      if (str === '1' || str === 'closed' || str === 'on' || str.includes('合')) return 1;
      if (str === '2' || str.includes('障')) return 2;
      return 0;
    }
  }

  const cp = comp.customProps || {};
  const st = comp.style || {};
  if (comp.activeState !== undefined) {
    return Number(comp.activeState);
  }
  if (cp.state !== undefined) {
    if (typeof cp.state === 'string') {
      const lower = cp.state.toLowerCase();
      if (lower === '1' || lower === 'closed' || lower === 'on' || lower.includes('合')) return 1;
      if (lower === '2' || lower.includes('障')) return 2;
      return 0;
    }
    return Number(cp.state);
  }
  if (st.indicatorState !== undefined) {
    if (st.indicatorState === 'normal' || st.indicatorState === 1 || String(st.indicatorState) === '1') return 1;
    return 0;
  }
  return 0;
});

const isMultiStateActive = (st: any) => {
  if (!props.component) return false;
  const active = props.component.activeState;
  if (active !== undefined && (String(active) === String(st.id) || String(active) === String(st.matchValue) || String(active) === String(st.stateValue))) {
    return true;
  }
  const currState = props.component.customProps?.state ?? props.component.data?.staticData?.state ?? props.component.data?.staticData?.value;
  if (currState !== undefined && (String(currState) === String(st.matchValue) || String(currState) === String(st.stateValue) || String(currState) === String(st.id))) {
    return true;
  }
  return false;
};

const testBinaryState = (val: number) => {
  if (!props.component) return;
  const isElec = ['elec-breaker', 'elec-disconnector', 'elec-grounding'].includes(props.component.type);
  const stateStr = isElec ? (val === 1 ? 'closed' : (val === 2 ? 'fault' : 'open')) : val;
  
  // 1. Single atomic update to prevent sequential emit race conditions
  const updatedComp: ScreenComponent = {
    ...props.component,
    activeState: val,
    customProps: {
      ...(props.component.customProps || {}),
      state: stateStr,
      position: val,
      status: val,
      value: val,
      running: val === 1
    },
    style: {
      ...(props.component.style || {}),
      indicatorState: val === 1 ? 'normal' : (val === 2 ? 'alarm' : 'off')
    },
    data: {
      ...(props.component.data || { mapping: {} }),
      staticData: (props.component.data?.staticData && typeof props.component.data.staticData === 'object')
        ? {
            ...props.component.data.staticData,
            state: val,
            value: val
          }
        : val
    }
  };

  emit('update:component', updatedComp);

  // 2. Synchronize live telemetry dataset point across all datasets & devices if bound
  const sKey = props.component.data?.mapping?.statusKey || 
               props.component.data?.mapping?.stateKey || 
               props.component.data?.mapping?.valueKey ||
               props.component.data?.bindings?.state ||
               props.component.data?.bindings?.value;

  if (sKey && props.datasets && props.datasets.length > 0) {
    const statusText = val === 1 ? '合闸 (1)' : (val === 2 ? '故障 (2)' : '分闸 (0)');
    const updated = updateScadaPointTelemetry(
      props.datasets,
      props.component.data?.datasetId,
      sKey,
      val,
      statusText
    );
    if (updated) {
      emit('update:datasets', [...props.datasets]);
    }
  }
};

const testMultiState = (stateId: string, matchVal?: any) => {
  if (!props.component) return;
  const targetState = props.component.states?.find(s => String(s.id) === String(stateId));
  const effectiveVal = matchVal !== undefined 
    ? matchVal 
    : (targetState?.matchValue !== undefined ? targetState.matchValue : (targetState?.stateValue !== undefined ? targetState.stateValue : stateId));
  const numVal = typeof effectiveVal === 'number' 
    ? effectiveVal 
    : (!isNaN(Number(effectiveVal)) ? Number(effectiveVal) : 0);

  // 1. Single atomic update
  const updatedComp: ScreenComponent = {
    ...props.component,
    activeState: stateId,
    customProps: {
      ...(props.component.customProps || {}),
      state: effectiveVal,
      value: effectiveVal
    },
    style: {
      ...(props.component.style || {}),
      indicatorState: numVal === 1 ? 'normal' : 'off'
    },
    data: {
      ...(props.component.data || { mapping: {} }),
      staticData: (props.component.data?.staticData && typeof props.component.data.staticData === 'object')
        ? {
            ...props.component.data.staticData,
            state: effectiveVal,
            value: effectiveVal
          }
        : effectiveVal
    }
  };

  emit('update:component', updatedComp);

  // 2. Synchronize live telemetry dataset point if bound
  const sKey = props.component.data?.mapping?.statusKey || 
               props.component.data?.mapping?.stateKey || 
               props.component.data?.mapping?.valueKey ||
               props.component.data?.bindings?.state ||
               props.component.data?.bindings?.value;

  if (sKey && props.datasets && props.datasets.length > 0) {
    const statusText = targetState?.name || `状态 (${effectiveVal})`;
    const updated = updateScadaPointTelemetry(
      props.datasets,
      props.component.data?.datasetId,
      sKey,
      numVal,
      statusText
    );
    if (updated) {
      emit('update:datasets', [...props.datasets]);
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
      categoryLabel: '未绑定',
      categoryBadgeColor: 'bg-slate-800 text-slate-400 border-slate-700',
      isControl: false,
      isRegulation: false,
      currentDisplayValue: '--',
      pointKey: '',
      pointName: '未绑定',
      deviceName: '未选择装置',
      quality: 0
    };
  }

  const mapping = comp.data.mapping || {};
  const action = comp.data.action;
  
  let devId = mapping.deviceId || (action?.type === 'tele-control' || action?.type === 'tele-regulation' ? action?.deviceId : undefined);
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

  const hasBindings = comp.data.bindings && Object.keys(comp.data.bindings).length > 0;
  const isBound = !!((devId && pointId !== undefined) || hasBindings || (comp.data.mapping && Object.keys(comp.data.mapping).length > 0 && (comp.data.mapping.valueKey || comp.data.mapping.stateKey)));

  let pointEntity: any = null;
  let verificationInfo: any = null;
  let currentDisplayValue: any = '--';
  let unit = '';
  let statusText = '';

  if (dev && isBound) {
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
    none: '未绑定'
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
    deviceId: isBound ? (dev?.deviceId || devId) : undefined,
    deviceName: isBound ? (dev?.deviceName || mapping.deviceName || (devId ? `装置 ${devId}` : '未指定装置')) : '未绑定装置',
    device: dev,
    category: isBound ? category : 'none',
    categoryLabel: isBound ? categoryLabelMap[category] : '未绑定测点',
    categoryBadgeColor: isBound ? categoryColorMap[category] : 'bg-slate-800 text-slate-400 border-slate-700',
    pointId: isBound ? pointId : undefined,
    pointName: isBound ? (pointEntity?.name || mapping.pointName || (pointId ? `测点 #${pointId}` : '未指定点名')) : '未绑定',
    pointKey: isBound ? (rawKey || (devId && pointId ? `${devId}_${category.toUpperCase()}_${pointId}` : '')) : '',
    currentDisplayValue: isBound ? currentDisplayValue : '--',
    unit,
    statusText,
    isControl,
    isRegulation,
    quality: isBound ? 1 : 0,
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

// Direct Smart Point Binding Action (简化数据绑定：仅绑定当前测点值，品质码系统自动置为 1)
const handleBindPointToComponent = (point: any) => {
  if (!props.component) return;
  const dev = selectedDevice.value;
  if (!dev) return;

  const datasetId = boundDataset.value?.id || 'ds-substation-scada';
  const cat = selectedTeleCategory.value;

  // Toggle unbind if clicked on currently bound point
  if (
    currentBindingDetails.value.isBound &&
    currentBindingDetails.value.deviceId === dev.deviceId &&
    currentBindingDetails.value.category === cat &&
    String(currentBindingDetails.value.pointId) === String(point.pointId)
  ) {
    handleUnbindPoint();
    return;
  }

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

  const currentBindings: Record<string, string> = {
    value: pointKey
  };

  const mappingUpdates: Record<string, any> = {
    deviceId: dev.deviceId,
    pointCategory: pointCat,
    pointId: point.pointId,
    deviceName: dev.deviceName,
    pointName: point.name,
    valueKey: pointKey
  };

  if (isElectricalSwitch.value || cat === 'yx' || isSystemStatusComponent.value) {
    currentBindings.state = pointKey;
    mappingUpdates.stateKey = pointKey;
    mappingUpdates.statusKey = pointKey;
  }

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
    mappingUpdates.valueKey = `${dev.deviceId}_YC_${defaultYcId}`;
    mappingUpdates.ytPointId = point.pointId;
    mappingUpdates.targetYcPointId = defaultYcId;
  }

  const pointNumericVal = typeof point.value === 'number' ? point.value : (parseInt(String(point.value), 10) || 1);

  emit('update:component', {
    ...props.component,
    data: {
      ...props.component.data,
      datasetId,
      useStatic: false,
      staticData: {
        value: pointNumericVal,
        quality: 1
      },
      bindings: currentBindings,
      mapping: mappingUpdates,
      action: newAction
    }
  });
};

// Quick Unbind Specific Property
const handleUnbindProperty = (propKey: string) => {
  if (!props.component) return;
  const currentBindings = { ...(props.component.data?.bindings || {}) };
  delete currentBindings[propKey];

  const currentMapping = { ...(props.component.data?.mapping || {}) };
  if (propKey === 'value') {
    delete currentMapping.valueKey;
    delete currentMapping.pointId;
    delete currentMapping.pointName;
  } else if (propKey === 'state') {
    delete currentMapping.stateKey;
    delete currentMapping.statusKey;
    delete currentMapping.pointId;
    delete currentMapping.pointName;
  }

  const remainingKeys = Object.keys(currentBindings);
  const isCompletelyUnbound = remainingKeys.length === 0;

  emit('update:component', {
    ...props.component,
    data: {
      ...props.component.data,
      useStatic: isCompletelyUnbound,
      staticData: isCompletelyUnbound ? { value: 0, quality: 0 } : props.component.data?.staticData,
      datasetId: isCompletelyUnbound ? undefined : props.component.data?.datasetId,
      bindings: currentBindings,
      mapping: isCompletelyUnbound ? {} : currentMapping,
      action: isCompletelyUnbound && (props.component.data?.action?.type === 'tele-control' || props.component.data?.action?.type === 'tele-regulation')
        ? { type: 'none' }
        : props.component.data?.action
    }
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

// Quick Unbind All Points (彻底解绑测点，质量码归 0，清空所有 mapping 与 bindings)
const handleUnbindPoint = () => {
  if (!props.component) return;
  const currentAction = props.component.data?.action;
  const isControlAction = currentAction?.type === 'tele-control' || currentAction?.type === 'tele-regulation';
  
  emit('update:component', {
    ...props.component,
    data: {
      useStatic: true,
      staticData: {
        value: 0,
        quality: 0
      },
      bindings: {},
      mapping: {},
      datasetId: undefined,
      action: isControlAction ? { type: 'none' } : currentAction
    }
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
  const currentData = props.component.data || {};
  const newMapping = dataUpdates.mapping !== undefined
    ? dataUpdates.mapping
    : currentData.mapping;
  const newBindings = dataUpdates.bindings !== undefined
    ? dataUpdates.bindings
    : currentData.bindings;

  emit('update:component', {
    ...props.component,
    data: {
      ...currentData,
      ...dataUpdates,
      mapping: newMapping,
      bindings: newBindings
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
          <!-- 0. 设备状态模拟测试 (针对状态图元与自定义多状态图元) -->
          <div v-if="(component.states && component.states.length > 0) || isSystemStatusComponent" class="p-3 rounded-xl bg-cyan-950/40 border border-cyan-400/50 space-y-2.5 shadow-sm">
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
                @click="testMultiState(st.id, st.matchValue ?? st.stateValue)"
                class="py-1.5 px-2 rounded-lg text-xs font-mono cursor-pointer border transition-all truncate text-left flex items-center justify-between gap-1"
                :class="isMultiStateActive(st)
                  ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.4)]'
                  : 'bg-[#050c1c] text-cyan-200 border-cyan-500/30 hover:border-cyan-400 font-light'"
              >
                <span class="truncate">{{ st.name }}</span>
                <span class="text-[9px] px-1 rounded font-mono" :class="isMultiStateActive(st) ? 'bg-slate-950/30 text-slate-950 font-bold' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'">
                  ={{ st.matchValue ?? st.stateValue ?? st.id }}
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

          <!-- 1. 自定义图元与状态图元 (已在上文展示状态模拟测试，无需展示任何基础外观样式) -->
          <template v-if="isCustomOrStatusComponent">
            <!-- 专属工程图元与状态图元无需配置基础外观样式 -->
          </template>

          <!-- 2. 图片展示图元专属属性配置 (Media Image) - 仅本地上传 & 无边框 -->
          <div v-else-if="isMediaImageComponent" class="space-y-3">
            <div class="p-3 rounded-xl bg-[#050e1f] border border-cyan-500/40 space-y-3 shadow-sm">
              <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
                <div class="flex items-center gap-1.5">
                  <ImageIcon class="w-4 h-4 text-cyan-400" />
                  <span class="font-normal text-cyan-200">图片资源与外观参数配置</span>
                </div>
                <span class="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-light">
                  本地上传 / Base64离线工程
                </span>
              </div>

              <!-- Dedicated Local Image File Upload Area -->
              <div class="space-y-2">
                <label class="text-xs font-normal text-cyan-200 block">本地图片文件上传</label>
                
                <div v-if="component.customProps?.src" class="p-2.5 rounded-lg bg-[#09152b] border border-cyan-500/30 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <img 
                      :src="component.customProps.src" 
                      class="w-10 h-10 object-contain rounded bg-black/50 border border-cyan-500/30 shrink-0" 
                      alt="Thumbnail" 
                    />
                    <div class="min-w-0">
                      <div class="text-xs text-cyan-100 font-mono truncate">
                        {{ component.customProps?.fileName || '已上传本地图片' }}
                      </div>
                      <div class="text-[10px] text-cyan-400 font-mono">
                        {{ component.customProps?.fileSize || 'Base64 工程内联' }}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0">
                    <label class="px-2 py-1 rounded bg-[#142c4e] hover:bg-cyan-600 hover:text-slate-950 text-cyan-200 border border-cyan-500/50 hover:border-cyan-300 text-xs cursor-pointer transition-all flex items-center gap-1" title="更换本地图片">
                      <UploadCloud class="w-3.5 h-3.5" />
                      <span>更换</span>
                      <input type="file" accept="image/*" @change="handleInspectorImageUpload" class="hidden" />
                    </label>
                    <button
                      type="button"
                      @click="handleClearInspectorImage"
                      class="p-1 rounded hover:bg-red-950 text-red-400 hover:text-red-200 border border-red-500/30 hover:border-red-400 transition-colors cursor-pointer"
                      title="清除图片"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <label 
                  v-else 
                  class="border-2 border-dashed border-cyan-500/40 hover:border-cyan-300 bg-[#09152b]/60 hover:bg-cyan-950/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group"
                >
                  <div class="w-9 h-9 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <UploadCloud class="w-4 h-4 text-cyan-300" />
                  </div>
                  <div class="text-center">
                    <span class="text-xs font-normal text-cyan-200 group-hover:text-white">点击选择本地图片上传</span>
                    <p class="text-[10px] text-cyan-400/80 font-mono mt-0.5">支持 PNG, JPG, JPEG, SVG, WebP, GIF, BMP</p>
                  </div>
                  <input type="file" accept="image/*" @change="handleInspectorImageUpload" class="hidden" />
                </label>
              </div>

              <!-- Object Fit & Filter -->
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-xs font-normal text-cyan-200 block mb-1">缩放填充模式</label>
                  <select
                    :value="component.customProps?.objectFit || 'contain'"
                    @change="updateComponentProps({ customProps: { ...(component.customProps || {}), objectFit: ($event.target as HTMLSelectElement).value } })"
                    class="w-full bg-[#09152b] border border-cyan-500/50 focus:border-cyan-300 rounded-lg px-2 py-1.5 text-cyan-100 font-light text-xs outline-hidden"
                  >
                    <option value="contain">等比完整 (contain)</option>
                    <option value="cover">等比填满剪裁 (cover)</option>
                    <option value="fill">拉伸全满 (fill)</option>
                    <option value="scale-down">保持原寸 (scale-down)</option>
                  </select>
                </div>

                <div>
                  <label class="text-xs font-normal text-cyan-200 block mb-1">工业滤镜渲染</label>
                  <select
                    :value="component.customProps?.imageFilter || 'none'"
                    @change="updateComponentProps({ customProps: { ...(component.customProps || {}), imageFilter: ($event.target as HTMLSelectElement).value } })"
                    class="w-full bg-[#09152b] border border-cyan-500/50 focus:border-cyan-300 rounded-lg px-2 py-1.5 text-cyan-100 font-light text-xs outline-hidden"
                  >
                    <option value="none">原色 (None)</option>
                    <option value="hud-dark">暗色科技 HUD</option>
                    <option value="cyan-tint">青色工控单色</option>
                    <option value="grayscale">黑白单色 (Gray)</option>
                    <option value="high-contrast">高对比度清晰</option>
                  </select>
                </div>
              </div>

              <!-- Linx Linux notice -->
              <div class="p-2 rounded bg-cyan-950/60 border border-cyan-500/30 text-[10px] text-cyan-300 flex items-start gap-1.5">
                <ShieldCheck class="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>凝思 Linux 深度适配：本地上传的图片将以内联 Base64 保存于工程 JSON 中，完全离线运行、迁移无丢图风险。</span>
              </div>
            </div>
          </div>

          <!-- 4. 其他无状态的工程预设图元 (如无状态固定拓扑变压器/互感器/避雷器/图标等) -->
          <div v-else-if="isNoStyleComponent" class="p-8 text-center rounded-xl bg-[#050c1c] border border-cyan-500/20 text-xs font-mono text-cyan-300/60 font-light space-y-2">
            <Info class="w-6 h-6 mx-auto text-cyan-400/50" />
            <div class="text-cyan-200 font-normal text-xs">专属预设图元组件</div>
            <div class="text-[11px] text-cyan-400/60 leading-relaxed">
              当前图元为专属预设组件（如拓扑图标或固定结构工程设备），无需额外配置基础外观样式。
            </div>
          </div>

          <!-- 2. 遥测数值专用配置 (metric-float / metric-flipper) -->
          <div v-else-if="isNumericMetricComponent" class="space-y-3">
            <div class="p-3 rounded-xl bg-[#050e1f] border border-cyan-500/40 space-y-3 shadow-sm">
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

              <!-- Strip Trailing Zeros -->
              <div class="flex items-center justify-between py-1 border-t border-cyan-500/20">
                <div>
                  <div class="text-xs font-light text-cyan-200">自动去除末尾多余的 0</div>
                  <div class="text-[11px] text-cyan-400/60 font-light">例如将 12.500 自动精简显示为 12.5</div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="component.style.trimZeros !== false && component.customProps?.trimZeros !== false"
                    @change="updateComponentStyleAndCustomProps({ trimZeros: ($event.target as HTMLInputElement).checked }, { trimZeros: ($event.target as HTMLInputElement).checked })"
                    class="sr-only peer"
                  />
                  <div class="w-9 h-5 bg-[#050c1c] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-cyan-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500 border border-cyan-500/40"></div>
                </label>
              </div>

              <!-- Alignment & Font Weight -->
              <div class="grid grid-cols-2 gap-2 pt-1 border-t border-cyan-500/20">
                <div>
                  <label class="text-xs font-light text-cyan-200 block mb-1">对齐方式</label>
                  <div class="flex rounded-lg border border-cyan-500/30 overflow-hidden bg-[#050c1c]">
                    <button
                      type="button"
                      @click="updateComponentStyleAndCustomProps({ textAlign: 'left' })"
                      class="flex-1 py-1 text-xs text-center border-r border-cyan-500/30 transition-colors"
                      :class="(component.style.textAlign || 'center') === 'left' ? 'bg-cyan-500 text-slate-950 font-medium' : 'text-cyan-400 hover:text-cyan-200'"
                    >
                      左
                    </button>
                    <button
                      type="button"
                      @click="updateComponentStyleAndCustomProps({ textAlign: 'center' })"
                      class="flex-1 py-1 text-xs text-center border-r border-cyan-500/30 transition-colors"
                      :class="(component.style.textAlign || 'center') === 'center' ? 'bg-cyan-500 text-slate-950 font-medium' : 'text-cyan-400 hover:text-cyan-200'"
                    >
                      中
                    </button>
                    <button
                      type="button"
                      @click="updateComponentStyleAndCustomProps({ textAlign: 'right' })"
                      class="flex-1 py-1 text-xs text-center transition-colors"
                      :class="(component.style.textAlign || 'center') === 'right' ? 'bg-cyan-500 text-slate-950 font-medium' : 'text-cyan-400 hover:text-cyan-200'"
                    >
                      右
                    </button>
                  </div>
                </div>
                <div>
                  <label class="text-xs font-light text-cyan-200 block mb-1">字重粗细</label>
                  <select
                    :value="component.style.fontWeight || 'bold'"
                    @change="updateComponentStyleAndCustomProps({ fontWeight: ($event.target as HTMLSelectElement).value })"
                    class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
                  >
                    <option value="normal">标准 (Normal 400)</option>
                    <option value="600">稍粗 (Semibold 600)</option>
                    <option value="bold">粗体 (Bold 700)</option>
                    <option value="900">特粗 (Black 900)</option>
                  </select>
                </div>
              </div>

              <!-- Text & Background Colors -->
              <div class="grid grid-cols-2 gap-2 pt-2 border-t border-cyan-500/20">
                <!-- Text Color -->
                <div>
                  <label class="text-xs font-light text-cyan-200 block mb-1">数值文本颜色</label>
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

                <!-- Component Background Color with Transparent Option -->
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-xs font-light text-cyan-200">组件背景底色</label>
                    <button
                      type="button"
                      @click="updateComponentStyleAndCustomProps({ fill: 'transparent' }, { bgColor: 'transparent' })"
                      class="px-2 py-0.5 rounded text-xs border transition-all cursor-pointer flex items-center gap-1"
                      :class="(component.style.fill === 'transparent' || (!component.style.fill && (!component.customProps?.bgColor || component.customProps?.bgColor === 'transparent'))) ? 'border-cyan-400 bg-cyan-950 text-cyan-200 font-medium shadow-[0_0_8px_rgba(0,242,255,0.3)]' : 'border-cyan-500/30 bg-[#050c1c] text-cyan-400/70 hover:border-cyan-400 hover:text-cyan-200'"
                    >
                      <span class="w-1.5 h-1.5 rounded-full border border-dashed border-cyan-400"></span>
                      <span>透明色</span>
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
                      <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-cyan-400/80 font-mono bg-[#050c1c]">
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

              <!-- Border Stroke & Width -->
              <div class="space-y-1.5 pt-2 border-t border-cyan-500/20">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-light text-cyan-200">边框描边与粗细</label>
                  <button
                    type="button"
                    @click="updateComponentStyleAndCustomProps({ stroke: 'transparent', strokeWidth: 0 }, { borderColor: 'transparent', borderWidth: 0 })"
                    class="px-2 py-0.5 rounded text-[11px] border transition-colors cursor-pointer"
                    :class="(!component.style.stroke || component.style.stroke === 'transparent' || component.style.strokeWidth === 0) ? 'border-cyan-400 text-cyan-200 bg-cyan-950 font-medium' : 'border-cyan-500/30 bg-[#050c1c] text-cyan-400/70 hover:border-cyan-400'"
                  >
                    无边框
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div class="flex items-center gap-2">
                    <label 
                      class="relative flex items-center justify-center w-8 h-8 rounded-md border border-cyan-500/40 hover:border-cyan-400 bg-[#050c1c] cursor-pointer overflow-hidden shrink-0 shadow-md transition-colors"
                      title="点击选取边框颜色"
                    >
                      <div 
                        v-if="component.style.stroke && component.style.stroke !== 'transparent'"
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
                      :value="component.style.stroke || 'transparent'"
                      @input="updateComponentStyleAndCustomProps({ stroke: ($event.target as HTMLInputElement).value }, { borderColor: ($event.target as HTMLInputElement).value })"
                      class="flex-1 min-w-0 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1.5 text-cyan-200 font-mono font-light text-xs outline-hidden"
                    />
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button
                      v-for="w in [1, 2, 3, 4]"
                      :key="w"
                      type="button"
                      @click="updateComponentStyleAndCustomProps({ strokeWidth: w, stroke: component.style.stroke && component.style.stroke !== 'transparent' ? component.style.stroke : '#00f2ff' }, { borderWidth: w, borderColor: component.style.stroke && component.style.stroke !== 'transparent' ? component.style.stroke : '#00f2ff' })"
                      class="flex-1 py-1 text-xs text-center rounded border transition-colors cursor-pointer"
                      :class="component.style.strokeWidth === w ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                    >
                      {{ w }}px
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. 方框类 / 矩形 / 几何基础图元专用配置 (仅允许修改背景色、边框与圆角透明度，无任何文本排版样式) -->
          <div v-else-if="isShapeOrBoxComponent" class="p-3 rounded-xl bg-[#050e1f] border border-cyan-500/40 space-y-3 shadow-sm">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
              <div class="flex items-center gap-1.5">
                <Palette class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">图形背景底色与边框配置</span>
              </div>
              <span class="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-light">
                几何图形
              </span>
            </div>

            <!-- 背景底色填充 (带透明色选项) -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-light text-cyan-200">背景填充颜色</label>
                <!-- 快捷透明色切换按钮 -->
                <button
                  type="button"
                  @click="updateComponentStyle({ fill: 'transparent' })"
                  class="px-2 py-0.5 rounded text-xs border transition-all cursor-pointer flex items-center gap-1"
                  :class="(!component.style.fill || component.style.fill === 'transparent') ? 'border-cyan-400 bg-cyan-950 text-cyan-200 font-medium shadow-[0_0_8px_rgba(0,242,255,0.3)]' : 'border-cyan-500/30 bg-[#050c1c] text-cyan-400/70 hover:border-cyan-400 hover:text-cyan-200'"
                >
                  <span class="w-2 h-2 rounded-full border border-dashed border-cyan-400"></span>
                  <span>透明色</span>
                </button>
              </div>
              <div class="flex items-center gap-2">
                <label 
                  class="relative flex items-center justify-center w-8 h-8 rounded-md border border-cyan-500/40 hover:border-cyan-400 bg-[#050c1c] cursor-pointer overflow-hidden shrink-0 shadow-md transition-colors"
                  title="点击选取背景颜色"
                >
                  <div 
                    v-if="component.style.fill && component.style.fill !== 'transparent'"
                    class="w-full h-full"
                    :style="{ backgroundColor: component.style.fill }"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-cyan-400/80 font-mono bg-[#050c1c]">
                    透明
                  </div>
                  <input
                    type="color"
                    :value="component.style.fill && component.style.fill !== 'transparent' ? component.style.fill : '#00f2ff'"
                    @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value })"
                    class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
                <input
                  type="text"
                  :value="component.style.fill || 'transparent'"
                  @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value })"
                  class="flex-1 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-cyan-100 font-mono text-xs outline-hidden"
                />
              </div>
            </div>

            <!-- 边框描边与粗细 -->
            <div class="space-y-1.5 pt-2 border-t border-cyan-500/20">
              <div class="flex items-center justify-between">
                <label class="text-xs font-light text-cyan-200">边框描边与粗细</label>
                <button
                  type="button"
                  @click="updateComponentStyle({ stroke: 'transparent', strokeWidth: 0 })"
                  class="px-2 py-0.5 rounded text-[11px] border transition-colors cursor-pointer"
                  :class="(!component.style.stroke || component.style.stroke === 'transparent' || component.style.strokeWidth === 0) ? 'border-cyan-400 text-cyan-200 bg-cyan-950 font-medium' : 'border-cyan-500/30 bg-[#050c1c] text-cyan-400/70 hover:border-cyan-400'"
                >
                  无边框
                </button>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="flex items-center gap-2">
                  <label 
                    class="relative flex items-center justify-center w-8 h-8 rounded-md border border-cyan-500/40 hover:border-cyan-400 bg-[#050c1c] cursor-pointer overflow-hidden shrink-0 shadow-md transition-colors"
                    title="点击选取边框颜色"
                  >
                    <div 
                      v-if="component.style.stroke && component.style.stroke !== 'transparent'"
                      class="w-full h-full"
                      :style="{ backgroundColor: component.style.stroke }"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-cyan-400/60 font-mono bg-[#050c1c]">
                      无
                    </div>
                    <input
                      type="color"
                      :value="component.style.stroke && component.style.stroke !== 'transparent' ? component.style.stroke : '#00f2ff'"
                      @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value, strokeWidth: component.style.strokeWidth || 1 })"
                      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <input
                    type="text"
                    :value="component.style.stroke || 'transparent'"
                    @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value })"
                    class="flex-1 min-w-0 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 font-mono font-light text-xs outline-hidden"
                  />
                </div>
                <div class="flex items-center gap-1.5">
                  <button
                    v-for="w in [1, 2, 3, 4]"
                    :key="w"
                    type="button"
                    @click="updateComponentStyle({ strokeWidth: w, stroke: component.style.stroke && component.style.stroke !== 'transparent' ? component.style.stroke : '#00f2ff' })"
                    class="flex-1 py-1 text-xs text-center rounded border transition-colors cursor-pointer"
                    :class="component.style.strokeWidth === w ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                  >
                    {{ w }}px
                  </button>
                </div>
              </div>
            </div>

            <!-- 圆角 (针对矩形/圆角矩形) 与透明度 -->
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-cyan-500/20">
              <div v-if="component.type === 'draw-rect' || component.type === 'draw-rounded-rect'">
                <label class="text-xs font-light text-cyan-200 block mb-1">
                  圆角半径 ({{ component.style.borderRadius || 0 }}px)
                </label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  :value="component.style.borderRadius || 0"
                  @input="updateComponentStyle({ borderRadius: Number(($event.target as HTMLInputElement).value) })"
                  class="w-full accent-cyan-400"
                />
              </div>
              <div :class="!(component.type === 'draw-rect' || component.type === 'draw-rounded-rect') ? 'col-span-2' : ''">
                <label class="text-xs font-light text-cyan-200 block mb-1">
                  不透明度 ({{ Math.round((component.style.opacity ?? 1) * 100) }}%)
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  :value="component.style.opacity ?? 1"
                  @input="updateComponentStyle({ opacity: Number(($event.target as HTMLInputElement).value) })"
                  class="w-full accent-cyan-400"
                />
              </div>
            </div>
          </div>

          <!-- 4. 线条 / 管道 / 导线 / 走线类组件专用配置 (纯线条样式，无背景底色，无文本排版) -->
          <div v-else-if="isLineComponent" class="p-3 rounded-xl bg-[#050e1f] border border-cyan-500/40 space-y-3 shadow-sm">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
              <div class="flex items-center gap-1.5">
                <Sliders class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">线路与管网线条样式</span>
              </div>
              <span class="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-light">
                导线管道
              </span>
            </div>

            <!-- 线条颜色与线宽 -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">线条颜色</label>
                <div class="flex items-center gap-2">
                  <label 
                    class="relative flex items-center justify-center w-8 h-8 rounded-md border border-cyan-500/40 hover:border-cyan-400 bg-[#050c1c] cursor-pointer overflow-hidden shrink-0 shadow-md transition-colors"
                    title="点击选取线条颜色"
                  >
                    <div 
                      class="w-full h-full"
                      :style="{ backgroundColor: component.style.stroke || '#00f2ff' }"
                    />
                    <input
                      type="color"
                      :value="component.style.stroke || '#00f2ff'"
                      @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value })"
                      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <input
                    type="text"
                    :value="component.style.stroke || '#00f2ff'"
                    @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value })"
                    class="flex-1 min-w-0 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 font-mono font-light text-xs outline-hidden"
                  />
                </div>
              </div>
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">
                  线条宽度 ({{ component.style.strokeWidth || 2 }}px)
                </label>
                <div class="flex items-center gap-1">
                  <button
                    v-for="w in [1, 2, 3, 4, 6]"
                    :key="w"
                    type="button"
                    @click="updateComponentStyle({ strokeWidth: w })"
                    class="flex-1 py-1 text-xs text-center rounded border transition-colors cursor-pointer"
                    :class="(component.style.strokeWidth || 2) === w ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                  >
                    {{ w }}
                  </button>
                </div>
              </div>
            </div>

            <!-- 线条虚实样式 -->
            <div class="pt-2 border-t border-cyan-500/20">
              <label class="text-xs font-light text-cyan-200 block mb-1">虚实样式</label>
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  @click="updateComponentStyle({ lineStyle: 'solid' })"
                  class="py-1 px-2 rounded text-xs border text-center transition-colors cursor-pointer"
                  :class="(component.style.lineStyle || 'solid') === 'solid' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  实线 (Solid)
                </button>
                <button
                  type="button"
                  @click="updateComponentStyle({ lineStyle: 'dashed' })"
                  class="py-1 px-2 rounded text-xs border text-center transition-colors cursor-pointer"
                  :class="component.style.lineStyle === 'dashed' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  虚线 (Dashed)
                </button>
                <button
                  type="button"
                  @click="updateComponentStyle({ lineStyle: 'dotted' })"
                  class="py-1 px-2 rounded text-xs border text-center transition-colors cursor-pointer"
                  :class="component.style.lineStyle === 'dotted' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  点线 (Dotted)
                </button>
              </div>
            </div>

            <!-- 走线转角模式 (针对直线、折线) -->
            <div v-if="component.type === 'draw-line' || component.type === 'draw-polyline' || component.type === 'pipe-flow'" class="pt-2 border-t border-cyan-500/20">
              <label class="text-xs font-light text-cyan-200 block mb-1">走线转角拐角模式</label>
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  @click="updateComponentStyle({ lineType: 'direct' })"
                  class="py-1 text-xs border rounded transition-colors cursor-pointer text-center"
                  :class="(!component.style.lineType || component.style.lineType === 'direct') ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  直连直线
                </button>
                <button
                  type="button"
                  @click="updateComponentStyle({ lineType: 'orthogonal-h' })"
                  class="py-1 text-xs border rounded transition-colors cursor-pointer text-center"
                  :class="component.style.lineType === 'orthogonal-h' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  水平直角
                </button>
                <button
                  type="button"
                  @click="updateComponentStyle({ lineType: 'orthogonal-v' })"
                  class="py-1 text-xs border rounded transition-colors cursor-pointer text-center"
                  :class="component.style.lineType === 'orthogonal-v' ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                >
                  垂直直角
                </button>
              </div>
            </div>

            <!-- 箭头配置 (针对箭头和折线) -->
            <div v-if="component.type === 'draw-arrow' || component.type === 'draw-double-arrow' || component.type === 'draw-line' || component.type === 'draw-polyline'" class="grid grid-cols-2 gap-2 pt-2 border-t border-cyan-500/20">
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">始端箭头</label>
                <select
                  :value="component.style.startArrow || 'none'"
                  @change="updateComponentStyle({ startArrow: ($event.target as HTMLSelectElement).value })"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
                >
                  <option value="none">无箭头</option>
                  <option value="arrow">标准尖头</option>
                  <option value="circle">圆点节点</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">末端箭头</label>
                <select
                  :value="component.style.endArrow || (component.type.includes('arrow') ? 'arrow' : 'none')"
                  @change="updateComponentStyle({ endArrow: ($event.target as HTMLSelectElement).value })"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
                >
                  <option value="none">无箭头</option>
                  <option value="arrow">标准尖头</option>
                  <option value="circle">圆点节点</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 5. 纯文本 / 标牌 / 标题类组件专用配置 (纯文本排版：内容、字号、字体系列、粗细、对齐、文本颜色与背景底色) -->
          <div v-else-if="isTextComponent" class="p-3 rounded-xl bg-[#050e1f] border border-cyan-500/40 space-y-3.5 shadow-sm">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
              <div class="flex items-center gap-1.5">
                <Type class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">静态文本样式</span>
              </div>
              <span class="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-light">
                纯文本排版
              </span>
            </div>

            <!-- 展示标题 / 文本内容 -->
            <div>
              <label class="text-xs font-light text-cyan-200 block mb-1">展示文本内容</label>
              <textarea
                rows="2"
                :value="component.style.text || component.customProps?.title || component.name || ''"
                @input="handleTextTitleChange(($event.target as HTMLTextAreaElement).value)"
                class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-100 text-xs font-light outline-hidden resize-y leading-relaxed"
                placeholder="输入展示文字，支持回车换行..."
              />
            </div>

            <!-- 字号与快捷预设 -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-light text-cyan-200">字号大小 ({{ component.style.fontSize || 16 }}px)</label>
                <div class="flex items-center gap-1">
                  <button
                    v-for="sz in [12, 14, 16, 20, 24, 32]"
                    :key="sz"
                    type="button"
                    @click="updateComponentStyle({ fontSize: sz })"
                    class="px-1.5 py-0.5 text-[10px] rounded border transition-colors cursor-pointer"
                    :class="(component.style.fontSize || 16) === sz ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400' : 'bg-[#050c1c] text-cyan-400/80 border-cyan-500/30 hover:border-cyan-400'"
                  >
                    {{ sz }}
                  </button>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="72"
                  step="1"
                  :value="component.style.fontSize || 16"
                  @input="updateComponentStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })"
                  class="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-[#050c1c] rounded-lg"
                />
                <input
                  type="number"
                  min="10"
                  max="160"
                  :value="component.style.fontSize || 16"
                  @input="updateComponentStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })"
                  class="w-16 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 font-mono text-xs outline-hidden text-center"
                />
              </div>
            </div>

            <!-- 字体系列 -->
            <div>
              <label class="text-xs font-light text-cyan-200 block mb-1">字体系列</label>
              <select
                :value="component.style.fontFamily || `'Noto Sans SC', system-ui, sans-serif`"
                @change="updateComponentStyle({ fontFamily: ($event.target as HTMLSelectElement).value })"
                class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
              >
                <option value="'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif">现代黑体 / 标准工业无衬线</option>
                <option value="'Orbitron', 'Chakra Petch', monospace">工业数显 / SCADA 科技 (Orbitron)</option>
                <option value="'Chakra Petch', 'Orbitron', sans-serif">机甲工控 / 坚韧切割 (Chakra Petch)</option>
                <option value="'JetBrains Mono', 'Cascadia Code', Consolas, monospace">极客代码 / 工业等宽 (JetBrains Mono)</option>
                <option value="'Rajdhani', 'D-DIN', 'Trebuchet MS', sans-serif">航天仪表 / 紧凑硬朗 (Rajdhani)</option>
                <option value="'Share Tech Mono', 'Courier New', monospace">终端复古 / 电子等宽 (Share Tech)</option>
                <option value="'Noto Serif SC', 'Songti SC', 'SimSun', serif">经典衬线 / 典雅宋体 (Serif)</option>
                <option value="'STKaiti', 'KaiTi', 'Kaiti SC', serif">传统楷体 / 书法印章 (KaiTi)</option>
                <option value="'Impact', 'Arial Black', sans-serif">重型标牌 / 特粗标题 (Impact)</option>
                <option value="'Arial Rounded MT Bold', 'PingFang SC', 'Microsoft YaHei', sans-serif">柔和圆体 / 微晶圆角 (Rounded)</option>
              </select>
            </div>

            <!-- 字重粗细与快速文字样式 -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">字重粗细</label>
                <select
                  :value="String(component.style.fontWeight || '400')"
                  @change="updateComponentStyle({ fontWeight: ($event.target as HTMLSelectElement).value })"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-200 text-xs font-light outline-hidden cursor-pointer"
                >
                  <option value="100">极细体 (Thin 100)</option>
                  <option value="300">细体 (Light 300)</option>
                  <option value="400">常规 (Regular 400)</option>
                  <option value="500">中等 (Medium 500)</option>
                  <option value="600">半粗 (Semibold 600)</option>
                  <option value="700">粗体 (Bold 700)</option>
                  <option value="900">特粗黑体 (Black 900)</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">文字修饰</label>
                <div class="flex items-center rounded-lg border border-cyan-500/30 overflow-hidden bg-[#050c1c] h-[34px]">
                  <button
                    type="button"
                    @click="updateComponentStyle({ fontWeight: (component.style.fontWeight === '700' || component.style.fontWeight === 'bold') ? '400' : '700' })"
                    class="flex-1 h-full flex items-center justify-center text-xs border-r border-cyan-500/30 transition-colors font-bold cursor-pointer"
                    :class="(component.style.fontWeight === '700' || component.style.fontWeight === 'bold' || component.style.fontWeight === '900') ? 'bg-cyan-500 text-slate-950' : 'text-cyan-400 hover:text-cyan-200'"
                    title="粗体切换"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    @click="updateComponentStyle({ fontStyle: component.style.fontStyle === 'italic' ? 'normal' : 'italic' })"
                    class="flex-1 h-full flex items-center justify-center text-xs border-r border-cyan-500/30 transition-colors italic cursor-pointer font-serif"
                    :class="component.style.fontStyle === 'italic' ? 'bg-cyan-500 text-slate-950' : 'text-cyan-400 hover:text-cyan-200'"
                    title="斜体切换"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    @click="updateComponentStyle({ textDecoration: component.style.textDecoration === 'underline' ? 'none' : 'underline' })"
                    class="flex-1 h-full flex items-center justify-center text-xs border-r border-cyan-500/30 transition-colors underline cursor-pointer"
                    :class="component.style.textDecoration === 'underline' ? 'bg-cyan-500 text-slate-950' : 'text-cyan-400 hover:text-cyan-200'"
                    title="下划线切换"
                  >
                    U
                  </button>
                  <button
                    type="button"
                    @click="updateComponentStyle({ glow: !component.style.glow })"
                    class="flex-1 h-full flex items-center justify-center text-xs transition-colors cursor-pointer"
                    :class="component.style.glow ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-cyan-400 hover:text-cyan-200'"
                    title="科技荧光发光"
                  >
                    光
                  </button>
                </div>
              </div>
            </div>

            <!-- 对齐方式 (水平对齐 & 垂直对齐) -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">水平对齐</label>
                <div class="flex rounded-lg border border-cyan-500/30 overflow-hidden bg-[#050c1c]">
                  <button
                    type="button"
                    @click="updateComponentStyle({ textAlign: 'left' })"
                    class="flex-1 py-1.5 text-xs text-center border-r border-cyan-500/30 transition-colors cursor-pointer"
                    :class="(component.style.textAlign || 'center') === 'left' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-cyan-400 hover:text-cyan-200'"
                    title="居左对齐"
                  >
                    左
                  </button>
                  <button
                    type="button"
                    @click="updateComponentStyle({ textAlign: 'center' })"
                    class="flex-1 py-1.5 text-xs text-center border-r border-cyan-500/30 transition-colors cursor-pointer"
                    :class="(!component.style.textAlign || component.style.textAlign === 'center') ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-cyan-400 hover:text-cyan-200'"
                    title="居中对齐"
                  >
                    中
                  </button>
                  <button
                    type="button"
                    @click="updateComponentStyle({ textAlign: 'right' })"
                    class="flex-1 py-1.5 text-xs text-center border-r border-cyan-500/30 transition-colors cursor-pointer"
                    :class="component.style.textAlign === 'right' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-cyan-400 hover:text-cyan-200'"
                    title="居右对齐"
                  >
                    右
                  </button>
                  <button
                    type="button"
                    @click="updateComponentStyle({ textAlign: 'justify' })"
                    class="flex-1 py-1.5 text-xs text-center transition-colors cursor-pointer"
                    :class="component.style.textAlign === 'justify' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-cyan-400 hover:text-cyan-200'"
                    title="两端分散对齐"
                  >
                    散
                  </button>
                </div>
              </div>
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">垂直对齐</label>
                <div class="flex rounded-lg border border-cyan-500/30 overflow-hidden bg-[#050c1c]">
                  <button
                    type="button"
                    @click="updateComponentStyle({ verticalAlign: 'top' })"
                    class="flex-1 py-1.5 text-xs text-center border-r border-cyan-500/30 transition-colors cursor-pointer"
                    :class="component.style.verticalAlign === 'top' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-cyan-400 hover:text-cyan-200'"
                    title="顶部对齐"
                  >
                    顶
                  </button>
                  <button
                    type="button"
                    @click="updateComponentStyle({ verticalAlign: 'center' })"
                    class="flex-1 py-1.5 text-xs text-center border-r border-cyan-500/30 transition-colors cursor-pointer"
                    :class="(!component.style.verticalAlign || component.style.verticalAlign === 'center') ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-cyan-400 hover:text-cyan-200'"
                    title="垂直居中"
                  >
                    中
                  </button>
                  <button
                    type="button"
                    @click="updateComponentStyle({ verticalAlign: 'bottom' })"
                    class="flex-1 py-1.5 text-xs text-center transition-colors cursor-pointer"
                    :class="component.style.verticalAlign === 'bottom' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-cyan-400 hover:text-cyan-200'"
                    title="底部对齐"
                  >
                    底
                  </button>
                </div>
              </div>
            </div>

            <!-- 文字颜色与文本背景底色 (带透明色选项) -->
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-cyan-500/20">
              <!-- 文字颜色 -->
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">文字颜色</label>
                <div class="flex items-center gap-2">
                  <label 
                    class="relative flex items-center justify-center w-8 h-8 rounded-md border border-cyan-500/40 hover:border-cyan-400 bg-[#050c1c] cursor-pointer overflow-hidden shrink-0 shadow-md transition-colors"
                    title="点击选取文字颜色"
                  >
                    <div 
                      class="w-full h-full"
                      :style="{ backgroundColor: component.style.textColor || '#00f2ff' }"
                    />
                    <input
                      type="color"
                      :value="component.style.textColor || '#00f2ff'"
                      @input="updateComponentStyle({ textColor: ($event.target as HTMLInputElement).value })"
                      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <input
                    type="text"
                    :value="component.style.textColor || '#00f2ff'"
                    @input="updateComponentStyle({ textColor: ($event.target as HTMLInputElement).value })"
                    class="flex-1 min-w-0 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 font-mono font-light text-xs outline-hidden"
                  />
                </div>
                <!-- Quick color chips for text -->
                <div class="flex items-center gap-1 mt-1.5">
                  <button
                    v-for="tc in ['#00f2ff', '#38bdf8', '#22c55e', '#eab308', '#ef4444', '#ffffff', '#94a3b8']"
                    :key="tc"
                    type="button"
                    @click="updateComponentStyle({ textColor: tc })"
                    class="w-3.5 h-3.5 rounded-full border border-white/20 transition-transform hover:scale-125 cursor-pointer shrink-0"
                    :style="{ backgroundColor: tc }"
                    :title="tc"
                  />
                </div>
              </div>

              <!-- 文本背景底色 (带透明色) -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-light text-cyan-200">背景底色</label>
                  <button
                    type="button"
                    @click="updateComponentStyle({ fill: 'transparent' })"
                    class="px-2 py-0.5 rounded text-[11px] border transition-all cursor-pointer flex items-center gap-1"
                    :class="(!component.style.fill || component.style.fill === 'transparent') ? 'border-cyan-400 bg-cyan-950 text-cyan-200 font-medium shadow-[0_0_8px_rgba(0,242,255,0.3)]' : 'border-cyan-500/30 bg-[#050c1c] text-cyan-400/70 hover:border-cyan-400 hover:text-cyan-200'"
                  >
                    <span class="w-1.5 h-1.5 rounded-full border border-dashed border-cyan-400"></span>
                    <span>透明底色</span>
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
                    <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-cyan-400/80 font-mono bg-[#050c1c]">
                      透明
                    </div>
                    <input
                      type="color"
                      :value="component.style.fill && component.style.fill !== 'transparent' ? component.style.fill : '#050c1c'"
                      @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value })"
                      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <input
                    type="text"
                    :value="component.style.fill || 'transparent'"
                    @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value })"
                    class="flex-1 min-w-0 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 font-mono font-light text-xs outline-hidden"
                  />
                </div>
                <!-- Quick background color chips -->
                <div class="flex items-center gap-1 mt-1.5">
                  <button
                    v-for="bgc in ['#050e1f', '#0b172a', '#021a24', '#1e293b', '#000000', 'rgba(0,242,255,0.15)']"
                    :key="bgc"
                    type="button"
                    @click="updateComponentStyle({ fill: bgc })"
                    class="w-3.5 h-3.5 rounded border border-cyan-500/40 transition-transform hover:scale-125 cursor-pointer shrink-0"
                    :style="{ backgroundColor: bgc }"
                    :title="bgc"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 6. 控制按钮专用配置 (已移除形态风格和主题切换，仅保留基础按钮文字、字号、颜色和带透明的背景底色) -->
          <div v-else-if="isButtonComponent" class="p-3 rounded-xl bg-[#050e1f] border border-cyan-500/40 space-y-3 shadow-sm">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
              <div class="flex items-center gap-1.5">
                <Sliders class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">控制按钮基础样式</span>
              </div>
              <span class="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-light">
                遥控按钮
              </span>
            </div>

            <!-- 按钮显示文本 -->
            <div>
              <label class="text-xs font-light text-cyan-200 block mb-1">按钮显示文本</label>
              <input
                type="text"
                :value="component.style.buttonText || component.name || '控制按钮'"
                @input="updateComponentStyle({ buttonText: ($event.target as HTMLInputElement).value })"
                class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-100 text-xs font-light outline-hidden"
                placeholder="按钮名称..."
              />
            </div>

            <!-- 字号与文字颜色 -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">字号大小 (px)</label>
                <input
                  type="number"
                  min="10"
                  max="48"
                  :value="component.style.fontSize || 13"
                  @input="updateComponentStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })"
                  class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-200 font-mono text-xs outline-hidden"
                />
              </div>
              <div>
                <label class="text-xs font-light text-cyan-200 block mb-1">文字颜色</label>
                <div class="flex items-center gap-2">
                  <label 
                    class="relative flex items-center justify-center w-8 h-8 rounded-md border border-cyan-500/40 hover:border-cyan-400 bg-[#050c1c] cursor-pointer overflow-hidden shrink-0 shadow-md transition-colors"
                    title="点击选取文字颜色"
                  >
                    <div 
                      class="w-full h-full"
                      :style="{ backgroundColor: component.style.textColor || '#ffffff' }"
                    />
                    <input
                      type="color"
                      :value="component.style.textColor || '#ffffff'"
                      @input="updateComponentStyle({ textColor: ($event.target as HTMLInputElement).value })"
                      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <input
                    type="text"
                    :value="component.style.textColor || '#ffffff'"
                    @input="updateComponentStyle({ textColor: ($event.target as HTMLInputElement).value })"
                    class="flex-1 min-w-0 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 font-mono font-light text-xs outline-hidden"
                  />
                </div>
              </div>
            </div>

            <!-- 按键背景底色 (带透明色选项) -->
            <div class="pt-2 border-t border-cyan-500/20">
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-light text-cyan-200">按键背景底色</label>
                <button
                  type="button"
                  @click="updateComponentStyle({ fill: 'transparent', backgroundColor: 'transparent' }), updateComponentCustomProps({ bgColor: 'transparent', fill: 'transparent' })"
                  class="px-2 py-0.5 rounded text-xs border transition-all cursor-pointer flex items-center gap-1"
                  :class="(!component.style.fill || component.style.fill === 'transparent' || component.style.backgroundColor === 'transparent') ? 'border-cyan-400 bg-cyan-950 text-cyan-200 font-medium shadow-[0_0_8px_rgba(0,242,255,0.3)]' : 'border-cyan-500/30 bg-[#050c1c] text-cyan-400/70 hover:border-cyan-400 hover:text-cyan-200'"
                >
                  <span class="w-1.5 h-1.5 rounded-full border border-dashed border-cyan-400"></span>
                  <span>透明色</span>
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
                  <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-cyan-400/80 font-mono bg-[#050c1c]">
                    透明
                  </div>
                  <input
                    type="color"
                    :value="component.style.fill && component.style.fill !== 'transparent' ? component.style.fill : (component.style.backgroundColor || '#07101e')"
                    @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value, backgroundColor: ($event.target as HTMLInputElement).value }), updateComponentCustomProps({ bgColor: ($event.target as HTMLInputElement).value, fill: ($event.target as HTMLInputElement).value })"
                    class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
                <input
                  type="text"
                  :value="component.style.fill || component.style.backgroundColor || 'transparent'"
                  @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value, backgroundColor: ($event.target as HTMLInputElement).value }), updateComponentCustomProps({ bgColor: ($event.target as HTMLInputElement).value, fill: ($event.target as HTMLInputElement).value })"
                  class="flex-1 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-cyan-100 font-mono text-xs outline-hidden"
                />
              </div>
            </div>

            <!-- 边框颜色与粗细 -->
            <div class="space-y-1.5 pt-2 border-t border-cyan-500/20">
              <div class="flex items-center justify-between">
                <label class="text-xs font-light text-cyan-200">按键边框描边</label>
                <button
                  type="button"
                  @click="updateComponentStyle({ stroke: 'transparent', strokeWidth: 0 })"
                  class="px-2 py-0.5 rounded text-[11px] border transition-colors cursor-pointer"
                  :class="(!component.style.stroke || component.style.stroke === 'transparent' || component.style.strokeWidth === 0) ? 'border-cyan-400 text-cyan-200 bg-cyan-950 font-medium' : 'border-cyan-500/30 bg-[#050c1c] text-cyan-400/70 hover:border-cyan-400'"
                >
                  无边框
                </button>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="flex items-center gap-2">
                  <label 
                    class="relative flex items-center justify-center w-8 h-8 rounded-md border border-cyan-500/40 hover:border-cyan-400 bg-[#050c1c] cursor-pointer overflow-hidden shrink-0 shadow-md transition-colors"
                    title="点击选取边框颜色"
                  >
                    <div 
                      v-if="component.style.stroke && component.style.stroke !== 'transparent'"
                      class="w-full h-full"
                      :style="{ backgroundColor: component.style.stroke }"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-cyan-400/60 font-mono bg-[#050c1c]">
                      无
                    </div>
                    <input
                      type="color"
                      :value="component.style.stroke && component.style.stroke !== 'transparent' ? component.style.stroke : '#00f2ff'"
                      @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value, strokeWidth: component.style.strokeWidth || 1 })"
                      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <input
                    type="text"
                    :value="component.style.stroke || 'transparent'"
                    @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value })"
                    class="flex-1 min-w-0 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 font-mono font-light text-xs outline-hidden"
                  />
                </div>
                <div class="flex items-center gap-1.5">
                  <button
                    v-for="w in [1, 2, 3]"
                    :key="w"
                    type="button"
                    @click="updateComponentStyle({ strokeWidth: w, stroke: component.style.stroke && component.style.stroke !== 'transparent' ? component.style.stroke : '#00f2ff' })"
                    class="flex-1 py-1 text-xs text-center rounded border transition-colors cursor-pointer"
                    :class="component.style.strokeWidth === w ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                  >
                    {{ w }}px
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 7. 科技边框类组件专用配置 (已彻底移除 11 种边框形态切换网格，仅保留边框标题、线条颜色与带透明选项的容器背景色) -->
          <div v-else-if="isDecoBorderComponent" class="p-3 rounded-xl bg-[#050e1f] border border-cyan-500/40 space-y-3 shadow-sm">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
              <div class="flex items-center gap-1.5">
                <Palette class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">科技边框与容器基础样式</span>
              </div>
              <span class="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-light">
                修饰边框
              </span>
            </div>

            <!-- 边框抬头标题 -->
            <div>
              <label class="text-xs font-light text-cyan-200 block mb-1">边框抬头标题 (Title)</label>
              <input
                type="text"
                :value="component.customProps?.title || component.name || ''"
                @input="updateComponentCustomProps({ title: ($event.target as HTMLInputElement).value })"
                class="w-full bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-cyan-100 text-xs font-light outline-hidden"
                placeholder="如: 电压监测区 / 负荷总览..."
              />
            </div>

            <!-- 科技线条颜色 -->
            <div class="pt-2 border-t border-cyan-500/20">
              <label class="text-xs font-light text-cyan-200 block mb-1">科技线条与边框颜色</label>
              <div class="flex items-center gap-2">
                <label 
                  class="relative flex items-center justify-center w-8 h-8 rounded-md border border-cyan-500/40 hover:border-cyan-400 bg-[#050c1c] cursor-pointer overflow-hidden shrink-0 shadow-md transition-colors"
                  title="点击选取边框颜色"
                >
                  <div 
                    class="w-full h-full"
                    :style="{ backgroundColor: component.style.stroke || component.customProps?.color || '#00f2ff' }"
                  />
                  <input
                    type="color"
                    :value="component.style.stroke || component.customProps?.color || '#00f2ff'"
                    @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value }), updateComponentCustomProps({ color: ($event.target as HTMLInputElement).value })"
                    class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
                <input
                  type="text"
                  :value="component.style.stroke || component.customProps?.color || '#00f2ff'"
                  @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value }), updateComponentCustomProps({ color: ($event.target as HTMLInputElement).value })"
                  class="flex-1 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-cyan-100 font-mono text-xs outline-hidden"
                />
              </div>
            </div>

            <!-- 容器背景底色 (带透明色选项) -->
            <div class="pt-2 border-t border-cyan-500/20">
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-light text-cyan-200">容器背景底色</label>
                <button
                  type="button"
                  @click="updateComponentStyle({ fill: 'transparent' }), updateComponentCustomProps({ bgColor: 'transparent' })"
                  class="px-2 py-0.5 rounded text-xs border transition-all cursor-pointer flex items-center gap-1"
                  :class="(!component.style.fill || component.style.fill === 'transparent' || component.customProps?.bgColor === 'transparent') ? 'border-cyan-400 bg-cyan-950 text-cyan-200 font-medium shadow-[0_0_8px_rgba(0,242,255,0.3)]' : 'border-cyan-500/30 bg-[#050c1c] text-cyan-400/70 hover:border-cyan-400 hover:text-cyan-200'"
                >
                  <span class="w-1.5 h-1.5 rounded-full border border-dashed border-cyan-400"></span>
                  <span>透明色</span>
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
                  <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-cyan-400/80 font-mono bg-[#050c1c]">
                    透明
                  </div>
                  <input
                    type="color"
                    :value="component.style.fill && component.style.fill !== 'transparent' ? component.style.fill : (component.customProps?.bgColor || '#040814')"
                    @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value }), updateComponentCustomProps({ bgColor: ($event.target as HTMLInputElement).value })"
                    class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
                <input
                  type="text"
                  :value="component.style.fill || component.customProps?.bgColor || 'transparent'"
                  @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value }), updateComponentCustomProps({ bgColor: ($event.target as HTMLInputElement).value })"
                  class="flex-1 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-cyan-100 font-mono text-xs outline-hidden"
                />
              </div>
            </div>
          </div>

          <!-- 8. 图表类组件专用配置 (isChartComponent) -->
          <div v-else-if="isChartComponent" class="p-3 rounded-xl bg-[#050e1f] border border-cyan-500/40 space-y-3 shadow-sm">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
              <div class="flex items-center gap-1.5">
                <BarChart2 class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">图表视觉与参考线配置</span>
              </div>
              <span class="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-light">
                监控图表
              </span>
            </div>

            <!-- 图表背景底色 (带透明色选项) -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-light text-cyan-200">图表背景底色</label>
                <button
                  type="button"
                  @click="updateComponentStyle({ fill: 'transparent', backgroundColor: 'transparent' }), updateComponentCustomProps({ bgColor: 'transparent' })"
                  class="px-2 py-0.5 rounded text-xs border transition-all cursor-pointer flex items-center gap-1"
                  :class="(!component.style.fill || component.style.fill === 'transparent') ? 'border-cyan-400 bg-cyan-950 text-cyan-200 font-medium shadow-[0_0_8px_rgba(0,242,255,0.3)]' : 'border-cyan-500/30 bg-[#050c1c] text-cyan-400/70 hover:border-cyan-400 hover:text-cyan-200'"
                >
                  <span class="w-1.5 h-1.5 rounded-full border border-dashed border-cyan-400"></span>
                  <span>透明色</span>
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
                  <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-cyan-400/80 font-mono bg-[#050c1c]">
                    透明
                  </div>
                  <input
                    type="color"
                    :value="component.style.fill && component.style.fill !== 'transparent' ? component.style.fill : '#050c1c'"
                    @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value, backgroundColor: ($event.target as HTMLInputElement).value })"
                    class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
                <input
                  type="text"
                  :value="component.style.fill || 'transparent'"
                  @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value, backgroundColor: ($event.target as HTMLInputElement).value })"
                  class="flex-1 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-cyan-100 font-mono text-xs outline-hidden"
                />
              </div>
            </div>

            <!-- 图表渲染特性开关 -->
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-cyan-500/20">
              <label class="flex items-center justify-between p-2 rounded-lg bg-[#050c1c] border border-cyan-500/30 cursor-pointer">
                <span class="text-xs font-light text-cyan-200">平滑曲线</span>
                <input
                  type="checkbox"
                  :checked="component.customProps?.smooth !== false"
                  @change="updateComponentCustomProps({ smooth: ($event.target as HTMLInputElement).checked })"
                  class="accent-cyan-400 rounded w-4 h-4 cursor-pointer"
                />
              </label>
              <label class="flex items-center justify-between p-2 rounded-lg bg-[#050c1c] border border-cyan-500/30 cursor-pointer">
                <span class="text-xs font-light text-cyan-200">渐变面积</span>
                <input
                  type="checkbox"
                  :checked="component.customProps?.areaFill !== false"
                  @change="updateComponentCustomProps({ areaFill: ($event.target as HTMLInputElement).checked })"
                  class="accent-cyan-400 rounded w-4 h-4 cursor-pointer"
                />
              </label>
              <label class="flex items-center justify-between p-2 rounded-lg bg-[#050c1c] border border-cyan-500/30 cursor-pointer">
                <span class="text-xs font-light text-cyan-200">数据点标签</span>
                <input
                  type="checkbox"
                  :checked="Boolean(component.customProps?.showDataLabels)"
                  @change="updateComponentCustomProps({ showDataLabels: ($event.target as HTMLInputElement).checked })"
                  class="accent-cyan-400 rounded w-4 h-4 cursor-pointer"
                />
              </label>
              <label class="flex items-center justify-between p-2 rounded-lg bg-[#050c1c] border border-cyan-500/30 cursor-pointer">
                <span class="text-xs font-light text-cyan-200">显示图例</span>
                <input
                  type="checkbox"
                  :checked="component.customProps?.showLegend !== false"
                  @change="updateComponentCustomProps({ showLegend: ($event.target as HTMLInputElement).checked })"
                  class="accent-cyan-400 rounded w-4 h-4 cursor-pointer"
                />
              </label>
            </div>

            <!-- 上下限预警参考标线 (MarkLine) -->
            <div class="pt-2 border-t border-cyan-500/20 space-y-2">
              <div class="text-xs font-light text-cyan-200">阈值预警标线 (MarkLine)</div>
              <!-- 上限 -->
              <div class="grid grid-cols-3 gap-2 items-center">
                <label class="flex items-center gap-1.5 text-xs text-rose-400 cursor-pointer col-span-1">
                  <input
                    type="checkbox"
                    :checked="Boolean(component.customProps?.enableUpperLimit)"
                    @change="updateComponentCustomProps({ enableUpperLimit: ($event.target as HTMLInputElement).checked })"
                    class="accent-rose-500 rounded"
                  />
                  <span>上限警戒</span>
                </label>
                <input
                  type="number"
                  placeholder="阈值(如:80)"
                  :value="component.customProps?.upperLimitValue ?? 80"
                  @input="updateComponentCustomProps({ upperLimitValue: Number(($event.target as HTMLInputElement).value) })"
                  class="bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded px-2 py-1 text-cyan-100 text-xs font-mono font-light outline-hidden col-span-1"
                />
                <input
                  type="text"
                  placeholder="标签(如:过载上限)"
                  :value="component.customProps?.upperLimitLabel || '上限预警'"
                  @input="updateComponentCustomProps({ upperLimitLabel: ($event.target as HTMLInputElement).value })"
                  class="bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded px-2 py-1 text-cyan-100 text-xs font-light outline-hidden col-span-1"
                />
              </div>

              <!-- 下限 -->
              <div class="grid grid-cols-3 gap-2 items-center">
                <label class="flex items-center gap-1.5 text-xs text-amber-400 cursor-pointer col-span-1">
                  <input
                    type="checkbox"
                    :checked="Boolean(component.customProps?.enableLowerLimit)"
                    @change="updateComponentCustomProps({ enableLowerLimit: ($event.target as HTMLInputElement).checked })"
                    class="accent-amber-500 rounded"
                  />
                  <span>下限警戒</span>
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

          <!-- 9. 通用后备组件基础样式 (Fallback for any other primitive) -->
          <div v-else class="p-3 rounded-xl bg-[#050e1f] border border-cyan-500/40 space-y-3 shadow-sm">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-300">
              <div class="flex items-center gap-1.5">
                <Palette class="w-4 h-4 text-cyan-400" />
                <span class="font-normal text-cyan-200">基础外观样式</span>
              </div>
            </div>

            <!-- 背景底色填充 (带透明色选项) -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-light text-cyan-200">背景填充颜色</label>
                <button
                  type="button"
                  @click="updateComponentStyle({ fill: 'transparent' })"
                  class="px-2 py-0.5 rounded text-xs border transition-all cursor-pointer flex items-center gap-1"
                  :class="(!component.style.fill || component.style.fill === 'transparent') ? 'border-cyan-400 bg-cyan-950 text-cyan-200 font-medium shadow-[0_0_8px_rgba(0,242,255,0.3)]' : 'border-cyan-500/30 bg-[#050c1c] text-cyan-400/70 hover:border-cyan-400 hover:text-cyan-200'"
                >
                  <span class="w-1.5 h-1.5 rounded-full border border-dashed border-cyan-400"></span>
                  <span>透明色</span>
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
                  <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-cyan-400/80 font-mono bg-[#050c1c]">
                    透明
                  </div>
                  <input
                    type="color"
                    :value="component.style.fill && component.style.fill !== 'transparent' ? component.style.fill : '#00f2ff'"
                    @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value })"
                    class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
                <input
                  type="text"
                  :value="component.style.fill || 'transparent'"
                  @input="updateComponentStyle({ fill: ($event.target as HTMLInputElement).value })"
                  class="flex-1 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-cyan-100 font-mono text-xs outline-hidden"
                />
              </div>
            </div>

            <!-- 边框颜色与粗细 -->
            <div class="space-y-1.5 pt-2 border-t border-cyan-500/20">
              <div class="flex items-center justify-between">
                <label class="text-xs font-light text-cyan-200">边框描边与粗细</label>
                <button
                  type="button"
                  @click="updateComponentStyle({ stroke: 'transparent', strokeWidth: 0 })"
                  class="px-2 py-0.5 rounded text-[11px] border transition-colors cursor-pointer"
                  :class="(!component.style.stroke || component.style.stroke === 'transparent' || component.style.strokeWidth === 0) ? 'border-cyan-400 text-cyan-200 bg-cyan-950 font-medium' : 'border-cyan-500/30 bg-[#050c1c] text-cyan-400/70 hover:border-cyan-400'"
                >
                  无边框
                </button>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="flex items-center gap-2">
                  <label 
                    class="relative flex items-center justify-center w-8 h-8 rounded-md border border-cyan-500/40 hover:border-cyan-400 bg-[#050c1c] cursor-pointer overflow-hidden shrink-0 shadow-md transition-colors"
                    title="点击选取边框颜色"
                  >
                    <div 
                      v-if="component.style.stroke && component.style.stroke !== 'transparent'"
                      class="w-full h-full"
                      :style="{ backgroundColor: component.style.stroke }"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-cyan-400/60 font-mono bg-[#050c1c]">
                      无
                    </div>
                    <input
                      type="color"
                      :value="component.style.stroke && component.style.stroke !== 'transparent' ? component.style.stroke : '#00f2ff'"
                      @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value, strokeWidth: component.style.strokeWidth || 1 })"
                      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <input
                    type="text"
                    :value="component.style.stroke || 'transparent'"
                    @input="updateComponentStyle({ stroke: ($event.target as HTMLInputElement).value })"
                    class="flex-1 min-w-0 bg-[#050c1c] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-2 py-1 text-cyan-200 font-mono font-light text-xs outline-hidden"
                  />
                </div>
                <div class="flex items-center gap-1.5">
                  <button
                    v-for="w in [1, 2, 3, 4]"
                    :key="w"
                    type="button"
                    @click="updateComponentStyle({ strokeWidth: w, stroke: component.style.stroke && component.style.stroke !== 'transparent' ? component.style.stroke : '#00f2ff' })"
                    class="flex-1 py-1 text-xs text-center rounded border transition-colors cursor-pointer"
                    :class="component.style.strokeWidth === w ? 'bg-cyan-500 text-slate-950 font-medium border-cyan-400' : 'bg-[#050c1c] text-cyan-300 border-cyan-500/30 hover:border-cyan-400'"
                  >
                    {{ w }}px
                  </button>
                </div>
              </div>
            </div>

            <!-- 不透明度 -->
            <div class="pt-2 border-t border-cyan-500/20">
              <label class="text-xs font-light text-cyan-200 block mb-1">
                不透明度 ({{ Math.round((component.style.opacity ?? 1) * 100) }}%)
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                :value="component.style.opacity ?? 1"
                @input="updateComponentStyle({ opacity: Number(($event.target as HTMLInputElement).value) })"
                class="w-full accent-cyan-400"
              />
            </div>
          </div>
        </div>

        <!-- TAB 3: INTERACTION & SCREEN NAVIGATION -->
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
