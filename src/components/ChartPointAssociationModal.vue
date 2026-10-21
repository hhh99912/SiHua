<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  X, Check, Building2, Layers, Cpu,
  Search, Palette, Maximize2, Minimize2
} from 'lucide-vue-next';
import { ScadaChartPoint, ScadaFacilityNode, ScadaBayNode, ScadaDeviceNode } from '../types';
import {
  scadaFacilities,
  getScadaPointDisplayName,
  findScadaPointDef
} from '../utils/scadaClient';

interface Props {
  visible: boolean;
  mode?: 'add' | 'edit';
  targetIndex?: number | null;
  initialPoint?: ScadaChartPoint | null;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  mode: 'add',
  targetIndex: null,
  initialPoint: null
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: {
    point: ScadaChartPoint;
    targetIndex?: number | null;
  }): void;
}>();

// Draggable & Resizable state (对齐监控界面实时曲线弹框)
const modalPos = ref<{ x: number; y: number }>({ x: 0, y: 0 });
const modalSize = ref<{ width: number; height: number }>({ width: 1340, height: 760 });
const isMaximized = ref(false);
let preMaxState = { x: 0, y: 0, width: 1340, height: 760 };

const isDragging = ref(false);
let dragStart = { mouseX: 0, mouseY: 0, posX: 0, posY: 0 };

const isResizing = ref(false);
let resizeStart = { mouseX: 0, mouseY: 0, width: 0, height: 0 };
let currentResizeDir: 'e' | 's' | 'se' = 'se';

const initModalPosition = () => {
  const modalW = Math.min(1360, window.innerWidth - 32);
  const modalH = Math.min(800, window.innerHeight - 32);
  modalSize.value = { width: modalW, height: modalH };
  modalPos.value = {
    x: Math.max(16, Math.round((window.innerWidth - modalW) / 2)),
    y: Math.max(16, Math.round((window.innerHeight - modalH) / 2))
  };
  preMaxState = { ...modalPos.value, ...modalSize.value };
};

const toggleMaximize = () => {
  if (!isMaximized.value) {
    preMaxState = {
      x: modalPos.value.x,
      y: modalPos.value.y,
      width: modalSize.value.width,
      height: modalSize.value.height
    };
    isMaximized.value = true;
  } else {
    isMaximized.value = false;
    modalPos.value = { x: preMaxState.x, y: preMaxState.y };
    modalSize.value = { width: preMaxState.width, height: preMaxState.height };
  }
};

const onHeaderMouseDown = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('button, input, select, a')) return;

  if (isMaximized.value) {
    const restoreW = preMaxState.width;
    const restoreH = preMaxState.height;
    isMaximized.value = false;
    modalSize.value = { width: restoreW, height: restoreH };
    modalPos.value = {
      x: Math.max(8, Math.min(window.innerWidth - restoreW - 8, e.clientX - restoreW / 2)),
      y: Math.max(8, Math.min(window.innerHeight - restoreH - 8, e.clientY - 18))
    };
  }

  isDragging.value = true;
  dragStart = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    posX: modalPos.value.x,
    posY: modalPos.value.y
  };

  const onMouseMove = (ev: MouseEvent) => {
    if (!isDragging.value) return;
    const dx = ev.clientX - dragStart.mouseX;
    const dy = ev.clientY - dragStart.mouseY;
    const modalW = modalSize.value.width;
    const modalH = modalSize.value.height;

    const maxX = Math.max(0, window.innerWidth - modalW - 8);
    const maxY = Math.max(0, window.innerHeight - modalH - 8);

    modalPos.value = {
      x: Math.min(maxX, Math.max(8, dragStart.posX + dx)),
      y: Math.min(maxY, Math.max(8, dragStart.posY + dy))
    };
  };

  const onMouseUp = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const startResize = (dir: 'e' | 's' | 'se', e: MouseEvent) => {
  if (isMaximized.value) return;
  e.preventDefault();
  e.stopPropagation();

  isResizing.value = true;
  currentResizeDir = dir;
  resizeStart = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    width: modalSize.value.width,
    height: modalSize.value.height
  };

  const onMouseMove = (ev: MouseEvent) => {
    if (!isResizing.value) return;
    const dx = ev.clientX - resizeStart.mouseX;
    const dy = ev.clientY - resizeStart.mouseY;

    let newW = resizeStart.width;
    let newH = resizeStart.height;

    if (currentResizeDir === 'e' || currentResizeDir === 'se') {
      newW = Math.max(680, Math.min(window.innerWidth - modalPos.value.x - 8, resizeStart.width + dx));
    }
    if (currentResizeDir === 's' || currentResizeDir === 'se') {
      newH = Math.max(420, Math.min(window.innerHeight - modalPos.value.y - 8, resizeStart.height + dy));
    }

    modalSize.value = { width: newW, height: newH };
  };

  const onMouseUp = () => {
    isResizing.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

// 级联选中状态
const selectedFacId = ref<number | string>(scadaFacilities.value[0]?.fac_id || 4000003);
const selectedBayId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.bay_id || 430000001);
const selectedDevId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.devices?.[0]?.dev_id || 7000001);
const selectedCategory = ref<'yc' | 'dd'>('yc');

// 选中的测点对象
const selectedPoint = ref<any>(null);

// 测点自定义颜色
const customColor = ref<string>('#ffffff');
const paletteColors = [
  '#ffffff', '#00f2ff', '#10b981', '#f59e0b', '#ec4899',
  '#8b5cf6', '#3b82f6', '#06b6d4', '#eab308', '#f97316'
];

// 搜索关键字
const pointSearch = ref('');

// 当前选中的厂站
const currentFacility = computed<ScadaFacilityNode | undefined>(() => {
  return scadaFacilities.value.find(f => f.fac_id === selectedFacId.value || f.id === selectedFacId.value) || scadaFacilities.value[0];
});

// 当前选中的间隔
const currentBay = computed<ScadaBayNode | undefined>(() => {
  const fac = currentFacility.value;
  if (!fac || !fac.bays?.length) return undefined;
  return fac.bays.find(b => b.bay_id === selectedBayId.value || b.id === selectedBayId.value) || fac.bays[0];
});

// 当前选中的装置
const currentDevice = computed<ScadaDeviceNode | undefined>(() => {
  const bay = currentBay.value;
  if (!bay) return undefined;
  const devs = bay.devices || bay.cb_devices || [];
  return devs.find(d => d.dev_id === selectedDevId.value || d.id === selectedDevId.value) || devs[0];
});

// 当前装置的测点列表
const rawPointsList = computed(() => {
  const dev = currentDevice.value;
  if (!dev) return [];
  if (selectedCategory.value === 'yc') {
    return dev.yc_list || dev.yc_points || [];
  } else {
    return dev.dd_list || dev.dd_points || [];
  }
});

// 过滤后的测点列表 (支持根据工程中文名称、原名或别名快速搜索)
const filteredPointsList = computed(() => {
  const q = pointSearch.value.trim().toLowerCase();
  const list = rawPointsList.value;
  if (!q) return list;
  return list.filter((p: any) => {
    const dispName = getScadaPointDisplayName(p).toLowerCase();
    const rawName = String(p.name || '').toLowerCase();
    const alias = String(p.alias || '').toLowerCase();
    const unitMatch = String(p.unit || '').toLowerCase();
    return dispName.includes(q) || rawName.includes(q) || alias.includes(q) || unitMatch.includes(q);
  });
});

// 针对凝思操作系统与 Electron 低功耗/国产化CPU环境的高性能虚拟滚动配置
const ROW_HEIGHT = 48; // 固定行高 (px)
const tableScrollTop = ref(0);
const tableContainerHeight = ref(420);
const tableScrollRef = ref<HTMLElement | null>(null);

const onTableScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target) {
    tableScrollTop.value = target.scrollTop;
  }
};

const updateContainerHeight = () => {
  if (tableScrollRef.value) {
    tableContainerHeight.value = tableScrollRef.value.clientHeight || 420;
  }
};

// 测点列表长度与虚拟切片
const totalPointsCount = computed(() => filteredPointsList.value.length);
const BUFFER_ROWS = 6;
const startIndex = computed(() => {
  return Math.max(0, Math.floor(tableScrollTop.value / ROW_HEIGHT) - BUFFER_ROWS);
});
const visibleRowCount = computed(() => {
  return Math.ceil(tableContainerHeight.value / ROW_HEIGHT) + BUFFER_ROWS * 2;
});
const endIndex = computed(() => {
  return Math.min(totalPointsCount.value, startIndex.value + visibleRowCount.value);
});
const visiblePointsList = computed(() => {
  return filteredPointsList.value.slice(startIndex.value, endIndex.value);
});
const virtualTopSpacerHeight = computed(() => {
  return startIndex.value * ROW_HEIGHT;
});
const virtualBottomSpacerHeight = computed(() => {
  return Math.max(0, (totalPointsCount.value - endIndex.value) * ROW_HEIGHT);
});

// 搜索输入防抖 (针对测点较多时，避免 Electron 每次按键主线程卡顿)
const pointSearchInput = ref('');
let searchDebounceTimer: any = null;

watch(pointSearchInput, (newVal) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  const rawLen = rawPointsList.value.length;
  if (rawLen > 300) {
    searchDebounceTimer = setTimeout(() => {
      pointSearch.value = newVal;
      tableScrollTop.value = 0;
      if (tableScrollRef.value) tableScrollRef.value.scrollTop = 0;
    }, 120);
  } else {
    pointSearch.value = newVal;
    tableScrollTop.value = 0;
    if (tableScrollRef.value) tableScrollRef.value.scrollTop = 0;
  }
});

const scrollToSelectedRow = () => {
  if (!selectedPoint.value?.id) return;
  const idx = filteredPointsList.value.findIndex((p: any) => p.id === selectedPoint.value.id);
  if (idx !== -1) {
    const targetScroll = Math.max(0, idx * ROW_HEIGHT - tableContainerHeight.value / 2 + ROW_HEIGHT / 2);
    tableScrollTop.value = targetScroll;
    if (tableScrollRef.value) {
      tableScrollRef.value.scrollTop = targetScroll;
    }
  }
};

// 初始化回显或重置 (使用 findScadaPointDef 进行 O(1) 瞬时哈希定位，彻底杜绝遍历全站数组的性能消耗)
const initializeState = () => {
  pointSearchInput.value = '';
  pointSearch.value = '';
  tableScrollTop.value = 0;
  if (tableScrollRef.value) {
    tableScrollRef.value.scrollTop = 0;
  }

  if (props.mode === 'edit' && props.initialPoint) {
    const p = props.initialPoint;
    customColor.value = p.color || '#ffffff';

    const pDef = findScadaPointDef(p.id);
    if (pDef.category !== 'none' && pDef.facility && pDef.bay && pDef.device && pDef.point) {
      selectedFacId.value = pDef.facility.fac_id || pDef.facility.id;
      selectedBayId.value = pDef.bay.bay_id || pDef.bay.id;
      selectedDevId.value = pDef.device.dev_id || pDef.device.id;
      selectedCategory.value = pDef.category === 'dd' ? 'dd' : 'yc';
      selectedPoint.value = {
        id: pDef.point.id,
        name: getScadaPointDisplayName(pDef.point),
        rawName: pDef.point.name,
        alias: pDef.point.alias,
        unit: pDef.point.unit || p.unit || ''
      };
    } else {
      selectedCategory.value = (p.category === 'dd' ? 'dd' : 'yc');
      selectedPoint.value = {
        id: p.id,
        name: p.name,
        unit: p.unit
      };
    }
  } else {
    selectedCategory.value = 'yc';
    customColor.value = paletteColors[Math.floor(Math.random() * paletteColors.length)];
    selectedPoint.value = null;
  }
};

watch(() => props.visible, (val) => {
  if (val) {
    initModalPosition();
    initializeState();
    nextTick(() => {
      updateContainerHeight();
      scrollToSelectedRow();
    });
  }
}, { immediate: true });

// 切换厂站/间隔/装置/分类时重置滚动位置
watch([selectedFacId, selectedBayId, selectedDevId, selectedCategory], () => {
  tableScrollTop.value = 0;
  if (tableScrollRef.value) {
    tableScrollRef.value.scrollTop = 0;
  }
});

// 切换厂站时重置间隔与装置
const handleFacChange = (facId: number | string) => {
  selectedFacId.value = facId;
  const fac = scadaFacilities.value.find(f => f.fac_id === facId || f.id === facId);
  if (fac && fac.bays?.length) {
    selectedBayId.value = fac.bays[0].bay_id || fac.bays[0].id;
    const devs = fac.bays[0].devices || fac.bays[0].cb_devices || [];
    if (devs.length) {
      selectedDevId.value = devs[0].dev_id || devs[0].id;
    }
  }
  selectedPoint.value = null;
};

// 切换间隔时重置装置
const handleBayChange = (bayId: number | string) => {
  selectedBayId.value = bayId;
  const bay = currentFacility.value?.bays?.find(b => b.bay_id === bayId || b.id === bayId);
  if (bay) {
    const devs = bay.devices || bay.cb_devices || [];
    if (devs.length) {
      selectedDevId.value = devs[0].dev_id || devs[0].id;
    }
  }
  selectedPoint.value = null;
};

// 点击选中测点
const handleSelectPoint = (pt: any) => {
  selectedPoint.value = {
    id: pt.id,
    name: getScadaPointDisplayName(pt),
    rawName: pt.name,
    alias: pt.alias,
    unit: pt.unit || ''
  };
};

// 提交关联
const handleSubmit = () => {
  if (!selectedPoint.value) return;

  const facName = currentFacility.value?.fac_name || currentFacility.value?.name || '示范站';
  const bayName = currentBay.value?.bay_name || currentBay.value?.name || '间隔';
  const devName = currentDevice.value?.dev_name || currentDevice.value?.name || '测控装置';

  const finalPoint: ScadaChartPoint = {
    id: Number(selectedPoint.value.id),
    name: selectedPoint.value.name,
    category: selectedCategory.value,
    color: customColor.value || '#ffffff',
    unit: selectedPoint.value.unit || '',
    facName,
    bayName,
    devName
  };

  emit('submit', {
    point: finalPoint,
    targetIndex: props.targetIndex
  });
};
</script>

<template>
  <!-- Teleport 到 body，彻底解决柱状图关联测点被属性面板 contain / relative 限制卡死、显示不全的问题 -->
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[9999] pointer-events-none select-none"
    >
      <!-- 弹窗容器：纯黑底色、硬质灰色边框、加宽排版、全白高对比字体、支持拖拽拉伸 -->
      <div
        ref="modalRef"
        class="pointer-events-auto absolute bg-black text-white rounded-lg border border-neutral-700 shadow-2xl flex flex-col overflow-hidden"
        :style="isMaximized ? {
          left: '8px',
          top: '8px',
          width: 'calc(100vw - 16px)',
          height: 'calc(100vh - 16px)'
        } : {
          left: `${modalPos.x}px`,
          top: `${modalPos.y}px`,
          width: `${modalSize.width}px`,
          height: `${modalSize.height}px`
        }"
      >
        <!-- 顶栏：标明标题，可按住拖拽，双击最大化/还原，关闭按钮 -->
        <header
          @mousedown="onHeaderMouseDown"
          @dblclick="toggleMaximize"
          class="h-11 px-3.5 bg-[#111111] border-b border-[#2a2a2a] flex items-center justify-between shrink-0 cursor-move select-none"
          title="按住鼠标左键可拖动，双击可最大化/还原"
        >
          <div class="flex items-center gap-2.5 min-w-0 pr-3">
            <div class="w-2.5 h-2.5 rounded-full bg-white shrink-0"></div>
            <span class="text-sm sm:text-base font-bold text-white tracking-normal truncate drop-shadow-xs">
              {{ mode === 'edit' ? '修改统计图表测点数据关联' : '添加统计图表测点数据关联' }}
            </span>
            <span class="text-xs text-white font-mono hidden sm:inline opacity-90">
              [{{ mode === 'edit' ? '修改序号 #' + ((targetIndex ?? 0) + 1) : '新增测点数据系列' }}]
            </span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <!-- 最大化 / 还原按钮 -->
            <button
              @click="toggleMaximize"
              class="w-7 h-7 rounded flex items-center justify-center text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-600 transition-colors cursor-pointer"
              :title="isMaximized ? '还原窗口' : '最大化窗口'"
            >
              <component :is="isMaximized ? Minimize2 : Maximize2" class="w-3.5 h-3.5" />
            </button>

            <!-- 关闭按钮 -->
            <button
              @click="emit('close')"
              class="w-7 h-7 rounded flex items-center justify-center text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-600 transition-colors cursor-pointer"
              title="关闭窗口"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </header>

        <!-- 主体：4 级级联排版 (厂站 -> 间隔 -> 装置 -> 测点列表与颜色) 统一纯白字体 -->
        <div class="flex-1 flex overflow-hidden bg-[#0c0d10]">
          <!-- 1. 厂站选择 -->
          <div class="w-56 border-r border-[#222222] bg-[#0c0d10] flex flex-col shrink-0">
            <div class="p-3 border-b border-[#222222] bg-[#141414] flex items-center justify-between">
              <span class="text-xs font-bold text-white">1. 厂站选择</span>
              <span class="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 text-white text-[11px] rounded font-mono font-bold">
                {{ scadaFacilities.length }}
              </span>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
              <div
                v-for="fac in scadaFacilities"
                :key="fac.fac_id || fac.id"
                class="p-2.5 rounded border transition-colors text-left cursor-pointer"
                :class="selectedFacId === (fac.fac_id || fac.id) ? 'bg-neutral-800 border-neutral-400 text-white font-bold' : 'bg-[#141414] border-[#242424] text-white hover:bg-[#1a1a1a]'"
                @click="handleFacChange(fac.fac_id || fac.id)"
              >
                <div class="truncate text-sm font-bold text-white">{{ fac.fac_name || fac.name }}</div>
                <div class="text-xs text-white mt-1 truncate opacity-90">{{ fac.alias || '变电站' }}</div>
              </div>
            </div>
          </div>

          <!-- 2. 间隔选择 -->
          <div class="w-60 border-r border-[#222222] bg-[#0c0d10] flex flex-col shrink-0">
            <div class="p-3 border-b border-[#222222] bg-[#141414] flex items-center justify-between">
              <span class="text-xs font-bold text-white">2. 间隔选择</span>
              <span class="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 text-white text-[11px] rounded font-mono font-bold">
                {{ currentFacility?.bays?.length || 0 }}
              </span>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
              <div
                v-for="bay in (currentFacility?.bays || [])"
                :key="bay.bay_id || bay.id"
                class="p-2.5 rounded border transition-colors text-left cursor-pointer"
                :class="selectedBayId === (bay.bay_id || bay.id) ? 'bg-neutral-800 border-neutral-400 text-white font-bold' : 'bg-[#141414] border-[#242424] text-white hover:bg-[#1a1a1a]'"
                @click="handleBayChange(bay.bay_id || bay.id)"
              >
                <div class="truncate text-sm font-bold text-white">{{ bay.bay_name || bay.name }}</div>
                <div class="text-xs text-white mt-1 truncate opacity-90">{{ bay.alias || '配电间隔' }}</div>
              </div>
            </div>
          </div>

          <!-- 3. 装置选择 -->
          <div class="w-64 border-r border-[#222222] bg-[#0c0d10] flex flex-col shrink-0">
            <div class="p-3 border-b border-[#222222] bg-[#141414] flex items-center justify-between">
              <span class="text-xs font-bold text-white">3. 装置选择</span>
              <span class="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 text-white text-[11px] rounded font-mono font-bold">
                {{ currentBay?.devices?.length || currentBay?.cb_devices?.length || 0 }}
              </span>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
              <div
                v-for="dev in (currentBay?.devices || currentBay?.cb_devices || [])"
                :key="dev.dev_id || dev.id"
                class="p-2.5 rounded border transition-colors text-left cursor-pointer"
                :class="selectedDevId === (dev.dev_id || dev.id) ? 'bg-neutral-800 border-neutral-400 text-white font-bold' : 'bg-[#141414] border-[#242424] text-white hover:bg-[#1a1a1a]'"
                @click="selectedDevId = (dev.dev_id || dev.id); selectedPoint = null"
              >
                <div class="truncate text-sm font-bold text-white">{{ dev.dev_name || dev.name }}</div>
                <div class="flex items-center justify-between text-xs text-white mt-1 opacity-90">
                  <span>{{ dev.cbty_name || '保护测控装置' }}</span>
                  <span class="text-[11px] font-mono text-white">{{ dev.alias || '' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. 测点分类、表格与颜色配置区 (大号字体，测点名称突出展示，测点ID完全隐藏，不显示实时值，统一纯白字体) -->
          <div class="flex-1 flex flex-col bg-black overflow-hidden min-w-0">
            <!-- 顶部分类标签与快速搜索 -->
            <div class="p-3 border-b border-[#222222] bg-[#111111] shrink-0 flex items-center justify-between gap-3">
              <!-- 删除(YC)(DD)提示，统一纯白字体 -->
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="selectedCategory = 'yc'; selectedPoint = null"
                  class="px-4 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer border flex items-center gap-1.5"
                  :class="selectedCategory === 'yc' ? 'bg-neutral-800 text-white border-neutral-400 shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                >
                  <span>遥测</span>
                  <span class="px-1.5 py-0.2 bg-black/60 rounded font-mono text-[11px] text-white font-bold">
                    {{ (currentDevice?.yc_list || currentDevice?.yc_points || []).length }}
                  </span>
                </button>

                <button
                  type="button"
                  @click="selectedCategory = 'dd'; selectedPoint = null"
                  class="px-4 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer border flex items-center gap-1.5"
                  :class="selectedCategory === 'dd' ? 'bg-neutral-800 text-white border-neutral-400 shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                >
                  <span>电度</span>
                  <span class="px-1.5 py-0.2 bg-black/60 rounded font-mono text-[11px] text-white font-bold">
                    {{ (currentDevice?.dd_list || currentDevice?.dd_points || []).length }}
                  </span>
                </button>
              </div>

              <!-- 测点快速搜索框：按要求变窄 (w-40) -->
              <div class="relative w-40 shrink-0">
                <Search class="w-3.5 h-3.5 text-white absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  v-model="pointSearchInput"
                  type="text"
                  placeholder="搜索测点..."
                  class="w-full bg-[#181818] border border-neutral-700 rounded pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-neutral-400 font-medium focus:outline-none focus:border-white"
                />
              </div>
            </div>

            <!-- 测点列表表格 (不显示实时瞬时值，统一纯白字体，测点名称醒目居首，高性能虚拟滚动) -->
            <div
              ref="tableScrollRef"
              class="flex-1 overflow-y-auto p-2.5 relative"
              style="scrollbar-gutter: stable;"
              @scroll.passive="onTableScroll"
            >
              <table class="w-full text-left text-sm border-collapse" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: 44%;" />
                  <col style="width: 30%;" />
                  <col style="width: 76px;" />
                  <col style="width: 110px;" />
                </colgroup>
                <thead>
                  <tr class="border-b border-[#2a2a2a] bg-[#141414] text-white sticky top-0 z-10 h-11">
                    <th class="py-3 px-3 font-bold text-sm text-white">测点名称</th>
                    <th class="py-3 px-3 font-bold text-xs text-white">工程别名 / 物理标识</th>
                    <th class="py-3 px-3 font-bold text-xs text-white text-center">工程单位</th>
                    <th class="py-3 px-3 font-bold text-xs text-white text-right">选择状态</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#1e1e1e]">
                  <!-- 虚拟滚动顶部占位行 -->
                  <tr v-if="virtualTopSpacerHeight > 0" :style="{ height: `${virtualTopSpacerHeight}px` }" aria-hidden="true">
                    <td colspan="4" class="p-0 border-0 m-0"></td>
                  </tr>

                  <tr
                    v-for="pt in visiblePointsList"
                    :key="pt.id"
                    class="cursor-pointer h-12 select-none"
                    :class="selectedPoint?.id === pt.id ? 'bg-neutral-800 text-white' : 'hover:bg-[#161616] text-white'"
                    @click="handleSelectPoint(pt)"
                  >
                    <!-- 测点名称：醒目大号亮白文字 -->
                    <td class="py-2.5 px-3 font-sans text-sm font-bold text-white truncate" :title="getScadaPointDisplayName(pt)">
                      <div class="flex items-center gap-2 truncate">
                        <span class="w-2 h-2 rounded-full shrink-0" :class="selectedPoint?.id === pt.id ? 'bg-white' : 'bg-neutral-600'"></span>
                        <span class="truncate">{{ getScadaPointDisplayName(pt) }}</span>
                      </div>
                    </td>

                    <!-- 工程别名 -->
                    <td class="py-2.5 px-3 font-mono text-xs text-white font-medium truncate" :title="pt.alias || pt.type_name || ''">
                      {{ pt.alias || pt.type_name || '-' }}
                    </td>

                    <!-- 工程单位 -->
                    <td class="py-2.5 px-3 font-mono text-xs text-white text-center truncate">
                      {{ pt.unit || '-' }}
                    </td>

                    <!-- 选中状态 (固定尺寸 w-20 居中，固定1px边框无晃动) -->
                    <td class="py-2.5 px-3 text-right">
                      <div
                        class="inline-flex items-center justify-center w-20 h-7 rounded text-xs font-semibold shrink-0 select-none border"
                        :class="selectedPoint?.id === pt.id ? 'bg-white text-black border-white shadow-sm' : 'bg-neutral-800 text-white border-neutral-700 hover:border-neutral-500'"
                      >
                        <Check v-if="selectedPoint?.id === pt.id" class="w-3.5 h-3.5 mr-1 stroke-[3] shrink-0" />
                        <span>{{ selectedPoint?.id === pt.id ? '已选中' : '选择' }}</span>
                      </div>
                    </td>
                  </tr>

                  <!-- 虚拟滚动底部占位行 -->
                  <tr v-if="virtualBottomSpacerHeight > 0" :style="{ height: `${virtualBottomSpacerHeight}px` }" aria-hidden="true">
                    <td colspan="4" class="p-0 border-0 m-0"></td>
                  </tr>

                  <tr v-if="totalPointsCount === 0">
                    <td colspan="4" class="p-12 text-center text-white font-sans text-sm font-medium">
                      当前装置暂无该类型测点或未搜索到匹配项
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 柱体/折线图元颜色配置区 (大号排版，简洁直观，纯白文字) -->
            <div class="h-13 px-4 bg-[#111111] border-t border-[#2a2a2a] shrink-0 flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <label class="text-xs sm:text-sm text-white font-bold flex items-center gap-1.5">
                  <Palette class="w-4 h-4 text-white" />
                  <span>图表柱体/折线显示颜色:</span>
                </label>

                <div class="flex items-center gap-2">
                  <input
                    type="color"
                    v-model="customColor"
                    class="w-7 h-7 rounded border border-neutral-600 p-0 bg-transparent cursor-pointer shrink-0"
                  />
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <button
                      v-for="c in paletteColors"
                      :key="c"
                      type="button"
                      @click="customColor = c"
                      class="w-5 h-5 rounded-full border transition-transform cursor-pointer"
                      :class="customColor === c ? 'scale-115 border-white ring-2 ring-white/60' : 'border-neutral-700 hover:scale-105'"
                      :style="{ backgroundColor: c }"
                    />
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 text-xs text-white font-mono">
                <span>当前色值:</span>
                <span class="text-white font-bold">{{ customColor }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作栏 (纯白文字，无(YC)(DD)前缀) -->
        <footer class="h-13 px-5 border-t border-[#2a2a2a] bg-[#111111] flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2 text-sm min-w-0 pr-4">
            <span class="text-white font-bold shrink-0">当前选择:</span>
            <span v-if="selectedPoint" class="text-white font-bold truncate">
              {{ currentFacility?.fac_name || currentFacility?.name }} ➜ {{ currentBay?.bay_name || currentBay?.name }} ➜ {{ currentDevice?.dev_name || currentDevice?.name }} ➜ <strong class="text-white font-bold underline underline-offset-2">{{ selectedPoint.name }}</strong>
              <span v-if="selectedPoint.unit" class="text-white ml-1 font-mono">({{ selectedPoint.unit }})</span>
            </span>
            <span v-else class="text-white font-medium opacity-80">
              未选择任何测点
            </span>
          </div>

          <div class="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              class="px-5 py-1.5 rounded text-xs sm:text-sm font-semibold border border-neutral-600 bg-neutral-900 hover:bg-neutral-800 text-white transition-colors cursor-pointer"
              @click="emit('close')"
            >
              取消
            </button>
            <button
              type="button"
              class="px-6 py-1.5 rounded text-xs sm:text-sm font-bold bg-white hover:bg-neutral-200 text-black transition-colors cursor-pointer flex items-center gap-1.5"
              :class="!selectedPoint ? 'opacity-50 cursor-not-allowed' : ''"
              :disabled="!selectedPoint"
              @click="handleSubmit"
            >
              <Check class="w-4 h-4 stroke-[2.5]" />
              <span>确认关联生效</span>
            </button>
          </div>
        </footer>

        <!-- 窗体拉伸控制边缘 (未最大化时有效) -->
        <template v-if="!isMaximized">
          <div
            @mousedown="startResize('e', $event)"
            class="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-white/10 transition-colors"
            title="左右拖动调整宽度"
          ></div>
          <div
            @mousedown="startResize('s', $event)"
            class="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-white/10 transition-colors"
            title="上下拖动调整高度"
          ></div>
          <div
            @mousedown="startResize('se', $event)"
            class="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 text-white/50 hover:text-white hover:bg-white/15 rounded-br transition-colors"
            title="拖动右下角调整大小"
          >
            <svg class="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor">
              <path d="M8 8H9V9H8V8ZM5 8H6V9H5V8ZM8 5H9V6H8V5ZM2 8H3V9H2V8ZM5 5H6V6H5V5ZM8 2H9V3H8V2Z" />
            </svg>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
