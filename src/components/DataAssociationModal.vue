<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  X, Check, Unlink, Maximize2, Minimize2, Search,
  Building2, Layers, Cpu, ShieldCheck
} from 'lucide-vue-next';
import {
  CanvasComponent,
  ScadaFacilityNode,
  ScadaBayNode,
  ScadaDeviceNode
} from '../types';
import {
  scadaFacilities,
  findScadaPointDef,
  getFastLiveYc,
  getFastLiveYx,
  getFastLiveDd,
  getScadaPointDisplayName
} from '../utils/scadaClient';

interface Props {
  visible: boolean;
  component: CanvasComponent | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: {
    componentId: string;
    unbind: boolean;
    deviceId?: string;
    deviceName?: string;
    category?: 'yc' | 'yx' | 'dd' | 'yk' | 'yt';
    point?: any;
    targetVerificationPointId?: number | string;
    targetVerificationType?: 'yx' | 'yc';
    verificationTimeout?: number;
  }): void;
}>();

// Draggable & Resizable state (对齐监控界面实时曲线弹框)
const modalPos = ref<{ x: number; y: number }>({ x: 0, y: 0 });
const modalSize = ref<{ width: number; height: number }>({ width: 1360, height: 780 });
const isMaximized = ref(false);
let preMaxState = { x: 0, y: 0, width: 1360, height: 780 };

const isDragging = ref(false);
let dragStart = { mouseX: 0, mouseY: 0, posX: 0, posY: 0 };

const isResizing = ref(false);
let resizeStart = { mouseX: 0, mouseY: 0, width: 0, height: 0 };
let currentResizeDir: 'e' | 's' | 'se' = 'se';

const initModalPosition = () => {
  const modalW = Math.min(1380, window.innerWidth - 32);
  const modalH = Math.min(820, window.innerHeight - 32);
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

// Cascading State
const selectedFacId = ref<number | string>(scadaFacilities.value[0]?.fac_id || 4000003);
const selectedBayId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.bay_id || 430000001);
const selectedDevId = ref<number | string>(scadaFacilities.value[0]?.bays?.[0]?.devices?.[0]?.dev_id || 7000001);
const selectedCategory = ref<'yc' | 'yx' | 'dd' | 'yk' | 'yt'>('yc');
const selectedPointId = ref<number | string | null>(null);
const selectedPoint = ref<any>(null);
const isUnboundPending = ref<boolean>(false);
const pointSearch = ref('');

// Return Verification Point State (闭环返校校验点)
const selectedVerificationPointId = ref<number | string | null>(null);

// Current Facility
const currentFacility = computed<ScadaFacilityNode | undefined>(() => {
  return scadaFacilities.value.find(f => f.fac_id === selectedFacId.value || f.id === selectedFacId.value) || scadaFacilities.value[0];
});

// Current Bay
const currentBay = computed<ScadaBayNode | undefined>(() => {
  const fac = currentFacility.value;
  if (!fac || !fac.bays?.length) return undefined;
  return fac.bays.find(b => b.bay_id === selectedBayId.value || b.id === selectedBayId.value) || fac.bays[0];
});

// Current Device
const currentDevice = computed<ScadaDeviceNode | undefined>(() => {
  const bay = currentBay.value;
  if (!bay) return undefined;
  const devs = bay.devices || bay.cb_devices || [];
  return devs.find(d => d.dev_id === selectedDevId.value || d.id === selectedDevId.value) || devs[0];
});

// Category counts for the active device
const categoryStats = computed(() => {
  const dev = currentDevice.value;
  if (!dev) return { yc: 0, yx: 0, dd: 0, yk: 0, yt: 0 };
  return {
    yc: (dev.yc_list || dev.yc_points || []).length,
    yx: (dev.yx_list || dev.yx_points || []).length,
    yk: (dev.yk_list || dev.yk_points || []).length,
    yt: (dev.yt_list || dev.yt_points || []).length,
    dd: (dev.dd_list || dev.dd_points || []).length
  };
});

// Points list for current device and category
const rawPointsList = computed(() => {
  const dev = currentDevice.value;
  if (!dev) return [];
  if (selectedCategory.value === 'yc') {
    return dev.yc_list || dev.yc_points || [];
  } else if (selectedCategory.value === 'yx') {
    return dev.yx_list || dev.yx_points || [];
  } else if (selectedCategory.value === 'yk') {
    return dev.yk_list || dev.yk_points || [];
  } else if (selectedCategory.value === 'yt') {
    return dev.yt_list || dev.yt_points || [];
  } else if (selectedCategory.value === 'dd') {
    return dev.dd_list || dev.dd_points || [];
  }
  return [];
});

// 过滤后的测点列表 (支持根据工程中文名称、原名或别名快速搜索)
const pointsList = computed(() => {
  const q = pointSearch.value.trim().toLowerCase();
  const list = rawPointsList.value;
  if (!q) return list;
  return list.filter((p: any) => {
    const dispName = getScadaPointDisplayName(p).toLowerCase();
    const rawName = String(p.name || '').toLowerCase();
    const alias = String(p.alias || '').toLowerCase();
    const typeName = String(p.type_name || '').toLowerCase();
    return dispName.includes(q) || rawName.includes(q) || alias.includes(q) || typeName.includes(q);
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
const totalPointsCount = computed(() => pointsList.value.length);
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
  return pointsList.value.slice(startIndex.value, endIndex.value);
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

// 同间隔下所有装置的所有符合条件的返校测点
// 规则：
// 1. 遥控 (yk)：只有物理标识 (alias) 结尾是 POS_OPN 的才能作为返校，比如 (F01.V10.S01.DL02.POS_OPN)
// 2. 遥调 (yt)：只有 if_yt 为 1 的遥测才能作为遥调返校
const sameBayVerificationCandidates = computed(() => {
  const bay = currentBay.value;
  if (!bay) return [];
  const devs = bay.devices || bay.cb_devices || [];
  const result: Array<{
    index: number;
    deviceId: number | string;
    deviceName: string;
    id: number;
    name: string;
    displayName: string;
    alias?: string;
  }> = [];

  const isYk = selectedCategory.value === 'yk';
  const isYt = selectedCategory.value === 'yt';

  let idx = 1;
  devs.forEach((d: any) => {
    const dName = d.dev_name || d.name || `设备_${d.dev_id || d.id}`;
    let pts = isYk
      ? (d.yx_list || d.yx_points || [])
      : (d.yc_list || d.yc_points || []);

    if (isYk) {
      pts = pts.filter((p: any) => {
        const aliasStr = String(p.alias || '').trim().toUpperCase();
        return aliasStr.endsWith('POS_OPN');
      });
    } else if (isYt) {
      pts = pts.filter((p: any) => {
        return Number(p.if_yt) === 1;
      });
    }

    pts.forEach((p: any) => {
      result.push({
        index: idx++,
        deviceId: d.dev_id || d.id,
        deviceName: dName,
        id: p.id,
        name: p.name,
        displayName: getScadaPointDisplayName(p),
        alias: p.alias || p.type_name
      });
    });
  });

  return result;
});

// Initialize and restore previous association when modal opens
const initializeCascadingSelection = () => {
  if (!props.component) return;

  const comp = props.component;
  const data = comp.data || {};
  const mapping = data.mapping || {};
  const action = data.action;

  let targetPointId: number | null = null;
  let targetCategory: 'yc' | 'yx' | 'dd' | 'yk' | 'yt' = 'yc';
  let targetVPointId: number | string | null = mapping.targetVerificationPointId || null;

  if (mapping.yk_id || mapping.ykPointId || (mapping.pointCategory === 'teleControl' && mapping.pointId)) {
    targetPointId = Number(mapping.yk_id || mapping.ykPointId || mapping.pointId);
    targetCategory = 'yk';
  } else if (mapping.yt_id || mapping.ytPointId || (mapping.pointCategory === 'teleRegulation' && mapping.pointId)) {
    targetPointId = Number(mapping.yt_id || mapping.ytPointId || mapping.pointId);
    targetCategory = 'yt';
  } else if (action?.type === 'tele-control' && (action.yk_id || action.pointId)) {
    targetPointId = Number(action.yk_id || action.pointId);
    targetCategory = 'yk';
    targetVPointId = action.targetVerificationPointId || action.targetPointId || targetVPointId;
  } else if (action?.type === 'tele-regulation' && (action.yt_id || action.pointId)) {
    targetPointId = Number(action.yt_id || action.pointId);
    targetCategory = 'yt';
    targetVPointId = action.targetVerificationPointId || action.targetPointId || targetVPointId;
  } else if (mapping.pointId) {
    targetPointId = Number(mapping.pointId);
    if (mapping.pointCategory === 'teleSignal' || mapping.pointCategory === 'yx' || ['elec-breaker', 'elec-disconnector', 'elec-grounding', 'elec-handcart', 'ctrl-indicator'].includes(comp.type)) {
      targetCategory = 'yx';
    } else if (mapping.pointCategory === 'energy' || mapping.pointCategory === 'dd') {
      targetCategory = 'dd';
    } else {
      targetCategory = 'yc';
    }
  }

  if (targetPointId) {
    const pDef = findScadaPointDef(targetPointId);
    if (pDef.category !== 'none') {
      if (pDef.facility) selectedFacId.value = pDef.facility.fac_id || pDef.facility.id || selectedFacId.value;
      if (pDef.bay) selectedBayId.value = pDef.bay.bay_id || pDef.bay.id || selectedBayId.value;
      if (pDef.device) selectedDevId.value = pDef.device.dev_id || pDef.device.id || selectedDevId.value;
      selectedCategory.value = (pDef.category as any) || targetCategory;
      selectedPointId.value = targetPointId;

      const pName = getScadaPointDisplayName(pDef.point) || pDef.point?.name || `测点`;
      selectedPoint.value = {
        pointId: targetPointId,
        name: pName,
        rawName: pDef.point?.name,
        alias: pDef.point?.alias,
        type: pDef.point?.type,
        type_name: pDef.point?.type_name,
        unit: pDef.point?.unit || ''
      };
      selectedVerificationPointId.value = targetVPointId || pDef.point?.targetVerificationPointId || null;
      isUnboundPending.value = false;

      nextTick(() => {
        scrollToSelectedRow();
      });
      return;
    }
  }

  // Fallback defaults
  const firstFac = scadaFacilities.value[0];
  if (firstFac) {
    selectedFacId.value = firstFac.fac_id || firstFac.id || selectedFacId.value;
    if (firstFac.bays?.[0]) {
      selectedBayId.value = firstFac.bays[0].bay_id || firstFac.bays[0].id || selectedBayId.value;
      const devs = firstFac.bays[0].devices || firstFac.bays[0].cb_devices || [];
      if (devs[0]) {
        selectedDevId.value = devs[0].dev_id || devs[0].id || selectedDevId.value;
      }
    }
  }

  if (['elec-breaker', 'elec-disconnector', 'elec-grounding', 'elec-handcart', 'ctrl-indicator'].includes(comp.type)) {
    selectedCategory.value = 'yx';
  } else {
    selectedCategory.value = 'yc';
  }

  selectedPointId.value = null;
  selectedPoint.value = null;
  selectedVerificationPointId.value = null;
  isUnboundPending.value = false;
  pointSearchInput.value = '';
  pointSearch.value = '';
  tableScrollTop.value = 0;
  if (tableScrollRef.value) {
    tableScrollRef.value.scrollTop = 0;
  }
};

const scrollToSelectedRow = () => {
  if (!selectedPointId.value) return;
  const idx = pointsList.value.findIndex((p: any) => p.id === selectedPointId.value);
  if (idx !== -1) {
    const targetScroll = Math.max(0, idx * ROW_HEIGHT - tableContainerHeight.value / 2 + ROW_HEIGHT / 2);
    tableScrollTop.value = targetScroll;
    if (tableScrollRef.value) {
      tableScrollRef.value.scrollTop = targetScroll;
    }
  }
};

watch(
  () => props.visible,
  (val) => {
    if (val) {
      initModalPosition();
      initializeCascadingSelection();
      nextTick(() => {
        updateContainerHeight();
        scrollToSelectedRow();
      });
    }
  },
  { immediate: true }
);

// 切换厂站/间隔/装置/分类时重置滚动位置
watch([selectedFacId, selectedBayId, selectedDevId, selectedCategory], () => {
  tableScrollTop.value = 0;
  if (tableScrollRef.value) {
    tableScrollRef.value.scrollTop = 0;
  }
});

// 切换分类或间隔时，自动校验当前返校点是否在候选列表中
watch([selectedCategory, sameBayVerificationCandidates], () => {
  if (selectedCategory.value === 'yk' || selectedCategory.value === 'yt') {
    const list = sameBayVerificationCandidates.value;
    const cur = selectedVerificationPointId.value;
    if (!cur || !list.some(c => c.id === cur)) {
      selectedVerificationPointId.value = list.length > 0 ? list[0].id : null;
    }
  } else {
    selectedVerificationPointId.value = null;
  }
});

// 选择测点行：使用中文标准工程名称赋给 selectedPoint.name
const handleSelectPointRow = (pt: any) => {
  selectedPointId.value = pt.id;
  const displayName = getScadaPointDisplayName(pt);
  selectedPoint.value = {
    pointId: pt.id,
    name: displayName,
    rawName: pt.name,
    alias: pt.alias,
    type: pt.type,
    type_name: pt.type_name,
    unit: pt.unit || ''
  };
  isUnboundPending.value = false;

  // 默认尝试关联符合条件的返校点
  if (!selectedVerificationPointId.value || !sameBayVerificationCandidates.value.some(c => c.id === selectedVerificationPointId.value)) {
    if (pt.targetVerificationPointId && sameBayVerificationCandidates.value.some(c => c.id === pt.targetVerificationPointId)) {
      selectedVerificationPointId.value = pt.targetVerificationPointId;
    } else if (sameBayVerificationCandidates.value.length > 0) {
      selectedVerificationPointId.value = sameBayVerificationCandidates.value[0].id;
    } else {
      selectedVerificationPointId.value = null;
    }
  }
};

const handleUnbind = () => {
  isUnboundPending.value = true;
  selectedPointId.value = null;
  selectedPoint.value = null;
  selectedVerificationPointId.value = null;
};

const handleSubmit = () => {
  if (!props.component) return;

  if (isUnboundPending.value) {
    emit('submit', {
      componentId: props.component.id,
      unbind: true
    });
    emit('close');
    return;
  }

  if (!selectedPoint.value) {
    emit('close');
    return;
  }

  const vType = selectedCategory.value === 'yk' ? 'yx' : (selectedCategory.value === 'yt' ? 'yc' : undefined);

  emit('submit', {
    componentId: props.component.id,
    unbind: false,
    deviceId: String(selectedDevId.value),
    deviceName: currentDevice.value?.dev_name || currentDevice.value?.name,
    category: selectedCategory.value,
    point: selectedPoint.value,
    targetVerificationPointId: selectedVerificationPointId.value || undefined,
    targetVerificationType: vType,
    verificationTimeout: 30
  });
  emit('close');
};
</script>

<template>
  <!-- Teleport 到 body，彻底避免被任意外部父容器 contain/relative/overflow 限制 -->
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[9999] pointer-events-none select-none"
    >
      <!-- 弹窗容器：纯黑底色、硬质深灰边框、全白高对比字体、支持拖动与拉伸 -->
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
        <!-- 顶栏：标明标题，可按住拖拽，双击最大化/还原，关闭与解绑按钮 -->
        <header
          @mousedown="onHeaderMouseDown"
          @dblclick="toggleMaximize"
          class="h-11 px-3.5 bg-[#111111] border-b border-[#2a2a2a] flex items-center justify-between shrink-0 cursor-move select-none"
          title="按住鼠标左键可拖动，双击可最大化/还原"
        >
          <div class="flex items-center gap-2.5 min-w-0 pr-3">
            <div class="w-2.5 h-2.5 rounded-full bg-white shrink-0"></div>
            <span class="text-sm sm:text-base font-bold text-white tracking-normal truncate drop-shadow-xs">
              五遥测点数据关联配置中心
            </span>
            <span v-if="component" class="text-xs text-white font-mono hidden sm:inline opacity-90">
              [当前图元: {{ component.name || component.type }}]
            </span>
          </div>

          <!-- 顶栏控制区 -->
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              class="px-2.5 py-1 rounded text-xs font-semibold border border-neutral-600 bg-neutral-900 hover:bg-neutral-800 text-rose-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              @click="handleUnbind"
              title="解除当前图元的所有测点绑定"
            >
              <Unlink class="w-3.5 h-3.5" />
              <span>解除绑定</span>
            </button>

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

        <!-- 主体区域：左侧三级级联选择，右侧测点展示 (统一纯白字体，无灰色文字) -->
        <div class="flex-1 flex overflow-hidden min-h-0 bg-black">
          <!-- 1. 厂站选择 -->
          <div class="w-60 border-r border-[#222222] bg-[#0c0d10] flex flex-col shrink-0">
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
                @click="selectedFacId = (fac.fac_id || fac.id); selectedBayId = (fac.bays?.[0]?.bay_id || fac.bays?.[0]?.id || 0)"
              >
                <div class="truncate text-sm font-bold text-white">{{ fac.fac_name || fac.name }}</div>
                <div class="text-xs text-white mt-1 truncate opacity-90">{{ fac.alias || '变电站' }}</div>
              </div>
            </div>
          </div>

          <!-- 2. 间隔选择 -->
          <div class="w-64 border-r border-[#222222] bg-[#0c0d10] flex flex-col shrink-0">
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
                @click="selectedBayId = (bay.bay_id || bay.id); selectedDevId = (bay.devices?.[0]?.dev_id || bay.devices?.[0]?.id || 0)"
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
                @click="selectedDevId = (dev.dev_id || dev.id)"
              >
                <div class="truncate text-sm font-bold text-white">{{ dev.dev_name || dev.name }}</div>
                <div class="flex items-center justify-between text-xs text-white mt-1 opacity-90">
                  <span>{{ dev.cbty_name || '保护测控装置' }}</span>
                  <span class="text-[11px] font-mono text-white">{{ dev.alias || '' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. 测点分类与列表展示区 (测点名称突出展示，测点ID完全隐藏，无实时值，无灰色文字) -->
          <div class="flex-1 flex flex-col bg-black overflow-hidden min-w-0">
            <!-- 顶部分类标签栏与更窄的测点搜索框 -->
            <div class="p-3 border-b border-[#222222] bg-[#111111] shrink-0 flex items-center justify-between gap-3">
              <!-- 分类切换按钮 (统一删除(YC)(YX)等前缀提示，统一纯白字体) -->
              <div class="grid grid-cols-5 gap-1.5 flex-1 max-w-lg">
                <button
                  type="button"
                  class="py-1.5 px-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border"
                  :class="selectedCategory === 'yc' ? 'bg-neutral-800 text-white border-neutral-400 shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                  @click="selectedCategory = 'yc'"
                >
                  <span>遥测</span>
                  <span class="px-1.5 py-0.2 bg-black/60 rounded font-mono text-[11px] text-white font-bold">{{ categoryStats.yc }}</span>
                </button>

                <button
                  type="button"
                  class="py-1.5 px-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border"
                  :class="selectedCategory === 'yx' ? 'bg-neutral-800 text-white border-neutral-400 shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                  @click="selectedCategory = 'yx'"
                >
                  <span>遥信</span>
                  <span class="px-1.5 py-0.2 bg-black/60 rounded font-mono text-[11px] text-white font-bold">{{ categoryStats.yx }}</span>
                </button>

                <button
                  type="button"
                  class="py-1.5 px-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border"
                  :class="selectedCategory === 'dd' ? 'bg-neutral-800 text-white border-neutral-400 shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                  @click="selectedCategory = 'dd'"
                >
                  <span>电度</span>
                  <span class="px-1.5 py-0.2 bg-black/60 rounded font-mono text-[11px] text-white font-bold">{{ categoryStats.dd }}</span>
                </button>

                <button
                  type="button"
                  class="py-1.5 px-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border"
                  :class="selectedCategory === 'yk' ? 'bg-neutral-800 text-white border-neutral-400 shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                  @click="selectedCategory = 'yk'"
                >
                  <span>遥控</span>
                  <span class="px-1.5 py-0.2 bg-black/60 rounded font-mono text-[11px] text-white font-bold">{{ categoryStats.yk }}</span>
                </button>

                <button
                  type="button"
                  class="py-1.5 px-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border"
                  :class="selectedCategory === 'yt' ? 'bg-neutral-800 text-white border-neutral-400 shadow-sm' : 'bg-[#181818] text-white border-[#2a2a2a] hover:bg-neutral-800'"
                  @click="selectedCategory = 'yt'"
                >
                  <span>遥调</span>
                  <span class="px-1.5 py-0.2 bg-black/60 rounded font-mono text-[11px] text-white font-bold">{{ categoryStats.yt }}</span>
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

            <!-- 测点数据列表 (测点ID已删除，不显示实时值，统一纯白字体，测点名称醒目居首，高性能虚拟滚动) -->
            <div
              ref="tableScrollRef"
              class="flex-1 overflow-y-auto p-2.5 relative"
              style="scrollbar-gutter: stable;"
              @scroll.passive="onTableScroll"
            >
              <table class="w-full text-left text-sm border-collapse" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: 48%;" />
                  <col style="width: 36%;" />
                  <col style="width: 110px;" />
                </colgroup>
                <thead>
                  <tr class="border-b border-[#2a2a2a] bg-[#141414] text-white sticky top-0 z-10 h-11">
                    <th class="py-3 px-3 font-bold text-sm text-white">测点名称</th>
                    <th class="py-3 px-3 font-bold text-xs text-white">工程别名 / 物理标识</th>
                    <th class="py-3 px-3 font-bold text-xs text-white text-right">选择状态</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#1e1e1e]">
                  <!-- 虚拟滚动顶部占位行 -->
                  <tr v-if="virtualTopSpacerHeight > 0" :style="{ height: `${virtualTopSpacerHeight}px` }" aria-hidden="true">
                    <td colspan="3" class="p-0 border-0 m-0"></td>
                  </tr>

                  <tr
                    v-for="pt in visiblePointsList"
                    :key="pt.id"
                    :id="`cascade-point-row-${pt.id}`"
                    class="cursor-pointer h-12 select-none"
                    :class="selectedPointId === pt.id ? 'bg-neutral-800 text-white' : 'hover:bg-[#161616] text-white'"
                    @click="handleSelectPointRow(pt)"
                  >
                    <!-- 测点名称：醒目大号亮白文字 -->
                    <td class="py-2.5 px-3 font-sans text-sm font-bold text-white truncate" :title="getScadaPointDisplayName(pt)">
                      <div class="flex items-center gap-2 truncate">
                        <span class="w-2 h-2 rounded-full shrink-0" :class="selectedPointId === pt.id ? 'bg-white' : 'bg-neutral-600'"></span>
                        <span class="truncate">{{ getScadaPointDisplayName(pt) }}</span>
                      </div>
                    </td>

                    <!-- 工程别名 / 物理标识 -->
                    <td class="py-2.5 px-3 font-mono text-xs text-white font-medium truncate" :title="pt.alias || pt.type_name || ''">
                      {{ pt.alias || pt.type_name || '-' }}
                    </td>

                    <!-- 选中状态 (固定尺寸 w-20 居中，固定1px边框无晃动) -->
                    <td class="py-2.5 px-3 text-right">
                      <div
                        class="inline-flex items-center justify-center w-20 h-7 rounded text-xs font-semibold shrink-0 select-none border"
                        :class="selectedPointId === pt.id ? 'bg-white text-black border-white shadow-sm' : 'bg-neutral-800 text-white border-neutral-700 hover:border-neutral-500'"
                      >
                        <Check v-if="selectedPointId === pt.id" class="w-3.5 h-3.5 mr-1 stroke-[3] shrink-0" />
                        <span>{{ selectedPointId === pt.id ? '已选中' : '选择' }}</span>
                      </div>
                    </td>
                  </tr>

                  <!-- 虚拟滚动底部占位行 -->
                  <tr v-if="virtualBottomSpacerHeight > 0" :style="{ height: `${virtualBottomSpacerHeight}px` }" aria-hidden="true">
                    <td colspan="3" class="p-0 border-0 m-0"></td>
                  </tr>

                  <tr v-if="totalPointsCount === 0">
                    <td colspan="3" class="p-12 text-center text-white font-sans text-sm font-medium">
                      当前装置暂无该类型测点或未搜索到匹配项
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 遥控/遥调闭环返校点配置 (删去(YX)(YC)提示，统一纯白字体，仅显示经过严格规则筛选的返校点) -->
            <div
              v-if="selectedCategory === 'yk' || selectedCategory === 'yt'"
              class="h-12 min-h-12 px-3 bg-[#111111] border-t border-[#2a2a2a] shrink-0 flex items-center justify-between gap-3 text-xs"
            >
              <div class="flex items-center gap-2 shrink-0 text-xs font-bold text-white">
                <ShieldCheck class="w-4 h-4 text-white" />
                <span>{{ selectedCategory === 'yk' ? '遥控闭环返校点:' : '遥调闭环返校点:' }}</span>
              </div>

              <div class="flex-1">
                <select
                  v-model="selectedVerificationPointId"
                  class="w-full bg-[#181818] border border-neutral-600 rounded px-2.5 py-1 text-xs text-white font-medium focus:outline-none focus:border-white cursor-pointer"
                >
                  <option :value="null">-- 不配置专属返校校验点 (执行后直接返回) --</option>
                  <option
                    v-for="cand in sameBayVerificationCandidates"
                    :key="cand.id"
                    :value="cand.id"
                  >
                    [{{ cand.index }}] 【{{ cand.deviceName }}】 {{ cand.displayName }} {{ cand.alias ? `(${cand.alias})` : '' }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作栏 (统一纯白字体，删掉(YC)(YX)类前缀) -->
        <footer class="h-13 px-5 border-t border-[#2a2a2a] bg-[#111111] flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2 text-sm min-w-0 pr-4">
            <span class="text-white font-bold shrink-0">当前选择:</span>
            <span v-if="isUnboundPending" class="text-rose-400 font-bold truncate">
              [已标记解除测点关联]
            </span>
            <span v-else-if="selectedPoint" class="text-white font-bold truncate">
              {{ currentFacility?.fac_name || currentFacility?.name }} ➜ {{ currentBay?.bay_name || currentBay?.name }} ➜ {{ currentDevice?.dev_name || currentDevice?.name }} ➜ <strong class="text-white font-bold underline underline-offset-2">{{ selectedPoint.name }}</strong>
              <span v-if="selectedVerificationPointId" class="text-white ml-2 font-normal">
                (返校校验点: 已匹配配置)
              </span>
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
