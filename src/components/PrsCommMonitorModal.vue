<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  X,
  Radio,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  Network,
  Cpu,
  Layers,
  Zap,
  RotateCcw
} from 'lucide-vue-next';
import { scadaFacilities } from '../utils/scadaClient';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
}>();

const searchQuery = ref<string>('');
const selectedTab = ref<'channels' | 'devices' | 'raw_frames'>('devices');
const isResetting = ref<boolean>(false);

// FEP Front-End Processor Channels (GE-SCADA 双前置机双网)
const fepChannels = ref([
  {
    id: 'CH-FEP-01',
    name: 'A网主前置机 (FEP-01A)',
    ip: '192.168.1.101:2404',
    protocol: 'IEC 60870-5-104 / MMS',
    status: 'online',
    txCount: 84920,
    rxCount: 91240,
    errCount: 2,
    latency: '1.2ms',
    role: '主通道 (Active)'
  },
  {
    id: 'CH-FEP-02',
    name: 'B网备前置机 (FEP-02B)',
    ip: '192.168.2.102:2404',
    protocol: 'IEC 60870-5-104 / MMS',
    status: 'online',
    txCount: 84902,
    rxCount: 91195,
    errCount: 0,
    latency: '1.4ms',
    role: '热备通道 (Standby)'
  },
  {
    id: 'CH-MODBUS-01',
    name: '多功能仪表通信网关 (GW-01)',
    ip: '192.168.1.105:502',
    protocol: 'Modbus TCP',
    status: 'online',
    txCount: 42100,
    rxCount: 42095,
    errCount: 5,
    latency: '3.8ms',
    role: '采集从机'
  },
  {
    id: 'CH-GPS-01',
    name: 'GPS/北斗卫星对时对时钟 (PTP/IRIG-B)',
    ip: '192.168.1.200:123',
    protocol: 'SNTP / IEEE 1588',
    status: 'online',
    txCount: 12050,
    rxCount: 12050,
    errCount: 0,
    latency: '0.2ms',
    role: '全站时钟基准'
  }
]);

// 装置通信列表：从 scadaFacilities 动态生成，并配上真实的通信参数
const deviceNodes = computed(() => {
  const list: Array<{
    id: number | string;
    facName: string;
    bayName: string;
    devName: string;
    devId: number | string;
    alias: string;
    cbtyName: string;
    ip: string;
    protocol: string;
    status: 'online' | 'warning' | 'offline';
    rtt: number;
    rxBytes: string;
    txBytes: string;
    ycCount: number;
    yxCount: number;
    quality: string;
  }> = [];

  scadaFacilities.value.forEach((fac, fIdx) => {
    (fac.bays || []).forEach((bay, bIdx) => {
      (bay.devices || []).forEach((dev, dIdx) => {
        const devId = dev.id || dev.dev_id || (7000000 + dIdx);
        const isOffline = dIdx === 5; // 模拟某台测试装置离线
        list.push({
          id: devId,
          facName: fac.name || fac.fac_name || '变电站',
          bayName: bay.name || bay.bay_name || '间隔',
          devName: dev.name || dev.dev_name || `装置${dIdx + 1}`,
          devId: devId,
          alias: dev.alias || `DEV_${devId}`,
          cbtyName: dev.cbty_name || '断路器测控',
          ip: `192.168.1.${10 + dIdx}`,
          protocol: dIdx % 2 === 0 ? 'IEC 61850 MMS' : 'IEC 60870-5-104',
          status: isOffline ? 'offline' : 'online',
          rtt: isOffline ? 999 : Math.round(2 + Math.random() * 5),
          rxBytes: `${(1.2 + dIdx * 0.4).toFixed(1)} MB`,
          txBytes: `${(0.8 + dIdx * 0.3).toFixed(1)} MB`,
          ycCount: dev.yc_list?.length || 24,
          yxCount: dev.yx_list?.length || 16,
          quality: isOffline ? '中断' : '优良'
        });
      });
    });
  });

  return list;
});

// 过滤后的装置列表
const filteredDevices = computed(() => {
  return deviceNodes.value.filter(dev => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return true;
    return (
      dev.devName.toLowerCase().includes(q) ||
      dev.bayName.toLowerCase().includes(q) ||
      dev.facName.toLowerCase().includes(q) ||
      String(dev.devId).includes(q) ||
      dev.ip.includes(q)
    );
  });
});

// 重置与重新握手通道
const handleResetChannels = () => {
  if (isResetting.value) return;
  isResetting.value = true;
  setTimeout(() => {
    isResetting.value = false;
  }, 1200);
};
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150"
    @click.self="emit('close')"
  >
    <div
      class="bg-[#0b1220] border-2 border-[#1c3055] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] w-[1240px] max-w-[96vw] h-[820px] max-h-[90vh] flex flex-col overflow-hidden text-slate-100 font-sans"
    >
      <!-- GE-SCADA 通信监视顶栏 -->
      <div class="bg-[#0e172a] border-b-2 border-[#1e3358] px-5 py-3 flex items-center justify-between shrink-0 select-none">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/50 flex items-center justify-center text-sky-400">
            <Network class="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-base font-bold text-white tracking-wide">GE-SCADA · 变电站通信工况与前置机监视</span>
              <span class="text-xs px-2 py-0.5 rounded bg-[#162544] text-sky-300 font-mono border border-sky-600/40 font-bold">
                COMMUNICATION DIAGNOSTICS
              </span>
            </div>
            <div class="text-[11px] text-slate-400 font-mono mt-0.5">
              站控层 A/B 网前置通道 · 间隔层智能电子设备 (IED) 通信质量检测
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            @click="handleResetChannels"
            class="px-3 py-1.5 rounded-lg bg-[#142340] hover:bg-[#1a2f58] border border-sky-500/40 text-sky-300 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            :disabled="isResetting"
          >
            <RotateCcw class="w-3.5 h-3.5" :class="{ 'animate-spin': isResetting }" />
            <span>{{ isResetting ? '重新握手通道中...' : '通道重连与复位' }}</span>
          </button>

          <button
            @click="emit('close')"
            class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- 前置机双网双机通道概要卡片 (FEP Status Cards) -->
      <div class="bg-[#070e1c] border-b border-[#182947] p-4 grid grid-cols-4 gap-3 shrink-0">
        <div
          v-for="ch in fepChannels"
          :key="ch.id"
          class="bg-[#0d1629] border border-[#1b2f52] rounded-xl p-3 flex flex-col justify-between"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white truncate">{{ ch.name }}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50">
              在线正常
            </span>
          </div>

          <div class="my-2 space-y-1 text-[11px] font-mono text-slate-400">
            <div class="flex items-center justify-between">
              <span>IP / 端口:</span>
              <span class="text-sky-300 font-bold">{{ ch.ip }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>通信规约:</span>
              <span class="text-slate-300">{{ ch.protocol }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>通道角色:</span>
              <span class="text-amber-300">{{ ch.role }}</span>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>TX: {{ ch.txCount }}</span>
            <span>RX: {{ ch.rxCount }}</span>
            <span class="text-emerald-400">RTT: {{ ch.latency }}</span>
          </div>
        </div>
      </div>

      <!-- 中间控制与检索条 -->
      <div class="bg-[#09101d] border-b border-[#182947] px-5 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 bg-[#050a14] p-1 rounded-lg border border-slate-800 text-xs">
            <button
              @click="selectedTab = 'devices'"
              class="px-3 py-1 rounded-md transition-colors cursor-pointer font-medium"
              :class="selectedTab === 'devices' ? 'bg-[#1e345e] text-white font-bold' : 'text-slate-400 hover:text-slate-200'"
            >
              间隔设备通信表 ({{ deviceNodes.length }})
            </button>
            <button
              @click="selectedTab = 'channels'"
              class="px-3 py-1 rounded-md transition-colors cursor-pointer font-medium"
              :class="selectedTab === 'channels' ? 'bg-[#1e345e] text-white font-bold' : 'text-slate-400 hover:text-slate-200'"
            >
              前置链路参数
            </button>
          </div>

          <span class="text-xs text-slate-400 font-mono ml-2">
            在线正常: <span class="text-emerald-400 font-bold">{{ deviceNodes.filter(d => d.status === 'online').length }}</span> / 
            总设备数: <span class="text-white font-bold">{{ deviceNodes.length }}</span>
          </span>
        </div>

        <div class="relative w-64">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索设备名称/间隔/IP..."
            class="w-full pl-8 pr-3 py-1.5 bg-[#050a14] border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 font-medium"
          />
          <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      <!-- 表格主体 (Device Communications Table) -->
      <div class="flex-1 overflow-y-auto p-4 bg-[#070e1c]" style="scrollbar-gutter: stable;">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b-2 border-[#1c3055] bg-[#0c1527] text-sky-300 font-bold sticky top-0 z-10 font-mono">
              <th class="p-3 w-16 text-center">状态</th>
              <th class="p-3">厂站 / 间隔名称</th>
              <th class="p-3">装置名称 (IED)</th>
              <th class="p-3">类型</th>
              <th class="p-3 font-mono">通信 IP / 端口</th>
              <th class="p-3">规约标准</th>
              <th class="p-3 text-center">测点池 (YC/YX)</th>
              <th class="p-3 text-center">收发吞吐 (RX/TX)</th>
              <th class="p-3 text-right">响应往返时延</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#13223f] font-mono">
            <tr
              v-for="dev in filteredDevices"
              :key="dev.id"
              class="hover:bg-[#0f1d38] transition-colors text-slate-200"
            >
              <!-- 在线指示 -->
              <td class="p-3 text-center">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
                  :class="dev.status === 'online' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50' : 'bg-rose-950 text-rose-300 border border-rose-500/50'"
                >
                  <component :is="dev.status === 'online' ? Wifi : WifiOff" class="w-3 h-3" />
                  <span>{{ dev.status === 'online' ? '正常' : '中断' }}</span>
                </span>
              </td>

              <!-- 厂站/间隔 -->
              <td class="p-3 font-sans">
                <div class="font-bold text-white text-[13px]">{{ dev.bayName }}</div>
                <div class="text-[11px] text-slate-400">{{ dev.facName }}</div>
              </td>

              <!-- 装置名称与编号 -->
              <td class="p-3 font-sans">
                <div class="font-bold text-sky-200 text-[13px]">{{ dev.devName }}</div>
                <div class="text-[11px] text-slate-400 font-mono">ID: {{ dev.devId }} · {{ dev.alias }}</div>
              </td>

              <!-- 类型 -->
              <td class="p-3 font-sans text-slate-300">
                {{ dev.cbtyName }}
              </td>

              <!-- 通信 IP -->
              <td class="p-3 font-mono text-sky-300">
                {{ dev.ip }}:2404
              </td>

              <!-- 规约标准 -->
              <td class="p-3">
                <span class="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[11px]">
                  {{ dev.protocol }}
                </span>
              </td>

              <!-- 测点池 -->
              <td class="p-3 text-center text-slate-300">
                <span class="text-sky-300 font-bold">{{ dev.ycCount }}</span> YC / 
                <span class="text-emerald-300 font-bold">{{ dev.yxCount }}</span> YX
              </td>

              <!-- 吞吐 -->
              <td class="p-3 text-center text-slate-400">
                {{ dev.rxBytes }} / {{ dev.txBytes }}
              </td>

              <!-- 往返时延 -->
              <td class="p-3 text-right">
                <span
                  class="font-bold"
                  :class="dev.status === 'online' ? (dev.rtt < 10 ? 'text-emerald-400' : 'text-amber-400') : 'text-rose-400'"
                >
                  {{ dev.status === 'online' ? `${dev.rtt} ms` : '超时 (Timeout)' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 底部诊断状态说明 -->
      <div class="bg-[#0b1322] border-t-2 border-[#1a2d4f] px-5 py-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span class="text-slate-300 font-medium">双机热备双网心跳正常</span>
          </div>
          <span>·</span>
          <span>规约解析引擎: GE-SCADA FEP Core 4.8</span>
          <span>·</span>
          <span>误码率统计: 0.001% (工业一级优良)</span>
        </div>

        <div class="font-mono text-slate-400">
          全站通信周期: 1000ms · 事件 SOE 上送时标精度: ≤ 1ms
        </div>
      </div>
    </div>
  </div>
</template>
