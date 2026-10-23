<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { ScreenComponent, CustomSymbolDef, CustomSymbolStateDef } from '../types';
import { 
  getCustomSymbols, 
  addCustomSymbol, 
  normalizeSymbolZeroMargin, 
  refreshCustomSymbolsFromDisk 
} from '../utils/customSymbolStorage';
import { saveCellToDisk } from '../utils/cellFileService';
import WidgetRenderer from './widgets/WidgetRenderer.vue';
import { 
  X, Check, AlertCircle, RefreshCw
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
const validationError = ref('');

// Form fields
const symbolName = ref('新自定义图元');
const stateValue = ref('1');

// Draggable Modal State (对齐数据关联配置中心风格)
const modalPos = ref<{ x: number; y: number }>({ x: 0, y: 0 });
const modalWidth = 640;
const modalHeight = 400;

const initModalPosition = () => {
  const w = Math.min(modalWidth, window.innerWidth - 32);
  const h = Math.min(modalHeight, window.innerHeight - 32);
  modalPos.value = {
    x: Math.max(16, Math.round((window.innerWidth - w) / 2)),
    y: Math.max(16, Math.round((window.innerHeight - h) / 2))
  };
};

let isDragging = false;
let dragStart = { mouseX: 0, mouseY: 0, posX: 0, posY: 0 };

const onHeaderMouseDown = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('button, input, select, a')) return;
  isDragging = true;
  dragStart = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    posX: modalPos.value.x,
    posY: modalPos.value.y
  };

  const onMouseMove = (ev: MouseEvent) => {
    if (!isDragging) return;
    const dx = ev.clientX - dragStart.mouseX;
    const dy = ev.clientY - dragStart.mouseY;
    const maxX = Math.max(0, window.innerWidth - modalWidth - 8);
    const maxY = Math.max(0, window.innerHeight - modalHeight - 8);

    modalPos.value = {
      x: Math.min(maxX, Math.max(8, dragStart.posX + dx)),
      y: Math.min(maxY, Math.max(8, dragStart.posY + dy))
    };
  };

  const onMouseUp = () => {
    isDragging = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

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
  return Math.min(1, 150 / maxDim);
});

// Load existing symbols from local storage and disk
const loadExistingSymbols = async () => {
  isLoadingSymbols.value = true;
  const cached = getCustomSymbols();
  if (cached.length > 0) {
    existingSymbols.value = cached;
    if (!selectedExistingSymbolId.value || !cached.some(s => s.id === selectedExistingSymbolId.value)) {
      selectedExistingSymbolId.value = cached[0].id;
    }
  }

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

const switchMode = (m: 'new' | 'update_state') => {
  mode.value = m;
  validationError.value = '';
  if (m === 'update_state' && existingSymbols.value.length === 0) {
    loadExistingSymbols();
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
  initModalPosition();
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
    initModalPosition();
    loadExistingSymbols();
    validationError.value = '';
    stateValue.value = '1';
    if (props.selectedComponents.length > 0) {
      symbolName.value = props.selectedComponents.length === 1 
        ? `${props.selectedComponents[0].name} (自定义)`
        : `组合图元 (${props.selectedComponents.length}个元件)`;
    }
  }
}, { immediate: true });

watch([symbolName, selectedExistingSymbolId, stateValue, mode], () => {
  validationError.value = '';
});

// 检测整数有效性 (只允许可选负号的正负整数)
const isValidInteger = (val: string): boolean => {
  const trimmed = val.trim();
  return /^-?\d+$/.test(trimmed);
};

const handleSave = () => {
  if (props.selectedComponents.length === 0) return;

  const currentChildren = JSON.parse(JSON.stringify(normalizedChildren.value));
  const rawStatus = String(stateValue.value || '').trim();

  // 1. 状态值校验：必须是整数，不合理直接显示编辑失败
  if (!isValidInteger(rawStatus)) {
    validationError.value = '编辑失败';
    return;
  }

  const intStateVal = parseInt(rawStatus, 10);

  if (mode.value === 'new') {
    const trimmedName = symbolName.value.trim();

    // 2. 名称合理性校验：不能为空，不能重复，不合理直接显示编辑失败
    if (!trimmedName) {
      validationError.value = '编辑失败';
      return;
    }

    const isDuplicate = existingSymbols.value.some(
      s => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      validationError.value = '编辑失败';
      return;
    }

    const initialDefState: CustomSymbolStateDef = {
      id: rawStatus,
      name: `状态 ${rawStatus}`,
      matchValue: rawStatus,
      stateValue: intStateVal,
      children: currentChildren
    };

    const rawDef: CustomSymbolDef = {
      id: `symbol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: trimmedName,
      category: 'electrical',
      iconName: 'Zap',
      description: '',
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
      states: [initialDefState],
      activeStateId: rawStatus,
      tags: ['电力一次'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newDef = normalizeSymbolZeroMargin(rawDef);
    addCustomSymbol(newDef);
    saveCellToDisk(newDef).catch(err => console.warn('保存到 cell 目录失败:', err));
    emit('saved', newDef);
    emit('close');
  } else {
    const targetSymbol = existingSymbols.value.find(s => s.id === selectedExistingSymbolId.value)
      || getCustomSymbols().find(s => s.id === selectedExistingSymbolId.value);

    if (!targetSymbol) {
      validationError.value = '编辑失败';
      return;
    }

    const states: CustomSymbolStateDef[] = targetSymbol.states ? [...targetSymbol.states] : [];
    
    // 优先按状态值匹配已有的状态；已有则覆盖，没有则新建
    const existingIndex = states.findIndex(s => 
      String(s.id).trim() === rawStatus || 
      String(s.matchValue ?? '').trim() === rawStatus ||
      (s.stateValue !== undefined && String(s.stateValue).trim() === rawStatus)
    );

    const targetStateItem: CustomSymbolStateDef = {
      id: rawStatus,
      name: `状态 ${rawStatus}`,
      matchValue: rawStatus,
      stateValue: intStateVal,
      children: currentChildren
    };

    if (existingIndex >= 0) {
      // 已有该状态 -> 直接覆盖
      states[existingIndex] = {
        ...states[existingIndex],
        ...targetStateItem
      };
    } else {
      // 没有该状态 -> 新建这个状态
      states.push(targetStateItem);
    }

    const rawUpdatedSymbol: CustomSymbolDef = {
      ...targetSymbol,
      defaultStyle: {
        ...(targetSymbol.defaultStyle || {}),
        fill: 'transparent'
      },
      states,
      children: currentChildren,
      activeStateId: rawStatus,
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
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[9999] pointer-events-none select-none"
    >
      <!-- 弹窗容器：对齐数据关联配置中心 (纯黑底色、硬质深灰边框、全白高对比字体、支持拖拽、无荧光背景) -->
      <div
        class="pointer-events-auto absolute bg-black text-white rounded-lg border border-neutral-700 shadow-2xl flex flex-col overflow-hidden"
        :style="{
          left: `${modalPos.x}px`,
          top: `${modalPos.y}px`,
          width: `${modalWidth}px`
        }"
      >
        <!-- 顶栏：标明标题，可按住拖拽，关闭按钮 -->
        <header
          @mousedown="onHeaderMouseDown"
          class="h-11 px-3.5 bg-[#111111] border-b border-[#2a2a2a] flex items-center justify-between shrink-0 cursor-move select-none"
          title="按住鼠标左键可拖动"
        >
          <div class="flex items-center gap-2.5 min-w-0 pr-3">
            <div class="w-2.5 h-2.5 rounded-full bg-white shrink-0"></div>
            <span class="text-sm sm:text-base font-bold text-white tracking-normal truncate drop-shadow-xs">
              封装为自定义图元
            </span>
            <span v-if="selectedComponents.length" class="text-xs text-white/90 font-mono hidden sm:inline ml-1">
              [{{ selectedComponents.length }} 个元件]
            </span>
          </div>

          <!-- 关闭按钮 -->
          <button
            @click="emit('close')"
            class="w-7 h-7 rounded flex items-center justify-center text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-600 transition-colors cursor-pointer"
            title="关闭窗口"
          >
            <X class="w-4 h-4" />
          </button>
        </header>

        <!-- 模式切换标签 -->
        <div class="px-4 pt-2.5 flex items-center gap-2 border-b border-neutral-800 bg-[#0d0d0d]">
          <button
            type="button"
            @click="switchMode('new')"
            class="px-4 py-1.5 text-sm font-semibold rounded-t cursor-pointer transition-colors"
            :class="mode === 'new' 
              ? 'bg-black text-white border-t-2 border-t-white border-x border-neutral-700 -mb-[1px]' 
              : 'text-neutral-400 hover:text-white'"
          >
            新建图元
          </button>
          <button
            type="button"
            @click="switchMode('update_state')"
            class="px-4 py-1.5 text-sm font-semibold rounded-t cursor-pointer transition-colors"
            :class="mode === 'update_state' 
              ? 'bg-black text-white border-t-2 border-t-white border-x border-neutral-700 -mb-[1px]' 
              : 'text-neutral-400 hover:text-white'"
          >
            更新图元多状态
          </button>
        </div>

        <!-- 主体区域：极简表单 + 精简图样预览 -->
        <div class="p-5 flex gap-5 bg-black">
          <!-- 左侧极简表单输入区 -->
          <div class="flex-1 space-y-4">
            <!-- 模式一：新建图元 -->
            <template v-if="mode === 'new'">
              <div>
                <label class="block text-sm font-semibold text-white mb-1.5">
                  图元名称
                </label>
                <input
                  v-model="symbolName"
                  type="text"
                  autofocus
                  class="w-full bg-[#111111] border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-hidden"
                  placeholder="请输入图元名称"
                  @keydown.enter.prevent="handleSave"
                />
              </div>

              <div>
                <label class="block text-sm font-semibold text-white mb-1.5">
                  当前状态值
                </label>
                <input
                  v-model="stateValue"
                  type="text"
                  class="w-full bg-[#111111] border border-neutral-700 rounded px-3 py-2 text-sm text-white font-mono focus:border-white focus:outline-hidden"
                  placeholder="请输入整数状态值"
                  @keydown.enter.prevent="handleSave"
                />
              </div>
            </template>

            <!-- 模式二：更新/新增图元状态 -->
            <template v-else>
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-sm font-semibold text-white">
                    目标图元
                  </label>
                  <button
                    type="button"
                    @click="loadExistingSymbols"
                    class="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                    title="刷新图元列表"
                  >
                    <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isLoadingSymbols }" />
                    <span>刷新</span>
                  </button>
                </div>
                <select
                  v-model="selectedExistingSymbolId"
                  class="w-full bg-[#111111] border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:border-white focus:outline-hidden cursor-pointer"
                >
                  <option v-for="sym in existingSymbols" :key="sym.id" :value="sym.id">
                    {{ sym.name }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-semibold text-white mb-1.5">
                  状态值
                </label>
                <input
                  v-model="stateValue"
                  type="text"
                  class="w-full bg-[#111111] border border-neutral-700 rounded px-3 py-2 text-sm text-white font-mono focus:border-white focus:outline-hidden"
                  placeholder="请输入整数状态值"
                  @keydown.enter.prevent="handleSave"
                />
              </div>
            </template>
          </div>

          <!-- 右侧精简预览框 (黑色底、无荧光背景、极简尺寸展示) -->
          <div class="w-52 bg-[#0d0d0d] border border-neutral-800 rounded p-3 flex flex-col items-center justify-between shrink-0">
            <div class="w-full h-36 flex items-center justify-center relative overflow-hidden bg-[#050505] rounded border border-neutral-900">
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
                  v-for="(child, idx) in normalizedChildren"
                  :key="idx"
                  class="absolute pointer-events-none select-none"
                  :style="{
                    left: `${child.x}px`,
                    top: `${child.y}px`,
                    width: `${child.width}px`,
                    height: `${child.height}px`,
                    zIndex: child.zIndex || 1
                  }"
                >
                  <WidgetRenderer :component="child" />
                </div>
              </div>
            </div>

            <div class="text-xs text-neutral-400 font-mono mt-2 text-center">
              {{ symbolWidth }} × {{ symbolHeight }} px
            </div>
          </div>
        </div>

        <!-- 校验失败提示 (统一直接显示编辑失败，无多余提示) -->
        <div v-if="validationError" class="px-4 py-2 bg-rose-950/70 border-t border-rose-800 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{{ validationError }}</span>
        </div>

        <!-- 底栏 (对齐数据关联配置中心) -->
        <footer class="h-14 px-4 bg-[#111111] border-t border-[#2a2a2a] flex items-center justify-between shrink-0 select-none">
          <div class="text-xs text-neutral-400 truncate pr-3">
            <span>存储至 cell/ 目录</span>
          </div>

          <div class="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              @click="emit('close')"
              class="px-5 py-2 rounded text-sm font-semibold border border-neutral-600 bg-neutral-900 hover:bg-neutral-800 text-white transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              @click="handleSave"
              class="px-6 py-2 rounded text-sm font-bold bg-white hover:bg-neutral-200 text-black transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check class="w-4 h-4 stroke-[2.5]" />
              <span>{{ mode === 'new' ? '保存图元' : '保存状态' }}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
