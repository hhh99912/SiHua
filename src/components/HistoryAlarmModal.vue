<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  History,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  RotateCcw,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet
} from 'lucide-vue-next';

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
const selectedStation = ref('全部厂站');
const searchText = ref('');
const startDate = ref('2026-10-23 00:00:00');
const endDate = ref('2026-10-23 23:59:59');

// 告警类别标签 (完全对齐 RealtimeAlarmModal)
const categoryTabs = [
  '全部历史',
  '时序信息',
  '重要遥信',
  '事故',
  '越限告警',
  '异常',
  '变位',
  '告知',
  'SOE',
  'COS',
  '装置自检',
  '保护事件',
  '系统信息'
];

const activeTab = ref('全部历史');

// 模拟历史告警事件记录
interface HistoryAlarmRecord {
  id: string;
  index: number;
  time: string;
  recoveryTime: string;
  station: string;
  bay: string;
  device: string;
  level: '事故' | '越限' | '异常' | '变位' | '告知';
  category: string;
  content: string;
  ackUser: string;
  ackTime: string;
}

const mockHistoryRecords = ref<HistoryAlarmRecord[]>([
  {
    id: 'HALM-001',
    index: 1,
    time: '2026-10-23 11:24:18.420',
    recoveryTime: '2026-10-23 11:32:05.110',
    station: '速利达光伏电站',
    bay: '35kV开关室',
    device: '101断路器',
    level: '事故',
    category: '保护事件',
    content: '速利达站 35kV 101断路器 零序过流I段动作 跳闸',
    ackUser: '值班员-张工',
    ackTime: '2026-10-23 11:24:30'
  },
  {
    id: 'HALM-002',
    index: 2,
    time: '2026-10-23 10:15:02.100',
    recoveryTime: '2026-10-23 10:45:19.330',
    station: '速利达光伏电站',
    bay: '#1逆变升压区',
    device: '#1逆变器',
    level: '越限',
    category: '越限告警',
    content: '#1逆变器 直流侧输入电压过高 越上限告警 (当前: 1045V, 阈值: 1000V)',
    ackUser: '值班员-李工',
    ackTime: '2026-10-23 10:16:05'
  },
  {
    id: 'HALM-003',
    index: 3,
    time: '2026-10-23 09:30:45.000',
    recoveryTime: '2026-10-23 09:31:02.000',
    station: '速利达光伏电站',
    bay: '升压站主变',
    device: '#1主变本体',
    level: '异常',
    category: '告知',
    content: '#1主变压器 油温过高预警 (当前温度: 82.5℃)',
    ackUser: '值长-王工',
    ackTime: '2026-10-23 09:32:10'
  },
  {
    id: 'HALM-004',
    index: 4,
    time: '2026-10-23 08:00:15.890',
    recoveryTime: '--',
    station: '速利达光伏电站',
    bay: '数据通信室',
    device: '远动通信网关',
    level: '告知',
    category: '系统信息',
    content: '对调度自动化主站 104 通道发生主备机自动切换，当前为主机通信',
    ackUser: '系统自动确认',
    ackTime: '2026-10-23 08:00:16'
  },
  {
    id: 'HALM-005',
    index: 5,
    time: '2026-10-23 06:45:00.000',
    recoveryTime: '2026-10-23 06:45:01.000',
    station: '速利达光伏电站',
    bay: '光伏场区方阵A',
    device: '箱式变压器01',
    level: '变位',
    category: 'COS',
    content: '箱变低压侧进线分离开关 状态变位: 分闸 -> 合闸',
    ackUser: '值班员-张工',
    ackTime: '2026-10-23 06:46:00'
  }
]);

const filteredRecords = computed(() => {
  return mockHistoryRecords.value.filter(item => {
    if (selectedLevel.value !== '全部' && item.level !== selectedLevel.value) {
      return false;
    }
    if (activeTab.value !== '全部历史' && item.category !== activeTab.value) {
      return false;
    }
    if (searchText.value) {
      const q = searchText.value.trim().toLowerCase();
      const match = item.content.toLowerCase().includes(q) ||
        item.device.toLowerCase().includes(q) ||
        item.bay.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
});

const isSearching = ref(false);
const handleSearch = () => {
  isSearching.value = true;
  setTimeout(() => {
    isSearching.value = false;
  }, 300);
};

const handleReset = () => {
  selectedLevel.value = '全部';
  selectedStation.value = '全部厂站';
  searchText.value = '';
  activeTab.value = '全部历史';
};
</script>

<template>
  <div 
    v-if="visible"
    :class="[
      isEmbedded 
        ? 'w-full h-full bg-white text-slate-800 flex flex-col font-sans select-none overflow-hidden text-sm'
        : 'fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex flex-col select-none p-1 md:p-2'
    ]"
  >
    <div 
      class="w-full h-full bg-white text-slate-800 flex flex-col font-sans select-none overflow-hidden text-sm"
      :class="{ 'rounded-lg shadow-2xl border border-slate-300': !isEmbedded }"
    >
      <!-- 非嵌入模式下的顶部标题栏 -->
      <div 
        v-if="!isEmbedded"
        class="h-11 bg-slate-100 border-b border-slate-300 px-4 flex items-center justify-between shrink-0 select-none"
      >
        <div class="flex items-center gap-2.5 font-bold text-slate-800 text-base">
          <History class="w-5 h-5 text-orange-500" />
          <span>历史告警中心 (历史 SOE / COS 事件与越限归档记录)</span>
        </div>
        <button
          @click="emit('close')"
          class="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          title="关闭告警窗"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- ===================================================================== -->
      <!-- 1. 顶部操作工具栏 (仿全站告警 RealtimeAlarmModal 样式)                   -->
      <!-- ===================================================================== -->
      <div class="h-11 bg-slate-50 border-b border-slate-300 px-3 flex items-center justify-between shrink-0 select-none overflow-x-auto gap-3">
        <!-- 左侧：筛选器群 -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- 等级筛选 -->
          <div class="flex items-center gap-1 text-xs text-slate-700">
            <span class="font-medium text-slate-600">级别:</span>
            <select
              v-model="selectedLevel"
              class="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="全部">全部等级</option>
              <option value="事故">事故</option>
              <option value="越限">越限</option>
              <option value="异常">异常</option>
              <option value="变位">变位</option>
              <option value="告知">告知</option>
            </select>
          </div>

          <div class="h-5 w-[1px] bg-slate-300 mx-0.5" />

          <!-- 起止时间范围 -->
          <div class="flex items-center gap-1 text-xs text-slate-700 bg-white border border-slate-300 rounded px-2 py-1">
            <Calendar class="w-3.5 h-3.5 text-slate-400" />
            <input v-model="startDate" class="w-34 font-mono focus:outline-none text-slate-800" placeholder="开始时间" />
            <span class="text-slate-400">至</span>
            <input v-model="endDate" class="w-34 font-mono focus:outline-none text-slate-800" placeholder="结束时间" />
          </div>

          <!-- 关键字快速搜索 -->
          <div class="relative">
            <input
              v-model="searchText"
              placeholder="搜设备/间隔/内容..."
              class="w-42 pl-7 pr-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none"
            />
            <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
          </div>
        </div>

        <!-- 右侧：查询与导出按钮 -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            @click="handleSearch"
            class="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            :disabled="isSearching"
            title="执行历史告警查询"
          >
            <Search class="w-4 h-4" :class="{ 'animate-spin': isSearching }" />
            <span>{{ isSearching ? '检索中...' : '查询历史' }}</span>
          </button>

          <button
            @click="handleReset"
            class="px-2.5 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1"
            title="重置检索条件"
          >
            <RotateCcw class="w-3.5 h-3.5 text-slate-500" />
            <span>重置</span>
          </button>

          <button
            class="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="导出当前筛选告警到 EXCEL"
          >
            <Download class="w-4 h-4 text-slate-500" />
            <span>导出</span>
          </button>

          <button
            class="px-2.5 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1"
            title="打印历史报告"
          >
            <Printer class="w-3.5 h-3.5 text-slate-500" />
            <span>打印</span>
          </button>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- 2. 主体表格数据区 (高密度真实 SCADA 历史告警列表)                         -->
      <!-- ===================================================================== -->
      <div class="flex-1 overflow-auto bg-white">
        <table class="w-full border-collapse text-left text-xs">
          <!-- 表头 -->
          <thead class="bg-slate-100 border-b border-slate-300 sticky top-0 z-10 text-slate-700 select-none">
            <tr>
              <th class="py-2 px-2.5 font-bold w-12 text-center border-r border-slate-200">序号</th>
              <th class="py-2 px-2.5 font-bold w-44 border-r border-slate-200">发生时间</th>
              <th class="py-2 px-2.5 font-bold w-44 border-r border-slate-200">消除时间</th>
              <th class="py-2 px-2.5 font-bold w-20 text-center border-r border-slate-200">级别</th>
              <th class="py-2 px-2.5 font-bold w-24 border-r border-slate-200">类别</th>
              <th class="py-2 px-2.5 font-bold w-32 border-r border-slate-200">厂站</th>
              <th class="py-2 px-2.5 font-bold w-28 border-r border-slate-200">间隔</th>
              <th class="py-2 px-2.5 font-bold w-32 border-r border-slate-200">设备</th>
              <th class="py-2 px-3 font-bold border-r border-slate-200">告警信息与动作描述</th>
              <th class="py-2 px-2.5 font-bold w-24 border-r border-slate-200">确认人</th>
              <th class="py-2 px-2.5 font-bold w-36">确认时间</th>
            </tr>
          </thead>

          <!-- 列表内容 -->
          <tbody class="divide-y divide-slate-200 font-mono">
            <tr
              v-for="item in filteredRecords"
              :key="item.id"
              class="hover:bg-sky-50/70 transition-colors cursor-pointer text-slate-800"
              :class="{
                'bg-rose-50/50 text-rose-900': item.level === '事故',
                'bg-amber-50/40 text-amber-900': item.level === '越限'
              }"
            >
              <td class="py-2 px-2.5 text-center text-slate-500 border-r border-slate-200 font-sans">{{ item.index }}</td>
              <td class="py-2 px-2.5 border-r border-slate-200 text-slate-700">{{ item.time }}</td>
              <td class="py-2 px-2.5 border-r border-slate-200 text-slate-500">{{ item.recoveryTime }}</td>
              <td class="py-2 px-2.5 text-center border-r border-slate-200">
                <span 
                  class="px-2 py-0.5 rounded text-[11px] font-bold font-sans"
                  :class="{
                    'bg-rose-600 text-white': item.level === '事故',
                    'bg-amber-500 text-white': item.level === '越限',
                    'bg-orange-500 text-white': item.level === '异常',
                    'bg-sky-600 text-white': item.level === '变位',
                    'bg-slate-200 text-slate-700': item.level === '告知'
                  }"
                >
                  {{ item.level }}
                </span>
              </td>
              <td class="py-2 px-2.5 border-r border-slate-200 font-sans text-slate-600">{{ item.category }}</td>
              <td class="py-2 px-2.5 border-r border-slate-200 font-sans text-slate-700 truncate">{{ item.station }}</td>
              <td class="py-2 px-2.5 border-r border-slate-200 font-sans text-slate-700 truncate">{{ item.bay }}</td>
              <td class="py-2 px-2.5 border-r border-slate-200 font-sans text-slate-800 font-bold truncate">{{ item.device }}</td>
              <td class="py-2 px-3 border-r border-slate-200 font-sans font-medium text-slate-900">{{ item.content }}</td>
              <td class="py-2 px-2.5 border-r border-slate-200 font-sans text-slate-600">{{ item.ackUser }}</td>
              <td class="py-2 px-2.5 text-slate-500">{{ item.ackTime }}</td>
            </tr>

            <!-- 空状态提示 -->
            <tr v-if="filteredRecords.length === 0">
              <td colspan="11" class="py-16 text-center text-slate-400 font-sans">
                <div class="flex flex-col items-center gap-2">
                  <History class="w-10 h-10 text-slate-300" />
                  <span class="text-sm">未检索到符合条件的历史告警或事件记录</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ===================================================================== -->
      <!-- 3. 底部各分类标签 (完全对齐 RealtimeAlarmModal 样式)                     -->
      <!-- ===================================================================== -->
      <div class="h-9 bg-slate-100 border-t border-slate-300 px-2 flex items-center justify-between shrink-0 select-none text-xs">
        <div class="flex items-center gap-1 overflow-x-auto">
          <button
            v-for="tab in categoryTabs"
            :key="tab"
            @click="activeTab = tab"
            class="px-2.5 py-1 rounded font-bold transition-colors cursor-pointer text-xs"
            :class="activeTab === tab ? 'bg-sky-700 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'"
          >
            {{ tab }}
          </button>
        </div>

        <div class="flex items-center gap-3 text-slate-600 font-mono text-xs pr-2 shrink-0">
          <span>记录数: <strong class="text-slate-900">{{ filteredRecords.length }}</strong> 条</span>
          <div class="flex items-center gap-1 border-l border-slate-300 pl-3">
            <button class="p-1 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer" disabled>
              <ChevronLeft class="w-3.5 h-3.5" />
            </button>
            <span class="font-sans">1 / 1 页</span>
            <button class="p-1 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer" disabled>
              <ChevronRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
