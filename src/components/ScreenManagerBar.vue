<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ScreenItem, ScreenComponent } from '../types';
import { 
  Plus, Copy, Trash2, Edit3, Monitor, Layers, 
  ChevronDown, Check, AlertCircle, Layout,
  HardDrive, Save, Folder, Star, Sparkles, Zap,
  FolderDown, CheckCircle2
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

// 打开新建大屏模态框
const handleOpenAddModal = () => {
  errorMessage.value = '';
  refreshModels();

  // 默认选中 35kV高压光伏模板 或 无模板
  const pvTpl = availableModels.value.find(m => m.id === 'tpl-pv-high-voltage' || m.name.includes('光伏') || m.name.includes('高压'));
  if (pvTpl) {
    selectedTemplateValue.value = pvTpl.id;
  } else if (availableModels.value.length > 0) {
    selectedTemplateValue.value = availableModels.value[0].id;
  } else {
    selectedTemplateValue.value = '__blank_minimal__';
  }

  onTemplateSelectChange();
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
  <div class="h-10 bg-[#132745] border-t border-cyan-500/40 flex items-center justify-between px-3 z-30 select-none font-mono shadow-sm relative">
    <!-- Toast 通知浮层 -->
    <div 
      v-if="toastMessage" 
      class="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-950/95 border border-emerald-400 text-emerald-200 text-xs rounded-lg shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200 pointer-events-none"
    >
      <CheckCircle2 class="w-4 h-4 text-emerald-300 shrink-0" />
      <span>{{ toastMessage }}</span>
    </div>

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

        <!-- Save As Template (存为模板到 model/) -->
        <button
          @click="handleOpenSaveTemplateModal"
          class="flex items-center gap-1 px-2 py-1 rounded bg-[#173055] hover:bg-[#1e406f] border border-cyan-500/40 hover:border-amber-400 text-cyan-200 hover:text-amber-200 text-xs font-mono font-light transition-all cursor-pointer shadow-xs"
          title="将当前画面的完整图元组装保存为独立模板 JSON 文件，存储于 model/ 目录"
        >
          <FolderDown class="w-3 h-3 text-amber-300 stroke-[2]" />
          <span>存为模板</span>
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

        <div class="h-4 w-px bg-cyan-500/30 mx-0.5"></div>

        <!-- Open Disk Storage Library -->
        <button
          @click="emit('open:disk-storage')"
          class="flex items-center gap-1 px-2 py-1 rounded bg-[#173055] hover:bg-[#1e406f] border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-cyan-100 text-xs font-mono font-light transition-all cursor-pointer shadow-xs"
          title="管理磁盘 graph/ 目录下的所有独立大屏 JSON 文件"
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

    <!-- Right: Screen Resolution Info & Model Directory indicator -->
    <div class="text-[11px] text-cyan-300/90 flex items-center gap-3 shrink-0 font-light">
      <span class="text-cyan-400/80 flex items-center gap-1">
        <Folder class="w-3 h-3 text-cyan-400" />
        模板库: <strong class="text-cyan-200 font-normal">model/ ({{ availableModels.length }}个)</strong>
      </span>
      <span>当前画面尺寸: <strong class="text-cyan-100 font-normal">{{ currentScreen?.screen.width || 1980 }}×{{ currentScreen?.screen.height || 1100 }}</strong></span>
    </div>

    <!-- ==================== 1. 新建大屏弹窗 (以下拉菜单形式选择模板，亦可无模板加极简方框) ==================== -->
    <div 
      v-if="showAddModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div class="bg-[#132745] border border-cyan-400/60 rounded-xl w-full max-w-xl p-5 shadow-2xl space-y-4 font-mono my-auto">
        <div class="flex items-center justify-between border-b border-cyan-500/30 pb-3">
          <h3 class="text-sm font-normal text-cyan-100 flex items-center gap-2">
            <Plus class="w-4 h-4 text-cyan-300 stroke-[2]" />
            <span>新建大屏画面</span>
          </h3>
          <span class="text-[11px] text-cyan-400/70 font-light">
            检索自 model/ 独立模板库
          </span>
        </div>

        <div v-if="errorMessage" class="p-2.5 rounded-lg bg-rose-950/80 border border-rose-400/70 text-rose-200 text-xs flex items-center gap-2 font-light">
          <AlertCircle class="w-4 h-4 text-rose-300 shrink-0 stroke-[2]" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- 模板选择：下拉菜单形式 (核心需求) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-xs text-cyan-300 font-light">
              选择大屏模板 *
            </label>
            <button 
              type="button" 
              @click="refreshModels" 
              class="text-[10px] text-cyan-400 hover:text-cyan-200 underline cursor-pointer"
            >
              刷新模板目录 (model/)
            </button>
          </div>

          <div class="relative">
            <select
              v-model="selectedTemplateValue"
              @change="onTemplateSelectChange"
              class="w-full px-3 py-2.5 bg-[#173055] border border-cyan-400/70 hover:border-cyan-300 focus:border-cyan-300 rounded-lg text-cyan-100 text-xs font-mono cursor-pointer focus:outline-hidden transition-colors"
            >
              <!-- 选项 1: 无模板创建 (自动加极简方框) -->
              <option value="__blank_minimal__">
                ⚪ 无模板创建 (自动加极简方框)
              </option>

              <!-- 选项 2+: 从 model/ 检索到的所有模板 -->
              <optgroup v-if="availableModels.length > 0" label="已检索到的模板库 (存储于 model/*.json)">
                <option 
                  v-for="tpl in availableModels" 
                  :key="tpl.id" 
                  :value="tpl.id"
                >
                  ⚡ {{ tpl.category ? `[${tpl.category}] ` : '' }}{{ tpl.name }} ({{ tpl.components?.length || 0 }}个组件)
                </option>
              </optgroup>
            </select>
          </div>

          <!-- 所选模板的信息预览或无模板说明 -->
          <div class="p-3 rounded-lg bg-[#0e1f38] border border-cyan-500/30 text-xs space-y-1.5">
            <div v-if="selectedTemplateValue === '__blank_minimal__'">
              <div class="flex items-center gap-1.5 text-cyan-200 font-medium">
                <Monitor class="w-3.5 h-3.5 text-cyan-300" />
                <span>无模板创建模式</span>
              </div>
              <p class="text-[11px] text-cyan-300/75 leading-relaxed pt-0.5">
                创建空白画布，系统将按规范<strong class="text-cyan-100 font-normal">自动在画布添加一个极简工控方框（deco-border-minimal）图元</strong>，无任何写死卡片，可直接通过左侧物料库进行自由拼接复刻。
              </p>
            </div>

            <div v-else-if="selectedModelDetail">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 text-cyan-100 font-medium">
                  <Sparkles class="w-3.5 h-3.5 text-amber-400" />
                  <span>{{ selectedModelDetail.name }}</span>
                </div>
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-[#173055] text-cyan-300 border border-cyan-500/40">
                  {{ selectedModelDetail.category || '工业电力' }} · {{ selectedModelDetail.components?.length || 0 }} 个组件
                </span>
              </div>
              <p class="text-[11px] text-cyan-300/80 leading-relaxed pt-0.5">
                {{ selectedModelDetail.description || '由现有基础几何与标准电气图元原子拼装制作。' }}
              </p>
              <div class="text-[10px] text-cyan-400/60 font-mono pt-1 border-t border-cyan-500/20 flex items-center justify-between">
                <span>来源文件: model/{{ selectedModelDetail.filename || selectedModelDetail.name + '.json' }}</span>
                <span>推荐画布: {{ selectedModelDetail.screen?.width || 1980 }}×{{ selectedModelDetail.screen?.height || 1100 }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 基础参数输入 Section -->
        <div class="space-y-3 text-xs pt-1">
          <div>
            <label class="block text-cyan-300 mb-1 font-light">画面名称 * (不可重复)</label>
            <input 
              v-model="newScreenName"
              @input="errorMessage = ''"
              @keydown.enter="handleConfirmAdd"
              placeholder="例如：35kV高压光伏一次系统图"
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

        <div class="flex items-center justify-between gap-2 pt-3 border-t border-cyan-500/30">
          <div class="text-[11px] text-cyan-400/70 font-light">
            <span v-if="selectedTemplateValue !== '__blank_minimal__'">⚡ 模板图元将完整克隆至新画面，支持二次自由编辑</span>
            <span v-else>⚪ 自动预置一个极简工控方框，其余留空</span>
          </div>

          <div class="flex items-center gap-2">
            <button 
              @click="showAddModal = false"
              class="px-3.5 py-1.5 rounded-lg bg-[#173055] hover:bg-[#1c3a66] border border-cyan-500/40 text-cyan-300 text-xs font-light cursor-pointer transition-colors"
            >
              取消
            </button>
            <button 
              @click="handleConfirmAdd"
              class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-xs cursor-pointer shadow-md transition-colors flex items-center gap-1.5"
            >
              <Plus class="w-3.5 h-3.5 stroke-[2.5]" />
              <span>立即创建</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 2. 存为模板弹窗 (存储为 model/<name>.json) ==================== -->
    <div 
      v-if="showSaveTemplateModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
    >
      <div class="bg-[#132745] border border-cyan-400/60 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4 font-mono">
        <div class="flex items-center justify-between border-b border-cyan-500/30 pb-2">
          <h3 class="text-sm font-normal text-cyan-100 flex items-center gap-2">
            <FolderDown class="w-4 h-4 text-amber-300 stroke-[2]" />
            <span>将当前画面存为模板</span>
          </h3>
          <span class="text-[10px] px-1.5 py-0.2 rounded bg-[#0b172a] text-cyan-300 border border-cyan-500/30">
            存储至 model/ 目录
          </span>
        </div>

        <div v-if="saveTemplateError" class="p-2.5 rounded-lg bg-rose-950/80 border border-rose-400/70 text-rose-200 text-xs flex items-center gap-2 font-light">
          <AlertCircle class="w-4 h-4 text-rose-300 shrink-0 stroke-[2]" />
          <span>{{ saveTemplateError }}</span>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-cyan-300 mb-1 font-light">自定义模板名称 * (唯一区分)</label>
            <input 
              v-model="saveTemplateName"
              @input="saveTemplateError = ''"
              @keydown.enter="handleConfirmSaveTemplate"
              placeholder="例如：35kV高压光伏进线系统模板"
              class="w-full px-3 py-2 bg-[#173055] border border-cyan-500/50 rounded-lg text-cyan-100 focus:border-cyan-300 focus:outline-hidden font-mono font-light placeholder:text-cyan-500/60"
              autofocus
            />
            <p class="text-[10px] text-cyan-400/60 mt-1">
              将生成并持久化存储为文件：<code class="text-cyan-200 font-mono">model/{{ saveTemplateName ? saveTemplateName.trim() + '.json' : '未命名模板.json' }}</code>
            </p>
          </div>

          <div>
            <label class="block text-cyan-300 mb-1 font-light">模板分类</label>
            <select 
              v-model="saveTemplateCategory"
              class="w-full px-3 py-2 bg-[#173055] border border-cyan-500/50 rounded-lg text-cyan-100 focus:border-cyan-300 focus:outline-hidden font-mono font-light"
            >
              <option value="新能源电力">新能源电力 (光伏/风电/变电站)</option>
              <option value="智能制造">智能制造 (工厂/PLC/机床)</option>
              <option value="市政水务">市政水务 (泵站/管网/水厂)</option>
              <option value="自定义模板">自定义模板 (通用)</option>
            </select>
          </div>

          <div>
            <label class="block text-cyan-300 mb-1 font-light">模板描述 (可选)</label>
            <textarea 
              v-model="saveTemplateDesc"
              rows="2"
              placeholder="简述该模板的图元组成、电压等级及适用场景..."
              class="w-full px-3 py-1.5 bg-[#173055] border border-cyan-500/50 rounded-lg text-cyan-100 focus:border-cyan-300 focus:outline-hidden font-mono font-light placeholder:text-cyan-500/60 resize-none"
            ></textarea>
          </div>

          <div class="p-2.5 rounded bg-[#0b172a] border border-cyan-500/20 text-[11px] text-cyan-300/80 leading-relaxed">
            💡 包含当前画面全部 <strong class="text-cyan-100">{{ currentScreen?.components?.length || 0 }} 个图元</strong> 与画布配置。保存后，系统项目启动检索将自动载入，添加新大屏时可在下拉菜单中选用。
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/30">
          <button 
            @click="showSaveTemplateModal = false"
            class="px-3 py-1.5 rounded-lg bg-[#173055] hover:bg-[#1c3a66] border border-cyan-500/40 text-cyan-300 text-xs font-light cursor-pointer transition-colors"
          >
            取消
          </button>
          <button 
            @click="handleConfirmSaveTemplate"
            :disabled="isSavingTemplate"
            class="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-normal text-xs cursor-pointer shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save class="w-3.5 h-3.5 stroke-[2]" :class="{ 'animate-spin': isSavingTemplate }" />
            <span>{{ isSavingTemplate ? '保存中...' : '确认存为模板' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== 3. 重命名大屏弹窗 ==================== -->
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
