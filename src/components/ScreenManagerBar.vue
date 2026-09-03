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
  <div class="h-10 bg-[#050c1c] border-t border-cyan-500/40 flex items-center justify-between px-3 z-30 select-none font-mono">
    <!-- Left: Dropdown Screen Switcher & Quick Actions -->
    <div class="flex items-center gap-2">
      <!-- Label -->
      <div class="flex items-center gap-1.5 text-xs text-cyan-300 font-normal px-1 shrink-0">
        <Layout class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
        <span>SCADA 画面:</span>
      </div>

      <!-- Dropdown Screen Selector Trigger -->
      <div class="relative">
        <button
          @click="isDropdownOpen = !isDropdownOpen"
          class="flex items-center justify-between gap-2 px-3 py-1 bg-[#09152b] hover:bg-cyan-950/80 border border-cyan-400/50 hover:border-cyan-300 text-cyan-100 rounded-md text-xs font-mono transition-all cursor-pointer min-w-[200px] shadow-sm"
        >
          <div class="flex items-center gap-2 truncate">
            <Monitor class="w-3.5 h-3.5 text-cyan-300 shrink-0 stroke-[2]" />
            <span class="font-normal truncate max-w-[180px]">{{ currentScreen?.name || '选择画面' }}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[9px] px-1 py-0.2 rounded bg-[#040813] text-cyan-300 border border-cyan-500/40 font-light">
              {{ currentScreen?.components?.length || 0 }}组件
            </span>
            <ChevronDown class="w-3.5 h-3.5 text-cyan-300 transition-transform stroke-[2]" :class="{ 'rotate-180': isDropdownOpen }" />
          </div>
        </button>

        <!-- Dropdown Menu Popover -->
        <div
          v-if="isDropdownOpen"
          class="absolute bottom-full left-0 mb-1 w-72 bg-[#050c1c] border border-cyan-400/60 rounded-lg shadow-2xl overflow-hidden z-50 divide-y divide-cyan-500/30 animate-in fade-in zoom-in-95 duration-100"
        >
          <div class="px-3 py-1.5 bg-[#071024] text-[10px] text-cyan-300 flex items-center justify-between font-light">
            <span>切换监控画面 (共 {{ screens.length }} 画面)</span>
            <span class="text-cyan-200">名称唯一识别</span>
          </div>

          <div class="max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
            <button
              v-for="item in screens"
              :key="item.id"
              @click="handleSelectScreen(item.id)"
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-mono text-left cursor-pointer transition-colors"
              :class="item.id === activeScreenId 
                ? 'bg-cyan-500/25 text-cyan-200 font-normal border border-cyan-400/50 shadow-[0_0_8px_rgba(0,242,255,0.2)]' 
                : 'text-cyan-200 hover:bg-cyan-950/60 hover:text-white border border-transparent font-light'"
            >
              <div class="flex items-center gap-2 truncate">
                <Monitor class="w-3.5 h-3.5 shrink-0 stroke-[2]" :class="item.id === activeScreenId ? 'text-cyan-300' : 'text-cyan-400/80'" />
                <span class="truncate">{{ item.name }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-[10px] text-cyan-300/80 font-light">
                  {{ item.components?.length || 0 }} 项
                </span>
                <Check v-if="item.id === activeScreenId" class="w-3.5 h-3.5 text-cyan-300 stroke-[2.5]" />
              </div>
            </button>
          </div>

          <!-- Bottom Action in Dropdown -->
          <div class="p-1.5 bg-[#071024] flex items-center gap-1">
            <button
              @click="isDropdownOpen = false; handleOpenAddModal();"
              class="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 hover:text-white border border-cyan-400/50 rounded text-xs font-normal cursor-pointer transition-colors"
            >
              <Plus class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
              <span>添加新画面</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center gap-1 pl-1 border-l border-cyan-500/30">
        <!-- Add Screen -->
        <button
          @click="handleOpenAddModal"
          class="flex items-center gap-1 px-2 py-1 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white text-xs font-mono font-light transition-all cursor-pointer shadow-xs"
          title="新建画面页面"
        >
          <Plus class="w-3 h-3 text-cyan-300 stroke-[2]" />
          <span>新建</span>
        </button>

        <!-- Rename Current Screen -->
        <button
          @click="handleOpenRenameModal"
          class="flex items-center gap-1 px-2 py-1 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white text-xs font-mono font-light transition-all cursor-pointer shadow-xs"
          title="重命名当前画面"
        >
          <Edit3 class="w-3 h-3 text-cyan-300 stroke-[2]" />
          <span>重命名</span>
        </button>

        <!-- Duplicate Current Screen -->
        <button
          @click="handleDuplicateCurrent"
          class="flex items-center gap-1 px-2 py-1 rounded bg-[#09152b] hover:bg-emerald-950/70 border border-cyan-500/40 hover:border-emerald-400/60 text-cyan-200 hover:text-emerald-200 text-xs font-mono font-light transition-all cursor-pointer shadow-xs"
          title="复制当前画面"
        >
          <Copy class="w-3 h-3 text-emerald-300 stroke-[2]" />
          <span>复制</span>
        </button>

        <!-- Delete Current Screen -->
        <button
          v-if="screens.length > 1"
          @click="handleDeleteCurrent"
          class="flex items-center gap-1 px-2 py-1 rounded bg-[#09152b] hover:bg-rose-950/70 border border-cyan-500/40 hover:border-rose-400/60 text-cyan-200 hover:text-rose-200 text-xs font-mono font-light transition-all cursor-pointer shadow-xs"
          title="删除当前画面"
        >
          <Trash2 class="w-3 h-3 text-rose-300 stroke-[2]" />
          <span>删除</span>
        </button>
      </div>
    </div>

    <!-- Right: Screen Resolution Info -->
    <div class="text-[11px] text-cyan-300/90 flex items-center gap-2 shrink-0 font-light">
      <span>当前画面尺寸: <strong class="text-cyan-100 font-normal">{{ currentScreen?.screen.width || 1920 }}×{{ currentScreen?.screen.height || 1080 }}</strong></span>
    </div>

    <!-- Add Screen Modal -->
    <div 
      v-if="showAddModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
    >
      <div class="bg-[#050c1c] border border-cyan-400/60 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4 font-mono">
        <h3 class="text-sm font-normal text-cyan-100 flex items-center gap-2 border-b border-cyan-500/30 pb-2">
          <Plus class="w-4 h-4 text-cyan-300 stroke-[2]" />
          <span>新建画面 (名称唯一)</span>
        </h3>

        <div v-if="errorMessage" class="p-2.5 rounded-lg bg-rose-950/80 border border-rose-400/70 text-rose-200 text-xs flex items-center gap-2 font-light">
          <AlertCircle class="w-4 h-4 text-rose-300 shrink-0 stroke-[2]" />
          <span>{{ errorMessage }}</span>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-cyan-300 mb-1 font-light">画面名称 * (不可重复)</label>
            <input 
              v-model="newScreenName"
              @input="errorMessage = ''"
              @keydown.enter="handleConfirmAdd"
              placeholder="例如：变电站二次回路与直流屏"
              class="w-full px-3 py-2 bg-[#09152b] border border-cyan-500/50 rounded-lg text-cyan-100 focus:border-cyan-300 focus:outline-hidden font-mono font-light placeholder:text-cyan-500/60"
              autofocus
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-cyan-300 mb-1 font-light">宽度 (px)</label>
              <input 
                type="number" 
                v-model.number="newScreenWidth" 
                class="w-full px-3 py-2 bg-[#09152b] border border-cyan-500/50 rounded-lg text-cyan-100 focus:border-cyan-300 focus:outline-hidden font-light"
              />
            </div>
            <div>
              <label class="block text-cyan-300 mb-1 font-light">高度 (px)</label>
              <input 
                type="number" 
                v-model.number="newScreenHeight" 
                class="w-full px-3 py-2 bg-[#09152b] border border-cyan-500/50 rounded-lg text-cyan-100 focus:border-cyan-300 focus:outline-hidden font-light"
              />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/30">
          <button 
            @click="showAddModal = false"
            class="px-3 py-1.5 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs font-light cursor-pointer transition-colors"
          >
            取消
          </button>
          <button 
            @click="handleConfirmAdd"
            class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-normal text-xs cursor-pointer shadow-md transition-colors"
          >
            立即创建
          </button>
        </div>
      </div>
    </div>

    <!-- Rename Screen Modal -->
    <div 
      v-if="showRenameModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
    >
      <div class="bg-[#050c1c] border border-cyan-400/60 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4 font-mono">
        <h3 class="text-sm font-normal text-cyan-100 flex items-center gap-2 border-b border-cyan-500/30 pb-2">
          <Edit3 class="w-4 h-4 text-cyan-300 stroke-[2]" />
          <span>重命名画面 (名称唯一)</span>
        </h3>

        <div v-if="errorMessage" class="p-2.5 rounded-lg bg-rose-950/80 border border-rose-400/70 text-rose-200 text-xs flex items-center gap-2 font-light">
          <AlertCircle class="w-4 h-4 text-rose-300 shrink-0 stroke-[2]" />
          <span>{{ errorMessage }}</span>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-cyan-300 mb-1 font-light">新的画面名称 * (不可重复)</label>
            <input 
              v-model="renameText"
              @input="errorMessage = ''"
              @keydown.enter="handleConfirmRename"
              placeholder="请输入新的画面名称"
              class="w-full px-3 py-2 bg-[#09152b] border border-cyan-500/50 rounded-lg text-cyan-100 focus:border-cyan-300 focus:outline-hidden font-mono font-light placeholder:text-cyan-500/60"
              autofocus
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/30">
          <button 
            @click="showRenameModal = false"
            class="px-3 py-1.5 rounded-lg bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs font-light cursor-pointer transition-colors"
          >
            取消
          </button>
          <button 
            @click="handleConfirmRename"
            class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-normal text-xs cursor-pointer shadow-md transition-colors"
          >
            确认修改
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
