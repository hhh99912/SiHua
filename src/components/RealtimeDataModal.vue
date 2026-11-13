<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import {
  RefreshCw,
  Download,
  RotateCcw,
  AlertTriangle,
  X
} from 'lucide-vue-next';
import {
  scadaFacilities,
  fetchScadaConfig,
  fetchScadaRealtime,
  rawYcValues,
  rawYxValues,
  rawDdValues,
  rawYcQuality,
  rawYxQuality,
  rawDdQuality,
  YX_STATUS_DICT,
  YC_STATUS_DICT,
  ScadaFacilityNode,
  ScadaBayNode,
  ScadaDeviceNode,
  ScadaYcItem,
  ScadaYxItem,
  ScadaDdItem
} from '../utils/scadaClient';

interface Props {
  visible?: boolean;
  isEmbedded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
  isEmbedded: true
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

// ============================================================================
// 1. 数据结构定义与实时点表项规约 (仅保留实际测量值、状态字、全表序号、品质)
// ============================================================================
export interface RealtimeTablePointItem {
  id: number;
  category: 'yc' | 'yx' | 'dd';
  categoryName: string;
  facId: number | string;
  facName: string;
  bayId: number | string;
  bayName: string;
  devId: number | string;
  devName: string;
  devAlias: string;
  pointName: string;
  pointAlias: string;
  val: number;
  status: number;
  statusName: string;
  quality: number;
}

// 统一深瑞 SCADA 米白主题色阶定义
const themeBg = 'bg-[#f4efe4]';
const themePanelBg = 'bg-[#ebe4d4]';
const themeHeaderBg = 'bg-[#dfd7c5]';
const themeBorder = 'border-[#c8c0ae]';

// 测点类型过滤 Tab: 默认遥测 (YC)，按用户要求不提供全部点表
const activeCategoryTab = ref<'yc' | 'yx' | 'dd'>('yc');

// 级联筛选与关键词搜索
const selectedFacName = ref<string>('all');
const selectedBayName = ref<string>('all');
const selectedDevName = ref<string>('all');
const baySearchText = ref<string>('');
const signalSearchText = ref<string>('');

// 自动刷新与刷新频率 (固定 1.0 秒实时轮询，最小化不降频)
const isAutoRefreshEnabled = ref<boolean>(true);
const isRefreshing = ref<boolean>(false);
const lastUpdatedTime = ref<string>('');

// 表格列宽配置与鼠标拖动调整大小 (仅保留保留列)
interface ColWidthMap {
  index: number;
  facName: number;
  bayName: number;
  devName: number;
  devAlias: number;
  pointName: number;
  val: number;
  status: number;
  pointId: number;
  quality: number;
}

const DEFAULT_COL_WIDTHS: ColWidthMap = {
  index: 55,
  facName: 160,
  bayName: 150,
  devName: 130,
  devAlias: 130,
  pointName: 220,
  val: 130,
  status: 110,
  pointId: 100,
  quality: 95
};

const colWidths = ref<ColWidthMap>({ ...DEFAULT_COL_WIDTHS });

// 鼠标拖动列宽
const isResizingCol = ref(false);
let resizingColKey: keyof ColWidthMap | null = null;
let startResizeX = 0;
let startResizeWidth = 0;

const startColResize = (colKey: keyof ColWidthMap, event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isResizingCol.value = true;
  resizingColKey = colKey;
  startResizeX = event.clientX;
  startResizeWidth = colWidths.value[colKey];

  document.addEventListener('mousemove', onColResizeMove);
  document.addEventListener('mouseup', onColResizeEnd);
};

const onColResizeMove = (event: MouseEvent) => {
  if (!isResizingCol.value || !resizingColKey) return;
  const deltaX = event.clientX - startResizeX;
  const newWidth = Math.max(45, startResizeWidth + deltaX);
  colWidths.value[resizingColKey] = newWidth;
};

const onColResizeEnd = () => {
  isResizingCol.value = false;
  resizingColKey = null;
  document.removeEventListener('mousemove', onColResizeMove);
  document.removeEventListener('mouseup', onColResizeEnd);
};

// ============================================================================
// 2. 严格从 HTTP 接口 (/api/scada/config) 获取真实全量静态点表，绝不虚造
// ============================================================================
const allPointList = shallowRef<RealtimeTablePointItem[]>([]);

const reloadStaticPoints = async () => {
  try {
    const res = await fetch('/api/scada/config?pretty=1', {
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) {
      console.warn('获取 /api/scada/config 失败:', res.status);
      return;
    }
    const json = await res.json();
    const facs = json.facilities || (Array.isArray(json) ? json : []);
    const list: RealtimeTablePointItem[] = [];

    facs.forEach((fac: any) => {
      const fId = fac.id || fac.fac_id;
      const fName = fac.name || fac.fac_name || '变电站';

      (fac.bays || []).forEach((bay: any) => {
        const bId = bay.id || bay.bay_id;
        const bName = bay.name || bay.bay_name || '主接线间隔';

        const devices = bay.devices || bay.cb_devices || [];
        devices.forEach((dev: any) => {
          const dId = dev.id || dev.dev_id;
          const dName = dev.name || dev.dev_name || '智能装置';
          const dAlias = dev.alias || dev.dev_alias || dev.name || 'IED';

          // 1. 遥测 (YC)
          const ycPoints = dev.yc_points || dev.yc_list || [];
          ycPoints.forEach((yc: any) => {
            const rawVal = yc.val ?? yc.value ?? 0;
            const status = yc.status ?? 0;
            const quality = yc.q ?? 0;
            list.push({
              id: yc.id,
              category: 'yc',
              categoryName: '遥测',
              facId: fId,
              facName: fName,
              bayId: bId,
              bayName: bName,
              devId: dId,
              devName: dName,
              devAlias: dAlias,
              pointName: yc.name || `遥测测点 ${yc.id}`,
              pointAlias: yc.alias || '',
              val: rawVal,
              status: status,
              statusName: YC_STATUS_DICT[status] || yc.status_name || '正常',
              quality: quality
            });
          });

          // 2. 遥信 (YX)
          const yxPoints = dev.yx_points || dev.yx_list || [];
          yxPoints.forEach((yx: any) => {
            const rawVal = yx.value ?? yx.val ?? 0;
            const status = yx.status ?? 0;
            const quality = yx.q ?? 0;
            list.push({
              id: yx.id,
              category: 'yx',
              categoryName: '遥信',
              facId: fId,
              facName: fName,
              bayId: bId,
              bayName: bName,
              devId: dId,
              devName: dName,
              devAlias: dAlias,
              pointName: yx.name || `遥信测点 ${yx.id}`,
              pointAlias: yx.alias || '',
              val: rawVal,
              status: status,
              statusName: YX_STATUS_DICT[status] || yx.status_name || (rawVal === 1 ? '合闸(1)' : '分闸(0)'),
              quality: quality
            });
          });

          // 3. 电度 (DD)
          const ddPoints = dev.dd_points || dev.dd_list || [];
          ddPoints.forEach((dd: any) => {
            const rawVal = dd.value ?? dd.val ?? 0;
            const status = dd.status ?? 0;
            const quality = dd.q ?? 0;
            list.push({
              id: dd.id,
              category: 'dd',
              categoryName: '电度',
              facId: fId,
              facName: fName,
              bayId: bId,
              bayName: bName,
              devId: dId,
              devName: dName,
              devAlias: dAlias,
              pointName: dd.name || `电度计量 ${dd.id}`,
              pointAlias: dd.alias || '',
              val: rawVal,
              status: status,
              statusName: dd.status_name || (status === 0 ? '正常' : '异常'),
              quality: quality
            });
          });
        });
      });
    });

    allPointList.value = list;
  } catch (err) {
    console.error('从 /api/scada/config 加载真实点表异常:', err);
  }
};

// ============================================================================
// 3. 动态级联筛选可选项与过滤列表
// ============================================================================
const availableFacilities = computed(() => {
  const set = new Set<string>();
  allPointList.value.forEach(p => {
    if (p.facName) set.add(p.facName);
  });
  return Array.from(set);
});

const availableBays = computed(() => {
  const set = new Set<string>();
  allPointList.value.forEach(p => {
    if (selectedFacName.value !== 'all' && p.facName !== selectedFacName.value) return;
    if (p.bayName) set.add(p.bayName);
  });
  return Array.from(set);
});

const availableDevices = computed(() => {
  const set = new Set<string>();
  allPointList.value.forEach(p => {
    if (selectedFacName.value !== 'all' && p.facName !== selectedFacName.value) return;
    if (selectedBayName.value !== 'all' && p.bayName !== selectedBayName.value) return;
    if (p.devName) set.add(p.devName);
  });
  return Array.from(set);
});

// 重置筛选条件
const handleResetFilters = () => {
  selectedFacName.value = 'all';
  selectedBayName.value = 'all';
  selectedDevName.value = 'all';
  baySearchText.value = '';
  signalSearchText.value = '';
};

// 筛选核心过滤逻辑
const filteredPoints = computed(() => {
  let list = allPointList.value;

  // 1. 类型过滤 (仅限 yc / yx / dd，不提供全部点表)
  list = list.filter(p => p.category === activeCategoryTab.value);

  // 2. 厂站过滤
  if (selectedFacName.value !== 'all') {
    list = list.filter(p => p.facName === selectedFacName.value);
  }

  // 3. 间隔过滤
  if (selectedBayName.value !== 'all') {
    list = list.filter(p => p.bayName === selectedBayName.value);
  }

  // 4. 设备过滤
  if (selectedDevName.value !== 'all') {
    list = list.filter(p => p.devName === selectedDevName.value);
  }

  // 5. 间隔名称文本过滤
  if (baySearchText.value.trim()) {
    const kw = baySearchText.value.trim().toLowerCase();
    list = list.filter(p => p.bayName.toLowerCase().includes(kw));
  }

  // 6. 信号名称文本过滤
  if (signalSearchText.value.trim()) {
    const kw = signalSearchText.value.trim().toLowerCase();
    list = list.filter(p => 
      p.pointName.toLowerCase().includes(kw) || 
      p.pointAlias.toLowerCase().includes(kw) ||
      String(p.id).includes(kw)
    );
  }

  return list;
});

// 统计各分类数量
const stats = computed(() => {
  const list = allPointList.value;
  let totalYc = 0;
  let totalYx = 0;
  let totalDd = 0;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item.category === 'yc') totalYc++;
    else if (item.category === 'yx') totalYx++;
    else if (item.category === 'dd') totalDd++;
  }
  return {
    total: list.length,
    yc: totalYc,
    yx: totalYx,
    dd: totalDd,
    filteredCount: filteredPoints.value.length
  };
});

// ============================================================================
// 4. 1.0 秒实时通信轮询同步逻辑 (严格满足用户 1s 要求，窗口最小化时不降频)
// ============================================================================
let pollTimer: ReturnType<typeof setInterval> | null = null;
let isPolling = false;

const pollRealtimeDataOnce = async () => {
  if (isPolling) return;
  isPolling = true;

  try {
    const list = allPointList.value;
    if (list.length === 0) {
      isPolling = false;
      return;
    }

    const ycIds: number[] = [];
    const yxIds: number[] = [];
    const ddIds: number[] = [];

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.category === 'yc') ycIds.push(p.id);
      else if (p.category === 'yx') yxIds.push(p.id);
      else if (p.category === 'dd') ddIds.push(p.id);
    }

    const res = await fetchScadaRealtime({
      yc_ids: ycIds,
      yx_ids: yxIds,
      dd_ids: ddIds
    });

    if (res.success && res.data) {
      const nowStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      lastUpdatedTime.value = nowStr;

      const ycMap = new Map<number, { val: number; status: number }>();
      (res.data.yc || []).forEach(y => {
        ycMap.set(y.id, { val: y.val, status: y.status });
      });

      const yxMap = new Map<number, { val: number; status: number; q?: number }>();
      (res.data.yx || []).forEach(x => {
        yxMap.set(x.id, { val: x.val, status: x.status, q: x.q });
      });

      const ddMap = new Map<number, { val: number; status: number }>();
      (res.data.dd || []).forEach(d => {
        ddMap.set(d.id, { val: d.val, status: d.status });
      });

      // 原位更新，避免创建新数组引发垃圾回收停顿
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item.category === 'yc') {
          const fresh = ycMap.get(item.id);
          if (fresh) {
            item.val = fresh.val;
            item.status = fresh.status;
            item.statusName = YC_STATUS_DICT[fresh.status] || '正常';
          }
        } else if (item.category === 'yx') {
          const fresh = yxMap.get(item.id);
          if (fresh) {
            item.val = fresh.val;
            item.status = fresh.status;
            item.statusName = YX_STATUS_DICT[fresh.status] || (fresh.val === 1 ? '合闸(1)' : '分闸(0)');
            item.quality = fresh.q ?? 0;
          }
        } else if (item.category === 'dd') {
          const fresh = ddMap.get(item.id);
          if (fresh) {
            item.val = fresh.val;
            item.status = fresh.status;
            item.statusName = fresh.status === 0 ? '正常' : '异常';
          }
        }
      }
    }
  } catch (err) {
    // 忽略偶发网络抖动
  } finally {
    isPolling = false;
  }
};

const startPolling = () => {
  stopPolling();
  // 严格定死 1000ms (1.0秒) 恒定轮询
  pollTimer = setInterval(() => {
    if (isAutoRefreshEnabled.value) {
      pollRealtimeDataOnce();
    }
  }, 1000);
};

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isPolling = false;
};

// 手动强制立即刷新一次
const handleManualRefresh = async () => {
  isRefreshing.value = true;
  await pollRealtimeDataOnce();
  setTimeout(() => {
    isRefreshing.value = false;
  }, 300);
};

// 导出 CSV 表格 (仅导出当前保留的列)
const handleExportCsv = () => {
  try {
    const list = filteredPoints.value;
    if (list.length === 0) return;

    const headers = [
      '序号', '厂站名称', '间隔名称', '设备名称', '装置名称', '信号名称',
      '实际测量值', '状态字', '全表序号', '品质'
    ];

    const rows = list.map((item, idx) => [
      idx + 1,
      `"${item.facName}"`,
      `"${item.bayName}"`,
      `"${item.devName}"`,
      `"${item.devAlias}"`,
      `"${item.pointName}"`,
      item.category === 'yx' ? (item.val === 1 ? '合闸(1)' : '分闸(0)') : item.val,
      `"${item.statusName}"`,
      item.id,
      item.quality === 0 ? '0 (有效)' : `${item.quality} (异常)`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `SCADA_实时数据_${activeCategoryTab.value.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('导出失败:', err);
  }
};

// ============================================================================
// 5. 虚拟滚动与高帧率视口裁剪 (支持数百点平滑丝滑滚动)
// ============================================================================
const tableContainerRef = ref<HTMLDivElement | null>(null);
const headerScrollRef = ref<HTMLDivElement | null>(null);
const rowHeight = 32;
const scrollTop = ref<number>(0);
const containerHeight = ref<number>(650);

const onTableScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (!target) return;
  scrollTop.value = target.scrollTop;
  if (headerScrollRef.value) {
    headerScrollRef.value.scrollLeft = target.scrollLeft;
  }
};

const OVERSCAN = 25;
const startIndex = computed(() => {
  const raw = Math.floor(scrollTop.value / rowHeight);
  return Math.max(0, raw - OVERSCAN);
});

const endIndex = computed(() => {
  const raw = Math.floor(scrollTop.value / rowHeight);
  const visibleCount = Math.ceil(containerHeight.value / rowHeight);
  return Math.min(filteredPoints.value.length, raw + visibleCount + OVERSCAN);
});

const visibleRows = computed(() => {
  return filteredPoints.value.slice(startIndex.value, endIndex.value);
});

const updateContainerHeight = () => {
  if (tableContainerRef.value) {
    containerHeight.value = tableContainerRef.value.clientHeight || 650;
  }
};

// 测点数值高亮格式化
const formatDisplayValue = (item: RealtimeTablePointItem) => {
  if (item.category === 'yx') {
    return item.val === 1 ? '1 [合闸]' : '0 [分闸]';
  }
  if (typeof item.val === 'number') {
    if (Math.abs(item.val) >= 1000) return item.val.toFixed(2);
    if (Math.abs(item.val) < 1 && item.val !== 0) return item.val.toFixed(4);
    return item.val.toFixed(2);
  }
  return item.val ?? 0;
};

// 挂载与卸载
onMounted(async () => {
  window.addEventListener('resize', updateContainerHeight);
  
  // 确保点表已加载
  try {
    await fetchScadaConfig().catch(() => {});
  } catch {}

  await reloadStaticPoints();
  updateContainerHeight();

  // 立即触发一次实时采集
  await pollRealtimeDataOnce();

  // 启动 1s 恒定轮询
  startPolling();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateContainerHeight);
  stopPolling();
});

// 监听外界点表更新
watch(scadaFacilities, () => {
  reloadStaticPoints();
});
</script>

<template>
  <div 
    v-if="visible"
    :class="[
      isEmbedded 
        ? 'w-full h-full text-slate-800 flex flex-col font-sans select-none overflow-hidden text-[13px]'
        : 'fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex flex-col select-none p-1 md:p-2',
      themeBg
    ]"
  >
    <!-- ===================================================================== -->
    <!-- 1. 顶部操作栏与分类切换 (按用户要求：无帮助/选项、无图标实时库、无全部点表) -->
    <!-- ===================================================================== -->
    <div class="bg-[#ebe4d4] border-b border-[#c8c0ae] px-3 py-1.5 flex items-center justify-between shrink-0 select-none">
      <!-- 左侧：仅显示 遥测 / 遥信 / 电度 三大类型切换按钮 -->
      <div class="flex items-center gap-1">
        <button
          @click="activeCategoryTab = 'yc'"
          class="px-3 py-1 text-xs font-bold border transition-colors cursor-pointer"
          :class="activeCategoryTab === 'yc' 
            ? 'bg-sky-700 text-white border-sky-800 shadow-xs' 
            : 'bg-[#dfd7c5] text-slate-800 border-[#b8af9c] hover:bg-[#d4cbba]'"
        >
          遥测 YC ({{ stats.yc }})
        </button>
        <button
          @click="activeCategoryTab = 'yx'"
          class="px-3 py-1 text-xs font-bold border transition-colors cursor-pointer"
          :class="activeCategoryTab === 'yx' 
            ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs' 
            : 'bg-[#dfd7c5] text-slate-800 border-[#b8af9c] hover:bg-[#d4cbba]'"
        >
          遥信 YX ({{ stats.yx }})
        </button>
        <button
          @click="activeCategoryTab = 'dd'"
          class="px-3 py-1 text-xs font-bold border transition-colors cursor-pointer"
          :class="activeCategoryTab === 'dd' 
            ? 'bg-purple-700 text-white border-purple-800 shadow-xs' 
            : 'bg-[#dfd7c5] text-slate-800 border-[#b8af9c] hover:bg-[#d4cbba]'"
        >
          电度 DD ({{ stats.dd }})
        </button>
      </div>

      <!-- 右侧：刷新与导出工具 -->
      <div class="flex items-center gap-2">
        <!-- 自动刷新勾选框 (恒定 1.0 秒轮询) -->
        <label class="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-800 bg-[#dfd7c5] px-2 py-1 border border-[#b8af9c]">
          <input 
            type="checkbox" 
            v-model="isAutoRefreshEnabled"
            class="w-3.5 h-3.5 text-teal-600 rounded-none cursor-pointer"
          />
          <span>自动刷新 (1.0s)</span>
        </label>

        <!-- 手动刷新按钮 -->
        <button
          @click="handleManualRefresh"
          class="px-2.5 py-1 bg-[#dfd7c5] hover:bg-[#d4cbba] active:bg-[#c9bfad] border border-[#b8af9c] flex items-center gap-1.5 text-slate-900 cursor-pointer text-xs font-bold transition-colors"
          title="立即向现场 SCADA 接口请求最新量测值"
        >
          <RefreshCw class="w-3.5 h-3.5 text-slate-700" :class="{ 'animate-spin': isRefreshing }" />
          <span>立即刷新</span>
        </button>

        <!-- 导出 CSV -->
        <button
          @click="handleExportCsv"
          class="px-2.5 py-1 bg-[#dfd7c5] hover:bg-[#d4cbba] active:bg-[#c9bfad] border border-[#b8af9c] flex items-center gap-1.5 text-slate-900 cursor-pointer text-xs font-bold transition-colors"
          title="导出当前筛选出的实时数据表为 CSV 格式"
        >
          <Download class="w-3.5 h-3.5 text-slate-700" />
          <span>导出表格</span>
        </button>

        <!-- 独立弹窗模式下的关闭按钮 -->
        <button
          v-if="!isEmbedded"
          @click="emit('close')"
          class="px-2 py-1 hover:bg-rose-600 hover:text-white text-slate-700 transition-colors ml-1 cursor-pointer"
          title="关闭"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- 2. 多级级联筛选栏 (参考深瑞 SCADA 实时库界面布局)                   -->
    <!-- ===================================================================== -->
    <div class="bg-[#ebe4d4] border-b border-[#c8c0ae] px-3 py-1.5 flex items-center flex-wrap gap-2.5 text-xs text-slate-800 font-bold shrink-0 select-none">
      <!-- 厂站选择 -->
      <div class="flex items-center gap-1.5">
        <span class="text-slate-700">厂站:</span>
        <select 
          v-model="selectedFacName"
          class="bg-white border border-[#b8af9c] px-2 py-0.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-sky-600 rounded-none cursor-pointer"
        >
          <option value="all">所有厂站</option>
          <option v-for="fac in availableFacilities" :key="fac" :value="fac">{{ fac }}</option>
        </select>
      </div>

      <!-- 间隔选择 -->
      <div class="flex items-center gap-1.5">
        <span class="text-slate-700">间隔:</span>
        <select 
          v-model="selectedBayName"
          class="bg-white border border-[#b8af9c] px-2 py-0.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-sky-600 rounded-none cursor-pointer"
        >
          <option value="all">所有间隔</option>
          <option v-for="bay in availableBays" :key="bay" :value="bay">{{ bay }}</option>
        </select>
      </div>

      <!-- 设备选择 -->
      <div class="flex items-center gap-1.5">
        <span class="text-slate-700">设备:</span>
        <select 
          v-model="selectedDevName"
          class="bg-white border border-[#b8af9c] px-2 py-0.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-sky-600 rounded-none cursor-pointer"
        >
          <option value="all">所有设备</option>
          <option v-for="dev in availableDevices" :key="dev" :value="dev">{{ dev }}</option>
        </select>
      </div>

      <!-- 间隔名称过滤 (文本输入) -->
      <div class="flex items-center gap-1">
        <span class="text-slate-700">间隔名称过滤:</span>
        <div class="relative">
          <input 
            type="text"
            v-model="baySearchText"
            placeholder="过滤间隔..."
            class="w-32 bg-white border border-[#b8af9c] px-2 py-0.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-sky-600 rounded-none"
          />
          <button 
            v-if="baySearchText"
            @click="baySearchText = ''"
            class="absolute right-1 top-0.5 text-slate-400 hover:text-slate-700"
          >
            <X class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- 信号名称过滤 (文本输入) -->
      <div class="flex items-center gap-1">
        <span class="text-slate-700">信号名称过滤:</span>
        <div class="relative">
          <input 
            type="text"
            v-model="signalSearchText"
            placeholder="搜索信号/点号..."
            class="w-40 bg-white border border-[#b8af9c] px-2 py-0.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-sky-600 rounded-none"
          />
          <button 
            v-if="signalSearchText"
            @click="signalSearchText = ''"
            class="absolute right-1 top-0.5 text-slate-400 hover:text-slate-700"
          >
            <X class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- 重置条件 -->
      <button
        @click="handleResetFilters"
        class="px-2 py-0.5 bg-[#dfd7c5] hover:bg-[#d4cbba] border border-[#b8af9c] text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
        title="清空并重置所有筛选器条件"
      >
        <RotateCcw class="w-3 h-3 text-slate-700" />
        <span>重置</span>
      </button>

      <!-- 匹配条数提示 -->
      <div class="ml-auto text-xs text-slate-600 font-sans font-bold">
        <span>共 <strong class="text-sky-900 font-mono">{{ filteredPoints.length }}</strong> 条数据</span>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- 3. 核心数据表格 (仅展示用户要求的 10 个核心字段，米白底色，支持列宽拖拽) -->
    <!-- ===================================================================== -->
    <div class="flex-1 flex flex-col min-h-0 bg-white relative overflow-hidden">
      <!-- 表头 (独立同步水平滚动) -->
      <div 
        ref="headerScrollRef"
        class="h-8 bg-[#dfd7c5] border-b border-[#c8c0ae] flex items-center text-xs font-bold text-slate-900 shrink-0 select-none overflow-x-hidden overflow-y-hidden"
      >
        <!-- 序号 -->
        <div 
          :style="{ width: `${colWidths.index}px`, minWidth: `${colWidths.index}px` }"
          class="h-full px-2 border-r border-[#c8c0ae] flex items-center justify-center text-center relative shrink-0"
        >
          <span>序号</span>
          <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sky-600" @mousedown="startColResize('index', $event)" />
        </div>

        <!-- 厂站名称 -->
        <div 
          :style="{ width: `${colWidths.facName}px`, minWidth: `${colWidths.facName}px` }"
          class="h-full px-2 border-r border-[#c8c0ae] flex items-center justify-between relative shrink-0"
        >
          <span>厂站名称</span>
          <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sky-600" @mousedown="startColResize('facName', $event)" />
        </div>

        <!-- 间隔名称 -->
        <div 
          :style="{ width: `${colWidths.bayName}px`, minWidth: `${colWidths.bayName}px` }"
          class="h-full px-2 border-r border-[#c8c0ae] flex items-center justify-between relative shrink-0"
        >
          <span>间隔名称</span>
          <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sky-600" @mousedown="startColResize('bayName', $event)" />
        </div>

        <!-- 设备名称 -->
        <div 
          :style="{ width: `${colWidths.devName}px`, minWidth: `${colWidths.devName}px` }"
          class="h-full px-2 border-r border-[#c8c0ae] flex items-center justify-between relative shrink-0"
        >
          <span>设备名称</span>
          <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sky-600" @mousedown="startColResize('devName', $event)" />
        </div>

        <!-- 装置名称 -->
        <div 
          :style="{ width: `${colWidths.devAlias}px`, minWidth: `${colWidths.devAlias}px` }"
          class="h-full px-2 border-r border-[#c8c0ae] flex items-center justify-between relative shrink-0"
        >
          <span>装置名称</span>
          <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sky-600" @mousedown="startColResize('devAlias', $event)" />
        </div>

        <!-- 信号名称 -->
        <div 
          :style="{ width: `${colWidths.pointName}px`, minWidth: `${colWidths.pointName}px` }"
          class="h-full px-2 border-r border-[#c8c0ae] flex items-center justify-between relative shrink-0"
        >
          <span>信号名称</span>
          <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sky-600" @mousedown="startColResize('pointName', $event)" />
        </div>

        <!-- 实际测量值 -->
        <div 
          :style="{ width: `${colWidths.val}px`, minWidth: `${colWidths.val}px` }"
          class="h-full px-2 border-r border-[#c8c0ae] flex items-center justify-end text-right relative shrink-0 bg-[#e4dcce]"
        >
          <span class="text-sky-900 font-bold">实际测量值</span>
          <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sky-600" @mousedown="startColResize('val', $event)" />
        </div>

        <!-- 状态字 -->
        <div 
          :style="{ width: `${colWidths.status}px`, minWidth: `${colWidths.status}px` }"
          class="h-full px-2 border-r border-[#c8c0ae] flex items-center justify-center text-center relative shrink-0"
        >
          <span>状态字</span>
          <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sky-600" @mousedown="startColResize('status', $event)" />
        </div>

        <!-- 全表序号 -->
        <div 
          :style="{ width: `${colWidths.pointId}px`, minWidth: `${colWidths.pointId}px` }"
          class="h-full px-2 border-r border-[#c8c0ae] flex items-center justify-center text-center relative shrink-0"
        >
          <span>全表序号</span>
          <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sky-600" @mousedown="startColResize('pointId', $event)" />
        </div>

        <!-- 品质 -->
        <div 
          :style="{ width: `${colWidths.quality}px`, minWidth: `${colWidths.quality}px` }"
          class="h-full px-2 flex items-center justify-center text-center relative shrink-0"
        >
          <span>品质</span>
        </div>
      </div>

      <!-- 表体数据行 (支持虚拟视口高帧率滚动) -->
      <div 
        ref="tableContainerRef"
        @scroll="onTableScroll"
        class="flex-1 overflow-auto bg-white select-text font-mono text-xs"
      >
        <div 
          v-if="filteredPoints.length > 0"
          :style="{ height: `${filteredPoints.length * rowHeight}px`, position: 'relative' }"
          class="min-w-max"
        >
          <div 
            :style="{ transform: `translateY(${startIndex * rowHeight}px)` }"
            class="absolute left-0 top-0 w-full"
          >
            <div 
              v-for="(item, idx) in visibleRows"
              :key="item.id"
              :style="{ height: `${rowHeight}px` }"
              class="flex items-center border-b border-slate-200 transition-colors text-slate-800"
              :class="[
                (startIndex + idx) % 2 === 0 ? 'bg-white' : 'bg-[#faf8f5]',
                'hover:bg-[#eaf2f8]'
              ]"
            >
              <!-- 序号 -->
              <div 
                :style="{ width: `${colWidths.index}px`, minWidth: `${colWidths.index}px` }"
                class="px-2 border-r border-slate-200 text-center text-slate-500 font-sans shrink-0 truncate"
              >
                {{ startIndex + idx + 1 }}
              </div>

              <!-- 厂站名称 -->
              <div 
                :style="{ width: `${colWidths.facName}px`, minWidth: `${colWidths.facName}px` }"
                class="px-2 border-r border-slate-200 truncate font-sans shrink-0 text-slate-800"
                :title="item.facName"
              >
                {{ item.facName }}
              </div>

              <!-- 间隔名称 -->
              <div 
                :style="{ width: `${colWidths.bayName}px`, minWidth: `${colWidths.bayName}px` }"
                class="px-2 border-r border-slate-200 truncate font-sans shrink-0 text-slate-800"
                :title="item.bayName"
              >
                {{ item.bayName }}
              </div>

              <!-- 设备名称 -->
              <div 
                :style="{ width: `${colWidths.devName}px`, minWidth: `${colWidths.devName}px` }"
                class="px-2 border-r border-slate-200 truncate font-sans font-bold shrink-0 text-slate-900"
                :title="item.devName"
              >
                {{ item.devName }}
              </div>

              <!-- 装置名称 -->
              <div 
                :style="{ width: `${colWidths.devAlias}px`, minWidth: `${colWidths.devAlias}px` }"
                class="px-2 border-r border-slate-200 truncate font-sans shrink-0 text-slate-600"
                :title="item.devAlias"
              >
                {{ item.devAlias }}
              </div>

              <!-- 信号名称 -->
              <div 
                :style="{ width: `${colWidths.pointName}px`, minWidth: `${colWidths.pointName}px` }"
                class="px-2 border-r border-slate-200 truncate font-sans font-bold shrink-0 text-slate-900"
                :title="`${item.pointName} (${item.pointAlias})`"
              >
                {{ item.pointName }}
              </div>

              <!-- 实际测量值 -->
              <div 
                :style="{ width: `${colWidths.val}px`, minWidth: `${colWidths.val}px` }"
                class="px-2 border-r border-slate-200 text-right shrink-0 font-bold"
                :class="{
                  'text-blue-700': item.category === 'yc',
                  'text-emerald-700': item.category === 'yx' && item.val === 1,
                  'text-amber-700': item.category === 'yx' && item.val === 0,
                  'text-purple-700': item.category === 'dd'
                }"
              >
                <span v-if="item.category === 'yx'">
                  {{ item.val === 1 ? '1 [合闸]' : '0 [分闸]' }}
                </span>
                <span v-else>
                  {{ formatDisplayValue(item) }}
                </span>
              </div>

              <!-- 状态字 -->
              <div 
                :style="{ width: `${colWidths.status}px`, minWidth: `${colWidths.status}px` }"
                class="px-2 border-r border-slate-200 text-center shrink-0 font-sans"
              >
                <span 
                  class="text-xs font-bold"
                  :class="{
                    'text-emerald-700': item.status === 0 || item.status === 7,
                    'text-amber-700': item.status === 8,
                    'text-rose-600': item.status >= 8 && item.category === 'yc'
                  }"
                >
                  {{ item.statusName }}
                </span>
              </div>

              <!-- 全表序号 -->
              <div 
                :style="{ width: `${colWidths.pointId}px`, minWidth: `${colWidths.pointId}px` }"
                class="px-2 border-r border-slate-200 text-center shrink-0 text-slate-700 font-mono"
              >
                {{ item.id }}
              </div>

              <!-- 品质 -->
              <div 
                :style="{ width: `${colWidths.quality}px`, minWidth: `${colWidths.quality}px` }"
                class="px-2 text-center shrink-0 font-sans text-xs"
                :class="item.quality === 0 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'"
              >
                {{ item.quality === 0 ? '有效 (0)' : `异常 (${item.quality})` }}
              </div>
            </div>
          </div>
        </div>

        <!-- 空态提示 -->
        <div v-else class="h-64 flex flex-col items-center justify-center text-slate-400 gap-2 font-sans">
          <AlertTriangle class="w-8 h-8 text-amber-500" />
          <span class="text-sm font-bold text-slate-600">未检索到匹配的测点数据</span>
          <span class="text-xs text-slate-400">请切换遥测/遥信/电度分类或调整筛选条件后重试</span>
        </div>
      </div>
    </div>
  </div>
</template>
