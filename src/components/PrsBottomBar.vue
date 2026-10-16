<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import {
  ShieldCheck,
  Bell,
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
  Activity
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
  windows: BottomWindowItem[];
  activeWindowId?: string;
  unconfirmedAlarmCount?: number;
  safetyDays?: number;
}

const props = withDefaults(defineProps<Props>(), {
  unconfirmedAlarmCount: 4,
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
}>();

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

// 向上竖向系统菜单项 (按用户要求：监控运行/图形编辑/全站告警/系统健康 全部放到竖向的菜单里)
const verticalMenuItems = [
  { id: 'monitor-screen', title: '监控运行', icon: Zap, color: 'text-amber-500' },
  { id: 'graphic-editor', title: '图形编辑', icon: PenTool, color: 'text-sky-600' },
  { id: 'alarm-window', title: '全站告警', icon: Bell, color: 'text-rose-500', isAlarm: true },
  { id: 'health-monitor', title: '系统健康与黑匣子', icon: Activity, color: 'text-cyan-600' }
];
</script>

<template>
  <!-- ===================================================================== -->
  <!-- 简洁化常驻底栏 (护眼暖白/米白主题，字体图标大小与顶栏对齐，不加深字体) -->
  <!-- ===================================================================== -->
  <footer class="fixed bottom-0 left-0 right-0 h-11 bg-[#ebe4d4] border-t border-[#cfc5b0] z-50 flex items-center justify-between px-3.5 text-slate-800 shadow-xs font-sans select-none tracking-wide">
    <!-- ======================================================= -->
    <!-- 1. 左侧：系统菜单按钮 + 全站告警单图标 + 窗口任务栏           -->
    <!-- ======================================================= -->
    <div class="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
      <!-- 系统菜单按钮容器 (点击向上打开竖向菜单，字体不加深，大小与顶栏一样) -->
      <div class="relative bottom-start-menu-container shrink-0">
        <button
          @click.stop="showStartMenu = !showStartMenu"
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

        <!-- 向上打开的竖向菜单 (垂直排列：监控运行 / 图形编辑 / 全站告警) -->
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
            class="absolute left-0 bottom-full mb-2 w-58 bg-[#f2eee3] border border-[#cfc5b0] rounded-xl shadow-2xl z-50 text-slate-800 py-1 divide-y divide-[#ded5bf] overflow-hidden tracking-wide"
          >
            <!-- 菜单顶栏：简洁标题 -->
            <div class="px-3.5 py-2.5 bg-[#e5decb] border-b border-[#ded5bf] flex items-center justify-between text-[13.5px] font-medium text-slate-700">
              <span class="flex items-center gap-2 text-slate-900">
                <span class="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                <span>系统菜单</span>
              </span>
              <span class="text-[12px] text-[#d81e06] font-bold">KND科能达</span>
            </div>

            <!-- 竖向主菜单项 (监控运行 / 图形编辑 / 全站告警，字体不加深) -->
            <div class="py-1">
              <button
                v-for="item in verticalMenuItems"
                :key="item.id"
                @click="handleSelectMenuItem(item.id)"
                class="w-full px-3.5 py-2.5 text-left hover:bg-[#e4dcce] flex items-center justify-between transition-colors cursor-pointer text-[15px] font-medium text-slate-800 hover:text-sky-700"
              >
                <div class="flex items-center gap-3">
                  <component :is="item.icon" class="w-5 h-5 shrink-0 stroke-[2]" :class="item.color" />
                  <span>{{ item.title }}</span>
                </div>
                <!-- 告警数量角标 -->
                <span
                  v-if="item.isAlarm && unconfirmedAlarmCount > 0"
                  class="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-mono font-medium"
                >
                  {{ unconfirmedAlarmCount }}
                </span>
              </button>
            </div>

            <!-- 辅助窗口管理选项与退出程序 -->
            <div class="py-1.5 px-2 bg-[#e5decb] flex items-center justify-between text-[13px] border-b border-[#ded5bf]">
              <button
                @click="emit('tile:windows'); showStartMenu = false;"
                class="px-2.5 py-1.5 rounded-md bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#cfc5b0] text-slate-800 text-[13px] font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="平铺窗口"
              >
                <LayoutGrid class="w-4 h-4 text-sky-600" />
                <span>平铺</span>
              </button>
              <button
                @click="emit('cascade:windows'); showStartMenu = false;"
                class="px-2.5 py-1.5 rounded-md bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#cfc5b0] text-slate-800 text-[13px] font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="层叠窗口"
              >
                <Layers class="w-4 h-4 text-sky-600" />
                <span>层叠</span>
              </button>
              <button
                @click="emit('minimize:all'); showStartMenu = false;"
                class="px-2.5 py-1.5 rounded-md hover:bg-[#e4dcce] text-slate-700 text-[13px] font-medium flex items-center gap-1.5 cursor-pointer"
                title="最小化全部"
              >
                <Minimize2 class="w-4 h-4" />
                <span>桌面</span>
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

      <!-- 全站告警：底栏中只保留单个图标按钮 (字体图标大小与顶栏一样，带告警角标) -->
      <button
        @click="handleOpenAlarm"
        class="h-9 w-9 rounded-lg bg-[#f2eee3] hover:bg-rose-50 border border-[#cfc5b0] hover:border-rose-300 text-slate-700 hover:text-rose-600 flex items-center justify-center relative cursor-pointer shadow-2xs transition-colors shrink-0"
        :class="{ 'border-rose-400 bg-rose-50/70 text-rose-600 ring-1 ring-rose-200': unconfirmedAlarmCount > 0 }"
        title="全站告警 (点击打开告警窗口)"
      >
        <Bell class="w-4.5 h-4.5 text-rose-500 shrink-0 stroke-[2]" />
        <!-- 告警数量微标 -->
        <span
          v-if="unconfirmedAlarmCount > 0"
          class="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-medium flex items-center justify-center shadow-xs"
        >
          {{ unconfirmedAlarmCount }}
        </span>
      </button>

      <!-- 窗口任务栏：正在打开的独立组态窗口标签 (字号与图标同顶栏一样放大，不加深) -->
      <div class="flex items-center gap-1.5 overflow-x-auto min-w-0 scrollbar-none border-l border-[#cfc5b0] pl-2.5">
        <div
          v-for="win in windows.filter(w => w.isOpen)"
          :key="win.id"
          @click="emit('toggle:window', win.id)"
          class="h-9 px-3.5 rounded-lg border text-[14.5px] flex items-center gap-2 transition-all cursor-pointer shrink-0 max-w-[185px] group shadow-2xs font-medium"
          :class="win.isActive && !win.isMinimized
            ? 'bg-sky-50 border-sky-400 text-sky-950 ring-1 ring-sky-300'
            : win.isMinimized
              ? 'bg-[#e5decb]/80 border-[#cfc5b0] text-slate-400 opacity-70 hover:opacity-100'
              : 'bg-[#f2eee3] hover:bg-[#e4dcce] border-[#cfc5b0] text-slate-800'"
          :title="`${win.title}\n点击最小化/激活`"
        >
          <component 
            :is="win.icon" 
            v-if="win.icon" 
            class="w-4.5 h-4.5 shrink-0 stroke-[2]"
            :class="win.isActive && !win.isMinimized ? 'text-sky-600' : 'text-slate-500'" 
          />
          <span class="truncate">{{ win.title }}</span>

          <!-- 单独关闭按钮 -->
          <button
            @click.stop="emit('close:window', win.id)"
            class="opacity-0 group-hover:opacity-100 hover:bg-[#e4dcce] rounded p-0.5 text-slate-400 hover:text-slate-800 transition-opacity ml-1 cursor-pointer"
            title="关闭窗口"
          >
            <X class="w-4 h-4 stroke-[2]" />
          </button>
        </div>
      </div>
    </div>

    <!-- ======================================================= -->
    <!-- 2. 右侧：状态区 (删掉黑匣子与防熄屏按钮，安全天数、登录账号、时间秒) -->
    <!-- ======================================================= -->
    <div class="flex items-center gap-3 shrink-0 text-[14.5px]">
      <!-- 安全运行天数 (字体图标与顶栏一致) -->
      <div 
        class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium text-[14px]"
        title="变电站连续安全稳定运行天数"
      >
        <ShieldCheck class="w-4.5 h-4.5 text-emerald-600 shrink-0 stroke-[2]" />
        <span>安全运行 {{ safetyDays }} 天</span>
      </div>

      <!-- 登录账号操作 (字体图标与顶栏一致) -->
      <div class="relative bottom-user-menu-container">
        <button
          @click.stop="showUserMenu = !showUserMenu"
          class="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[#e4dcce] text-slate-800 transition-colors cursor-pointer border border-transparent hover:border-[#cfc5b0] text-[14.5px] font-medium"
          :title="`当前操作员: ${currentUser.name} (${currentUser.role})`"
        >
          <div class="w-5.5 h-5.5 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-medium text-xs">
            {{ currentUser.name.slice(0, 1) }}
          </div>
          <span class="font-mono text-slate-900">{{ currentUser.name }}</span>
        </button>

        <!-- 登录账号菜单浮层 -->
        <div
          v-if="showUserMenu"
          class="absolute right-0 bottom-full mb-2 w-48 bg-[#f2eee3] border border-[#cfc5b0] rounded-xl shadow-xl py-1 z-50 text-[14px] text-slate-800 divide-y divide-[#ded5bf] tracking-wide"
        >
          <div class="px-3.5 py-2 bg-[#e5decb]">
            <div class="font-medium text-slate-900">{{ currentUser.name }}</div>
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

      <!-- 时间精确到秒 (字号图标放大与顶栏一致) -->
      <div 
        class="flex items-center gap-2 font-mono text-[14.5px] font-medium text-slate-800 bg-[#e5decb] px-3 py-1.5 rounded-md border border-[#cfc5b0] tracking-tight"
        title="系统时间"
      >
        <Clock class="w-4.5 h-4.5 text-sky-600 shrink-0 stroke-[2]" />
        <span>{{ currentTimeStr }}</span>
      </div>
    </div>
  </footer>
</template>
