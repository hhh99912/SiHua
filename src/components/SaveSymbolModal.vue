<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { ScreenComponent, CustomSymbolDef, CustomSymbolStateDef } from '../types';
import { 
  getCustomSymbols, 
  saveCustomSymbols, 
  addCustomSymbol, 
  normalizeSymbolZeroMargin, 
  refreshCustomSymbolsFromDisk 
} from '../utils/customSymbolStorage';
import { saveCellToDisk } from '../utils/cellFileService';
import WidgetRenderer from './widgets/WidgetRenderer.vue';
import { 
  BookmarkPlus, Plus, Check, X, Tag, Sparkles, Layers,
  Zap, Activity, ShieldAlert, Cpu, RefreshCw, FolderDown
} from 'lucide-vue-next';

interface Props {
  visible: boolean;
  selectedComponents: ScreenComponent[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', symbol: CustomSymbolDef): void;
}>();

const mode = ref<'new' | 'update_state'>('new');
const existingSymbols = ref<CustomSymbolDef[]>([]);
const selectedExistingSymbolId = ref<string>('');
const isLoadingSymbols = ref(false);

// New Symbol Form
const symbolName = ref('新自定义组装图元');
const symbolCategory = ref<'electrical'>('electrical');
const symbolDescription = ref('由主界面多选图元组合封装而成的多态 SCADA 图元');
const tagsInput = ref('电力, 开关柜, 自定义图元');
const stateId = ref('1');
const stateName = ref('状态 1 (正常运行 / 合闸)');

// Calculate bounding box and normalized children
const normalizedChildren = computed<ScreenComponent[]>(() => {
  if (props.selectedComponents.length === 0) return [];
  const minX = Math.min(...props.selectedComponents.map(c => c.x));
  const minY = Math.min(...props.selectedComponents.map(c => c.y));
  
  return props.selectedComponents.map((c, index) => {
    return {
      ...JSON.parse(JSON.stringify(c)),
      x: c.x - minX,
      y: c.y - minY,
      zIndex: index + 1
    };
  });
});

const symbolWidth = computed(() => {
  if (props.selectedComponents.length === 0) return 200;
  const minX = Math.min(...props.selectedComponents.map(c => c.x));
  const maxX = Math.max(...props.selectedComponents.map(c => c.x + c.width));
  return Math.max(40, maxX - minX);
});

const symbolHeight = computed(() => {
  if (props.selectedComponents.length === 0) return 200;
  const minY = Math.min(...props.selectedComponents.map(c => c.y));
  const maxY = Math.max(...props.selectedComponents.map(c => c.y + c.height));
  return Math.max(40, maxY - minY);
});

const previewScale = computed(() => {
  const maxDim = Math.max(symbolWidth.value, symbolHeight.value);
  if (maxDim <= 0) return 1;
  return Math.min(1, 180 / maxDim);
});

// Currently selected target symbol for update_state
const currentTargetSymbol = computed<CustomSymbolDef | null>(() => {
  if (!selectedExistingSymbolId.value) return null;
  return existingSymbols.value.find(s => s.id === selectedExistingSymbolId.value) || null;
});

// Whether the current stateId is overwriting an existing state of the target symbol
const isOverwritingExistingState = computed(() => {
  if (!currentTargetSymbol.value?.states) return false;
  return currentTargetSymbol.value.states.some(s => String(s.id).trim() === String(stateId.value).trim());
});

// Select an existing state to overwrite
const selectStateToOverwrite = (st: CustomSymbolStateDef) => {
  stateId.value = String(st.id);
  stateName.value = st.name || `状态 ${st.id}`;
};

// Suggest a new state ID for the target symbol
const suggestNextNewState = () => {
  if (!currentTargetSymbol.value?.states || currentTargetSymbol.value.states.length === 0) {
    stateId.value = '1';
    stateName.value = '状态 1 (默认)';
    return;
  }
  const existingIds = currentTargetSymbol.value.states.map(s => String(s.id));
  let maxNum = 0;
  for (const id of existingIds) {
    const num = parseInt(id, 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }
  const nextNum = maxNum + 1;
  stateId.value = String(nextNum);
  const stateLabels: Record<number, string> = {
    0: '停运备用 / 初始态',
    1: '合闸 / 正常运行',
    2: '分闸 / 拉开停运',
    3: '事故 / 故障跳闸',
    4: '检修 / 接地隔离'
  };
  stateName.value = `状态 ${nextNum} (${stateLabels[nextNum] || '自定义扩展'})`;
};

// Switch mode tab
const switchMode = (m: 'new' | 'update_state') => {
  mode.value = m;
  if (m === 'update_state') {
    if (existingSymbols.value.length === 0) {
      loadExistingSymbols();
    } else if (currentTargetSymbol.value) {
      suggestNextNewState();
    }
  }
};

// Load existing symbols from local storage and disk
const loadExistingSymbols = async () => {
  isLoadingSymbols.value = true;
  // 1. 同步加载已有内存/本地缓存
  const cached = getCustomSymbols();
  if (cached.length > 0) {
    existingSymbols.value = cached;
    if (!selectedExistingSymbolId.value || !cached.some(s => s.id === selectedExistingSymbolId.value)) {
      selectedExistingSymbolId.value = cached[0].id;
    }
  }

  // 2. 异步向 cell/ 磁盘检索全部图元
  try {
    const diskList = await refreshCustomSymbolsFromDisk();
    if (Array.isArray(diskList) && diskList.length > 0) {
      existingSymbols.value = diskList;
      if (!selectedExistingSymbolId.value || !diskList.some(s => s.id === selectedExistingSymbolId.value)) {
        selectedExistingSymbolId.value = diskList[0].id;
      }
    }
  } catch (err) {
    console.warn('[SaveSymbolModal] 检索图元库失败:', err);
  } finally {
    isLoadingSymbols.value = false;
  }
};

const handleSymbolsUpdated = (e: any) => {
  if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0) {
    existingSymbols.value = e.detail;
    if (!selectedExistingSymbolId.value || !e.detail.some((s: any) => s.id === selectedExistingSymbolId.value)) {
      selectedExistingSymbolId.value = e.detail[0].id;
    }
  }
};

onMounted(() => {
  loadExistingSymbols();
  if (typeof window !== 'undefined') {
    window.addEventListener('scada:custom-symbols-updated', handleSymbolsUpdated);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scada:custom-symbols-updated', handleSymbolsUpdated);
  }
});

watch(() => props.visible, (val) => {
  if (val) {
    loadExistingSymbols();
    if (props.selectedComponents.length > 0) {
      symbolName.value = props.selectedComponents.length === 1 
        ? `${props.selectedComponents[0].name} (自定义)`
        : `组合图元 (${props.selectedComponents.length}个元件)`;
    }
  }
}, { immediate: true });

// When selected symbol changes in update_state mode, auto update suggested state
watch(selectedExistingSymbolId, (newId) => {
  if (mode.value === 'update_state' && newId) {
    suggestNextNewState();
  }
});

const handleSave = () => {
  if (props.selectedComponents.length === 0) return;

  const currentChildren = JSON.parse(JSON.stringify(normalizedChildren.value));

  if (mode.value === 'new') {
    if (!symbolName.value.trim()) {
      alert('请输入图元名称');
      return;
    }

    const state1: CustomSymbolStateDef = {
      id: stateId.value || '1',
      name: stateName.value || '状态 1 (默认)',
      children: currentChildren
    };

    const rawDef: CustomSymbolDef = {
      id: `symbol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: symbolName.value.trim(),
      category: symbolCategory.value,
      iconName: symbolCategory.value === 'electrical' ? 'Zap' : 'Activity',
      description: symbolDescription.value.trim(),
      defaultWidth: symbolWidth.value,
      defaultHeight: symbolHeight.value,
      type: 'composite-symbol',
      defaultStyle: {
        fill: 'transparent',
        stroke: '#00f2ff',
        strokeWidth: 1.5,
        borderRadius: 4
      },
      children: currentChildren,
      states: [state1],
      activeStateId: state1.id,
      tags: tagsInput.value.split(/[,，\s]+/).filter(Boolean),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 严格确保 0 边距规范化
    const newDef = normalizeSymbolZeroMargin(rawDef);

    addCustomSymbol(newDef);
    saveCellToDisk(newDef).catch(err => console.warn('保存到 cell 目录失败:', err));
    emit('saved', newDef);
    emit('close');
  } else {
    // Update existing symbol's state
    const targetSymbol = existingSymbols.value.find(s => s.id === selectedExistingSymbolId.value)
      || getCustomSymbols().find(s => s.id === selectedExistingSymbolId.value);

    if (!targetSymbol) {
      alert('请选择要更新的目标图元');
      return;
    }

    const states: CustomSymbolStateDef[] = targetSymbol.states ? [...targetSymbol.states] : [];
    
    // Check if state ID exists
    const existingStateIndex = states.findIndex(s => String(s.id).trim() === String(stateId.value).trim());
    const updatedState: CustomSymbolStateDef = {
      id: stateId.value || '1',
      name: stateName.value || `状态 ${stateId.value}`,
      children: currentChildren
    };

    if (existingStateIndex >= 0) {
      states[existingStateIndex] = updatedState;
    } else {
      states.push(updatedState);
    }

    const rawUpdatedSymbol: CustomSymbolDef = {
      ...targetSymbol,
      states,
      children: currentChildren, // Update default children as well
      updatedAt: new Date().toISOString()
    };

    const updatedSymbol = normalizeSymbolZeroMargin(rawUpdatedSymbol);
    addCustomSymbol(updatedSymbol);
    saveCellToDisk(updatedSymbol).catch(err => console.warn('保存到 cell 目录失败:', err));
    emit('saved', updatedSymbol);
    emit('close');
  }
};
</script>

<template>
  <div 
    v-if="visible" 
    class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none"
    @click.self="emit('close')"
  >
    <div class="bg-[#070d1a] border border-cyan-500/40 rounded-2xl w-full max-w-2xl shadow-[0_20px_70px_rgba(0,242,255,0.2)] overflow-hidden flex flex-col font-sans">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-cyan-500/20 bg-[#040813] flex items-center justify-between">
        <div class="flex items-center gap-2 text-cyan-300 font-mono font-bold text-sm">
          <BookmarkPlus class="w-5 h-5 text-emerald-400" />
          <span>封装为自定义图元 (支持多状态管理)</span>
        </div>
        <button 
          @click="emit('close')"
          class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Mode Switch Tabs -->
      <div class="px-5 pt-3 pb-0 flex items-center gap-2 border-b border-slate-800 bg-[#060a15]">
        <button
          @click="switchMode('new')"
          class="px-4 py-2 text-xs font-mono font-bold rounded-t-lg transition-all cursor-pointer border-t border-x"
          :class="mode === 'new' ? 'bg-[#070d1a] text-cyan-300 border-cyan-500/40 border-b-transparent -mb-[1px]' : 'text-slate-400 border-transparent hover:text-slate-200'"
        >
          ✨ 新建图元资产
        </button>
        <button
          @click="switchMode('update_state')"
          class="px-4 py-2 text-xs font-mono font-bold rounded-t-lg transition-all cursor-pointer border-t border-x"
          :class="mode === 'update_state' ? 'bg-[#070d1a] text-amber-300 border-amber-500/40 border-b-transparent -mb-[1px]' : 'text-slate-400 border-transparent hover:text-slate-200'"
        >
          ⚡ 存入已有图元的多状态 (如状态1/2/3)
        </button>
      </div>

      <!-- Main Body Form -->
      <div class="p-5 flex gap-5 overflow-y-auto max-h-[70vh]">
        <!-- Left Form Fields -->
        <div class="flex-1 space-y-3.5">
          <!-- New Symbol Fields -->
          <template v-if="mode === 'new'">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-mono text-slate-400 mb-1">图元名称 *</label>
                <input
                  v-model="symbolName"
                  type="text"
                  class="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono focus:border-cyan-400 focus:outline-hidden"
                  placeholder="例如: 10kV 进线断路器柜组合"
                />
              </div>

              <div>
                <label class="block text-[11px] font-mono text-slate-400 mb-1">标签 (自动归入电力一次系统)</label>
                <input
                  v-model="tagsInput"
                  type="text"
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-400 focus:outline-hidden"
                  placeholder="电力, 断路器"
                />
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-mono text-slate-400 mb-1">功能描述</label>
              <textarea
                v-model="symbolDescription"
                rows="2"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-400 focus:outline-hidden resize-none"
                placeholder="描述图元的用途与构成"
              />
            </div>
          </template>

          <!-- Update Existing Symbol State Fields -->
          <template v-else>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="block text-[11px] font-mono text-amber-300 font-bold">
                  选择要追加/更新状态的目标图元 *
                </label>
                <div class="flex items-center gap-2">
                  <span v-if="isLoadingSymbols" class="text-[10px] text-amber-400 flex items-center gap-1 font-mono">
                    <RefreshCw class="w-3 h-3 animate-spin" />
                    <span>同步 cell 目录中...</span>
                  </span>
                  <span v-else class="text-[10px] text-slate-400 font-mono">
                    共 {{ existingSymbols.length }} 个可用图元
                  </span>
                  <button
                    type="button"
                    @click="loadExistingSymbols"
                    title="重新从 cell/ 目录扫描图元"
                    class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700 cursor-pointer transition-colors"
                  >
                    <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isLoadingSymbols }" />
                  </button>
                </div>
              </div>

              <!-- Loading State -->
              <div v-if="isLoadingSymbols && existingSymbols.length === 0" class="p-3 rounded-lg bg-slate-900 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
                <RefreshCw class="w-4 h-4 animate-spin text-amber-400" />
                <span>正在从本地 cell/ 目录检索全部电力与工业图元，请稍候...</span>
              </div>

              <!-- Empty State -->
              <div v-else-if="existingSymbols.length === 0" class="p-3 rounded-lg bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 space-y-2">
                <div class="font-bold flex items-center gap-1.5 text-amber-300">
                  <ShieldAlert class="w-4 h-4 text-amber-400" />
                  <span>cell/ 目录中未读取到图元</span>
                </div>
                <p class="text-[11px] text-slate-400">系统已尝试自动扫描，若您刚新增图元，可点击下方立即重新扫描：</p>
                <button
                  type="button"
                  @click="loadExistingSymbols"
                  class="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw class="w-3.5 h-3.5" />
                  <span>重新扫描 cell 目录</span>
                </button>
              </div>

              <!-- Loaded Selector -->
              <div v-else class="space-y-2">
                <select
                  v-model="selectedExistingSymbolId"
                  class="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-amber-200 font-mono focus:border-amber-400 focus:outline-hidden cursor-pointer"
                >
                  <option v-for="sym in existingSymbols" :key="sym.id" :value="sym.id">
                    [{{ sym.category === 'electrical' ? '电力一次' : (sym.category === 'industrial' ? '工业控制' : '基础') }}] {{ sym.name }} (已有 {{ sym.states?.length || 1 }} 态)
                  </option>
                </select>

                <!-- Current Target Symbol States Inspector & Fast Selector -->
                <div v-if="currentTargetSymbol" class="p-2.5 rounded-lg bg-slate-950 border border-amber-500/20 text-xs font-mono space-y-2">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-slate-400">已选图元「{{ currentTargetSymbol.name }}」的现有状态:</span>
                    <span class="text-amber-400 text-[10px]">点击可直接选择覆盖</span>
                  </div>
                  <div class="flex flex-wrap gap-1.5 items-center">
                    <button
                      v-for="st in (currentTargetSymbol.states || [])"
                      :key="st.id"
                      type="button"
                      @click="selectStateToOverwrite(st)"
                      class="px-2 py-1 rounded text-[11px] border cursor-pointer transition-all flex items-center gap-1"
                      :class="String(stateId).trim() === String(st.id).trim() 
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-[0_0_8px_rgba(245,158,11,0.3)]' 
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'"
                    >
                      <span>{{ st.name || ('状态 ' + st.id) }}</span>
                      <span class="text-[9px] px-1 rounded bg-black/50 text-slate-400">ID:{{ st.id }}</span>
                    </button>
                    <button
                      type="button"
                      @click="suggestNextNewState"
                      class="px-2 py-1 rounded text-[11px] border border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40 cursor-pointer flex items-center gap-1 font-bold"
                    >
                      <Plus class="w-3 h-3 text-cyan-400" />
                      <span>追加新状态</span>
                    </button>
                  </div>
                  <div class="text-[10px] pt-0.5">
                    <span v-if="isOverwritingExistingState" class="text-amber-400 flex items-center gap-1">
                      <span>⚠️ 当前操作将覆盖并替换状态「{{ stateId }}」的图形定义</span>
                    </span>
                    <span v-else class="text-emerald-400 flex items-center gap-1">
                      <span>✨ 当前操作将为该图元追加全新的扩展状态「{{ stateId }}」</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- State Definition Section -->
          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
            <div class="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
              <span class="flex items-center gap-1.5 text-emerald-400">
                <Sparkles class="w-3.5 h-3.5" />
                <span>图元状态配置 (State)</span>
              </span>
              <span class="text-[10px] text-slate-500">支持 1, 2, 0, 3 或 closed, open, fault</span>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] font-mono text-slate-400 mb-1">状态标识 (ID / 遥信值)</label>
                <input
                  v-model="stateId"
                  type="text"
                  class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-mono focus:border-cyan-400 focus:outline-hidden"
                  placeholder="例如: 1 或 2"
                />
              </div>
              <div class="col-span-2">
                <label class="block text-[10px] font-mono text-slate-400 mb-1">状态名称 / 释义</label>
                <input
                  v-model="stateName"
                  type="text"
                  class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:border-cyan-400 focus:outline-hidden"
                  placeholder="例如: 状态 1 (合闸/正常)"
                />
              </div>
            </div>

            <div class="flex items-center gap-1.5 pt-1 flex-wrap">
              <button
                type="button"
                @click="stateId = '1'; stateName = '状态 1 (合闸 / 正常运行)';"
                class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-700 cursor-pointer"
              >
                设为状态 1 (合闸/运行)
              </button>
              <button
                type="button"
                @click="stateId = '2'; stateName = '状态 2 (分闸 / 拉开停运)';"
                class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-700 cursor-pointer"
              >
                设为状态 2 (分闸/停运)
              </button>
              <button
                type="button"
                @click="stateId = '0'; stateName = '状态 0 (停运备用 / 初始态)';"
                class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100 border border-slate-700 cursor-pointer"
              >
                设为状态 0 (备用态)
              </button>
              <button
                type="button"
                @click="stateId = '3'; stateName = '状态 3 (事故 / 故障跳闸)';"
                class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 hover:bg-red-950 hover:text-red-300 border border-slate-700 cursor-pointer"
              >
                设为状态 3 (事故故障)
              </button>
            </div>
          </div>
        </div>

        <!-- Right Live Preview Box -->
        <div class="w-52 flex flex-col items-center justify-between p-3 rounded-xl bg-slate-950 border border-cyan-500/20 text-center font-mono">
          <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            预览 (包含 {{ selectedComponents.length }} 个元件)
          </div>

          <div class="w-full h-44 flex items-center justify-center relative overflow-hidden bg-[#03060c] rounded-lg border border-slate-800 my-2">
            <div
              class="relative"
              :style="{
                width: `${symbolWidth}px`,
                height: `${symbolHeight}px`,
                transform: `scale(${previewScale})`,
                transformOrigin: 'center center'
              }"
            >
              <div
                v-for="child in normalizedChildren"
                :key="child.id"
                class="absolute"
                :style="{
                  left: `${child.x}px`,
                  top: `${child.y}px`,
                  width: `${child.width}px`,
                  height: `${child.height}px`,
                  transform: child.rotation ? `rotate(${child.rotation}deg)` : 'none',
                  zIndex: child.zIndex || 1
                }"
              >
                <WidgetRenderer :component="child" />
              </div>
            </div>
          </div>

          <div class="text-[10px] text-cyan-400">
            尺寸: {{ symbolWidth }} × {{ symbolHeight }} px
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="px-5 py-3.5 border-t border-cyan-500/20 bg-[#040813] flex items-center justify-between">
        <div class="text-[11px] text-cyan-300 font-mono flex items-center gap-1.5">
          <FolderDown class="w-3.5 h-3.5 text-cyan-400" />
          <span>自动紧致贴合边界(间距0px)，独立存储至 <strong>cell/&lt;图元名&gt;.json</strong></span>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            @click="emit('close')"
            class="px-4 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-mono cursor-pointer transition-colors"
          >
            取消
          </button>
          <button
            @click="handleSave"
            class="px-5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(0,242,255,0.4)] transition-all"
          >
            <Check class="w-4 h-4" />
            <span>{{ mode === 'new' ? '保存为自定义图元' : '更新图元此状态' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
