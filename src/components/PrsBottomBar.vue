<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  LogOut,
  Zap,
  PenTool,
  X,
  ChevronUp,
  User,
  LayoutGrid,
  Layers,
  Minimize2,
  Power,
  Activity,
  LineChart,
  History,
  FileSpreadsheet,
  Volume2,
  VolumeX,
  Bell
} from 'lucide-vue-next';
import { currentUser } from '../utils/auth';

export interface BottomWindowItem {
  id: string;
  title: string;
  icon?: any;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  isActive: boolean;
  badge?: number | string;
}

interface Props {
  windows?: BottomWindowItem[];
  activeWindowId?: string;
  unconfirmedAlarmCount?: number;
  safetyDays?: number;
}

const props = withDefaults(defineProps<Props>(), {
  windows: () => [],
  unconfirmedAlarmCount: 0,
  safetyDays: 1428
});

const emit = defineEmits<{
  (e: 'toggle:window', id: string): void;
  (e: 'open:window', id: string): void;
  (e: 'close:window', id: string): void;
  (e: 'tile:windows'): void;
  (e: 'cascade:windows'): void;
  (e: 'minimize:all'): void;
  (e: 'logout'): void;
  (e: 'open:login'): void;
  (e: 'exit:app'): void;
  (e: 'open:health'): void;
  (e: 'toggle:sound'): void;
}>();

// 消音开关状态 (默认消音，参考现场监控状态)
const isMuted = ref(true);

// 系统时间精确到秒 (实时定时器)
const currentTimeStr = ref('');
let timerId: any = null;

const updateClock = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  currentTimeStr.value = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

onMounted(() => {
  updateClock();
  timerId = setInterval(updateClock, 1000);
});

onBeforeUnmount(() => {
  if (timerId) clearInterval(timerId);
});

// 菜单与弹窗控制
const showStartMenu = ref(false);
const showUserMenu = ref(false);

// 切换系统菜单 (在 Electron 中唤起专用不被截断的菜单窗口，在 Web 中切换内置浮层)
const handleToggleStartMenu = async () => {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.toggleStartMenu) {
    try {
      await (window as any).electronAPI.toggleStartMenu();
      return;
    } catch (err) {
      console.warn('调用 Electron toggleStartMenu 失败:', err);
    }
  }
  showStartMenu.value = !showStartMenu.value;
};

// 切换用户菜单 (在 Electron 中唤起专用不被截断的用户菜单独立窗口，在 Web 中切换内置浮层，保证最上层显示)
const handleToggleUserMenu = async () => {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.toggleUserMenu) {
    try {
      await (window as any).electronAPI.toggleUserMenu();
      return;
    } catch (err) {
      console.warn('调用 Electron toggleUserMenu 失败:', err);
    }
  }
  showUserMenu.value = !showUserMenu.value;
};

// 点击菜单项
const handleSelectMenuItem = (id: string) => {
  if (id === 'health-monitor') {
    emit('open:health');
  } else {
    emit('open:window', id);
  }
  showStartMenu.value = false;
};

// 点击全站告警快捷图标
const handleOpenAlarm = () => {
  emit('open:window', 'alarm-window');
};

// 点击空白关闭弹窗
const handleGlobalClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.bottom-start-menu-container')) {
    showStartMenu.value = false;
  }
  if (!target.closest('.bottom-user-menu-container')) {
    showUserMenu.value = false;
  }
};

onMounted(() => {
  window.addEventListener('click', handleGlobalClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleGlobalClick);
});

// 向上竖向系统菜单项 (按用户要求：监控运行/图形编辑/全站告警/历史曲线/历史告警/报表)
const verticalMenuItems = [
  { id: 'monitor-screen', title: '监控运行', icon: Zap, color: 'text-amber-500' },
  { id: 'graphic-editor', title: '图形编辑', icon: PenTool, color: 'text-sky-600' },
  { id: 'realtime-data', title: '实时数据', icon: Activity, color: 'text-teal-600' },
  { id: 'alarm-window', title: '全站告警', icon: Bell, color: 'text-rose-500' },
  { id: 'history-curve', title: '历史曲线', icon: LineChart, color: 'text-indigo-600' },
  { id: 'history-alarm', title: '历史告警', icon: History, color: 'text-orange-500' },
  { id: 'report-window', title: '报表', icon: FileSpreadsheet, color: 'text-emerald-600' }
];
</script>

<template>
  <!-- ===================================================================== -->
  <!-- 简洁化常驻底栏 (护眼暖白/米白主题，字体图标大小与顶栏对齐，保证最高层级) -->
  <!-- ===================================================================== -->
  <footer class="fixed bottom-0 left-0 right-0 h-11 bg-[#ebe4d4] border-t border-[#cfc5b0] z-[99990] flex items-center justify-between px-3.5 text-slate-800 shadow-xs font-sans select-none tracking-wide">
    <!-- ======================================================= -->
    <!-- 1. 左侧：系统菜单按钮 + 全站告警单图标 + 窗口任务栏           -->
    <!-- ======================================================= -->
    <div class="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
      <!-- 系统菜单按钮容器 (点击向上打开竖向菜单，字体不加深，大小与顶栏一样) -->
      <div class="relative bottom-start-menu-container shrink-0">
        <button
          @click.stop="handleToggleStartMenu"
          class="h-9 px-3.5 rounded-lg bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-medium text-[15px] flex items-center gap-2.5 transition-colors shadow-xs cursor-pointer tracking-wide"
          :class="{ 'ring-2 ring-sky-300 ring-offset-1': showStartMenu }"
          title="系统菜单 (点击向上打开)"
        >
          <div class="w-5 h-5 rounded bg-[#d81e06] text-white flex items-center justify-center font-bold text-[11px] leading-none shadow-2xs">
            K
          </div>
          <span>系统菜单</span>
          <ChevronUp class="w-4.5 h-4.5 transition-transform stroke-[2]" :class="{ 'rotate-180': showStartMenu }" />
        </button>

        <!-- 向上打开的竖向菜单 (垂直排列：监控运行 / 图形编辑 / 全站告警，直角防透黑，最上层显示) -->
        <transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 translate-y-2 scale-95"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 translate-y-2 scale-95"
        >
          <div
            v-if="showStartMenu"
            class="absolute left-0 bottom-full mb-2 w-58 bg-[#f2eee3] border-2 border-[#b8ad96] rounded-none shadow-2xl z-[99999] text-slate-800 py-1 divide-y divide-[#ded5bf] overflow-hidden tracking-wide"
          >
            <!-- 菜单顶栏：简洁标题 -->
            <div class="px-3.5 py-2.5 bg-[#e5decb] border-b border-[#ded5bf] flex items-center justify-between text-[13.5px] font-medium text-slate-700">
              <span class="flex items-center gap-2 text-slate-900">
                <span class="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                <span>系统菜单</span>
              </span>
              <span class="text-[12px] text-[#d81e06] font-bold">KND科能达</span>
            </div>

            <!-- 竖向主菜单项 (监控运行 / 图形编辑 / 全站告警 / 历史曲线 / 历史告警 / 报表) -->
            <div class="py-1">
              <button
                v-for="item in verticalMenuItems"
                :key="item.id"
                @click="handleSelectMenuItem(item.id)"
                class="w-full px-3.5 py-2.5 text-left hover:bg-[#e4dcce] flex items-center justify-between transition-colors cursor-pointer text-[15px] font-medium text-slate-800 hover:text-sky-700"
              >
                <div class="flex items-center gap-3">
                  <component
                    :is="item.icon"
                    class="w-5 h-5 shrink-0 stroke-[2]"
                    :class="item.color"
                  />
                  <span>{{ item.title }}</span>
                </div>
              </button>
            </div>

            <!-- 系统退出程序操作 -->
            <div class="py-1 bg-[#f2eee3]">
              <button
                @click="emit('exit:app'); showStartMenu = false;"
                class="w-full px-3.5 py-2.5 text-left hover:bg-rose-50 text-rose-600 hover:text-rose-700 flex items-center justify-between transition-colors cursor-pointer text-[14px] font-medium"
                title="安全退出 SCADA 监控程序"
              >
                <div class="flex items-center gap-2.5">
                  <Power class="w-4.5 h-4.5 text-rose-500" />
                  <span>退出程序</span>
                </div>
                <span class="text-[12px] text-rose-400 font-mono">Alt+F4</span>
              </button>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <!-- 中间区域：保持整洁通透，不展示任何内部模块标签 (按深瑞多进程架构：各子模块在凝思系统原生任务栏面板显示独立进程标签) -->
    <div class="flex-1 min-w-0"></div>

    <!-- ======================================================= -->
    <!-- 2. 右侧：状态区 (消音喇叭、告警圆指示灯、用户、安全天数、时间) -->
    <!-- ======================================================= -->
    <div class="flex items-center gap-7 shrink-0 text-[14.5px] font-bold">
      <!-- 消音控制按钮 (声音图标与告警圆图标一样大 w-7 h-7) -->
      <button
        @click="isMuted = !isMuted; emit('toggle:sound')"
        class="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 cursor-pointer transition-colors shrink-0"
        :title="isMuted ? '警报声音: 已消音 (点击开启)' : '警报声音: 开启 (点击消音)'"
      >
        <VolumeX v-if="isMuted" class="w-6.5 h-6.5 text-sky-600 stroke-[2.2]" />
        <Volume2 v-else class="w-6.5 h-6.5 text-sky-600 stroke-[2.2]" />
      </button>

      <!-- 全站告警状态指示：原版纯实心圆，稍微缩小 (w-7 h-7)，没有告警为绿色实心圆，有未确认告警红/绿1秒交替闪烁 -->
      <button
        @click="handleOpenAlarm"
        class="w-7 h-7 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 shrink-0 border-0 p-0 focus:outline-none shadow-xs"
        :class="unconfirmedAlarmCount > 0 ? 'scada-alarm-dot-blinking' : 'bg-emerald-500'"
        title="实时告警 (点击打开告警窗)"
      />

      <!-- 登录账号 (点击呼出用户菜单，在最上层展示，无黑角) -->
      <div class="relative bottom-user-menu-container">
        <button
          @click.stop="handleToggleUserMenu"
          class="flex items-center gap-1.5 text-slate-900 hover:text-sky-700 transition-colors cursor-pointer text-[14.5px] font-bold"
          :title="`当前操作员: ${currentUser.name} (${currentUser.role})`"
        >
          <User class="w-4.5 h-4.5 text-slate-700 shrink-0 stroke-[2.2]" />
          <span>{{ currentUser.name }}</span>
        </button>

        <!-- 登录账号菜单浮层 (保证最上层显示，直角设计防止在X11系统上产生黑角) -->
        <div
          v-if="showUserMenu"
          class="absolute right-0 bottom-full mb-2 w-48 bg-[#f2eee3] border-2 border-[#b8ad96] rounded-none shadow-2xl py-1 z-[99999] text-[14px] text-slate-800 divide-y divide-[#ded5bf] tracking-wide"
        >
          <div class="px-3.5 py-2 bg-[#e5decb]">
            <div class="font-bold text-slate-900">{{ currentUser.name }}</div>
            <div class="text-[12px] text-slate-500 font-mono">{{ currentUser.role }}</div>
          </div>
          <div class="py-1">
            <button
              @click="emit('open:login'); showUserMenu = false;"
              class="w-full px-3.5 py-2 text-left hover:bg-[#e4dcce] flex items-center gap-2.5 cursor-pointer text-slate-800 font-medium"
            >
              <User class="w-4.5 h-4.5 text-sky-600" />
              <span>切换用户</span>
            </button>
            <button
              @click="emit('logout'); showUserMenu = false;"
              class="w-full px-3.5 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 cursor-pointer font-medium"
            >
              <LogOut class="w-4.5 h-4.5 text-rose-500" />
              <span>注销登录</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 安全运行天数 (字体加粗，间隔加大) -->
      <span 
        class="hidden sm:inline text-slate-900 text-[14.5px] font-bold whitespace-nowrap"
        title="变电站连续安全稳定运行天数"
      >
        安全运行{{ safetyDays }}天
      </span>

      <!-- 系统时间 (字体加粗，间隔加大) -->
      <span 
        class="font-mono font-bold text-[14.5px] text-slate-900 tracking-tight whitespace-nowrap"
        title="系统时间"
      >
        {{ currentTimeStr }}
      </span>
    </div>
  </footer>
</template>

<style scoped>
/* 告警实心圆指示灯：红/绿 1s 一次交替闪烁 (方波等宽交替) */
@keyframes scada-alarm-rg-blink {
  0%, 49.9% {
    background-color: #ef4444; /* 红色 */
  }
  50%, 100% {
    background-color: #10b981; /* 绿色 */
  }
}

.scada-alarm-dot-blinking {
  animation: scada-alarm-rg-blink 1s steps(1, end) infinite;
}
</style>
