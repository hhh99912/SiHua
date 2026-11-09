<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  History,
  Search,
  Download,
  Printer,
  Calendar,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  X,
  Copy,
  ArrowDownCircle
} from 'lucide-vue-next';
import {
  scadaFacilities,
  fetchScadaConfig,
  fetchScadaWarnTreeMeta,
  queryScadaWarnHistory,
  ScadaHistoryWarnItem,
  ScadaWarnTreeMetaLevel,
  ScadaWarnTreeMetaType,
  SCADA_HISTORY_LEVEL_DICT,
  SCADA_HISTORY_TABLE_DICT
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
// 1. 表格列宽拖动调整 (参考实时告警界面，杜绝行宽抖动)
// ============================================================================
interface HistoryColWidthMap {
  index: number;
  time: number;
  msec: number;
  tableName: number;
  level: number;
  content: number;
}

const DEFAULT_COL_WIDTHS: HistoryColWidthMap = {
  index: 60,
  time: 180,
  msec: 80,
  tableName: 140,
  level: 100,
  content: 680
};

const COL_WIDTHS_STORAGE_KEY = 'scada_history_alarm_col_widths_v1';

const loadColWidths = (): HistoryColWidthMap => {
  try {
    const saved = localStorage.getItem(COL_WIDTHS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_COL_WIDTHS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_COL_WIDTHS };
};

const colWidths = ref<HistoryColWidthMap>(loadColWidths());
const isResizingCol = ref(false);
let resizingColKey: keyof HistoryColWidthMap | null = null;
let startResizeX = 0;
let startResizeWidth = 0;

const startColResize = (colKey: keyof HistoryColWidthMap, event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isResizingCol.value = true;
  resizingColKey = colKey;
  startResizeX = event.clientX;
  startResizeWidth = colWidths.value[colKey];

  document.addEventListener('mousemove', onColResizeMove);
  document.addEventListener('mouseup', stopColResize);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

const onColResizeMove = (event: MouseEvent) => {
  if (!isResizingCol.value || !resizingColKey) return;
  const deltaX = event.clientX - startResizeX;
  const minW = resizingColKey === 'index' ? 50 : (resizingColKey === 'content' ? 200 : 60);
  colWidths.value[resizingColKey] = Math.max(minW, startResizeWidth + deltaX);
};

const stopColResize = () => {
  if (!isResizingCol.value) return;
  isResizingCol.value = false;
  resizingColKey = null;
  document.removeEventListener('mousemove', onColResizeMove);
  document.removeEventListener('mouseup', stopColResize);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  try {
    localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(colWidths.value));
  } catch {}
};

const totalTableWidth = computed(() => {
  return (
    colWidths.value.index +
    colWidths.value.time +
    colWidths.value.msec +
    colWidths.value.tableName +
    colWidths.value.level +
    colWidths.value.content
  );
});

// ============================================================================
// 2. 时间区间格式化与默认范围 (默认：3天前 ~ 当前+1天，精确到秒)
// ============================================================================
const formatDateTime = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
};

const parseTimestamp = (dtStr: string): number => {
  if (!dtStr) return 0;
  const normalized = dtStr.trim().replace(' ', 'T');
  const ts = new Date(normalized).getTime();
  return isNaN(ts) ? 0 : Math.floor(ts / 1000);
};

const initNow = new Date();
const initStart = new Date(initNow.getTime() - 3 * 24 * 3600 * 1000);
const initEnd = new Date(initNow.getTime() + 24 * 3600 * 1000);

const startDate = ref(formatDateTime(initStart));
const endDate = ref(formatDateTime(initEnd));

const applyQuickTimeRange = (hours: number) => {
  const n = new Date();
  const s = new Date(n.getTime() - hours * 3600 * 1000);
  startDate.value = formatDateTime(s);
  endDate.value = formatDateTime(n);
};

// ============================================================================
// 3. 元数据字典 (GET /api/scada/warn/tree_meta，过滤掉 308 故障推理结果)
// ============================================================================
const levelOptions = ref<ScadaWarnTreeMetaLevel[]>([...SCADA_HISTORY_LEVEL_DICT]);
const typeOptions = ref<ScadaWarnTreeMetaType[]>([...SCADA_HISTORY_TABLE_DICT]);

const selectedLevelIds = ref<number[]>(SCADA_HISTORY_LEVEL_DICT.map(l => l.id));
const selectedTableNos = ref<number[]>(SCADA_HISTORY_TABLE_DICT.map(t => t.table_no));

const loadTreeMeta = async () => {
  const res = await fetchScadaWarnTreeMeta();
  if (res.success && res.data) {
    if (Array.isArray(res.data.levels) && res.data.levels.length > 0) {
      levelOptions.value = res.data.levels;
      selectedLevelIds.value = res.data.levels.map(l => l.id);
    }
    if (Array.isArray(res.data.types) && res.data.types.length > 0) {
      const presetMap = new Map(SCADA_HISTORY_TABLE_DICT.map(t => [t.table_no, t]));
      typeOptions.value = res.data.types
        .filter(t => Number(t.table_no) !== 308)
        .map(t => ({
          table_no: t.table_no,
          name: t.name,
          group: t.group || presetMap.get(t.table_no)?.group || '其它业务大类'
        }));
      selectedTableNos.value = typeOptions.value.map(t => t.table_no);
    }
  }
};

// ============================================================================
// 4. 电网物理拓扑级联体系 (厂站 -> 间隔 -> 设备，严格“选什么就是什么”)
// ============================================================================
const selectedFacIds = ref<number[]>([]);
const selectedBayIds = ref<number[]>([]);
const selectedDevIds = ref<number[]>([]);

const facilityList = computed(() => {
  return (scadaFacilities.value || []).map(f => ({
    id: Number(f.fac_id ?? f.id),
    name: f.fac_name || f.name || `厂站_${f.id}`,
    bays: f.bays || []
  })).filter(f => !isNaN(f.id));
});

const selectAllTopology = () => {
  selectedFacIds.value = facilityList.value.map(f => f.id);
  selectedBayIds.value = availableBays.value.map(b => b.id);
  selectedDevIds.value = availableDevices.value.map(d => d.id);
};

const availableBays = computed(() => {
  const facs = selectedFacIds.value.length > 0
    ? facilityList.value.filter(f => selectedFacIds.value.includes(f.id))
    : facilityList.value;

  const list: Array<{ id: number; name: string; facName: string; devices: any[] }> = [];
  for (const fac of facs) {
    for (const bay of fac.bays) {
      const bId = Number(bay.bay_id ?? bay.id);
      if (!isNaN(bId)) {
        list.push({
          id: bId,
          name: bay.bay_name || bay.name || `间隔_${bId}`,
          facName: fac.name,
          devices: bay.devices || []
        });
      }
    }
  }
  return list;
});

const availableDevices = computed(() => {
  const bays = selectedBayIds.value.length > 0
    ? availableBays.value.filter(b => selectedBayIds.value.includes(b.id))
    : availableBays.value;

  const list: Array<{ id: number; name: string; bayName: string }> = [];
  for (const bay of bays) {
    for (const dev of bay.devices) {
      const dId = Number(dev.dev_id ?? dev.id);
      if (!isNaN(dId)) {
        list.push({
          id: dId,
          name: dev.dev_name || dev.name || `设备_${dId}`,
          bayName: bay.name
        });
      }
    }
  }
  return list;
});

// 级联联动：厂站变化时，自动清理不属于当前可选间隔的已选间隔
watch(availableBays, (newBays) => {
  if (selectedBayIds.value.length > 0) {
    const validIds = new Set(newBays.map(b => b.id));
    selectedBayIds.value = selectedBayIds.value.filter(id => validIds.has(id));
  }
});

// 级联联动：间隔变化时，自动清理不属于当前可选设备的已选设备
watch(availableDevices, (newDevs) => {
  if (selectedDevIds.value.length > 0) {
    const validIds = new Set(newDevs.map(d => d.id));
    selectedDevIds.value = selectedDevIds.value.filter(id => validIds.has(id));
  }
});

// ============================================================================
// 5. 下拉复选菜单控制 (严格选什么就是什么，取消最后一项保持空数组)
// ============================================================================
type DropdownKey = 'fac' | 'bay' | 'dev' | 'level' | 'type' | null;
const openDropdown = ref<DropdownKey>(null);

const toggleDropdown = (key: DropdownKey) => {
  openDropdown.value = openDropdown.value === key ? null : key;
};

const closeAllDropdowns = () => {
  openDropdown.value = null;
};

const toggleFacId = (id: number) => {
  const idx = selectedFacIds.value.indexOf(id);
  if (idx >= 0) selectedFacIds.value.splice(idx, 1);
  else selectedFacIds.value.push(id);
};

const toggleBayId = (id: number) => {
  const idx = selectedBayIds.value.indexOf(id);
  if (idx >= 0) selectedBayIds.value.splice(idx, 1);
  else selectedBayIds.value.push(id);
};

const toggleDevId = (id: number) => {
  const idx = selectedDevIds.value.indexOf(id);
  if (idx >= 0) selectedDevIds.value.splice(idx, 1);
  else selectedDevIds.value.push(id);
};

const toggleLevelId = (id: number) => {
  const idx = selectedLevelIds.value.indexOf(id);
  if (idx >= 0) selectedLevelIds.value.splice(idx, 1);
  else selectedLevelIds.value.push(id);
};

const toggleTableNo = (no: number) => {
  const idx = selectedTableNos.value.indexOf(no);
  if (idx >= 0) selectedTableNos.value.splice(idx, 1);
  else selectedTableNos.value.push(no);
};

// 厂站多选摘要
const facSummaryText = computed(() => {
  if (selectedFacIds.value.length === 0) return '全部厂站 (未限)';
  if (selectedFacIds.value.length === facilityList.value.length) {
    return `全部厂站 (${facilityList.value.length})`;
  }
  if (selectedFacIds.value.length === 1) {
    return facilityList.value.find(f => f.id === selectedFacIds.value[0])?.name || '已选1个厂站';
  }
  return `已选 ${selectedFacIds.value.length} 个厂站`;
});

// 间隔多选摘要
const baySummaryText = computed(() => {
  if (selectedBayIds.value.length === 0) return '全部间隔 (未限)';
  if (selectedBayIds.value.length === availableBays.value.length) {
    return `全部间隔 (${availableBays.value.length})`;
  }
  if (selectedBayIds.value.length === 1) {
    return availableBays.value.find(b => b.id === selectedBayIds.value[0])?.name || '已选1个间隔';
  }
  return `已选 ${selectedBayIds.value.length} 个间隔`;
});

// 设备多选摘要
const devSummaryText = computed(() => {
  if (selectedDevIds.value.length === 0) return '全部设备 (未限)';
  if (selectedDevIds.value.length === availableDevices.value.length) {
    return `全部设备 (${availableDevices.value.length})`;
  }
  if (selectedDevIds.value.length === 1) {
    return availableDevices.value.find(d => d.id === selectedDevIds.value[0])?.name || '已选1个设备';
  }
  return `已选 ${selectedDevIds.value.length} 个设备`;
});

// 等级多选摘要
const levelSummaryText = computed(() => {
  if (selectedLevelIds.value.length === 0) return '未选等级 (默认全选)';
  if (selectedLevelIds.value.length === levelOptions.value.length) return '全部等级 (3)';
  return levelOptions.value
    .filter(l => selectedLevelIds.value.includes(l.id))
    .map(l => l.name.replace('信息', ''))
    .join(' / ');
});

// 树状类型分组与展开状态
const expandedTypeGroups = ref<Set<string>>(
  new Set(['量测与事件', '继电保护', '遥控与人工操作', '工况与系统审计', '其它业务大类'])
);

const toggleTypeGroupExpand = (groupName: string) => {
  if (expandedTypeGroups.value.has(groupName)) {
    expandedTypeGroups.value.delete(groupName);
  } else {
    expandedTypeGroups.value.add(groupName);
  }
};

const groupedTypeTree = computed(() => {
  const groups = new Map<string, ScadaWarnTreeMetaType[]>();
  for (const t of typeOptions.value) {
    const g = t.group || '其它业务大类';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(t);
  }
  return Array.from(groups.entries()).map(([groupName, items]) => {
    const selectedCount = items.filter(i => selectedTableNos.value.includes(i.table_no)).length;
    return {
      groupName,
      items,
      allSelected: items.length > 0 && selectedCount === items.length,
      partialSelected: selectedCount > 0 && selectedCount < items.length
    };
  });
});

const toggleTypeGroupSelection = (items: ScadaWarnTreeMetaType[], allSelected: boolean) => {
  const itemNos = items.map(i => i.table_no);
  if (allSelected) {
    selectedTableNos.value = selectedTableNos.value.filter(no => !itemNos.includes(no));
  } else {
    const set = new Set([...selectedTableNos.value, ...itemNos]);
    selectedTableNos.value = Array.from(set);
  }
};

const selectAllTypes = () => {
  selectedTableNos.value = typeOptions.value.map(t => t.table_no);
};

const clearAllTypes = () => {
  selectedTableNos.value = [];
};

const typeSummaryText = computed(() => {
  if (selectedTableNos.value.length === 0) return '常规全选 (默认)';
  if (selectedTableNos.value.length === typeOptions.value.length) {
    return `全部类型 (${typeOptions.value.length})`;
  }
  if (selectedTableNos.value.length === 1) {
    const found = typeOptions.value.find(t => t.table_no === selectedTableNos.value[0]);
    return found ? `${found.name} (${found.table_no})` : `表号 ${selectedTableNos.value[0]}`;
  }
  return `已选 ${selectedTableNos.value.length}/${typeOptions.value.length} 类`;
});

// ============================================================================
// 6. 核心查询与【继续查询】逻辑 (POST /api/scada/warn/history)
// ============================================================================
const searchText = ref('');
const currentPage = ref<number>(1);
const pageSize = ref<number>(200);
const totalPages = ref<number>(1);
const jumpPageInput = ref<string>('1');
const isSearching = ref(false);
const isContinuing = ref(false);
const historyRecords = ref<ScadaHistoryWarnItem[]>([]);
const totalRecords = ref(0);
const hasSearched = ref(false);

const buildQueryPayload = (targetPage = currentPage.value) => {
  const startSec = parseTimestamp(startDate.value);
  const endSec = parseTimestamp(endDate.value) || Math.floor(Date.now() / 1000);

  const facIdsPayload =
    selectedFacIds.value.length === facilityList.value.length ? [] : [...selectedFacIds.value];
  const bayIdsPayload =
    selectedBayIds.value.length === availableBays.value.length ? [] : [...selectedBayIds.value];
  const devIdsPayload =
    selectedDevIds.value.length === availableDevices.value.length ? [] : [...selectedDevIds.value];
  const levelIdsPayload =
    selectedLevelIds.value.length === levelOptions.value.length ? [] : [...selectedLevelIds.value];
  const tableNosPayload =
    selectedTableNos.value.length === typeOptions.value.length ? [] : [...selectedTableNos.value];

  return {
    start_time: startSec > 0 ? startSec : undefined,
    end_time: endSec > 0 ? endSec : undefined,
    search_type: 0,
    page: targetPage,
    page_size: pageSize.value,
    fac_ids: facIdsPayload,
    bay_ids: bayIdsPayload,
    dev_ids: devIdsPayload,
    level_ids: levelIdsPayload,
    table_nos: tableNosPayload,
    keyword: searchText.value.trim()
  };
};

// 【查询】
const executeHistorySearch = async (targetPage = 1) => {
  if (isSearching.value) return;
  isSearching.value = true;
  hasSearched.value = true;
  closeAllDropdowns();

  const safeTargetPage = Math.max(1, targetPage);

  try {
    const payload = buildQueryPayload(safeTargetPage);
    const res = await queryScadaWarnHistory(payload);
    if (res.success && res.data) {
      const resPage = res.page ?? safeTargetPage;
      const resPageSize = res.page_size ?? pageSize.value;
      const total = res.total ?? res.data.length;
      const calcTotalPages = res.total_pages ?? Math.max(1, Math.ceil(total / Math.max(1, resPageSize)));

      currentPage.value = resPage;
      totalPages.value = calcTotalPages;
      jumpPageInput.value = String(resPage);
      totalRecords.value = total;

      historyRecords.value = res.data.map((item, idx) => ({
        ...item,
        index: item.index ?? (resPage - 1) * resPageSize + idx + 1
      }));

      scrollTop.value = 0;
      if (tableContainerRef.value) {
        tableContainerRef.value.scrollTop = 0;
      }
    }
  } catch {
    // ignore
  } finally {
    isSearching.value = false;
  }
};

// 【继续查询】：加载下一页历史告警记录
const executeContinueSearch = async () => {
  if (isSearching.value || isContinuing.value) return;
  if (historyRecords.value.length === 0) {
    await executeHistorySearch(1);
    return;
  }
  if (currentPage.value >= totalPages.value) {
    return;
  }
  await executeHistorySearch(currentPage.value + 1);
};

const handleJumpPage = () => {
  const parsed = parseInt(jumpPageInput.value, 10);
  if (isNaN(parsed)) {
    jumpPageInput.value = String(currentPage.value);
    return;
  }
  const clamped = Math.min(Math.max(1, parsed), totalPages.value);
  executeHistorySearch(clamped);
};

// 重置筛选条件
const handleReset = () => {
  const n = new Date();
  const s = new Date(n.getTime() - 3 * 24 * 3600 * 1000);
  const e = new Date(n.getTime() + 24 * 3600 * 1000);
  startDate.value = formatDateTime(s);
  endDate.value = formatDateTime(e);
  selectAllTopology();
  selectedLevelIds.value = levelOptions.value.map(l => l.id);
  selectedTableNos.value = typeOptions.value.map(t => t.table_no);
  searchText.value = '';
  executeHistorySearch(1);
};

// ============================================================================
// 7. 等级颜色与样式解析 (严格对齐 SCADA 规范)
//    事故信息 (Level 3): 红底/红字 #FF0000
//    告警信息 (Level 2): 黄底/橙黄字 #E6A23C
//    提示信息 (Level 1): 绿底/白字 #67C23A
// ============================================================================
const resolveLevelInfo = (item: ScadaHistoryWarnItem) => {
  const lvl = item.level ?? (
    (item.level_name && item.level_name.includes('事故')) || item.table_no === 362 || item.table_no === 55
      ? 3
      : ((item.level_name && item.level_name.includes('告警')) || item.table_no === 44 ? 2 : 1)
  );

  if (lvl === 3) {
    return {
      level: 3,
      name: item.level_name || '事故信息',
      color: item.level_color || '#FF0000',
      badgeStyle: {
        backgroundColor: '#FFE5E5',
        color: '#FF0000',
        borderColor: '#FF0000'
      },
      rowClass: 'bg-[#FFF5F5] hover:bg-[#FFE8E8] text-slate-900',
      contentClass: 'text-[#CC0000] font-bold'
    };
  }
  if (lvl === 2) {
    return {
      level: 2,
      name: item.level_name || '告警信息',
      color: item.level_color || '#E6A23C',
      badgeStyle: {
        backgroundColor: '#FDF6EC',
        color: '#E6A23C',
        borderColor: '#E6A23C'
      },
      rowClass: 'bg-[#FFFDF6] hover:bg-[#FDF5E2] text-slate-900',
      contentClass: 'text-[#B87A14] font-semibold'
    };
  }
  return {
    level: 1,
    name: item.level_name || '提示信息',
    color: item.level_color || '#67C23A',
    badgeStyle: {
      backgroundColor: '#67C23A',
      color: '#FFFFFF',
      borderColor: '#529B2E'
    },
    rowClass: 'bg-white hover:bg-slate-100 text-slate-900',
    contentClass: 'text-slate-900 font-medium'
  };
};

const formatOperatorHost = (item: ScadaHistoryWarnItem): string => {
  const op = (item.operator || '').trim();
  const host = (item.host || '').trim();
  if (op && host) return `${op} / ${host}`;
  if (op) return op;
  if (host) return host;
  return '--';
};

// ============================================================================
// 8. 右键菜单、导出与打印
// ============================================================================
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuItem = ref<ScadaHistoryWarnItem | null>(null);

const handleRowContextMenu = (e: MouseEvent, item: ScadaHistoryWarnItem) => {
  e.preventDefault();
  contextMenuItem.value = item;
  contextMenuX.value = Math.min(window.innerWidth - 220, e.clientX);
  contextMenuY.value = Math.min(window.innerHeight - 130, e.clientY);
  contextMenuVisible.value = true;
};

const closeContextMenu = () => {
  contextMenuVisible.value = false;
};

const copyText = (text?: string) => {
  closeContextMenu();
  if (text && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
};

const handleExportCsv = () => {
  const headers = ['序号', '时间', '毫秒数', '表名', '等级', '告警内容', '操作员/机器', '测点别名'];
  const rows = historyRecords.value.map((item, idx) => {
    const lvl = resolveLevelInfo(item);
    return [
      item.index ?? idx + 1,
      item.time,
      item.msec ?? 0,
      item.table_name,
      lvl.name,
      `"${(item.content || '').replace(/"/g, '""')}"`,
      `"${formatOperatorHost(item).replace(/"/g, '""')}"`,
      item.alias || ''
    ];
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `SCADA_历史告警_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const handlePrint = () => {
  window.print();
};

// ============================================================================
// 9. 虚拟视口滚动计算 (GPU合成 translate3d + 固定表头，杜绝凝思 Electron 行高抖动与白屏页)
// ============================================================================
const ROW_HEIGHT = 34;
const OVERSCAN = 45;
const headerRef = ref<HTMLDivElement | null>(null);
const tableContainerRef = ref<HTMLDivElement | null>(null);
const scrollTop = ref(0);
const containerHeight = ref(650);

const startIndex = computed(() => {
  const raw = Math.floor(scrollTop.value / ROW_HEIGHT);
  return Math.max(0, raw - OVERSCAN);
});

const endIndex = computed(() => {
  const raw = Math.floor(scrollTop.value / ROW_HEIGHT);
  const visibleCount = Math.ceil(containerHeight.value / ROW_HEIGHT);
  return Math.min(historyRecords.value.length, raw + visibleCount + OVERSCAN);
});

const visibleHistoryRecords = computed(() => {
  return historyRecords.value.slice(startIndex.value, endIndex.value);
});

const onTableScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (!target) return;
  scrollTop.value = target.scrollTop;
  if (headerRef.value) {
    headerRef.value.scrollLeft = target.scrollLeft;
  }
};

const updateContainerHeight = () => {
  if (tableContainerRef.value) {
    containerHeight.value = tableContainerRef.value.clientHeight || 650;
  }
};

const handleGlobalClick = () => {
  closeContextMenu();
  closeAllDropdowns();
};

onMounted(async () => {
  window.addEventListener('click', handleGlobalClick);
  window.addEventListener('resize', updateContainerHeight);
  updateContainerHeight();
  if ((scadaFacilities.value?.length || 0) <= 1) {
    await fetchScadaConfig().catch(() => {});
  }
  selectAllTopology();
  await loadTreeMeta();
  updateContainerHeight();
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleGlobalClick);
  window.removeEventListener('resize', updateContainerHeight);
  document.removeEventListener('mousemove', onColResizeMove);
  document.removeEventListener('mouseup', stopColResize);
});
</script>

<template>
  <div
    v-if="visible"
    :class="[
      isEmbedded
        ? 'w-full h-full bg-[#f5f2eb] text-slate-900 flex flex-col font-sans select-none overflow-hidden text-[14px]'
        : 'fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex flex-col select-none p-1 md:p-2 text-[14px]'
    ]"
  >
    <div class="w-full h-full bg-white text-slate-900 flex flex-col font-sans select-none overflow-hidden border border-[#b8ad96]">
      <!-- 非嵌入模式下的顶部标题栏 -->
      <div
        v-if="!isEmbedded"
        class="h-10 bg-[#ebe4d4] border-b border-[#cfc5b0] px-3.5 flex items-center justify-between shrink-0 select-none"
      >
        <div class="flex items-center gap-2 font-bold text-slate-900 text-[15px]">
          <History class="w-4.5 h-4.5 text-orange-600" />
          <span>SCADA 历史告警综合检索中心</span>
        </div>
        <button
          @click="emit('close')"
          class="p-1 rounded hover:bg-[#dfd6bf] text-slate-700 hover:text-slate-900 cursor-pointer"
          title="关闭历史告警窗"
        >
          <X class="w-4.5 h-4.5" />
        </button>
      </div>

      <!-- ===================================================================== -->
      <!-- 1. 顶部多维级联筛选面板 (对齐南瑞 / 深瑞 SCADA 历史告警工具条)           -->
      <!-- ===================================================================== -->
      <div class="bg-[#ebe4d4] border-b border-[#cfc5b0] px-3 py-2 flex flex-col gap-2 shrink-0 select-none z-30">
        <!-- 第一行：时间区间选择 + 拓扑三级级联 (厂站 -> 间隔 -> 设备) -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- 时间区间选择 (精确到秒) -->
          <div class="flex items-center gap-1.5 bg-white border border-[#b8ad96] px-2 h-8 shrink-0">
            <Calendar class="w-4 h-4 text-sky-700 shrink-0" />
            <span class="text-[13px] font-medium text-slate-700">时间:</span>
            <input
              v-model="startDate"
              class="w-[152px] font-mono text-[13px] font-medium text-slate-900 focus:outline-none bg-transparent"
              placeholder="YYYY-MM-DD HH:mm:ss"
              title="开始时间 (精确到秒)"
            />
            <span class="text-slate-400 font-medium">至</span>
            <input
              v-model="endDate"
              class="w-[152px] font-mono text-[13px] font-medium text-slate-900 focus:outline-none bg-transparent"
              placeholder="YYYY-MM-DD HH:mm:ss"
              title="结束时间 (精确到秒)"
            />
            <div class="flex items-center gap-1 border-l border-slate-200 pl-1.5 ml-0.5">
              <button
                @click="applyQuickTimeRange(1)"
                class="px-1.5 py-0.5 text-[11.5px] font-medium bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#cfc5b0] text-slate-700 cursor-pointer"
              >
                1小时
              </button>
              <button
                @click="applyQuickTimeRange(24)"
                class="px-1.5 py-0.5 text-[11.5px] font-medium bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#cfc5b0] text-slate-700 cursor-pointer"
              >
                24小时
              </button>
              <button
                @click="applyQuickTimeRange(72)"
                class="px-1.5 py-0.5 text-[11.5px] font-medium bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#cfc5b0] text-slate-700 cursor-pointer"
              >
                近3天
              </button>
            </div>
          </div>

          <!-- 1. 选择厂站 (下拉多选，联动间隔，选什么就是什么) -->
          <div class="relative" @click.stop>
            <button
              @click="toggleDropdown('fac')"
              class="h-8 px-2.5 bg-white hover:bg-slate-50 border border-[#b8ad96] flex items-center gap-1.5 text-[13px] font-medium text-slate-900 cursor-pointer min-w-[150px] justify-between"
              :class="{ 'ring-1 ring-sky-600 border-sky-600': openDropdown === 'fac' }"
            >
              <span class="truncate"><span class="text-slate-500 mr-1">厂站:</span>{{ facSummaryText }}</span>
              <ChevronDown class="w-4 h-4 text-slate-500 shrink-0" />
            </button>

            <div
              v-if="openDropdown === 'fac'"
              class="absolute left-0 top-full mt-1 w-64 bg-white border-2 border-slate-600 shadow-2xl z-50 flex flex-col max-h-72"
            >
              <div class="px-2.5 py-1.5 bg-[#ebe4d4] border-b border-[#cfc5b0] flex items-center justify-between text-[12px] font-bold">
                <span>选择厂站</span>
                <div class="flex items-center gap-2">
                  <button @click="selectedFacIds = facilityList.map(f => f.id)" class="text-sky-700 hover:underline cursor-pointer">全选</button>
                  <button @click="selectedFacIds = []" class="text-rose-600 hover:underline cursor-pointer">全消</button>
                </div>
              </div>
              <div class="overflow-y-auto p-1 divide-y divide-slate-100">
                <label
                  v-for="fac in facilityList"
                  :key="fac.id"
                  class="flex items-center gap-2 px-2 py-1.5 hover:bg-sky-50 cursor-pointer text-[13px] font-bold"
                >
                  <input
                    type="checkbox"
                    :checked="selectedFacIds.includes(fac.id)"
                    @change="toggleFacId(fac.id)"
                    class="w-4 h-4 accent-sky-700 cursor-pointer"
                  />
                  <span class="truncate">{{ fac.name }}</span>
                </label>
                <div v-if="facilityList.length === 0" class="py-4 text-center text-slate-400 text-xs">暂无厂站数据</div>
              </div>
            </div>
          </div>

          <!-- 2. 选择间隔 (下拉多选，受厂站联动，联动设备) -->
          <div class="relative" @click.stop>
            <button
              @click="toggleDropdown('bay')"
              class="h-8 px-2.5 bg-white hover:bg-slate-50 border border-[#b8ad96] flex items-center gap-1.5 text-[13px] font-medium text-slate-900 cursor-pointer min-w-[160px] justify-between"
              :class="{ 'ring-1 ring-sky-600 border-sky-600': openDropdown === 'bay' }"
            >
              <span class="truncate"><span class="text-slate-500 mr-1">间隔:</span>{{ baySummaryText }}</span>
              <ChevronDown class="w-4 h-4 text-slate-500 shrink-0" />
            </button>

            <div
              v-if="openDropdown === 'bay'"
              class="absolute left-0 top-full mt-1 w-72 bg-white border-2 border-slate-600 shadow-2xl z-50 flex flex-col max-h-72"
            >
              <div class="px-2.5 py-1.5 bg-[#ebe4d4] border-b border-[#cfc5b0] flex items-center justify-between text-[12px] font-medium">
                <span>选择间隔 (已联动厂站)</span>
                <div class="flex items-center gap-2">
                  <button @click="selectedBayIds = availableBays.map(b => b.id)" class="text-sky-700 hover:underline cursor-pointer">全选</button>
                  <button @click="selectedBayIds = []" class="text-rose-600 hover:underline cursor-pointer">全消</button>
                </div>
              </div>
              <div class="overflow-y-auto p-1 divide-y divide-slate-100">
                <label
                  v-for="bay in availableBays"
                  :key="bay.id"
                  class="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-sky-50 cursor-pointer text-[13px] font-medium"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      :checked="selectedBayIds.includes(bay.id)"
                      @change="toggleBayId(bay.id)"
                      class="w-4 h-4 accent-sky-700 cursor-pointer shrink-0"
                    />
                    <span class="truncate">{{ bay.name }}</span>
                  </div>
                  <span class="text-[11px] text-slate-400 shrink-0">{{ bay.facName }}</span>
                </label>
                <div v-if="availableBays.length === 0" class="py-4 text-center text-slate-400 text-xs">当前厂站下无间隔</div>
              </div>
            </div>
          </div>

          <!-- 3. 选择设备 (下拉多选，受间隔联动) -->
          <div class="relative" @click.stop>
            <button
              @click="toggleDropdown('dev')"
              class="h-8 px-2.5 bg-white hover:bg-slate-50 border border-[#b8ad96] flex items-center gap-1.5 text-[13px] font-medium text-slate-900 cursor-pointer min-w-[160px] justify-between"
              :class="{ 'ring-1 ring-sky-600 border-sky-600': openDropdown === 'dev' }"
            >
              <span class="truncate"><span class="text-slate-500 mr-1">设备:</span>{{ devSummaryText }}</span>
              <ChevronDown class="w-4 h-4 text-slate-500 shrink-0" />
            </button>

            <div
              v-if="openDropdown === 'dev'"
              class="absolute left-0 top-full mt-1 w-72 bg-white border-2 border-slate-600 shadow-2xl z-50 flex flex-col max-h-72"
            >
              <div class="px-2.5 py-1.5 bg-[#ebe4d4] border-b border-[#cfc5b0] flex items-center justify-between text-[12px] font-medium">
                <span>选择设备 (已联动间隔)</span>
                <div class="flex items-center gap-2">
                  <button @click="selectedDevIds = availableDevices.map(d => d.id)" class="text-sky-700 hover:underline cursor-pointer">全选</button>
                  <button @click="selectedDevIds = []" class="text-rose-600 hover:underline cursor-pointer">全消</button>
                </div>
              </div>
              <div class="overflow-y-auto p-1 divide-y divide-slate-100">
                <label
                  v-for="dev in availableDevices"
                  :key="dev.id"
                  class="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-sky-50 cursor-pointer text-[13px] font-medium"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      :checked="selectedDevIds.includes(dev.id)"
                      @change="toggleDevId(dev.id)"
                      class="w-4 h-4 accent-sky-700 cursor-pointer shrink-0"
                    />
                    <span class="truncate">{{ dev.name }}</span>
                  </div>
                  <span class="text-[11px] text-slate-400 shrink-0">{{ dev.bayName }}</span>
                </label>
                <div v-if="availableDevices.length === 0" class="py-4 text-center text-slate-400 text-xs">当前间隔下无设备</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 第二行：选择等级复选下拉 + 选择类型树状复选下拉 + 关键字 + 【查询】/【继续查询】/导出打印 -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <!-- 4. 选择等级 (复选框下拉菜单：提示信息 / 告警信息 / 事故信息) -->
            <div class="relative" @click.stop>
              <button
                @click="toggleDropdown('level')"
                class="h-8 px-2.5 bg-white hover:bg-slate-50 border border-[#b8ad96] flex items-center gap-1.5 text-[13px] font-normal text-slate-900 cursor-pointer min-w-[170px] justify-between"
                :class="{ 'ring-1 ring-sky-600 border-sky-600': openDropdown === 'level' }"
              >
                <span class="truncate"><span class="text-slate-500 mr-1">等级:</span>{{ levelSummaryText }}</span>
                <ChevronDown class="w-4 h-4 text-slate-500 shrink-0" />
              </button>

              <div
                v-if="openDropdown === 'level'"
                class="absolute left-0 top-full mt-1 w-56 bg-white border-2 border-slate-600 shadow-2xl z-50 flex flex-col"
              >
                <div class="px-2.5 py-1.5 bg-[#ebe4d4] border-b border-[#cfc5b0] flex items-center justify-between text-[12px] font-normal">
                  <span>选择告警严重等级</span>
                  <div class="flex items-center gap-2">
                    <button
                      @click="selectedLevelIds = levelOptions.map(l => l.id)"
                      class="text-sky-700 hover:underline cursor-pointer"
                    >
                      全选
                    </button>
                    <button
                      @click="selectedLevelIds = []"
                      class="text-rose-600 hover:underline cursor-pointer"
                    >
                      全消
                    </button>
                  </div>
                </div>
                <div class="p-1.5 flex flex-col gap-0.5">
                  <label
                    v-for="lvl in levelOptions"
                    :key="lvl.id"
                    class="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 cursor-pointer text-[13px] font-normal text-slate-800"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedLevelIds.includes(lvl.id)"
                      @change="toggleLevelId(lvl.id)"
                      class="w-4 h-4 accent-sky-700 cursor-pointer"
                    />
                    <span>{{ lvl.name }}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- 5. 选择类型 (树状复选框下拉菜单，列出 18 个业务大类，支持全选/全消) -->
            <div class="relative" @click.stop>
              <button
                @click="toggleDropdown('type')"
                class="h-8 px-2.5 bg-white hover:bg-slate-50 border border-[#b8ad96] flex items-center gap-1.5 text-[13px] font-medium text-slate-900 cursor-pointer min-w-[185px] justify-between"
                :class="{ 'ring-1 ring-sky-600 border-sky-600': openDropdown === 'type' }"
              >
                <span class="truncate"><span class="text-slate-500 mr-1">类型:</span>{{ typeSummaryText }}</span>
                <ChevronDown class="w-4 h-4 text-slate-500 shrink-0" />
              </button>

              <div
                v-if="openDropdown === 'type'"
                class="absolute left-0 top-full mt-1 w-80 bg-white border-2 border-slate-600 shadow-2xl z-50 flex flex-col max-h-[420px]"
              >
                <div class="px-2.5 py-1.5 bg-[#ebe4d4] border-b border-[#cfc5b0] flex items-center justify-between text-[12px] font-medium shrink-0">
                  <span>选择业务大类</span>
                  <div class="flex items-center gap-2">
                    <button @click="selectAllTypes" class="text-sky-700 hover:underline cursor-pointer">全选</button>
                    <button @click="clearAllTypes" class="text-rose-600 hover:underline cursor-pointer">全消</button>
                  </div>
                </div>

                <!-- 树状复选列表 -->
                <div class="overflow-y-auto p-1.5 space-y-1">
                  <div
                    v-for="grp in groupedTypeTree"
                    :key="grp.groupName"
                    class="border border-slate-200 bg-slate-50/60"
                  >
                    <!-- 父节点：业务分组 -->
                    <div class="flex items-center justify-between px-2 py-1 bg-[#f2eee3] hover:bg-[#e8e1d1] text-[12.5px] font-medium text-slate-800">
                      <div class="flex items-center gap-1.5">
                        <button
                          @click="toggleTypeGroupExpand(grp.groupName)"
                          class="p-0.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          <ChevronDown v-if="expandedTypeGroups.has(grp.groupName)" class="w-3.5 h-3.5" />
                          <ChevronRight v-else class="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="checkbox"
                          :checked="grp.allSelected"
                          :indeterminate="grp.partialSelected"
                          @change="toggleTypeGroupSelection(grp.items, grp.allSelected)"
                          class="w-3.5 h-3.5 accent-sky-700 cursor-pointer"
                        />
                        <span @click="toggleTypeGroupExpand(grp.groupName)" class="cursor-pointer">{{ grp.groupName }}</span>
                      </div>
                      <span class="text-[11px] text-slate-500 font-mono">
                        {{ grp.items.filter(i => selectedTableNos.includes(i.table_no)).length }}/{{ grp.items.length }}
                      </span>
                    </div>

                    <!-- 子节点：具体物理子表 -->
                    <div
                      v-if="expandedTypeGroups.has(grp.groupName)"
                      class="pl-6 pr-2 py-1 space-y-0.5 bg-white"
                    >
                      <div
                        v-for="item in grp.items"
                        :key="item.table_no"
                        class="flex items-center justify-between py-1 hover:bg-sky-50 px-1.5 text-[13px] font-medium"
                      >
                        <label class="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            :checked="selectedTableNos.includes(item.table_no)"
                            @change="toggleTableNo(item.table_no)"
                            class="w-3.5 h-3.5 accent-sky-700 cursor-pointer shrink-0"
                          />
                          <span class="truncate">{{ item.name }}</span>
                          <span class="text-[11px] text-slate-400 font-mono shrink-0">({{ item.table_no }})</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 6. 模糊检索关键字 -->
            <div class="relative">
              <input
                v-model="searchText"
                @keyup.enter="executeHistorySearch(1)"
                placeholder="关键字 (如 yx10 / 断路器 / 遥控)..."
                class="h-8 w-56 pl-7 pr-2 bg-white border border-[#b8ad96] text-[13px] font-medium text-slate-900 focus:outline-none focus:border-sky-700"
              />
              <Search class="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <!-- 右侧：核心按钮组 【查询】、【继续查询】 + 重置 / 导出 / 打印 -->
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              @click="executeHistorySearch(1)"
              :disabled="isSearching"
              class="h-8 px-3.5 bg-sky-700 hover:bg-sky-800 active:bg-sky-900 border border-sky-950 text-white text-[13.5px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              title="按当前条件发起历史告警查询 (POST /api/scada/warn/history)"
            >
              <Search class="w-4 h-4" :class="{ 'animate-spin': isSearching }" />
              <span>{{ isSearching ? '查询中...' : '查询' }}</span>
            </button>

            <button
              @click="executeContinueSearch"
              :disabled="isSearching || isContinuing"
              class="h-8 px-3 bg-[#f2eee3] hover:bg-[#e4dcce] active:bg-[#d8ceb8] border border-[#8c826d] text-slate-900 text-[13.5px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              title="从当前已加载的最早记录时间点继续向更早时间查询"
            >
              <ArrowDownCircle class="w-4 h-4 text-sky-700" :class="{ 'animate-bounce': isContinuing }" />
              <span>{{ isContinuing ? '加载中...' : '继续查询' }}</span>
            </button>

            <div class="h-5 w-[1px] bg-[#cfc5b0] mx-0.5" />

            <button
              @click="handleReset"
              class="h-8 px-2.5 bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#b8ad96] text-slate-800 text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-1"
              title="重置所有筛选条件"
            >
              <RotateCcw class="w-3.5 h-3.5 text-slate-700" />
              <span>重置</span>
            </button>

            <button
              @click="handleExportCsv"
              class="h-8 px-2.5 bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#b8ad96] text-slate-800 text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-1"
              title="导出当前结果到 CSV 文件"
            >
              <Download class="w-3.5 h-3.5 text-slate-700" />
              <span>导出</span>
            </button>

            <button
              @click="handlePrint"
              class="h-8 px-2.5 bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#b8ad96] text-slate-800 text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-1"
              title="打印历史告警列表"
            >
              <Printer class="w-3.5 h-3.5 text-slate-700" />
              <span>打印</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- 2. 主体表格数据区 (固定表头 + GPU合成 translate3d 虚拟视口，彻底杜绝凝思 Electron 行高抖动与白屏页) -->
      <!-- ===================================================================== -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <!-- 固定表头 -->
        <div
          ref="headerRef"
          class="overflow-hidden shrink-0 bg-[#e5decb] border-b-2 border-[#b8ad96] text-slate-900 font-bold select-none text-[14px]"
          style="scrollbar-gutter: stable;"
        >
          <div
            class="flex items-center box-border"
            :style="{ width: `${totalTableWidth}px`, minWidth: '100%' }"
          >
            <!-- 1. 序号 -->
            <div
              :style="{ width: `${colWidths.index}px`, minWidth: `${colWidths.index}px`, maxWidth: `${colWidths.index}px`, flexShrink: 0 }"
              class="relative py-2 px-2 text-center border-r border-[#b8ad96] box-border"
            >
              <span>序号</span>
              <div
                @mousedown.stop.prevent="startColResize('index', $event)"
                class="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-500/50 active:bg-sky-600 transition-colors z-20"
                title="拖动调整列宽"
              ></div>
            </div>

            <!-- 2. 时间 -->
            <div
              :style="{ width: `${colWidths.time}px`, minWidth: `${colWidths.time}px`, maxWidth: `${colWidths.time}px`, flexShrink: 0 }"
              class="relative py-2 px-2 text-center border-r border-[#b8ad96] box-border"
            >
              <span>时间</span>
              <div
                @mousedown.stop.prevent="startColResize('time', $event)"
                class="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-500/50 active:bg-sky-600 transition-colors z-20"
                title="拖动调整列宽"
              ></div>
            </div>

            <!-- 3. 毫秒数 -->
            <div
              :style="{ width: `${colWidths.msec}px`, minWidth: `${colWidths.msec}px`, maxWidth: `${colWidths.msec}px`, flexShrink: 0 }"
              class="relative py-2 px-2 text-center border-r border-[#b8ad96] box-border"
            >
              <span>毫秒数</span>
              <div
                @mousedown.stop.prevent="startColResize('msec', $event)"
                class="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-500/50 active:bg-sky-600 transition-colors z-20"
                title="拖动调整列宽"
              ></div>
            </div>

            <!-- 4. 表名 -->
            <div
              :style="{ width: `${colWidths.tableName}px`, minWidth: `${colWidths.tableName}px`, maxWidth: `${colWidths.tableName}px`, flexShrink: 0 }"
              class="relative py-2 px-2 text-center border-r border-[#b8ad96] box-border"
            >
              <span>表名</span>
              <div
                @mousedown.stop.prevent="startColResize('tableName', $event)"
                class="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-500/50 active:bg-sky-600 transition-colors z-20"
                title="拖动调整列宽"
              ></div>
            </div>

            <!-- 5. 等级 -->
            <div
              :style="{ width: `${colWidths.level}px`, minWidth: `${colWidths.level}px`, maxWidth: `${colWidths.level}px`, flexShrink: 0 }"
              class="relative py-2 px-2 text-center border-r border-[#b8ad96] box-border"
            >
              <span>等级</span>
              <div
                @mousedown.stop.prevent="startColResize('level', $event)"
                class="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-500/50 active:bg-sky-600 transition-colors z-20"
                title="拖动调整列宽"
              ></div>
            </div>

            <!-- 6. 告警内容 -->
            <div
              :style="{ flex: `1 1 ${colWidths.content}px`, minWidth: `${colWidths.content}px` }"
              class="relative py-2 px-3 text-left box-border"
            >
              <span>告警内容</span>
              <div
                @mousedown.stop.prevent="startColResize('content', $event)"
                class="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-500/50 active:bg-sky-600 transition-colors z-20"
                title="拖动调整列宽"
              ></div>
            </div>
          </div>
        </div>

        <!-- 虚拟滚动视口容器 -->
        <div
          ref="tableContainerRef"
          @scroll.passive="onTableScroll"
          class="flex-1 overflow-auto bg-white relative"
          style="scrollbar-gutter: stable; overflow-anchor: none;"
        >
          <div
            v-if="historyRecords.length > 0"
            :style="{
              height: `${historyRecords.length * ROW_HEIGHT}px`,
              width: `${totalTableWidth}px`,
              minWidth: '100%',
              position: 'relative'
            }"
          >
            <div
              v-for="(item, localIdx) in visibleHistoryRecords"
              :key="`${item.time}_${item.msec ?? 0}_${item.table_no}_${startIndex + localIdx}`"
              @contextmenu="handleRowContextMenu($event, item)"
              :style="{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${ROW_HEIGHT}px`,
                transform: `translate3d(0, ${(startIndex + localIdx) * ROW_HEIGHT}px, 0)`,
                contain: 'layout style paint'
              }"
              class="flex items-center text-[14px] select-none box-border"
              :class="resolveLevelInfo(item).rowClass"
            >
              <!-- 1. 序号 -->
              <div
                :style="{ width: `${colWidths.index}px`, minWidth: `${colWidths.index}px`, maxWidth: `${colWidths.index}px`, height: '34px', flexShrink: 0 }"
                class="px-2 text-center border-r border-b border-slate-200 font-mono font-bold text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis box-border leading-[34px]"
              >
                {{ item.index ?? startIndex + localIdx + 1 }}
              </div>

              <!-- 2. 时间 -->
              <div
                :style="{ width: `${colWidths.time}px`, minWidth: `${colWidths.time}px`, maxWidth: `${colWidths.time}px`, height: '34px', flexShrink: 0 }"
                class="px-2 text-center border-r border-b border-slate-200 font-mono font-bold text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis box-border leading-[34px]"
              >
                {{ item.time }}
              </div>

              <!-- 3. 毫秒数 -->
              <div
                :style="{ width: `${colWidths.msec}px`, minWidth: `${colWidths.msec}px`, maxWidth: `${colWidths.msec}px`, height: '34px', flexShrink: 0 }"
                class="px-2 text-center border-r border-b border-slate-200 font-mono font-bold text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis box-border leading-[34px]"
              >
                {{ item.msec ?? 0 }}
              </div>

              <!-- 4. 表名 -->
              <div
                :style="{ width: `${colWidths.tableName}px`, minWidth: `${colWidths.tableName}px`, maxWidth: `${colWidths.tableName}px`, height: '34px', flexShrink: 0 }"
                class="px-2 text-center border-r border-b border-slate-200 font-bold text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis box-border leading-[34px]"
                :title="item.table_name"
              >
                {{ item.table_name }}
              </div>

              <!-- 5. 等级 (纯文本显示，不使用卡片/边框包裹) -->
              <div
                :style="{
                  width: `${colWidths.level}px`,
                  minWidth: `${colWidths.level}px`,
                  maxWidth: `${colWidths.level}px`,
                  height: '34px',
                  flexShrink: 0,
                  color: resolveLevelInfo(item).color
                }"
                class="px-2 text-center border-r border-b border-slate-200 font-bold whitespace-nowrap overflow-hidden text-ellipsis box-border leading-[34px]"
              >
                {{ resolveLevelInfo(item).name }}
              </div>

              <!-- 6. 告警内容 -->
              <div
                :style="{ flex: `1 1 ${colWidths.content}px`, minWidth: `${colWidths.content}px`, height: '34px' }"
                class="px-3 text-left border-b border-slate-200 whitespace-nowrap overflow-hidden text-ellipsis box-border leading-[34px]"
                :class="resolveLevelInfo(item).contentClass"
                :title="`${item.content}${item.alias ? '\n测点别名: ' + item.alias : ''}`"
              >
                {{ item.content }}
              </div>
            </div>
          </div>

          <!-- 空状态提示 -->
          <div v-else class="py-20 text-center text-slate-500 text-[15px] font-medium">
            {{
              isSearching
                ? '正在向 SCADA 历史库检索数据，请稍候...'
                : (hasSearched ? '未检索到符合条件的历史告警记录' : '请设置筛选条件后点击【查询】按钮检索历史告警')
            }}
          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- 3. 底部状态栏与分页控制条                                             -->
      <!-- ===================================================================== -->
      <div class="h-10 bg-[#ebe4d4] border-t border-[#cfc5b0] px-3 flex items-center justify-between gap-2 shrink-0 select-none text-[13px] font-medium text-slate-800">
        <!-- 左侧统计 -->
        <div class="flex items-center gap-3 truncate">
          <span>本页: <span class="text-sky-800 font-mono">{{ historyRecords.length }}</span> 条</span>
          <span>总计: <span class="text-sky-800 font-mono">{{ totalRecords }}</span> 条</span>
        </div>

        <!-- 中间分页器 -->
        <div class="flex items-center gap-1.5 shrink-0">
          <select
            v-model.number="pageSize"
            @change="executeHistorySearch(1)"
            class="h-7 px-1.5 bg-white border border-[#b8ad96] text-[12.5px] font-medium text-slate-800 focus:outline-none cursor-pointer"
            title="每页显示条数"
          >
            <option :value="100">100 条/页</option>
            <option :value="200">200 条/页</option>
            <option :value="500">500 条/页</option>
            <option :value="1000">1000 条/页</option>
          </select>

          <button
            @click="executeHistorySearch(1)"
            :disabled="isSearching || currentPage <= 1"
            class="h-7 px-2 bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#b8ad96] text-[12.5px] text-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            首页
          </button>
          <button
            @click="executeHistorySearch(currentPage - 1)"
            :disabled="isSearching || currentPage <= 1"
            class="h-7 px-2 bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#b8ad96] text-[12.5px] text-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            上一页
          </button>

          <span class="px-2 font-mono text-[12.5px] text-slate-900">
            第 {{ currentPage }} / {{ totalPages }} 页
          </span>

          <button
            @click="executeHistorySearch(currentPage + 1)"
            :disabled="isSearching || currentPage >= totalPages"
            class="h-7 px-2 bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#b8ad96] text-[12.5px] text-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            下一页
          </button>
          <button
            @click="executeHistorySearch(totalPages)"
            :disabled="isSearching || currentPage >= totalPages"
            class="h-7 px-2 bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#b8ad96] text-[12.5px] text-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            末页
          </button>

          <div class="flex items-center gap-1 ml-1">
            <span class="text-[12px] text-slate-600">跳至</span>
            <input
              v-model="jumpPageInput"
              @keyup.enter="handleJumpPage"
              class="w-12 h-7 px-1 text-center font-mono text-[12.5px] bg-white border border-[#b8ad96] text-slate-900 focus:outline-none focus:border-sky-700"
            />
            <button
              @click="handleJumpPage"
              :disabled="isSearching"
              class="h-7 px-2 bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#b8ad96] text-[12px] text-slate-800 cursor-pointer"
            >
              确定
            </button>
          </div>
        </div>

        <!-- 右侧等级图例 -->
        <div class="hidden md:flex items-center gap-3 text-[12.5px] text-slate-600 shrink-0">
          <span class="flex items-center gap-1">
            <span class="w-2.5 h-2.5 inline-block bg-[#FF0000]"></span> 事故信息
          </span>
          <span class="flex items-center gap-1">
            <span class="w-2.5 h-2.5 inline-block bg-[#E6A23C]"></span> 告警信息
          </span>
          <span class="flex items-center gap-1">
            <span class="w-2.5 h-2.5 inline-block bg-[#67C23A]"></span> 提示信息
          </span>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- 4. 右键快捷菜单                                                        -->
    <!-- ===================================================================== -->
    <div
      v-if="contextMenuVisible && contextMenuItem"
      class="fixed z-70 bg-white border-2 border-slate-600 shadow-2xl py-1 text-[13.5px] font-bold text-slate-900 w-52 select-none"
      :style="{ left: `${contextMenuX}px`, top: `${contextMenuY}px` }"
      @click.stop
    >
      <div class="px-3 py-1.5 bg-[#ebe4d4] border-b border-[#cfc5b0] text-slate-700 text-[12px] font-bold">
        历史告警操作
      </div>
      <button
        @click="copyText(contextMenuItem.content)"
        class="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2 cursor-pointer text-slate-800"
      >
        <Copy class="w-4 h-4 text-slate-600" />
        <span>复制告警内容</span>
      </button>
      <button
        v-if="contextMenuItem.alias"
        @click="copyText(contextMenuItem.alias)"
        class="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2 cursor-pointer text-slate-800"
      >
        <Copy class="w-4 h-4 text-slate-600" />
        <span>复制测点别名</span>
      </button>
    </div>
  </div>
</template>
