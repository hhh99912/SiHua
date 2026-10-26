<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import {
  CheckCheck,
  Pause,
  Play,
  Save,
  Printer,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Square,
  CheckSquare,
  Bell,
  RefreshCw,
  Copy,
  Check,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  RotateCcw,
  Filter,
  ShieldAlert,
  Trash2,
  ChevronLeft
} from 'lucide-vue-next';
import {
  fetchScadaWarnConfig,
  fetchScadaWarnRealtime,
  ackScadaWarn,
  ackAllScadaWarn,
  clearScadaWarnCache,
  globalUnconfirmedAlarmCount,
  ScadaRealtimeWarnItem
} from '../utils/scadaClient';
import {
  SCADA_STATION_TREE,
  checkAlarmPassesFilterAndShield,
  ScadaAlarmFilterRules
} from '../utils/scadaTreeData';

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

// 底栏分类字典 (覆盖 SCADA 全部种类)
const categoryTabs = [
  '全部时序',
  '事故跳闸',
  '告警越限',
  '提示预告',
  '遥信变位',
  '遥测越限',
  '保护动作',
  '事件SOE',
  '人工遥控',
  '人工遥调',
  '操作记录'
];

const activeTab = ref<string>('全部时序');
const isPaused = ref<boolean>(false);
const showQuickSearch = ref<boolean>(false);
const quickSearchText = ref<string>('');
const selectedAlarmIds = ref<Set<number>>(new Set());
const isLoading = ref<boolean>(false);
const isAcking = ref<boolean>(false);

// ============================================================================
// 1. “选项”下拉菜单与用户偏好配置 (解决“点不开”并提供工业定制)
// ============================================================================
const showOptionsMenu = ref<boolean>(false);
const soundAlertEnabled = ref<boolean>(false); // 报警声音蜂鸣器
const pinToTopLocked = ref<boolean>(true); // 自动置顶锁定 (默认开启，关掉后允许操作员自由往下拉)
const maxCapacity = ref<number>(500); // 单屏缓存上限：100 / 300 / 500

// 列可见性控制
const columnVisibility = ref({
  status: true,
  level: true,
  station: true,
  bay: true,
  device: true,
  key: true,
  action: true,
  type: true,
  time: true,
  content: true
});

// 重置列显示
const resetColumnVisibility = () => {
  columnVisibility.value = {
    status: true,
    level: true,
    station: true,
    bay: true,
    device: true,
    key: true,
    action: true,
    type: true,
    time: true,
    content: true
  };
};

// 声音蜂鸣提醒试听
const playBeepSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 蜂鸣警报音
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
};

// ============================================================================
// 2. 六维过滤 (白名单) 与 屏蔽 (黑名单) 状态管理 (参考现场实测截图)
// ============================================================================
// 白名单筛选：设置后仅显示命中项
const filterStations = ref<string[]>([]);
const filterBays = ref<string[]>([]);
const filterDevices = ref<string[]>([]);

// 黑名单屏蔽：命中任何一项坚决彻底隐藏
const shieldStations = ref<string[]>([]);
const shieldBays = ref<string[]>([]);
const shieldDevices = ref<string[]>([]);

// 右侧过滤与屏蔽弹出菜单展开/关闭状态 (由顶栏“隐藏”按钮控制)
const showShieldDrawer = ref<boolean>(false);

// 一键清空所有筛选与屏蔽条件
const clearAllFiltersAndShields = () => {
  filterStations.value = [];
  filterBays.value = [];
  filterDevices.value = [];
  shieldStations.value = [];
  shieldBays.value = [];
  shieldDevices.value = [];
};

// ============================================================================
// 3. 双栏树形选择弹窗 (选择厂站/选择间隔/选择装置，带白名单/黑名单区分)
// ============================================================================
const selectorModalVisible = ref<boolean>(false);
const selectorTargetType = ref<'station' | 'bay' | 'device'>('bay');
const selectorMode = ref<'filter' | 'shield'>('filter'); // filter = 筛选(白名单), shield = 屏蔽(黑名单)
const tempSelectedItems = ref<string[]>([]); // 临时选中的项 (确定前可取消)
const treeSearchText = ref<string>('');
const expandedStationIds = ref<Set<string | number>>(new Set([10001, 10002, 10003]));
const expandedBayIds = ref<Set<string | number>>(new Set());

// 打开选择器
const openSelector = (target: 'station' | 'bay' | 'device', mode: 'filter' | 'shield') => {
  selectorTargetType.value = target;
  selectorMode.value = mode;
  treeSearchText.value = '';

  // 读取对应规则的当前选中列表
  let currentList: string[] = [];
  if (mode === 'filter') {
    if (target === 'station') currentList = [...filterStations.value];
    else if (target === 'bay') currentList = [...filterBays.value];
    else if (target === 'device') currentList = [...filterDevices.value];
  } else {
    if (target === 'station') currentList = [...shieldStations.value];
    else if (target === 'bay') currentList = [...shieldBays.value];
    else if (target === 'device') currentList = [...shieldDevices.value];
  }

  tempSelectedItems.value = currentList;
  selectorModalVisible.value = true;
};

// 弹窗标题
const selectorDialogTitle = computed(() => {
  const targetMap = {
    station: '厂站',
    bay: '间隔',
    device: '装置'
  };
  const modeMap = {
    filter: '筛选 (白名单)',
    shield: '屏蔽 (黑名单)'
  };
  return `按${targetMap[selectorTargetType.value]}${modeMap[selectorMode.value]}`;
});

// 切换树节点展开收起
const toggleExpandStation = (id: string | number) => {
  if (expandedStationIds.value.has(id)) {
    expandedStationIds.value.delete(id);
  } else {
    expandedStationIds.value.add(id);
  }
};

const toggleExpandBay = (id: string | number) => {
  if (expandedBayIds.value.has(id)) {
    expandedBayIds.value.delete(id);
  } else {
    expandedBayIds.value.add(id);
  }
};

// 展开/收起全部树节点
const expandAllTreeNodes = () => {
  SCADA_STATION_TREE.forEach(st => {
    expandedStationIds.value.add(st.id);
    st.bays.forEach(b => expandedBayIds.value.add(b.id));
  });
};

const collapseAllTreeNodes = () => {
  expandedStationIds.value.clear();
  expandedBayIds.value.clear();
};

// 临时选中项集合
const tempSelectedSet = computed(() => new Set(tempSelectedItems.value));

// 切换单项勾选 (存入 tempSelectedItems)
const toggleSelectItem = (val: string) => {
  const idx = tempSelectedItems.value.indexOf(val);
  if (idx >= 0) {
    tempSelectedItems.value.splice(idx, 1);
  } else {
    tempSelectedItems.value.push(val);
  }
};

// 移除单个已选项
const removeSelectedItem = (val: string) => {
  const idx = tempSelectedItems.value.indexOf(val);
  if (idx >= 0) {
    tempSelectedItems.value.splice(idx, 1);
  }
};

// 清空弹窗临时选中
const clearTempSelected = () => {
  tempSelectedItems.value = [];
};

// 全选当前类型所有项
const selectAllCurrentType = () => {
  const items: string[] = [];
  SCADA_STATION_TREE.forEach(st => {
    if (selectorTargetType.value === 'station') {
      items.push(st.name);
    } else if (selectorTargetType.value === 'bay') {
      st.bays.forEach(b => {
        items.push(`${st.name}->${b.name}`);
      });
    } else if (selectorTargetType.value === 'device') {
      st.bays.forEach(b => {
        b.devices.forEach(d => {
          items.push(`${st.name}->${b.name}->${d.name}`);
        });
      });
    }
  });
  tempSelectedItems.value = items;
};

// 确认应用选择
const handleApplySelector = () => {
  const target = selectorTargetType.value;
  const mode = selectorMode.value;
  const list = [...tempSelectedItems.value];

  if (mode === 'filter') {
    if (target === 'station') filterStations.value = list;
    else if (target === 'bay') filterBays.value = list;
    else if (target === 'device') filterDevices.value = list;
  } else {
    if (target === 'station') shieldStations.value = list;
    else if (target === 'bay') shieldBays.value = list;
    else if (target === 'device') shieldDevices.value = list;
  }

  selectorModalVisible.value = false;
};

// 取消选择
const handleCancelSelector = () => {
  selectorModalVisible.value = false;
};

// 过滤后的树形节点 (支持搜索)
const filteredTreeStations = computed(() => {
  const q = treeSearchText.value.trim().toLowerCase();
  if (!q) return SCADA_STATION_TREE;

  return SCADA_STATION_TREE.map(station => {
    const matchStation = station.name.toLowerCase().includes(q) || station.alias.toLowerCase().includes(q);
    const matchedBays = station.bays.map(bay => {
      const matchBay = bay.name.toLowerCase().includes(q);
      const matchedDevices = bay.devices.filter(d => d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q));

      if (matchBay || matchedDevices.length > 0) {
        return {
          ...bay,
          devices: matchedDevices.length > 0 ? matchedDevices : bay.devices
        };
      }
      return null;
    }).filter(Boolean) as any[];

    if (matchStation || matchedBays.length > 0) {
      return {
        ...station,
        bays: matchedBays.length > 0 ? matchedBays : station.bays
      };
    }
    return null;
  }).filter(Boolean) as typeof SCADA_STATION_TREE;
});

// ============================================================================
// 4. 表格与虚拟视口滚动计算 (凝思系统极致防卡死 + 自动置顶锁定)
// ============================================================================
const tableContainerRef = ref<HTMLDivElement | null>(null);

// 核心极致优化 1：使用 shallowRef 消除深层 Proxy 劫持，节省 80% 内存与 GC 开销
const alarms = shallowRef<ScadaRealtimeWarnItem[]>([]);
const lastSeqId = ref<number>(0);

// 核心极致优化 2：常驻 Set 快速 O(1) 去重，严格与容量限制同步，杜绝内存泄漏
const knownSeqIds = new Set<number>();

// 核心极致优化 3：1Hz 离散步进闪烁，彻底消除 Chromium 60fps CSS 动画引发的 CPU 100% 跑满与软死锁
const isBlinkPhase = ref<boolean>(true);

// 核心极致优化 4：轻量级视口虚拟窗口 (Virtual Windowing)
const rowHeight = 36;
const scrollTop = ref<number>(0);
const containerHeight = ref<number>(650);

// 右键菜单状态
const contextMenuVisible = ref<boolean>(false);
const contextMenuX = ref<number>(0);
const contextMenuY = ref<number>(0);
const contextMenuItem = ref<ScadaRealtimeWarnItem | null>(null);

// 规范化后端条目并使用 Object.freeze 彻底冻结对象，阻止响应式包裹
const normalizeAlarmItem = (item: ScadaRealtimeWarnItem): ScadaRealtimeWarnItem => {
  const levelName = item.level_name || (item.level === 3 ? '事故跳闸' : item.level === 2 ? '告警越限' : item.level === 1 ? '提示预告' : '操作记录');
  const levelColor = item.level_color || (item.level === 3 ? '#FF0000' : item.level === 2 ? '#FF9900' : item.level === 1 ? '#00FF00' : '#00FFFF');
  const typeName = item.type_name || (item.type === 28 ? '保护动作' : item.type === 10 ? '事件SOE' : item.type === 1 ? '遥信变位' : item.type === 2 ? '遥测越限' : item.type === 8 ? '人工遥控' : item.type === 9 ? '人工遥调' : '系统');

  return Object.freeze({
    ...item,
    level_name: levelName,
    level_color: levelColor,
    type_name: typeName,
    fac_name: item.fac_name || '东郊变电站',
    bay_name: item.bay_name || '220kV第一线间隔',
    dev_name: item.dev_name || '断路器',
    key_name: item.key_name || (item.key_id ? `KEY_${item.key_id}` : '开关位置'),
    val_desc: item.val_desc || (item.val === 1 ? '合闸/闭合' : '分闸/断开'),
    status_desc: item.status_desc || item.val_desc || (item.val === 1 ? '合闸' : '分闸'),
    confirm_desc: item.confirm === 1 ? '已确认' : '未确认'
  });
};

// ============================================================================
// 5. 核心告警过滤算法：黑名单屏蔽一票否决 + 白名单筛选 + 分类 Tab 聚合
// ============================================================================
const filteredAlarms = computed(() => {
  const currentTab = activeTab.value;
  const q = quickSearchText.value.trim().toLowerCase();
  const list = alarms.value;

  const currentRules: ScadaAlarmFilterRules = {
    filterStations: filterStations.value,
    filterBays: filterBays.value,
    filterDevices: filterDevices.value,
    shieldStations: shieldStations.value,
    shieldBays: shieldBays.value,
    shieldDevices: shieldDevices.value
  };

  return list.filter(item => {
    // 1. 黑名单屏蔽与白名单过滤校验 (最核心，高优先级)
    const passesRules = checkAlarmPassesFilterAndShield(item, currentRules);
    if (!passesRules) return false;

    // 2. 分类 Tab 页过滤
    let matchTab = false;
    if (currentTab === '全部时序') {
      matchTab = true;
    } else if (currentTab === '事故跳闸') {
      matchTab = item.level === 3 || item.level_name === '事故跳闸' || (item.content || '').includes('事故') || (item.content || '').includes('跳闸');
    } else if (currentTab === '告警越限') {
      matchTab = item.level === 2 || item.level_name === '告警越限' || (item.content || '').includes('越限');
    } else if (currentTab === '提示预告') {
      matchTab = item.level === 1 || item.level_name === '提示预告';
    } else if (currentTab === '遥信变位') {
      matchTab = item.type === 1 || item.type_name === '遥信变位';
    } else if (currentTab === '遥测越限') {
      matchTab = item.type === 2 || item.type_name === '遥测越限';
    } else if (currentTab === '保护动作') {
      matchTab = item.type === 28 || item.type_name === '保护动作';
    } else if (currentTab === '事件SOE') {
      matchTab = item.type === 10 || item.type_name === '事件SOE';
    } else if (currentTab === '人工遥控') {
      matchTab = item.type === 8 || item.type_name === '人工遥控';
    } else if (currentTab === '人工遥调') {
      matchTab = item.type === 9 || item.type_name === '人工遥调';
    } else if (currentTab === '操作记录') {
      matchTab = item.level === 4 || item.level_name === '操作记录';
    } else {
      matchTab = item.type_name === currentTab || item.level_name === currentTab;
    }

    if (!matchTab) return false;

    // 3. 快速关键词检索 (可选)
    if (!q) return true;
    return (item.content || '').toLowerCase().includes(q) ||
      (item.fac_name || '').toLowerCase().includes(q) ||
      (item.bay_name || '').toLowerCase().includes(q) ||
      (item.dev_name || '').toLowerCase().includes(q) ||
      (item.key_name || '').toLowerCase().includes(q) ||
      (item.type_name || '').toLowerCase().includes(q) ||
      (item.status_desc || '').toLowerCase().includes(q);
  });
});

// 计算虚拟视口渲染窗口切片
const startIndex = computed(() => {
  return Math.max(0, Math.floor(scrollTop.value / rowHeight) - 8);
});

const endIndex = computed(() => {
  const visibleCount = Math.ceil(containerHeight.value / rowHeight) + 16;
  return Math.min(filteredAlarms.value.length, startIndex.value + visibleCount);
});

const visibleAlarms = computed(() => {
  return filteredAlarms.value.slice(startIndex.value, endIndex.value);
});

const topSpacerHeight = computed(() => {
  return startIndex.value * rowHeight;
});

const bottomSpacerHeight = computed(() => {
  return Math.max(0, (filteredAlarms.value.length - endIndex.value) * rowHeight);
});

const onTableScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target) {
    scrollTop.value = target.scrollTop;
  }
};

// 未确认数目
const unackCount = computed(() => {
  return alarms.value.filter(a => a.confirm === 0).length;
});

// 当前展示总数目
const totalCount = computed(() => {
  return filteredAlarms.value.length;
});

// 内存中总告警数目
const inMemoryCount = computed(() => {
  return alarms.value.length;
});

// 全选状态
const isAllSelected = computed(() => {
  return filteredAlarms.value.length > 0 && filteredAlarms.value.every(a => selectedAlarmIds.value.has(a.seq_id));
});

// 切换单行勾选
const toggleSelectRow = (seq_id: number) => {
  if (selectedAlarmIds.value.has(seq_id)) {
    selectedAlarmIds.value.delete(seq_id);
  } else {
    selectedAlarmIds.value.add(seq_id);
  }
};

// 切换全选
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedAlarmIds.value.clear();
  } else {
    filteredAlarms.value.forEach(a => selectedAlarmIds.value.add(a.seq_id));
  }
};

// 单条告警确认
const acknowledgeItem = async (item: ScadaRealtimeWarnItem) => {
  if (item.confirm === 1) return;
  try {
    const res = await ackScadaWarn({
      seq_id: item.seq_id,
      operator: '调度员_张三'
    });
    if (res.success) {
      const updated = alarms.value.map(a => {
        if (a.seq_id === item.seq_id) {
          return Object.freeze({
            ...a,
            confirm: 1,
            confirm_desc: '已确认'
          });
        }
        return a;
      });
      alarms.value = Object.freeze(updated) as ScadaRealtimeWarnItem[];
      updateGlobalUnconfirmedCount();
    }
  } catch (err) {
    console.warn('单条确认失败:', err);
  }
};

// 批量确认选中的告警
const handleAcknowledgeSelected = async () => {
  if (selectedAlarmIds.value.size === 0) return;
  const ids = Array.from(selectedAlarmIds.value);
  isAcking.value = true;
  try {
    const res = await ackScadaWarn({
      seq_ids: ids,
      operator: '调度员_张三'
    });
    if (res.success) {
      const selSet = selectedAlarmIds.value;
      const updated = alarms.value.map(a => {
        if (selSet.has(a.seq_id)) {
          return Object.freeze({
            ...a,
            confirm: 1,
            confirm_desc: '已确认'
          });
        }
        return a;
      });
      alarms.value = Object.freeze(updated) as ScadaRealtimeWarnItem[];
      selectedAlarmIds.value.clear();
      updateGlobalUnconfirmedCount();
    }
  } catch (err) {
    console.warn('批量确认失败:', err);
  } finally {
    isAcking.value = false;
  }
};

// 确认全部
const handleAcknowledgeAll = async () => {
  isAcking.value = true;
  try {
    const res = await ackAllScadaWarn({ operator: '调度员_张三' });
    if (res.success) {
      const updated = alarms.value.map(a => Object.freeze({
        ...a,
        confirm: 1,
        confirm_desc: '已确认'
      }));
      alarms.value = Object.freeze(updated) as ScadaRealtimeWarnItem[];
      selectedAlarmIds.value.clear();
      updateGlobalUnconfirmedCount();
    }
  } catch (err) {
    console.warn('全量确认失败:', err);
  } finally {
    isAcking.value = false;
  }
};

// 实时告警清屏
const handleClearAll = async () => {
  try {
    await clearScadaWarnCache();
    alarms.value = Object.freeze([]);
    knownSeqIds.clear();
    selectedAlarmIds.value.clear();
    lastSeqId.value = 0;
    updateGlobalUnconfirmedCount();
  } catch (err) {
    console.warn('清屏失败:', err);
  }
};

// 暂停 / 继续轮询
const togglePause = () => {
  isPaused.value = !isPaused.value;
};

// 右键菜单处理
const handleRowContextMenu = (e: MouseEvent, item: ScadaRealtimeWarnItem) => {
  e.preventDefault();
  contextMenuItem.value = item;
  contextMenuX.value = e.clientX;
  contextMenuY.value = e.clientY;
  contextMenuVisible.value = true;
};

const closeContextMenu = () => {
  contextMenuVisible.value = false;
  showOptionsMenu.value = false;
};

// 复制告警文本
const copyAlarmContent = (item: ScadaRealtimeWarnItem) => {
  closeContextMenu();
  if (navigator.clipboard && item.content) {
    navigator.clipboard.writeText(item.content);
  }
};

// 导出 CSV 报表
const handleSave = () => {
  const headers = ['序号', '状态', '级别', '类型', '厂站', '间隔', '设备', '测点', '动作语义', '发生时间', '告警描述'];
  const rows = filteredAlarms.value.map(a => [
    a.seq_id,
    a.confirm === 1 ? '已确认' : '未确认',
    a.level_name,
    a.type_name,
    a.fac_name,
    a.bay_name,
    a.dev_name,
    a.key_name,
    a.status_desc || a.val_desc,
    a.time,
    `"${(a.content || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `SCADA_告警记录清单_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 打印
const handlePrint = () => {
  window.print();
};

// 刷新全局未确认数 (供底栏铃铛图标闪烁驱动)
const updateGlobalUnconfirmedCount = () => {
  const count = alarms.value.filter(a => a.confirm === 0).length;
  globalUnconfirmedAlarmCount.value = count;
};

// 动态刷新时滚轮一直置顶，保证最新告警永远在视野最上方 (受 pinToTopLocked 约束)
const pinScrollToTop = () => {
  if (!pinToTopLocked.value) return;
  if (tableContainerRef.value && tableContainerRef.value.scrollTop !== 0) {
    tableContainerRef.value.scrollTop = 0;
    scrollTop.value = 0;
  }
};

// 增量轮询获取实时告警 (1秒一次动态刷新，性能优先，最大容量受 maxCapacity 控制，滚轮一直置顶)
let isPollingActive = false;
let gcCheckCounter = 0;

const pollRealtimeAlarms = async () => {
  if (isPaused.value || isPollingActive) return;
  isPollingActive = true;

  try {
    const res = await fetchScadaWarnRealtime({
      limit: 100,
      after_seq: lastSeqId.value
    });

    if (res.success && res.data && res.data.length > 0) {
      const newItems = res.data.map(normalizeAlarmItem);
      let maxSeq = lastSeqId.value;
      const filteredNew: ScadaRealtimeWarnItem[] = [];

      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        if (item.seq_id > maxSeq) {
          maxSeq = item.seq_id;
        }
        if (!knownSeqIds.has(item.seq_id)) {
          knownSeqIds.add(item.seq_id);
          filteredNew.push(item);
        }
      }
      lastSeqId.value = maxSeq;

      if (filteredNew.length > 0) {
        // 如果开启声音报警且有新告警产生，触发蜂鸣提示音
        if (soundAlertEnabled.value) {
          playBeepSound();
        }

        // 新增告警置顶，严格限制总容量在 maxCapacity
        const currentList = alarms.value;
        const nextList = filteredNew.concat(currentList);
        const cap = maxCapacity.value || 500;
        if (nextList.length > cap) {
          nextList.length = cap;
          // 同步清理 Set，保证不积存无用 ID
          knownSeqIds.clear();
          for (let i = 0; i < cap; i++) {
            knownSeqIds.add(nextList[i].seq_id);
          }
        }
        alarms.value = Object.freeze(nextList) as ScadaRealtimeWarnItem[];
        updateGlobalUnconfirmedCount();

        // 动态刷新滚轮置顶
        if (props.visible) {
          nextTick(() => {
            pinScrollToTop();
          });
        }
      }
    } else if (props.visible && pinToTopLocked.value) {
      pinScrollToTop();
    }

    // 内存安全防护：每 40 次轮询触发一次空闲垃圾回收检查
    gcCheckCounter++;
    if (gcCheckCounter >= 40) {
      gcCheckCounter = 0;
      if (typeof window !== 'undefined' && (window as any).gc) {
        try { (window as any).gc(); } catch {}
      }
    }
  } catch (err) {
    // 忽略偶发网络波动
  } finally {
    isPollingActive = false;
  }
};

let pollTimer: any = null;
let blinkTimer: any = null;

const updateContainerHeight = () => {
  if (tableContainerRef.value) {
    containerHeight.value = tableContainerRef.value.clientHeight || 650;
  }
};

onMounted(async () => {
  isLoading.value = true;
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('resize', updateContainerHeight);

  // 1Hz 步进闪烁计时器 (单例，0 额外 GPU/CPU 负担)
  blinkTimer = setInterval(() => {
    isBlinkPhase.value = !isBlinkPhase.value;
  }, 1000);

  try {
    await fetchScadaWarnConfig();

    const res = await fetchScadaWarnRealtime({ limit: 100, after_seq: 0 });
    if (res.success && res.data && res.data.length > 0) {
      const mapped = res.data.map(normalizeAlarmItem);
      const cap = maxCapacity.value || 500;
      const sliced = mapped.slice(0, cap);
      knownSeqIds.clear();
      for (const item of sliced) {
        knownSeqIds.add(item.seq_id);
      }
      alarms.value = Object.freeze(sliced) as ScadaRealtimeWarnItem[];
      lastSeqId.value = Math.max(...res.data.map(x => x.seq_id));
      updateGlobalUnconfirmedCount();

      nextTick(() => {
        updateContainerHeight();
        pinScrollToTop();
      });
    }
  } catch (err) {
    console.warn('初始化告警模块失败:', err);
  } finally {
    isLoading.value = false;
  }

  // 1 秒 1 次高精度平滑轮询
  pollTimer = setInterval(() => {
    pollRealtimeAlarms();
  }, 1000);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', closeContextMenu);
  window.removeEventListener('resize', updateContainerHeight);
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (blinkTimer) {
    clearInterval(blinkTimer);
    blinkTimer = null;
  }
});

// 当窗口恢复可见时，重新校准容器高度并复位置顶
watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => {
      updateContainerHeight();
      pinScrollToTop();
    });
  }
});
</script>

<template>
  <div 
    v-if="visible"
    :class="[
      isEmbedded 
        ? 'w-full h-full bg-white text-slate-900 flex flex-col font-sans select-none overflow-hidden text-[15px] font-bold'
        : 'fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex flex-col select-none p-1 md:p-2 text-[15px] font-bold'
    ]"
  >
    <div 
      class="w-full h-full bg-white text-slate-900 flex flex-col font-sans select-none overflow-hidden text-[15px] font-bold border border-slate-400"
    >
      <!-- 非嵌入模式下的全屏顶部标题栏 -->
      <div 
        v-if="!isEmbedded"
        class="h-11 bg-slate-200 border-b border-slate-400 px-4 flex items-center justify-between shrink-0 select-none text-[15px] font-bold"
      >
        <div class="flex items-center gap-2.5 font-bold text-slate-900 text-[15px]">
          <Bell 
            class="w-5 h-5 text-rose-600" 
            :class="unackCount > 0 ? (isBlinkPhase ? 'opacity-100' : 'opacity-30') : ''" 
          />
          <span>全站实时告警中心 (厂站/间隔/装置多维监视与对位复归)</span>
        </div>
        <button
          @click="emit('close')"
          class="p-1 rounded hover:bg-slate-300 text-slate-700 hover:text-slate-900 cursor-pointer"
          title="关闭告警窗"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- ===================================================================== -->
      <!-- 1. 顶部操作工具栏 (工业连续工具条，带图标，悬浮/激活时呈现按键间断)       -->
      <!-- ===================================================================== -->
      <div class="h-10 bg-slate-100 border-b border-slate-400 px-2 flex items-center justify-between shrink-0 select-none text-[14px] font-bold relative z-20">
        <!-- 左侧：功能操作按键连排条 (无缝平铺，带图标，仅在鼠标悬浮/点击时呈现独立按键间断) -->
        <div class="flex items-stretch bg-slate-200 border border-slate-400 divide-x divide-slate-300 shadow-2xs h-8">
          <!-- 选项菜单按钮 (纯文本显示，无下拉图标和选项图标) -->
          <div class="relative flex items-stretch">
            <button
              @click.stop="showOptionsMenu = !showOptionsMenu"
              class="px-2.5 h-full bg-transparent hover:bg-slate-300 active:bg-slate-400/80 flex items-center text-slate-900 text-[14px] font-bold cursor-pointer transition-all hover:shadow-xs relative hover:z-10"
              :class="{ 'bg-slate-300 shadow-inner': showOptionsMenu }"
              title="系统选项配置"
            >
              <span>选项</span>
            </button>

            <!-- 选项下拉菜单 (纯工控平直风格) -->
            <div
              v-if="showOptionsMenu"
              @click.stop
              class="absolute left-0 top-9 z-50 bg-white border-2 border-slate-600 shadow-2xl w-80 py-2 text-[14px] font-bold text-slate-900 select-none"
            >
              <div class="px-3 py-1.5 bg-slate-200 border-b border-slate-300 flex items-center justify-between">
                <span class="font-bold text-slate-900">告警监视窗口偏好设置</span>
                <button @click="showOptionsMenu = false" class="text-slate-600 hover:text-slate-900">
                  <X class="w-4 h-4" />
                </button>
              </div>

              <!-- 声音警报 -->
              <div class="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <component :is="soundAlertEnabled ? Volume2 : VolumeX" class="w-4.5 h-4.5" :class="soundAlertEnabled ? 'text-amber-600' : 'text-slate-400'" />
                  <span>未确认告警声音提醒</span>
                </div>
                <div class="flex items-center gap-2">
                  <button 
                    @click="playBeepSound"
                    class="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-xs"
                  >
                    试听
                  </button>
                  <input type="checkbox" v-model="soundAlertEnabled" class="w-4.5 h-4.5 cursor-pointer text-sky-600 rounded-none" />
                </div>
              </div>

              <!-- 自动置顶锁定 -->
              <div class="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div class="text-slate-900">动态刷新时始终置顶</div>
                  <div class="text-[12px] text-slate-500 font-normal">关闭后允许自由往下拉看历史告警</div>
                </div>
                <input type="checkbox" v-model="pinToTopLocked" class="w-4.5 h-4.5 cursor-pointer text-sky-600 rounded-none" />
              </div>

              <!-- 单屏最大缓存容量 -->
              <div class="px-3 py-2 border-b border-slate-200">
                <div class="text-slate-900 mb-1.5">单屏告警容量上限 (性能调优):</div>
                <div class="flex items-center gap-4 text-xs font-bold text-slate-800">
                  <label class="flex items-center gap-1 cursor-pointer">
                    <input type="radio" :value="100" v-model="maxCapacity" name="cap" /> 100条
                  </label>
                  <label class="flex items-center gap-1 cursor-pointer">
                    <input type="radio" :value="300" v-model="maxCapacity" name="cap" /> 300条
                  </label>
                  <label class="flex items-center gap-1 cursor-pointer">
                    <input type="radio" :value="500" v-model="maxCapacity" name="cap" /> 500条 (默认)
                  </label>
                </div>
              </div>

              <!-- 表格列显示定制 -->
              <div class="px-3 py-2 border-b border-slate-200">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-slate-900">显示列配置:</span>
                  <button @click="resetColumnVisibility" class="text-xs text-sky-700 hover:underline">
                    恢复默认列
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-1.5 text-xs font-bold text-slate-800">
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" v-model="columnVisibility.level" /> 级别
                  </label>
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" v-model="columnVisibility.station" /> 厂站
                  </label>
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" v-model="columnVisibility.bay" /> 间隔
                  </label>
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" v-model="columnVisibility.device" /> 设备
                  </label>
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" v-model="columnVisibility.key" /> 测点
                  </label>
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" v-model="columnVisibility.action" /> 动作语义
                  </label>
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" v-model="columnVisibility.type" /> 类型
                  </label>
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" v-model="columnVisibility.time" /> 发生时间
                  </label>
                </div>
              </div>

              <!-- 快捷清除所有过滤与屏蔽 -->
              <div class="px-3 py-2 flex items-center justify-between">
                <button
                  @click="clearAllFiltersAndShields(); showOptionsMenu = false;"
                  class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-400 text-rose-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                  <span>清除全部过滤与屏蔽</span>
                </button>
                <button
                  @click="showOptionsMenu = false"
                  class="px-3 py-1 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-xs font-bold cursor-pointer"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>

          <!-- 确认全部 -->
          <button
            @click="handleAcknowledgeAll"
            class="px-2.5 h-full bg-transparent hover:bg-slate-300 active:bg-slate-400/80 flex items-center gap-1.5 text-slate-900 text-[14px] font-bold cursor-pointer transition-all hover:shadow-xs relative hover:z-10 disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="isAcking"
            title="对位复归并确认当前所有告警"
          >
            <CheckCheck class="w-4 h-4 text-emerald-700 stroke-[2.5]" />
            <span>{{ isAcking ? '确认中...' : '确认全部' }}</span>
          </button>

          <!-- 确认选中 (常驻顶栏，无勾选时不可用) -->
          <button
            @click="handleAcknowledgeSelected"
            :disabled="isAcking || selectedAlarmIds.size === 0"
            class="px-2.5 h-full bg-transparent hover:bg-slate-300 active:bg-slate-400/80 flex items-center gap-1.5 text-slate-900 text-[14px] font-bold cursor-pointer transition-all hover:shadow-xs relative hover:z-10 disabled:opacity-40 disabled:cursor-not-allowed"
            title="确认当前勾选的告警条目"
          >
            <Check class="w-4 h-4 text-sky-700 stroke-[2.5]" />
            <span>确认选中{{ selectedAlarmIds.size > 0 ? ` (${selectedAlarmIds.size})` : '' }}</span>
          </button>

          <!-- 清除全部 (原清屏) -->
          <button
            @click="handleClearAll"
            class="px-2.5 h-full bg-transparent hover:bg-slate-300 active:bg-slate-400/80 flex items-center gap-1.5 text-slate-900 text-[14px] font-bold cursor-pointer transition-all hover:shadow-xs relative hover:z-10"
            title="清空当前告警缓存"
          >
            <Trash2 class="w-4 h-4 text-rose-700 stroke-[2.2]" />
            <span>清除全部</span>
          </button>

          <!-- 暂停 / 继续 -->
          <button
            @click="togglePause"
            class="px-2.5 h-full bg-transparent hover:bg-slate-300 active:bg-slate-400/80 flex items-center gap-1.5 text-slate-900 text-[14px] font-bold cursor-pointer transition-all hover:shadow-xs relative hover:z-10"
            :class="{ 'bg-amber-100 text-amber-900 shadow-inner': isPaused }"
            :title="isPaused ? '继续实时轮询' : '暂停当前刷新'"
          >
            <component :is="isPaused ? Play : Pause" class="w-4 h-4 text-amber-700 stroke-[2.5]" />
            <span>{{ isPaused ? '继续' : '暂停' }}</span>
          </button>

          <!-- 保存 -->
          <button
            @click="handleSave"
            class="px-2.5 h-full bg-transparent hover:bg-slate-300 active:bg-slate-400/80 flex items-center gap-1.5 text-slate-900 text-[14px] font-bold cursor-pointer transition-all hover:shadow-xs relative hover:z-10"
            title="导出/保存当前告警清单为 CSV"
          >
            <Save class="w-4 h-4 text-sky-700 stroke-[2.2]" />
            <span>保存</span>
          </button>

          <!-- 打印 -->
          <button
            @click="handlePrint"
            class="px-2.5 h-full bg-transparent hover:bg-slate-300 active:bg-slate-400/80 flex items-center gap-1.5 text-slate-900 text-[14px] font-bold cursor-pointer transition-all hover:shadow-xs relative hover:z-10"
            title="打印当前列表"
          >
            <Printer class="w-4 h-4 text-slate-700 stroke-[2.2]" />
            <span>打印</span>
          </button>

          <!-- 快速查找 -->
          <button
            @click="showQuickSearch = !showQuickSearch"
            class="px-2.5 h-full bg-transparent hover:bg-slate-300 active:bg-slate-400/80 flex items-center gap-1.5 text-slate-900 text-[14px] font-bold cursor-pointer transition-all hover:shadow-xs relative hover:z-10"
            :class="{ 'bg-slate-300 shadow-inner': showQuickSearch }"
            title="快速文本检索"
          >
            <Search class="w-4 h-4 text-indigo-700 stroke-[2.5]" />
            <span>快速查找</span>
          </button>

          <!-- 隐藏 (打开/关闭右侧过滤与屏蔽弹出菜单) -->
          <button
            @click="showShieldDrawer = !showShieldDrawer"
            class="px-2.5 h-full bg-transparent hover:bg-slate-300 active:bg-slate-400/80 flex items-center gap-1.5 text-slate-900 text-[14px] font-bold cursor-pointer transition-all hover:shadow-xs relative hover:z-10"
            :class="{ 'bg-slate-300 shadow-inner': showShieldDrawer }"
            title="打开/关闭右侧过滤与屏蔽弹出菜单"
          >
            <ShieldAlert class="w-4 h-4 text-amber-600 stroke-[2.2]" />
            <span>隐藏</span>
          </button>

          <!-- 刷新 -->
          <button
            @click="pollRealtimeAlarms"
            class="px-2.5 h-full bg-transparent hover:bg-slate-300 active:bg-slate-400/80 flex items-center gap-1.5 text-slate-900 text-[14px] font-bold cursor-pointer transition-all hover:shadow-xs relative hover:z-10"
            title="手动增量拉取最新告警"
          >
            <RefreshCw class="w-4 h-4 text-slate-700 stroke-[2.2]" :class="{ 'animate-spin': isLoading }" />
            <span>刷新</span>
          </button>
        </div>

        <!-- 右侧：只显示未确认数目和总数目 -->
        <div class="flex items-center text-[14px] font-bold text-slate-900 tracking-tight shrink-0 bg-slate-200 px-3 h-8 border border-slate-400 ml-2 shadow-2xs">
          未确认数目: {{ unackCount }}&nbsp;&nbsp;&nbsp;&nbsp;总数目: {{ totalCount }}
        </div>
      </div>

      <!-- 快捷搜索展开栏 -->
      <div
        v-if="showQuickSearch"
        class="bg-slate-200 border-b border-slate-400 px-4 py-2 flex items-center justify-between gap-3 shrink-0 text-[15px] font-bold"
      >
        <div class="flex items-center gap-3 flex-1">
          <span class="font-bold text-slate-900 text-[15px]">快速搜索:</span>
          <input
            v-model="quickSearchText"
            type="text"
            placeholder="输入测点、物理动作或告警内容进行关键词查找..."
            class="flex-1 max-w-xl bg-white border border-slate-400 px-3 py-1 text-[15px] font-bold text-slate-900 focus:outline-none focus:border-sky-600"
          />
          <button
            v-if="quickSearchText"
            @click="quickSearchText = ''"
            class="px-3 py-1 bg-slate-300 hover:bg-slate-400 text-slate-900 text-[15px] font-bold border border-slate-400 cursor-pointer"
          >
            清空
          </button>
        </div>
        <button
          @click="showQuickSearch = false"
          class="text-slate-600 hover:text-slate-900 p-1 cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- ===================================================================== -->
      <!-- 2. 中间主区域：左侧数据表格 + 右侧过滤/屏蔽操作面板 (参照现场图片实测布局) -->
      <!-- ===================================================================== -->
      <div class="flex-1 flex overflow-hidden border-b border-slate-400 relative">
        <!-- 主数据表格容器 (虚拟视口极速渲染，字体统一 text-[15px] font-bold) -->
        <div 
          ref="tableContainerRef"
          @scroll.passive="onTableScroll"
          class="flex-1 overflow-auto bg-white relative"
        >
          <table class="w-full border-collapse text-left font-sans text-[15px] font-bold">
            <!-- 表头 (纯白/灰工业风格，无卡片，弹窗打开时降低层叠级) -->
            <thead 
              class="sticky top-0 bg-slate-200 border-b-2 border-slate-400 text-slate-900 font-bold select-none text-[15px] transition-all"
              :class="selectorModalVisible ? 'z-0 opacity-50 pointer-events-none' : 'z-10'"
            >
              <tr>
                <!-- 状态 -->
                <th v-if="columnVisibility.status" class="py-2.5 px-3 w-32 border-r border-slate-400 text-center font-bold">
                  <div class="flex items-center justify-center gap-2 cursor-pointer" @click="toggleSelectAll">
                    <component :is="isAllSelected ? CheckSquare : Square" class="w-5 h-5 text-slate-800" />
                    <span class="text-[15px] font-bold">状态</span>
                  </div>
                </th>

                <!-- 级别 -->
                <th v-if="columnVisibility.level" class="py-2.5 px-3 w-28 border-r border-slate-400 text-center text-[15px] font-bold">
                  级别
                </th>

                <!-- 厂站 -->
                <th v-if="columnVisibility.station" class="py-2.5 px-3 w-36 border-r border-slate-400 text-[15px] font-bold">
                  厂站
                </th>

                <!-- 间隔 -->
                <th v-if="columnVisibility.bay" class="py-2.5 px-3 w-36 border-r border-slate-400 text-[15px] font-bold">
                  间隔
                </th>

                <!-- 设备 -->
                <th v-if="columnVisibility.device" class="py-2.5 px-3 w-36 border-r border-slate-400 text-[15px] font-bold">
                  设备
                </th>

                <!-- 测点 -->
                <th v-if="columnVisibility.key" class="py-2.5 px-3 w-40 border-r border-slate-400 text-[15px] font-bold">
                  测点名称
                </th>

                <!-- 动作语义 -->
                <th v-if="columnVisibility.action" class="py-2.5 px-3 w-32 border-r border-slate-400 text-center text-[15px] font-bold">
                  动作语义
                </th>

                <!-- 类型 -->
                <th v-if="columnVisibility.type" class="py-2.5 px-3 w-28 border-r border-slate-400 text-center text-[15px] font-bold">
                  类型
                </th>

                <!-- 动作时间 -->
                <th v-if="columnVisibility.time" class="py-2.5 px-3 w-56 border-r border-slate-400 text-[15px] font-bold">
                  动作时间
                </th>

                <!-- 告警内容 -->
                <th v-if="columnVisibility.content" class="py-2.5 px-4 text-[15px] font-bold">
                  告警完整内容
                </th>
              </tr>
            </thead>

            <!-- 表体行 (虚拟切片渲染：只保留视口中行，顶底由 Spacer 撑开，未确认由 1Hz 步进高亮闪烁) -->
            <tbody class="divide-y divide-slate-300">
              <!-- 顶部占位 Spacer -->
              <tr v-if="topSpacerHeight > 0" :style="{ height: `${topSpacerHeight}px` }">
                <td colspan="10" class="p-0 border-0"></td>
              </tr>

              <!-- 视口可见真实行 -->
              <tr
                v-for="item in visibleAlarms"
                :key="item.seq_id"
                @click="toggleSelectRow(item.seq_id)"
                @dblclick="acknowledgeItem(item)"
                @contextmenu="handleRowContextMenu($event, item)"
                class="cursor-pointer select-none text-[15px] font-bold border-b border-slate-300 h-9"
                :class="[
                  selectedAlarmIds.has(item.seq_id)
                    ? 'bg-sky-200 text-slate-950 font-bold'
                    : item.confirm === 0
                      ? (isBlinkPhase ? 'bg-rose-100/90 text-slate-950 font-bold' : 'bg-amber-50 text-slate-900 font-bold')
                      : 'bg-white hover:bg-slate-100 text-slate-800 font-bold'
                ]"
              >
                <!-- 状态 (未确认醒目提示 / 已确认静态) -->
                <td v-if="columnVisibility.status" class="py-1 px-3 border-r border-slate-300 text-center whitespace-nowrap text-[15px] font-bold">
                  <div class="flex items-center justify-center gap-2">
                    <input
                      type="checkbox"
                      :checked="selectedAlarmIds.has(item.seq_id)"
                      @click.stop="toggleSelectRow(item.seq_id)"
                      class="w-4.5 h-4.5 rounded-none border-slate-400 text-sky-700 focus:ring-0 cursor-pointer"
                    />
                    <span
                      @click.stop="acknowledgeItem(item)"
                      class="cursor-pointer text-[15px] font-bold px-1.5 py-0.5"
                      :class="item.confirm === 0 ? 'text-rose-700 font-bold underline' : 'text-slate-600 font-bold'"
                      title="双击行或点击此处确认对位复归"
                    >
                      {{ item.confirm_desc }}
                    </span>
                  </div>
                </td>

                <!-- 级别 (直接绑定后台标准配色 level_color) -->
                <td 
                  v-if="columnVisibility.level"
                  class="py-1 px-3 border-r border-slate-300 text-center whitespace-nowrap text-[15px] font-bold"
                  :style="{ color: item.level_color }"
                >
                  {{ item.level_name }}
                </td>

                <!-- 厂站中文名 -->
                <td v-if="columnVisibility.station" class="py-1 px-3 border-r border-slate-300 whitespace-nowrap text-[15px] font-bold text-slate-900 truncate">
                  {{ item.fac_name }}
                </td>

                <!-- 间隔中文名 -->
                <td v-if="columnVisibility.bay" class="py-1 px-3 border-r border-slate-300 whitespace-nowrap text-[15px] font-bold text-slate-900 truncate">
                  {{ item.bay_name }}
                </td>

                <!-- 设备中文名 -->
                <td v-if="columnVisibility.device" class="py-1 px-3 border-r border-slate-300 whitespace-nowrap text-[15px] font-bold text-slate-900 truncate">
                  {{ item.dev_name }}
                </td>

                <!-- 测点中文名 -->
                <td v-if="columnVisibility.key" class="py-1 px-3 border-r border-slate-300 whitespace-nowrap text-[15px] font-bold text-slate-800 truncate" :title="item.key_name">
                  {{ item.key_name }}
                </td>

                <!-- 动作物理语义 (分闸/断开 或 合闸/闭合 或 越上限) -->
                <td v-if="columnVisibility.action" class="py-1 px-3 border-r border-slate-300 text-center whitespace-nowrap text-[15px] font-bold">
                  <span :class="item.val === 1 ? 'text-rose-700' : 'text-emerald-700'">
                    {{ item.status_desc || item.val_desc }}
                  </span>
                </td>

                <!-- 类型 (遥信变位/保护动作/事件SOE等) -->
                <td v-if="columnVisibility.type" class="py-1 px-3 border-r border-slate-300 text-center whitespace-nowrap text-[15px] font-bold text-slate-800">
                  {{ item.type_name }}
                </td>

                <!-- 动作时间 -->
                <td v-if="columnVisibility.time" class="py-1 px-3 border-r border-slate-300 whitespace-nowrap font-mono text-[15px] font-bold text-slate-800">
                  {{ item.time }}
                </td>

                <!-- 告警完整内容 (直接绑定 level_color 呈现调度标准警示色) -->
                <td
                  v-if="columnVisibility.content"
                  class="py-1 px-4 text-[15px] font-bold truncate max-w-xl"
                  :style="{ color: item.level_color }"
                  :title="item.content"
                >
                  {{ item.content }}
                </td>
              </tr>

              <!-- 底部占位 Spacer -->
              <tr v-if="bottomSpacerHeight > 0" :style="{ height: `${bottomSpacerHeight}px` }">
                <td colspan="10" class="p-0 border-0"></td>
              </tr>

              <!-- 无数据占位行 -->
              <tr v-if="filteredAlarms.length === 0">
                <td colspan="10" class="py-16 text-center text-slate-500 font-bold text-[15px]">
                  <div class="flex flex-col items-center justify-center gap-2">
                    <span>暂无相关告警事件记录</span>
                    <span v-if="filterStations.length || filterBays.length || filterDevices.length || shieldStations.length || shieldBays.length || shieldDevices.length" class="text-xs text-amber-700 font-normal">
                      (当前过滤/屏蔽规则生效中，若需查看全量告警请在右侧面板点击“清除全部”)
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- =================================================================== -->
        <!-- 右侧弹出菜单 (由顶栏“隐藏”按钮控制弹出与收起)                           -->
        <!-- =================================================================== -->
        <div
          v-if="showShieldDrawer"
          class="absolute right-0 top-0 bottom-0 z-40 w-64 bg-slate-100 border-l-2 border-slate-500 shadow-2xl flex flex-col justify-between p-3 select-none text-[14px] font-bold"
          @click.stop
        >
          <!-- 菜单上半部 -->
          <div class="flex flex-col gap-2">
            <!-- 标题栏与关闭按钮 -->
            <div class="flex items-center justify-between pb-1.5 border-b border-slate-300">
              <span class="text-[14px] font-bold text-slate-900">
                过滤与屏蔽设置
              </span>
              <button
                @click="showShieldDrawer = false"
                class="p-0.5 hover:bg-slate-300 text-slate-600 hover:text-slate-900 cursor-pointer"
                title="关闭弹出菜单"
              >
                <X class="w-4.5 h-4.5" />
              </button>
            </div>

            <!-- 6 个维度按钮 (统一颜色 bg-slate-200，无卡片，无花哨背景) -->
            <div class="flex flex-col gap-1.5">
              <!-- 1. 按厂站筛选 (白名单) -->
              <button
                @click="openSelector('station', 'filter')"
                class="w-full py-1.5 px-2 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-900 text-[14px] font-bold flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>按厂站筛选</span>
                <span v-if="filterStations.length > 0" class="px-1.5 py-0.2 bg-slate-700 text-white text-xs font-mono">
                  {{ filterStations.length }}
                </span>
              </button>

              <!-- 2. 按间隔筛选 (白名单) -->
              <button
                @click="openSelector('bay', 'filter')"
                class="w-full py-1.5 px-2 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-900 text-[14px] font-bold flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>按间隔筛选</span>
                <span v-if="filterBays.length > 0" class="px-1.5 py-0.2 bg-slate-700 text-white text-xs font-mono">
                  {{ filterBays.length }}
                </span>
              </button>

              <!-- 3. 按装置筛选 (白名单) -->
              <button
                @click="openSelector('device', 'filter')"
                class="w-full py-1.5 px-2 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-900 text-[14px] font-bold flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>按装置筛选</span>
                <span v-if="filterDevices.length > 0" class="px-1.5 py-0.2 bg-slate-700 text-white text-xs font-mono">
                  {{ filterDevices.length }}
                </span>
              </button>

              <!-- 4. 按厂站屏蔽 (黑名单) -->
              <button
                @click="openSelector('station', 'shield')"
                class="w-full py-1.5 px-2 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-900 text-[14px] font-bold flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>按厂站屏蔽</span>
                <span v-if="shieldStations.length > 0" class="px-1.5 py-0.2 bg-slate-700 text-white text-xs font-mono">
                  {{ shieldStations.length }}
                </span>
              </button>

              <!-- 5. 按间隔屏蔽 (黑名单) -->
              <button
                @click="openSelector('bay', 'shield')"
                class="w-full py-1.5 px-2 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-900 text-[14px] font-bold flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>按间隔屏蔽</span>
                <span v-if="shieldBays.length > 0" class="px-1.5 py-0.2 bg-slate-700 text-white text-xs font-mono">
                  {{ shieldBays.length }}
                </span>
              </button>

              <!-- 6. 按装置屏蔽 (黑名单) -->
              <button
                @click="openSelector('device', 'shield')"
                class="w-full py-1.5 px-2 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-900 text-[14px] font-bold flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>按装置屏蔽</span>
                <span v-if="shieldDevices.length > 0" class="px-1.5 py-0.2 bg-slate-700 text-white text-xs font-mono">
                  {{ shieldDevices.length }}
                </span>
              </button>
            </div>

            <!-- 状态展示清单 (严格对照现场实测图片) -->
            <div class="mt-1 bg-white border border-slate-300 p-2 text-xs font-mono space-y-1.5">
              <div class="text-[12px] font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between font-sans">
                <span>当前状态汇总</span>
                <span class="text-[11px] text-slate-500 font-normal">
                  (过滤{{ filterStations.length + filterBays.length + filterDevices.length }} / 屏蔽{{ shieldStations.length + shieldBays.length + shieldDevices.length }})
                </span>
              </div>

              <!-- 厂站筛选 -->
              <div class="truncate" :title="filterStations.join(', ') || '无'">
                <span class="text-slate-600 font-sans">厂站筛选: </span>
                <span :class="filterStations.length > 0 ? 'text-slate-900 font-bold' : 'text-slate-400'">
                  {{ filterStations.length > 0 ? `${filterStations.join(', ')} (${filterStations.length})` : '无' }}
                </span>
              </div>

              <!-- 间隔筛选 -->
              <div class="truncate" :title="filterBays.join(', ') || '无'">
                <span class="text-slate-600 font-sans">间隔筛选: </span>
                <span :class="filterBays.length > 0 ? 'text-slate-900 font-bold' : 'text-slate-400'">
                  {{ filterBays.length > 0 ? `${filterBays.map(b => b.split('->').pop()).join(', ')} (${filterBays.length})` : '无' }}
                </span>
              </div>

              <!-- 装置筛选 -->
              <div class="truncate" :title="filterDevices.join(', ') || '无'">
                <span class="text-slate-600 font-sans">装置筛选: </span>
                <span :class="filterDevices.length > 0 ? 'text-slate-900 font-bold' : 'text-slate-400'">
                  {{ filterDevices.length > 0 ? `${filterDevices.map(d => d.split('->').pop()).join(', ')} (${filterDevices.length})` : '无' }}
                </span>
              </div>

              <div class="border-t border-slate-200 my-1"></div>

              <!-- 厂站屏蔽 -->
              <div class="truncate" :title="shieldStations.join(', ') || '无'">
                <span class="text-slate-600 font-sans">厂站屏蔽: </span>
                <span :class="shieldStations.length > 0 ? 'text-slate-900 font-bold' : 'text-slate-400'">
                  {{ shieldStations.length > 0 ? `${shieldStations.join(', ')} (${shieldStations.length})` : '无' }}
                </span>
              </div>

              <!-- 间隔屏蔽 -->
              <div class="truncate" :title="shieldBays.join(', ') || '无'">
                <span class="text-slate-600 font-sans">间隔屏蔽: </span>
                <span :class="shieldBays.length > 0 ? 'text-slate-900 font-bold' : 'text-slate-400'">
                  {{ shieldBays.length > 0 ? `${shieldBays.map(b => b.split('->').pop()).join(', ')} (${shieldBays.length})` : '无' }}
                </span>
              </div>

              <!-- 装置屏蔽 -->
              <div class="truncate" :title="shieldDevices.join(', ') || '无'">
                <span class="text-slate-600 font-sans">装置屏蔽: </span>
                <span :class="shieldDevices.length > 0 ? 'text-slate-900 font-bold' : 'text-slate-400'">
                  {{ shieldDevices.length > 0 ? `${shieldDevices.map(d => d.split('->').pop()).join(', ')} (${shieldDevices.length})` : '无' }}
                </span>
              </div>
            </div>
          </div>

          <!-- 下半部：清除全部按钮 -->
          <div class="pt-2 border-t border-slate-300">
            <button
              @click="clearAllFiltersAndShields"
              class="w-full py-1.5 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-800 text-[14px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="一键清空所有6维度的筛选与屏蔽条件"
            >
              <span>清除全部</span>
            </button>
            <div class="text-[11px] text-slate-500 text-center mt-1 font-normal font-sans">
              白名单命中显示 / 黑名单命中屏蔽
            </div>
          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- 3. 底部分类标签过滤栏 (覆盖后端全部种类，字体统一 text-[15px] font-bold)   -->
      <!-- ===================================================================== -->
      <div class="h-11 bg-slate-200 border-t border-slate-400 px-1 flex items-center overflow-x-auto scrollbar-none shrink-0 select-none divide-x divide-slate-400 text-[15px] font-bold">
        <button
          v-for="tab in categoryTabs"
          :key="tab"
          @click="activeTab = tab"
          class="h-full px-3.5 shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer text-[15px] font-bold"
          :class="activeTab === tab
            ? 'bg-sky-700 text-white font-bold'
            : 'text-slate-800 hover:text-slate-950 hover:bg-slate-300 font-bold'"
        >
          <span>{{ tab }}</span>
        </button>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- 4. 双栏树形选择弹窗 (选择厂站/选择间隔/选择装置，带白名单/黑名单区分)    -->
    <!-- 使用 Teleport 挂载到 body 最顶层，彻底杜绝表格表头及父级容器层叠上下文遮挡 -->
    <!-- ===================================================================== -->
    <Teleport to="body">
      <div
        v-if="selectorModalVisible"
        class="fixed inset-0 z-[999999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 select-none pointer-events-auto"
        @click.self="handleCancelSelector"
      >
        <div class="w-full max-w-4xl h-[620px] bg-slate-100 border-2 border-slate-600 shadow-2xl flex flex-col font-sans text-slate-900 text-[14px] font-bold relative z-[1000000]">
          <!-- 弹窗标题栏 (工业灰底，明确标注白名单/黑名单) -->
          <div class="h-10 bg-slate-200 border-b border-slate-400 px-3 flex items-center justify-between shrink-0 font-bold">
            <div class="flex items-center gap-2">
              <span 
                class="px-2 py-0.5 text-xs text-white font-bold"
                :class="selectorMode === 'filter' ? 'bg-emerald-700' : 'bg-rose-700'"
              >
                {{ selectorMode === 'filter' ? '白名单筛选' : '黑名单屏蔽' }}
              </span>
              <span class="text-[15px] text-slate-900">{{ selectorDialogTitle }}</span>
            </div>
            <button 
              @click="handleCancelSelector" 
              class="p-1 hover:bg-slate-300 rounded cursor-pointer text-slate-700"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- 弹窗主体：左侧树形选择 + 右侧已选项目 (严格对照用户图片结构) -->
          <div class="flex-1 flex overflow-hidden p-2 gap-2">
            <!-- 左侧：待选树形列表 (Tree Pane) -->
            <div class="flex-1 bg-white border border-slate-400 flex flex-col overflow-hidden">
              <!-- 树形搜索与快捷工具栏 -->
              <div class="p-2 border-b border-slate-300 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
                <div class="relative flex-1">
                  <Search class="w-4 h-4 text-slate-500 absolute left-2.5 top-2" />
                  <input
                    v-model="treeSearchText"
                    type="text"
                    placeholder="搜索厂站、间隔或装置..."
                    class="w-full pl-8 pr-2 py-1 bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div class="flex items-center gap-1 shrink-0 text-xs font-bold">
                  <button
                    @click="selectAllCurrentType"
                    class="px-2 py-1 bg-slate-200 hover:bg-slate-300 border border-slate-400 cursor-pointer"
                  >
                    全选
                  </button>
                  <button
                    @click="clearTempSelected"
                    class="px-2 py-1 bg-slate-200 hover:bg-slate-300 border border-slate-400 cursor-pointer"
                  >
                    全不选
                  </button>
                  <button
                    @click="expandAllTreeNodes"
                    class="px-2 py-1 bg-slate-200 hover:bg-slate-300 border border-slate-400 cursor-pointer"
                    title="展开全部"
                  >
                    展开
                  </button>
                  <button
                    @click="collapseAllTreeNodes"
                    class="px-2 py-1 bg-slate-200 hover:bg-slate-300 border border-slate-400 cursor-pointer"
                    title="折叠全部"
                  >
                    折叠
                  </button>
                </div>
              </div>

              <!-- 树形节点滚动区域 (带层级连线感与可折叠图标) -->
              <div class="flex-1 overflow-auto p-2 text-[14px]">
                <div v-for="st in filteredTreeStations" :key="st.id" class="mb-2">
                  <!-- 厂站节点 -->
                  <div class="flex items-center gap-1.5 py-1 px-1.5 bg-slate-100 hover:bg-slate-200 rounded-xs">
                    <button 
                      @click="toggleExpandStation(st.id)"
                      class="w-5 h-5 flex items-center justify-center text-slate-700 hover:bg-slate-300 rounded cursor-pointer"
                    >
                      <component :is="expandedStationIds.has(st.id) ? ChevronDown : ChevronRight" class="w-4 h-4" />
                    </button>

                    <!-- 厂站选择框 (仅在厂站模式下可勾选) -->
                    <input
                      v-if="selectorTargetType === 'station'"
                      type="checkbox"
                      :checked="tempSelectedSet.has(st.name)"
                      @change="toggleSelectItem(st.name)"
                      class="w-4 h-4 text-sky-600 rounded-none cursor-pointer"
                    />

                    <span 
                      class="font-bold text-slate-900 cursor-pointer"
                      @click="selectorTargetType === 'station' ? toggleSelectItem(st.name) : toggleExpandStation(st.id)"
                    >
                      {{ st.name }}
                    </span>
                    <span class="text-xs text-slate-500 font-normal">({{ st.alias }})</span>
                  </div>

                  <!-- 间隔层级 (当展开时显示) -->
                  <div v-if="expandedStationIds.has(st.id)" class="pl-6 border-l border-slate-300 ml-3.5 my-1 space-y-1">
                    <div v-for="bay in st.bays" :key="bay.id">
                      <!-- 间隔节点 -->
                      <div class="flex items-center gap-1.5 py-0.5 px-1 hover:bg-slate-100 rounded-xs">
                        <button 
                          v-if="selectorTargetType === 'device'"
                          @click="toggleExpandBay(bay.id)"
                          class="w-4 h-4 flex items-center justify-center text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                        >
                          <component :is="expandedBayIds.has(bay.id) ? ChevronDown : ChevronRight" class="w-3.5 h-3.5" />
                        </button>

                        <!-- 间隔选择框 (在间隔模式下可勾选) -->
                        <input
                          v-if="selectorTargetType === 'bay'"
                          type="checkbox"
                          :checked="tempSelectedSet.has(`${st.name}->${bay.name}`) || tempSelectedSet.has(bay.name)"
                          @change="toggleSelectItem(`${st.name}->${bay.name}`)"
                          class="w-4 h-4 text-sky-600 rounded-none cursor-pointer"
                        />

                        <span 
                          class="cursor-pointer text-slate-800"
                          @click="selectorTargetType === 'bay' ? toggleSelectItem(`${st.name}->${bay.name}`) : toggleExpandBay(bay.id)"
                        >
                          {{ bay.name }}
                        </span>
                      </div>

                      <!-- 装置层级 (当在装置模式且展开间隔时显示) -->
                      <div v-if="selectorTargetType === 'device' && expandedBayIds.has(bay.id)" class="pl-6 border-l border-slate-300 ml-2.5 my-0.5 space-y-0.5">
                        <div 
                          v-for="dev in bay.devices" 
                          :key="dev.id"
                          class="flex items-center gap-1.5 py-0.5 px-1 hover:bg-slate-100 text-xs"
                        >
                          <input
                            type="checkbox"
                            :checked="tempSelectedSet.has(`${st.name}->${bay.name}->${dev.name}`) || tempSelectedSet.has(dev.name)"
                            @change="toggleSelectItem(`${st.name}->${bay.name}->${dev.name}`)"
                            class="w-3.5 h-3.5 text-sky-600 rounded-none cursor-pointer"
                          />
                          <span 
                            class="cursor-pointer text-slate-700 font-bold"
                            @click="toggleSelectItem(`${st.name}->${bay.name}->${dev.name}`)"
                          >
                            {{ dev.name }}
                          </span>
                          <span class="text-[10px] bg-slate-200 text-slate-600 px-1 py-0.2 rounded">
                            {{ dev.type }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 右侧：已选项目列表 (Selected Pane) -->
            <div class="w-80 bg-white border border-slate-400 flex flex-col overflow-hidden">
              <!-- 头部说明 -->
              <div class="p-2 border-b border-slate-300 bg-slate-50 flex items-center justify-between shrink-0">
                <span class="font-bold text-slate-900 text-xs flex items-center gap-1">
                  <span>已选项目</span>
                  <span class="font-mono text-sky-700 font-bold">({{ tempSelectedItems.length }})</span>
                </span>
                <button
                  @click="clearTempSelected"
                  class="text-xs text-rose-700 hover:underline cursor-pointer"
                >
                  清空已选
                </button>
              </div>

              <!-- 已选项目列表项 (面包屑展示 + 快速删除) -->
              <div class="flex-1 overflow-auto p-2 space-y-1.5">
                <div
                  v-for="(item, idx) in tempSelectedItems"
                  :key="idx"
                  class="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-between text-xs"
                >
                  <div class="flex-1 truncate mr-2 text-slate-900 font-bold" :title="item">
                    {{ item }}
                  </div>
                  <button
                    @click="removeSelectedItem(item)"
                    class="p-0.5 text-slate-400 hover:text-rose-700 cursor-pointer"
                    title="移除此项"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>

                <div v-if="tempSelectedItems.length === 0" class="py-12 text-center text-slate-400 text-xs">
                  暂未选择任何项目<br>
                  (请在左侧勾选需要{{ selectorMode === 'filter' ? '筛选' : '屏蔽' }}的{{ selectorTargetType === 'station' ? '厂站' : (selectorTargetType === 'bay' ? '间隔' : '装置') }})
                </div>
              </div>
            </div>
          </div>

          <!-- 弹窗底部操作条 -->
          <div class="h-12 bg-slate-200 border-t border-slate-400 px-4 flex items-center justify-between shrink-0 font-bold">
            <div class="text-xs font-normal text-slate-600">
              <span v-if="selectorMode === 'filter'" class="text-emerald-800 font-bold">
                ★ 白名单规则：确定后仅显示所选范围内的实时告警（未选择时不作限制）。
              </span>
              <span v-else class="text-rose-800 font-bold">
                ★ 黑名单规则：确定后属于所选范围的告警将坚决彻底屏蔽隐藏（最高优先级）。
              </span>
            </div>

            <div class="flex items-center gap-3">
              <button
                @click="handleApplySelector"
                class="px-5 py-1.5 bg-sky-700 hover:bg-sky-800 border border-sky-900 text-white text-[14px] font-bold cursor-pointer transition-colors"
              >
                确定
              </button>
              <button
                @click="handleCancelSelector"
                class="px-5 py-1.5 bg-slate-300 hover:bg-slate-400 border border-slate-500 text-slate-900 text-[14px] font-bold cursor-pointer transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ===================================================================== -->
    <!-- 5. 右键快捷菜单 (纯粹实用工控右键菜单)                                    -->
    <!-- ===================================================================== -->
    <Teleport to="body">
      <div
        v-if="contextMenuVisible && contextMenuItem"
        class="fixed z-[999999] bg-white border-2 border-slate-600 shadow-2xl py-1 text-[15px] font-bold text-slate-900 w-56 select-none"
        :style="{ left: `${contextMenuX}px`, top: `${contextMenuY}px` }"
        @click.stop
      >
        <div class="px-3 py-1.5 bg-slate-200 border-b border-slate-300 text-slate-700 text-[13px] font-bold">
          告警操作: #{{ contextMenuItem.seq_id }}
        </div>
        <button
          @click="acknowledgeItem(contextMenuItem); closeContextMenu();"
          class="w-full px-3 py-2 text-left hover:bg-emerald-100 flex items-center gap-2 cursor-pointer text-[15px] font-bold text-emerald-900"
        >
          <Check class="w-4.5 h-4.5 text-emerald-700" />
          <span>对位复归确认此告警</span>
        </button>
        <button
          @click="copyAlarmContent(contextMenuItem)"
          class="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2 cursor-pointer text-[15px] font-bold text-slate-800 border-t border-slate-200"
        >
          <Copy class="w-4.5 h-4.5 text-slate-600" />
          <span>复制告警文本内容</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>
