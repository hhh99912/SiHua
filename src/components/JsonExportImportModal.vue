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
    class="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-6 select-none font-sans"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-4xl bg-[#f2eee3] border-2 border-[#8c826d] rounded-xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-black">
      <!-- Header -->
      <div class="px-5 py-3.5 border-b border-[#cfc5b0] flex items-center justify-between bg-[#e5decb]">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-[#dfd6bf] border border-[#b8ad96] flex items-center justify-center text-sky-800">
            <Code class="w-4 h-4" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-sans font-bold text-black tracking-normal">
                JSON 项目 Schema 导入与导出
              </h2>
              <span 
                class="px-2 py-0.5 text-[10px] font-mono font-bold rounded border"
                :class="platform === 'windows' 
                  ? 'bg-blue-100 text-blue-900 border-blue-300' 
                  : platform === 'linux' 
                    ? 'bg-amber-100 text-amber-900 border-amber-300' 
                    : 'bg-[#dfd6bf] text-black border-[#b8ad96]'"
              >
                {{ platform === 'windows' ? '🖥️ Windows 客户端' : platform === 'linux' ? '🐧 Linux 客户端' : '🌐 Web 网页端' }}
              </span>
            </div>
            <p class="text-[11px] text-neutral-700 font-medium">
              支持多画面完整工程结构、关联数据集、自定义图元库一并导出与恢复
            </p>
          </div>
        </div>

        <button 
          @click="emit('close')"
          class="p-1.5 rounded-lg hover:bg-rose-100 text-black hover:text-rose-700 cursor-pointer transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Mode Selector & Scope Option -->
      <div class="flex items-center justify-between border-b border-[#cfc5b0] bg-[#ebe4d4] px-5">
        <div class="flex items-center">
          <button
            @click="mode = 'export'; updateExportJson(); errorMsg = '';"
            class="py-2.5 px-4 text-xs font-bold transition-colors cursor-pointer border-b-2"
            :class="mode === 'export' ? 'border-sky-700 text-sky-900 font-bold' : 'border-transparent text-neutral-700 hover:text-black'"
          >
            导出工程 JSON
          </button>
          <button
            @click="mode = 'import'; jsonText = ''; errorMsg = '';"
            class="py-2.5 px-4 text-xs font-bold transition-colors cursor-pointer border-b-2"
            :class="mode === 'import' ? 'border-sky-700 text-sky-900 font-bold' : 'border-transparent text-neutral-700 hover:text-black'"
          >
            导入并加载 JSON
          </button>
        </div>

        <div v-if="mode === 'export' && screens && screens.length > 1" class="flex items-center gap-2 text-xs font-sans">
          <span class="text-neutral-700 text-[11px] font-bold">导出范围:</span>
          <select 
            v-model="exportScope" 
            class="bg-white border border-[#b8ad96] text-black text-xs rounded px-2 py-1 font-medium focus:outline-hidden"
          >
            <option value="multi-screen">📁 导出全套 SCADA 工程 (含全部 {{ screens.length }} 个画面)</option>
            <option value="current-screen">📄 仅导出当前画面</option>
          </select>
        </div>
      </div>

      <!-- Content Area -->
      <div class="p-4 flex-1 flex flex-col space-y-3 font-sans text-xs overflow-hidden bg-[#f2eee3]">
        <!-- Error banner -->
        <div v-if="errorMsg" class="p-2.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 font-bold flex items-center gap-2">
          <AlertCircle class="w-4 h-4 shrink-0 text-rose-700" />
          <span>{{ errorMsg }}</span>
        </div>

        <!-- Action bar -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-neutral-800 font-medium">
            {{ mode === 'export' ? '当前工程的完整 JSON 序列化定义:' : '请在下方文本框中粘贴 JSON 或从本地选择文件:' }}
          </span>
          <div class="flex items-center gap-2">
            <template v-if="mode === 'export'">
              <button
                @click="handleCopy"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-[#dfd6bf] hover:bg-[#d4caaf] border border-[#b8ad96] text-black transition-colors cursor-pointer"
              >
                <Check v-if="copied" class="w-3.5 h-3.5 text-emerald-700" />
                <Copy v-else class="w-3.5 h-3.5" />
                <span>{{ copied ? '已复制至剪贴板' : '一键复制' }}</span>
              </button>
              <button
                @click="handleDownload"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white border border-sky-950 transition-colors cursor-pointer shadow-xs"
              >
                <Download class="w-3.5 h-3.5" />
                <span>下载 JSON 文件</span>
              </button>
            </template>
            <template v-else>
              <button 
                v-if="isDesktop"
                @click="handleNativeFileOpen"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white border border-sky-950 transition-colors cursor-pointer shadow-xs"
              >
                <FolderOpen class="w-3.5 h-3.5" />
                <span>选择本地文件</span>
              </button>
              <label v-else class="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white border border-sky-950 transition-colors cursor-pointer shadow-xs">
                <Upload class="w-3.5 h-3.5" />
                <span>从本地文件加载</span>
                <input type="file" accept=".json" class="hidden" @change="handleFileUpload" />
              </label>
            </template>
          </div>
        </div>

        <!-- Textarea Code Box -->
        <div class="flex-1 min-h-[340px] bg-white rounded-lg border border-[#cfc5b0] p-2 overflow-hidden flex flex-col shadow-inner">
          <textarea
            v-model="jsonText"
            :placeholder="mode === 'import' ? '在此粘贴项目 Schema JSON...' : ''"
            :readonly="mode === 'export'"
            class="w-full flex-1 bg-transparent text-black font-mono text-xs outline-hidden resize-none p-2 leading-relaxed"
          ></textarea>
        </div>

        <!-- Import Submit Button -->
        <div v-if="mode === 'import'" class="flex justify-end pt-1">
          <button
            @click="handleImport"
            class="flex items-center gap-1.5 px-6 py-2 rounded text-xs sm:text-sm font-bold bg-sky-700 hover:bg-sky-800 text-white border border-sky-950 transition-all shadow-xs cursor-pointer"
          >
            <Check class="w-4 h-4 stroke-[2.5]" />
            <span>确认解析并导入工程</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
