<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { 
  X, Laptop, Terminal, Layers, CheckCircle2, 
  ExternalLink, Copy, Check, ShieldCheck, Cpu, HardDrive, Maximize2, Minimize2
} from 'lucide-vue-next';
import { isElectron, detectPlatform, getSystemInfo, windowMinimize, windowMaximize, windowToggleFullscreen } from '../utils/platform';
import { ElectronSystemInfo } from '../types/electron';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
}>();

const sysInfo = ref<ElectronSystemInfo | null>(null);
const currentPlatform = ref<'windows' | 'linux' | 'macos' | 'web'>('web');
const copiedIndex = ref<number | null>(null);

onMounted(async () => {
  currentPlatform.value = detectPlatform();
  if (isElectron()) {
    sysInfo.value = await getSystemInfo();
  }
});

const activeTab = ref<'desktop' | 'docker'>('docker');

const packagingCommands = [
  {
    target: 'Windows 本地直接运行 (开发模式)',
    os: 'Windows 10 / 11 / Server',
    cmd: 'npm run electron:dev',
    desc: '启动 Vite 并自动调起 Electron 桌面窗口，支持热更新与 DevTools 调试'
  },
  {
    target: 'Windows 离线独立运行 (生产预览)',
    os: 'Windows 10 / 11 / Server',
    cmd: 'npm run electron:preview',
    desc: '编译生产代码后直接以独立客户端形式运行，无需浏览器或外网'
  },
  {
    target: 'Windows 客户端打包 (全格式)',
    os: 'Windows 10 / 11 / Server (x64 / ia32)',
    cmd: 'npm run dist:win',
    desc: '一键生成 NSIS 安装向导安装包 (.exe) 与绿色免安装单文件 (.exe)，位于 release/ 目录'
  },
  {
    target: 'Windows 免安装便携版打包',
    os: 'Windows 10 / 11 / Server (x64)',
    cmd: 'npm run dist:win-portable',
    desc: '生成单文件绿色便携版 (.exe)，U盘插即用，无需安装'
  },
  {
    target: 'Linux 客户端打包',
    os: 'Ubuntu / Debian / CentOS / RedHat / 凝思',
    cmd: 'npm run dist:linux',
    desc: '生成全 Linux 发行版通用的 AppImage 独立可执行程序、.deb 安装包及绿色目录'
  },
  {
    target: '跨平台全量双端打包',
    os: 'Windows + Linux 双系统分发',
    cmd: 'npm run dist:all',
    desc: '一次性编译生成 Windows 与 Linux 全架构分发包，位于 release/ 目录'
  }
];

const dockerCommands = [
  {
    step: '【仅需执行一次】构建基础环境镜像 ge-scada-env',
    desc: '预装 X11 / GTK3 / NSS / 文泉驿中文字体等所有底层依赖库（以后代码修改无需重新构建）',
    cmd: `cat > Dockerfile.base << 'EOF'
FROM node:22.21.1-slim
RUN apt-get update && apt-get install -y --no-install-recommends \\
    libglib2.0-0 libgtk-3-0 libnss3 libxss1 libxtst6 xdg-utils libnotify4 libatspi2.0-0 \\
    libuuid1 libsecret-1-0 libappindicator3-1 libx11-xcb1 libxcb1 libxcomposite1 \\
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \\
    libasound2 libpulse0 libgbm1 libdrm2 ca-certificates fonts-wqy-zenhei fonts-wqy-microhei \\
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
CMD ["./ge-scada", "--no-sandbox", "--disable-gpu-sandbox", "--disable-dev-shm-usage"]
EOF

docker build -t ge-scada-env:latest -f Dockerfile.base .`
  },
  {
    step: '【日常开发步骤 1】代码编译与绿色解包 (Ubuntu Node 22 容器)',
    desc: '前端 Vite 构建 + Electron 主进程打包，生成 release/linux-unpacked/',
    cmd: `docker run --rm \\
  -v $(pwd):/app \\
  -v ~/.cache/electron:/root/.cache/electron \\
  -v ~/.cache/electron-builder:/root/.cache/electron-builder \\
  -w /app \\
  -e ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" \\
  -e NODE_TLS_REJECT_UNAUTHORIZED=0 \\
  node:22.21.1-slim \\
  /bin/bash -c "
    npx electron-builder --config electron-builder.json --linux dir
  "`
  },
  {
    step: '【日常开发步骤 2】极速制作应用镜像 ge-scada-app (1~2秒)',
    desc: '基于已有的 ge-scada-env 底包，瞬间复制打包产物',
    cmd: `cat > Dockerfile << 'EOF'
FROM ge-scada-env:latest
COPY release/linux-unpacked/ /app/
RUN chmod +x /app/ge-scada
EOF

docker build -t ge-scada-app:latest .`
  },
  {
    step: '【日常开发步骤 3】导出镜像压缩包',
    desc: '导出应用镜像准备传往凝思工控机',
    cmd: 'docker save ge-scada-app:latest -o ge-scada-app.tar'
  },
  {
    step: '【日常开发步骤 4】传输至凝思工控机',
    desc: '通过 scp 传输镜像压缩文件',
    cmd: 'scp ge-scada-app.tar root@192.168.1.101:/home/docker/ge-scada-deploy/'
  },
  {
    step: '【凝思工控机】加载镜像并启动 SCADA (GUI 会话穿透)',
    desc: '开放 xhost 权限并挂载 /tmp/.X11-unix 与显卡设备，启动工业 SCADA 监控',
    cmd: `xhost +local:root
docker load -i ge-scada-app.tar
docker run -d \\
  --name ge-scada-instance \\
  --restart unless-stopped \\
  --net=host \\
  --ipc=host \\
  --shm-size=2gb \\
  -e DISPLAY=\${DISPLAY:-:0} \\
  -v /tmp/.X11-unix:/tmp/.X11-unix \\
  -v /dev/dri:/dev/dri \\
  --privileged \\
  ge-scada-app:latest`
  }
];

const copyCommand = (cmd: string, index: number | string) => {
  navigator.clipboard.writeText(cmd);
  copiedIndex.value = typeof index === 'number' ? index : 999;
  setTimeout(() => {
    copiedIndex.value = null;
  }, 2000);
};
</script>

<template>
  <div 
    v-if="visible"
    class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-6 select-none font-sans"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-3xl bg-[#060c18] border border-cyan-500/40 rounded-2xl shadow-[0_20px_70px_rgba(0,0,0,0.9)] flex flex-col max-h-[90vh] overflow-hidden">
      <!-- Modal Header -->
      <div class="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-[#040812]">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-md">
            <Laptop class="w-5 h-5 font-bold" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-mono font-bold text-white tracking-wider">
                多端兼容与桌面客户端工作台 (Web / Windows / Linux)
              </h2>
              <span class="px-2 py-0.5 text-[10px] font-mono rounded-full bg-cyan-950/80 border border-cyan-500/50 text-cyan-300">
                Electron 33.2.1 架构
              </span>
            </div>
            <p class="text-[11px] font-mono text-slate-400">
              同一套代码架构，无缝兼容 Web 网页浏览器、Windows 桌面端与 Linux 工业工控机
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

      <!-- Content Body -->
      <div class="p-5 flex-1 overflow-y-auto space-y-5 font-mono text-xs custom-scrollbar">
        <!-- 1. Current Environment Card -->
        <div class="p-4 rounded-xl bg-slate-950/90 border border-cyan-500/30">
          <div class="flex items-center justify-between mb-3">
            <span class="text-slate-300 font-bold flex items-center gap-2">
              <Cpu class="w-4 h-4 text-cyan-400" />
              <span>当前运行环境状态</span>
            </span>
            <span 
              class="px-2.5 py-1 rounded-full text-[10px] font-bold border"
              :class="currentPlatform === 'windows' 
                ? 'bg-blue-950 text-blue-300 border-blue-500/50' 
                : currentPlatform === 'linux' 
                  ? 'bg-amber-950 text-amber-300 border-amber-500/50' 
                  : 'bg-emerald-950 text-emerald-300 border-emerald-500/50'"
            >
              ● {{ currentPlatform === 'windows' ? 'Windows 桌面客户端' : currentPlatform === 'linux' ? 'Linux 桌面客户端' : 'Web 浏览器网页端 (Online)' }}
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2.5 text-[11px]">
            <div class="p-2.5 rounded-lg bg-[#050b18] border border-slate-800/80">
              <div class="text-slate-400 mb-1">🌐 Web 网页端</div>
              <div class="text-emerald-400 font-bold">完全就绪</div>
              <div class="text-[10px] text-slate-400 mt-1">Chrome/Edge/Firefox 零安装即用</div>
            </div>
            <div class="p-2.5 rounded-lg bg-[#050b18] border border-slate-800/80">
              <div class="text-slate-400 mb-1">🖥️ Windows 端</div>
              <div class="text-blue-400 font-bold">Electron 33.2.1</div>
              <div class="text-[10px] text-slate-400 mt-1">支持 Win 10/11/Server (exe/nsis)</div>
            </div>
            <div class="p-2.5 rounded-lg bg-[#050b18] border border-slate-800/80">
              <div class="text-slate-400 mb-1">🐧 Linux 端</div>
              <div class="text-amber-400 font-bold">AppImage / deb</div>
              <div class="text-[10px] text-slate-400 mt-1">Ubuntu/Debian/CentOS/国产OS</div>
            </div>
          </div>
        </div>

        <!-- 2. Core Industrial Advantages in Desktop Mode -->
        <div>
          <div class="text-slate-300 font-bold mb-2 flex items-center gap-2">
            <HardDrive class="w-4 h-4 text-cyan-400" />
            <span>桌面客户端核心工业优势</span>
          </div>
          <div class="grid grid-cols-2 gap-3 text-[11px]">
            <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
              <CheckCircle2 class="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div class="text-slate-200 font-bold">工控机沉浸式真全屏 (Kiosk 模式)</div>
                <div class="text-slate-400 text-[10px] mt-0.5 leading-normal">
                  支持无边框与开机全屏展示，防止车间/站控现场操作人员误触退出监控。
                </div>
              </div>
            </div>

            <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
              <CheckCircle2 class="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div class="text-slate-200 font-bold">本地磁盘直读直存</div>
                <div class="text-slate-400 text-[10px] mt-0.5 leading-normal">
                  调用系统原生对话框一键读写 SCADA 工程 JSON，支持本地离线数据持久化。
                </div>
              </div>
            </div>

            <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
              <CheckCircle2 class="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div class="text-slate-200 font-bold">独立沙箱与图形硬件加速</div>
                <div class="text-slate-400 text-[10px] mt-0.5 leading-normal">
                  使用独立 Chromium V8 与 Canvas 硬件图形加速，渲染帧率更高更稳定。
                </div>
              </div>
            </div>

            <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
              <CheckCircle2 class="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div class="text-slate-200 font-bold">100% 离线运行与本地通讯扩展</div>
                <div class="text-slate-400 text-[10px] mt-0.5 leading-normal">
                  无外网环境下完全独立稳定运行，支持无缝拓展 Modbus/TCP 与本地串口协议。
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab Selector -->
        <div class="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            @click="activeTab = 'docker'"
            class="flex-1 py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            :class="activeTab === 'docker' 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,242,255,0.2)]' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'"
          >
            <Terminal class="w-3.5 h-3.5 text-cyan-400" />
            <span>凝思/国产低版本工控机 Docker 镜像制作与部署 (推荐)</span>
          </button>
          <button
            @click="activeTab = 'desktop'"
            class="flex-1 py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            :class="activeTab === 'desktop' 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,242,255,0.2)]' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'"
          >
            <Laptop class="w-3.5 h-3.5 text-cyan-400" />
            <span>常规桌面端打包指令 (Win / Linux 原生)</span>
          </button>
        </div>

        <!-- TAB 1: Docker for Linx OS / 凝思 -->
        <div v-if="activeTab === 'docker'" class="space-y-4">
          <div class="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-slate-300 leading-relaxed text-[11px]">
            <div class="text-cyan-300 font-bold mb-1 flex items-center gap-1.5">
              <ShieldCheck class="w-4 h-4 text-cyan-400" />
              <span>凝思工控机环境专项适配说明</span>
            </div>
            针对凝思系统（Linx OS）内核与底层 GLIBC/GTK 库版本较低的痛点，采用
            <span class="text-cyan-300 font-bold">「Ubuntu 宿主 Node 22 编译 + Docker 容器运行 X11 GUI」</span> 方案，彻底绕过系统依赖限制，并在容器内内置
            <span class="text-emerald-300 font-bold">文泉驿中文字体库</span>、<span class="text-emerald-300 font-bold">无沙箱/共享内存优化</span> 与 <span class="text-emerald-300 font-bold">GPU 加速穿透</span>。
          </div>

          <div class="space-y-3">
            <div 
              v-for="(item, idx) in dockerCommands"
              :key="item.step"
              class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/40 transition-colors"
            >
              <div class="flex items-center justify-between mb-2">
                <div>
                  <span class="text-white font-bold text-xs">{{ item.step }}</span>
                  <span class="text-[11px] text-slate-400 ml-2">{{ item.desc }}</span>
                </div>
                <button
                  @click="copyCommand(item.cmd, 'docker-' + idx)"
                  class="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer text-[11px] shrink-0"
                >
                  <Check v-if="copiedIndex === 'docker-' + idx" class="w-3.5 h-3.5 text-emerald-400" />
                  <Copy v-else class="w-3.5 h-3.5" />
                  <span>{{ copiedIndex === 'docker-' + idx ? '已复制' : '复制命令' }}</span>
                </button>
              </div>

              <pre class="font-mono text-[11px] text-cyan-300 bg-[#030712] p-2.5 rounded-lg border border-cyan-500/20 overflow-x-auto whitespace-pre-wrap">{{ item.cmd }}</pre>
            </div>
          </div>
        </div>

        <!-- TAB 2: Standard Desktop Packaging -->
        <div v-else class="space-y-4">
          <div class="text-slate-300 font-bold flex items-center gap-2">
            <Terminal class="w-4 h-4 text-cyan-400" />
            <span>一键打包与分发指令 (Terminal Commands)</span>
          </div>

          <div class="space-y-2">
            <div 
              v-for="(item, index) in packagingCommands"
              :key="item.target"
              class="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/40 transition-colors flex items-center justify-between"
            >
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-white font-bold">{{ item.target }}</span>
                  <span class="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                    {{ item.os }}
                  </span>
                </div>
                <div class="text-[10px] text-slate-400">{{ item.desc }}</div>
                <div class="font-mono text-cyan-300 bg-slate-900/90 px-2 py-1 rounded border border-cyan-500/20 inline-block text-[11px]">
                  $ {{ item.cmd }}
                </div>
              </div>

              <button
                @click="copyCommand(item.cmd, index)"
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer shrink-0 ml-3"
              >
                <Check v-if="copiedIndex === index" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5" />
                <span>{{ copiedIndex === index ? '已复制' : '复制命令' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="p-4 border-t border-slate-800 bg-[#040812] flex items-center justify-between text-xs font-mono text-slate-400">
        <div class="flex items-center gap-2">
          <ShieldCheck class="w-4 h-4 text-emerald-400" />
          <span>支持 Windows 10/11/Server 与 Linux 全系工控架构 (x64 / arm64)</span>
        </div>
        <button
          @click="emit('close')"
          class="px-5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>
