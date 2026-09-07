<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, nextTick } from 'vue';
import * as echarts from 'echarts';
import { ScreenComponent, DatasetItem } from '../../types';
import { withAlpha } from '../../utils/color';
import { resolveComponentDynamicData, parseStrictNumber } from '../../utils/scadaResolver';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();
const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;
let isDisposed = false;

const defaultColors = ['#00f2ff', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const buildChartOptions = () => {
  const { type, data, style, customProps } = props.component;
  const boundDataset = props.datasets?.find(d => d.id === data.datasetId);
  const dynamicPayload = resolveComponentDynamicData(props.component, props.datasets);
  const activeData = { ...(boundDataset?.data || {}), ...(data.staticData || {}), ...dynamicPayload };

  const themeColor = style.fill || style.stroke || '#00f2ff';
  const subColor = style.stroke || '#3b82f6';
  const textColor = style.textColor || '#cbd5e1';
  const gridColor = '#1e293b';

  const defaultLineCategories = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

  // Threshold MarkLines configuration
  const markLines: any[] = [];
  if (customProps?.showUpperLimit && customProps?.upperLimit !== undefined) {
    markLines.push({
      yAxis: parseStrictNumber(customProps.upperLimit, 100),
      name: customProps.upperLimitLabel || '上限告警',
      lineStyle: { color: '#ef4444', width: 1.5, type: 'dashed' },
      label: {
        show: true,
        formatter: `${customProps.upperLimitLabel || '上限'}: {c}`,
        color: '#ef4444',
        fontSize: 10,
        position: 'insideEndTop'
      }
    });
  }
  if (customProps?.showLowerLimit && customProps?.lowerLimit !== undefined) {
    markLines.push({
      yAxis: parseStrictNumber(customProps.lowerLimit, 0),
      name: customProps.lowerLimitLabel || '下限预警',
      lineStyle: { color: '#f59e0b', width: 1.5, type: 'dashed' },
      label: {
        show: true,
        formatter: `${customProps.lowerLimitLabel || '下限'}: {c}`,
        color: '#f59e0b',
        fontSize: 10,
        position: 'insideEndBottom'
      }
    });
  }

  // 1. Line Chart (支持多系列与SCADA时序流)
  if (type === 'chart-line') {
    const xData = (data.mapping?.categoriesKey && activeData[data.mapping.categoriesKey]) 
      || activeData.timestamps 
      || activeData.categories 
      || defaultLineCategories;

    // Check for multi-series definition
    const seriesListConfig = customProps?.seriesList || data.mapping?.seriesList;
    let series: any[] = [];

    if (Array.isArray(seriesListConfig) && seriesListConfig.length > 0) {
      series = seriesListConfig.map((s: any, idx: number) => {
        const sColor = s.color || defaultColors[idx % defaultColors.length];
        const rawValues = (s.key && activeData[s.key]) || s.data || [40 + idx * 10, 55 + idx * 8, 70 + idx * 5, 60 + idx * 7, 85 + idx * 4, 90 + idx * 3, 75 + idx * 6];
        return {
          name: s.name || `曲线 ${idx + 1}`,
          type: 'line',
          smooth: customProps?.smooth !== false,
          showSymbol: Boolean(customProps?.showSymbol),
          symbolSize: 6,
          itemStyle: { color: sColor },
          lineStyle: { width: s.strokeWidth || 2.5, color: sColor },
          label: {
            show: Boolean(customProps?.showDataLabels),
            color: '#fff',
            fontSize: 10,
            fontFamily: 'monospace',
            position: 'top'
          },
          areaStyle: (customProps?.showArea !== false) ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: withAlpha(sColor, 0.35) },
              { offset: 1, color: withAlpha(sColor, 0.02) }
            ])
          } : undefined,
          markLine: idx === 0 && markLines.length > 0 ? { data: markLines } : undefined,
          data: rawValues
        };
      });
    } else if (Array.isArray(activeData.series) && activeData.series.length > 0) {
      series = activeData.series.map((s: any, idx: number) => {
        const sColor = s.color || defaultColors[idx % defaultColors.length];
        return {
          name: s.name || `系列 ${idx + 1}`,
          type: 'line',
          smooth: customProps?.smooth !== false,
          showSymbol: Boolean(customProps?.showSymbol),
          symbolSize: 6,
          itemStyle: { color: sColor },
          lineStyle: { width: 2.5, color: sColor },
          label: {
            show: Boolean(customProps?.showDataLabels),
            color: '#fff',
            fontSize: 10,
            position: 'top'
          },
          areaStyle: (customProps?.showArea !== false) ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: withAlpha(sColor, 0.35) },
              { offset: 1, color: withAlpha(sColor, 0.02) }
            ])
          } : undefined,
          markLine: idx === 0 && markLines.length > 0 ? { data: markLines } : undefined,
          data: s.data || []
        };
      });
    } else {
      const yData = (data.mapping?.seriesKey && activeData[data.mapping.seriesKey]) 
        || activeData.history 
        || activeData.values 
        || [45, 62, 78, 59, 88, 92, 74];

      series = [
        {
          name: props.component.name,
          type: 'line',
          smooth: customProps?.smooth !== false,
          showSymbol: Boolean(customProps?.showSymbol),
          symbolSize: 6,
          data: yData,
          itemStyle: { color: themeColor },
          lineStyle: { width: style.strokeWidth || 2.5, color: themeColor },
          label: {
            show: Boolean(customProps?.showDataLabels),
            color: '#fff',
            fontSize: 10,
            position: 'top'
          },
          areaStyle: (customProps?.showArea !== false) ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: withAlpha(themeColor, 0.4) },
              { offset: 1, color: withAlpha(themeColor, 0.02) }
            ])
          } : undefined,
          markLine: markLines.length > 0 ? { data: markLines } : undefined
        }
      ];
    }

    return {
      backgroundColor: 'transparent',
      grid: { top: 35, right: 20, bottom: 25, left: 45, containLabel: false },
      legend: {
        show: customProps?.showLegend !== false && series.length > 1,
        top: 2,
        right: 10,
        textStyle: { color: '#94a3b8', fontSize: 10 },
        itemWidth: 12,
        itemHeight: 8
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#060b17',
        borderColor: themeColor,
        borderWidth: 1,
        textStyle: { color: '#fff', fontSize: 11, fontFamily: 'monospace' }
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: textColor, fontSize: 10, fontFamily: 'monospace' },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: customProps?.unit || data.mapping?.unitKey || '',
        nameTextStyle: { color: textColor, fontSize: 10, padding: [0, 0, 0, -20] },
        axisLine: { show: false },
        axisLabel: { color: textColor, fontSize: 10, fontFamily: 'monospace' },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
      },
      series
    };
  }

  // 2. Bar Chart
  if (type === 'chart-bar') {
    const xData = (data.mapping?.categoriesKey && activeData[data.mapping.categoriesKey]) 
      || activeData.workshops 
      || activeData.categories 
      || ['1#车间', '2#车间', '3#车间', '4#车间', '5#车间', '6#车间'];
    const yData = (data.mapping?.seriesKey && activeData[data.mapping.seriesKey]) 
      || activeData.efficiency 
      || activeData.values 
      || [86, 92, 78, 95, 88, 91];

    return {
      backgroundColor: 'transparent',
      grid: { top: 35, right: 15, bottom: 25, left: 40, containLabel: false },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#060b17',
        borderColor: themeColor,
        textStyle: { color: '#fff', fontSize: 11 }
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: textColor, fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        name: customProps?.unit || data.mapping?.unitKey || '',
        nameTextStyle: { color: textColor, fontSize: 10, padding: [0, 0, 0, -20] },
        axisLine: { show: false },
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
      },
      series: [
        {
          name: props.component.name,
          type: 'bar',
          barWidth: customProps?.barWidth || 18,
          label: {
            show: Boolean(customProps?.showDataLabels),
            position: 'top',
            color: '#fff',
            fontSize: 10,
            fontFamily: 'monospace'
          },
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: themeColor },
              { offset: 1, color: subColor }
            ])
          },
          markLine: markLines.length > 0 ? { data: markLines } : undefined,
          data: yData
        }
      ]
    };
  }

  // 3. Pie / Doughnut Chart
  if (type === 'chart-pie') {
    const pieData = activeData.energy_distribution || activeData.pieList || activeData.data || [
      { name: '重载机加工', value: 42 },
      { name: '热处理炉', value: 28 },
      { name: '空压动力站', value: 18 },
      { name: '照明与辅助', value: 12 }
    ];

    const isDoughnut = customProps?.isDoughnut !== false;

    return {
      backgroundColor: 'transparent',
      color: defaultColors,
      tooltip: {
        trigger: 'item',
        backgroundColor: '#060b17',
        borderColor: themeColor,
        textStyle: { color: '#fff', fontSize: 11 },
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        show: customProps?.showLegend !== false,
        bottom: '2%',
        left: 'center',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: textColor, fontSize: 10 }
      },
      series: [
        {
          name: props.component.name,
          type: 'pie',
          radius: isDoughnut ? ['45%', '72%'] : ['0%', '72%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#050914',
            borderWidth: 2
          },
          label: { 
            show: Boolean(customProps?.showDataLabels),
            formatter: '{b}: {d}%',
            color: '#e2e8f0',
            fontSize: 10
          },
          data: pieData
        }
      ]
    };
  }

  // 4. Gauge Chart
  if (type === 'chart-gauge') {
    const val = (data.mapping?.valueKey && activeData[data.mapping.valueKey]) 
      || activeData.sensor_val 
      || activeData.yield_rate 
      || 85.6;

    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          center: ['50%', '55%'],
          radius: '88%',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: data.mapping?.thresholdMax || customProps?.maxVal || 100,
          splitNumber: 5,
          itemStyle: { color: themeColor },
          progress: {
            show: true,
            width: 8,
            roundCap: true,
            itemStyle: { color: themeColor }
          },
          pointer: {
            length: '55%',
            width: 4,
            itemStyle: { color: themeColor }
          },
          axisLine: {
            roundCap: true,
            lineStyle: { width: 8, color: [[1, '#1e293b']] }
          },
          axisTick: { distance: -16, length: 4, lineStyle: { color: '#475569', width: 1 } },
          splitLine: { distance: -20, length: 8, lineStyle: { color: themeColor, width: 2 } },
          axisLabel: { distance: -28, color: textColor, fontSize: 9, fontFamily: 'monospace' },
          title: {
            offsetCenter: [0, '40%'],
            fontSize: 11,
            color: textColor,
            fontFamily: 'sans-serif'
          },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '70%'],
            fontSize: 18,
            fontWeight: 'bold',
            formatter: `{value}${data.mapping?.unitKey || customProps?.unit || '%'}`,
            color: '#ffffff',
            fontFamily: 'monospace'
          },
          data: [{ value: Math.round(Number(val) * 10) / 10, name: props.component.name }]
        }
      ]
    };
  }

  // 5. Radar Chart
  if (type === 'chart-radar') {
    const indicators = activeData.indicators || [
      { name: '综合能效', max: 100 },
      { name: '良品率', max: 100 },
      { name: '稼动率', max: 100 },
      { name: '安全指数', max: 100 },
      { name: '维护健康', max: 100 }
    ];

    const radarValues = activeData.radarValues || [88, 96, 91, 99, 85];

    return {
      backgroundColor: 'transparent',
      radar: {
        indicator: indicators,
        radius: '65%',
        splitNumber: 4,
        axisName: { color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: '#1e293b' } },
        splitArea: { areaStyle: { color: ['rgba(0,242,255,0.02)', 'rgba(0,242,255,0.06)'] } },
        axisLine: { lineStyle: { color: '#334155' } }
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: radarValues,
              name: props.component.name || '综合指标',
              itemStyle: { color: themeColor },
              areaStyle: { color: withAlpha(themeColor, 0.3) }
            }
          ]
        }
      ]
    };
  }

  // 6. Scatter / Default
  return {
    backgroundColor: 'transparent',
    grid: { top: 20, right: 20, bottom: 20, left: 30 },
    xAxis: { splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      {
        symbolSize: 8,
        data: [[10.0, 8.04], [8.07, 6.95], [13.0, 7.58], [9.05, 8.81], [11.0, 8.33], [14.0, 7.66]],
        type: 'scatter',
        itemStyle: { color: themeColor }
      }
    ]
  };
};

let renderScheduled = false;

const renderChart = () => {
  if (isDisposed || !chartRef.value) return;
  if (renderScheduled) return;

  renderScheduled = true;
  nextTick(() => {
    renderScheduled = false;
    if (isDisposed || !chartRef.value) return;

    try {
      if (!chartInstance) {
        chartInstance = echarts.init(chartRef.value, undefined, {
          devicePixelRatio: Math.max(window.devicePixelRatio || 1, 1),
          renderer: 'canvas'
        });
      }
      const options = buildChartOptions();
      // Ensure global text font family is crisp
      if (!options.textStyle) {
        options.textStyle = {
          fontFamily: 'Noto Sans CJK SC, WenQuanYi Micro Hei, WenQuanYi Zen Hei, PingFang SC, Microsoft YaHei, sans-serif'
        };
      }
      chartInstance.setOption(options, {
        notMerge: true,
        lazyUpdate: true,
        silent: true
      });
    } catch (err) {
      console.warn('ECharts render warning:', err);
    }
  });
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  isDisposed = false;
  renderChart();

  if (chartRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (!isDisposed && chartInstance) {
        chartInstance.resize();
      }
    });
    resizeObserver.observe(chartRef.value);
  }
});

watch(
  () => [props.component, props.datasets],
  () => {
    renderChart();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  isDisposed = true;
  resizeObserver?.disconnect();
  if (chartInstance) {
    try {
      chartInstance.dispose();
    } catch {}
    chartInstance = null;
  }
});
</script>

<template>
  <div class="w-full h-full p-1 relative flex flex-col select-none overflow-hidden">
    <!-- ECharts Container -->
    <div ref="chartRef" class="flex-1 w-full h-full min-h-16" />
  </div>
</template>
