<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  CheckCheck,
  Trash2,
  Pause,
  Play,
  Save,
  Printer,
  Search,
  Settings,
  EyeOff,
  ShieldAlert,
  X,
  SlidersHorizontal,
  ChevronDown,
  Check,
  Square,
  CheckSquare,
  Bell
} from 'lucide-vue-next';

export interface AlarmItem {
  id: string;
  selected: boolean;
  acknowledged: boolean;
  station: string;
  bay: string;
  device: string;
  type: string;
  category: string;
  time: string;
  message: string;
}

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

// 底部各分类标签 (仿真实 SCADA 告警窗底部标签条)
const categoryTabs = [
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
  '系统信息',
  '命令信息',
  'VQC信息',
  '顺控信息',
  '检修信息'
];

const activeTab = ref<string>('时序信息');
const isPaused = ref<boolean>(false);
const showSettingsModal = ref<boolean>(false);
const showHistoryModal = ref<boolean>(false);
const historySearchText = ref<string>('');
const selectedAlarmIds = ref<Set<string>>(new Set());

// 预设告警流数据 (仿照现场光伏发电站/变电站真实运行告警)
const alarms = ref<AlarmItem[]>([
  {
    id: 'ALM-001',
    selected: false,
    acknowledged: false,
    station: '速利达光伏发电站',
    bay: '数据网关机A',
    device: '数据网关机',
    type: '系统',
    category: '系统信息',
    time: '2026-10-09 15:48:31.000',
    message: '数据网关机(数据网关机A)与服务器(serverA)连接失败'
  },
  {
    id: 'ALM-002',
    selected: false,
    acknowledged: false,
    station: '速利达光伏发电站',
    bay: 'Hmi1',
    device: '操作员站',
    type: '系统',
    category: '系统信息',
    time: '2026-10-09 15:47:32.000',
    message: '操作员站(Hmi1)与服务器(serverA)在A网通讯恢复'
  },
  {
    id: 'ALM-003',
    selected: false,
    acknowledged: false,
    station: '速利达光伏发电站',
    bay: 'AlarmInfo1',
    device: '告警窗',
    type: '系统',
    category: '系统信息',
    time: '2026-10-09 15:47:32.000',
    message: '告警窗(AlarmInfo1)与服务器(serverA)在A网通讯恢复'
  },
  {
    id: 'ALM-004',
    selected: false,
    acknowledged: false,
    station: '速利达光伏发电站',
    bay: 'serverA',
    device: '服务器',
    type: '系统',
    category: '系统信息',
    time: '2026-10-09 15:47:30.000',
    message: '服务器(serverA)成功启动'
  },
  {
    id: 'ALM-005',
    selected: false,
    acknowledged: true,
    station: '速利达光伏发电站',
    bay: '10kV 逆变升压区',
    device: '1#光伏逆变器',
    type: '越限告警',
    category: '越限告警',
    time: '2026-10-09 15:35:10.500',
    message: '1#光伏逆变器交流母线A相电压越上限: 10.78kV (定值: 10.50kV)'
  },
  {
    id: 'ALM-006',
    selected: false,
    acknowledged: true,
    station: '速利达光伏发电站',
    bay: '110kV 主变出线',
    device: '微机保护测控',
    type: '事故',
    category: '事故',
    time: '2026-10-09 15:20:00.120',
    message: '【事故SOE】110kV 主变进线 5011 断路器遥控分闸就位 (时标精度 1ms)'
  },
  {
    id: 'ALM-007',
    selected: false,
    acknowledged: true,
    station: '速利达光伏发电站',
    bay: '直流配电屏',
    device: '绝缘监测仪',
    type: '异常',
    category: '异常',
    time: '2026-10-09 15:10:22.800',
    message: '站用直流母线正极对地绝缘电阻降低: 25kΩ 预告'
  }
]);

// 过滤后的告警列表
const filteredAlarms = computed(() => {
  return alarms.value.filter(item => {
    // 分类匹配：'时序信息' 为全局总时序流水
    const matchTab = activeTab.value === '时序信息' || item.category === activeTab.value || item.type === activeTab.value;
    
    // 历史搜索关键词匹配
    const q = historySearchText.value.trim().toLowerCase();
    const matchSearch = !q || 
      item.message.toLowerCase().includes(q) ||
      item.bay.toLowerCase().includes(q) ||
      item.device.toLowerCase().includes(q) ||
      item.station.toLowerCase().includes(q);

    return matchTab && matchSearch;
  });
});

// 未确认数目
const unackCount = computed(() => {
  return filteredAlarms.value.filter(a => !a.acknowledged).length;
});

// 总数目
const totalCount = computed(() => {
  return filteredAlarms.value.length;
});

// 全选状态
const isAllSelected = computed(() => {
  return filteredAlarms.value.length > 0 && filteredAlarms.value.every(a => selectedAlarmIds.value.has(a.id));
});

// 切换单行选中
const toggleSelectRow = (id: string) => {
  if (selectedAlarmIds.value.has(id)) {
    selectedAlarmIds.value.delete(id);
  } else {
    selectedAlarmIds.value.add(id);
  }
};

// 切换全选
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedAlarmIds.value.clear();
  } else {
    filteredAlarms.value.forEach(a => selectedAlarmIds.value.add(a.id));
  }
};

// 确认选中的告警或双击单行确认
const acknowledgeItem = (item: AlarmItem) => {
  item.acknowledged = true;
};

// 确认全部
const handleAcknowledgeAll = () => {
  alarms.value.forEach(a => {
    a.acknowledged = true;
  });
};

// 清除全部 (清空已确认的告警)
const handleClearAll = () => {
  alarms.value = alarms.value.filter(a => !a.acknowledged);
  selectedAlarmIds.value.clear();
};

// 暂停 / 继续
const togglePause = () => {
  isPaused.value = !isPaused.value;
};

// 保存 (导出 CSV 报表)
const handleSave = () => {
  const headers = ['状态', '厂站', '间隔', '装置', '类型', '动作时间', '信息'];
  const rows = filteredAlarms.value.map(a => [
    a.acknowledged ? '已确认' : '未确认',
    a.station,
    a.bay,
    a.device,
    a.type,
    a.time,
    `"${a.message.replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `GE_SCADA_告警窗记录_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 打印
const handlePrint = () => {
  window.print();
};

// 模拟实时告警流微动 (仅在未暂停状态下)
let intervalTimer: any = null;
onMounted(() => {
  intervalTimer = setInterval(() => {
    if (isPaused.value) return;
    // 随机自检心跳
  }, 10000);
});

onBeforeUnmount(() => {
  if (intervalTimer) clearInterval(intervalTimer);
});
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
      <!-- 非嵌入模式下的全屏顶部标题栏 (含关闭按钮) -->
      <div 
        v-if="!isEmbedded"
        class="h-11 bg-slate-100 border-b border-slate-300 px-4 flex items-center justify-between shrink-0 select-none"
      >
        <div class="flex items-center gap-2.5 font-bold text-slate-800 text-base">
          <Bell class="w-5 h-5 text-rose-500" />
          <span>全站告警中心 (实时 SOE / COS 事件与越限记录)</span>
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
      <!-- 1. 顶部操作工具栏 (放大尺寸与图标，仿真实 SCADA: 选项, 确认全部, 清除全部, 暂停, 保存, 打印...) -->
      <!-- ===================================================================== -->
      <div class="h-11 bg-slate-50 border-b border-slate-300 px-3 flex items-center justify-between shrink-0 select-none">
        <!-- 左侧：功能操作按钮群 (字体与图标全面放大) -->
        <div class="flex items-center gap-1.5 overflow-x-auto">
          <!-- 选项菜单按钮 -->
          <button
            class="px-2.5 py-1.5 rounded hover:bg-slate-200 border border-transparent hover:border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
            title="系统选项"
          >
            <span>选项</span>
            <ChevronDown class="w-4 h-4 text-slate-500" />
          </button>

          <div class="h-5 w-[1px] bg-slate-300 mx-1" />

          <!-- 确认全部 -->
          <button
            @click="handleAcknowledgeAll"
            class="px-3 py-1.5 rounded bg-white hover:bg-emerald-50 border border-slate-300 hover:border-emerald-400 text-slate-700 hover:text-emerald-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="确认所有未确认告警"
          >
            <CheckCheck class="w-4.5 h-4.5 text-emerald-600 stroke-[2.2]" />
            <span>确认全部</span>
          </button>

          <!-- 清除全部 -->
          <button
            @click="handleClearAll"
            class="px-3 py-1.5 rounded bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-400 text-slate-700 hover:text-rose-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="清除所有已确认事件"
          >
            <Trash2 class="w-4.5 h-4.5 text-rose-500 stroke-[2.2]" />
            <span>清除全部</span>
          </button>

          <!-- 暂停 / 继续 -->
          <button
            @click="togglePause"
            class="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            :title="isPaused ? '恢复告警滚动刷新' : '暂停当前画面滚动'"
          >
            <component :is="isPaused ? Play : Pause" class="w-4.5 h-4.5 text-amber-600 stroke-[2.2]" />
            <span>{{ isPaused ? '继续' : '暂停' }}</span>
          </button>

          <!-- 保存 -->
          <button
            @click="handleSave"
            class="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="导出/保存当前告警清单为 CSV"
          >
            <Save class="w-4.5 h-4.5 text-sky-600 stroke-[2.2]" />
            <span>保存</span>
          </button>

          <!-- 打印 -->
          <button
            @click="handlePrint"
            class="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="打印当前列表"
          >
            <Printer class="w-4.5 h-4.5 text-slate-600 stroke-[2.2]" />
            <span>打印</span>
          </button>

          <!-- 历史查询 -->
          <button
            @click="showHistoryModal = !showHistoryModal"
            class="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            :class="{ 'bg-sky-50 border-sky-400 text-sky-800 font-bold': showHistoryModal }"
            title="按条件过滤或历史检索"
          >
            <Search class="w-4.5 h-4.5 text-indigo-600 stroke-[2.2]" />
            <span>历史查询</span>
          </button>

          <!-- 设置 -->
          <button
            @click="showSettingsModal = !showSettingsModal"
            class="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="告警窗显示与声音设置"
          >
            <Settings class="w-4.5 h-4.5 text-slate-600 stroke-[2.2]" />
            <span>设置</span>
          </button>

          <!-- 隐藏 -->
          <button
            @click="emit('close')"
            class="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="隐藏当前告警窗"
          >
            <EyeOff class="w-4.5 h-4.5 text-slate-500 stroke-[2.2]" />
            <span>隐藏</span>
          </button>

          <!-- 屏蔽配置 -->
          <button
            class="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="配置设备告警屏蔽规则"
          >
            <ShieldAlert class="w-4.5 h-4.5 text-amber-500 stroke-[2.2]" />
            <span>屏蔽配置</span>
          </button>
        </div>

        <!-- 右侧：统计摘要 >>>时序信息--未确认数目:4,总数目:4<<< (字体加大加粗) -->
        <div class="flex items-center text-sm font-mono font-bold text-sky-900 tracking-tight shrink-0 bg-sky-50 px-3 py-1 rounded border border-sky-300 shadow-2xs ml-2">
          &gt;&gt;&gt;{{ activeTab }}--未确认:{{ unackCount }} / 总数:{{ totalCount }}&lt;&lt;&lt;
        </div>
      </div>

      <!-- 历史检索展开小栏 (如果开启) -->
      <div
        v-if="showHistoryModal"
        class="bg-slate-100 border-b border-slate-300 px-4 py-2 flex items-center justify-between gap-3 shrink-0 animate-in slide-in-from-top-1 text-sm"
      >
        <div class="flex items-center gap-3 flex-1">
          <span class="font-bold text-slate-700 text-sm">过滤检索:</span>
          <input
            v-model="historySearchText"
            type="text"
            placeholder="输入厂站、间隔、设备或告警内容进行关键词过滤..."
            class="flex-1 max-w-lg bg-white border border-slate-300 rounded px-3 py-1 text-sm text-slate-800 focus:outline-none focus:border-sky-500"
          />
          <button
            v-if="historySearchText"
            @click="historySearchText = ''"
            class="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium cursor-pointer"
          >
            清空
          </button>
        </div>
        <button
          @click="showHistoryModal = false"
          class="text-slate-400 hover:text-slate-700 p-1 rounded"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- ===================================================================== -->
      <!-- 2. 中间主数据表格 (状态, 厂站, 间隔, 装置, 类型, 动作时间, 信息) - 字体与单元格全面放大 -->
      <!-- ===================================================================== -->
      <div class="flex-1 overflow-auto bg-white border-b border-slate-300 relative">
        <table class="w-full border-collapse text-left font-sans text-sm">
          <!-- 表头 (仿照片灰色质感表头，字号与行距加大) -->
          <thead class="sticky top-0 bg-slate-100 border-b border-slate-300 shadow-2xs z-10 text-slate-800 font-bold select-none text-sm">
            <tr>
              <!-- 状态 -->
              <th class="py-2.5 px-3 w-28 border-r border-slate-300 text-center">
                <div class="flex items-center justify-center gap-1.5 cursor-pointer" @click="toggleSelectAll">
                  <component :is="isAllSelected ? CheckSquare : Square" class="w-4.5 h-4.5 text-slate-600" />
                  <span class="text-sm font-bold">状态</span>
                </div>
              </th>

              <!-- 厂站 -->
              <th class="py-2.5 px-3 w-44 border-r border-slate-300 text-sm font-bold">
                厂站
              </th>

              <!-- 间隔 -->
              <th class="py-2.5 px-3 w-36 border-r border-slate-300 text-sm font-bold">
                间隔
              </th>

              <!-- 装置 -->
              <th class="py-2.5 px-3 w-36 border-r border-slate-300 text-sm font-bold">
                装置
              </th>

              <!-- 类型 -->
              <th class="py-2.5 px-3 w-24 border-r border-slate-300 text-center text-sm font-bold">
                类型
              </th>

              <!-- 动作时间 -->
              <th class="py-2.5 px-3 w-56 border-r border-slate-300 font-mono text-sm font-bold">
                动作时间
              </th>

              <!-- 信息 -->
              <th class="py-2.5 px-4 text-sm font-bold">
                信息内容
              </th>
            </tr>
          </thead>

          <!-- 表体数据行 (行高与文字放大，保证工业大屏清晰辨认) -->
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="item in filteredAlarms"
              :key="item.id"
              @click="toggleSelectRow(item.id)"
              @dblclick="acknowledgeItem(item)"
              class="transition-colors cursor-pointer select-none text-sm"
              :class="[
                selectedAlarmIds.has(item.id) 
                  ? 'bg-sky-100/90 text-sky-950 font-medium' 
                  : !item.acknowledged 
                    ? 'bg-white hover:bg-rose-50/60' 
                    : 'bg-white hover:bg-slate-50 text-slate-600'
              ]"
            >
              <!-- 状态 (未确认/已确认) -->
              <td class="py-2.5 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                <div class="flex items-center justify-center gap-2">
                  <input
                    type="checkbox"
                    :checked="selectedAlarmIds.has(item.id)"
                    @click.stop="toggleSelectRow(item.id)"
                    class="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-0 cursor-pointer"
                  />
                  <span
                    class="font-bold text-xs px-2 py-0.5 rounded"
                    :class="!item.acknowledged ? 'bg-rose-100 text-rose-700 font-black' : 'bg-slate-100 text-slate-500'"
                  >
                    {{ item.acknowledged ? '已确认' : '未确认' }}
                  </span>
                </div>
              </td>

              <!-- 厂站 -->
              <td class="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap font-medium text-sm">
                {{ item.station }}
              </td>

              <!-- 间隔 -->
              <td class="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap font-mono font-medium text-slate-800 text-sm">
                {{ item.bay }}
              </td>

              <!-- 装置 -->
              <td class="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap text-slate-700 text-sm">
                {{ item.device }}
              </td>

              <!-- 类型 -->
              <td class="py-2.5 px-3 border-r border-slate-200 text-center whitespace-nowrap font-mono text-xs">
                <span
                  class="px-2 py-0.5 rounded font-bold"
                  :class="[
                    item.type === '事故' ? 'bg-rose-100 text-rose-700 font-bold' :
                    item.type === '越限告警' ? 'bg-amber-100 text-amber-700 font-bold' :
                    item.type === '系统' ? 'bg-slate-100 text-slate-700' :
                    'bg-sky-50 text-sky-700'
                  ]"
                >
                  {{ item.type }}
                </span>
              </td>

              <!-- 动作时间 -->
              <td class="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap font-mono text-slate-700 text-xs">
                {{ item.time }}
              </td>

              <!-- 信息 -->
              <td
                class="py-2.5 px-4 truncate text-sm"
                :class="!item.acknowledged ? 'text-slate-900 font-semibold' : 'text-slate-600'"
                :title="item.message"
              >
                {{ item.message }}
              </td>
            </tr>

            <!-- 空数据状态 -->
            <tr v-if="filteredAlarms.length === 0">
              <td colspan="7" class="py-16 text-center text-slate-400 font-mono text-sm">
                无符合条件的实时告警记录
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ===================================================================== -->
      <!-- 3. 底部分类标签过滤栏 (高度增加到 h-10，标签与圆点清晰放大)             -->
      <!-- ===================================================================== -->
      <div class="h-10 bg-slate-100 border-t border-slate-300 px-2 flex items-center overflow-x-auto scrollbar-none shrink-0 text-sm font-sans select-none divide-x divide-slate-200">
        <button
          v-for="tab in categoryTabs"
          :key="tab"
          @click="activeTab = tab"
          class="h-full px-3.5 shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer text-sm font-medium"
          :class="activeTab === tab
            ? 'bg-white text-sky-800 font-bold border-b-2 border-sky-600 shadow-2xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'"
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="activeTab === tab ? 'bg-sky-600' : 'bg-slate-400'"
          />
          <span>{{ tab }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
