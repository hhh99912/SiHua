<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ScreenComponent, CustomSymbolDef, CustomSymbolStateDef } from '../types';
import { getCustomSymbols, saveCustomSymbols, addCustomSymbol, normalizeSymbolZeroMargin } from '../utils/customSymbolStorage';
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

// New Symbol Form
const symbolName = ref('新自定义组装图元');
const symbolCategory = ref<'electrical' | 'industrial' | 'basic' | 'custom'>('electrical');
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

const loadExistingSymbols = () => {
  existingSymbols.value = getCustomSymbols();
  if (existingSymbols.value.length > 0 && !selectedExistingSymbolId.value) {
    selectedExistingSymbolId.value = existingSymbols.value[0].id;
  }
};

watch(() => props.visible, (val) => {
  if (val) {
    loadExistingSymbols();
    if (props.selectedComponents.length > 0) {
      symbolName.value = props.selectedComponents.length === 1 
        ? `${props.selectedComponents[0].name} (自定义)`
        : `组合图元 (${props.selectedComponents.length}个元件)`;
    }
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
    const targetSymbol = existingSymbols.value.find(s => s.id === selectedExistingSymbolId.value);
    if (!targetSymbol) {
      alert('请选择要更新的目标图元');
      return;
    }

    const states: CustomSymbolStateDef[] = targetSymbol.states ? [...targetSymbol.states] : [];
    
    // Check if state ID exists
    const existingStateIndex = states.findIndex(s => s.id === stateId.value);
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
    const allSymbols = existingSymbols.value.map(s => s.id === updatedSymbol.id ? updatedSymbol : s);
    saveCustomSymbols(allSymbols);
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
          @click="mode = 'new'"
          class="px-4 py-2 text-xs font-mono font-bold rounded-t-lg transition-all cursor-pointer border-t border-x"
          :class="mode === 'new' ? 'bg-[#070d1a] text-cyan-300 border-cyan-500/40 border-b-transparent -mb-[1px]' : 'text-slate-400 border-transparent hover:text-slate-200'"
        >
          ✨ 新建图元资产
        </button>
        <button
          @click="mode = 'update_state'"
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
            <div>
              <label class="block text-[11px] font-mono text-slate-400 mb-1">图元名称 *</label>
              <input
                v-model="symbolName"
                type="text"
                class="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono focus:border-cyan-400 focus:outline-hidden"
                placeholder="例如: 10kV 进线断路器柜组合"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-mono text-slate-400 mb-1">图元分类</label>
                <select
                  v-model="symbolCategory"
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-400 focus:outline-hidden cursor-pointer"
                >
                  <option value="electrical">⚡ 电力系统图元</option>
                  <option value="industrial">🏭 工业SCADA流体</option>
                  <option value="basic">📐 基础几何与控制</option>
                  <option value="custom">📦 自定义组合</option>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-mono text-slate-400 mb-1">标签</label>
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
            <div>
              <label class="block text-[11px] font-mono text-slate-400 mb-1">选择要追加/更新状态的目标图元 *</label>
              <select
                v-model="selectedExistingSymbolId"
                class="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-amber-200 font-mono focus:border-amber-400 focus:outline-hidden cursor-pointer"
              >
                <option v-for="sym in existingSymbols" :key="sym.id" :value="sym.id">
                  {{ sym.name }} (已有 {{ sym.states?.length || 1 }} 个状态)
                </option>
              </select>
            </div>
          </template>

          <!-- State Definition Section -->
          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
            <div class="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
              <span class="flex items-center gap-1.5 text-emerald-400">
                <Sparkles class="w-3.5 h-3.5" />
                <span>图元状态配置 (State)</span>
              </span>
              <span class="text-[10px] text-slate-500">支持 1, 2, 3 或 closed, open, fault</span>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] font-mono text-slate-400 mb-1">状态标识 (ID / 值)</label>
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

            <div class="flex items-center gap-1.5 pt-1">
              <button
                @click="stateId = '1'; stateName = '状态 1 (合闸 / 正常运行)';"
                class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-700 cursor-pointer"
              >
                设为状态 1 (合闸)
              </button>
              <button
                @click="stateId = '2'; stateName = '状态 2 (分闸 / 拉开停运)';"
                class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-700 cursor-pointer"
              >
                设为状态 2 (分闸)
              </button>
              <button
                @click="stateId = '3'; stateName = '状态 3 (事故 / 故障跳闸)';"
                class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 hover:bg-red-950 hover:text-red-300 border border-slate-700 cursor-pointer"
              >
                设为状态 3 (故障)
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
