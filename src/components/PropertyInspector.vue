<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  Settings2,
  Zap,
  RotateCcw,
  Save,
  X,
  ExternalLink,
  Layers,
  Lock,
  Unlock,
  Trash2,
  BookmarkPlus,
  Activity,
  Type,
  Square,
  Workflow,
  Sparkles,
  Database,
  ArrowRightLeft,
  Check
} from 'lucide-vue-next';
import { ScreenComponent, ScreenConfig, DatasetItem, ScreenItem } from '../types';

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

// =========================================================================
// 1. 事务提交控制机制 (Draft-Commit 机制)
// =========================================================================
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
      // Ensure nested objects exist to avoid undefined errors
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

// =========================================================================
// 2. 元件类型特化分类识别
// =========================================================================
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

const isIndicator = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  return t.includes('indicator') || t.includes('light') || t.includes('status') || t.includes('lamp');
});

const isTransformer = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  return t.includes('transformer') || t.includes('trans') || t.includes('xfmr');
});

const isLineOrBusbar = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  return (
    t.includes('line') ||
    t.includes('polyline') ||
    t.includes('bus') ||
    t.includes('busbar') ||
    t.includes('wire') ||
    t.includes('feeder')
  );
});

const isControlButton = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  return t.includes('button') || t.includes('btn') || t.includes('control');
});

const isTextLabel = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  const c = (draftComponent.value.category || '').toLowerCase();
  return t.includes('text') || t === 'label' || t.includes('sign') || t === 'draw-text' || c === 'text';
});

const isBasicGeometry = computed(() => {
  if (!draftComponent.value) return false;
  const t = (draftComponent.value.type || '').toLowerCase();
  return (
    t.includes('rect') ||
    t.includes('circle') ||
    t.includes('ellipse') ||
    t.includes('polygon') ||
    t.includes('triangle') ||
    t.includes('diamond')
  );
});

// Live sync changes immediately so user sees them on canvas in real-time
const handleLiveSync = () => {
  if (!draftComponent.value) return;
  const compToSubmit = cloneComponent(draftComponent.value);
  if (!compToSubmit) return;
  emit('update:component', compToSubmit);
};

// Two-way sync for text label content across style, customProps, and name
const textLabelContent = computed({
  get: () => {
    if (!draftComponent.value) return '';
    return (
      draftComponent.value.style?.text ??
      draftComponent.value.customProps?.text ??
      draftComponent.value.customProps?.title ??
      draftComponent.value.name ??
      ''
    );
  },
  set: (val: string) => {
    if (!draftComponent.value) return;
    if (!draftComponent.value.style) draftComponent.value.style = {};
    if (!draftComponent.value.customProps) draftComponent.value.customProps = {};
    draftComponent.value.style.text = val;
    draftComponent.value.customProps.text = val;
    draftComponent.value.customProps.title = val;
    draftComponent.value.name = val.split('\n')[0] || '文本标签';
    handleLiveSync();
  }
});

// Handle Switch / Breaker State Simulation in Draft
const setBreakerSimulationState = (state: number) => {
  if (!draftComponent.value) return;
  if (!draftComponent.value.customProps) draftComponent.value.customProps = {};
  draftComponent.value.customProps.state = state;
  draftComponent.value.customProps.switchState = state;
  if (!draftComponent.value.data) draftComponent.value.data = { mapping: {} };
  draftComponent.value.data.value = state;
};
</script>

<template>
  <aside 
    class="w-80 xl:w-88 shrink-0 bg-[#0c1427] border-l border-[#1e293b] flex flex-col h-full text-slate-200 select-none z-30 shadow-2xl relative font-sans text-xs tracking-wide"
    style="contain: layout style;"
  >
    <!-- ========================================================================= -->
    <!-- 1. 属性检查器顶栏 (工业深蓝黑主题，标题与草稿状态标识) -->
    <!-- ========================================================================= -->
    <div class="h-12 px-3.5 bg-[#080d1a] border-b border-[#1e293b] flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <Settings2 class="w-4.5 h-4.5 text-sky-400 shrink-0" />
        <div class="flex flex-col min-w-0">
          <span class="text-[13px] font-bold text-white tracking-wide truncate">
            设备属性检查器
          </span>
          <span class="text-[10px] text-slate-400 font-mono truncate">
            {{ selectedComponents.length > 1 ? `已多选 ${selectedComponents.length} 项图元` : (draftComponent?.name || '未选定图元') }}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-1.5">
        <!-- 未保存更改警告标牌 -->
        <span 
          v-if="isDirty"
          class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-600/60 animate-pulse"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          草稿未保存
        </span>
        <button
          @click="emit('close')"
          class="w-6.5 h-6.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          title="关闭属性面板"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 2. 主属性展示区 (纯特化隔离，移出通用线宽/填充/四遥点号配置) -->
    <!-- ========================================================================= -->
    <div class="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 custom-scrollbar pb-24">
      <!-- 多选模式处理 -->
      <div v-if="selectedComponents.length > 1" class="space-y-3">
        <div class="p-3 bg-[#131f38] border border-sky-500/30 rounded-lg text-slate-300">
          <div class="flex items-center gap-2 text-sky-400 font-bold mb-1.5 text-xs">
            <Layers class="w-4 h-4" />
            <span>多图元批量管理模式</span>
          </div>
          <p class="text-[11px] text-slate-400 leading-relaxed mb-3">
            已框选 <span class="text-white font-bold font-mono">{{ selectedComponents.length }}</span> 个图元。
            常规绘图样式（线条颜色、底色填充、线宽虚实、字号等）在<strong class="text-sky-300 font-bold">【顶栏动态属性工具条】</strong>中修改，可一键批量同步。
          </p>
          <div class="grid grid-cols-2 gap-2 text-[11px]">
            <button
              @click="emit('group')"
              class="px-2.5 py-1.5 rounded bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 flex items-center justify-center gap-1.5 cursor-pointer font-medium"
            >
              <BookmarkPlus class="w-3.5 h-3.5" />
              <span>成组为图元</span>
            </button>
            <button
              @click="emit('delete', selectedComponents.map(c => c.id))"
              class="px-2.5 py-1.5 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 flex items-center justify-center gap-1.5 cursor-pointer font-medium"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>批量删除</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 单选模式：特化卡片字典 -->
      <template v-else-if="draftComponent">
        <!-- 通用标识头部 (名称、间隔、锁定与只读关联状态) -->
        <div class="p-2.5 bg-[#101b31] border border-[#1e293b] rounded-lg space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-400">元件基础标识</span>
            <span class="text-[10px] font-mono text-slate-500">ID: {{ draftComponent.id }}</span>
          </div>

          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">图元名称</label>
            <input
              v-model="draftComponent.name"
              @input="handleLiveSync"
              type="text"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-sky-400 font-medium"
              placeholder="请输入设备或标牌名称"
            />
          </div>

          <!-- 几何坐标与尺寸布局 (X, Y, W, H, 旋转) -->
          <div class="grid grid-cols-2 gap-2 pt-1 border-t border-[#1e293b]">
            <div class="space-y-0.5">
              <span class="text-[10px] text-slate-400">位置 (X, Y)</span>
              <div class="flex items-center gap-1">
                <input
                  v-model.number="draftComponent.x"
                  @input="handleLiveSync"
                  type="number"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-1.5 py-0.5 text-xs text-white font-mono"
                />
                <input
                  v-model.number="draftComponent.y"
                  @input="handleLiveSync"
                  type="number"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-1.5 py-0.5 text-xs text-white font-mono"
                />
              </div>
            </div>
            <div class="space-y-0.5">
              <span class="text-[10px] text-slate-400">尺寸 (宽 × 高)</span>
              <div class="flex items-center gap-1">
                <input
                  v-model.number="draftComponent.width"
                  @input="handleLiveSync"
                  type="number"
                  min="4"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-1.5 py-0.5 text-xs text-white font-mono"
                />
                <input
                  v-model.number="draftComponent.height"
                  @input="handleLiveSync"
                  type="number"
                  min="4"
                  class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-1.5 py-0.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-1 text-[11px]">
            <div class="flex items-center gap-2">
              <span class="text-slate-400">旋转:</span>
              <select
                v-model.number="draftComponent.rotation"
                @change="handleLiveSync"
                class="bg-[#080d1a] border border-[#2b3a55] rounded px-1.5 py-0.5 text-xs text-white font-mono"
              >
                <option :value="0">0°</option>
                <option :value="90">90°</option>
                <option :value="180">180°</option>
                <option :value="270">270°</option>
              </select>
            </div>
            <label class="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white">
              <input 
                type="checkbox" 
                v-model="draftComponent.locked" 
                class="rounded border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
              />
              <span class="flex items-center gap-1">
                <Lock v-if="draftComponent.locked" class="w-3.5 h-3.5 text-amber-400" />
                <Unlock v-else class="w-3.5 h-3.5" />
                锁定图元
              </span>
            </label>
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- 特化卡片 1: 高压断路器 / 隔离开关 / 地刀 / 手车           -->
        <!-- ======================================================== -->
        <div v-if="isBreakerOrSwitch" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-lg space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-sky-400 font-bold text-xs">
              <Zap class="w-4 h-4 text-amber-400" />
              <span>高压开关间隔与仿真测试</span>
            </div>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800">
              开关电气特性
            </span>
          </div>

          <!-- 电压等级 -->
          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">设备额定电压等级</label>
            <select
              v-model="draftComponent.customProps.voltageLevel"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer"
            >
              <option value="10kV">10kV (常规配电)</option>
              <option value="35kV">35kV (中压输配电)</option>
              <option value="110kV">110kV (高压主网)</option>
              <option value="220kV">220kV (超高压变电站)</option>
              <option value="500kV">500kV (特高压主网)</option>
            </select>
          </div>

          <!-- 遥控就地闭锁控制标志 -->
          <div class="p-2 bg-[#080d1a] rounded border border-[#2b3a55] flex items-center justify-between">
            <span class="text-[11px] text-slate-300">就地/后台防误闭锁保护</span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                v-model="draftComponent.customProps.interlockBlocked" 
                class="sr-only peer"
              />
              <div class="w-8 h-4 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          <!-- 合分闸双态仿真切换测试 (0分/1合/2不一致) -->
          <div class="space-y-1.5 pt-1 border-t border-[#1e293b]">
            <label class="text-[11px] text-slate-400 font-medium">动作仿真调试测试</label>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                @click="setBreakerSimulationState(0)"
                class="py-1 rounded font-bold transition-colors cursor-pointer border text-center text-xs"
                :class="draftComponent.customProps?.state === 0 
                  ? 'bg-emerald-600 text-white border-emerald-400' 
                  : 'bg-[#080d1a] text-emerald-400 border-emerald-900/60 hover:bg-emerald-950/40'"
              >
                分闸 (0)
              </button>
              <button
                type="button"
                @click="setBreakerSimulationState(1)"
                class="py-1 rounded font-bold transition-colors cursor-pointer border text-center text-xs"
                :class="draftComponent.customProps?.state === 1 
                  ? 'bg-rose-600 text-white border-rose-400' 
                  : 'bg-[#080d1a] text-rose-400 border-rose-900/60 hover:bg-rose-950/40'"
              >
                合闸 (1)
              </button>
              <button
                type="button"
                @click="setBreakerSimulationState(2)"
                class="py-1 rounded font-bold transition-colors cursor-pointer border text-center text-xs"
                :class="draftComponent.customProps?.state === 2 
                  ? 'bg-amber-600 text-white border-amber-400' 
                  : 'bg-[#080d1a] text-amber-400 border-amber-900/60 hover:bg-amber-950/40'"
              >
                异常 (2)
              </button>
            </div>
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- 特化卡片 2: 遥测数字牌 (FloatMetric)                      -->
        <!-- ======================================================== -->
        <div v-else-if="isTelemetry" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-lg space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-sky-400 font-bold text-xs">
              <Activity class="w-4 h-4 text-sky-400" />
              <span>遥测数字牌特化 (FloatMetric)</span>
            </div>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800">
              数字牌格式
            </span>
          </div>

          <!-- 前缀标签与静态数值 -->
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[11px] text-slate-400 font-medium">前缀标签</label>
              <input
                v-model="draftComponent.customProps.prefix"
                type="text"
                class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white font-mono focus:outline-hidden focus:border-sky-400"
                placeholder="例如: Ia=, P="
              />
            </div>
            <div class="space-y-1">
              <label class="text-[11px] text-slate-400 font-medium">静态测试数值</label>
              <input
                v-model.number="draftComponent.data.value"
                type="number"
                step="0.01"
                class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white font-mono focus:outline-hidden focus:border-sky-400"
                placeholder="例如: 10.52"
              />
            </div>
          </div>

          <!-- 小数点截断位数 (0~4位，不进位) & 自动剔除尾部零开关 -->
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[11px] text-slate-400 font-medium">截断保留位数 (不进位)</label>
              <select
                v-model.number="draftComponent.style.decimals"
                class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white focus:outline-hidden focus:border-sky-400 font-mono cursor-pointer"
              >
                <option :value="0">0位 (整数)</option>
                <option :value="1">1位小数</option>
                <option :value="2">2位小数 (标准)</option>
                <option :value="3">3位小数</option>
                <option :value="4">4位小数</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[11px] text-slate-400 font-medium">剔除尾部无效零</label>
              <div class="h-7 flex items-center">
                <label class="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    v-model="draftComponent.style.trimZeros"
                    class="rounded border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <span>自动剔除 0</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- 特化卡片 3: 状态指示灯 (StatusIndicator)                  -->
        <!-- ======================================================== -->
        <div v-else-if="isIndicator" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-lg space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-sky-400 font-bold text-xs">
              <Zap class="w-4 h-4 text-emerald-400" />
              <span>状态指示灯特化</span>
            </div>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800">
              Indicator
            </span>
          </div>

          <!-- 闪烁工作模式 -->
          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">发光工作模式</label>
            <select
              v-model="draftComponent.customProps.blinkMode"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer"
            >
              <option value="none">常亮模式 (无闪烁)</option>
              <option value="fault">告警异常时闪烁</option>
              <option value="change">变位时闪烁</option>
              <option value="breathe">柔和呼吸灯动效</option>
            </select>
          </div>

          <!-- 模拟状态测试 -->
          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">当前模拟测试状态</label>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                @click="draftComponent.data.value = 0"
                class="py-1 rounded border text-center transition-colors cursor-pointer text-xs font-medium"
                :class="draftComponent.data.value === 0 ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-[#080d1a] text-emerald-400 border-emerald-900'"
              >
                分闸 / 绿色
              </button>
              <button
                type="button"
                @click="draftComponent.data.value = 1"
                class="py-1 rounded border text-center transition-colors cursor-pointer text-xs font-medium"
                :class="draftComponent.data.value === 1 ? 'bg-rose-600 text-white border-rose-400' : 'bg-[#080d1a] text-rose-400 border-rose-900'"
              >
                合闸 / 红色
              </button>
              <button
                type="button"
                @click="draftComponent.data.value = 2"
                class="py-1 rounded border text-center transition-colors cursor-pointer text-xs font-medium"
                :class="draftComponent.data.value === 2 ? 'bg-amber-600 text-white border-amber-400' : 'bg-[#080d1a] text-amber-400 border-amber-900'"
              >
                告警 / 黄色
              </button>
            </div>
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- 特化卡片 4: 高压主变压器 (Transformer)                    -->
        <!-- ======================================================== -->
        <div v-else-if="isTransformer" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-lg space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-sky-400 font-bold text-xs">
              <Zap class="w-4 h-4 text-indigo-400" />
              <span>主变压器设备电气参数</span>
            </div>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800">
              主变本体
            </span>
          </div>

          <!-- 额定容量 -->
          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">主变额定容量 (MVA)</label>
            <input
              v-model="draftComponent.customProps.ratedCapacity"
              type="text"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white font-mono focus:outline-hidden focus:border-sky-400"
              placeholder="例如: 50MVA, 180MVA, 240MVA"
            />
          </div>

          <!-- 绕组接线型式 -->
          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">绕组接线组别型式</label>
            <select
              v-model="draftComponent.customProps.windingType"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white font-mono focus:outline-hidden focus:border-sky-400 cursor-pointer"
            >
              <option value="Y/△-11">双绕组 Y/△-11 (常规)</option>
              <option value="Yn/△-11">双绕组 Yn/△-11 (中性点接地)</option>
              <option value="YN/yn0/d11">三绕组 YN/yn0/d11 (大型主变)</option>
              <option value="Y/Y">双绕组 Y/Y</option>
            </select>
          </div>

          <!-- 调压抽头档位 -->
          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">当前运行分接头档位 (Tap)</label>
            <input
              v-model.number="draftComponent.customProps.currentTap"
              type="number"
              min="1"
              max="27"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white font-mono focus:outline-hidden focus:border-sky-400"
              placeholder="例如: 9 (范围1~19)"
            />
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- 特化卡片 5: 走线 / 母线 (Line / Polyline / Busbar)        -->
        <!-- ======================================================== -->
        <div v-else-if="isLineOrBusbar" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-lg space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-sky-400 font-bold text-xs">
              <Workflow class="w-4 h-4 text-cyan-400" />
              <span>母线走线与潮流流光特化</span>
            </div>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800">
              Bus / Line
            </span>
          </div>

          <!-- 所属母线编号 -->
          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">母线段编号标识</label>
            <input
              v-model="draftComponent.customProps.busbarCode"
              type="text"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white focus:outline-hidden focus:border-sky-400"
              placeholder="例如: 10kV Ⅰ段母线 / 220kV 旁路母线"
            />
          </div>

          <!-- 走线转角模式 -->
          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">走线转角正交模式</label>
            <select
              v-model="draftComponent.customProps.cornerMode"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer"
            >
              <option value="direct">直接折线连接 (自由拐点)</option>
              <option value="ortho-h">水平优先正交拐弯</option>
              <option value="ortho-v">垂直优先正交拐弯</option>
            </select>
          </div>

          <!-- 动态潮流流光动效 -->
          <div class="p-2.5 bg-[#080d1a] rounded border border-[#2b3a55] space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-slate-300">开启动态潮流流光动画</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  v-model="draftComponent.customProps.flowAnimation" 
                  class="sr-only peer"
                />
                <div class="w-8 h-4 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>
            <div v-if="draftComponent.customProps.flowAnimation" class="flex items-center justify-between pt-1 border-t border-[#1e293b]">
              <span class="text-[10px] text-slate-400">潮流方向:</span>
              <div class="flex items-center gap-2">
                <label class="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                  <input type="radio" value="forward" v-model="draftComponent.customProps.flowDirection" />
                  <span>正向</span>
                </label>
                <label class="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                  <input type="radio" value="reverse" v-model="draftComponent.customProps.flowDirection" />
                  <span>反向</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- 特化卡片 6: 交互控制按钮 (ControlButton)                  -->
        <!-- ======================================================== -->
        <div v-else-if="isControlButton" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-lg space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-sky-400 font-bold text-xs">
              <Square class="w-4 h-4 text-purple-400" />
              <span>控制与画面切换按钮特化</span>
            </div>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800">
              Button
            </span>
          </div>

          <!-- 按钮显示文本 -->
          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">按钮标题文字</label>
            <input
              v-model="draftComponent.customProps.label"
              type="text"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white focus:outline-hidden focus:border-sky-400 font-medium"
              placeholder="例如: 调阅10kV接线图 / 断路器分闸"
            />
          </div>

          <!-- 按钮业务类型 -->
          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">按钮业务类型</label>
            <select
              v-model="draftComponent.customProps.actionType"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer"
            >
              <option value="switch-screen">画面快速切换 (跳转目标大屏)</option>
              <option value="open-control">调阅开关遥控操作面板</option>
              <option value="open-modal">弹出告警/历史弹窗</option>
            </select>
          </div>

          <!-- 双人复核口令 -->
          <div class="p-2 bg-[#080d1a] rounded border border-[#2b3a55] flex items-center justify-between">
            <span class="text-[11px] text-slate-300">防误双人复核口令验证</span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                v-model="draftComponent.customProps.requireDoubleCheck" 
                class="sr-only peer"
              />
              <div class="w-8 h-4 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- 特化卡片 7: 静态文本 / 标牌 (DrawText)                    -->
        <!-- ======================================================== -->
        <div v-else-if="isTextLabel" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-lg space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-sky-400 font-bold text-xs">
              <Type class="w-4 h-4 text-emerald-400" />
              <span>标牌与工业文本特化</span>
            </div>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800">
              Text
            </span>
          </div>

          <!-- 标牌文本内容 -->
          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">标牌显示内容 (支持换行)</label>
            <textarea
              v-model="textLabelContent"
              rows="3"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded p-2 text-xs text-white focus:outline-hidden focus:border-sky-400 font-mono leading-relaxed resize-y"
              placeholder="请输入标牌文字..."
            ></textarea>
          </div>

          <!-- 文字颜色与字号 -->
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[11px] text-slate-400 font-medium">文字颜色</label>
              <div class="flex items-center gap-1.5 bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1">
                <input
                  type="color"
                  :value="draftComponent.style.textColor || draftComponent.style.color || '#00f2ff'"
                  @input="draftComponent.style.textColor = ($event.target as HTMLInputElement).value; draftComponent.style.color = ($event.target as HTMLInputElement).value; handleLiveSync();"
                  class="w-5 h-5 rounded cursor-pointer border border-[#1e293b] p-0 bg-transparent shrink-0"
                />
                <input
                  type="text"
                  :value="draftComponent.style.textColor || draftComponent.style.color || '#00f2ff'"
                  @input="draftComponent.style.textColor = ($event.target as HTMLInputElement).value; draftComponent.style.color = ($event.target as HTMLInputElement).value; handleLiveSync();"
                  class="w-full bg-transparent text-xs text-white font-mono focus:outline-hidden"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-[11px] text-slate-400 font-medium">文字字号 (px)</label>
              <input
                v-model.number="draftComponent.style.fontSize"
                @input="handleLiveSync"
                type="number"
                min="8"
                max="120"
                class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white font-mono focus:outline-hidden focus:border-sky-400"
                placeholder="例如: 14"
              />
            </div>
          </div>

          <!-- 对齐方式与粗细 -->
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[11px] text-slate-400 font-medium">对齐方式</label>
              <select
                v-model="draftComponent.style.textAlign"
                @change="handleLiveSync"
                class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer"
              >
                <option value="left">靠左对齐</option>
                <option value="center">居中对齐</option>
                <option value="right">靠右对齐</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[11px] text-slate-400 font-medium">粗细</label>
              <select
                v-model="draftComponent.style.fontWeight"
                @change="handleLiveSync"
                class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer"
              >
                <option value="normal">常规</option>
                <option value="bold">加粗</option>
              </select>
            </div>
          </div>

          <!-- 工业字体系列 -->
          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">工业字体系列</label>
            <select
              v-model="draftComponent.style.fontFamily"
              @change="handleLiveSync"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer font-mono"
            >
              <option value="'JetBrains Mono', monospace">等宽工控字体 (JetBrains Mono)</option>
              <option value="system-ui, sans-serif">标准无衬线黑体 (System Sans)</option>
              <option value="'Digital-7', monospace">七段数码液晶字体 (Digital LED)</option>
              <option value="SimSun, serif">标准宋体 (SongTi)</option>
            </select>
          </div>

          <!-- 荧光文字发光动效 -->
          <div class="p-2 bg-[#080d1a] rounded border border-[#2b3a55] flex items-center justify-between">
            <span class="text-[11px] text-slate-300">荧光发光文字特效 (Glow)</span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                v-model="draftComponent.customProps.textGlow" 
                @change="
                  if (!draftComponent.style) draftComponent.style = {};
                  draftComponent.style.glow = draftComponent.customProps.textGlow;
                  handleLiveSync();
                "
                class="sr-only peer"
              />
              <div class="w-8 h-4 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- 特化卡片 8: 基础几何图元 (Rectangle / Circle / Polygon)   -->
        <!-- ======================================================== -->
        <div v-else-if="isBasicGeometry" class="p-3 bg-[#101b31] border border-[#1e293b] rounded-lg space-y-3">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#1e293b]">
            <div class="flex items-center gap-1.5 text-sky-400 font-bold text-xs">
              <Square class="w-4 h-4 text-sky-400" />
              <span>几何外框特化属性</span>
            </div>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800">
              Geometry
            </span>
          </div>

          <div class="space-y-1" v-if="draftComponent.type.includes('rect')">
            <label class="text-[11px] text-slate-400 font-medium">圆角半径 (px)</label>
            <input
              v-model.number="draftComponent.style.borderRadius"
              type="number"
              min="0"
              max="100"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white font-mono focus:outline-hidden focus:border-sky-400"
              placeholder="0 (直角)"
            />
          </div>

          <div class="space-y-1">
            <label class="text-[11px] text-slate-400 font-medium">填充不透明度 (0 ~ 1.0)</label>
            <input
              v-model.number="draftComponent.style.fillOpacity"
              type="number"
              step="0.05"
              min="0"
              max="1"
              class="w-full bg-[#080d1a] border border-[#2b3a55] rounded px-2 py-1 text-xs text-white font-mono focus:outline-hidden focus:border-sky-400"
              placeholder="默认 1.0"
            />
          </div>
        </div>
      </template>

      <!-- 空白未选提示 -->
      <div v-else class="text-center py-16 text-slate-500 space-y-2">
        <Settings2 class="w-8 h-8 mx-auto opacity-30" />
        <p class="text-xs">请在左侧或画布上选定图元</p>
        <p class="text-[11px] text-slate-600">点击画布上的任何设备或标牌，在此处进行属性管理</p>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 3. 严格事务控制底栏 (Draft-Commit: 取消 / 应用 保存)                    -->
    <!-- ========================================================================= -->
    <div 
      v-if="draftComponent"
      class="h-14 px-3.5 bg-[#080d1a] border-t border-[#1e293b] flex items-center justify-between shrink-0 absolute bottom-0 left-0 right-0 z-40"
    >
      <!-- 重置 / 回退按钮 -->
      <button
        @click="handleCancel"
        :disabled="!isDirty"
        class="px-3 py-1.5 rounded text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        :class="isDirty ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-[#0c1427] text-slate-600 border-[#1e293b]'"
        title="放弃当前未保存的修改，回退至原始状态"
      >
        <RotateCcw class="w-3.5 h-3.5" />
        <span>取消</span>
      </button>

      <!-- 提交 / 应用按钮 -->
      <div class="flex items-center gap-2">
        <span v-if="showSaveToast" class="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
          <Check class="w-3.5 h-3.5" />
          <span>已成功应用</span>
        </span>

        <button
          @click="handleApply"
          :disabled="!isDirty"
          class="px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          :class="isDirty 
            ? 'bg-sky-600 hover:bg-sky-500 text-white border border-sky-400 shadow-sky-900/40 animate-pulse' 
            : 'bg-slate-800 text-slate-400 border border-slate-700'"
          title="将草稿正式写入画布并记录撤销历史 (快捷键: Ctrl+S)"
        >
          <Save class="w-4 h-4" />
          <span>应用保存</span>
          <span class="text-[10px] font-mono text-sky-200 opacity-80">(Ctrl+S)</span>
        </button>
      </div>
    </div>
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
