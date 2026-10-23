<script setup lang="ts">
import { ref } from 'vue';
import {
  FileSpreadsheet,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Layers,
  X
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

// 报表类型
const reportTypes = [
  '发电量综合统计日报',
  '逆变器运行指标月报',
  '35kV主变负荷率分析报',
  '遥测越限与合格率统计报',
  '厂站电能质量监测报'
];

const selectedReport = ref('发电量综合统计日报');
const reportDate = ref('2026-10-23');
const reportPeriod = ref('日报'); // 日报, 月报, 年报
const selectedBay = ref('全部回路');

const isGenerating = ref(false);

const handleGenerate = () => {
  isGenerating.value = true;
  setTimeout(() => {
    isGenerating.value = false;
  }, 350);
};

// 报表分类标签 (对齐全站告警风格)
const reportTabs = [
  '生产运行日报',
  '电能电量报',
  '负荷极值报',
  '逆变器能效',
  '设备利用率',
  '月度结算报',
  '年度综合报'
];
const activeTab = ref('生产运行日报');

// 模拟整点发电量采样数据 (00:00 - 23:00)
const hourlyData = [
  { hour: '00:00', p: 0.0, gen: 0.0, radiation: 0, pf: 0.98, u: 36.2, temp: 16.5 },
  { hour: '01:00', p: 0.0, gen: 0.0, radiation: 0, pf: 0.98, u: 36.3, temp: 16.1 },
  { hour: '02:00', p: 0.0, gen: 0.0, radiation: 0, pf: 0.99, u: 36.2, temp: 15.8 },
  { hour: '03:00', p: 0.0, gen: 0.0, radiation: 0, pf: 0.99, u: 36.4, temp: 15.4 },
  { hour: '04:00', p: 0.0, gen: 0.0, radiation: 0, pf: 0.98, u: 36.3, temp: 15.2 },
  { hour: '05:00', p: 0.0, gen: 0.0, radiation: 0, pf: 0.98, u: 36.4, temp: 15.6 },
  { hour: '06:00', p: 4.8, gen: 2.4, radiation: 45, pf: 0.99, u: 36.5, temp: 16.8 },
  { hour: '07:00', p: 18.5, gen: 11.6, radiation: 180, pf: 0.99, u: 36.5, temp: 19.2 },
  { hour: '08:00', p: 48.2, gen: 33.4, radiation: 420, pf: 0.99, u: 36.4, temp: 22.5 },
  { hour: '09:00', p: 95.6, gen: 71.9, radiation: 680, pf: 1.00, u: 36.3, temp: 25.8 },
  { hour: '10:00', p: 138.4, gen: 117.0, radiation: 890, pf: 1.00, u: 36.2, temp: 28.4 },
  { hour: '11:00', p: 156.2, gen: 147.3, radiation: 980, pf: 1.00, u: 36.1, temp: 30.2 },
  { hour: '12:00', p: 158.0, gen: 157.1, radiation: 1010, pf: 1.00, u: 36.2, temp: 31.5 },
  { hour: '13:00', p: 152.4, gen: 155.2, radiation: 975, pf: 1.00, u: 36.2, temp: 32.0 },
  { hour: '14:00', p: 135.0, gen: 143.7, radiation: 860, pf: 1.00, u: 36.3, temp: 31.2 },
  { hour: '15:00', p: 98.4, gen: 116.7, radiation: 650, pf: 0.99, u: 36.4, temp: 29.8 },
  { hour: '16:00', p: 52.1, gen: 75.3, radiation: 390, pf: 0.99, u: 36.5, temp: 27.5 },
  { hour: '17:00', p: 16.8, gen: 34.5, radiation: 140, pf: 0.98, u: 36.5, temp: 24.8 },
  { hour: '18:00', p: 1.2, gen: 9.0, radiation: 15, pf: 0.98, u: 36.4, temp: 22.3 },
  { hour: '19:00', p: 0.0, gen: 0.6, radiation: 0, pf: 0.98, u: 36.3, temp: 20.8 },
  { hour: '20:00', p: 0.0, gen: 0.0, radiation: 0, pf: 0.98, u: 36.2, temp: 19.5 },
  { hour: '21:00', p: 0.0, gen: 0.0, radiation: 0, pf: 0.99, u: 36.3, temp: 18.7 },
  { hour: '22:00', p: 0.0, gen: 0.0, radiation: 0, pf: 0.98, u: 36.2, temp: 18.0 },
  { hour: '23:00', p: 0.0, gen: 0.0, radiation: 0, pf: 0.98, u: 36.3, temp: 17.4 }
];
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
          <FileSpreadsheet class="w-5 h-5 text-emerald-600" />
          <span>报表中心 (运行电量/负荷/能效报表统计)</span>
        </div>
        <button
          @click="emit('close')"
          class="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          title="关闭报表窗"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- ===================================================================== -->
      <!-- 1. 顶部操作工具栏 (仿全站告警 RealtimeAlarmModal 样式)                   -->
      <!-- ===================================================================== -->
      <div class="h-11 bg-slate-50 border-b border-slate-300 px-3 flex items-center justify-between shrink-0 select-none overflow-x-auto gap-3">
        <!-- 左侧：报表类型与日期选择 -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- 报表类型选择 -->
          <div class="flex items-center gap-1.5 text-xs text-slate-700">
            <span class="font-bold text-slate-700">报表模版:</span>
            <select
              v-model="selectedReport"
              class="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option v-for="t in reportTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <div class="h-5 w-[1px] bg-slate-300 mx-0.5" />

          <!-- 统计周期 -->
          <div class="flex items-center bg-white border border-slate-300 rounded p-0.5 text-xs">
            <button
              v-for="p in ['日报', '月报', '年报']"
              :key="p"
              @click="reportPeriod = p"
              class="px-2 py-0.5 rounded transition-colors cursor-pointer"
              :class="reportPeriod === p ? 'bg-sky-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'"
            >
              {{ p }}
            </button>
          </div>

          <!-- 报表日期 -->
          <div class="flex items-center gap-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded px-2.5 py-1">
            <Calendar class="w-3.5 h-3.5 text-slate-400" />
            <input 
              type="date" 
              v-model="reportDate" 
              class="font-mono text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>

          <!-- 回路选择 -->
          <select 
            v-model="selectedBay" 
            class="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="全部回路">全部并网回路 (全站)</option>
            <option value="35kV I段">35kV I段出线</option>
            <option value="#1逆变升压区">#1逆变升压单元</option>
            <option value="#2逆变升压区">#2逆变升压单元</option>
          </select>
        </div>

        <!-- 右侧：生成与导出按钮群 -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            @click="handleGenerate"
            class="px-3.5 py-1.5 rounded bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            :disabled="isGenerating"
            title="生成当前选定报表"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isGenerating }" />
            <span>{{ isGenerating ? '统计中...' : '生成报表' }}</span>
          </button>

          <button
            class="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="导出当前报表至 EXCEL (.xlsx)"
          >
            <Download class="w-4 h-4 text-emerald-600" />
            <span>导出EXCEL</span>
          </button>

          <button
            class="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="打印报表预览"
          >
            <Printer class="w-4 h-4 text-slate-500" />
            <span>打印预览</span>
          </button>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- 2. 主体报表展示区 (正式 SCADA 工业标准表格布局)                         -->
      <!-- ===================================================================== -->
      <div class="flex-1 overflow-auto bg-slate-200/50 p-4">
        <!-- 报表白纸容器 (仿正式 A4/A3 打印幅面样式) -->
        <div class="max-w-5xl mx-auto bg-white rounded shadow-sm border border-slate-300 p-6 flex flex-col font-sans">
          <!-- 报表抬头 -->
          <div class="text-center pb-4 border-b border-slate-300 mb-4 select-text">
            <h1 class="text-xl font-bold text-slate-900 tracking-wider">速利达光伏电站 生产运行综合电量统计日报表</h1>
            <div class="flex items-center justify-between text-xs text-slate-500 mt-2 px-2">
              <span>统计日期: <strong class="text-slate-800 font-mono">{{ reportDate }}</strong></span>
              <span>报表回路: <strong class="text-slate-800">{{ selectedBay }}</strong></span>
              <span>制表部门: <strong class="text-slate-800">电站监控运行值</strong></span>
              <span>制表人: <strong class="text-slate-800">系统管理员</strong></span>
              <span>审核人: <strong class="text-slate-800">值班长 (已核对)</strong></span>
            </div>
          </div>

          <!-- 报表核心数据表格 -->
          <div class="overflow-x-auto border border-slate-300 rounded select-text">
            <table class="w-full border-collapse text-xs text-center">
              <thead class="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                <tr>
                  <th class="py-2 px-2 border-r border-slate-300 w-16">整点时间</th>
                  <th class="py-2 px-3 border-r border-slate-300">有功功率 P (MW)</th>
                  <th class="py-2 px-3 border-r border-slate-300">整点发电量 (MWh)</th>
                  <th class="py-2 px-3 border-r border-slate-300">水平面辐照 (W/m²)</th>
                  <th class="py-2 px-2 border-r border-slate-300">功率因数 cosφ</th>
                  <th class="py-2 px-2 border-r border-slate-300">母线电压 U (kV)</th>
                  <th class="py-2 px-2">环境温度 (℃)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 font-mono text-slate-800">
                <tr 
                  v-for="row in hourlyData" 
                  :key="row.hour"
                  class="hover:bg-sky-50/50 transition-colors"
                >
                  <td class="py-1.5 px-2 font-bold border-r border-slate-300 bg-slate-50 text-slate-700">{{ row.hour }}</td>
                  <td class="py-1.5 px-3 border-r border-slate-200 text-right">{{ row.p.toFixed(1) }}</td>
                  <td class="py-1.5 px-3 border-r border-slate-200 text-right font-bold text-sky-800">{{ row.gen.toFixed(1) }}</td>
                  <td class="py-1.5 px-3 border-r border-slate-200 text-right">{{ row.radiation }}</td>
                  <td class="py-1.5 px-2 border-r border-slate-200">{{ row.pf.toFixed(2) }}</td>
                  <td class="py-1.5 px-2 border-r border-slate-200">{{ row.u.toFixed(1) }}</td>
                  <td class="py-1.5 px-2">{{ row.temp.toFixed(1) }}</td>
                </tr>
                <!-- 合计与极值统计行 -->
                <tr class="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
                  <td class="py-2 px-2 border-r border-slate-300">日累计/极值</td>
                  <td class="py-2 px-3 border-r border-slate-300 text-right">最大: 158.0</td>
                  <td class="py-2 px-3 border-r border-slate-300 text-right text-emerald-700">总计: 1,075.7 MWh</td>
                  <td class="py-2 px-3 border-r border-slate-300 text-right">峰值: 1,010</td>
                  <td class="py-2 px-2 border-r border-slate-300">均值: 0.99</td>
                  <td class="py-2 px-2 border-r border-slate-300">均值: 36.3</td>
                  <td class="py-2 px-2">均温: 22.4</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 报表底部附注 -->
          <div class="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>说明: 本报表数据来源于厂站网关机与调度自动化系统，符合电力行业技术标准。</span>
            <span>生成时间: 2026-10-23 14:30:00</span>
          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- 3. 底部各分类标签 (仿照 RealtimeAlarmModal 样式)                         -->
      <!-- ===================================================================== -->
      <div class="h-9 bg-slate-100 border-t border-slate-300 px-2 flex items-center justify-between shrink-0 select-none text-xs">
        <div class="flex items-center gap-1 overflow-x-auto">
          <button
            v-for="tab in reportTabs"
            :key="tab"
            @click="activeTab = tab"
            class="px-3 py-1 rounded font-bold transition-colors cursor-pointer text-xs"
            :class="activeTab === tab ? 'bg-sky-700 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'"
          >
            {{ tab }}
          </button>
        </div>

        <div class="flex items-center gap-4 text-slate-600 font-mono text-xs pr-2">
          <span>报表周期: <strong class="text-slate-900">{{ reportPeriod }}</strong></span>
          <span>采样率: <strong class="text-slate-900">100%</strong></span>
          <span>归档状态: <strong class="text-emerald-700">已封存归档</strong></span>
        </div>
      </div>
    </div>
  </div>
</template>
