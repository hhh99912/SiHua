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
  Search
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
import { isElectron } from '../utils/platform';

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
      statusMessage.value = '';
      if (props.indexScreenId) {
        selectedIndexScreenId.value = props.indexScreenId;
      }
      refreshConfig();
    }
  },
  { immediate: true }
);

// 切换/设置登录主索引大屏
const handleSetIndexScreen = async (screenId: string) => {
  const target = props.screens.find(s => s.id === screenId);
  if (!target) return;

  try {
    const res = await setIndexScreen(target.name, target.id);
    if (res.success) {
      selectedIndexScreenId.value = target.id;
      emit('update:index-screen', { indexScreenName: target.name, indexScreenId: target.id });
      statusMessage.value = `已将「${target.name}」配置为用户登录成功后的主索引大屏！`;
      statusType.value = 'success';
      await refreshConfig();
    } else {
      statusMessage.value = res.error || '设置主索引大屏失败';
      statusType.value = 'error';
    }
  } catch (e: any) {
    statusMessage.value = e?.message || '设置异常';
    statusType.value = 'error';
  }
};

// 仅保存当前选中的单个大屏
const handleSaveCurrentToDisk = async () => {
  if (!currentActiveScreen.value) return;

  isSavingCurrent.value = true;
  statusMessage.value = `正在保存大屏「${currentActiveScreen.value.name}」到 graph/ 目录...`;
  statusType.value = 'info';

  try {
    const res = await saveScreenToDisk(currentActiveScreen.value);
    if (res.success) {
      statusMessage.value = `成功保存当前大屏「${currentActiveScreen.value.name}」至 graph/${res.filename || ''}！`;
      statusType.value = 'success';
      await refreshConfig();
    } else {
      statusMessage.value = res.error || '保存当前大屏失败';
      statusType.value = 'error';
    }
  } catch (err: any) {
    statusMessage.value = err?.message || '保存发生异常';
    statusType.value = 'error';
  } finally {
    isSavingCurrent.value = false;
  }
};

// 从磁盘重新加载所有合理的 JSON 大屏
const handleReloadFromDisk = async () => {
  isReloading.value = true;
  statusMessage.value = '正在扫描并检测 graph/ 目录下所有 JSON 大屏文件...';
  statusType.value = 'info';

  try {
    const res = await loadScreensFromDisk();
    if (res.success && res.screens && res.screens.length > 0) {
      emit('reload:screens', res.screens);
      statusMessage.value = `成功从 graph 目录载入 ${res.screens.length} 个合规合理的 JSON 大屏！`;
      statusType.value = 'success';
      await refreshConfig();
    } else {
      statusMessage.value = res.error || '未读取到合规大屏文件';
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
  if (!confirm('确定要在 graph 目录下重置写入系统标准保底大屏吗？')) return;
  try {
    const res = await resetPresetScreensOnDisk();
    if (res.success && res.screens.length > 0) {
      emit('reload:screens', res.screens);
      statusMessage.value = '已在 graph 目录写入预设标准大屏并载入！';
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
  <div
    v-if="visible"
    class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 font-sans select-none"
    style="transform: translateZ(0); will-change: transform;"
    @click.self="emit('close')"
  >
    <div
      class="bg-[#0e172a] border-2 border-sky-400 rounded-2xl shadow-2xl w-full max-w-4xl h-[600px] max-h-[90vh] overflow-hidden flex flex-col text-white my-auto"
      style="contain: paint layout;"
    >
      <!-- Modal Header -->
      <div class="px-6 py-3.5 bg-[#080d1a] border-b-2 border-slate-700 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full bg-sky-400"></div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide flex items-center gap-2">
              <span>磁盘大屏存储管理</span>
              <span class="text-xs px-2 py-0.5 rounded bg-sky-950 border border-sky-500/40 text-sky-300 font-mono">graph/ 独立目录</span>
            </h3>
          </div>
        </div>

        <button
          @click="emit('close')"
          class="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X class="w-5 h-5 text-white" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-4 bg-[#0a1120] flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
        <!-- Top Config Cards: 2-Column Responsive Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
          <!-- 1. Fixed Storage Directory Card -->
          <div class="bg-[#0c1427] border-2 border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-1.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-bold text-sky-300">
                <FolderOpen class="w-3.5 h-3.5 text-sky-400" />
                <span>存储路径 (独立 JSON 文件存储)</span>
              </div>
              <button
                v-if="isElectron()"
                @click="handleOpenStorageDirectory"
                class="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-sky-200 font-bold cursor-pointer transition-colors"
              >
                <span>在文件管理器打开</span>
              </button>
            </div>

            <div class="flex items-center gap-2 bg-[#111c34] px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-sky-300 break-all font-mono font-bold">
              <span class="text-white shrink-0">graph/</span>
              <span class="text-sky-200 truncate">{{ config.absolutePath }}</span>
            </div>
          </div>

          <!-- 2. Login Index Screen Configuration Card -->
          <div class="bg-[#0c1427] border-2 border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-1.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-bold text-sky-300">
                <Star class="w-3.5 h-3.5 text-sky-400 fill-sky-400/30" />
                <span>登录主索引大屏配置</span>
              </div>
              <span class="text-[11px] text-slate-400">
                登录成功后默认展示
              </span>
            </div>

            <div class="flex items-center gap-2 bg-[#111c34] p-1 rounded-lg border border-slate-700">
              <select
                v-model="selectedIndexScreenId"
                @change="handleSetIndexScreen(selectedIndexScreenId)"
                class="flex-1 bg-[#080d1a] border border-slate-600 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-400 cursor-pointer font-sans font-bold"
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
                class="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 border border-sky-400 text-white rounded-md text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                设为登录主屏
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Status Notification Message -->
        <div
          v-if="statusMessage"
          class="px-3 py-2 rounded-lg text-xs flex items-center gap-2 border-2 font-medium shrink-0"
          :class="{
            'bg-emerald-950/60 border-emerald-500 text-emerald-200': statusType === 'success',
            'bg-rose-950/60 border-rose-500 text-rose-200': statusType === 'error',
            'bg-[#111c34] border-sky-400 text-sky-200': statusType === 'info'
          }"
        >
          <Check v-if="statusType === 'success'" class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <AlertCircle v-else-if="statusType === 'error'" class="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <Info v-else class="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span class="flex-1 font-bold">{{ statusMessage }}</span>
        </div>

        <!-- 4. Files List Container (Flex-1 to fill the remaining area) -->
        <div class="flex-1 min-h-0 flex flex-col bg-[#0c1427] border-2 border-slate-800 rounded-xl p-3 gap-2.5">
          <!-- Files List Header with Search Filter -->
          <div class="flex items-center justify-between text-xs font-bold text-slate-200 shrink-0">
            <span class="flex items-center gap-2">
              <FileJson class="w-4 h-4 text-sky-400" />
              <span>大屏文件清单 (共 {{ config.files?.length || 0 }} 个，合规 {{ config.fileCount }} 个)</span>
            </span>

            <div class="relative w-48">
              <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索文件名/大屏名..."
                class="w-full bg-[#080d1a] border border-slate-700 rounded-md pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 font-sans"
              />
            </div>
          </div>

          <!-- Table Wrapper (Fills remaining height with clean scrollbar) -->
          <div class="flex-1 min-h-0 border border-slate-700/70 rounded-lg overflow-y-auto custom-scrollbar bg-[#080d1a]">
            <table class="w-full text-left text-xs border-collapse" style="table-layout: fixed;">
              <thead class="bg-[#111c34] text-sky-300 font-bold border-b border-slate-700 sticky top-0 z-10">
                <tr>
                  <th class="py-2.5 px-3">文件名</th>
                  <th class="py-2.5 px-3 w-28">合理性检测</th>
                  <th class="py-2.5 px-3 w-24">大小</th>
                  <th class="py-2.5 px-3 w-28">主索引状态</th>
                  <th class="py-2.5 px-3 w-24 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/80 text-white">
                <tr
                  v-for="f in filteredFiles"
                  :key="f.filename"
                  class="hover:bg-slate-800/60 transition-colors"
                >
                  <td class="py-2.5 px-3 flex items-center gap-2 truncate">
                    <FileJson class="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span class="font-bold text-white text-xs truncate">{{ f.filename }}</span>
                  </td>
                  <td class="py-2.5 px-3">
                    <span
                      v-if="f.isValid"
                      class="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-bold bg-emerald-950 border border-emerald-500 text-emerald-300"
                    >
                      <ShieldCheck class="w-3 h-3 text-emerald-400" /> 合规
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-bold bg-rose-950 border border-rose-500 text-rose-300"
                      :title="f.reason || '文件损坏或非大屏规范'"
                    >
                      <ShieldAlert class="w-3 h-3 text-rose-400" /> {{ f.reason || '格式异常' }}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 text-[11px] font-mono font-bold text-slate-300">
                    {{ (f.sizeBytes / 1024).toFixed(1) }} KB
                  </td>
                  <td class="py-2.5 px-3">
                    <span
                      v-if="f.screenName === config.indexScreen?.indexScreenName || f.screenName === indexScreenName"
                      class="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-bold bg-sky-950 border border-sky-400 text-sky-300"
                    >
                      ★ 登录主屏
                    </span>
                    <span v-else class="text-[11px] text-slate-500 font-bold">-</span>
                  </td>
                  <td class="py-2.5 px-3 text-right">
                    <button
                      v-if="f.isValid && f.screenName !== config.indexScreen?.indexScreenName"
                      @click="() => {
                        const target = screens.find(s => s.name === f.screenName);
                        if (target) handleSetIndexScreen(target.id);
                      }"
                      class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white text-[11px] font-bold transition-colors cursor-pointer border border-slate-700"
                    >
                      设为主屏
                    </button>
                  </td>
                </tr>

                <tr v-if="!filteredFiles || filteredFiles.length === 0">
                  <td colspan="5" class="py-12 text-center text-slate-400 text-xs">
                    {{ searchQuery ? '未找到匹配的大屏文件' : 'graph 目录下暂无文件' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal Footer Action Bar -->
      <div class="px-6 py-3 bg-[#080d1a] border-t-2 border-slate-700 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <!-- 恢复标准预设大屏保底 -->
          <button
            @click="handleResetPresets"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            title="在 graph 目录下生成/恢复系统预设的标准大屏 JSON 文件"
          >
            <span>重置预设保底大屏</span>
          </button>
        </div>

        <div class="flex items-center gap-2.5">
          <!-- 从磁盘重新载入 -->
          <button
            @click="handleReloadFromDisk"
            :disabled="isReloading"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 hover:text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            title="从 graph 目录重新读取并过滤载入合规 JSON 大屏"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isReloading }" />
            <span>重新载入磁盘</span>
          </button>

          <!-- 仅保存当前选中的这一个大屏 -->
          <button
            @click="handleSaveCurrentToDisk"
            :disabled="isSavingCurrent"
            class="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 border border-sky-400 text-white text-xs font-bold transition-colors cursor-pointer shadow-md disabled:opacity-50"
            :title="`仅保存当前选中的大屏「${currentActiveScreen?.name}」到对应 JSON 文件`"
          >
            <Save class="w-3.5 h-3.5 text-white" :class="{ 'animate-spin': isSavingCurrent }" />
            <span>保存当前大屏到 JSON</span>
          </button>

          <button
            @click="emit('close')"
            class="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
