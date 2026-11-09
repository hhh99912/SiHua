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
// 南瑞 (NARI) SCADA 后台常驻实时告警环形缓存与 100ms 高频轮询引擎
// 无论全站告警窗口是否打开、最小化或关闭，后台始终持续接收并缓存告警记录
// ============================================================================

export const realtimeAlarms = shallowRef<ScadaRealtimeWarnItem[]>([]);
export const realtimeLastSeqId = ref<number>(0);
export const realtimeKnownSeqIds = new Set<number>();
export const realtimeIsPaused = ref<boolean>(false);
export const realtimeSoundEnabled = ref<boolean>(false);
// 南瑞 SCADA 实时事项窗默认容量 10000 条（支持 2000 / 5000 / 10000 / 20000）
export const realtimeMaxCapacity = ref<number>(10000);
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

// 规范化后端条目 (普通对象，避免深层 Proxy 产生的巨量堆分配)
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

  return {
    ...item,
    level_name: levelName,
    level_color: levelColor,
    type_name: typeName,
    tabs,
    full_text: fullText,
    is_examine: Boolean(item.is_examine),
    is_revert: item.is_revert !== undefined ? Boolean(item.is_revert) : true,
    fac_name: item.fac_name || '东郊变电站',
    bay_name: item.bay_name || '220kV第一线间隔',
    dev_name: item.dev_name || '断路器',
    key_name: item.key_name || (item.key_id ? `KEY_${item.key_id}` : '开关位置'),
    val_desc: item.val_desc || (item.val === 1 ? '合闸/闭合' : '分闸/断开'),
    status_desc: item.status_desc || item.val_desc || (item.val === 1 ? '合闸' : '分闸'),
    confirm: item.confirm === 1 ? 1 : 0,
    confirm_desc: item.confirm === 1 ? '已确认' : '未确认'
  };
}

/**
 * 南瑞 (NARI) SCADA 环形缓存淘汰策略：
 * 超过容量上限时，优先淘汰最早的“已确认”告警，保留未确认重要告警；若全部未确认，则淘汰最早记录。
 */
function trimAlarmsToCapacity(list: ScadaRealtimeWarnItem[], cap: number): ScadaRealtimeWarnItem[] {
  if (list.length <= cap) return list;
  let needDrop = list.length - cap;
  const dropIndices = new Set<number>();

  // 第一轮：优先淘汰最早的已确认告警 (confirm === 1)
  for (let i = 0; i < list.length && needDrop > 0; i++) {
    if (list[i].confirm === 1) {
      dropIndices.add(i);
      realtimeKnownSeqIds.delete(list[i].seq_id);
      needDrop--;
    }
  }

  // 第二轮：若仍超出容量，淘汰最早的未确认告警
  for (let i = 0; i < list.length && needDrop > 0; i++) {
    if (!dropIndices.has(i)) {
      dropIndices.add(i);
      realtimeKnownSeqIds.delete(list[i].seq_id);
      needDrop--;
    }
  }

  const result: ScadaRealtimeWarnItem[] = [];
  for (let i = 0; i < list.length; i++) {
    if (!dropIndices.has(i)) {
      result.push(list[i]);
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
      limit: 200,
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

        const cap = realtimeMaxCapacity.value || 10000;
        const merged = trimAlarmsToCapacity([...realtimeAlarms.value, ...filteredNew], cap);
        realtimeAlarms.value = merged;
        syncGlobalUnconfirmedCount();

        if (onNewAlarmsHook) {
          onNewAlarmsHook();
        }
      }
    }

    gcCheckCounter++;
    if (gcCheckCounter >= 300) {
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
  pollTimer = setInterval(() => {
    pollRealtimeAlarmsOnce();
  }, 100);
}

export async function startBackgroundAlarmPolling(): Promise<void> {
  if (isBackgroundStarted) return;
  isBackgroundStarted = true;
  realtimeIsLoading.value = true;

  try {
    await fetchScadaWarnConfig().catch(() => {});
    const res = await fetchScadaWarnRealtime({ limit: 500, after_seq: 0 });
    if (res.success && res.data && res.data.length > 0) {
      const mapped = res.data.map(normalizeRealtimeAlarmItem);
      realtimeLastSeqId.value = res.data[res.data.length - 1].seq_id;

      const cap = realtimeMaxCapacity.value || 10000;
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
