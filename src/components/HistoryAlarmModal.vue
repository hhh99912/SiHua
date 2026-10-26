<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  History,
  Search,
  Download,
  Printer,
  Calendar,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  RefreshCw
} from 'lucide-vue-next';
import {
  queryScadaWarnHistory,
  ScadaHistoryWarnItem
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

// 筛选状态
const selectedLevel = ref('全部');
const searchText = ref('');

// 起止时间格式化 (默认查询最近 24 小时)
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

const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);

const startDate = ref(formatDateTime(yesterday));
const endDate = ref(formatDateTime(now));

// 完整对齐后端告警底栏分类种类
const categoryTabs = [
  '全部历史',
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

const activeTab = ref('全部历史');
const isSearching = ref(false);
const historyRecords = ref<ScadaHistoryWarnItem[]>([]);
const totalRecords = ref(0);

// 右键菜单状态
const contextMenuVisible = ref<boolean>(false);
const contextMenuX = ref<number>(0);
const contextMenuY = ref<number>(0);
const contextMenuItem = ref<ScadaHistoryWarnItem | null>(null);

// 解析时间字符串为秒级时间戳 (Unix Timestamp)
const parseTimestamp = (dtStr: string): number => {
  const ts = new Date(dtStr).getTime();
  return isNaN(ts) ? 0 : Math.floor(ts / 1000);
};

// 执行历史告警综合多维检索 (POST /api/scada/warn/history)
const executeHistorySearch = async () => {
  isSearching.value = true;
  try {
    const startSec = parseTimestamp(startDate.value);
    const endSec = parseTimestamp(endDate.value) || Math.floor(Date.now() / 1000);

    let levelIds: number[] = [];
    let selectAllLevel = true;
    if (selectedLevel.value === '事故跳闸') {
      selectAllLevel = false;
      levelIds = [3];
    } else if (selectedLevel.value === '告警越限') {
      selectAllLevel = false;
      levelIds = [2];
    } else if (selectedLevel.value === '提示预告') {
      selectAllLevel = false;
      levelIds = [1];
    } else if (selectedLevel.value === '操作记录') {
      selectAllLevel = false;
      levelIds = [4];
    }

    const res = await queryScadaWarnHistory({
      start_time: startSec,
      end_time: endSec,
      search_type: 0,
      select_all_fac: true,
      select_all_bay: true,
      select_all_dev: true,
      select_all_level: selectAllLevel,
      level_ids: levelIds,
      keyword: searchText.value.trim(),
      limit: 500
    });

    if (res.success && res.data) {
      historyRecords.value = res.data;
      totalRecords.value = res.total ?? res.data.length;
    }
  } catch (err) {
    console.warn('历史告警检索失败:', err);
  } finally {
    isSearching.value = false;
  }
};

// 类别标签过滤后的列表
const filteredRecords = computed(() => {
  return historyRecords.value.filter(item => {
    const tab = activeTab.value;
    if (tab === '全部历史') return true;
    if (tab === '事故跳闸') {
      return (item.content || '').includes('事故') || (item.content || '').includes('跳闸') || item.table_no === 362;
    }
    if (tab === '告警越限') {
      return item.table_no === 44 || (item.content || '').includes('越限');
    }
    if (tab === '提示预告') {
      return (item.content || '').includes('提示') || (item.content || '').includes('预告');
    }
    if (tab === '遥信变位') {
      return item.table_no === 43 || (item.table_name || '').includes('变位');
    }
    if (tab === '遥测越限') {
      return item.table_no === 44 || (item.table_name || '').includes('越限');
    }
    if (tab === '保护动作') {
      return item.table_no === 362 || (item.table_name || '').includes('保护');
    }
    if (tab === '事件SOE') {
      return item.table_no === 55 || (item.table_name || '').includes('SOE');
    }
    if (tab === '人工遥控') {
      return item.table_no === 50 || (item.table_name || '').includes('遥控');
    }
    if (tab === '人工遥调') {
      return item.table_no === 51 || (item.table_name || '').includes('遥调');
    }
    if (tab === '操作记录') {
      return item.table_no === 50 || item.table_no === 51 || (item.operator || '') !== '';
    }
    return (item.table_name || '').includes(tab);
  });
});

// 重置检索条件
const handleReset = () => {
  selectedLevel.value = '全部';
  searchText.value = '';
  activeTab.value = '全部历史';
  const n = new Date();
  const y = new Date(n.getTime() - 24 * 3600 * 1000);
  startDate.value = formatDateTime(y);
  endDate.value = formatDateTime(n);
  executeHistorySearch();
};

// 右键菜单与诊断分析报告
const handleRowContextMenu = (e: MouseEvent, item: ScadaHistoryWarnItem) => {
  e.preventDefault();
  contextMenuItem.value = item;
  contextMenuX.value = e.clientX;
  contextMenuY.value = e.clientY;
  contextMenuVisible.value = true;
};

const closeContextMenu = () => {
  contextMenuVisible.value = false;
};

const copyAlarmContent = (item: ScadaHistoryWarnItem) => {
  closeContextMenu();
  if (navigator.clipboard && item.content) {
    navigator.clipboard.writeText(item.content);
  }
};

// 导出 CSV 报表
const handleExport = () => {
  const headers = ['序号', '发生时间', '子表/类别', '别名/测点', '状态值', '告警内容', '操作员', '服务主机'];
  const rows = filteredRecords.value.map((item, idx) => [
    idx + 1,
    item.time,
    item.table_name,
    item.alias || `KEY_${item.key_id}`,
    item.val ?? item.status ?? 0,
    `"${(item.content || '').replace(/"/g, '""')}"`,
    item.operator || '--',
    item.host || '--'
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `GE_SCADA_历史告警检索_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 打印
const handlePrint = () => {
  window.print();
};

onMounted(() => {
  window.addEventListener('click', closeContextMenu);
  executeHistorySearch();
});

onBeforeUnmount(() => {
  window.removeEventListener('click', closeContextMenu);
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
      <!-- 非嵌入模式下的顶部标题栏 -->
      <div 
        v-if="!isEmbedded"
        class="h-11 bg-slate-200 border-b border-slate-400 px-4 flex items-center justify-between shrink-0 select-none text-[15px] font-bold"
      >
        <div class="flex items-center gap-2.5 font-bold text-slate-900 text-[15px]">
          <History class="w-5 h-5 text-orange-600" />
          <span>历史告警中心 (历史 SOE / COS 事件与越限归档记录)</span>
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
      <!-- 1. 顶部操作工具栏 (字体统一 text-[15px] font-bold，无卡片设计)            -->
      <!-- ===================================================================== -->
      <div class="h-11 bg-slate-100 border-b border-slate-400 px-3 flex items-center justify-between shrink-0 select-none overflow-x-auto gap-3 text-[15px] font-bold">
        <!-- 左侧：筛选器群 -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- 等级筛选 -->
          <div class="flex items-center gap-1.5 text-[15px] font-bold text-slate-900">
            <span>级别:</span>
            <select
              v-model="selectedLevel"
              class="px-2.5 py-1 bg-white border border-slate-400 text-[15px] font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="全部">全部级别</option>
              <option value="事故跳闸">事故跳闸</option>
              <option value="告警越限">告警越限</option>
              <option value="提示预告">提示预告</option>
              <option value="操作记录">操作记录</option>
            </select>
          </div>

          <!-- 起止时间范围 -->
          <div class="flex items-center gap-1.5 text-[15px] font-bold text-slate-900 bg-white border border-slate-400 px-2 py-1">
            <Calendar class="w-4 h-4 text-slate-600" />
            <input v-model="startDate" class="w-40 font-mono focus:outline-none text-slate-900 text-[15px] font-bold" placeholder="开始时间" />
            <span class="text-slate-500 font-bold">至</span>
            <input v-model="endDate" class="w-40 font-mono focus:outline-none text-slate-900 text-[15px] font-bold" placeholder="结束时间" />
          </div>

          <!-- 关键字快速搜索 -->
          <div class="relative">
            <input
              v-model="searchText"
              @keyup.enter="executeHistorySearch"
              placeholder="搜设备/间隔/内容/别名..."
              class="w-52 pl-7 pr-2 py-1 bg-white border border-slate-400 text-[15px] font-bold text-slate-900 focus:outline-none"
            />
            <Search class="w-4 h-4 text-slate-500 absolute left-2 top-2" />
          </div>
        </div>

        <!-- 右侧：查询与导出按钮 -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            @click="executeHistorySearch"
            class="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 border border-sky-900 text-white text-[15px] font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            :disabled="isSearching"
            title="向 SCADA 历史服务发起综合多维查询"
          >
            <Search class="w-4 h-4" :class="{ 'animate-spin': isSearching }" />
            <span>{{ isSearching ? '检索中...' : '查询历史' }}</span>
          </button>

          <button
            @click="handleReset"
            class="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-900 text-[15px] font-bold transition-colors cursor-pointer flex items-center gap-1"
            title="重置检索条件"
          >
            <RotateCcw class="w-4 h-4 text-slate-700" />
            <span>重置</span>
          </button>

          <button
            @click="handleExport"
            class="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-900 text-[15px] font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            title="导出当前筛选结果到 CSV"
          >
            <Download class="w-4 h-4 text-slate-700" />
            <span>导出</span>
          </button>

          <button
            @click="handlePrint"
            class="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-900 text-[15px] font-bold transition-colors cursor-pointer flex items-center gap-1"
            title="打印历史报告"
          >
            <Printer class="w-4 h-4 text-slate-700" />
            <span>打印</span>
          </button>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- 2. 主体表格数据区 (字体统一 text-[15px] font-bold，无卡片设计)             -->
      <!-- ===================================================================== -->
      <div class="flex-1 overflow-auto bg-white">
        <table class="w-full border-collapse text-left text-[15px] font-bold">
          <!-- 表头 -->
          <thead class="bg-slate-200 border-b-2 border-slate-400 sticky top-0 z-10 text-slate-900 font-bold select-none text-[15px]">
            <tr>
              <th class="py-2.5 px-3 w-16 text-center border-r border-slate-400 font-bold">序号</th>
              <th class="py-2.5 px-3 w-56 border-r border-slate-400 font-bold">发生时间</th>
              <th class="py-2.5 px-3 w-32 text-center border-r border-slate-400 font-bold">子表/类型</th>
              <th class="py-2.5 px-3 w-48 border-r border-slate-400 font-bold">测点/别名</th>
              <th class="py-2.5 px-3 w-28 text-center border-r border-slate-400 font-bold">状态值</th>
              <th class="py-2.5 px-4 font-bold border-r border-slate-400">告警信息与动作描述 (支持右键分析报告)</th>
              <th class="py-2.5 px-3 w-32 border-r border-slate-400 font-bold">操作人</th>
              <th class="py-2.5 px-3 w-36 font-bold">服务主机</th>
            </tr>
          </thead>

          <!-- 列表内容 -->
          <tbody class="divide-y divide-slate-300">
            <tr
              v-for="(item, idx) in filteredRecords"
              :key="idx"
              @contextmenu="handleRowContextMenu($event, item)"
              class="hover:bg-slate-100 transition-colors cursor-pointer text-slate-900 text-[15px] font-bold border-b border-slate-300"
              :class="{
                'bg-rose-50 text-rose-950 font-bold': item.table_no === 362 || (item.content || '').includes('事故') || (item.content || '').includes('跳闸'),
                'bg-amber-50 text-amber-950 font-bold': item.table_no === 44 || (item.content || '').includes('越限')
              }"
            >
              <td class="py-2 px-3 text-center text-slate-600 border-r border-slate-300 font-mono text-[15px] font-bold">{{ idx + 1 }}</td>
              <td class="py-2 px-3 border-r border-slate-300 text-slate-800 font-mono text-[15px] font-bold">{{ item.time }}</td>
              <td class="py-2 px-3 text-center border-r border-slate-300 text-[15px] font-bold">
                <span 
                  :class="{
                    'text-rose-700': item.table_no === 362 || (item.content || '').includes('事故'),
                    'text-amber-700': item.table_no === 44,
                    'text-indigo-700': item.table_no === 55,
                    'text-sky-700': item.table_no === 43,
                    'text-slate-800': item.table_no === 50 || item.table_no === 51
                  }"
                >
                  {{ item.table_name }}
                </span>
              </td>
              <td class="py-2 px-3 border-r border-slate-300 text-slate-700 truncate font-mono text-[15px] font-bold">{{ item.alias || `KEY_${item.key_id}` }}</td>
              <td class="py-2 px-3 border-r border-slate-300 text-center font-bold text-slate-900 text-[15px]">{{ item.val ?? item.status ?? '--' }}</td>
              <td 
                class="py-2 px-4 border-r border-slate-300 font-bold text-[15px]"
                :class="(item.table_no === 362 || (item.content || '').includes('事故')) ? 'text-rose-700' : 'text-slate-900'"
                :title="`${item.content}\n[右键点击可调出智能故障诊断分析报告]`"
              >
                {{ item.content }}
              </td>
              <td class="py-2 px-3 border-r border-slate-300 text-slate-700 text-[15px] font-bold">{{ item.operator || '--' }}</td>
              <td class="py-2 px-3 text-slate-600 text-[15px] font-bold font-mono">{{ item.host || 'SCADA-SVR' }}</td>
            </tr>

            <!-- 空状态提示 -->
            <tr v-if="filteredRecords.length === 0">
              <td colspan="8" class="py-16 text-center text-slate-500 text-[15px] font-bold">
                未检索到符合条件的历史告警或事件记录
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ===================================================================== -->
      <!-- 3. 底部各分类标签 (对齐后端所有种类，字体统一 text-[15px] font-bold)        -->
      <!-- ===================================================================== -->
      <div class="h-11 bg-slate-200 border-t border-slate-400 px-1 flex items-center justify-between shrink-0 select-none text-[15px] font-bold divide-x divide-slate-400">
        <div class="flex items-center gap-1 overflow-x-auto">
          <button
            v-for="tab in categoryTabs"
            :key="tab"
            @click="activeTab = tab"
            class="px-3.5 h-11 flex items-center font-bold transition-colors cursor-pointer text-[15px]"
            :class="activeTab === tab ? 'bg-sky-700 text-white' : 'text-slate-800 hover:bg-slate-300'"
          >
            {{ tab }}
          </button>
        </div>

        <div class="flex items-center gap-3 text-slate-800 text-[15px] font-bold pr-3 shrink-0 pl-3">
          <span>记录数: {{ filteredRecords.length }} 条</span>
          <div class="flex items-center gap-1 border-l border-slate-400 pl-3">
            <button class="p-1 hover:bg-slate-300 rounded-none disabled:opacity-30 cursor-pointer" disabled>
              <ChevronLeft class="w-4 h-4" />
            </button>
            <span>1 / 1 页</span>
            <button class="p-1 hover:bg-slate-300 rounded-none disabled:opacity-30 cursor-pointer" disabled>
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- 4. 右键快捷菜单 (接口7：右键点击事故跳闸告警调用“分析报告”)                 -->
    <!-- ===================================================================== -->
    <div
      v-if="contextMenuVisible && contextMenuItem"
      class="fixed z-70 bg-white border-2 border-slate-600 shadow-2xl py-1 text-[15px] font-bold text-slate-900 w-56 select-none"
      :style="{ left: `${contextMenuX}px`, top: `${contextMenuY}px` }"
      @click.stop
    >
      <div class="px-3 py-1.5 bg-slate-200 border-b border-slate-300 text-slate-700 text-[13px] font-bold">
        历史记录操作
      </div>
      <button
        @click="copyAlarmContent(contextMenuItem)"
        class="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2 cursor-pointer text-[15px] font-bold text-slate-800"
      >
        <Copy class="w-4.5 h-4.5 text-slate-600" />
        <span>复制告警文本内容</span>
      </button>
    </div>
  </div>
</template>
