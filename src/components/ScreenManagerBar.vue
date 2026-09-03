<script setup lang="ts">
import { ref, computed } from 'vue';
import { ScreenItem } from '../types';
import { 
  Plus, Copy, Trash2, Edit3, Monitor, Layers, 
  ChevronDown, Check, AlertCircle, Layout
} from 'lucide-vue-next';

interface Props {
  screens: ScreenItem[];
  activeScreenId: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'switch:screen', screenId: string): void;
  (e: 'add:screen', payload: { name: string; width: number; height: number }): void;
  (e: 'duplicate:screen', screenId: string): void;
  (e: 'rename:screen', payload: { screenId: string; newName: string }): void;
  (e: 'delete:screen', screenId: string): void;
}>();

const isDropdownOpen = ref(false);
const showAddModal = ref(false);
const showRenameModal = ref(false);

const newScreenName = ref('');
const newScreenWidth = ref(1920);
const newScreenHeight = ref(1080);
const renameText = ref('');
const errorMessage = ref('');

const currentScreen = computed(() => {
  return props.screens.find(s => s.id === props.activeScreenId) || props.screens[0];
});

// Check unique name helper
const isNameTaken = (name: string, excludeId?: string) => {
  const normalized = name.trim().toLowerCase();
  return props.screens.some(s => s.id !== excludeId && s.name.trim().toLowerCase() === normalized);
};

const handleSelectScreen = (screenId: string) => {
  emit('switch:screen', screenId);
  isDropdownOpen.value = false;
};

const handleOpenAddModal = () => {
  errorMessage.value = '';
  // Generate a unique suggested name
  let idx = props.screens.length + 1;
  let candidate = `新画面 ${idx}`;
  while (isNameTaken(candidate)) {
    idx++;
    candidate = `新画面 ${idx}`;
  }
  newScreenName.value = candidate;
  newScreenWidth.value = currentScreen.value?.screen.width || 1920;
  newScreenHeight.value = currentScreen.value?.screen.height || 1080;
  showAddModal.value = true;
};

const handleConfirmAdd = () => {
  const trimmed = newScreenName.value.trim();
  if (!trimmed) {
    errorMessage.value = '画面名称不能为空';
    return;
  }
  if (isNameTaken(trimmed)) {
    errorMessage.value = `画面「${trimmed}」已存在，画面名称为唯一识别标识，不可重复！`;
    return;
  }

  emit('add:screen', {
    name: trimmed,
    width: newScreenWidth.value,
    height: newScreenHeight.value
  });
  showAddModal.value = false;
  errorMessage.value = '';
};

const handleOpenRenameModal = () => {
  if (!currentScreen.value) return;
  renameText.value = currentScreen.value.name;
  errorMessage.value = '';
  showRenameModal.value = true;
};

const handleConfirmRename = () => {
  if (!currentScreen.value) return;
  const trimmed = renameText.value.trim();
  if (!trimmed) {
    errorMessage.value = '画面名称不能为空';
    return;
  }
  if (isNameTaken(trimmed, currentScreen.value.id)) {
    errorMessage.value = `画面「${trimmed}」已存在，画面名称为唯一识别标识，不可重复！`;
    return;
  }

  emit('rename:screen', {
    screenId: currentScreen.value.id,
    newName: trimmed
  });
  showRenameModal.value = false;
  errorMessage.value = '';
};

const handleDuplicateCurrent = () => {
  if (!currentScreen.value) return;
  emit('duplicate:screen', currentScreen.value.id);
};

const handleDeleteCurrent = () => {
  if (!currentScreen.value || props.screens.length <= 1) return;
  emit('delete:screen', currentScreen.value.id);
};
</script>

<template>
  <div class="h-10 bg-[#050914] border-t border-slate-800/80 flex items-center justify-between px-3 z-30 select-none font-mono">
    <!-- Left: Dropdown Screen Switcher & Quick Actions -->
    <div class="flex items-center gap-2">
      <!-- Label -->
      <div class="flex items-center gap-1.5 text-xs text-cyan-400 font-bold px-1 shrink-0">
        <Layout class="w-3.5 h-3.5" />
        <span>SCADA 画面:</span>
      </div>

      <!-- Dropdown Screen Selector Trigger -->
      <div class="relative">
        <button
          @click="isDropdownOpen = !isDropdownOpen"
          class="flex items-center justify-between gap-2 px-3 py-1 bg-slate-900/90 hover:bg-slate-850 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 rounded-md text-xs font-mono transition-all cursor-pointer min-w-[200px] shadow-sm"
        >
          <div class="flex items-center gap-2 truncate">
            <Monitor class="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span class="font-bold truncate max-w-[180px]">{{ currentScreen?.name || '选择画面' }}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[9px] px-1 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">
              {{ currentScreen?.components?.length || 0 }}组件
            </span>
            <ChevronDown class="w-3.5 h-3.5 text-slate-400 transition-transform" :class="{ 'rotate-180': isDropdownOpen }" />
          </div>
        </button>

        <!-- Dropdown Menu Popover -->
        <div
          v-if="isDropdownOpen"
          class="absolute bottom-full left-0 mb-1 w-72 bg-[#060c1c] border border-cyan-500/50 rounded-lg shadow-2xl overflow-hidden z-50 divide-y divide-slate-800 animate-in fade-in zoom-in-95 duration-100"
        >
          <div class="px-3 py-1.5 bg-slate-950/80 text-[10px] text-slate-400 flex items-center justify-between">
            <span class="font-bold">切换监控画面 (共 {{ screens.length }} 画面)</span>
            <span class="text-cyan-400">名称唯一识别</span>
          </div>

          <div class="max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
            <button
              v-for="item in screens"
              :key="item.id"
              @click="handleSelectScreen(item.id)"
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-mono text-left cursor-pointer transition-colors"
              :class="item.id === activeScreenId 
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' 
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'"
            >
              <div class="flex items-center gap-2 truncate">
                <Monitor class="w-3.5 h-3.5 shrink-0" :class="item.id === activeScreenId ? 'text-cyan-400' : 'text-slate-500'" />
                <span class="truncate">{{ item.name }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-[10px] text-slate-500 font-normal">
                  {{ item.components?.length || 0 }} 项
                </span>
                <Check v-if="item.id === activeScreenId" class="w-3.5 h-3.5 text-cyan-400" />
              </div>
            </button>
          </div>

          <!-- Bottom Action in Dropdown -->
          <div class="p-1.5 bg-slate-950/90 flex items-center gap-1">
            <button
              @click="isDropdownOpen = false; handleOpenAddModal();"
              class="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-500/40 rounded text-xs font-bold cursor-pointer transition-colors"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>添加新画面</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center gap-1 pl-1 border-l border-slate-800">
        <!-- Add Screen -->
        <button
          @click="handleOpenAddModal"
          class="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-cyan-950/70 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-xs font-mono transition-all cursor-pointer shadow-xs"
          title="新建画面页面"
        >
          <Plus class="w-3 h-3 text-cyan-400" />
          <span>新建</span>
        </button>

        <!-- Rename Current Screen -->
        <button
          @click="handleOpenRenameModal"
          class="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-mono transition-all cursor-pointer shadow-xs"
          title="重命名当前画面"
        >
          <Edit3 class="w-3 h-3" />
          <span>重命名</span>
        </button>

        <!-- Duplicate Current Screen -->
        <button
          @click="handleDuplicateCurrent"
          class="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-emerald-950/60 border border-slate-800 hover:border-emerald-500/40 text-slate-400 hover:text-emerald-300 text-xs font-mono transition-all cursor-pointer shadow-xs"
          title="复制当前画面"
        >
          <Copy class="w-3 h-3" />
          <span>复制</span>
        </button>

        <!-- Delete Current Screen -->
        <button
          v-if="screens.length > 1"
          @click="handleDeleteCurrent"
          class="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-xs font-mono transition-all cursor-pointer shadow-xs"
          title="删除当前画面"
        >
          <Trash2 class="w-3 h-3" />
          <span>删除</span>
        </button>
      </div>
    </div>

    <!-- Right: Screen Resolution Info -->
    <div class="text-[11px] text-slate-500 flex items-center gap-2 shrink-0">
      <span>当前画面尺寸: <strong class="text-slate-300">{{ currentScreen?.screen.width || 1920 }}×{{ currentScreen?.screen.height || 1080 }}</strong></span>
    </div>

    <!-- Add Screen Modal -->
    <div 
      v-if="showAddModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    >
      <div class="bg-[#080e1c] border border-cyan-500/40 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4 font-mono">
        <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-2">
          <Plus class="w-4 h-4 text-cyan-400" />
          新建画面 (名称唯一)
        </h3>

        <div v-if="errorMessage" class="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">画面名称 * (不可重复)</label>
            <input 
              v-model="newScreenName"
              @input="errorMessage = ''"
              @keydown.enter="handleConfirmAdd"
              placeholder="例如：变电站二次回路与直流屏"
              class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-400 focus:outline-hidden font-mono"
              autofocus
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1">宽度 (px)</label>
              <input 
                type="number" 
                v-model.number="newScreenWidth" 
                class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-400 focus:outline-hidden"
              />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">高度 (px)</label>
              <input 
                type="number" 
                v-model.number="newScreenHeight" 
                class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-400 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button 
            @click="showAddModal = false"
            class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
          >
            取消
          </button>
          <button 
            @click="handleConfirmAdd"
            class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
          >
            立即创建
          </button>
        </div>
      </div>
    </div>

    <!-- Rename Screen Modal -->
    <div 
      v-if="showRenameModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    >
      <div class="bg-[#080e1c] border border-cyan-500/40 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4 font-mono">
        <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-2">
          <Edit3 class="w-4 h-4 text-cyan-400" />
          重命名画面 (名称唯一)
        </h3>

        <div v-if="errorMessage" class="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">新的画面名称 * (不可重复)</label>
            <input 
              v-model="renameText"
              @input="errorMessage = ''"
              @keydown.enter="handleConfirmRename"
              placeholder="请输入新的画面名称"
              class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-400 focus:outline-hidden font-mono"
              autofocus
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button 
            @click="showRenameModal = false"
            class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
          >
            取消
          </button>
          <button 
            @click="handleConfirmRename"
            class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
          >
            确认修改
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
