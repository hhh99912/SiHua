<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as echarts from 'echarts';
import { Play, Pause, RotateCcw, X, Maximize2, Minimize2 } from 'lucide-vue-next';
import { ScreenComponent, DatasetItem } from '../types';
import { getFastLiveYc, findScadaPointDef, scadaFacilities } from '../utils/scadaClient';
import { getComponentLiveNumericValue } from '../utils/scadaResolver';

interface Props {
  visible: boolean;
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

// Point metadata resolution: 顶栏标明点名称 (厂站名-间隔-设备-点号)
const resolvedPointInfo = computed(() => {
  const comp = props.component;
  const mapping = comp.data?.mapping || {};
  const customProps = comp.customProps || {};

  let pointId: number | null = null;
  let deviceId: string | number | null = mapping.deviceId || null;
  let unit = mapping.unit || customProps.unit || comp.style?.unit || '';

  if (mapping.pointId) {
    pointId = Number(mapping.pointId);
  } else if (mapping.valueKey) {
    const m = String(mapping.valueKey).match(/^(?:([A-Za-z0-9_-]+)_)?(YC|YX|YK|YT|DD)_(\d+)/i);
    if (m) {
      if (m[1]) deviceId = m[1];
      pointId = Number(m[3]);
    }
  } else if (mapping.stateKey) {
    const m = String(mapping.stateKey).match(/^(?:([A-Za-z0-9_-]+)_)?(YC|YX|YK|YT|DD)_(\d+)/i);
    if (m) {
      if (m[1]) deviceId = m[1];
      pointId = Number(m[3]);
    }
  } else if (mapping.pointKey) {
    const m = String(mapping.pointKey).match(/^(?:([A-Za-z0-9_-]+)_)?(YC|YX|YK|YT|DD)_(\d+)/i);
    if (m) {
      if (m[1]) deviceId = m[1];
      pointId = Number(m[3]);
    }
  } else if (customProps.pointId) {
    pointId = Number(customProps.pointId);
  }

  let facName = '';
  let bayName = '';
  let devName = '';
  let pointName = '';

  if (pointId) {
    const pDef = findScadaPointDef(pointId);
    if (pDef && pDef.category !== 'none') {
      facName = pDef.facility?.fac_name || pDef.facility?.name || '';
      bayName = pDef.bay?.name || pDef.bay?.bay_name || '';
      devName = pDef.device?.name || pDef.device?.dev_name || '';
      pointName = pDef.point?.name || '';
      if (pDef.point?.unit && !unit) unit = pDef.point.unit;
    }
  }

  // Fallback lookup from scadaFacilities
  if (!bayName || !devName || !facName) {
    for (const fac of scadaFacilities.value || []) {
      for (const b of fac.bays || []) {
        for (const d of b.devices || b.cb_devices || []) {
          if (deviceId && String(d.dev_id || d.id) === String(deviceId)) {
            if (!facName) facName = fac.fac_name || fac.name || '';
            if (!bayName) bayName = b.name || b.bay_name || '';
            if (!devName) devName = d.name || d.dev_name || '';
          }
          if (pointId) {
            const pts = [
              ...(d.yc_list || d.yc_points || []),
              ...(d.yx_list || d.yx_points || []),
              ...(d.yk_list || d.yk_points || []),
              ...(d.yt_list || d.yt_points || []),
              ...(d.dd_list || d.dd_points || [])
            ];
            const found = pts.find(p => p.id === Number(pointId));
            if (found) {
              if (!facName) facName = fac.fac_name || fac.name || '';
              if (!bayName) bayName = b.name || b.bay_name || '';
              if (!devName) devName = d.name || d.dev_name || '';
              if (!pointName) pointName = found.name || '';
              if (found.unit && !unit) unit = found.unit;
              break;
            }
          }
        }
      }
    }
  }

  // Clean fallback names
  if (!facName) facName = '示范站';
  if (!bayName) bayName = mapping.bayName || '10kV进线';
  if (!devName) devName = mapping.deviceName || (deviceId ? `设备${deviceId}` : '测控装置');
  if (!pointName) pointName = mapping.pointName || '';

  // 严格标明点名称: 厂站名-间隔-设备-点号
  const pointIdentifier = pointId ? `${pointId}${pointName ? ` (${pointName})` : ''}` : (pointName || '测点');
  const fullHierarchyTitle = `${facName}-${bayName}-${devName}-${pointIdentifier}`;

  return {
    pointId,
    unit,
    title: fullHierarchyTitle
  };
});

// Sampling state
interface CurvePoint {
  time: string;
  value: number;
}

const points = ref<CurvePoint[]>([]);
const isRunning = ref(true);
const chartRef = ref<HTMLDivElement | null>(null);
const modalRef = ref<HTMLDivElement | null>(null);

let timer: ReturnType<typeof setInterval> | null = null;
let chartInstance: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

// Draggable & Resizable state
const modalPos = ref<{ x: number; y: number }>({ x: 0, y: 0 });
const modalSize = ref<{ width: number; height: number }>({ width: 780, height: 480 });
const isMaximized = ref(false);
let preMaxState = { x: 0, y: 0, width: 780, height: 480 };

const isDragging = ref(false);
let dragStart = { mouseX: 0, mouseY: 0, posX: 0, posY: 0 };

const isResizing = ref(false);
let resizeStart = { mouseX: 0, mouseY: 0, width: 0, height: 0 };
let currentResizeDir: 'e' | 's' | 'se' = 'se';

const initModalPosition = () => {
  const modalW = Math.min(800, window.innerWidth - 32);
  const modalH = Math.min(500, window.innerHeight - 32);
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
  // Ignore clicks on control buttons in header
  if ((e.target as HTMLElement).closest('button')) return;

  if (isMaximized.value) {
    // If dragging while maximized, restore window to normal size centered at mouse
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

// Resizing logic (supports East, South, and South-East corner)
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
      newW = Math.max(380, Math.min(window.innerWidth - modalPos.value.x - 8, resizeStart.width + dx));
    }
    if (currentResizeDir === 's' || currentResizeDir === 'se') {
      newH = Math.max(240, Math.min(window.innerHeight - modalPos.value.y - 8, resizeStart.height + dy));
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

// Read live value
const fetchSample = (): number => {
  const pId = resolvedPointInfo.value.pointId;
  let val: number | undefined = undefined;
  if (pId) {
    const raw = getFastLiveYc(pId);
    if (typeof raw === 'number' && !isNaN(raw)) {
      val = raw;
    }
  }
  if (val === undefined) {
    const num = getComponentLiveNumericValue(props.component, props.datasets, 0, true);
    val = typeof num === 'number' && !isNaN(num) ? num : 0;
  }
  return Number(val.toFixed(2));
};

const formatTime = (d: Date) => {
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// 1s interval sample tick, keep latest 10 minutes (max 600 points)
const tickSample = () => {
  if (!isRunning.value) return;

  const now = new Date();
  const val = fetchSample();

  points.value.push({
    time: formatTime(now),
    value: val
  });

  if (points.value.length > 600) {
    points.value.shift();
  }

  updateChart();
};

// ECharts initialization: 亮白色字体、高对比纯黑背景、清晰坐标轴与悬浮提示
const initChart = () => {
  if (!chartRef.value) return;

  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }

  chartInstance = echarts.init(chartRef.value, undefined, {
    renderer: 'canvas'
  });

  const option: echarts.EChartsOption = {
    backgroundColor: '#000000',
    // 关键优化：工控机纯 CPU 软渲染环境下彻底关闭动画，杜绝 60fps 满负荷重绘抢占 CPU
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
    grid: {
      top: 28,
      right: 30,
      bottom: 28,
      left: 65,
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#141414',
      borderColor: '#525252',
      borderWidth: 1.5,
      padding: [8, 12],
      textStyle: {
        color: '#ffffff',
        fontSize: 13
      },
      formatter: (params: any) => {
        if (!params || !params[0]) return '';
        const item = params[0];
        const u = resolvedPointInfo.value.unit;
        return `<div style="font-family:sans-serif;line-height:1.5;color:#ffffff;">
          <div style="color:#d4d4d4;font-size:12px;margin-bottom:3px;">时间: ${item.name}</div>
          <div style="color:#ffffff;font-weight:700;font-size:16px;font-family:monospace;">${item.value}${u ? ' ' + u : ''}</div>
        </div>`;
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.value.map(p => p.time),
      axisLine: {
        lineStyle: { color: '#525252', width: 1.5 }
      },
      axisLabel: {
        // 亮白色坐标轴字体
        color: '#ffffff',
        fontSize: 12,
        fontFamily: 'monospace',
        fontWeight: '500'
      },
      splitLine: {
        show: true,
        lineStyle: { color: '#262626', type: 'dashed' }
      }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: {
        lineStyle: { color: '#525252', width: 1.5 }
      },
      axisLabel: {
        // 亮白色坐标轴字体
        color: '#ffffff',
        fontSize: 12,
        fontFamily: 'monospace',
        fontWeight: '500',
        formatter: (val: number) => {
          const u = resolvedPointInfo.value.unit;
          return u ? `${val} ${u}` : String(val);
        }
      },
      splitLine: {
        show: true,
        lineStyle: { color: '#262626', type: 'dashed' }
      }
    },
    series: [
      {
        name: resolvedPointInfo.value.title,
        type: 'line',
        data: points.value.map(p => p.value),
        smooth: false,
        showSymbol: false,
        // 亮白色曲线，纯净高对比度，低 CPU 开销
        lineStyle: {
          color: '#ffffff',
          width: 2
        },
        itemStyle: {
          color: '#ffffff'
        },
        areaStyle: {
          color: 'rgba(255, 255, 255, 0.05)'
        }
      }
    ]
  };

  chartInstance.setOption(option);

  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  let resizeRaf: number | null = null;
  resizeObserver = new ResizeObserver(() => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      chartInstance?.resize();
      resizeRaf = null;
    });
  });
  resizeObserver.observe(chartRef.value);
};

const updateChart = () => {
  if (!chartInstance) return;
  chartInstance.setOption({
    animation: false,
    xAxis: {
      data: points.value.map(p => p.time)
    },
    series: [
      {
        data: points.value.map(p => p.value),
        showSymbol: false
      }
    ]
  }, { lazyUpdate: true, silent: true });
};

const toggleRunning = () => {
  isRunning.value = !isRunning.value;
  if (isRunning.value) {
    tickSample();
  }
};

const clearData = () => {
  points.value = [];
  tickSample();
};

onMounted(() => {
  initModalPosition();

  // First sample
  points.value.push({
    time: formatTime(new Date()),
    value: fetchSample()
  });

  nextTick(() => {
    initChart();
    timer = setInterval(tickSample, 1000);
  });
});

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
});
</script>

<template>
  <!-- 可拖动/可拉伸浮动弹框层 -->
  <div
    v-if="visible"
    class="fixed inset-0 z-50 pointer-events-none select-none"
  >
    <!-- 弹窗容器：可拖拽、可拉伸、可最大化、亮白字体、纯黑背景 -->
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
      <!-- 顶栏：标明点名称(厂站名-间隔-设备-点号)，双击最大化/还原，按住拖拽 -->
      <header
        @mousedown="onHeaderMouseDown"
        @dblclick="toggleMaximize"
        class="h-11 px-3.5 bg-[#111111] border-b border-[#2a2a2a] flex items-center justify-between shrink-0 cursor-move select-none"
        title="按住鼠标左键可拖动，双击可最大化/还原"
      >
        <!-- 顶栏点名称：大而亮的纯白色文字 (厂站名-间隔-设备-点号) -->
        <div class="flex items-center min-w-0 pr-3">
          <span class="text-sm sm:text-base font-bold text-white tracking-normal truncate drop-shadow-xs">
            {{ resolvedPointInfo.title }}
          </span>
        </div>

        <!-- 控制区：启动/暂停、清空、最大化/还原、关闭 -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            @click="toggleRunning"
            class="px-2.5 py-1 rounded text-xs font-semibold border border-neutral-600 bg-neutral-900 hover:bg-neutral-800 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            :title="isRunning ? '暂停采样' : '继续采样'"
          >
            <component :is="isRunning ? Pause : Play" class="w-3.5 h-3.5" />
            <span>{{ isRunning ? '暂停' : '启动' }}</span>
          </button>

          <button
            @click="clearData"
            class="px-2.5 py-1 rounded text-xs font-semibold border border-neutral-600 bg-neutral-900 hover:bg-neutral-800 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="清空当前已记录数据"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>清空</span>
          </button>

          <!-- 最大化 / 还原按钮 -->
          <button
            @click="toggleMaximize"
            class="w-7 h-7 rounded flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-600 transition-colors cursor-pointer"
            :title="isMaximized ? '还原窗口' : '最大化窗口'"
          >
            <component :is="isMaximized ? Minimize2 : Maximize2" class="w-3.5 h-3.5" />
          </button>

          <!-- 关闭按钮 -->
          <button
            @click="emit('close')"
            class="w-7 h-7 rounded flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-600 transition-colors cursor-pointer"
            title="关闭窗口"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </header>

      <!-- 纯黑曲线绘制区 -->
      <div class="flex-1 w-full p-2.5 relative min-h-0 bg-black">
        <div ref="chartRef" class="w-full h-full"></div>
      </div>

      <!-- 窗体拉伸控制边缘 (未最大化时有效) -->
      <template v-if="!isMaximized">
        <!-- 右侧边缘水平拉伸 -->
        <div
          @mousedown="startResize('e', $event)"
          class="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-white/10 transition-colors"
          title="左右拖动调整宽度"
        ></div>

        <!-- 底部边缘垂直拉伸 -->
        <div
          @mousedown="startResize('s', $event)"
          class="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-white/10 transition-colors"
          title="上下拖动调整高度"
        ></div>

        <!-- 右下角双向拉伸控柄 -->
        <div
          @mousedown="startResize('se', $event)"
          class="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 text-neutral-400 hover:text-white hover:bg-white/15 rounded-br transition-colors"
          title="拖动右下角调整大小"
        >
          <svg class="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor">
            <path d="M8 8H9V9H8V8ZM5 8H6V9H5V8ZM8 5H9V6H8V5ZM2 8H3V9H2V8ZM5 5H6V6H5V5ZM8 2H9V3H8V2Z" />
          </svg>
        </div>
      </template>
    </div>
  </div>
</template>
