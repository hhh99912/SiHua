<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ScreenItem, ScreenComponent } from '../types';
import { 
  Plus, Copy, Trash2, Edit3, Monitor, Layers, 
  ChevronDown, Check, AlertCircle, Layout,
  HardDrive, Save, Folder, Star, Sparkles, Zap,
  FolderDown, CheckCircle2, X
} from 'lucide-vue-next';
import { PRESET_TEMPLATES } from '../data/templates';
import { 
  DiskModelItem, 
  loadTemplatesFromDisk, 
  saveTemplateToDisk 
} from '../utils/modelFileService';

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
  (e: 'add:screen', payload: { 
    name: string; 
    width: number; 
    height: number; 
    templateId?: string;
    templateModel?: DiskModelItem;
  }): void;
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
const showSaveTemplateModal = ref(false);

// 模板检索与状态管理
const availableModels = ref<DiskModelItem[]>([]);
const isLoadingModels = ref(false);
const selectedTemplateValue = ref<string>('__blank_minimal__');

// 新建大屏状态
const newScreenName = ref('');
const newScreenWidth = ref(1980);
const newScreenHeight = ref(1100);
const renameText = ref('');
const errorMessage = ref('');

// 存为模板状态
const saveTemplateName = ref('');
const saveTemplateDesc = ref('');
const saveTemplateCategory = ref('新能源电力');
const isSavingTemplate = ref(false);
const saveTemplateError = ref('');

// 轻量 Toast 提示
const toastMessage = ref('');
let toastTimer: any = null;

const showToast = (msg: string) => {
  toastMessage.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = '';
  }, 3500);
};

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

// 当前选中的模板详情
const selectedModelDetail = computed(() => {
  if (selectedTemplateValue.value === '__blank_minimal__') return null;
  return availableModels.value.find(m => m.id === selectedTemplateValue.value || m.name === selectedTemplateValue.value) || null;
});

// 检查大屏名称是否已被占用
const isNameTaken = (name: string, excludeId?: string) => {
  const normalized = name.trim().toLowerCase();
  return props.screens.some(s => s.id !== excludeId && s.name.trim().toLowerCase() === normalized);
};

// 检索所有模板（从 model/ 目录读取）
const refreshModels = async () => {
  isLoadingModels.value = true;
  try {
    const res = await loadTemplatesFromDisk();
    if (res && res.success && Array.isArray(res.models)) {
      availableModels.value = res.models;
    }
  } catch (err) {
    console.warn('[ScreenManagerBar] 检索模板失败:', err);
  } finally {
    isLoadingModels.value = false;
  }
};

onMounted(() => {
  refreshModels();
});

const handleSelectScreen = (screenId: string) => {
  emit('switch:screen', screenId);
  isDropdownOpen.value = false;
};

// 新建画面弹窗拖拽状态 (仿照 DataAssociationModal.vue 风格)
const addModalPos = ref<{ x: number; y: number }>({ x: 0, y: 0 });
const isDraggingAddModal = ref(false);
let addModalDragStart = { mouseX: 0, mouseY: 0, posX: 0, posY: 0 };

const initAddModalPosition = () => {
  const modalW = 560;
  const modalH = 440;
  addModalPos.value = {
    x: Math.max(16, Math.round((window.innerWidth - modalW) / 2)),
    y: Math.max(20, Math.round((window.innerHeight - modalH) / 2))
  };
};

const onAddModalHeaderMouseDown = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('button, input, select, a')) return;
  isDraggingAddModal.value = true;
  addModalDragStart = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    posX: addModalPos.value.x,
    posY: addModalPos.value.y
  };

  const onMouseMove = (ev: MouseEvent) => {
    if (!isDraggingAddModal.value) return;
    const dx = ev.clientX - addModalDragStart.mouseX;
    const dy = ev.clientY - addModalDragStart.mouseY;
    const modalW = 560;
    const modalH = 440;

    const maxX = Math.max(0, window.innerWidth - modalW - 8);
    const maxY = Math.max(0, window.innerHeight - modalH - 8);

    addModalPos.value = {
      x: Math.min(maxX, Math.max(8, addModalDragStart.posX + dx)),
      y: Math.min(maxY, Math.max(8, addModalDragStart.posY + dy))
    };
  };

  const onMouseUp = () => {
    isDraggingAddModal.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

// 打开新建大屏模态框
const handleOpenAddModal = () => {
  errorMessage.value = '';
  refreshModels();

  // 严格默认无模板创建
  selectedTemplateValue.value = '__blank_minimal__';
  onTemplateSelectChange();
  initAddModalPosition();
  showAddModal.value = true;
};

// 下拉菜单选择变更
const onTemplateSelectChange = () => {
  if (selectedTemplateValue.value === '__blank_minimal__') {
    let idx = props.screens.length + 1;
    let candidate = `新画面 ${idx}`;
    while (isNameTaken(candidate)) {
      idx++;
      candidate = `新画面 ${idx}`;
    }
    newScreenName.value = candidate;
    newScreenWidth.value = 1980;
    newScreenHeight.value = 1100;
  } else {
    const tpl = availableModels.value.find(m => m.id === selectedTemplateValue.value || m.name === selectedTemplateValue.value);
    if (tpl) {
      let baseName = tpl.name;
      let candidate = baseName;
      let counter = 1;
      while (isNameTaken(candidate)) {
        counter++;
        candidate = `${baseName} (${counter})`;
      }
      newScreenName.value = candidate;
      newScreenWidth.value = tpl.screen?.width || 1980;
      newScreenHeight.value = tpl.screen?.height || 1100;
    }
  }
};

// 确认创建新大屏
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

  const isBlank = selectedTemplateValue.value === '__blank_minimal__';
  const modelToUse = isBlank ? undefined : selectedModelDetail.value || undefined;

  emit('add:screen', {
    name: trimmed,
    width: newScreenWidth.value,
    height: newScreenHeight.value,
    templateId: isBlank ? '__blank_minimal__' : selectedTemplateValue.value,
    templateModel: modelToUse
  });

  showAddModal.value = false;
  errorMessage.value = '';
};

// 打开重命名模态框
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

// 打开“作为模板保存”模态框
const handleOpenSaveTemplateModal = () => {
  if (!currentScreen.value) return;
  saveTemplateName.value = currentScreen.value.name;
  saveTemplateDesc.value = `由「${currentScreen.value.name}」导出的标准大屏图元组装模板`;
  saveTemplateCategory.value = '新能源电力';
  saveTemplateError.value = '';
  showSaveTemplateModal.value = true;
};

// 确认保存当前大屏为模板至 model/<name>.json
const handleConfirmSaveTemplate = async () => {
  const name = saveTemplateName.value.trim();
  if (!name) {
    saveTemplateError.value = '模板名称不能为空';
    return;
  }
  if (!currentScreen.value) return;

  isSavingTemplate.value = true;
  saveTemplateError.value = '';

  try {
    const res = await saveTemplateToDisk({
      name,
      description: saveTemplateDesc.value.trim(),
      category: saveTemplateCategory.value,
      screen: currentScreen.value.screen,
      components: currentScreen.value.components
    });

    if (res.success) {
      showSaveTemplateModal.value = false;
      showToast(`大屏已成功保存为模板！存储于 model/${res.filename || name + '.json'}`);
      await refreshModels();
    } else {
      saveTemplateError.value = res.error || '保存模板失败';
    }
  } catch (err: any) {
    saveTemplateError.value = err?.message || '保存模板异常';
  } finally {
    isSavingTemplate.value = false;
  }
};
</script>

<template>
  <div class="h-10.5 bg-[#ebe4d4] border-t border-[#cfc5b0] flex items-center justify-between px-3 z-30 select-none font-sans text-slate-800 shadow-2xs relative tracking-wide">
    <!-- Toast 通知浮层 -->
    <div 
      v-if="toastMessage" 
      class="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200 pointer-events-none"
    >
      <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
      <span>{{ toastMessage }}</span>
    </div>

    <!-- Left: Dropdown Screen Switcher & Quick Actions -->
    <div class="flex items-center gap-2.5">
      <!-- Label -->
      <div class="flex items-center gap-2 text-[13px] text-slate-700 font-bold px-1 shrink-0">
        <Layout class="w-4 h-4 text-sky-700 stroke-[2]" />
        <span>画面列表:</span>
      </div>

      <!-- Dropdown Screen Selector Trigger -->
      <div class="relative">
        <button
          @click="isDropdownOpen = !isDropdownOpen"
          class="flex items-center justify-between gap-2.5 px-3 py-1.5 bg-[#f4efe4] hover:bg-[#eae3d2] border border-[#cfc5b0] text-slate-800 rounded-lg text-[13px] font-bold transition-colors cursor-pointer min-w-[210px] shadow-2xs tracking-wide"
        >
          <div class="flex items-center gap-2 truncate">
            <Monitor class="w-4 h-4 text-sky-700 shrink-0 stroke-[2]" />
            <span class="font-bold truncate max-w-[180px]">{{ currentScreen?.name || '选择画面' }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[11px] px-1.5 py-0.2 rounded bg-[#eae3d2] text-slate-700 border border-[#cfc5b0] font-mono font-bold">
              {{ currentScreen?.components?.length || 0 }}图元
            </span>
            <ChevronDown class="w-4 h-4 text-slate-500 transition-transform stroke-[2]" :class="{ 'rotate-180': isDropdownOpen }" />
          </div>
        </button>

        <!-- Dropdown Menu Popover -->
        <div
          v-if="isDropdownOpen"
          class="absolute bottom-full left-0 mb-1.5 w-80 bg-[#f4efe4] border border-[#cfc5b0] rounded-xl shadow-xl overflow-hidden z-50 divide-y divide-[#ded5bf] animate-in fade-in zoom-in-95 duration-100 text-slate-800 tracking-wide"
        >
          <div class="px-3.5 py-2 bg-[#eae3d2] text-xs text-slate-700 flex items-center justify-between font-bold">
            <span>切换监控画面 (共 {{ screens.length }} 画面)</span>
            <span class="text-slate-500 font-normal">名称唯一识别</span>
          </div>

          <div class="max-h-64 overflow-y-auto p-1.5 space-y-1">
            <button
              v-for="item in screens"
              :key="item.id"
              @click="handleSelectScreen(item.id)"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] text-left cursor-pointer transition-colors"
              :class="item.id === activeScreenId 
                ? 'bg-sky-100 text-sky-900 font-bold border border-sky-300' 
                : 'text-slate-700 hover:bg-[#eae3d2] border border-transparent'"
            >
              <div class="flex items-center gap-2.5 truncate">
                <Monitor class="w-4 h-4 shrink-0 stroke-[2]" :class="item.id === activeScreenId ? 'text-sky-700' : 'text-slate-500'" />
                <span class="truncate">{{ item.name }}</span>
                <span 
                  v-if="item.id === indexScreenId || (indexScreenName && item.name.toLowerCase() === indexScreenName.toLowerCase())"
                  class="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 font-mono shrink-0 font-bold"
                  title="登录成功后默认显示的主索引大屏"
                >
                  ★主索引
                </span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-[11px] text-slate-500 font-mono font-medium">
                  {{ item.components?.length || 0 }} 项
                </span>
                <Check v-if="item.id === activeScreenId" class="w-4 h-4 text-sky-700 stroke-[2.5]" />
              </div>
            </button>
          </div>

          <!-- Bottom Action in Dropdown -->
          <div class="p-2 bg-[#eae3d2] flex items-center gap-1">
            <button
              @click="isDropdownOpen = false; handleOpenAddModal();"
              class="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#f4efe4] hover:bg-sky-100 text-sky-800 border border-[#cfc5b0] rounded-lg text-[13px] font-bold cursor-pointer transition-colors shadow-2xs"
            >
              <Plus class="w-4 h-4 text-sky-700 stroke-[2]" />
              <span>新建画面</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center gap-1 pl-2 border-l border-[#cfc5b0]">
        <!-- Add Screen -->
        <button
          @click="handleOpenAddModal"
          class="p-1.5 rounded-md bg-[#f4efe4] hover:bg-[#eae3d2] border border-[#cfc5b0] text-slate-700 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center"
          title="新建画面页面"
        >
          <Plus class="w-4 h-4 text-sky-700 stroke-[2]" />
        </button>

        <!-- Rename Current Screen -->
        <button
          @click="handleOpenRenameModal"
          class="p-1.5 rounded-md bg-[#f4efe4] hover:bg-[#eae3d2] border border-[#cfc5b0] text-slate-700 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center"
          title="重命名当前画面"
        >
          <Edit3 class="w-4 h-4 text-slate-600 stroke-[2]" />
        </button>

        <!-- Duplicate Current Screen -->
        <button
          @click="handleDuplicateCurrent"
          class="p-1.5 rounded-md bg-[#f4efe4] hover:bg-[#eae3d2] border border-[#cfc5b0] text-slate-700 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center"
          title="复制当前画面"
        >
          <Copy class="w-4 h-4 text-emerald-700 stroke-[2]" />
        </button>

        <!-- Delete Current Screen -->
        <button
          v-if="screens.length > 1"
          @click="handleDeleteCurrent"
          class="p-1.5 rounded-md bg-[#f4efe4] hover:bg-rose-100 border border-[#cfc5b0] text-slate-700 hover:text-rose-700 transition-colors cursor-pointer flex items-center justify-center"
          title="删除当前画面"
        >
          <Trash2 class="w-4 h-4 text-rose-600 stroke-[2]" />
        </button>

        <!-- Save As Template (存为模板到 model/) -->
        <button
          @click="handleOpenSaveTemplateModal"
          class="p-1.5 rounded-md bg-[#f4efe4] hover:bg-amber-100 border border-[#cfc5b0] text-slate-700 hover:text-amber-800 transition-colors cursor-pointer flex items-center justify-center"
          title="将当前画面的完整图元组装保存为模板 (model/ 目录)"
        >
          <FolderDown class="w-4 h-4 text-amber-700 stroke-[2]" />
        </button>

        <!-- Login Index Screen Toggle Button -->
        <div class="h-4 w-px bg-[#cfc5b0] mx-1"></div>
        <button
          v-if="!isCurrentIndexScreen && currentScreen"
          @click="emit('set:index-screen', currentScreen.id)"
          class="p-1.5 rounded-md bg-[#f4efe4] hover:bg-amber-100 border border-[#cfc5b0] text-slate-700 hover:text-amber-800 transition-colors cursor-pointer flex items-center justify-center"
          title="将当前画面设为用户登录后默认展示的主索引大屏"
        >
          <Star class="w-4 h-4 text-amber-600 stroke-[2]" />
        </button>
        <div
          v-else
          class="p-1.5 rounded-md bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center"
          title="当前画面已是登录主索引大屏"
        >
          <Star class="w-4 h-4 text-amber-700 fill-amber-500 stroke-[2]" />
        </div>

        <div class="h-4 w-px bg-[#cfc5b0] mx-1"></div>

        <!-- Open Disk Storage Library -->
        <button
          @click="emit('open:disk-storage')"
          class="p-1.5 rounded-md bg-[#f4efe4] hover:bg-[#eae3d2] border border-[#cfc5b0] text-slate-700 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center"
          title="磁盘文件管理 (graph/)"
        >
          <HardDrive class="w-4 h-4 text-sky-700 stroke-[2]" />
        </button>

        <!-- Save to Disk Action (仅保存当前这一个画面) -->
        <button
          @click="emit('save:current-disk')"
          :disabled="isSavingDisk"
          class="p-1.5 rounded-md bg-[#f4efe4] hover:bg-sky-100 border border-[#cfc5b0] text-slate-700 hover:text-sky-800 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
          :title="isSavingDisk ? '保存中...' : `保存当前画面「${currentScreen?.name}」到 graph/${currentScreen?.name}.json`"
        >
          <Save class="w-4 h-4 text-sky-700 stroke-[2]" :class="{ 'animate-spin': isSavingDisk }" />
        </button>
      </div>
    </div>

    <!-- Right: Screen Resolution Info & Model Directory indicator -->
    <div class="text-[13px] text-slate-600 flex items-center gap-3.5 shrink-0 font-medium">
      <span class="flex items-center gap-1.5 text-slate-600">
        <Folder class="w-4 h-4 text-amber-600" />
        模板库: <strong class="text-slate-800 font-bold">model/ ({{ availableModels.length }}个)</strong>
      </span>
      <span class="text-slate-600 font-mono">尺寸: <strong class="text-slate-900 font-bold">{{ currentScreen?.screen.width || 1980 }}×{{ currentScreen?.screen.height || 1100 }}</strong></span>
    </div>

    <!-- ==================== 1. 新建画面弹窗 (仿照数据关联配置中心风格重构：纯黑底色、可拖动、去除所有蓝色边框特效) ==================== -->
    <Teleport to="body">
      <div 
        v-if="showAddModal" 
        class="fixed inset-0 z-[9999] pointer-events-none select-none font-sans"
      >
        <div 
          class="pointer-events-auto absolute bg-black text-white rounded-lg border border-neutral-700 shadow-2xl flex flex-col overflow-hidden w-[540px]"
          :style="{
            left: `${addModalPos.x}px`,
            top: `${addModalPos.y}px`
          }"
        >
          <!-- Header (可拖拽，纯黑色系工业风格，对齐数据关联配置中心) -->
          <header 
            @mousedown="onAddModalHeaderMouseDown"
            class="h-11 px-3.5 bg-[#111111] border-b border-[#2a2a2a] flex items-center justify-between shrink-0 cursor-move select-none"
            title="按住鼠标左键可拖动"
          >
            <div class="flex items-center gap-2.5 min-w-0 pr-3">
              <div class="w-2.5 h-2.5 rounded-full bg-white shrink-0"></div>
              <span class="text-sm sm:text-base font-bold text-white tracking-normal truncate drop-shadow-xs">
                新建画面
              </span>
            </div>
            <!-- 关闭按钮 -->
            <button
              @click="showAddModal = false"
              class="w-7 h-7 rounded flex items-center justify-center text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-600 transition-colors cursor-pointer"
              title="关闭窗口"
            >
              <X class="w-4 h-4" />
            </button>
          </header>

          <!-- Body (纯黑/深灰工业底色，去除所有蓝色边框特效) -->
          <div class="p-5 space-y-4 bg-[#0a0a0a]">
            <!-- 错误提示 -->
            <div 
              v-if="errorMessage" 
              class="p-3 bg-rose-950/80 border border-rose-600 text-rose-200 text-sm font-semibold rounded flex items-center gap-2"
            >
              <AlertCircle class="w-4.5 h-4.5 shrink-0 text-rose-400" />
              <span>{{ errorMessage }}</span>
            </div>

            <!-- 选择模板 -->
            <div>
              <label class="block text-sm font-medium text-neutral-300 mb-1.5">选择模板</label>
              <select
                v-model="selectedTemplateValue"
                @change="onTemplateSelectChange"
                class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:border-neutral-500 font-medium cursor-pointer"
              >
                <option value="__blank_minimal__">无模板创建 (空白工程)</option>
                <optgroup v-if="availableModels.length > 0" label="model/ 模板文件">
                  <option 
                    v-for="tpl in availableModels" 
                    :key="tpl.id" 
                    :value="tpl.id"
                  >
                    {{ tpl.name }} ({{ tpl.components?.length || 0 }} 个组件)
                  </option>
                </optgroup>
              </select>
            </div>

            <!-- 画面名称 -->
            <div>
              <label class="block text-sm font-medium text-neutral-300 mb-1.5">画面名称</label>
              <input 
                v-model="newScreenName"
                @input="errorMessage = ''"
                @keydown.enter="handleConfirmAdd"
                placeholder="请输入画面名称"
                class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 font-medium"
                autofocus
              />
            </div>

            <!-- 尺寸设置 -->
            <div class="grid grid-cols-2 gap-3.5">
              <div>
                <label class="block text-sm font-medium text-neutral-300 mb-1.5">宽度 (px)</label>
                <input 
                  type="number" 
                  v-model.number="newScreenWidth" 
                  class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-white font-mono font-medium focus:outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-neutral-300 mb-1.5">高度 (px)</label>
                <input 
                  type="number" 
                  v-model.number="newScreenHeight" 
                  class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-white font-mono font-medium focus:outline-none focus:border-neutral-500"
                />
              </div>
            </div>
          </div>

          <!-- Footer (深灰边框、黑底、高对比清晰操作按钮) -->
          <footer class="px-4 py-3 bg-[#111111] border-t border-[#2a2a2a] flex items-center justify-end gap-2.5 shrink-0">
            <button 
              @click="showAddModal = false"
              class="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded font-medium transition-colors cursor-pointer border border-neutral-600 text-sm"
            >
              取消
            </button>
            <button 
              @click="handleConfirmAdd"
              class="px-5 py-2 bg-neutral-100 hover:bg-white text-neutral-900 rounded font-semibold transition-colors cursor-pointer border border-neutral-300 text-sm flex items-center gap-1.5 shadow-xs"
            >
              <Check class="w-4 h-4" />
              <span>确认创建</span>
            </button>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- ==================== 2. 存为模板弹窗 ==================== -->
    <div 
      v-if="showSaveTemplateModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 font-sans select-none"
      style="transform: translateZ(0); will-change: transform;"
    >
      <div 
        class="bg-[#0e172a] border-2 border-sky-400 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden text-white"
        style="contain: paint layout;"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b-2 border-slate-700 bg-[#080d1a] flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 rounded-full bg-amber-400"></div>
            <h2 class="text-lg font-bold tracking-wide text-white">存为模板 (model/ 目录)</h2>
          </div>
          <button
            @click="showSaveTemplateModal = false"
            class="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X class="w-6 h-6" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5 bg-[#0a1120]">
          <div 
            v-if="saveTemplateError" 
            class="p-3.5 bg-rose-950 border border-rose-400 text-rose-200 text-sm font-bold rounded-xl flex items-center gap-2"
          >
            <AlertCircle class="w-5 h-5 shrink-0 text-rose-400" />
            <span>{{ saveTemplateError }}</span>
          </div>

          <div>
            <label class="block text-sm font-bold text-sky-300 mb-2">模板名称</label>
            <input 
              v-model="saveTemplateName"
              @input="saveTemplateError = ''"
              @keydown.enter="handleConfirmSaveTemplate"
              placeholder="请输入模板名称"
              class="w-full px-4 py-2.5 bg-[#111c34] border border-sky-400 rounded-xl text-base text-white placeholder-slate-400 focus:outline-none focus:border-sky-300 font-bold shadow-inner"
              autofocus
            />
          </div>

          <div>
            <label class="block text-sm font-bold text-sky-300 mb-2">模板分类</label>
            <select 
              v-model="saveTemplateCategory"
              class="w-full px-4 py-2.5 bg-[#111c34] border border-sky-400 rounded-xl text-base text-white focus:outline-none focus:border-sky-300 font-bold shadow-inner cursor-pointer"
            >
              <option value="新能源电力">新能源电力</option>
              <option value="智能制造">智能制造</option>
              <option value="市政水务">市政水务</option>
              <option value="通用模板">通用模板</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-bold text-sky-300 mb-2">模板描述 (可选)</label>
            <textarea 
              v-model="saveTemplateDesc"
              rows="2"
              placeholder="请输入模板描述信息"
              class="w-full px-4 py-2.5 bg-[#111c34] border border-sky-400 rounded-xl text-base text-white placeholder-slate-400 focus:outline-none focus:border-sky-300 font-bold shadow-inner resize-none"
            ></textarea>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t-2 border-slate-700 bg-[#080d1a] flex items-center justify-end gap-3 shrink-0">
          <button 
            @click="showSaveTemplateModal = false"
            class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors cursor-pointer border border-slate-600 text-sm"
          >
            取消
          </button>
          <button 
            @click="handleConfirmSaveTemplate"
            :disabled="isSavingTemplate"
            class="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition-colors shadow-lg cursor-pointer border border-amber-400 text-sm disabled:opacity-50"
          >
            {{ isSavingTemplate ? '保存中...' : '确认存为模板' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== 3. 重命名大屏弹窗 ==================== -->
    <div 
      v-if="showRenameModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 font-sans select-none"
      style="transform: translateZ(0); will-change: transform;"
    >
      <div 
        class="bg-[#0e172a] border-2 border-sky-400 rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden text-white"
        style="contain: paint layout;"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b-2 border-slate-700 bg-[#080d1a] flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 rounded-full bg-sky-400"></div>
            <h2 class="text-lg font-bold tracking-wide text-white">重命名画面</h2>
          </div>
          <button
            @click="showRenameModal = false"
            class="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X class="w-6 h-6" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5 bg-[#0a1120]">
          <div 
            v-if="errorMessage" 
            class="p-3.5 bg-rose-950 border border-rose-400 text-rose-200 text-sm font-bold rounded-xl flex items-center gap-2"
          >
            <AlertCircle class="w-5 h-5 shrink-0 text-rose-400" />
            <span>{{ errorMessage }}</span>
          </div>

          <div>
            <label class="block text-sm font-bold text-sky-300 mb-2">新的画面名称</label>
            <input 
              v-model="renameText"
              @input="errorMessage = ''"
              @keydown.enter="handleConfirmRename"
              placeholder="请输入新的画面名称"
              class="w-full px-4 py-2.5 bg-[#111c34] border border-sky-400 rounded-xl text-base text-white placeholder-slate-400 focus:outline-none focus:border-sky-300 font-bold shadow-inner"
              autofocus
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t-2 border-slate-700 bg-[#080d1a] flex items-center justify-end gap-3 shrink-0">
          <button 
            @click="showRenameModal = false"
            class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors cursor-pointer border border-slate-600 text-sm"
          >
            取消
          </button>
          <button 
            @click="handleConfirmRename"
            class="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold transition-colors shadow-lg cursor-pointer border border-sky-400 text-sm"
          >
            确认修改
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
