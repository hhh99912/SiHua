<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  Minus,
  Square,
  Copy,
  X,
  Maximize2,
  Minimize2
} from 'lucide-vue-next';

interface Props {
  id: string;
  title: string;
  subtitle?: string;
  icon?: any;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  canMaximize?: boolean;
  canMinimize?: boolean;
  canClose?: boolean;
  headerTheme?: 'white' | 'dark';
  hideHeaderWhenMaximized?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  minWidth: 400,
  minHeight: 280,
  canMaximize: true,
  canMinimize: true,
  canClose: true,
  headerTheme: 'white',
  hideHeaderWhenMaximized: false
});

const emit = defineEmits<{
  (e: 'update:x', val: number): void;
  (e: 'update:y', val: number): void;
  (e: 'update:width', val: number): void;
  (e: 'update:height', val: number): void;
  (e: 'update:isMinimized', val: boolean): void;
  (e: 'update:isMaximized', val: boolean): void;
  (e: 'focus'): void;
  (e: 'close'): void;
  (e: 'minimize'): void;
  (e: 'maximize'): void;
  (e: 'restore'): void;
}>();

// 拖拽窗口移动
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const initialWindowX = ref(0);
const initialWindowY = ref(0);

const handleTitleBarMouseDown = (e: MouseEvent) => {
  if (props.isMaximized) return;
  // If clicked on window control buttons, don't drag
  if ((e.target as HTMLElement).closest('.window-control-btn')) return;

  emit('focus');
  isDragging.value = true;
  dragStartX.value = e.clientX;
  dragStartY.value = e.clientY;
  initialWindowX.value = props.x;
  initialWindowY.value = props.y;

  window.addEventListener('mousemove', handleWindowMouseMove);
  window.addEventListener('mouseup', handleWindowMouseUp);
};

const handleWindowMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  const deltaX = e.clientX - dragStartX.value;
  const deltaY = e.clientY - dragStartY.value;

  const newX = Math.max(0, Math.min(window.innerWidth - 100, initialWindowX.value + deltaX));
  const newY = Math.max(0, Math.min(window.innerHeight - 80, initialWindowY.value + deltaY));

  emit('update:x', newX);
  emit('update:y', newY);
};

const handleWindowMouseUp = () => {
  isDragging.value = false;
  window.removeEventListener('mousemove', handleWindowMouseMove);
  window.removeEventListener('mouseup', handleWindowMouseUp);
};

// 拖拽调整大小 (右下角与边框)
const isResizing = ref(false);
const resizeMode = ref<'se' | 'e' | 's' | null>(null);
const resizeStartX = ref(0);
const resizeStartY = ref(0);
const initialWidth = ref(0);
const initialHeight = ref(0);

const handleResizeMouseDown = (mode: 'se' | 'e' | 's', e: MouseEvent) => {
  if (props.isMaximized) return;
  e.stopPropagation();
  emit('focus');

  isResizing.value = true;
  resizeMode.value = mode;
  resizeStartX.value = e.clientX;
  resizeStartY.value = e.clientY;
  initialWidth.value = props.width;
  initialHeight.value = props.height;

  window.addEventListener('mousemove', handleResizeMouseMove);
  window.addEventListener('mouseup', handleResizeMouseUp);
};

const handleResizeMouseMove = (e: MouseEvent) => {
  if (!isResizing.value) return;
  const deltaX = e.clientX - resizeStartX.value;
  const deltaY = e.clientY - resizeStartY.value;

  if (resizeMode.value === 'se' || resizeMode.value === 'e') {
    const newWidth = Math.max(props.minWidth, Math.min(window.innerWidth, initialWidth.value + deltaX));
    emit('update:width', newWidth);
  }

  if (resizeMode.value === 'se' || resizeMode.value === 's') {
    const newHeight = Math.max(props.minHeight, Math.min(window.innerHeight - 40, initialHeight.value + deltaY));
    emit('update:height', newHeight);
  }
};

const handleResizeMouseUp = () => {
  isResizing.value = false;
  resizeMode.value = null;
  window.removeEventListener('mousemove', handleResizeMouseMove);
  window.removeEventListener('mouseup', handleResizeMouseUp);
};

// 双击标题栏最大化 / 还原
const handleTitleBarDoubleClick = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('.window-control-btn')) return;
  if (!props.canMaximize) return;
  emit('update:isMaximized', !props.isMaximized);
};

const handleMinimize = () => {
  emit('minimize');
  emit('update:isMinimized', true);
};

const handleToggleMaximize = () => {
  if (props.isMaximized) {
    emit('restore');
    emit('update:isMaximized', false);
  } else {
    emit('maximize');
    emit('update:isMaximized', true);
  }
};

const handleClose = () => {
  emit('close');
};

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleWindowMouseMove);
  window.removeEventListener('mouseup', handleWindowMouseUp);
  window.removeEventListener('mousemove', handleResizeMouseMove);
  window.removeEventListener('mouseup', handleResizeMouseUp);
});
</script>

<template>
  <div
    v-show="isOpen && !isMinimized"
    @mousedown="emit('focus')"
    class="fixed flex flex-col select-none transition-shadow duration-150 overflow-hidden"
    :style="isMaximized ? {
      top: '0px',
      left: '0px',
      width: '100vw',
      height: 'calc(100vh - 40px)',
      zIndex: zIndex
    } : {
      top: `${y}px`,
      left: `${x}px`,
      width: `${width}px`,
      height: `${height}px`,
      zIndex: zIndex
    }"
    :class="[
      isMaximized 
        ? 'rounded-none border-b border-slate-300 shadow-none' 
        : 'rounded-lg border border-slate-300 shadow-2xl bg-[#fafafa]',
      isDragging ? 'opacity-95' : 'opacity-100'
    ]"
  >
    <!-- ========================================== -->
    <!-- 1. 窗口标题栏 (Draggable Header)           -->
    <!-- ========================================== -->
    <div
      v-if="!((id === 'monitor-screen' || hideHeaderWhenMaximized) && isMaximized)"
      @mousedown="handleTitleBarMouseDown"
      @dblclick="handleTitleBarDoubleClick"
      class="h-8.5 px-3 flex items-center justify-between shrink-0 cursor-move border-b select-none transition-colors"
      :class="headerTheme === 'white' 
        ? 'bg-[#fbfbfb] border-slate-200 text-slate-800 hover:bg-[#f3f4f6]' 
        : 'bg-[#0f1d38] border-[#1d3560] text-slate-100 hover:bg-[#142647]'"
    >
      <!-- 左侧：图标 + 标题 + 副标题 -->
      <div class="flex items-center gap-2 min-w-0">
        <component
          :is="icon"
          v-if="icon"
          class="w-4 h-4 shrink-0"
          :class="headerTheme === 'white' ? 'text-sky-600' : 'text-sky-400'"
        />
        <div class="flex items-center gap-2 truncate">
          <span 
            class="text-xs font-bold truncate"
            :class="headerTheme === 'white' ? 'text-slate-900' : 'text-white'"
          >
            {{ title }}
          </span>
          <span 
            v-if="subtitle" 
            class="text-[10px] font-mono px-1.5 py-0.2 rounded hidden sm:inline-block truncate"
            :class="headerTheme === 'white' 
              ? 'bg-[#f3f4f6] text-slate-600 border border-slate-200' 
              : 'bg-black/40 text-slate-400 border border-white/10'"
          >
            {{ subtitle }}
          </span>
        </div>
      </div>

      <!-- 右侧：窗口控制按钮组 (最小化、最大化/还原、关闭) -->
      <div class="flex items-center gap-1 window-control-btn shrink-0">
        <!-- 最小化 -->
        <button
          v-if="canMinimize"
          @click.stop="handleMinimize"
          class="w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer"
          :class="headerTheme === 'white' 
            ? 'hover:bg-slate-200 text-slate-600 hover:text-slate-900' 
            : 'hover:bg-white/10 text-slate-300 hover:text-white'"
          title="最小化到任务底栏"
        >
          <Minus class="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        <!-- 最大化 / 还原 -->
        <button
          v-if="canMaximize"
          @click.stop="handleToggleMaximize"
          class="w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer"
          :class="headerTheme === 'white' 
            ? 'hover:bg-slate-200 text-slate-600 hover:text-slate-900' 
            : 'hover:bg-white/10 text-slate-300 hover:text-white'"
          :title="isMaximized ? '还原窗口' : '最大化窗口'"
        >
          <component 
            :is="isMaximized ? Copy : Square" 
            class="w-3 h-3 stroke-[2.2]" 
          />
        </button>

        <!-- 关闭 -->
        <button
          v-if="canClose"
          @click.stop="handleClose"
          class="w-6 h-6 rounded flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
          :class="headerTheme === 'white' ? 'text-slate-600' : 'text-slate-300'"
          title="关闭独立组态窗口"
        >
          <X class="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- 2. 窗口主体内容槽 (Window Body Slot)        -->
    <!-- ========================================== -->
    <div class="flex-1 min-h-0 min-w-0 overflow-hidden relative bg-[#fafafa]">
      <slot />
    </div>

    <!-- ========================================== -->
    <!-- 3. 拖拽调整大小手柄 (Resize Handles)        -->
    <!-- ========================================== -->
    <template v-if="!isMaximized">
      <!-- 右下角手柄 -->
      <div
        @mousedown="handleResizeMouseDown('se', $event)"
        class="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-se-resize z-50 flex items-center justify-center group"
      >
        <div class="w-2 h-2 border-r-2 border-b-2 border-slate-400 group-hover:border-sky-500 transition-colors" />
      </div>

      <!-- 右侧边缘手柄 -->
      <div
        @mousedown="handleResizeMouseDown('e', $event)"
        class="absolute top-8.5 bottom-3.5 right-0 w-1.5 cursor-e-resize z-40 hover:bg-sky-400/30 transition-colors"
      />

      <!-- 底部边缘手柄 -->
      <div
        @mousedown="handleResizeMouseDown('s', $event)"
        class="absolute bottom-0 left-0 right-3.5 h-1.5 cursor-s-resize z-40 hover:bg-sky-400/30 transition-colors"
      />
    </template>
  </div>
</template>
