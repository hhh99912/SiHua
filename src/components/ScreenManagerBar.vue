<script setup lang="ts">
import { ref, computed } from 'vue';
import { ScreenItem } from '../types';
import { 
  Plus, Copy, Trash2, Edit3, Monitor, Layers, 
  ChevronDown, Check, AlertCircle, Layout,
  HardDrive, Save, Folder, Star
} from 'lucide-vue-next';

interface Props {
  screens: ScreenItem[];
  activeScreenId: string;
  storageDir?: string;
  diskFileCount?: number;
  isSavingDisk?: boolean;
  indexScreenId?: string;
  indexScreenName?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'switch:screen', screenId: string): void;
  (e: 'add:screen', payload: { name: string; width: number; height: number }): void;
  (e: 'duplicate:screen', screenId: string): void;
  (e: 'rename:screen', payload: { screenId: string; newName: string }): void;
  (e: 'delete:screen', screenId: string): void;
  (e: 'open:disk-storage'): void;
  (e: 'save:current-disk'): void;
  (e: 'set:index-screen', screenId: string): void;
}>();

const isDropdownOpen = ref(false);
const showAddModal = ref(false);
const showRenameModal = ref(false);

const newScreenName = ref('');
const newScreenWidth = ref(1980);
const newScreenHeight = ref(1100);
const renameText = ref('');
const errorMessage = ref('');

const currentScreen = computed(() => {
  return props.screens.find(s => s.id === props.activeScreenId) || props.screens[0];
});

const isCurrentIndexScreen = computed(() => {
  if (!currentScreen.value) return false;
  return (
    (props.indexScreenId && props.indexScreenId === currentScreen.value.id) ||
    (props.indexScreenName && props.indexScreenName.trim().toLowerCase() === currentScreen.value.name.trim().toLowerCase())
  );
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
  newScreenWidth.value = 1980;
  newScreenHeight.value = 1100;
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
  <div class="h-10 bg-[#132745] border-t border-cyan-500/40 flex items-center justify-between px-3 z-30 select-none font-mono shadow-sm">
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
          class="flex items-center justify-between gap-2 px-3 py-1 bg-[#173055] hover:bg-[#1c3a66] border border-cyan-400/50 hover:border-cyan-300 text-cyan-100 rounded-md text-xs font-mono transition-all cursor-pointer min-w-[200px] shadow-sm"
        >
          <div class="flex items-center gap-2 truncate">
            <Monitor class="w-3.5 h-3.5 text-cyan-300 shrink-0 stroke-[2]" />
            <span class="font-normal truncate max-w-[180px]">{{ currentScreen?.name || '选择画面' }}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[9px] px-1 py-0.2 rounded bg-[#0e1e36] text-cyan-300 border border-cyan-500/40 font-light">
              {{ currentScreen?.components?.length || 0 }}组件
            </span>
            <ChevronDown class="w-3.5 h-3.5 text-cyan-300 transition-transform stroke-[2]" :class="{ 'rotate-180': isDropdownOpen }" />
          </div>
        </button>

        <!-- Dropdown Menu Popover -->
        <div
          v-if="isDropdownOpen"
          class="absolute bottom-full left-0 mb-1 w-72 bg-[#132745] border border-cyan-400/60 rounded-lg shadow-2xl overflow-hidden z-50 divide-y divide-cyan-500/30 animate-in fade-in zoom-in-95 duration-100"
        >
          <div class="px-3 py-1.5 bg-[#173055] text-[10px] text-cyan-300 flex items-center justify-between font-light">
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
                <span 
                  v-if="item.id === indexScreenId || (indexScreenName && item.name.toLowerCase() === indexScreenName.toLowerCase())"
                  class="text-[9px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-400/70 font-mono shrink-0"
                  title="登录成功后默认显示的主索引大屏"
                >
                  ★主索引
                </span>
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
          <div class="p-1.5 bg-[#173055] flex items-center gap-1">
            <button
              @click="isDropdownOpen = false; handleOpenAddModal();"
              class="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#1c3a66] hover:bg-cyan-600 hover:text-slate-950 text-cyan-200 border border-cyan-400/50 rounded text-xs font-normal cursor-pointer transition-colors"
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
          class="flex items-center gap-1 px-2 py-1 rounded bg-[#173055] hover:bg-[#1e406f] border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white text-xs font-mono font-light transition-all cursor-pointer shadow-xs"
          title="新建画面页面"
        >
          <Plus class="w-3 h-3 text-cyan-300 stroke-[2]" />
          <span>新建</span>
        </button>

        <!-- Rename Current Screen -->
        <button
          @click="handleOpenRenameModal"
          class="flex items-center gap-1 px-2 py-1 rounded bg-[#173055] hover:bg-[#1e406f] border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white text-xs font-mono font-light transition-all cursor-pointer shadow-xs"
          title="重命名当前画面"
        >
          <Edit3 class="w-3 h-3 text-cyan-300 stroke-[2]" />
          <span>重命名</span>
        </button>

        <!-- Duplicate Current Screen -->
        <button
          @click="handleDuplicateCurrent"
          class="flex items-center gap-1 px-2 py-1 rounded bg-[#173055] hover:bg-[#1e406f] border border-cyan-500/40 hover:border-emerald-400/60 text-cyan-200 hover:text-emerald-200 text-xs font-mono font-light transition-all cursor-pointer shadow-xs"
          title="复制当前画面"
        >
          <Copy class="w-3 h-3 text-emerald-300 stroke-[2]" />
          <span>复制</span>
        </button>

        <!-- Delete Current Screen -->
        <button
          v-if="screens.length > 1"
          @click="handleDeleteCurrent"
          class="flex items-center gap-1 px-2 py-1 rounded bg-[#173055] hover:bg-[#1e406f] border border-cyan-500/40 hover:border-rose-400/60 text-cyan-200 hover:text-rose-200 text-xs font-mono font-light transition-all cursor-pointer shadow-xs"
          title="删除当前画面"
        >
          <Trash2 class="w-3 h-3 text-rose-300 stroke-[2]" />
          <span>删除</span>
        </button>

        <!-- Login Index Screen Toggle Button -->
        <div class="h-4 w-px bg-cyan-500/30 mx-0.5"></div>
        <button
          v-if="!isCurrentIndexScreen && currentScreen"
          @click="emit('set:index-screen', currentScreen.id)"
          class="flex items-center gap-1 px-2 py-1 rounded bg-[#173055] hover:bg-[#1e406f] border border-cyan-500/40 hover:border-amber-400 text-cyan-200 hover:text-amber-200 text-xs font-mono font-light transition-all cursor-pointer shadow-xs"
          title="将当前画面设为用户登录成功后默认展示的主索引大屏界面"
        >
          <Star class="w-3 h-3 text-amber-300 stroke-[2]" />
          <span>设为主索引</span>
        </button>
        <div
          v-else
          class="flex items-center gap-1 px-2 py-1 rounded bg-amber-950/60 border border-amber-400 text-amber-300 text-xs font-mono font-normal shadow-[0_0_8px_rgba(245,158,11,0.25)]"
          title="此大屏为用户登录成功后直接进入的主索引界面"
        >
          <Star class="w-3 h-3 text-amber-300 fill-amber-300 stroke-[2]" />
          <span>登录主索引大屏</span>
        </div>

        <!-- Divider -->
        <div class="h-4 w-px bg-cyan-500/30 mx-0.5"></div>

        <!-- Disk Storage Button -->
        <button
          @click="emit('open:disk-storage')"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#173055] hover:bg-[#1e406f] border border-cyan-400/60 hover:border-cyan-300 text-cyan-200 hover:text-white text-xs font-mono transition-all cursor-pointer shadow-[0_0_8px_rgba(0,242,255,0.15)]"
          title="系统大屏磁盘文件存储管理：位于可执行目录同级 graph/ 文件夹下"
        >
          <HardDrive class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" />
          <span>graph大屏库</span>
          <span class="text-[9px] px-1 py-0.2 rounded bg-[#0e1e36] text-cyan-300 border border-cyan-500/40 font-mono">
            {{ diskFileCount !== undefined ? diskFileCount : screens.length }}文件
          </span>
        </button>

        <!-- Save to Disk Action (仅保存当前这一个大屏) -->
        <button
          @click="emit('save:current-disk')"
          :disabled="isSavingDisk"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#173055] hover:bg-cyan-600 hover:text-slate-950 border border-cyan-400 hover:border-cyan-300 text-cyan-200 text-xs font-mono transition-all cursor-pointer shadow-[0_0_10px_rgba(0,242,255,0.25)] disabled:opacity-50"
          :title="`仅保存当前画面「${currentScreen?.name}」到 graph/${currentScreen?.name}.json`"
        >
          <Save class="w-3.5 h-3.5 text-cyan-300 stroke-[2]" :class="{ 'animate-spin': isSavingDisk }" />
          <span>{{ isSavingDisk ? '保存中...' : '保存大屏' }}</span>
        </button>
      </div>
    </div>

    <!-- Right: Screen Resolution Info -->
    <div class="text-[11px] text-cyan-300/90 flex items-center gap-2 shrink-0 font-light">
      <span>当前画面尺寸: <strong class="text-cyan-100 font-normal">{{ currentScreen?.screen.width || 1980 }}×{{ currentScreen?.screen.height || 1100 }}</strong></span>
    </div>

    <!-- Add Screen Modal -->
    <div 
      v-if="showAddModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div class="bg-[#132745] border border-cyan-400/60 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4 font-mono">
        <h3 class="text-sm font-normal text-cyan-100 flex items-center gap-2 border-b border-cyan-500/30 pb-2">
          <Plus class="w-4 h-4 text-cyan-300 stroke-[2]" />
          <span>新建画面 (默认 1980 × 1100)</span>
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
              class="w-full px-3 py-2 bg-[#173055] border border-cyan-500/50 rounded-lg text-cyan-100 focus:border-cyan-300 focus:outline-hidden font-mono font-light placeholder:text-cyan-500/60"
              autofocus
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-cyan-300 mb-1 font-light">宽度 (px)</label>
              <input 
                type="number" 
                v-model.number="newScreenWidth" 
                class="w-full px-3 py-2 bg-[#173055] border border-cyan-500/50 rounded-lg text-cyan-100 focus:border-cyan-300 focus:outline-hidden font-light"
              />
            </div>
            <div>
              <label class="block text-cyan-300 mb-1 font-light">高度 (px)</label>
              <input 
                type="number" 
                v-model.number="newScreenHeight" 
                class="w-full px-3 py-2 bg-[#173055] border border-cyan-500/50 rounded-lg text-cyan-100 focus:border-cyan-300 focus:outline-hidden font-light"
              />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/30">
          <button 
            @click="showAddModal = false"
            class="px-3 py-1.5 rounded-lg bg-[#173055] hover:bg-[#1c3a66] border border-cyan-500/40 text-cyan-300 text-xs font-light cursor-pointer transition-colors"
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
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div class="bg-[#132745] border border-cyan-400/60 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4 font-mono">
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
              class="w-full px-3 py-2 bg-[#173055] border border-cyan-500/50 rounded-lg text-cyan-100 focus:border-cyan-300 focus:outline-hidden font-mono font-light placeholder:text-cyan-500/60"
              autofocus
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/30">
          <button 
            @click="showRenameModal = false"
            class="px-3 py-1.5 rounded-lg bg-[#173055] hover:bg-[#1c3a66] border border-cyan-500/40 text-cyan-300 text-xs font-light cursor-pointer transition-colors"
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
