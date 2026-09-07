<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  Code,
  X,
  Copy,
  Download,
  Upload,
  Check,
  AlertCircle,
  Layers,
  FolderOpen
} from 'lucide-vue-next';
import { MultiScreenProjectSchema, ScreenConfig, ScreenComponent, DatasetItem, ScreenItem, CustomSymbolDef } from '../types';
import { getCustomSymbols } from '../utils/customSymbolStorage';
import { exportProjectFile, importProjectFile, isElectron, detectPlatform } from '../utils/platform';

interface Props {
  visible: boolean;
  screen: ScreenConfig;
  components: ScreenComponent[];
  datasets: DatasetItem[];
  screens?: ScreenItem[];
  activeScreenId?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'import:project', project: any): void;
}>();

const mode = ref<'export' | 'import'>('export');
const exportScope = ref<'multi-screen' | 'current-screen'>('multi-screen');
const jsonText = ref('');
const copied = ref(false);
const errorMsg = ref('');

const updateExportJson = () => {
  if (exportScope.value === 'multi-screen' && props.screens && props.screens.length > 0) {
    const multiSchema: MultiScreenProjectSchema = {
      version: '2.0.0',
      activeScreenId: props.activeScreenId || props.screens[0].id,
      screens: props.screens,
      datasets: props.datasets,
      customSymbols: getCustomSymbols()
    };
    jsonText.value = JSON.stringify(multiSchema, null, 2);
  } else {
    const singleSchema = {
      version: '2.0.0',
      screen: props.screen,
      components: props.components,
      datasets: props.datasets,
      customSymbols: getCustomSymbols()
    };
    jsonText.value = JSON.stringify(singleSchema, null, 2);
  }
};

watch(
  () => [props.visible, props.screen, props.components, props.datasets, props.screens, exportScope.value],
  () => {
    if (props.visible && mode.value === 'export') {
      updateExportJson();
      errorMsg.value = '';
    }
  },
  { immediate: true, deep: true }
);

const handleCopy = () => {
  navigator.clipboard.writeText(jsonText.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
};

const isDesktop = isElectron();
const platform = detectPlatform();

const handleDownload = async () => {
  const fileName = exportScope.value === 'multi-screen' 
    ? `ge-scada-project-${Date.now()}.json`
    : `${props.screen.name || 'scada-screen'}-${Date.now()}.json`;
  
  const res = await exportProjectFile(jsonText.value, fileName);
  if (res.success && res.path) {
    errorMsg.value = '';
  }
};

const handleNativeFileOpen = async () => {
  const res = await importProjectFile();
  if (res.success && res.data) {
    jsonText.value = JSON.stringify(res.data, null, 2);
    errorMsg.value = '';
  } else if (res.error) {
    errorMsg.value = res.error;
  }
};

const handleFileUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    jsonText.value = event.target?.result as string;
  };
  reader.readAsText(file);
};

const handleImport = () => {
  try {
    const parsed = JSON.parse(jsonText.value);
    if (!parsed) {
      throw new Error('无效的 JSON 内容');
    }
    emit('import:project', parsed);
    emit('close');
  } catch (err: any) {
    errorMsg.value = '导入解析失败: ' + err.message;
  }
};
</script>

<template>
  <div 
    v-if="visible"
    class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none font-sans"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-4xl bg-[#080e1a] border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
      <!-- Header -->
      <div class="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-[#050914]">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Code class="w-4 h-4" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-mono font-bold text-white tracking-wider">
                JSON 项目 Schema 导入与导出
              </h2>
              <span 
                class="px-2 py-0.5 text-[10px] font-mono rounded-full border"
                :class="platform === 'windows' 
                  ? 'bg-blue-950/80 text-blue-300 border-blue-500/40' 
                  : platform === 'linux' 
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/40' 
                    : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'"
              >
                {{ platform === 'windows' ? '🖥️ Windows 客户端' : platform === 'linux' ? '🐧 Linux 客户端' : '🌐 Web 网页端' }}
              </span>
            </div>
            <p class="text-[10px] font-mono text-slate-400">
              支持多画面完整工程结构、关联数据集、自定义图元库一并导出与恢复
            </p>
          </div>
        </div>

        <button 
          @click="emit('close')"
          class="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Mode Selector & Scope Option -->
      <div class="flex items-center justify-between border-b border-slate-800 bg-[#060a14] px-4">
        <div class="flex items-center">
          <button
            @click="mode = 'export'; updateExportJson(); errorMsg = '';"
            class="py-2.5 px-4 text-xs font-mono font-bold transition-colors cursor-pointer border-b-2"
            :class="mode === 'export' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'"
          >
            导出工程 JSON
          </button>
          <button
            @click="mode = 'import'; jsonText = ''; errorMsg = '';"
            class="py-2.5 px-4 text-xs font-mono font-bold transition-colors cursor-pointer border-b-2"
            :class="mode === 'import' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'"
          >
            导入并加载 JSON
          </button>
        </div>

        <div v-if="mode === 'export' && screens && screens.length > 1" class="flex items-center gap-2 text-xs font-mono">
          <span class="text-slate-400 text-[11px]">导出范围:</span>
          <select 
            v-model="exportScope" 
            class="bg-slate-900 border border-slate-700 text-cyan-300 text-xs rounded px-2 py-1 focus:outline-hidden"
          >
            <option value="multi-screen">📁 导出全套 SCADA 工程 (含全部 {{ screens.length }} 个画面)</option>
            <option value="current-screen">📄 仅导出当前画面</option>
          </select>
        </div>
      </div>

      <!-- Content Area -->
      <div class="p-4 flex-1 flex flex-col space-y-3 font-mono text-xs overflow-hidden">
        <!-- Error banner -->
        <div v-if="errorMsg" class="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 flex items-center gap-2">
          <AlertCircle class="w-4 h-4 shrink-0" />
          <span>{{ errorMsg }}</span>
        </div>

        <!-- Action bar -->
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-slate-400">
            {{ mode === 'export' ? '当前工程的完整 JSON 序列化定义:' : '请在下方文本框中粘贴 JSON 或从本地选择文件:' }}
          </span>

          <div class="flex items-center gap-2">
            <template v-if="mode === 'export'">
              <button
                @click="handleCopy"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                <Check v-if="copied" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5" />
                <span>{{ copied ? '已复制至剪贴板' : '一键复制' }}</span>
              </button>
              <button
                @click="handleDownload"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 transition-colors cursor-pointer"
              >
                <Download class="w-3.5 h-3.5" />
                <span>下载 JSON 文件</span>
              </button>
            </template>

            <template v-else>
              <button 
                v-if="isDesktop"
                @click="handleNativeFileOpen"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                <FolderOpen class="w-3.5 h-3.5 text-cyan-400" />
                <span>选择本地文件</span>
              </button>
              <label v-else class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer">
                <Upload class="w-3.5 h-3.5" />
                <span>从本地文件加载</span>
                <input type="file" accept=".json" class="hidden" @change="handleFileUpload" />
              </label>
            </template>
          </div>
        </div>

        <!-- Textarea Code Box -->
        <div class="flex-1 min-h-[340px] bg-slate-950 rounded-xl border border-slate-800 p-2 overflow-hidden flex flex-col">
          <textarea
            v-model="jsonText"
            :placeholder="mode === 'import' ? '在此粘贴项目 Schema JSON...' : ''"
            :readonly="mode === 'export'"
            class="w-full flex-1 bg-transparent text-cyan-300 font-mono text-[11px] outline-hidden resize-none p-2 custom-scrollbar leading-relaxed"
          ></textarea>
        </div>

        <!-- Import Submit Button -->
        <div v-if="mode === 'import'" class="flex justify-end pt-1">
          <button
            @click="handleImport"
            class="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-[0_0_20px_rgba(0,242,255,0.4)] cursor-pointer"
          >
            <Check class="w-4 h-4" />
            <span>确认解析并导入工程</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
