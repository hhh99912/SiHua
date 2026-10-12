<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  X,
  Volume2,
  VolumeX,
  CheckCircle2,
  Flame,
  AlertTriangle,
  Lightbulb,
  Search,
  Filter,
  RefreshCw,
  Layers,
  Sparkles
} from 'lucide-vue-next';

interface AnnunciatorTile {
  id: string;
  bayName: string;
  category: '110kv' | '10kv' | 'transformer' | 'pv_ess' | 'aux';
  title: string;
  description: string;
  status: 'normal' | 'alarm_critical' | 'alarm_warning' | 'acknowledged';
  timestamp: string;
}

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
}>();

const selectedCategory = ref<string>('all');
const searchQuery = ref<string>('');
const isTestingLamps = ref<boolean>(false);
const isMuted = ref<boolean>(false);

// Preset Annunciator Tiles for typical 110kV/10kV Substation (GE-SCADA Standard)
const tiles = ref<AnnunciatorTile[]>([
  // 1. 110kV 升压站间隔
  {
    id: 'ANN-101',
    bayName: '110kV 线路 101',
    category: '110kv',
    title: '101断路器 事故跳闸',
    description: '光纤差动保护动作出口，开关跳闸变位',
    status: 'normal',
    timestamp: '2026-10-08 19:20:15'
  },
  {
    id: 'ANN-102',
    bayName: '110kV 线路 101',
    category: '110kv',
    title: '101控制回路 断线',
    description: '跳位与合位监视回路同时消失',
    status: 'normal',
    timestamp: '2026-10-08 18:05:10'
  },
  {
    id: 'ANN-103',
    bayName: '110kV 母线',
    category: '110kv',
    title: '110kV母线 电压异常',
    description: '母线三相电压不平衡度超过 3.5%',
    status: 'alarm_warning',
    timestamp: '2026-10-08 20:12:04'
  },

  // 2. 主变压器间隔
  {
    id: 'ANN-201',
    bayName: '#1 主变压器',
    category: 'transformer',
    title: '#1主变 重瓦斯保护跳闸',
    description: '本体重瓦斯继电器动作，闭锁分闸',
    status: 'normal',
    timestamp: '2026-10-08 17:30:00'
  },
  {
    id: 'ANN-202',
    bayName: '#1 主变压器',
    category: 'transformer',
    title: '#1主变 油温过高告警',
    description: '顶层油温 86.5℃ 达到高温报警定值',
    status: 'alarm_warning',
    timestamp: '2026-10-08 20:05:44'
  },
  {
    id: 'ANN-203',
    bayName: '#1 主变压器',
    category: 'transformer',
    title: '#1主变 差动速断动作',
    description: '主变差动高压侧比率差动动作',
    status: 'normal',
    timestamp: '2026-10-08 15:40:22'
  },
  {
    id: 'ANN-204',
    bayName: '#1 主变压器',
    category: 'transformer',
    title: '#1主变 冷却器故障',
    description: '强油风冷动力电源失电，备用未投',
    status: 'alarm_warning',
    timestamp: '2026-10-08 19:55:18'
  },

  // 3. 10kV 配电室与一体柜
  {
    id: 'ANN-301',
    bayName: '10kV 苏州晟高一体柜',
    category: '10kv',
    title: '6#开关 事故跳闸',
    description: '速断保护I段瞬时动作，开关分闸未复归',
    status: 'alarm_critical',
    timestamp: '2026-10-08 20:18:32'
  },
  {
    id: 'ANN-302',
    bayName: '10kV 苏州晟高一体柜',
    category: '10kv',
    title: '一体柜6# 弹簧未储能',
    description: '储能电机未动作，无法执行合闸',
    status: 'alarm_warning',
    timestamp: '2026-10-08 20:10:02'
  },
  {
    id: 'ANN-303',
    bayName: '10kV 配电室 柜子2',
    category: '10kv',
    title: '7#开关 控制回路断线',
    description: '控制电源空开断开或回路阻抗异常',
    status: 'normal',
    timestamp: '2026-10-08 14:12:00'
  },
  {
    id: 'ANN-304',
    bayName: '10kV 母线',
    category: '10kv',
    title: '10kV母线 单相接地',
    description: '开口三角零序电压 3U0 达到 30V',
    status: 'alarm_critical',
    timestamp: '2026-10-08 20:21:10'
  },

  // 4. 新能源与储能
  {
    id: 'ANN-401',
    bayName: '光伏升压单元',
    category: 'pv_ess',
    title: '逆变器 防孤岛保护动作',
    description: '电网失电自动解列，防孤岛保护出口',
    status: 'normal',
    timestamp: '2026-10-08 16:00:00'
  },
  {
    id: 'ANN-402',
    bayName: '储能 PCS 舱',
    category: 'pv_ess',
    title: '电池舱 消防烟雾预警',
    description: '储能集装箱 1 号烟感探测器联动',
    status: 'normal',
    timestamp: '2026-10-08 11:20:00'
  },

  // 5. 站用电与公共系统
  {
    id: 'ANN-501',
    bayName: '直流电源屏',
    category: 'aux',
    title: '直流母线 绝缘降低告警',
    description: '正极接地绝缘阻抗低于 25kΩ',
    status: 'alarm_warning',
    timestamp: '2026-10-08 20:02:11'
  },
  {
    id: 'ANN-502',
    bayName: '全站保护测控',
    category: 'aux',
    title: '装置自检 异常总信号',
    description: '通信管理机报告从机 AD 采样通道漂移',
    status: 'normal',
    timestamp: '2026-10-08 19:00:00'
  },
  {
    id: 'ANN-503',
    bayName: '变电站安全防误',
    category: 'aux',
    title: '五防电脑钥匙 闭锁解除',
    description: '机械编码锁解锁异常，请值班员核实',
    status: 'normal',
    timestamp: '2026-10-08 13:45:00'
  },
  {
    id: 'ANN-504',
    bayName: '站用交流电屏',
    category: 'aux',
    title: '站用电 #1站变 失压',
    description: '400V 进线开关跳闸，备自投已动作',
    status: 'normal',
    timestamp: '2026-10-08 12:10:00'
  }
]);

// 过滤后的光字牌列表
const filteredTiles = computed(() => {
  return tiles.value.filter(tile => {
    const matchCategory = selectedCategory.value === 'all' || tile.category === selectedCategory.value;
    const matchQuery = !searchQuery.value.trim() || 
      tile.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      tile.bayName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      tile.description.toLowerCase().includes(searchQuery.value.toLowerCase());
    return matchCategory && matchQuery;
  });
});

// 统计
const criticalCount = computed(() => tiles.value.filter(t => t.status === 'alarm_critical').length);
const warningCount = computed(() => tiles.value.filter(t => t.status === 'alarm_warning').length);
const acknowledgedCount = computed(() => tiles.value.filter(t => t.status === 'acknowledged').length);

// 单个光字牌确认/复归
const handleAckTile = (tile: AnnunciatorTile) => {
  if (tile.status === 'alarm_critical' || tile.status === 'alarm_warning') {
    tile.status = 'acknowledged';
  } else if (tile.status === 'acknowledged') {
    tile.status = 'normal';
  }
};

// 全站光字牌一键复归 (GE-SCADA 核心操作)
const handleResetAll = () => {
  tiles.value.forEach(t => {
    t.status = 'normal';
  });
};

// 试灯功能 (Test Lamps - GE-SCADA 标准试验功能)
let lampTimer: any = null;
const handleTestLamps = () => {
  if (isTestingLamps.value) return;
  isTestingLamps.value = true;
  if (lampTimer) clearTimeout(lampTimer);
  lampTimer = setTimeout(() => {
    isTestingLamps.value = false;
  }, 4000);
};
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150"
    @click.self="emit('close')"
  >
    <div
      class="bg-[#0b1220] border-2 border-[#1c3055] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] w-[1280px] max-w-[96vw] h-[850px] max-h-[92vh] flex flex-col overflow-hidden text-slate-100 font-sans"
    >
      <!-- GE-SCADA 工业标准顶栏 -->
      <div class="bg-[#0e172a] border-b-2 border-[#1e3358] px-5 py-3 flex items-center justify-between shrink-0 select-none">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300">
            <Lightbulb class="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-base font-bold text-white tracking-wide">GE-SCADA · 全站光字牌告警矩阵</span>
              <span class="text-xs px-2 py-0.5 rounded bg-[#162544] text-sky-300 font-mono border border-sky-600/40 font-bold">
                ANNUNCIATOR PANEL
              </span>
            </div>
            <div class="text-[11px] text-slate-400 font-mono mt-0.5">
              变电站站控层光字牌监控屏 · 事故信号与预告信号监视
            </div>
          </div>
        </div>

        <!-- 状态统计指示 -->
        <div class="flex items-center gap-4 text-xs font-mono">
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/60 border border-rose-500/60 text-rose-300">
            <Flame class="w-3.5 h-3.5 animate-pulse text-rose-400" />
            <span>事故跳闸:</span>
            <span class="font-bold text-sm text-white">{{ criticalCount }}</span>
          </div>

          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-500/60 text-amber-300">
            <AlertTriangle class="w-3.5 h-3.5 text-amber-400" />
            <span>预告告警:</span>
            <span class="font-bold text-sm text-white">{{ warningCount }}</span>
          </div>

          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950/60 border border-sky-500/60 text-sky-300">
            <CheckCircle2 class="w-3.5 h-3.5 text-sky-400" />
            <span>已确认:</span>
            <span class="font-bold text-sm text-white">{{ acknowledgedCount }}</span>
          </div>

          <button
            @click="emit('close')"
            class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer ml-2"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- 操作与过滤控制栏 -->
      <div class="bg-[#09101d] border-b border-[#182947] px-5 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <!-- 分类切换 -->
        <div class="flex items-center gap-1 bg-[#050a14] p-1 rounded-lg border border-slate-800 text-xs">
          <button
            @click="selectedCategory = 'all'"
            class="px-3 py-1 rounded-md transition-colors cursor-pointer font-medium"
            :class="selectedCategory === 'all' ? 'bg-[#1e345e] text-white font-bold shadow-xs' : 'text-slate-400 hover:text-slate-200'"
          >
            全部间隔 ({{ tiles.length }})
          </button>
          <button
            @click="selectedCategory = '110kv'"
            class="px-3 py-1 rounded-md transition-colors cursor-pointer font-medium"
            :class="selectedCategory === '110kv' ? 'bg-[#1e345e] text-white font-bold shadow-xs' : 'text-slate-400 hover:text-slate-200'"
          >
            110kV 升压站
          </button>
          <button
            @click="selectedCategory = 'transformer'"
            class="px-3 py-1 rounded-md transition-colors cursor-pointer font-medium"
            :class="selectedCategory === 'transformer' ? 'bg-[#1e345e] text-white font-bold shadow-xs' : 'text-slate-400 hover:text-slate-200'"
          >
            #1 主变压器
          </button>
          <button
            @click="selectedCategory = '10kv'"
            class="px-3 py-1 rounded-md transition-colors cursor-pointer font-medium"
            :class="selectedCategory === '10kv' ? 'bg-[#1e345e] text-white font-bold shadow-xs' : 'text-slate-400 hover:text-slate-200'"
          >
            10kV 配电室/一体柜
          </button>
          <button
            @click="selectedCategory = 'pv_ess'"
            class="px-3 py-1 rounded-md transition-colors cursor-pointer font-medium"
            :class="selectedCategory === 'pv_ess' ? 'bg-[#1e345e] text-white font-bold shadow-xs' : 'text-slate-400 hover:text-slate-200'"
          >
            光伏与储能
          </button>
          <button
            @click="selectedCategory = 'aux'"
            class="px-3 py-1 rounded-md transition-colors cursor-pointer font-medium"
            :class="selectedCategory === 'aux' ? 'bg-[#1e345e] text-white font-bold shadow-xs' : 'text-slate-400 hover:text-slate-200'"
          >
            站用电/直流屏
          </button>
        </div>

        <!-- 检索与 GE-SCADA 试灯/复归操作 -->
        <div class="flex items-center gap-2.5">
          <div class="relative w-56">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索信号名称/间隔..."
              class="w-full pl-8 pr-3 py-1.5 bg-[#050a14] border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
            />
            <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <!-- 试灯按钮 -->
          <button
            @click="handleTestLamps"
            class="px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            :class="isTestingLamps ? 'bg-amber-500 text-black border-amber-400 animate-pulse' : 'bg-[#13223f] border-[#254275] text-amber-300 hover:bg-[#1a2f58]'"
            title="点亮全屏所有光字牌以检验指示灯健康状态"
          >
            <Lightbulb class="w-3.5 h-3.5" />
            <span>{{ isTestingLamps ? '试灯测试中 (4s)' : '试灯试验' }}</span>
          </button>

          <!-- 警笛消音 -->
          <button
            @click="isMuted = !isMuted"
            class="px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            :class="isMuted ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-[#13223f] border-[#254275] text-sky-300 hover:bg-[#1a2f58]'"
            title="关闭蜂鸣警报音"
          >
            <component :is="isMuted ? VolumeX : Volume2" class="w-3.5 h-3.5" />
            <span>{{ isMuted ? '已消音' : '音响投入' }}</span>
          </button>

          <!-- 全站一键复归 -->
          <button
            @click="handleResetAll"
            class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
            title="复归全站已解除告警并消除事故变位信号"
          >
            <RefreshCw class="w-3.5 h-3.5 stroke-[2.5]" />
            <span>全站光字牌复归</span>
          </button>
        </div>
      </div>

      <!-- 光字牌方格矩阵主体 (Annunciator Grid) -->
      <div
        class="flex-1 p-5 overflow-y-auto bg-[#070e1c] grid grid-cols-4 gap-4 auto-rows-max"
        style="scrollbar-gutter: stable;"
      >
        <div
          v-for="tile in filteredTiles"
          :key="tile.id"
          class="relative p-4 rounded-xl border-2 transition-all duration-150 cursor-pointer select-none flex flex-col justify-between min-h-[140px] group shadow-lg"
          :class="[
            isTestingLamps
              ? 'bg-amber-400/90 border-amber-300 text-black font-extrabold shadow-[0_0_20px_rgba(251,191,36,0.6)]'
              : tile.status === 'alarm_critical'
              ? 'bg-rose-950/80 border-rose-500 text-white animate-pulse shadow-[0_0_25px_rgba(244,63,94,0.45)]'
              : tile.status === 'alarm_warning'
              ? 'bg-amber-950/75 border-amber-400 text-white animate-pulse shadow-[0_0_20px_rgba(251,191,36,0.35)]'
              : tile.status === 'acknowledged'
              ? 'bg-[#142340] border-sky-400 text-sky-100 shadow-md'
              : 'bg-[#0d1629] border-[#182947] text-slate-300 hover:border-slate-600 hover:bg-[#111d35]'
          ]"
          @click="handleAckTile(tile)"
        >
          <!-- 间隔标签与编号 -->
          <div class="flex items-center justify-between text-[11px] pb-1.5 border-b" :class="isTestingLamps ? 'border-amber-600/40 text-black/80 font-bold' : 'border-white/10 text-slate-400 font-mono'">
            <span class="truncate font-medium">{{ tile.bayName }}</span>
            <span class="text-[10px] font-bold uppercase opacity-80">{{ tile.id }}</span>
          </div>

          <!-- 光字牌正中央大标题 (仿电力实物光字牌大字) -->
          <div class="my-2.5 text-center">
            <div
              class="text-base font-black tracking-wider leading-snug drop-shadow-sm"
              :class="isTestingLamps ? 'text-black' : (tile.status === 'alarm_critical' ? 'text-rose-200' : tile.status === 'alarm_warning' ? 'text-amber-200' : tile.status === 'acknowledged' ? 'text-sky-200' : 'text-slate-200')"
            >
              {{ tile.title }}
            </div>
            <div
              class="text-xs mt-1 truncate"
              :class="isTestingLamps ? 'text-black/70' : 'text-slate-400'"
            >
              {{ tile.description }}
            </div>
          </div>

          <!-- 底部状态与时标 -->
          <div class="flex items-center justify-between pt-1.5 border-t text-[10px] font-mono" :class="isTestingLamps ? 'border-amber-600/40 text-black/80' : 'border-white/10 text-slate-400'">
            <div class="flex items-center gap-1 font-bold">
              <span
                class="w-2 h-2 rounded-full inline-block"
                :class="isTestingLamps ? 'bg-black' : (tile.status === 'alarm_critical' ? 'bg-rose-400 animate-ping' : tile.status === 'alarm_warning' ? 'bg-amber-400 animate-ping' : tile.status === 'acknowledged' ? 'bg-sky-400' : 'bg-slate-600')"
              />
              <span>
                {{ isTestingLamps ? '灯泡自检' : (tile.status === 'alarm_critical' ? '事故跳闸' : tile.status === 'alarm_warning' ? '异常告警' : tile.status === 'acknowledged' ? '已确认' : '正常') }}
              </span>
            </div>
            <span>{{ tile.timestamp.split(' ')[1] }}</span>
          </div>

          <!-- 点击确认悬浮指示 -->
          <div
            v-if="!isTestingLamps && (tile.status === 'alarm_critical' || tile.status === 'alarm_warning')"
            class="absolute inset-0 bg-black/40 backdrop-blur-[1px] rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <span class="px-3 py-1 bg-white text-black font-bold text-xs rounded-lg shadow-xl flex items-center gap-1">
              <CheckCircle2 class="w-3.5 h-3.5" />
              <span>点击确认复归</span>
            </span>
          </div>
        </div>
      </div>

      <!-- 底部控制说明 -->
      <div class="bg-[#0b1322] border-t-2 border-[#1a2d4f] px-5 py-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded bg-rose-500 border border-rose-300" />
            <span>事故信号 (双位闪烁)</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded bg-amber-400 border border-amber-200" />
            <span>预告信号 (单相接地/越限)</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded bg-sky-500 border border-sky-300" />
            <span>已确认未复位</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded bg-slate-800 border border-slate-700" />
            <span>正常运行状态</span>
          </div>
        </div>

        <div class="font-mono text-slate-400">
          GE-SCADA Annunciator Engine · 按 IEC 61850 标准事件映射
        </div>
      </div>
    </div>
  </div>
</template>
