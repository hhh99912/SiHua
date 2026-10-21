<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import { ScreenComponent, DatasetItem, ScadaChartPoint } from '../../types';
import { getFastLiveYc, getFastLiveDd, findScadaPointDef } from '../../utils/scadaClient';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
  previewMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  previewMode: false
});

const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;
let sampleTimer: ReturnType<typeof setInterval> | null = null;
let resizeObserver: ResizeObserver | null = null;
let isDisposed = false;

// 南瑞 SCADA 工控标准高对比调色板 (A黄-B绿-C红 规约，单相主测点为高亮青白)
const nariPhaseColors = [
  '#00f2ff', // 1. 高亮青 (南瑞主测控/单相高对比色)
  '#fbbf24', // 2. A相黄色 (国网/南瑞 A 相规约色)
  '#22c55e', // 3. B相绿色 (国网/南瑞 B 相规约色)
  '#ef4444', // 4. C相红色 (国网/南瑞 C 相规约色)
  '#38bdf8', // 5. 天蓝色
  '#c084fc', // 6. 浅紫色
  '#f97316', // 7. 亮橙色
  '#ffffff'  // 8. 亮纯白
];

// 归一化提取当前组件配置的多测点
const configuredPoints = computed<ScadaChartPoint[]>(() => {
  const cp = props.component.customProps || {};
  const mapping = props.component.data?.mapping || {};

  if (Array.isArray(cp.points) && cp.points.length > 0) {
    return cp.points.map((p: any, idx: number) => ({
      id: Number(p.id || p.pointId || 101),
      name: p.name || `测点 ${idx + 1}`,
      category: (p.category || 'yc').toLowerCase() as 'yc' | 'dd',
      color: p.color || nariPhaseColors[idx % nariPhaseColors.length],
      unit: p.unit || cp.unit || '',
      facName: p.facName,
      bayName: p.bayName,
      devName: p.devName
    }));
  }

  // 单点兜底
  const fallbackId = Number(mapping.pointId || cp.pointId || 101);
  const def = findScadaPointDef(fallbackId);
  const cat = (mapping.pointCategory === 'dd' || def.category === 'dd' ? 'dd' : 'yc') as 'yc' | 'dd';

  return [
    {
      id: fallbackId,
      name: mapping.pointName || cp.pointName || def.point?.name || 'A相电流',
      category: cat,
      color: '#00f2ff',
      unit: mapping.unit || cp.unit || def.point?.unit || 'A'
    }
  ];
});

// 格式化时分秒
const formatTime = (d: Date) => {
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// 实时曲线历史环形缓冲区
interface TimePoint {
  time: string;
  value: number;
}
const curveHistoryMap = ref<Map<number, TimePoint[]>>(new Map());

// 读取单个测点瞬时值
const readPointLiveValue = (pt: ScadaChartPoint, fallbackIndex: number = 0): number => {
  let val: number | undefined;
  if (pt.category === 'dd') {
    val = getFastLiveDd(pt.id);
  } else {
    val = getFastLiveYc(pt.id);
  }

  if (val !== undefined && typeof val === 'number' && !isNaN(val)) {
    return Number(val.toFixed(2));
  }

  // 基线拟真稳定工模值
  const base = 220 + (fallbackIndex * 35) + ((pt.id % 17) * 4.2);
  return Number(base.toFixed(2));
};

// 生成静态编辑态标准样本曲线 (编辑界面完全静态，时间轴绝对静止，波形平滑无断层)
const generateStaticEditorPoints = () => {
  const pts = configuredPoints.value;
  const staticCount = 10;
  const now = new Date();
  const baseMinutes = Math.floor(now.getMinutes() / 10) * 10;
  const baseHour = now.getHours();

  pts.forEach((pt, idx) => {
    const list: TimePoint[] = [];
    const baseVal = readPointLiveValue(pt, idx);

    for (let i = 0; i < staticCount; i++) {
      const minute = (baseMinutes + i) % 60;
      const hour = (baseHour + Math.floor((baseMinutes + i) / 60)) % 24;
      const pad = (n: number) => (n < 10 ? '0' + n : String(n));
      const timeStr = `${pad(hour)}:${pad(minute)}`;

      // 拟真平稳正弦小波动曲线 (数学平滑连续，零断层)
      const phaseOffset = idx * (Math.PI / 3);
      const angle = (i / staticCount) * Math.PI * 2 + phaseOffset;
      const delta = Math.sin(angle) * (baseVal * 0.05);
      const val = Number((baseVal + delta).toFixed(2));

      list.push({ time: timeStr, value: val });
    }
    curveHistoryMap.value.set(pt.id, list);
  });
};

// 预填充运行态初始滑动点 (仅在进入 previewMode 运行时使用)
const prefillRuntimePoints = () => {
  const pts = configuredPoints.value;
  const now = new Date();
  const cp = props.component.customProps || {};
  const sampleSec = Math.max(1, Number(cp.sampleInterval) || 1);
  const initialCount = 16;

  pts.forEach((pt, idx) => {
    const list: TimePoint[] = [];
    const baseVal = readPointLiveValue(pt, idx);

    for (let i = initialCount - 1; i >= 0; i--) {
      const t = new Date(now.getTime() - i * sampleSec * 1000);
      const timeStr = formatTime(t);
      const angle = ((initialCount - i) / initialCount) * Math.PI * 2;
      const delta = Math.sin(angle + idx) * (baseVal * 0.04);
      list.push({
        time: timeStr,
        value: Number((baseVal + delta).toFixed(2))
      });
    }
    curveHistoryMap.value.set(pt.id, list);
  });
};

// 1. 实时曲线采样逻辑 (仅在 previewMode 开启运行时连续滑动)
const sampleCurveTick = () => {
  if (isDisposed || !props.previewMode) return;
  const now = new Date();
  const timeStr = formatTime(now);
  const pts = configuredPoints.value;
  const cp = props.component.customProps || {};
  const timeWindowMin = Number(cp.timeWindow) || 10;
  const sampleSec = Math.max(1, Number(cp.sampleInterval) || 1);
  const maxPoints = Math.max(30, Math.round((timeWindowMin * 60) / sampleSec));

  pts.forEach((pt, idx) => {
    let list = curveHistoryMap.value.get(pt.id);
    if (!list) {
      list = [];
      curveHistoryMap.value.set(pt.id, list);
    }

    const curVal = readPointLiveValue(pt, idx);
    list.push({ time: timeStr, value: curVal });

    if (list.length > maxPoints) {
      list.shift();
    }
  });

  updateChart();
};

// 2. 实时柱状图采样刷新
const sampleBarTick = () => {
  if (isDisposed || !props.previewMode) return;
  updateChart();
};

// 构建纯图形 ECharts 配置：无标题头，横纵坐标紧挨边框零留白，亮白色文字
const buildOptions = (): echarts.EChartsOption => {
  const comp = props.component;
  const cp = comp.customProps || {};
  const style = comp.style || {};
  const isCurve = comp.type === 'chart-realtime-curve';
  const pts = configuredPoints.value;
  const primaryUnit = cp.unit || style.unit || (pts[0]?.unit) || '';

  // 纯黑背景或自定义背景
  const bgColor = style.fill || '#000000';
  const gridLineColor = '#1f293d';
  const axisLineColor = '#475569';

  // Y 轴范围自适应或固定
  const yMin = cp.yAxisMin !== undefined && cp.yAxisMin !== '' ? Number(cp.yAxisMin) : undefined;
  const yMax = cp.yAxisMax !== undefined && cp.yAxisMax !== '' ? Number(cp.yAxisMax) : undefined;

  if (isCurve) {
    // 实时多测点曲线
    const allTimestamps: string[] = [];
    const firstList = pts.length > 0 ? (curveHistoryMap.value.get(pts[0].id) || []) : [];
    firstList.forEach(item => allTimestamps.push(item.time));

    const series: echarts.SeriesOption[] = pts.map((pt, idx) => {
      const list = curveHistoryMap.value.get(pt.id) || [];
      const dataVals = list.map(item => item.value);
      const color = pt.color || nariPhaseColors[idx % nariPhaseColors.length];

      return {
        name: pt.name || `#${pt.id}`,
        type: 'line',
        smooth: cp.smooth !== false ? 0.25 : false,
        showSymbol: false,
        symbolSize: 4,
        lineStyle: {
          width: Number(cp.lineWidth) || 2,
          color,
          cap: 'round',
          join: 'round'
        },
        itemStyle: {
          color
        },
        areaStyle: cp.showArea !== false ? {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: color.startsWith('#') ? `${color}35` : 'rgba(0, 242, 255, 0.22)' },
            { offset: 1, color: color.startsWith('#') ? `${color}03` : 'rgba(0, 242, 255, 0.01)' }
          ])
        } : undefined,
        data: dataVals
      };
    });

    return {
      backgroundColor: bgColor,
      animation: false,
      textStyle: {
        fontFamily: '"JetBrains Mono", Consolas, "Roboto Mono", monospace'
      },
      // 核心需求：横纵坐标紧挨边框，保留防遮掩间距
      grid: {
        top: 14,
        right: 14,
        bottom: Math.max(8, Number(cp.axisFontSize || 10) - 2),
        left: Math.max(8, Number(cp.axisFontSize || 10) - 2),
        containLabel: true
      },
      // 多测点且显式开启时紧凑右上角显示微型图例
      legend: pts.length > 1 && cp.showLegend === true ? {
        top: 2,
        right: 4,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 3,
        textStyle: {
          color: '#ffffff',
          fontSize: 10,
          fontFamily: 'sans-serif'
        }
      } : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: 'rgba(0, 242, 255, 0.45)',
            type: 'dashed',
            width: 1
          }
        },
        backgroundColor: 'rgba(10, 16, 30, 0.95)',
        borderColor: '#0284c7',
        borderWidth: 1,
        padding: [6, 10],
        textStyle: {
          color: '#ffffff',
          fontSize: 11
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          let res = `<div style="font-family:sans-serif;color:#ffffff;line-height:1.4;">`;
          res += `<div style="color:#94a3b8;font-size:11px;margin-bottom:4px;border-bottom:1px solid #1e293b;padding-bottom:2px;">时间: ${params[0].name}</div>`;
          params.forEach((item: any) => {
            const pt = pts.find(p => p.name === item.seriesName) || pts[0];
            const u = pt?.unit || primaryUnit;
            res += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;">
              <span style="display:flex;align-items:center;gap:5px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${item.color};"></span>
                <span style="font-size:11px;color:#e2e8f0;">${item.seriesName}:</span>
              </span>
              <span style="font-weight:700;font-family:monospace;font-size:12px;color:#00f2ff;">${item.value}${u ? ' ' + u : ''}</span>
            </div>`;
          });
          res += `</div>`;
          return res;
        }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: allTimestamps,
        axisLine: {
          show: true,
          lineStyle: { color: axisLineColor, width: 1 }
        },
        axisTick: {
          show: true,
          length: 3,
          lineStyle: { color: axisLineColor }
        },
        // 核心要求：亮白色字体，规整自适应排列，无截断无遮掩
        axisLabel: {
          color: '#ffffff',
          fontSize: Number(cp.axisFontSize || 10),
          fontFamily: '"JetBrains Mono", Consolas, monospace',
          fontWeight: 'bold',
          margin: 6,
          interval: 'auto',
          hideOverlap: true,
          showMinLabel: true,
          showMaxLabel: true
        },
        splitLine: {
          show: true,
          lineStyle: { color: gridLineColor, type: 'dashed' }
        }
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitNumber: 4,
        min: yMin,
        max: yMax,
        axisLine: {
          show: true,
          lineStyle: { color: axisLineColor, width: 1 }
        },
        axisTick: {
          show: true,
          length: 3,
          lineStyle: { color: axisLineColor }
        },
        // 核心要求：亮白色字体，紧挨边框，高清晰度
        axisLabel: {
          color: '#ffffff',
          fontSize: Number(cp.axisFontSize || 10),
          fontFamily: '"JetBrains Mono", Consolas, monospace',
          fontWeight: 'bold',
          margin: 6
        },
        splitLine: {
          show: true,
          lineStyle: { color: gridLineColor, type: 'dashed' }
        }
      },
      series
    };
  } else {
    // 实时多测点柱状图 (纯图形，无标题头，横纵坐标紧挨边框，防遮挡恰当间距，亮白色高对比文字)
    const categoryNames = pts.map(p => p.name || `#${p.id}`);
    const xFontSize = Number(cp.xAxisFontSize || cp.axisFontSize || 10);
    const yFontSize = Number(cp.yAxisFontSize || cp.axisFontSize || 10);
    const valFontSize = Number(cp.valueFontSize || 11);

    const barData = pts.map((pt, idx) => {
      const curVal = readPointLiveValue(pt, idx);
      const color = pt.color || nariPhaseColors[idx % nariPhaseColors.length];
      return {
        value: curVal,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color },
            { offset: 1, color: color.startsWith('#') ? `${color}40` : 'rgba(0, 242, 255, 0.2)' }
          ]),
          borderRadius: [2, 2, 0, 0],
          borderColor: color,
          borderWidth: 1
        }
      };
    });

    return {
      backgroundColor: bgColor,
      animation: false,
      textStyle: {
        fontFamily: '"JetBrains Mono", Consolas, "Roboto Mono", monospace'
      },
      // 适当增加边框间距，恰好不遮挡柱顶数字与横纵轴标签
      grid: {
        top: cp.showValueLabel !== false ? Math.max(26, valFontSize + 14) : 12,
        right: 14,
        bottom: Math.max(22, xFontSize + 10),
        left: 12,
        containLabel: true
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(10, 16, 30, 0.95)',
        borderColor: '#0284c7',
        borderWidth: 1,
        padding: [6, 10],
        textStyle: {
          color: '#ffffff',
          fontSize: 11
        },
        formatter: (params: any) => {
          const pt = pts[params.dataIndex];
          const ptName = pt?.name || params.name;
          const ptUnit = pt?.unit || '';
          return `<div style="font-family:sans-serif;color:#ffffff;line-height:1.4;">
            <div style="color:#94a3b8;font-size:10px;margin-bottom:2px;">实时测点值</div>
            <div style="font-size:12px;font-weight:600;color:#f8fafc;">${ptName}</div>
            <div style="font-size:15px;font-weight:700;font-family:monospace;color:#00f2ff;margin-top:2px;">
              ${params.value}${ptUnit ? ' ' + ptUnit : ''}
            </div>
          </div>`;
        }
      },
      xAxis: {
        type: 'category',
        data: categoryNames,
        axisLine: {
          show: true,
          lineStyle: { color: axisLineColor, width: 1 }
        },
        axisTick: {
          show: true,
          alignWithLabel: true,
          length: 4,
          lineStyle: { color: axisLineColor }
        },
        // 核心要求：横坐标亮白色字体，可由属性面板独立控制字号，合理排列不遮掩
        axisLabel: {
          color: '#ffffff',
          fontSize: xFontSize,
          fontFamily: '"JetBrains Mono", Consolas, monospace',
          fontWeight: 'bold',
          interval: 0,
          margin: 6,
          hideOverlap: true
        }
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitNumber: 4,
        min: yMin,
        max: yMax,
        axisLine: {
          show: true,
          lineStyle: { color: axisLineColor, width: 1 }
        },
        axisTick: {
          show: true,
          length: 3,
          lineStyle: { color: axisLineColor }
        },
        // 核心要求：纵坐标亮白色字体，可由属性面板独立控制字号
        axisLabel: {
          color: '#ffffff',
          fontSize: yFontSize,
          fontFamily: '"JetBrains Mono", Consolas, monospace',
          fontWeight: 'bold',
          margin: 6
        },
        splitLine: {
          show: true,
          lineStyle: { color: gridLineColor, type: 'dashed' }
        }
      },
      series: [
        {
          name: comp.customProps?.title || comp.name,
          type: 'bar',
          barWidth: Number(cp.barWidth) || 26,
          label: {
            show: cp.showValueLabel !== false,
            position: 'top',
            color: '#ffffff',
            fontSize: valFontSize,
            fontFamily: '"JetBrains Mono", Consolas, monospace',
            fontWeight: 'bold',
            distance: 4,
            formatter: (params: any) => {
              return `${params.value}`;
            }
          },
          data: barData
        }
      ]
    };
  }
};

// 更新图表 (始终采用 notMerge: true，杜绝增量合并造成的连线断层)
const updateChart = () => {
  if (isDisposed || !chartInstance) return;
  try {
    const opt = buildOptions();
    chartInstance.setOption(opt, {
      notMerge: true,
      lazyUpdate: true,
      silent: true
    });
  } catch (err) {
    // ECharts update guard
  }
};

// 初始化图表 (采用 SVG 矢量渲染器，彻底根除缩放画布下的位图模糊与像素断层)
const initChart = () => {
  if (!chartRef.value || isDisposed) return;
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }

  chartInstance = echarts.init(chartRef.value, undefined, {
    renderer: 'svg'
  });

  const opt = buildOptions();
  chartInstance.setOption(opt, { notMerge: true });
};

// 启动或停止采样定时器 (核心：编辑态绝不启动定时器，时间轴绝对静止；仅在预览态按需采样)
const setupSamplingLifecycle = () => {
  if (sampleTimer) {
    clearInterval(sampleTimer);
    sampleTimer = null;
  }

  const isCurve = props.component.type === 'chart-realtime-curve';

  if (!props.previewMode) {
    // 编辑态：生成静态参考样本曲线，不启动任何计时器
    if (isCurve) {
      generateStaticEditorPoints();
    }
    updateChart();
    return;
  }

  // 运行预览态：预填充初始点并启动滑动采样定时器
  if (isCurve) {
    prefillRuntimePoints();
    updateChart();
  }

  const intervalMs = Math.max(500, (Number(props.component.customProps?.sampleInterval) || 1) * 1000);
  sampleTimer = setInterval(() => {
    if (isCurve) {
      sampleCurveTick();
    } else {
      sampleBarTick();
    }
  }, intervalMs);
};

onMounted(() => {
  isDisposed = false;
  setupSamplingLifecycle();

  nextTick(() => {
    initChart();
    if (chartInstance) {
      chartInstance.resize();
    }

    if (chartRef.value) {
      resizeObserver = new ResizeObserver(() => {
        if (!isDisposed && chartInstance) {
          try {
            chartInstance.resize();
          } catch {}
        }
      });
      resizeObserver.observe(chartRef.value);
    }
  });
});

// 监听编辑态/预览态切换
watch(
  () => props.previewMode,
  () => {
    setupSamplingLifecycle();
  }
);

// 监听组件属性或图表类型变更
watch(
  () => [props.component.customProps, props.component.style, props.component.type],
  () => {
    setupSamplingLifecycle();
    nextTick(() => {
      initChart();
      if (chartInstance) {
        chartInstance.resize();
      }
    });
  },
  { deep: true }
);

onBeforeUnmount(() => {
  isDisposed = true;
  if (sampleTimer) {
    clearInterval(sampleTimer);
    sampleTimer = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (chartInstance) {
    try {
      chartInstance.dispose();
    } catch {}
    chartInstance = null;
  }
});
</script>

<template>
  <!-- 纯图形呈现：无标题头，横纵坐标紧挨边框零留白，亮白色清晰字体 -->
  <div 
    class="w-full h-full bg-[#000000] overflow-hidden select-none relative"
    style="text-rendering: geometricPrecision; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; shape-rendering: geometricPrecision;"
  >
    <div ref="chartRef" class="w-full h-full" />
  </div>
</template>
