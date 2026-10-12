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
  Sun
} from 'lucide-vue-next';
import { currentUser } from '../utils/auth';
import { isStayAwakeActive, stayAwakeMessage, toggleStayAwake } from '../utils/stayAwake';

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
  emit('open:window', id);
  showStartMenu.value = false;
};

const handleToggleStayAwake = async () => {
  await toggleStayAwake();
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

// 向上竖向系统菜单项 (按用户要求：监控运行/图形编辑/全站告警 全部放到竖向的菜单里)
const verticalMenuItems = [
  { id: 'monitor-screen', title: '监控运行', icon: Zap, color: 'text-amber-500' },
  { id: 'graphic-editor', title: '图形编辑', icon: PenTool, color: 'text-sky-600' },
  { id: 'alarm-window', title: '全站告警', icon: Bell, color: 'text-rose-500', isAlarm: true }
];
</script>

<template>
  <!-- ===================================================================== -->
  <!-- 简洁化常驻底栏 (纯白主题，白色底栏，系统菜单向上打开)                -->
  <!-- ===================================================================== -->
  <!-- ===================================================================== -->
  <!-- 简洁化常驻底栏 (护眼暖白/米白主题，系统菜单向上打开，字号调大清晰) -->
  <!-- ===================================================================== -->
  <footer class="fixed bottom-0 left-0 right-0 h-10.5 bg-[#f7f5ef] border-t border-[#e1ddd4] z-50 flex items-center justify-between px-3 text-slate-800 shadow-xs font-sans select-none tracking-wide">
    <!-- ======================================================= -->
    <!-- 1. 左侧：系统菜单按钮 (向上打开竖向菜单) + 窗口任务栏      -->
    <!-- ======================================================= -->
    <div class="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
      <!-- 系统菜单按钮容器 (点击向上打开竖向菜单，不受 overflow 影响) -->
      <div class="relative bottom-start-menu-container shrink-0">
        <button
          @click.stop="showStartMenu = !showStartMenu"
          class="h-8 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold text-[13px] flex items-center gap-2 transition-colors shadow-xs cursor-pointer tracking-wide"
          :class="{ 'ring-2 ring-sky-300 ring-offset-1': showStartMenu }"
          title="系统菜单 (点击向上打开)"
        >
          <div class="w-4 h-4 rounded bg-[#d81e06] text-white flex items-center justify-center font-black text-[10px] leading-none shadow-2xs">
            K
          </div>
          <span>系统菜单</span>
          <ChevronUp class="w-4 h-4 transition-transform stroke-[2.5]" :class="{ 'rotate-180': showStartMenu }" />
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
            class="absolute left-0 bottom-full mb-2 w-56 bg-[#faf8f5] border border-[#e2ddd4] rounded-xl shadow-2xl z-50 text-slate-800 py-1 divide-y divide-[#eee9df] overflow-hidden tracking-wide"
          >
            <!-- 菜单顶栏：简洁标题 -->
            <div class="px-3.5 py-2 bg-[#f4f1ea] border-b border-[#eee9df] flex items-center justify-between text-xs font-bold text-slate-700">
              <span class="flex items-center gap-2 text-slate-900">
                <span class="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                <span>系统菜单</span>
              </span>
              <span class="text-[11px] text-[#d81e06] font-bold">KND科能达</span>
            </div>

            <!-- 竖向主菜单项 (监控运行 / 图形编辑 / 全站告警) -->
            <div class="py-1">
              <button
                v-for="item in verticalMenuItems"
                :key="item.id"
                @click="handleSelectMenuItem(item.id)"
                class="w-full px-3.5 py-2.5 text-left hover:bg-[#efeae0] flex items-center justify-between transition-colors cursor-pointer text-[13.5px] font-bold text-slate-800 hover:text-sky-700"
              >
                <div class="flex items-center gap-3">
                  <component :is="item.icon" class="w-4.5 h-4.5 shrink-0" :class="item.color" />
                  <span>{{ item.title }}</span>
                </div>
                <!-- 告警数量角标 -->
                <span
                  v-if="item.isAlarm && unconfirmedAlarmCount > 0"
                  class="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-mono font-bold"
                >
                  {{ unconfirmedAlarmCount }}
                </span>
              </button>
            </div>

            <!-- 辅助窗口管理选项与退出程序 -->
            <div class="py-1.5 px-2 bg-[#f4f1ea] flex items-center justify-between text-xs border-b border-[#eee9df]">
              <button
                @click="emit('tile:windows'); showStartMenu = false;"
                class="px-2.5 py-1.5 rounded-md bg-[#faf8f5] hover:bg-[#efeae0] border border-[#e2ddd4] text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="平铺窗口"
              >
                <LayoutGrid class="w-3.5 h-3.5 text-sky-600" />
                <span>平铺</span>
              </button>
              <button
                @click="emit('cascade:windows'); showStartMenu = false;"
                class="px-2.5 py-1.5 rounded-md bg-[#faf8f5] hover:bg-[#efeae0] border border-[#e2ddd4] text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="层叠窗口"
              >
                <Layers class="w-3.5 h-3.5 text-sky-600" />
                <span>层叠</span>
              </button>
              <button
                @click="emit('minimize:all'); showStartMenu = false;"
                class="px-2.5 py-1.5 rounded-md hover:bg-[#efeae0] text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="最小化全部"
              >
                <Minimize2 class="w-3.5 h-3.5" />
                <span>桌面</span>
              </button>
            </div>

            <!-- 系统退出程序操作 -->
            <div class="py-1 bg-[#faf8f5]">
              <button
                @click="emit('exit:app'); showStartMenu = false;"
                class="w-full px-3.5 py-2 text-left hover:bg-rose-50 text-rose-600 hover:text-rose-700 flex items-center justify-between transition-colors cursor-pointer text-[13px] font-bold"
                title="安全退出 SCADA 监控程序"
              >
                <div class="flex items-center gap-2.5">
                  <Power class="w-4 h-4 text-rose-500" />
                  <span>退出程序</span>
                </div>
                <span class="text-[11px] text-rose-400 font-mono">Alt+F4</span>
              </button>
            </div>
          </div>
        </transition>
      </div>

      <!-- 窗口任务栏：正在打开的独立组态窗口标签 (可切换、最小化/还原、关闭) -->
      <div class="flex items-center gap-1.5 overflow-x-auto min-w-0 scrollbar-none border-l border-[#e2ddd4] pl-2.5">
        <div
          v-for="win in windows.filter(w => w.isOpen)"
          :key="win.id"
          @click="emit('toggle:window', win.id)"
          class="h-8 px-3 rounded-lg border text-[13px] flex items-center gap-2 transition-all cursor-pointer shrink-0 max-w-[170px] group shadow-2xs"
          :class="win.isActive && !win.isMinimized
            ? 'bg-sky-50 border-sky-400 text-sky-950 font-bold ring-1 ring-sky-300'
            : win.isMinimized
              ? 'bg-[#f4f1ea]/80 border-[#e2ddd4] text-slate-400 opacity-70 hover:opacity-100'
              : 'bg-[#faf8f5] hover:bg-[#efeae0] border-[#e2ddd4] text-slate-800 font-medium'"
          :title="`${win.title}\n点击最小化/激活`"
        >
          <component 
            :is="win.icon" 
            v-if="win.icon" 
            class="w-4 h-4 shrink-0"
            :class="win.isActive && !win.isMinimized ? 'text-sky-600' : 'text-slate-500'" 
          />
          <span class="truncate">{{ win.title }}</span>

          <!-- 单独关闭按钮 -->
          <button
            @click.stop="emit('close:window', win.id)"
            class="opacity-0 group-hover:opacity-100 hover:bg-[#efeae0] rounded p-0.5 text-slate-400 hover:text-slate-800 transition-opacity ml-1 cursor-pointer"
            title="关闭窗口"
          >
            <X class="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>

    <!-- ======================================================= -->
    <!-- 2. 右侧：状态区 (常亮防熄屏、安全天数、登录账号、时间秒) -->
    <!-- ======================================================= -->
    <div class="flex items-center gap-2.5 shrink-0 text-[13px]">
      <!-- 工业常亮防熄屏状态徽标 (点击可快速切换或查看状态) -->
      <button
        @click="handleToggleStayAwake"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[12px] font-bold transition-all cursor-pointer shadow-2xs"
        :class="isStayAwakeActive 
          ? 'bg-amber-50/90 border-amber-300 text-amber-900 hover:bg-amber-100' 
          : 'bg-[#faf8f5] border-[#e2ddd4] text-slate-500 hover:bg-[#efeae0]'"
        :title="stayAwakeMessage + '\n点击切换工业常亮/系统节能保护'"
      >
        <Sun class="w-3.5 h-3.5 shrink-0" :class="isStayAwakeActive ? 'text-amber-600 animate-pulse' : 'text-slate-400'" />
        <span>{{ isStayAwakeActive ? '常亮保护 (防熄屏)' : '常亮已关' }}</span>
        <span class="w-1.5 h-1.5 rounded-full" :class="isStayAwakeActive ? 'bg-amber-500' : 'bg-slate-400'" />
      </button>

      <!-- 安全运行天数 -->
      <div 
        class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[12.5px]"
        title="变电站连续安全稳定运行天数"
      >
        <ShieldCheck class="w-4 h-4 text-emerald-600 shrink-0" />
        <span>安全运行 {{ safetyDays }} 天</span>
      </div>

      <!-- 登录账号操作 -->
      <div class="relative bottom-user-menu-container">
        <button
          @click.stop="showUserMenu = !showUserMenu"
          class="flex items-center gap-2 px-2.5 py-1 rounded-md hover:bg-[#efeae0] text-slate-800 transition-colors cursor-pointer border border-transparent hover:border-[#e2ddd4] text-[13px] font-bold"
          :title="`当前操作员: ${currentUser.name} (${currentUser.role})`"
        >
          <div class="w-5 h-5 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-[11px]">
            {{ currentUser.name.slice(0, 1) }}
          </div>
          <span class="font-mono text-slate-900">{{ currentUser.name }}</span>
        </button>

        <!-- 登录账号菜单浮层 -->
        <div
          v-if="showUserMenu"
          class="absolute right-0 bottom-full mb-2 w-48 bg-[#faf8f5] border border-[#e2ddd4] rounded-xl shadow-xl py-1 z-50 text-[13px] text-slate-800 divide-y divide-[#eee9df] tracking-wide"
        >
          <div class="px-3.5 py-2 bg-[#f4f1ea]">
            <div class="font-bold text-slate-900">{{ currentUser.name }}</div>
            <div class="text-[11px] text-slate-500 font-mono">{{ currentUser.role }}</div>
          </div>
          <div class="py-1">
            <button
              @click="emit('open:login'); showUserMenu = false;"
              class="w-full px-3.5 py-2 text-left hover:bg-[#efeae0] flex items-center gap-2.5 cursor-pointer text-slate-800 font-medium"
            >
              <User class="w-4 h-4 text-sky-600" />
              <span>切换用户</span>
            </button>
            <button
              @click="emit('logout'); showUserMenu = false;"
              class="w-full px-3.5 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 cursor-pointer font-bold"
            >
              <LogOut class="w-4 h-4 text-rose-500" />
              <span>注销登录</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 时间精确到秒 -->
      <div 
        class="flex items-center gap-1.5 font-mono text-[13px] font-bold text-slate-800 bg-[#f4f1ea] px-2.5 py-1 rounded-md border border-[#e2ddd4] tracking-tight"
        title="系统时间"
      >
        <Clock class="w-4 h-4 text-sky-600 shrink-0" />
        <span>{{ currentTimeStr }}</span>
      </div>
    </div>
  </footer>
</template>
