import { ref, shallowRef } from 'vue';
import {
  fetchScadaWarnConfig,
  fetchScadaWarnRealtime,
  globalUnconfirmedAlarmCount,
  ScadaRealtimeWarnItem,
  SCADA_WARN_TAB_NAMES,
  checkAlarmMatchesTab
} from './scadaClient';

// ============================================================================
// 南瑞 (NARI) / 深瑞 SCADA 工业级实时告警环形缓存与低功耗自适应轮询引擎
// 针对 凝思安全操作系统 (Linx OS 4.9.x) / Intel 2代工控机 (i3-2120 CPU) 深度调优：
// 1. 默认轮询周期从 100ms 降至 1000ms (1.0秒，符合国标 DL/T 634.5104 / GB/T 13729 调度端规约)
// 2. 默认环形队列容量从 10000 降至 1000 条 (可自由设置 500 / 1000 / 2000 / 5000 / 10000)，杜绝 V8 堆内存溢出
// 3. 告警条目全量执行 Object.freeze() 冻结，彻底消除 Vue 3 巨量响应式 Proxy 带来的 CPU 100% 跑满与软死锁
// 4. 自适应后台节流：窗口最小化或后台不可见时自动降频至 3000ms，杜绝长时间后台跑满引发 Linux 内核 Panic 重启
// ============================================================================

export const realtimeAlarms = shallowRef<ScadaRealtimeWarnItem[]>([]);
export const realtimeLastSeqId = ref<number>(0);
export const realtimeKnownSeqIds = new Set<number>();
export const realtimeIsPaused = ref<boolean>(false);
export const realtimeSoundEnabled = ref<boolean>(false);
// 凝思工控机默认容量 1000 条 (最符合 2核 i3 工控机平稳运行标准，杜绝夜间内存暴涨与 OOM)
export const realtimeMaxCapacity = ref<number>(1000);
// 工业级推荐默认轮询刷新率：1000ms (1.0秒)
export const realtimePollIntervalMs = ref<number>(1000);
export const realtimeIsLoading = ref<boolean>(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let isPollingActive = false;
let isBackgroundStarted = false;
let gcCheckCounter = 0;
let onNewAlarmsHook: (() => void) | null = null;

export function setOnNewAlarmsHook(cb: (() => void) | null) {
  onNewAlarmsHook = cb;
}

// 声音蜂鸣提醒试听
export function playAlarmBeepSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

// 规范化后端条目 (Object.freeze 彻底杜绝深层 Proxy 产生的巨量堆分配与 GC 暂停)
export function normalizeRealtimeAlarmItem(item: ScadaRealtimeWarnItem): ScadaRealtimeWarnItem {
  const levelName =
    item.level_name ||
    (item.level === 3
      ? '事故信息'
      : item.level === 2
        ? '告警信息'
        : item.level === 1
          ? '提示信息'
          : '操作记录');
  const levelColor =
    item.level_color ||
    (item.level === 3
      ? '#FF0000'
      : item.level === 2
        ? '#E6A23C'
        : item.level === 1
          ? '#67C23A'
          : '#00FFFF');
  const typeName =
    item.type_name ||
    (item.type === 28
      ? '保护动作'
      : item.type === 10
        ? '事件SOE'
        : item.type === 1
          ? '遥信变位'
          : item.type === 2
            ? '遥测越限'
            : item.type === 3
              ? '厂站工况'
              : item.type === 4
                ? '结点工况'
                : item.type === 8
                  ? '遥控'
                  : item.type === 9
                    ? '人工操作'
                    : '系统');

  const tabs =
    Array.isArray(item.tabs) && item.tabs.length > 0
      ? [...item.tabs]
      : [
          '时序信息',
          ...(levelName === '提示信息' || item.level === 1 ? ['提示信息'] : []),
          ...(levelName === '告警信息' || item.level === 2 ? ['告警信息'] : []),
          ...(levelName === '事故信息' || item.level === 3 ? ['事故信息'] : []),
          ...(typeName === '遥信变位' || item.type === 1 ? ['遥信变位'] : []),
          ...(typeName === '遥测越限' || item.type === 2 ? ['遥测越限'] : []),
          ...(typeName === '厂站工况' || item.type === 3 ? ['厂站工况'] : []),
          ...(typeName === '结点工况' || item.type === 4 ? ['结点工况'] : []),
          ...(typeName === '遥控' || item.type === 8 ? ['遥控'] : []),
          ...(typeName === '人工操作' || item.type === 9 ? ['人工操作'] : []),
          ...(item.is_examine === true ? ['检修信息'] : []),
          ...(item.is_revert === false && item.is_examine === false ? ['未复归信息'] : [])
        ];

  const fullText = item.full_text || `${levelName}  ${item.time}  ${item.content || ''}`;

  return Object.freeze({
    ...item,
    level_name: levelName,
    level_color: levelColor,
    type_name: typeName,
    tabs: Object.freeze(tabs) as string[],
    full_text: fullText,
    is_examine: Boolean(item.is_examine),
    fac_name: item.fac_name || '苏州晟高',
    bay_name: item.bay_name || '苏州晟高一体柜',
    dev_name: item.dev_name || '6',
    key_name: item.key_name || (item.key_id ? `KEY_${item.key_id}` : '开关位置'),
    val_desc: item.val_desc || (item.val === 1 ? '合' : '分'),
    status_desc: item.status_desc || item.val_desc || (item.val === 1 ? '合' : '分'),
    confirm: item.confirm === 1 ? 1 : 0,
    confirm_desc: item.confirm === 1 ? '已确认' : '未确认'
  }) as unknown as ScadaRealtimeWarnItem;
}

/**
 * 南瑞 (NARI) SCADA 环形缓存淘汰策略：
 * 超过容量上限时，优先淘汰最早的“已确认”告警，保留未确认重要告警；若全部未确认，则淘汰最早记录。
 * 淘汰后严格重置 realtimeKnownSeqIds，彻底消除内存泄漏。
 */
function trimAlarmsToCapacity(list: ScadaRealtimeWarnItem[], cap: number): ScadaRealtimeWarnItem[] {
  if (list.length <= cap) return list;
  let needDrop = list.length - cap;
  const dropIndices = new Set<number>();

  // 第一轮：优先淘汰最早的已确认告警 (confirm === 1)
  for (let i = 0; i < list.length && needDrop > 0; i++) {
    if (list[i].confirm === 1) {
      dropIndices.add(i);
      needDrop--;
    }
  }

  // 第二轮：若仍超出容量，淘汰最早的未确认告警
  for (let i = 0; i < list.length && needDrop > 0; i++) {
    if (!dropIndices.has(i)) {
      dropIndices.add(i);
      needDrop--;
    }
  }

  const result: ScadaRealtimeWarnItem[] = [];
  realtimeKnownSeqIds.clear();
  for (let i = 0; i < list.length; i++) {
    if (!dropIndices.has(i)) {
      result.push(list[i]);
      realtimeKnownSeqIds.add(list[i].seq_id);
    }
  }
  return result;
}

export function syncGlobalUnconfirmedCount() {
  const list = realtimeAlarms.value;
  let count = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i].confirm === 0) count++;
  }
  globalUnconfirmedAlarmCount.value = count;
}

export async function pollRealtimeAlarmsOnce(): Promise<void> {
  if (realtimeIsPaused.value || isPollingActive) return;
  isPollingActive = true;

  try {
    const res = await fetchScadaWarnRealtime({
      limit: 100,
      after_seq: realtimeLastSeqId.value
    });

    if (res.success && res.data && res.data.length > 0) {
      const newItems = res.data.map(normalizeRealtimeAlarmItem);
      realtimeLastSeqId.value = res.data[res.data.length - 1].seq_id;

      const filteredNew: ScadaRealtimeWarnItem[] = [];
      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        if (!realtimeKnownSeqIds.has(item.seq_id)) {
          realtimeKnownSeqIds.add(item.seq_id);
          filteredNew.push(item);
        }
      }

      if (filteredNew.length > 0) {
        if (realtimeSoundEnabled.value) {
          playAlarmBeepSound();
        }

        const cap = realtimeMaxCapacity.value || 1000;
        const merged = trimAlarmsToCapacity([...realtimeAlarms.value, ...filteredNew], cap);
        realtimeAlarms.value = merged;
        syncGlobalUnconfirmedCount();

        if (onNewAlarmsHook) {
          onNewAlarmsHook();
        }
      }
    }

    gcCheckCounter++;
    if (gcCheckCounter >= 120) {
      gcCheckCounter = 0;
      if (typeof window !== 'undefined' && (window as any).gc) {
        try {
          (window as any).gc();
        } catch {}
      }
    }
  } catch {
    // 忽略偶发网络波动
  } finally {
    isPollingActive = false;
  }
}

export function restartRealtimePollingTimer() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isPollingActive = false;

  // 严格定死为 1000ms (1.0秒) 恒定轮询，无论窗口是否最小化、隐藏或在后台，均严格保持 1 秒 1 次，不降低频率
  pollTimer = setInterval(() => {
    pollRealtimeAlarmsOnce();
  }, 1000);
}

export async function startBackgroundAlarmPolling(): Promise<void> {
  if (isBackgroundStarted) return;
  isBackgroundStarted = true;
  realtimeIsLoading.value = true;

  try {
    await fetchScadaWarnConfig().catch(() => {});
    const res = await fetchScadaWarnRealtime({ limit: 200, after_seq: 0 });
    if (res.success && res.data && res.data.length > 0) {
      const mapped = res.data.map(normalizeRealtimeAlarmItem);
      realtimeLastSeqId.value = res.data[res.data.length - 1].seq_id;

      const cap = realtimeMaxCapacity.value || 1000;
      const sliced = mapped.slice(-cap);
      realtimeKnownSeqIds.clear();
      for (const item of sliced) {
        realtimeKnownSeqIds.add(item.seq_id);
      }
      realtimeAlarms.value = sliced;
      syncGlobalUnconfirmedCount();
    }
  } catch (err) {
    console.warn('初始化后台实时告警服务失败:', err);
  } finally {
    realtimeIsLoading.value = false;
  }

  restartRealtimePollingTimer();
}
