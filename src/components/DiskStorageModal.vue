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
  Info
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
    class="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 font-mono select-none"
  >
    <div
      class="bg-[#050c1c] border border-cyan-400/80 rounded-xl shadow-[0_0_40px_rgba(0,242,255,0.25)] w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Modal Header -->
      <div class="px-5 py-3.5 bg-[#08152e] border-b border-cyan-500/40 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-400/60 text-cyan-300">
            <HardDrive class="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <h3 class="text-sm font-normal text-cyan-100 flex items-center gap-2">
              SCADA 大屏独立 JSON 文件存储库
              <span class="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/50">
                固定路径 graph/
              </span>
            </h3>
            <p class="text-[11px] text-cyan-300/80 mt-0.5 font-light">
              每个大屏独立存为一个 JSON 文件 (文件名即大屏名)，启动自动检测并载入合理大屏
            </p>
          </div>
        </div>

        <button
          @click="emit('close')"
          class="p-1.5 rounded-md text-cyan-400 hover:text-white hover:bg-cyan-950/80 transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-5 overflow-y-auto space-y-4 custom-scrollbar">
        <!-- 1. Fixed Storage Directory Card -->
        <div class="bg-[#071126] border border-cyan-500/30 rounded-lg p-3.5 space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs font-normal text-cyan-200">
              <FolderOpen class="w-4 h-4 text-cyan-400" />
              <span>存储路径 (已锁定为可执行目录同级文件夹 graph)</span>
            </div>
            <button
              v-if="isElectron()"
              @click="handleOpenStorageDirectory"
              class="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-200 cursor-pointer transition-colors"
            >
              <span>在文件管理器打开</span>
            </button>
          </div>

          <div class="flex items-center gap-2 bg-[#030814] px-3 py-2 rounded border border-cyan-500/40 text-xs text-cyan-300 break-all font-mono">
            <span class="text-cyan-400 shrink-0 font-normal">graph/</span>
            <span class="text-cyan-100/90 truncate">{{ config.absolutePath }}</span>
          </div>

          <p class="text-[11px] text-cyan-300/80 font-light flex items-center gap-1.5">
            <Info class="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>路径已在系统底层写死，启动时自动校验目录存在性并保障至少含有一个合理的 JSON 大屏。</span>
          </p>
        </div>

        <!-- 2. Login Index Screen Configuration Card -->
        <div class="bg-[#08152e] border border-amber-500/40 rounded-lg p-3.5 space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs font-normal text-amber-300">
              <Star class="w-4 h-4 text-amber-400 fill-amber-400/30" />
              <span>用户登录成功后主索引大屏配置</span>
            </div>
            <span class="text-[10px] text-amber-200/80 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40">
              手动预览不触发切换
            </span>
          </div>

          <div class="flex items-center gap-3 bg-[#040916] p-2.5 rounded border border-amber-500/30">
            <div class="flex-1">
              <label class="text-[11px] text-amber-200/80 block mb-1">选择登录后自动呈现的主索引大屏:</label>
              <select
                v-model="selectedIndexScreenId"
                @change="handleSetIndexScreen(selectedIndexScreenId)"
                class="w-full bg-[#071126] border border-amber-500/50 rounded px-2.5 py-1.5 text-xs text-amber-100 focus:outline-hidden focus:border-amber-400 cursor-pointer font-mono"
              >
                <option
                  v-for="s in screens"
                  :key="s.id"
                  :value="s.id"
                >
                  {{ s.name }} ({{ s.components?.length || 0 }} 组件)
                </option>
              </select>
            </div>
            <button
              @click="handleSetIndexScreen(selectedIndexScreenId)"
              class="mt-4 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/70 text-amber-200 hover:text-white rounded text-xs transition-colors cursor-pointer shrink-0"
            >
              设为登录主屏
            </button>
          </div>

          <p class="text-[11px] text-amber-200/75 leading-relaxed font-light">
            ★ 规则生效机制：仅在操作员或管理员登录成功后，自动加载并呈现选中的主索引大屏；在编辑工作台手动点击右上角「SCADA 预览」时保持当前画面，不触发切换。
          </p>
        </div>

        <!-- 3. Status Notification Message -->
        <div
          v-if="statusMessage"
          class="p-2.5 rounded-lg text-xs flex items-center gap-2 border"
          :class="{
            'bg-emerald-950/50 border-emerald-500/50 text-emerald-200': statusType === 'success',
            'bg-rose-950/50 border-rose-500/50 text-rose-200': statusType === 'error',
            'bg-cyan-950/50 border-cyan-500/50 text-cyan-200': statusType === 'info'
          }"
        >
          <Check v-if="statusType === 'success'" class="w-4 h-4 text-emerald-400 shrink-0" />
          <AlertCircle v-else-if="statusType === 'error'" class="w-4 h-4 text-rose-400 shrink-0" />
          <Info v-else class="w-4 h-4 text-cyan-400 shrink-0" />
          <span class="flex-1">{{ statusMessage }}</span>
        </div>

        <!-- 4. Files List with Sanity Inspection -->
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs text-cyan-200">
            <span class="flex items-center gap-1.5">
              <FileJson class="w-3.5 h-3.5 text-cyan-400" />
              <span>graph 目录下大屏 JSON 文件检测清单 (共 {{ config.files?.length || 0 }} 个，合规 {{ config.fileCount }} 个)</span>
            </span>
            <span class="text-[10px] text-cyan-300/80 font-light">启动仅载入合理 JSON</span>
          </div>

          <div class="border border-cyan-500/30 rounded-lg overflow-hidden max-h-56 overflow-y-auto custom-scrollbar bg-[#030814]">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="bg-[#071126] text-cyan-300/80 text-[10px] uppercase border-b border-cyan-500/30 sticky top-0">
                <tr>
                  <th class="py-1.5 px-3">文件名 (<大屏名>.json)</th>
                  <th class="py-1.5 px-2">合理性检测</th>
                  <th class="py-1.5 px-2">大小</th>
                  <th class="py-1.5 px-2">主索引状态</th>
                  <th class="py-1.5 px-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-cyan-500/20 text-cyan-100">
                <tr
                  v-for="f in config.files"
                  :key="f.filename"
                  class="hover:bg-cyan-950/30 transition-colors"
                >
                  <td class="py-2 px-3 flex items-center gap-2">
                    <FileJson class="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span class="font-normal text-cyan-100">{{ f.filename }}</span>
                  </td>
                  <td class="py-2 px-2">
                    <span
                      v-if="f.isValid"
                      class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/50 text-emerald-300"
                    >
                      <ShieldCheck class="w-3 h-3 text-emerald-400" /> 合规
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-500/50 text-rose-300"
                      :title="f.reason || '文件损坏或非大屏规范'"
                    >
                      <ShieldAlert class="w-3 h-3 text-rose-400" /> {{ f.reason || '格式异常' }}
                    </span>
                  </td>
                  <td class="py-2 px-2 text-[10px] text-cyan-300/70">
                    {{ (f.sizeBytes / 1024).toFixed(1) }} KB
                  </td>
                  <td class="py-2 px-2">
                    <span
                      v-if="f.screenName === config.indexScreen?.indexScreenName || f.screenName === indexScreenName"
                      class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-400 text-amber-300"
                    >
                      ★ 登录主屏
                    </span>
                    <span v-else class="text-[10px] text-cyan-300/40">-</span>
                  </td>
                  <td class="py-2 px-2 text-right">
                    <button
                      v-if="f.isValid && f.screenName !== config.indexScreen?.indexScreenName"
                      @click="() => {
                        const target = screens.find(s => s.name === f.screenName);
                        if (target) handleSetIndexScreen(target.id);
                      }"
                      class="text-[10px] text-amber-300 hover:text-amber-100 hover:underline cursor-pointer"
                    >
                      设为主屏
                    </button>
                  </td>
                </tr>

                <tr v-if="!config.files || config.files.length === 0">
                  <td colspan="5" class="py-6 text-center text-cyan-300/50 text-xs">
                    graph 目录下暂无文件，系统启动时将自动生成至少一个合理的 JSON 大屏。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal Footer Action Bar -->
      <div class="px-5 py-3 bg-[#08152e] border-t border-cyan-500/40 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <!-- 恢复标准预设大屏保底 -->
          <button
            @click="handleResetPresets"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#071024] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs transition-colors cursor-pointer"
            title="在 graph 目录下生成/恢复系统预设的标准大屏 JSON 文件"
          >
            <span>重置预设保底大屏</span>
          </button>
        </div>

        <div class="flex items-center gap-2">
          <!-- 从磁盘重新载入 -->
          <button
            @click="handleReloadFromDisk"
            :disabled="isReloading"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#09152b] hover:bg-cyan-950 border border-cyan-500/50 hover:border-cyan-400 text-cyan-200 hover:text-white text-xs transition-colors cursor-pointer disabled:opacity-50"
            title="从 graph 目录重新读取并过滤载入合规 JSON 大屏"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isReloading }" />
            <span>重新载入磁盘</span>
          </button>

          <!-- 仅保存当前选中的这一个大屏 -->
          <button
            @click="handleSaveCurrentToDisk"
            :disabled="isSavingCurrent"
            class="flex items-center gap-1.5 px-4 py-1.5 rounded bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-400 hover:border-cyan-300 text-cyan-100 hover:text-white text-xs transition-colors cursor-pointer shadow-[0_0_12px_rgba(0,242,255,0.3)] disabled:opacity-50"
            :title="`仅保存当前选中的大屏「${currentActiveScreen?.name}」到对应 JSON 文件`"
          >
            <Save class="w-3.5 h-3.5 text-cyan-300" :class="{ 'animate-spin': isSavingCurrent }" />
            <span class="font-normal">保存当前大屏到 JSON</span>
          </button>

          <button
            @click="emit('close')"
            class="px-3.5 py-1.5 rounded bg-[#071024] hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
