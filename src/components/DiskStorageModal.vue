<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import {
  HardDrive,
  RefreshCw,
  Save,
  Check,
  AlertCircle,
  X,
  FileJson,
  FolderOpen,
  Star,
  ShieldCheck,
  ShieldAlert,
  Info,
  Search,
  Maximize2,
  Minimize2
} from 'lucide-vue-next';
import { ScreenItem } from '../types';
import {
  getDiskStorageConfig,
  saveScreenToDisk,
  loadScreensFromDisk,
  setIndexScreen,
  resetPresetScreensOnDisk,
  openDiskStorageDir,
  DiskStorageConfig
} from '../utils/screenFileService';
import { isElectron, safeConfirm } from '../utils/platform';

interface Props {
  visible: boolean;
  screens: ScreenItem[];
  activeScreenId: string;
  indexScreenId?: string;
  indexScreenName?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'reload:screens', screens: ScreenItem[]): void;
  (e: 'update:index-screen', payload: { indexScreenName: string; indexScreenId: string }): void;
  (e: 'notify', msg: string): void;
}>();

const config = ref<DiskStorageConfig>({
  storageDir: 'graph',
  absolutePath: 'graph',
  fileCount: 0,
  files: []
});

const isSavingCurrent = ref(false);
const isReloading = ref(false);
const statusMessage = ref('');
const statusType = ref<'success' | 'error' | 'info'>('info');

const selectedIndexScreenId = ref<string>('');
const searchQuery = ref('');

// 弹框拖拽与尺寸管理 (与数据关联弹框风格一致)
const modalRef = ref<HTMLElement | null>(null);
const isMaximized = ref(false);
const isDragging = ref(false);
const modalPos = ref({ x: 0, y: 0 });
const modalSize = ref({ width: 920, height: 640 });
let dragStart = { mouseX: 0, mouseY: 0, posX: 0, posY: 0 };
let preMaxState = { x: 0, y: 0, width: 920, height: 640 };

const initModalPosition = () => {
  const w = Math.min(window.innerWidth - 32, 920);
  const h = Math.min(window.innerHeight - 32, 640);
  modalSize.value = { width: w, height: h };
  modalPos.value = {
    x: Math.max(16, (window.innerWidth - w) / 2),
    y: Math.max(16, (window.innerHeight - h) / 2)
  };
};

const toggleMaximize = () => {
  if (!isMaximized.value) {
    preMaxState = {
      x: modalPos.value.x,
      y: modalPos.value.y,
      width: modalSize.value.width,
      height: modalSize.value.height
    };
    modalPos.value = { x: 8, y: 8 };
    modalSize.value = {
      width: window.innerWidth - 16,
      height: window.innerHeight - 16
    };
    isMaximized.value = true;
  } else {
    isMaximized.value = false;
    modalPos.value = { x: preMaxState.x, y: preMaxState.y };
    modalSize.value = { width: preMaxState.width, height: preMaxState.height };
  }
};

const onHeaderMouseDown = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('button, input, select, a')) return;

  if (isMaximized.value) {
    const restoreW = preMaxState.width;
    const restoreH = preMaxState.height;
    isMaximized.value = false;
    modalSize.value = { width: restoreW, height: restoreH };
    modalPos.value = {
      x: Math.max(8, Math.min(window.innerWidth - restoreW - 8, e.clientX - restoreW / 2)),
      y: Math.max(8, Math.min(window.innerHeight - restoreH - 8, e.clientY - 18))
    };
  }

  isDragging.value = true;
  dragStart = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    posX: modalPos.value.x,
    posY: modalPos.value.y
  };

  const onMouseMove = (ev: MouseEvent) => {
    if (!isDragging.value) return;
    const dx = ev.clientX - dragStart.mouseX;
    const dy = ev.clientY - dragStart.mouseY;
    const modalW = modalSize.value.width;
    const modalH = modalSize.value.height;

    const maxX = Math.max(0, window.innerWidth - modalW - 8);
    const maxY = Math.max(0, window.innerHeight - modalH - 8);

    modalPos.value = {
      x: Math.min(maxX, Math.max(8, dragStart.posX + dx)),
      y: Math.min(maxY, Math.max(8, dragStart.posY + dy))
    };
  };

  const onMouseUp = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const filteredFiles = computed(() => {
  const list = config.value.files || [];
  if (!searchQuery.value.trim()) return list;
  const q = searchQuery.value.trim().toLowerCase();
  return list.filter(f => f.filename.toLowerCase().includes(q) || (f.screenName && f.screenName.toLowerCase().includes(q)));
});

const currentActiveScreen = computed(() => {
  return props.screens.find(s => s.id === props.activeScreenId) || props.screens[0];
});

const refreshConfig = async () => {
  try {
    const cfg = await getDiskStorageConfig();
    config.value = cfg;
    if (cfg.indexScreen?.indexScreenId) {
      selectedIndexScreenId.value = cfg.indexScreen.indexScreenId;
    } else if (props.indexScreenId) {
      selectedIndexScreenId.value = props.indexScreenId;
    }
  } catch (err: any) {
    console.warn('获取磁盘配置失败:', err);
  }
};

watch(
  () => props.visible,
  (val) => {
    if (val) {
      initModalPosition();
      statusMessage.value = '';
      if (props.indexScreenId) {
        selectedIndexScreenId.value = props.indexScreenId;
      }
      refreshConfig();
    }
  },
  { immediate: true }
);

// 切换/设置登录主索引工程画面
const handleSetIndexScreen = async (screenId: string) => {
  const target = props.screens.find(s => s.id === screenId);
  if (!target) return;

  try {
    const res = await setIndexScreen(target.name, target.id);
    if (res.success) {
      selectedIndexScreenId.value = target.id;
      emit('update:index-screen', { indexScreenName: target.name, indexScreenId: target.id });
      statusMessage.value = `已将「${target.name}」配置为用户登录成功后的主索引工程！`;
      statusType.value = 'success';
      await refreshConfig();
    } else {
      statusMessage.value = res.error || '设置主索引工程失败';
      statusType.value = 'error';
    }
  } catch (e: any) {
    statusMessage.value = e?.message || '设置异常';
    statusType.value = 'error';
  }
};

// 仅保存当前选中的单个工程
const handleSaveCurrentToDisk = async () => {
  if (!currentActiveScreen.value) return;

  isSavingCurrent.value = true;
  statusMessage.value = `正在保存工程「${currentActiveScreen.value.name}」到 graph/ 目录...`;
  statusType.value = 'info';

  try {
    const res = await saveScreenToDisk(currentActiveScreen.value);
    if (res.success) {
      statusMessage.value = `成功保存当前工程「${currentActiveScreen.value.name}」至 graph/${res.filename || ''}！`;
      statusType.value = 'success';
      await refreshConfig();
    } else {
      statusMessage.value = res.error || '保存当前工程失败';
      statusType.value = 'error';
    }
  } catch (err: any) {
    statusMessage.value = err?.message || '保存发生异常';
    statusType.value = 'error';
  } finally {
    isSavingCurrent.value = false;
  }
};

// 从磁盘重新加载所有合理的 JSON 工程文件
const handleReloadFromDisk = async () => {
  isReloading.value = true;
  statusMessage.value = '正在扫描并检测 graph/ 目录下所有 JSON 工程文件...';
  statusType.value = 'info';

  try {
    const res = await loadScreensFromDisk();
    if (res.success && res.screens && res.screens.length > 0) {
      emit('reload:screens', res.screens);
      statusMessage.value = `成功从 graph 目录载入 ${res.screens.length} 个合规工程文件！`;
      statusType.value = 'success';
      await refreshConfig();
    } else {
      statusMessage.value = res.error || '未读取到合规工程文件';
      statusType.value = 'error';
    }
  } catch (err: any) {
    statusMessage.value = err?.message || '读取异常';
    statusType.value = 'error';
  } finally {
    isReloading.value = false;
  }
};

const handleOpenStorageDirectory = async () => {
  if (!isElectron()) {
    statusMessage.value = `Web 环境中存储目录位于可执行文件同级 graph/ 文件夹下: ${config.value.absolutePath}`;
    statusType.value = 'info';
    return;
  }
  const ok = await openDiskStorageDir();
  if (!ok) {
    statusMessage.value = '无法直接打开系统目录，请在文件管理器中查看。';
    statusType.value = 'error';
  }
};

const handleResetPresets = async () => {
  if (!safeConfirm('确定要在 graph 目录下重置写入系统标准保底工程文件吗？')) return;
  try {
    const res = await resetPresetScreensOnDisk();
    if (res.success && res.screens.length > 0) {
      emit('reload:screens', res.screens);
      statusMessage.value = '已在 graph 目录写入预设标准工程文件并载入！';
      statusType.value = 'success';
      await refreshConfig();
    }
  } catch (err: any) {
    statusMessage.value = err?.message || '重置异常';
    statusType.value = 'error';
  }
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[9999] pointer-events-none select-none font-sans"
    >
      <!-- 统一数据关联弹框风格：纯黑背景、硬质深灰边框、纯白高对比字体、支持拖动 -->
      <div
        ref="modalRef"
        class="pointer-events-auto absolute bg-black text-white rounded-lg border border-neutral-700 shadow-2xl flex flex-col overflow-hidden"
        :style="{
          left: `${modalPos.x}px`,
          top: `${modalPos.y}px`,
          width: `${modalSize.width}px`,
          height: `${modalSize.height}px`
        }"
      >
        <!-- Modal Header -->
        <header
          class="h-12 px-4 bg-[#111111] border-b border-[#2a2a2a] flex items-center justify-between shrink-0 cursor-move"
          @mousedown="onHeaderMouseDown"
          @dblclick="toggleMaximize"
        >
          <div class="flex items-center gap-2.5">
            <HardDrive class="w-4 h-4 text-white" />
            <h3 class="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <span>磁盘文件管理</span>
              <span class="text-xs px-2 py-0.5 rounded bg-neutral-800 border border-neutral-600 text-white font-mono">graph/ 独立目录</span>
            </h3>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              class="p-1.5 text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer"
              :title="isMaximized ? '向下还原' : '最大化'"
              @click.stop="toggleMaximize"
            >
              <Minimize2 v-if="isMaximized" class="w-4 h-4" />
              <Maximize2 v-else class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1.5 text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer"
              title="关闭"
              @click.stop="emit('close')"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </header>

        <!-- Modal Body -->
        <div class="p-4 bg-[#0a0a0a] flex-1 min-h-0 flex flex-col gap-3 overflow-hidden text-white">
          <!-- Top Config Cards: 2-Column Responsive Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
            <!-- 1. Fixed Storage Directory Card -->
            <div class="bg-[#121212] border border-[#2a2a2a] rounded-lg p-3 flex flex-col justify-between gap-1.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-xs font-bold text-white">
                  <FolderOpen class="w-3.5 h-3.5 text-white" />
                  <span>存储路径 (独立 JSON 文件存储)</span>
                </div>
                <button
                  v-if="isElectron()"
                  @click="handleOpenStorageDirectory"
                  class="flex items-center gap-1 px-2.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-xs text-white font-bold cursor-pointer transition-colors"
                >
                  <span>在文件管理器打开</span>
                </button>
              </div>

              <div class="flex items-center gap-2 bg-[#181818] px-2.5 py-1.5 rounded border border-[#2a2a2a] text-xs text-white break-all font-mono font-bold">
                <span class="text-white shrink-0">graph/</span>
                <span class="text-white truncate">{{ config.absolutePath }}</span>
              </div>
            </div>

            <!-- 2. Login Index Screen Configuration Card -->
            <div class="bg-[#121212] border border-[#2a2a2a] rounded-lg p-3 flex flex-col justify-between gap-1.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-xs font-bold text-white">
                  <Star class="w-3.5 h-3.5 text-white fill-white/20" />
                  <span>登录主索引工程配置</span>
                </div>
                <span class="text-[11px] text-white font-medium">
                  登录成功后默认展示
                </span>
              </div>

              <div class="flex items-center gap-2 bg-[#181818] p-1 rounded border border-[#2a2a2a]">
                <select
                  v-model="selectedIndexScreenId"
                  @change="handleSetIndexScreen(selectedIndexScreenId)"
                  class="flex-1 bg-[#121212] border border-neutral-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-white cursor-pointer font-sans font-bold"
                >
                  <option
                    v-for="s in screens"
                    :key="s.id"
                    :value="s.id"
                  >
                    {{ s.name }} ({{ s.components?.length || 0 }} 个元件)
                  </option>
                </select>
                <button
                  @click="handleSetIndexScreen(selectedIndexScreenId)"
                  class="px-3 py-1 bg-white hover:bg-neutral-200 text-black rounded text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  设为登录首页
                </button>
              </div>
            </div>
          </div>

          <!-- 3. Status Notification Message -->
          <div
            v-if="statusMessage"
            class="px-3 py-2 rounded-lg text-xs flex items-center gap-2 border font-medium shrink-0"
            :class="{
              'bg-[#121f15] border-emerald-600 text-white font-bold': statusType === 'success',
              'bg-[#221013] border-rose-600 text-white font-bold': statusType === 'error',
              'bg-[#141414] border-neutral-600 text-white': statusType === 'info'
            }"
          >
            <Check v-if="statusType === 'success'" class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <AlertCircle v-else-if="statusType === 'error'" class="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <Info v-else class="w-3.5 h-3.5 text-white shrink-0" />
            <span class="flex-1 font-bold">{{ statusMessage }}</span>
          </div>

          <!-- 4. Files List Container -->
          <div class="flex-1 min-h-0 flex flex-col bg-[#121212] border border-[#2a2a2a] rounded-lg p-3 gap-2.5">
            <!-- Files List Header with Search Filter -->
            <div class="flex items-center justify-between text-xs font-bold text-white shrink-0">
              <span class="flex items-center gap-2">
                <FileJson class="w-4 h-4 text-white" />
                <span>工程文件清单 (共 {{ config.files?.length || 0 }} 个，合规 {{ config.fileCount }} 个)</span>
              </span>

              <div class="relative w-44">
                <Search class="w-3.5 h-3.5 text-white absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="搜索工程文件..."
                  class="w-full bg-[#181818] border border-neutral-700 rounded pl-8 pr-2.5 py-1 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-white font-sans font-medium"
                />
              </div>
            </div>

            <!-- Table Wrapper -->
            <div class="flex-1 min-h-0 border border-[#2a2a2a] rounded overflow-y-auto bg-black">
              <table class="w-full text-left text-xs border-collapse" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: auto;" />
                  <col style="width: 110px;" />
                  <col style="width: 90px;" />
                  <col style="width: 120px;" />
                  <col style="width: 90px;" />
                </colgroup>
                <thead class="bg-[#141414] text-white font-bold border-b border-[#2a2a2a] sticky top-0 z-10 h-9">
                  <tr>
                    <th class="py-2 px-3">文件名</th>
                    <th class="py-2 px-3">检测状态</th>
                    <th class="py-2 px-3">大小</th>
                    <th class="py-2 px-3">主索引状态</th>
                    <th class="py-2 px-3 text-right pr-4">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#1e1e1e] text-white font-medium">
                  <tr
                    v-for="f in filteredFiles"
                    :key="f.filename"
                    class="hover:bg-[#161616] transition-colors h-10"
                  >
                    <td class="py-2 px-3 flex items-center gap-2 truncate">
                      <FileJson class="w-3.5 h-3.5 text-white shrink-0" />
                      <span class="font-bold text-white text-xs truncate">{{ f.filename }}</span>
                    </td>
                    <td class="py-2 px-3">
                      <span
                        v-if="f.isValid"
                        class="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-bold bg-neutral-800 border border-neutral-600 text-white"
                      >
                        <ShieldCheck class="w-3 h-3 text-white" /> 合规
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-bold bg-rose-950/80 border border-rose-500 text-rose-200"
                        :title="f.reason || '文件格式异常'"
                      >
                        <ShieldAlert class="w-3 h-3 text-rose-400" /> {{ f.reason || '格式异常' }}
                      </span>
                    </td>
                    <td class="py-2 px-3 text-[11px] font-mono font-bold text-white">
                      {{ (f.sizeBytes / 1024).toFixed(1) }} KB
                    </td>
                    <td class="py-2 px-3">
                      <span
                        v-if="f.screenName === config.indexScreen?.indexScreenName || f.screenName === indexScreenName"
                        class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-bold bg-white text-black shadow-sm"
                      >
                        ★ 登录首页
                      </span>
                      <span v-else class="text-[11px] text-white font-bold">-</span>
                    </td>
                    <td class="py-2 px-3 text-right pr-4">
                      <button
                        v-if="f.isValid && f.screenName !== config.indexScreen?.indexScreenName"
                        @click="() => {
                          const target = screens.find(s => s.name === f.screenName);
                          if (target) handleSetIndexScreen(target.id);
                        }"
                        class="px-2.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold transition-colors cursor-pointer border border-neutral-600"
                      >
                        设为首页
                      </button>
                    </td>
                  </tr>

                  <tr v-if="!filteredFiles || filteredFiles.length === 0">
                    <td colspan="5" class="py-12 text-center text-white text-xs font-medium">
                      {{ searchQuery ? '未找到匹配的工程文件' : 'graph 目录下暂无文件' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Modal Footer Action Bar -->
        <footer class="h-13 px-5 bg-[#111111] border-t border-[#2a2a2a] flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="handleResetPresets"
              class="px-3.5 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-bold transition-colors cursor-pointer"
              title="在 graph 目录下生成/恢复系统预设的标准工程 JSON 文件"
            >
              <span>重置预设工程文件</span>
            </button>
          </div>

          <div class="flex items-center gap-2.5">
            <button
              type="button"
              @click="handleReloadFromDisk"
              :disabled="isReloading"
              class="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              title="从 graph 目录重新读取并载入合规 JSON 工程文件"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isReloading }" />
              <span>重新载入磁盘</span>
            </button>

            <button
              type="button"
              @click="handleSaveCurrentToDisk"
              :disabled="isSavingCurrent"
              class="flex items-center gap-1.5 px-4 py-1.5 rounded bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              :title="`仅保存当前选中的工程「${currentActiveScreen?.name}」到对应 JSON 文件`"
            >
              <Save class="w-3.5 h-3.5" :class="{ 'animate-spin': isSavingCurrent }" />
              <span>保存当前工程到 JSON</span>
            </button>

            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              关闭
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
