<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  FolderOpen,
  HardDrive,
  Info,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  X,
  Copy,
  Check
} from 'lucide-vue-next';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
}>();

const activeTab = ref<'live' | 'last-report' | 'linx-guide'>('live');
const isLoading = ref(false);
const copySuccess = ref(false);

const diagData = ref<{
  currentSnapshot?: any;
  lastRebootReport?: any;
  logsDir?: string;
  historyLogExists?: boolean;
  fatalLogExists?: boolean;
} | null>(null);

const rawReportText = ref<string>('');

const fetchDiagnostics = async () => {
  isLoading.value = true;
  try {
    const api = (window as any).electronAPI || (window as any).electron;
    if (api?.diagnostics?.getStatus) {
      const res = await api.diagnostics.getStatus();
      if (res?.success && res.data) {
        diagData.value = res.data;
      }
    }
    if (api?.diagnostics?.readReport) {
      const repRes = await api.diagnostics.readReport();
      if (repRes?.success && repRes.content) {
        rawReportText.value = repRes.content;
      }
    }
  } catch (err) {
    console.warn('[SystemHealth] 获取诊断数据失败:', err);
  } finally {
    isLoading.value = false;
  }
};

let pollTimer: any = null;

onMounted(() => {
  fetchDiagnostics();
  pollTimer = setInterval(fetchDiagnostics, 5000);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});

// Format seconds into D/H/M/S
const formatDuration = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0秒';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}天 ${h}小时 ${m}分 ${s}秒`;
  if (h > 0) return `${h}小时 ${m}分 ${s}秒`;
  if (m > 0) return `${m}分 ${s}秒`;
  return `${s}秒`;
};

// Current Memory Stats
const heapUsed = computed(() => diagData.value?.currentSnapshot?.processMemory?.heapUsedMb || 0);
const heapTotal = computed(() => diagData.value?.currentSnapshot?.processMemory?.heapTotalMb || 0);
const rssMem = computed(() => diagData.value?.currentSnapshot?.processMemory?.rssMb || 0);
const freeSysMem = computed(() => diagData.value?.currentSnapshot?.systemMemory?.freeMb || 0);
const totalSysMem = computed(() => diagData.value?.currentSnapshot?.systemMemory?.totalMb || 0);
const uptimeSec = computed(() => diagData.value?.currentSnapshot?.uptimeSeconds || 0);
const osUptimeSec = computed(() => diagData.value?.currentSnapshot?.osUptimeSeconds || 0);

// V8 Heap Max limit (now 2048MB)
const heapMaxMb = 2048;
const heapUsagePercent = computed(() => {
  if (!heapUsed.value) return 0;
  return Math.min(100, Math.round((heapUsed.value / heapMaxMb) * 100));
});

// Open Logs Directory
const handleOpenLogsDir = async () => {
  const api = (window as any).electronAPI || (window as any).electron;
  if (api?.diagnostics?.openLogsDir) {
    await api.diagnostics.openLogsDir();
  }
};

// Copy command to clipboard
const handleCopyCommand = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch {}
};
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none"
  >
    <div
      class="w-full max-w-4xl bg-[#0b1322] border border-cyan-500/40 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-200 animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- 头部：标题与状态 -->
      <div class="px-5 py-3.5 bg-[#0f1b30] border-b border-cyan-500/30 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <Activity class="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div class="text-base font-bold text-white flex items-center gap-2">
              <span>系统运行健康与重启黑匣子监控</span>
              <span class="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                实时守护运行中
              </span>
            </div>
            <div class="text-xs text-slate-400">
              精准排查凝思安全操作系统 (Linux 4.9.x) 突然重启、V8 内存溢出、看门狗复位与内核 Panic
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="fetchDiagnostics"
            class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            title="刷新数据"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            <span>刷新</span>
          </button>
          <button
            @click="emit('close')"
            class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- 选项卡导航 -->
      <div class="flex items-center border-b border-slate-800 bg-[#080f1e] px-5 gap-2 pt-2">
        <button
          @click="activeTab = 'live'"
          class="px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2"
          :class="activeTab === 'live' ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'"
        >
          <Server class="w-4 h-4" />
          <span>当前系统健康监控</span>
        </button>

        <button
          @click="activeTab = 'last-report'"
          class="px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2"
          :class="activeTab === 'last-report' ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'"
        >
          <FileText class="w-4 h-4" />
          <span>上次重启/闪退诊断报告</span>
          <span
            v-if="diagData?.lastRebootReport && !diagData.lastRebootReport.wasCleanShutdown"
            class="w-2 h-2 rounded-full bg-amber-400 animate-ping"
          />
        </button>

        <button
          @click="activeTab = 'linx-guide'"
          class="px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2"
          :class="activeTab === 'linx-guide' ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'"
        >
          <Terminal class="w-4 h-4" />
          <span>凝思工控机排查与防重启配置</span>
        </button>
      </div>

      <!-- 主体内容 -->
      <div class="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5 text-sm">
        <!-- TAB 1: 当前系统健康监控 -->
        <div v-if="activeTab === 'live'" class="space-y-5">
          <!-- 核心指标卡片网格 -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- 运行时间卡片 -->
            <div class="bg-[#0f1b30] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div class="flex items-center justify-between text-slate-400 text-xs">
                <span>SCADA 连续运行时长</span>
                <Clock class="w-4 h-4 text-cyan-400" />
              </div>
              <div class="text-xl font-bold font-mono text-cyan-300 mt-2">
                {{ formatDuration(uptimeSec) }}
              </div>
              <div class="text-xs text-slate-500 font-mono mt-1">
                凝思主机已开机: {{ formatDuration(osUptimeSec) }}
              </div>
            </div>

            <!-- V8 内存占用卡片 -->
            <div class="bg-[#0f1b30] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div class="flex items-center justify-between text-slate-400 text-xs">
                <span>V8 堆内存使用 (上限 2048MB)</span>
                <Database class="w-4 h-4 text-indigo-400" />
              </div>
              <div class="flex items-baseline gap-2 mt-2">
                <span class="text-xl font-bold font-mono" :class="heapUsagePercent > 80 ? 'text-rose-400' : 'text-indigo-300'">
                  {{ heapUsed }} MB
                </span>
                <span class="text-xs text-slate-500 font-mono">/ {{ heapMaxMb }} MB ({{ heapUsagePercent }}%)</span>
              </div>
              <!-- 进度条 -->
              <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="heapUsagePercent > 80 ? 'bg-rose-500' : heapUsagePercent > 60 ? 'bg-amber-400' : 'bg-indigo-500'"
                  :style="{ width: `${heapUsagePercent}%` }"
                />
              </div>
              <div class="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 class="w-3 h-3" />
                <span>已解除 512MB 限制，充裕安全</span>
              </div>
            </div>

            <!-- 物理内存状态卡片 -->
            <div class="bg-[#0f1b30] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div class="flex items-center justify-between text-slate-400 text-xs">
                <span>工控机物理内存</span>
                <HardDrive class="w-4 h-4 text-emerald-400" />
              </div>
              <div class="flex items-baseline gap-2 mt-2">
                <span class="text-xl font-bold font-mono text-emerald-300">
                  {{ freeSysMem }} MB
                </span>
                <span class="text-xs text-slate-400">系统空闲</span>
              </div>
              <div class="text-xs text-slate-500 font-mono mt-1">
                SCADA 进程物理 RSS: {{ rssMem }} MB (总内存: {{ totalSysMem }} MB)
              </div>
            </div>
          </div>

          <!-- 黑匣子守护状态 -->
          <div class="bg-[#0f1b30] border border-slate-800 rounded-xl p-4">
            <div class="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldCheck class="w-4 h-4 text-cyan-400" />
              <span>黑匣子秒级心跳与崩溃守护机制</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div class="p-3 bg-[#080f1e] rounded-lg border border-slate-800 flex items-start gap-2.5">
                <div class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1" />
                <div>
                  <div class="font-bold text-slate-200">10秒低开销原子心跳守护</div>
                  <div class="text-slate-400 mt-0.5">每10秒同步落盘进程内存、系统空闲内存与系统负载至 heartbeat.json</div>
                </div>
              </div>
              <div class="p-3 bg-[#080f1e] rounded-lg border border-slate-800 flex items-start gap-2.5">
                <div class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1" />
                <div>
                  <div class="font-bold text-slate-200">毫秒级同步崩溃日志刷写</div>
                  <div class="text-slate-400 mt-0.5">捕获 uncaughtException、render-process-gone 与 POSIX 信号，确保断电前完成落盘</div>
                </div>
              </div>
              <div class="p-3 bg-[#080f1e] rounded-lg border border-slate-800 flex items-start gap-2.5">
                <div class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1" />
                <div>
                  <div class="font-bold text-slate-200">开机逆向溯源分析</div>
                  <div class="text-slate-400 mt-0.5">下次只要发生异常重启，开机自动比对最后一次心跳特征，自动给出确诊原因</div>
                </div>
              </div>
              <div class="p-3 bg-[#080f1e] rounded-lg border border-slate-800 flex items-start gap-2.5">
                <div class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1" />
                <div>
                  <div class="font-bold text-slate-200">文件句柄与 xset 单例保护</div>
                  <div class="text-slate-400 mt-0.5">消除频繁 fork 子进程，提升 ulimit -n 上限至 65535，防止 EMFILE 闪退</div>
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span class="text-xs text-slate-400 font-mono">
                日志保存位置: {{ diagData?.logsDir || 'logs/' }}
              </span>
              <button
                @click="handleOpenLogsDir"
                class="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FolderOpen class="w-4 h-4" />
                <span>打开日志目录查看文件</span>
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 2: 上次重启/闪退诊断报告 -->
        <div v-if="activeTab === 'last-report'" class="space-y-4">
          <!-- 诊断总结横幅 -->
          <div
            v-if="diagData?.lastRebootReport"
            class="p-4 rounded-xl border flex items-start gap-3.5"
            :class="diagData.lastRebootReport.wasCleanShutdown ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200' : 'bg-amber-950/20 border-amber-500/40 text-amber-200'"
          >
            <component
              :is="diagData.lastRebootReport.wasCleanShutdown ? CheckCircle2 : AlertTriangle"
              class="w-6 h-6 shrink-0 mt-0.5"
              :class="diagData.lastRebootReport.wasCleanShutdown ? 'text-emerald-400' : 'text-amber-400'"
            />
            <div class="space-y-1">
              <div class="font-bold text-base flex items-center gap-2">
                <span>{{ diagData.lastRebootReport.presumedReason }}</span>
                <span class="text-xs px-2 py-0.5 rounded font-mono bg-black/30 border border-white/10">
                  可信度: {{ diagData.lastRebootReport.confidence }}
                </span>
              </div>
              <div class="text-xs text-slate-300 leading-relaxed">
                {{ diagData.lastRebootReport.details }}
              </div>
              <div v-if="diagData.lastRebootReport.lastHeartbeatTime" class="text-xs text-slate-400 font-mono pt-1">
                最后心跳时间: {{ diagData.lastRebootReport.lastHeartbeatTime }} | 上次运行时长: {{ Math.floor((diagData.lastRebootReport.lastHeartbeatUptime || 0) / 60) }} 分钟
              </div>
            </div>
          </div>

          <!-- 处置措施建议 -->
          <div v-if="diagData?.lastRebootReport?.recommendedActions?.length" class="bg-[#0f1b30] border border-slate-800 rounded-xl p-4 space-y-2">
            <div class="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Info class="w-4 h-4 text-cyan-400" />
              <span>处置与优化建议</span>
            </div>
            <ul class="space-y-1.5 text-xs text-slate-300">
              <li
                v-for="(act, idx) in diagData.lastRebootReport.recommendedActions"
                :key="idx"
                class="flex items-start gap-2 bg-[#080f1e] p-2.5 rounded-lg border border-slate-800"
              >
                <span class="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  {{ idx + 1 }}
                </span>
                <span class="flex-1 font-mono">{{ act }}</span>
              </li>
            </ul>
          </div>

          <!-- 诊断报告文本详情 -->
          <div class="bg-[#080f1e] border border-slate-800 rounded-xl p-4 space-y-2">
            <div class="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800">
              <span class="font-bold">完整的诊断报告明细 (reboot_diagnosis_report.txt)</span>
              <button
                v-if="rawReportText"
                @click="handleCopyCommand(rawReportText)"
                class="flex items-center gap-1 hover:text-white cursor-pointer"
              >
                <component :is="copySuccess ? Check : Copy" class="w-3.5 h-3.5 text-cyan-400" />
                <span>{{ copySuccess ? '已复制' : '复制全文' }}</span>
              </button>
            </div>
            <pre class="text-xs font-mono text-slate-300 overflow-x-auto p-2 bg-black/40 rounded border border-slate-800/60 max-h-60 leading-relaxed whitespace-pre-wrap">{{ rawReportText || '暂无生成的诊断报告文本。' }}</pre>
          </div>
        </div>

        <!-- TAB 3: 凝思工控机排查与防重启配置 -->
        <div v-if="activeTab === 'linx-guide'" class="space-y-4">
          <div class="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-slate-300 space-y-2 leading-relaxed">
            <div class="font-bold text-sm text-cyan-300 flex items-center gap-2">
              <ShieldAlert class="w-4 h-4 text-cyan-400" />
              <span>为什么弃用了 GPU 之后，凝思系统还是可能会突然重启？</span>
            </div>
            <p>
              在凝思安全操作系统 (Linux 4.9.0-8-linx-security) 下，“突然重启”通常源于以下三种最容易被忽视的隐蔽机理：
            </p>
            <ol class="list-decimal pl-4 space-y-1.5 text-slate-300">
              <li>
                <strong class="text-white">之前版本配置了 --max-old-space-size=512 内存限制：</strong>
                SCADA 运行时间长、测点多，一旦 V8 堆内存触碰到 512MB 警戒线，V8 直接抛出 OOM 崩溃退出。外部守护脚本（或 Docker 的 --restart unless-stopped）立刻拉起它，造成“运行久了突然重启”的假象。（<span class="text-emerald-400">当前版本已上调至 2048MB 彻底根治</span>）。
              </li>
              <li>
                <strong class="text-white">凝思内核的 vm.panic_on_oom = 1 安全配置：</strong>
                凝思安全内核如果开启了此参数，当物理内存吃紧时，系统不会单杀进程，而是直接触发整个内核 Kernel Panic 并在 10 秒后强制重启整机！
              </li>
              <li>
                <strong class="text-white">工控机主板芯片级硬件看门狗 (/dev/watchdog) 超时复位：</strong>
                工控机（如研华、研祥）若启用了看门狗守护，当系统 CPU 负载过高、或者软件渲染短时间卡死主线程导致未能按时喂狗，硬件芯片会直接对主板下达硬复位电平指令整机重启！
              </li>
            </ol>
          </div>

          <!-- 一键诊断命令卡片 -->
          <div class="bg-[#0f1b30] border border-slate-800 rounded-xl p-4 space-y-3">
            <div class="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span class="flex items-center gap-2">
                <Terminal class="w-4 h-4 text-amber-400" />
                <span>步骤 1: 在凝思终端运行我们准备的一键排查脚本</span>
              </span>
              <button
                @click="handleCopyCommand('bash deploy/linx-crash-diagnose.sh')"
                class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <component :is="copySuccess ? Check : Copy" class="w-3 h-3 text-cyan-400" />
                <span>复制命令</span>
              </button>
            </div>
            <div class="p-2.5 bg-black/50 rounded-lg font-mono text-xs text-amber-300 border border-slate-800">
              bash deploy/linx-crash-diagnose.sh
            </div>
            <p class="text-[11px] text-slate-400">
              此脚本会自动扫描 /var/log/messages、dmesg、/sys/fs/pstore、看门狗驱动以及上一次退出前的内存快照。
            </p>
          </div>

          <!-- 一键内核防重启配置卡片 -->
          <div class="bg-[#0f1b30] border border-slate-800 rounded-xl p-4 space-y-3">
            <div class="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span class="flex items-center gap-2">
                <ShieldCheck class="w-4 h-4 text-emerald-400" />
                <span>步骤 2: 执行凝思内核防突然重启永久配置 (推荐)</span>
              </span>
              <button
                @click="handleCopyCommand(`sudo sysctl -w vm.panic_on_oom=0 && sudo sysctl -w kernel.panic=0 && sudo sysctl -w kernel.panic_on_oops=0`)"
                class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <component :is="copySuccess ? Check : Copy" class="w-3 h-3 text-cyan-400" />
                <span>复制命令</span>
              </button>
            </div>
            <div class="p-2.5 bg-black/50 rounded-lg font-mono text-xs text-emerald-300 border border-slate-800 break-all">
              sudo sysctl -w vm.panic_on_oom=0 && sudo sysctl -w kernel.panic=0 && sudo sysctl -w kernel.panic_on_oops=0
            </div>
            <p class="text-[11px] text-slate-400">
              设置后，即使内存有波动或驱动发生微小警告，内核也绝不会重启主机，保障工控连续稳定运行。
            </p>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="px-5 py-3 bg-[#0f1b30] border-t border-slate-800 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2 text-slate-400 font-mono">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>黑匣子服务在线 | 心跳每10秒自动更新</span>
        </div>
        <button
          @click="emit('close')"
          class="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>
