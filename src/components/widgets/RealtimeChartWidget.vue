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

const props = defineProps<Props>();

const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;
let sampleTimer: ReturnType<typeof setInterval> | null = null;
let resizeObserver: ResizeObserver | null = null;
let isDisposed = false;

// 调色板：纯亮白作为主基调，搭配高对比工控明晰亮色
const defaultColors = [
  '#ffffff', // 纯白（与预览一致）
  '#00f2ff', // 青色
  '#fbbf24', // 琥珀黄
  '#34d399', // 翡翠绿
  '#38bdf8', // 天蓝
  '#c084fc', // 浅紫
  '#f472b6', // 樱花粉
  '#f97316'  // 亮橙
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
      color: p.color || defaultColors[idx % defaultColors.length],
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
      color: '#ffffff',
      unit: mapping.unit || cp.unit || def.point?.unit || 'A'
    }
  ];
});

// 格式化当前时分秒
const formatTime = (d: Date) => {
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// 实时曲线历史环形缓冲区 (针对每个测点维护独立时间序列)
interface TimePoint {
  time: string;
  value: number;
}
const curveHistoryMap = ref<Map<number, TimePoint[]>>(new Map());

// 读取单个测点瞬时值 (纳秒级读取前端内存 Map，0 次 HTTP 请求)
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

  // 若尚未有真实采样（如编辑态或初次挂载），返回拟真稳定基线
  const base = 20 + (fallbackIndex * 15) + ((pt.id % 17) * 2.5);
  return Number(base.toFixed(2));
};

// 1. 实时曲线采样逻辑 (时序连续滑动记录)
const sampleCurveTick = () => {
  if (isDisposed) return;
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

// 2. 实时柱状图直接刷新（不记历史，仅渲染当前各测点瞬时变化值）
const sampleBarTick = () => {
  if (isDisposed) return;
  updateChart();
};

// 初始化与更新 ECharts 配置 (紧挨边框零留白、超清亮白字体图形、零 CPU 软渲染动画开销)
const buildOptions = (): echarts.EChartsOption => {
  const comp = props.component;
  const cp = comp.customProps || {};
  const style = comp.style || {};
  const isCurve = comp.type === 'chart-realtime-curve';
  const pts = configuredPoints.value;
  const unit = cp.unit || style.unit || (pts[0]?.unit) || '';

  const bgColor = style.fill || '#000000';
  const gridLineColor = '#1f1f1f';
  const axisLineColor = '#555555';

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
      const color = pt.color || defaultColors[idx % defaultColors.length];

      return {
        name: pt.name || `#${pt.id}`,
        type: 'line',
        smooth: cp.smooth !== false,
        showSymbol: false,
        symbolSize: 4,
        lineStyle: {
          width: Number(cp.lineWidth) || 2,
          color
        },
        itemStyle: {
          color
        },
        areaStyle: cp.showArea ? {
          color: color.startsWith('#') 
            ? `${color}25` // 15% opacity hex
            : 'rgba(255, 255, 255, 0.1)'
        } : undefined,
        data: dataVals
      };
    });

    return {
      backgroundColor: bgColor,
      // 关键优化：工控机纯 CPU 软渲染彻底关闭动画，防看门狗超时
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      textStyle: {
        fontFamily: 'Noto Sans SC, "PingFang SC", "Microsoft YaHei", sans-serif'
      },
      // 用户核心要求：横纵坐标紧挨边框，不要有任何留白
      grid: {
        top: 6,
        right: 4,
        bottom: 0,
        left: 0,
        containLabel: true
      },
      legend: pts.length > 1 && cp.showLegend !== false ? {
        top: 2,
        right: 6,
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 3,
        textStyle: {
          color: '#ffffff',
          fontSize: 10,
          fontFamily: 'sans-serif'
        }
      } : undefined,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#18181b',
        borderColor: '#52525b',
        borderWidth: 1,
        padding: [4, 8],
        textStyle: {
          color: '#ffffff',
          fontSize: 11
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          let res = `<div style="font-family:sans-serif;color:#ffffff;line-height:1.4;">`;
          res += `<div style="color:#a1a1aa;font-size:10px;margin-bottom:2px;">时间: ${params[0].name}</div>`;
          params.forEach((item: any) => {
            res += `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:1px 0;">
              <span style="display:flex;align-items:center;gap:4px;">
                <span style="display:inline-block;width:7px;height:7px;border-radius:1px;background:${item.color};"></span>
                <span style="font-size:11px;color:#f4f4f5;">${item.seriesName}:</span>
              </span>
              <span style="font-weight:700;font-family:monospace;font-size:12px;color:#ffffff;">${item.value}${unit ? ' ' + unit : ''}</span>
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
        axisLabel: {
          color: '#ffffff',
          fontSize: 11,
          fontFamily: '"JetBrains Mono", Consolas, "Roboto Mono", monospace',
          fontWeight: 500,
          margin: 4
        },
        splitLine: {
          show: true,
          lineStyle: { color: gridLineColor, type: 'dashed' }
        }
      },
      yAxis: {
        type: 'value',
        scale: true,
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
        axisLabel: {
          color: '#ffffff',
          fontSize: 11,
          fontFamily: '"JetBrains Mono", Consolas, "Roboto Mono", monospace',
          fontWeight: 500,
          margin: 4
        },
        splitLine: {
          show: true,
          lineStyle: { color: gridLineColor, type: 'dashed' }
        }
      },
      series
    };
  } else {
    // 实时多测点柱状图 (紧挨边框，仅展示各测点当前瞬时变化值)
    const categoryNames = pts.map(p => p.name || `#${p.id}`);
    const barData = pts.map((pt, idx) => {
      const curVal = readPointLiveValue(pt, idx);
      const color = pt.color || defaultColors[idx % defaultColors.length];
      return {
        value: curVal,
        itemStyle: {
          color,
          borderRadius: [2, 2, 0, 0]
        }
      };
    });

    return {
      backgroundColor: bgColor,
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      textStyle: {
        fontFamily: 'Noto Sans SC, "PingFang SC", "Microsoft YaHei", sans-serif'
      },
      // 用户核心要求：横纵坐标紧挨边框，不要有任何留白
      grid: {
        top: cp.showValueLabel !== false ? 16 : 4,
        right: 4,
        bottom: 0,
        left: 0,
        containLabel: true
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#18181b',
        borderColor: '#52525b',
        borderWidth: 1,
        padding: [4, 8],
        textStyle: {
          color: '#ffffff',
          fontSize: 11
        },
        formatter: (params: any) => {
          const pt = pts[params.dataIndex];
          const ptName = pt?.name || params.name;
          const ptUnit = pt?.unit || unit;
          return `<div style="font-family:sans-serif;color:#ffffff;line-height:1.4;">
            <div style="color:#a1a1aa;font-size:10px;">瞬时值</div>
            <div style="font-size:12px;font-weight:600;color:#ffffff;">${ptName}</div>
            <div style="font-size:14px;font-weight:700;font-family:monospace;color:#ffffff;margin-top:1px;">
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
          length: 3,
          lineStyle: { color: axisLineColor }
        },
        axisLabel: {
          color: '#ffffff',
          fontSize: 11,
          fontFamily: '"JetBrains Mono", Consolas, "Roboto Mono", monospace',
          fontWeight: 500,
          interval: 0,
          margin: 4
        }
      },
      yAxis: {
        type: 'value',
        scale: true,
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
        axisLabel: {
          color: '#ffffff',
          fontSize: 11,
          fontFamily: '"JetBrains Mono", Consolas, "Roboto Mono", monospace',
          fontWeight: 500,
          margin: 4
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
          barWidth: Number(cp.barWidth) || 24,
          label: {
            show: cp.showValueLabel !== false,
            position: 'top',
            color: '#ffffff',
            fontSize: 11,
            fontFamily: '"JetBrains Mono", Consolas, monospace',
            fontWeight: 'bold',
            distance: 2,
            formatter: (params: any) => {
              const u = pts[params.dataIndex]?.unit || unit;
              return `${params.value}${u ? ' ' + u : ''}`;
            }
          },
          data: barData
        }
      ]
    };
  }
};

const updateChart = () => {
  if (isDisposed || !chartInstance) return;
  try {
    const opt = buildOptions();
    chartInstance.setOption(opt, {
      notMerge: false,
      lazyUpdate: true,
      silent: true
    });
  } catch (err) {
    // Echarts silent update
  }
};

const initChart = () => {
  if (!chartRef.value || isDisposed) return;
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }

  // 关键：强制 2x+ 超清分辨率，消除缩放与高清屏下的模糊
  chartInstance = echarts.init(chartRef.value, undefined, {
    renderer: 'canvas',
    devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2)
  });

  const opt = buildOptions();
  chartInstance.setOption(opt, { notMerge: true });
};

// 预填充若干初始点避免初次打开曲线为空
const prefillInitialPoints = () => {
  const pts = configuredPoints.value;
  const now = new Date();
  const sampleSec = Math.max(1, Number(props.component.customProps?.sampleInterval) || 1);
  const initialCount = 10;

  pts.forEach((pt, idx) => {
    const list: TimePoint[] = [];
    for (let i = initialCount - 1; i >= 0; i--) {
      const t = new Date(now.getTime() - i * sampleSec * 1000);
      list.push({
        time: formatTime(t),
        value: readPointLiveValue(pt, idx)
      });
    }
    curveHistoryMap.value.set(pt.id, list);
  });
};

onMounted(() => {
  isDisposed = false;
  const isCurve = props.component.type === 'chart-realtime-curve';

  if (isCurve) {
    prefillInitialPoints();
  }

  nextTick(() => {
    initChart();
    if (chartInstance) {
      chartInstance.resize();
    }

    // 定时采样器 (1秒1点，纯前端内存读取，0网络开销)
    const intervalMs = Math.max(500, (Number(props.component.customProps?.sampleInterval) || 1) * 1000);
    sampleTimer = setInterval(() => {
      if (isCurve) {
        sampleCurveTick();
      } else {
        sampleBarTick();
      }
    }, intervalMs);

    // 监听容器拉伸尺寸自适应
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

watch(
  () => [props.component.customProps, props.component.style, props.component.type],
  () => {
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
  <!-- 纯图形呈现：无标题头，无任何留白与多余内边距，坐标轴直贴边框 -->
  <div 
    class="w-full h-full bg-[#000000] overflow-hidden select-none relative"
    style="text-rendering: geometricPrecision; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;"
  >
    <div ref="chartRef" class="w-full h-full" />
  </div>
</template>
