/**
 * SCADA 系统 HTTP 开放接口模拟与数据服务
 * 严格遵照 SCADA 接口文档规范：
 * 1. GET /api/scada/config
 * 2. POST /api/scada/realtime
 * 3. POST /api/scada/control/yk
 * 4. POST /api/scada/control/yt
 * 5. POST /api/scada/control/unflash
 */

/*** 遥信状态 (行业标准定义) ***/
export const STATE_YX = {
  NORMAL: 0,          // 正常
  INVALID: 1,         // 无效
  BAD_DATA: 2,        // 双位不一致(合)
  BAD_DATA_OFF: 3,    // 双位不一致(分)
  LOCK_ON: 4,         // 遥信封锁(合)
  LOCK_OFF: 5,        // 遥信封锁(分)
  SET: 6,             // 遥信人工置数
  BW_ON: 7,           // 遥信变位(合)
  BW_OFF: 8,          // 遥信变位(分)
  SGBW_ON: 9,         // 遥信事故变位(合)
  SGBW_OFF: 10,       // 遥信事故变位(分)
  SOE_ON: 11,         // 遥信SOE动作
  SOE_OFF: 12,        // 遥信SOE复归
  DISTURB: 13,        // 遥信扰动
  CHECK_REPARE: 14,   // 遥信检修
  PASSBY: 15          // 遥信被旁路
} as const;

/**
 * 判断遥信状态是否处于变位闪烁中 (依据遥信 status：7 变位合, 8 变位分, 9 事故变位合, 10 事故变位分, 11 SOE动作, 12 SOE复归)
 */
export function isYxFlashingStatus(status: any): boolean {
  if (status === undefined || status === null || status === '') return false;
  const num = Number(status);
  if (isNaN(num)) return false;
  return num >= 7 && num <= 12;
}

export interface ScadaRawConfig {
  version: string;
  statistics: Record<string, number>;
  facilities: any[];
}

export const DEFAULT_SCADA_TREE_DATA: ScadaRawConfig = {
  version: "1.0",
  statistics: {
    facilities: 1,
    bays: 2,
    cb_devices: 3,
    bs_devices: 0,
    bl_devices: 0,
    tr_devices: 0,
    gn_devices: 0,
    ld_devices: 0,
    rc_devices: 0,
    wd_devices: 0,
    other_devices: 0,
    ied: 2,
    logic_devices: 2,
    yc_points: 61,
    yx_points: 9,
    yk_points: 2,
    yt_points: 1,
    dd_points: 2,
    dd_channels: 2,
    yk_channels: 2,
    yt_rely: 0
  },
  facilities: [
    {
      id: 4000003,
      name: "苏州晟高",
      alias: "F01",
      bays: [
        {
          id: 430000001,
          name: "苏州晟高一体柜",
          alias: "F01.V10.S01",
          serial: -1,
          type: 4,
          type_sub: 4,
          cb_devices: [
            {
              id: 7000001,
              no: -1,
              name: "6",
              alias: "F01.V10.S01.DL01",
              cbty: 0,
              cbty_name: "开关",
              cbty_sub: 0,
              state: 1,
              status: 7,
              yc_points: [
                { id: 62000001, name: "yc01", alias: "F01.V10.S01.DL01.YC001", type: 0, type_name: "普通遥测", val: 2432747, status: 0, status_name: "正常" },
                { id: 62000002, name: "yc02", alias: "F01.V10.S01.DL01.YC002", type: 0, type_name: "普通遥测", val: 24000, status: 0, status_name: "正常" },
                { id: 62000003, name: "yc03", alias: "F01.V10.S01.DL01.YC003", type: 0, type_name: "普通遥测", val: 120000, status: 0, status_name: "正常" },
                { id: 62000004, name: "yc04", alias: "F01.V10.S01.DL01.YC004", type: 0, type_name: "普通遥测", val: 120000, status: 0, status_name: "正常", if_yt: 0 },
                { id: 62000005, name: "yc05", alias: "F01.V10.S01.DL01.YC005", type: 0, type_name: "普通遥测", val: 0, status: 1, status_name: "无效", if_yt: 1 },
                { id: 62000006, name: "yc06", alias: "F01.V10.S01.DL01.YC006", type: 0, type_name: "普通遥测", val: 0, status: 1, status_name: "无效" },
                { id: 62000007, name: "yc07", alias: "F01.V10.S01.DL01.YC007", type: 0, type_name: "普通遥测", val: 0, status: 1, status_name: "无效" },
                { id: 62000008, name: "yc08", alias: "F01.V10.S01.DL01.YC008", type: 0, type_name: "普通遥测", val: 0, status: 1, status_name: "无效" },
                { id: 62000009, name: "yc09", alias: "F01.V10.S01.DL01.YC009", type: 0, type_name: "普通遥测", val: 0, status: 1, status_name: "无效" },
                { id: 62000010, name: "yc10", alias: "F01.V10.S01.DL01.YC010", type: 0, type_name: "普通遥测", val: 0, status: 1, status_name: "无效" },
                { id: 62000011, name: "yc11", alias: "F01.V10.S01.DL01.YC011", type: 0, type_name: "普通遥测", val: 0, status: 1, status_name: "无效" },
                { id: 62000012, name: "yc12", alias: "F01.V10.S01.DL01.YC012", type: 0, type_name: "普通遥测", val: 0, status: 1, status_name: "无效" },
                { id: 62000013, name: "yc13", alias: "F01.V10.S01.DL01.YC013", type: 0, type_name: "普通遥测", val: 0, status: 1, status_name: "无效" },
                { id: 62000014, name: "yc14", alias: "F01.V10.S01.DL01.YC014", type: 0, type_name: "普通遥测", val: 220.5, status: 0, status_name: "正常" },
                { id: 62000015, name: "yc15", alias: "F01.V10.S01.DL01.YC015", type: 0, type_name: "普通遥测", val: 220.1, status: 0, status_name: "正常" },
                { id: 62000016, name: "yc16", alias: "F01.V10.S01.DL01.YC016", type: 0, type_name: "普通遥测", val: 220.8, status: 0, status_name: "正常" },
                { id: 62000017, name: "yc17", alias: "F01.V10.S01.DL01.YC017", type: 0, type_name: "普通遥测", val: 12.4, status: 0, status_name: "正常" },
                { id: 62000018, name: "yc18", alias: "F01.V10.S01.DL01.YC018", type: 0, type_name: "普通遥测", val: 12.3, status: 0, status_name: "正常" },
                { id: 62000019, name: "yc19", alias: "F01.V10.S01.DL01.YC019", type: 0, type_name: "普通遥测", val: 12.5, status: 0, status_name: "正常" },
                { id: 62000020, name: "yc20", alias: "F01.V10.S01.DL01.YC020", type: 0, type_name: "普通遥测", val: 50.01, status: 0, status_name: "正常" },
                { id: 62000021, name: "yc21", alias: "F01.V10.S01.DL01.YC021", type: 0, type_name: "普通遥测", val: 0.98, status: 0, status_name: "正常" },
                { id: 62000022, name: "yc22", alias: "F01.V10.S01.DL01.YC022", type: 0, type_name: "普通遥测", val: 35.2, status: 0, status_name: "正常" },
                { id: 62000023, name: "yc23", alias: "F01.V10.S01.DL01.YC023", type: 0, type_name: "普通遥测", val: 36.1, status: 0, status_name: "正常" },
                { id: 62000024, name: "yc24", alias: "F01.V10.S01.DL01.YC024", type: 0, type_name: "普通遥测", val: 34.8, status: 0, status_name: "正常" }
              ],
              yx_points: [
                { id: 61000006, name: "yx06", alias: "F01.V10.S01.DL01.POS_OPN", type: 1, type_name: "开关位置", value: 1, status: 7, status_name: "变位(合)", q: 0 },
                { id: 61000002, name: "yx02", alias: "F01.V10.S01.DL01.YX002", type: 0, type_name: "普通遥信", value: 1, status: 7, status_name: "变位(合)", q: 0 },
                { id: 61000003, name: "yx03", alias: "F01.V10.S01.DL01.YX003", type: 0, type_name: "普通遥信", value: 1, status: 7, status_name: "变位(合)", q: 0 },
                { id: 61000004, name: "yx04", alias: "F01.V10.S01.DL01.YX004", type: 0, type_name: "普通遥信", value: 1, status: 7, status_name: "变位(合)", q: 0 },
                { id: 61000005, name: "yx05003", alias: "F01.V10.S01.DL01.YX005", type: 0, type_name: "普通遥信", value: 0, status: 0, status_name: "正常", q: 0 },
                { id: 61000007, name: "yx07", alias: "F01.V10.S01.DL01.YX007", type: 0, type_name: "普通遥信", value: 0, status: 0, status_name: "正常", q: 0 },
                { id: 61000008, name: "yx08", alias: "F01.V10.S01.DL01.YX008", type: 0, type_name: "普通遥信", value: 0, status: 0, status_name: "正常", q: 0 }
              ],
              yk_points: [
                {
                  id: 54000003,
                  name: "6遥控666",
                  alias: "F01.V10.S01.DL01.YK01",
                  type: 0,
                  type_name: "有监护遥控",
                  channel: 0,
                  targetVerificationPointId: 61000006, // 关联开关位置遥信
                  yt_define: []
                }
              ],
              yt_points: [],
              dd_points: [
                { id: 35000001, name: "电度01", alias: "F01.V10.S01.DL01.ZP001", type: 1, type_name: "硬电度", value: 1258.4, status: 0 },
                { id: 35000002, name: "电度02", alias: "F01.V10.S01.DL01.ZP002", type: 2, type_name: "软电度", value: 3482.1, status: 0 }
              ]
            },
            {
              id: 7000003,
              no: -1,
              name: "6YT",
              alias: "F01.V10.S01.DL02",
              cbty: 0,
              cbty_name: "开关",
              cbty_sub: 0,
              state: 1,
              status: 0,
              yc_points: [
                { id: 62000070, name: "yt_feedback_yc", alias: "F01.V10.S01.DL02.YC_FB", type: 0, type_name: "调节反馈遥测", val: 9.0, status: 0, status_name: "正常" }
              ],
              yx_points: [
                { id: 61000001, name: "yx01", alias: "F01.V10.S01.DL02.POS_OPN", type: 1, type_name: "开关位置", value: 1, status: 0, status_name: "正常", q: 0 }
              ],
              yk_points: [],
              yt_points: [
                {
                  id: 54000004,
                  name: "YC5Yt",
                  alias: "F01.V10.S01.DL02.YT01",
                  type: 1,
                  type_name: "有监护遥调",
                  channel: 0,
                  targetVerificationPointId: 62000070 // 关联调节反馈遥测
                }
              ],
              dd_points: []
            }
          ]
        },
        {
          id: 430000002,
          name: "柜子2",
          alias: "F01.V10.L01",
          serial: -1,
          type: 4,
          type_sub: 4,
          cb_devices: [
            {
              id: 7000002,
              no: -1,
              name: "7",
              alias: "F01.V10.L01.DL02",
              cbty: 0,
              cbty_name: "开关",
              cbty_sub: 0,
              state: 0,
              status: 0,
              yc_points: [
                { id: 62000061, name: "7yc001", alias: "F01.V10.L01.DL02.YC010", type: 0, type_name: "普通遥测", val: 221.3, status: 0, status_name: "正常" }
              ],
              yx_points: [
                { id: 61000061, name: "7yx0166", alias: "F01.V10.L01.DL02.YX001", type: 0, type_name: "普通遥信", value: 0, status: 0, status_name: "正常", q: 0 }
              ],
              yk_points: [],
              yt_points: [],
              dd_points: []
            }
          ]
        }
      ]
    }
  ]
};

// Global in-memory point state tables
const liveYcMap = new Map<number, { val: number; status: number }>();
const liveYxMap = new Map<number, { val: number; status: number; q?: number }>();
const liveDdMap = new Map<number, { val: number; status: number }>();

// YK to Verification point mapping (e.g. YK 54000003 -> YX 61000006)
const ykTargetVerificationMap = new Map<number, number>();
// YT to Verification point mapping (e.g. YT 54000004 -> YC 62000070)
const ytTargetVerificationMap = new Map<number, number>();

// Initialize in-memory state
function initScadaStore() {
  DEFAULT_SCADA_TREE_DATA.facilities.forEach((fac: any) => {
    (fac.bays || []).forEach((bay: any) => {
      (bay.cb_devices || []).forEach((dev: any) => {
        (dev.yc_points || []).forEach((yc: any) => {
          liveYcMap.set(yc.id, { val: yc.val ?? 0, status: yc.status ?? 0 });
        });
        (dev.yx_points || []).forEach((yx: any) => {
          liveYxMap.set(yx.id, { val: yx.value ?? 0, status: yx.status ?? 0, q: yx.q ?? 0 });
        });
        (dev.dd_points || []).forEach((dd: any) => {
          liveDdMap.set(dd.id, { val: dd.value ?? 0, status: dd.status ?? 0 });
        });
        (dev.yk_points || []).forEach((yk: any) => {
          if (yk.targetVerificationPointId) {
            ykTargetVerificationMap.set(yk.id, yk.targetVerificationPointId);
          } else {
            // Default to device's first switch position YX
            const pos = dev.yx_points?.find((x: any) => x.alias?.includes('POS') || x.type === 1) || dev.yx_points?.[0];
            if (pos) ykTargetVerificationMap.set(yk.id, pos.id);
          }
        });
        (dev.yt_points || []).forEach((yt: any) => {
          if (yt.targetVerificationPointId) {
            ytTargetVerificationMap.set(yt.id, yt.targetVerificationPointId);
          } else {
            const yc = dev.yc_points?.[0];
            if (yc) ytTargetVerificationMap.set(yt.id, yc.id);
          }
        });
      });
    });
  });
}

initScadaStore();

/**
 * Handle GET /api/scada/config
 */
export function handleGetScadaConfig(pretty: boolean = false): any {
  return DEFAULT_SCADA_TREE_DATA;
}

/**
 * Handle POST /api/scada/realtime
 */
export function handleGetScadaRealtime(reqBody: { yc_ids?: number[]; yx_ids?: number[]; dd_ids?: number[] }): any {
  const yc_ids = reqBody.yc_ids || [];
  const yx_ids = reqBody.yx_ids || [];
  const dd_ids = reqBody.dd_ids || [];

  const ycResult: Array<{ id: number; val: number; status: number }> = [];
  const yxResult: Array<{ id: number; val: number; status: number; q: number }> = [];
  const ddResult: Array<{ id: number; val: number; status: number }> = [];

  for (const id of yc_ids) {
    const item = liveYcMap.get(id);
    if (item) {
      ycResult.push({ id, val: item.val, status: item.status });
    } else {
      ycResult.push({ id, val: 0, status: 0 });
    }
  }

  for (const id of yx_ids) {
    const item = liveYxMap.get(id);
    if (item) {
      yxResult.push({ id, val: item.val, status: item.status, q: item.q ?? 0 });
    } else {
      yxResult.push({ id, val: 0, status: 0, q: 0 });
    }
  }

  for (const id of dd_ids) {
    const item = liveDdMap.get(id);
    if (item) {
      ddResult.push({ id, val: item.val, status: item.status });
    } else {
      ddResult.push({ id, val: 0, status: 0 });
    }
  }

  return {
    code: 200,
    msg: "success",
    data: {
      yc: ycResult,
      yx: yxResult,
      dd: ddResult
    }
  };
}

/**
 * Handle POST /api/scada/control/yk
 * action: 'prev' (预置), 'exec' (执行), 'cancel' (取消), 'direct' (直接执行)
 * state: 'close' (合), 'open' (分), 'tqh' (同期合), 'yyh' (有压合), 'wyh' (无压合), 'hhh' (合环合), 'tsh' (试验合), 'fg' (复归), 'st' (试跳)
 */
export function handlePostScadaYk(payload: { yk_id: number; action: string; state: string }): any {
  const { yk_id, action, state } = payload;
  if (!yk_id || !action || !state) {
    return { code: 400, msg: "Missing required fields: yk_id, action, state" };
  }

  if (action === 'exec' || action === 'direct') {
    // Determine target YX verification point
    const targetYxId = ykTargetVerificationMap.get(yk_id) || 61000006;
    const isClose = ['close', 'tqh', 'yyh', 'wyh', 'hhh', 'tsh'].includes(state);
    const targetValue = isClose ? 1 : 0;
    const targetStatus = isClose ? 7 : 8; // 7: 变位(合), 8: 变位(分)

    // Simulate realistic hardware action delay or instant update
    liveYxMap.set(targetYxId, { val: targetValue, status: targetStatus, q: 0 });

    // Also update any device switch state in memory
    DEFAULT_SCADA_TREE_DATA.facilities.forEach((fac: any) => {
      (fac.bays || []).forEach((bay: any) => {
        (bay.cb_devices || []).forEach((dev: any) => {
          const yk = dev.yk_points?.find((k: any) => k.id === yk_id);
          if (yk) {
            dev.state = targetValue;
            dev.status = targetStatus;
            const yx = dev.yx_points?.find((x: any) => x.id === targetYxId);
            if (yx) {
              yx.value = targetValue;
              yx.status = targetStatus;
              yx.status_name = isClose ? '变位(合)' : '变位(分)';
            }
          }
        });
      });
    });

    // 产生对应的 SCADA 实时告警流水记录
    const timeStr = new Date().toISOString().replace('T', ' ').slice(0, 23);
    const content = `苏州晟高一体柜 6#开关 调度遥控${isClose ? '合闸' : '分闸'} (执行就位)`;
    realtimeWarnList.push({
      seq_id: dynamicSeq++,
      timestamp: Math.floor(Date.now() / 1000),
      time: timeStr,
      content,
      full_text: `提示信息  ${timeStr}  ${content}`,
      level: 1,
      level_name: "提示信息",
      level_color: "#67C23A",
      type: 8,
      type_name: "遥控",
      is_examine: false,
      is_revert: true,
      tabs: ["时序信息", "提示信息", "遥控"],
      fac_id: 4000003,
      fac_name: "苏州晟高",
      bay_id: 430000001,
      bay_name: "苏州晟高一体柜",
      dev_id: 7000001,
      dev_name: "6",
      key_id: targetYxId,
      key_name: isClose ? "合闸位置" : "分闸位置",
      val: targetValue,
      val_desc: isClose ? "合闸/闭合" : "分闸/断开",
      status: targetStatus,
      status_desc: isClose ? "变位(合)" : "变位(分)",
      confirm: 0,
      confirm_desc: "未确认"
    });
  }

  return {
    code: 200,
    msg: "YK command sent successfully"
  };
}

/**
 * Handle POST /api/scada/control/yt
 * action: 'prev' (预置), 'exec' (执行), 'cancel' (取消), 'direct' (直接执行)
 * oper: 'adjust' (设值), 'up' (升档), 'down' (降档), 'stop' (急停)
 * val: number
 * old_val?: number
 */
export function handlePostScadaYt(payload: { yt_id: number; action: string; oper: string; val: number; old_val?: number }): any {
  const { yt_id, action, oper, val, old_val } = payload;
  if (!yt_id || !action || !oper) {
    return { code: 400, msg: "Missing required fields: yt_id, action, oper" };
  }

  if (action === 'exec' || action === 'direct') {
    const targetYcId = ytTargetVerificationMap.get(yt_id) || 62000070;
    const targetVal = Number(val) || 0;
    liveYcMap.set(targetYcId, { val: targetVal, status: 0 });

    DEFAULT_SCADA_TREE_DATA.facilities.forEach((fac: any) => {
      (fac.bays || []).forEach((bay: any) => {
        (bay.cb_devices || []).forEach((dev: any) => {
          const yt = dev.yt_points?.find((t: any) => t.id === yt_id);
          if (yt) {
            const yc = dev.yc_points?.find((c: any) => c.id === targetYcId);
            if (yc) {
              yc.val = targetVal;
              yc.status = 0;
              yc.status_name = '正常';
            }
          }
        });
      });
    });

    // 产生对应的 SCADA 实时人工操作流水记录
    const timeStr = new Date().toISOString().replace('T', ' ').slice(0, 23);
    const content = `苏州晟高一体柜 6YT变压器分接头 遥调设值: ${targetVal}档`;
    realtimeWarnList.push({
      seq_id: dynamicSeq++,
      timestamp: Math.floor(Date.now() / 1000),
      time: timeStr,
      content,
      full_text: `提示信息  ${timeStr}  ${content}`,
      level: 1,
      level_name: "提示信息",
      level_color: "#67C23A",
      type: 9,
      type_name: "人工操作",
      is_examine: false,
      is_revert: true,
      tabs: ["时序信息", "提示信息", "人工操作"],
      fac_id: 4000003,
      fac_name: "苏州晟高",
      bay_id: 430000001,
      bay_name: "苏州晟高一体柜",
      dev_id: 7000003,
      dev_name: "6YT",
      key_id: targetYcId,
      key_name: "分接头档位",
      val: targetVal,
      val_desc: `${targetVal}档`,
      status: 0,
      status_desc: "正常",
      confirm: 0,
      confirm_desc: "未确认"
    });
  }

  return {
    code: 200,
    msg: "YT command sent successfully"
  };
}

/**
 * Handle POST /api/scada/control/unflash
 * 模式一：【画面清闪】 { "yx_ids": [52000001, 52000002] }
 * 模式二：【全部清闪】 { "all": true }
 * 统一响应：{ "code": 200, "msg": "Successfully cleared in shared memory", "cleared_count": n }
 */
export function handlePostScadaUnflash(payload: { yx_ids?: number[]; all?: boolean }): {
  code: number;
  msg: string;
  cleared_count: number;
} {
  let clearedCount = 0;
  const isAll = Boolean(payload?.all);
  const yxIds = Array.isArray(payload?.yx_ids) ? payload.yx_ids.map(Number) : [];

  if (isAll) {
    // 全站全局清闪：扫描所有遥信测点，将处于闪烁状态 (status 7~12) 的测点刷回 0
    liveYxMap.forEach((point) => {
      if (isYxFlashingStatus(point.status)) {
        clearedCount++;
        point.status = 0;
      }
    });

    DEFAULT_SCADA_TREE_DATA.facilities.forEach((fac: any) => {
      (fac.bays || []).forEach((bay: any) => {
        (bay.cb_devices || []).forEach((dev: any) => {
          (dev.yx_points || []).forEach((yx: any) => {
            if (isYxFlashingStatus(yx.status)) {
              yx.status = 0;
              yx.status_name = '正常';
            }
          });
          if (isYxFlashingStatus(dev.status)) {
            dev.status = 0;
          }
        });
      });
    });
  } else if (yxIds.length > 0) {
    // 画面清闪：按传入测点 ID 列表清闪
    const targetIdSet = new Set(yxIds);
    targetIdSet.forEach((id) => {
      const point = liveYxMap.get(id);
      if (point && isYxFlashingStatus(point.status)) {
        clearedCount++;
        point.status = 0;
      }
    });

    DEFAULT_SCADA_TREE_DATA.facilities.forEach((fac: any) => {
      (fac.bays || []).forEach((bay: any) => {
        (bay.cb_devices || []).forEach((dev: any) => {
          (dev.yx_points || []).forEach((yx: any) => {
            if (targetIdSet.has(yx.id) && isYxFlashingStatus(yx.status)) {
              yx.status = 0;
              yx.status_name = '正常';
            }
          });
          const hasTargetPoint = dev.yx_points?.some((x: any) => targetIdSet.has(x.id));
          if (hasTargetPoint && isYxFlashingStatus(dev.status)) {
            const stillFlashing = dev.yx_points?.some((x: any) => isYxFlashingStatus(x.status));
            if (!stillFlashing) {
              dev.status = 0;
            }
          }
        });
      });
    });
  }

  return {
    code: 200,
    msg: "Successfully cleared in shared memory",
    cleared_count: clearedCount
  };
}

// ============================================================================
// SCADA 告警模块 HTTP API 模拟服务 (/api/scada/warn/*)
// ============================================================================

export const SCADA_WARN_CONFIG = {
  levels: [
    { level: 3, name: "事故信息", open_color: "#67C23A", close_color: "#FF0000" },
    { level: 2, name: "告警信息", open_color: "#67C23A", close_color: "#E6A23C" },
    { level: 1, name: "提示信息", open_color: "#67C23A", close_color: "#67C23A" },
    { level: 4, name: "操作记录", open_color: "#00FFFF", close_color: "#00FFFF" }
  ],
  types: [
    { type_id: 1, name: "遥信变位" },
    { type_id: 2, name: "遥测越限" },
    { type_id: 3, name: "厂站工况" },
    { type_id: 4, name: "结点工况" },
    { type_id: 8, name: "遥控" },
    { type_id: 9, name: "人工操作" },
    { type_id: 10, name: "事件SOE" },
    { type_id: 28, name: "保护动作" }
  ]
};

export interface MockRealtimeWarn {
  seq_id: number;
  time: string;
  timestamp: number;
  content: string;
  full_text?: string;
  level: number;
  level_name: string;
  level_color: string;
  type: number;
  type_name: string;
  is_examine?: boolean;
  is_revert?: boolean;
  tabs?: string[];
  fac_id: number;
  fac_name: string;
  bay_id: number;
  bay_name: string;
  dev_id: number;
  dev_name: string;
  key_id: number;
  key_name: string;
  val: number;
  val_desc: string;
  status: number;
  status_desc: string;
  confirm: number;
  confirm_desc: string;
}

export function computeMockAlarmTabs(item: {
  level?: number;
  level_name?: string;
  type?: number;
  type_name?: string;
  is_examine?: boolean;
  is_revert?: boolean;
}): string[] {
  const tabs = ["时序信息"];
  if (item.level_name === "提示信息" || item.level === 1) tabs.push("提示信息");
  if (item.level_name === "告警信息" || item.level === 2) tabs.push("告警信息");
  if (item.level_name === "事故信息" || item.level === 3) tabs.push("事故信息");

  if (item.type_name === "遥信变位" || item.type === 1) tabs.push("遥信变位");
  if (item.type_name === "遥测越限" || item.type === 2) tabs.push("遥测越限");
  if (item.type_name === "厂站工况" || item.type === 3) tabs.push("厂站工况");
  if (item.type_name === "结点工况" || item.type === 4) tabs.push("结点工况");
  if (item.type_name === "遥控" || item.type === 8) tabs.push("遥控");
  if (item.type_name === "人工操作" || item.type === 9) tabs.push("人工操作");

  if (item.is_examine === true) {
    tabs.push("检修信息");
  }
  if (item.is_revert === false && item.is_examine === false) {
    tabs.push("未复归信息");
  }

  return tabs;
}

// 服务端内存环形缓存告警列表 (严格按后台重构规范：单调递增 seq_id，标准色彩与已翻译语义)
let realtimeWarnList: MockRealtimeWarn[] = [
  {
    seq_id: 1045,
    timestamp: Math.floor(Date.now() / 1000) - 180,
    time: new Date(Date.now() - 180000).toISOString().replace('T', ' ').slice(0, 23),
    content: "东郊变电站 1号主控机 厂站工况 双机热备主备切换",
    full_text: "提示信息  " + new Date(Date.now() - 180000).toISOString().replace('T', ' ').slice(0, 23) + "  东郊变电站 1号主控机 厂站工况 双机热备主备切换",
    level: 1,
    level_name: "提示信息",
    level_color: "#67C23A",
    type: 3,
    type_name: "厂站工况",
    is_examine: false,
    is_revert: true,
    tabs: ["时序信息", "提示信息", "厂站工况"],
    fac_id: 400010,
    fac_name: "东郊变",
    bay_id: 430001001,
    bay_name: "站控层网络",
    dev_id: 51000099,
    dev_name: "监控主机A",
    key_id: 52000090,
    key_name: "双机热备状态",
    val: 1,
    val_desc: "主机正常",
    status: 0,
    status_desc: "正常",
    confirm: 1,
    confirm_desc: "已确认"
  },
  {
    seq_id: 1046,
    timestamp: Math.floor(Date.now() / 1000) - 150,
    time: new Date(Date.now() - 150000).toISOString().replace('T', ' ').slice(0, 23),
    content: "35kV配电室 远动通信网关 结点工况 GPS/北斗对时时钟锁定",
    full_text: "提示信息  " + new Date(Date.now() - 150000).toISOString().replace('T', ' ').slice(0, 23) + "  35kV配电室 远动通信网关 结点工况 GPS/北斗对时时钟锁定",
    level: 1,
    level_name: "提示信息",
    level_color: "#67C23A",
    type: 4,
    type_name: "结点工况",
    is_examine: false,
    is_revert: true,
    tabs: ["时序信息", "提示信息", "结点工况"],
    fac_id: 4000003,
    fac_name: "速利达光伏",
    bay_id: 430000001,
    bay_name: "35kV配电室",
    dev_id: 7000009,
    dev_name: "通信网关",
    key_id: 61000090,
    key_name: "北斗对时状态",
    val: 1,
    val_desc: "同步锁定",
    status: 0,
    status_desc: "正常",
    confirm: 1,
    confirm_desc: "已确认"
  },
  {
    seq_id: 1047,
    timestamp: Math.floor(Date.now() / 1000) - 130,
    time: new Date(Date.now() - 130000).toISOString().replace('T', ' ').slice(0, 23),
    content: "苏州晟高 6#开关 调度遥控合闸 执行成功",
    full_text: "提示信息  " + new Date(Date.now() - 130000).toISOString().replace('T', ' ').slice(0, 23) + "  苏州晟高 6#开关 调度遥控合闸 执行成功",
    level: 1,
    level_name: "提示信息",
    level_color: "#67C23A",
    type: 8,
    type_name: "遥控",
    is_examine: false,
    is_revert: true,
    tabs: ["时序信息", "提示信息", "遥控"],
    fac_id: 4000003,
    fac_name: "苏州晟高",
    bay_id: 430000001,
    bay_name: "苏州晟高一体柜",
    dev_id: 7000001,
    dev_name: "6#断路器",
    key_id: 54000003,
    key_name: "6遥控666",
    val: 1,
    val_desc: "遥控执行合闸",
    status: 0,
    status_desc: "执行成功",
    confirm: 1,
    confirm_desc: "已确认"
  },
  {
    seq_id: 1048,
    timestamp: Math.floor(Date.now() / 1000) - 120,
    time: new Date(Date.now() - 120000).toISOString().replace('T', ' ').slice(0, 23),
    content: "220kV 东郊变 1号主变高侧A相电流 遥测越限 (当前: 1250.5A, 上限: 1200.0A)",
    full_text: "告警信息  " + new Date(Date.now() - 120000).toISOString().replace('T', ' ').slice(0, 23) + "  220kV 东郊变 1号主变高侧A相电流 遥测越限 (当前: 1250.5A, 上限: 1200.0A)",
    level: 2,
    level_name: "告警信息",
    level_color: "#E6A23C",
    type: 2,
    type_name: "遥测越限",
    is_examine: false,
    is_revert: false,
    tabs: ["时序信息", "告警信息", "遥测越限", "未复归信息"],
    fac_id: 400010,
    fac_name: "东郊变",
    bay_id: 430001001,
    bay_name: "1号主变间隔",
    dev_id: 51000001,
    dev_name: "1号主变",
    key_id: 51000003,
    key_name: "高侧A相电流",
    val: 1250.5,
    val_desc: "越上限",
    status: 8,
    status_desc: "越上限",
    confirm: 0,
    confirm_desc: "未确认"
  },
  {
    seq_id: 1049,
    timestamp: Math.floor(Date.now() / 1000) - 90,
    time: new Date(Date.now() - 90000).toISOString().replace('T', ' ').slice(0, 23),
    content: "35kV 高压光伏站 311开关 变位(合) -> 变位(分)",
    full_text: "提示信息  " + new Date(Date.now() - 90000).toISOString().replace('T', ' ').slice(0, 23) + "  35kV 高压光伏站 311开关 变位(合) -> 变位(分)",
    level: 1,
    level_name: "提示信息",
    level_color: "#67C23A",
    type: 1,
    type_name: "遥信变位",
    is_examine: false,
    is_revert: true,
    tabs: ["时序信息", "提示信息", "遥信变位"],
    fac_id: 4000003,
    fac_name: "苏州晟高",
    bay_id: 430000001,
    bay_name: "苏州晟高一体柜",
    dev_id: 7000001,
    dev_name: "311断路器",
    key_id: 61000006,
    key_name: "311开关位置",
    val: 0,
    val_desc: "分闸/断开",
    status: 8,
    status_desc: "变位(分)",
    confirm: 0,
    confirm_desc: "未确认"
  },
  {
    seq_id: 1050,
    timestamp: Math.floor(Date.now() / 1000) - 60,
    time: new Date(Date.now() - 60000).toISOString().replace('T', ' ').slice(0, 23),
    content: "220kV 东郊变 2211开关 事故跳闸",
    full_text: "事故信息  " + new Date(Date.now() - 60000).toISOString().replace('T', ' ').slice(0, 23) + "  220kV 东郊变 2211开关 事故跳闸",
    level: 3,
    level_name: "事故信息",
    level_color: "#FF0000",
    type: 1,
    type_name: "遥信变位",
    is_examine: false,
    is_revert: false,
    tabs: ["时序信息", "事故信息", "遥信变位", "未复归信息"],
    fac_id: 400010,
    fac_name: "东郊变",
    bay_id: 430001080,
    bay_name: "220kV出线间隔",
    dev_id: 51000001,
    dev_name: "2211断路器",
    key_id: 52000001,
    key_name: "2211开关位置",
    val: 0,
    val_desc: "分闸/断开",
    status: 10,
    status_desc: "事故跳闸(分)",
    confirm: 0,
    confirm_desc: "未确认"
  },
  {
    seq_id: 1051,
    timestamp: Math.floor(Date.now() / 1000) - 30,
    time: new Date(Date.now() - 30000).toISOString().replace('T', ' ').slice(0, 23),
    content: "220kV 东郊变 1号主变保护装置 人工操作 检修挂牌投入",
    full_text: "提示信息  " + new Date(Date.now() - 30000).toISOString().replace('T', ' ').slice(0, 23) + "  220kV 东郊变 1号主变保护装置 人工操作 检修挂牌投入",
    level: 1,
    level_name: "提示信息",
    level_color: "#67C23A",
    type: 9,
    type_name: "人工操作",
    is_examine: true,
    is_revert: false,
    tabs: ["时序信息", "提示信息", "人工操作", "检修信息"],
    fac_id: 400010,
    fac_name: "东郊变",
    bay_id: 430001001,
    bay_name: "1号主变间隔",
    dev_id: 51000002,
    dev_name: "主变保护测控",
    key_id: 52000008,
    key_name: "检修压板",
    val: 1,
    val_desc: "投入",
    status: 0,
    status_desc: "检修态",
    confirm: 0,
    confirm_desc: "未确认"
  },
  {
    seq_id: 1052,
    timestamp: Math.floor(Date.now() / 1000) - 10,
    time: new Date(Date.now() - 10000).toISOString().replace('T', ' ').slice(0, 23),
    content: "速利达光伏电站 35kV 101断路器 零序过流I段动作 事故跳闸",
    full_text: "事故信息  " + new Date(Date.now() - 10000).toISOString().replace('T', ' ').slice(0, 23) + "  速利达光伏电站 35kV 101断路器 零序过流I段动作 事故跳闸",
    level: 3,
    level_name: "事故信息",
    level_color: "#FF0000",
    type: 1,
    type_name: "遥信变位",
    is_examine: false,
    is_revert: false,
    tabs: ["时序信息", "事故信息", "遥信变位", "未复归信息"],
    fac_id: 4000003,
    fac_name: "速利达光伏",
    bay_id: 430000001,
    bay_name: "35kV配电室",
    dev_id: 7000001,
    dev_name: "101断路器",
    key_id: 61000006,
    key_name: "101开关位置",
    val: 0,
    val_desc: "分闸/断开",
    status: 10,
    status_desc: "事故跳闸(分)",
    confirm: 0,
    confirm_desc: "未确认"
  }
];

// 历史告警模拟数据池
const mockHistoryWarnPool = [
  {
    time: "2026-10-23 15:30:12.456",
    timestamp: 1792740612,
    msec: 456,
    table_no: 44,
    table_name: "遥测越限",
    content: "220kV 东郊变 1号主变高侧A相电流 越限值: 1250.50 (定值: 1200.00)",
    alias: "DJB_1HB_Ia",
    fac_id: 10001,
    bay_id: 20001,
    dev_id: 30001,
    key_id: 51000003,
    status: 8,
    val: 1250.5,
    host: "SCADA-SVR-01",
    operator: ""
  },
  {
    time: "2026-10-23 14:20:00.000",
    timestamp: 1792736400,
    msec: 0,
    table_no: 43,
    table_name: "遥信变位",
    content: "220kV 东郊变 2211开关 变位: 分闸 -> 合闸",
    alias: "DJB_2211_QF",
    fac_id: 10001,
    bay_id: 20002,
    dev_id: 30003,
    key_id: 52000001,
    status: 7,
    val: 1,
    host: "SCADA-SVR-01",
    operator: "dispatcher_zhang"
  },
  {
    time: "2026-10-23 12:15:33.200",
    timestamp: 1792728933,
    msec: 200,
    table_no: 362,
    table_name: "保护动作",
    content: "220kV 东郊变 1号主变保护 过流保护II段动作 跳闸",
    alias: "DJB_1HB_BH_GL",
    fac_id: 10001,
    bay_id: 20001,
    dev_id: 30001,
    key_id: 52000005,
    status: 9,
    val: 1,
    host: "SCADA-SVR-02",
    operator: ""
  },
  {
    time: "2026-10-23 11:05:08.012",
    timestamp: 1792724708,
    msec: 12,
    table_no: 55,
    table_name: "事件 SOE",
    content: "速利达光伏电站 35kV 101断路器 零序过流I段动作 事故跳闸 (时标精度 1ms)",
    alias: "SLD_101_SOE",
    fac_id: 4000003,
    bay_id: 430000001,
    dev_id: 7000001,
    key_id: 61000006,
    status: 11,
    val: 0,
    host: "SCADA-SVR-01",
    operator: ""
  },
  {
    time: "2026-10-23 09:30:45.000",
    timestamp: 1792719045,
    msec: 0,
    table_no: 50,
    table_name: "人工遥控",
    content: "苏州晟高一体柜 6#开关 调度人工遥控合闸 (执行就位)",
    alias: "F01.V10.S01.DL01.YK01",
    fac_id: 4000003,
    bay_id: 430000001,
    dev_id: 7000001,
    key_id: 54000003,
    status: 0,
    val: 1,
    host: "OPERATOR-HMI-01",
    operator: "admin"
  },
  {
    time: "2026-10-23 08:15:10.500",
    timestamp: 1792714510,
    msec: 500,
    table_no: 51,
    table_name: "人工遥调",
    content: "苏州晟高一体柜 6YT变压器分接头 遥调设值: 9.0 档 (原值: 8.0 档)",
    alias: "F01.V10.S01.DL02.YT01",
    fac_id: 4000003,
    bay_id: 430000001,
    dev_id: 7000003,
    key_id: 54000004,
    status: 0,
    val: 9.0,
    host: "OPERATOR-HMI-01",
    operator: "admin"
  }
];

/**
 * 1. GET /api/scada/warn/config
 */
export function handleGetScadaWarnConfig() {
  return {
    code: 200,
    msg: "success",
    data: SCADA_WARN_CONFIG
  };
}

let dynamicSeq = 1053;

// 工业级 1Hz 实时告警发生器模板集 (覆盖 12 大 Tab 与不同专业大类)
const SIMULATED_ALARM_TEMPLATES = [
  {
    fac_id: 4000003,
    fac_name: "速利达光伏",
    bay_id: 430000001,
    bay_name: "35kV配电室",
    dev_id: 7000001,
    dev_name: "101断路器",
    key_id: 61000006,
    key_name: "101开关位置",
    level: 2,
    level_name: "告警信息",
    level_color: "#E6A23C",
    type: 1,
    type_name: "遥信变位",
    val: 0,
    val_desc: "分闸/断开",
    status: 8,
    status_desc: "变位(分)",
    content: "速利达光伏电站 35kV 101开关 变位(合) -> 变位(分)",
    is_examine: false,
    is_revert: true
  },
  {
    fac_id: 400010,
    fac_name: "东郊变",
    bay_id: 430001001,
    bay_name: "1号主变间隔",
    dev_id: 51000001,
    dev_name: "1号主变",
    key_id: 51000003,
    key_name: "高侧A相电流",
    level: 2,
    level_name: "告警信息",
    level_color: "#E6A23C",
    type: 2,
    type_name: "遥测越限",
    val: 1228.4,
    val_desc: "越上限",
    status: 8,
    status_desc: "越上限",
    content: "220kV 东郊变 1号主变高侧A相电流 遥测越限 (当前: 1228.4A, 上限: 1200.0A)",
    is_examine: false,
    is_revert: false
  },
  {
    fac_id: 4000003,
    fac_name: "苏州晟高",
    bay_id: 430000001,
    bay_name: "苏州晟高一体柜",
    dev_id: 7000001,
    dev_name: "6#断路器",
    key_id: 54000003,
    key_name: "6遥控666",
    level: 1,
    level_name: "提示信息",
    level_color: "#67C23A",
    type: 8,
    type_name: "遥控",
    val: 1,
    val_desc: "遥控执行合闸",
    status: 0,
    status_desc: "执行成功",
    content: "苏州晟高 6#开关 调度遥控合闸 执行成功",
    is_examine: false,
    is_revert: true
  },
  {
    fac_id: 4000003,
    fac_name: "苏州晟高",
    bay_id: 430000001,
    bay_name: "3-PCS间隔",
    dev_id: 7000005,
    dev_name: "1号电池组",
    key_id: 61000022,
    key_name: "绝缘故障",
    level: 2,
    level_name: "告警信息",
    level_color: "#E6A23C",
    type: 1,
    type_name: "遥信变位",
    val: 0,
    val_desc: "分闸/断开",
    status: 8,
    status_desc: "复归",
    content: "3-PCS-支路1电池组绝缘故障 复归",
    is_examine: false,
    is_revert: true
  },
  {
    fac_id: 400010,
    fac_name: "东郊变",
    bay_id: 430001080,
    bay_name: "220kV出线间隔",
    dev_id: 51000001,
    dev_name: "2211断路器",
    key_id: 52000001,
    key_name: "2211开关位置",
    level: 3,
    level_name: "事故信息",
    level_color: "#FF0000",
    type: 1,
    type_name: "遥信变位",
    val: 0,
    val_desc: "分闸/断开",
    status: 10,
    status_desc: "事故跳闸(分)",
    content: "220kV 东郊变 2211断路器 零序保护加速动作 事故跳闸",
    is_examine: false,
    is_revert: false
  },
  {
    fac_id: 400010,
    fac_name: "东郊变",
    bay_id: 430001001,
    bay_name: "站控层网络",
    dev_id: 51000099,
    dev_name: "监控主机A",
    key_id: 52000090,
    key_name: "双机热备状态",
    level: 1,
    level_name: "提示信息",
    level_color: "#67C23A",
    type: 3,
    type_name: "厂站工况",
    val: 1,
    val_desc: "主机正常",
    status: 0,
    status_desc: "正常",
    content: "东郊变电站 1号主控机 厂站工况 双机热备心跳正常",
    is_examine: false,
    is_revert: true
  },
  {
    fac_id: 4000003,
    fac_name: "速利达光伏",
    bay_id: 430000001,
    bay_name: "35kV配电室",
    dev_id: 7000009,
    dev_name: "远动通信网关",
    key_id: 61000090,
    key_name: "北斗对时状态",
    level: 1,
    level_name: "提示信息",
    level_color: "#67C23A",
    type: 4,
    type_name: "结点工况",
    val: 1,
    val_desc: "同步锁定",
    status: 0,
    status_desc: "正常",
    content: "35kV配电室 远动通信网关 结点工况 GPS/北斗对时时钟对齐",
    is_examine: false,
    is_revert: true
  },
  {
    fac_id: 4000003,
    fac_name: "苏州晟高",
    bay_id: 430000001,
    bay_name: "储能舱A",
    dev_id: 7000012,
    dev_name: "BESS储能模组",
    key_id: 62000033,
    key_name: "电池堆最高温度",
    level: 2,
    level_name: "告警信息",
    level_color: "#E6A23C",
    type: 2,
    type_name: "遥测越限",
    val: 42.6,
    val_desc: "越上限",
    status: 8,
    status_desc: "越上限",
    content: "苏州晟高 储能舱A BESS模组 电池堆最高温度越限 (当前: 42.6℃, 限值: 40.0℃)",
    is_examine: false,
    is_revert: false
  },
  {
    fac_id: 4000003,
    fac_name: "苏州晟高",
    bay_id: 430000001,
    bay_name: "苏州晟高一体柜",
    dev_id: 7000003,
    dev_name: "6YT变压器",
    key_id: 54000004,
    key_name: "YC5Yt",
    level: 1,
    level_name: "提示信息",
    level_color: "#67C23A",
    type: 9,
    type_name: "人工操作",
    val: 9.0,
    val_desc: "调节设值",
    status: 0,
    status_desc: "执行就位",
    content: "苏州晟高一体柜 6YT变压器分接头 遥调设值: 9.0档",
    is_examine: false,
    is_revert: true
  },
  {
    fac_id: 400010,
    fac_name: "东郊变",
    bay_id: 430001001,
    bay_name: "1号主变间隔",
    dev_id: 51000002,
    dev_name: "主变保护测控",
    key_id: 52000008,
    key_name: "检修压板",
    level: 1,
    level_name: "提示信息",
    level_color: "#67C23A",
    type: 9,
    type_name: "人工操作",
    val: 1,
    val_desc: "投入",
    status: 0,
    status_desc: "检修态",
    content: "220kV 东郊变 1号主变保护装置 人工操作 检修挂牌维持",
    is_examine: true,
    is_revert: false
  }
];

let templateIndex = 0;
export function generateOneMockAlarm(): MockRealtimeWarn {
  const t = SIMULATED_ALARM_TEMPLATES[templateIndex % SIMULATED_ALARM_TEMPLATES.length];
  templateIndex++;

  const now = new Date();
  const timeStr = now.toISOString().replace('T', ' ').slice(0, 23);
  const seq = dynamicSeq++;

  const item: MockRealtimeWarn = {
    seq_id: seq,
    timestamp: Math.floor(now.getTime() / 1000),
    time: timeStr,
    content: t.content,
    full_text: `${t.level_name}  ${timeStr}  ${t.content}`,
    level: t.level,
    level_name: t.level_name,
    level_color: t.level_color,
    type: t.type,
    type_name: t.type_name,
    is_examine: t.is_examine,
    is_revert: t.is_revert,
    tabs: computeMockAlarmTabs(t),
    fac_id: t.fac_id,
    fac_name: t.fac_name,
    bay_id: t.bay_id,
    bay_name: t.bay_name,
    dev_id: t.dev_id,
    dev_name: t.dev_name,
    key_id: t.key_id,
    key_name: t.key_name,
    val: t.val,
    val_desc: t.val_desc,
    status: t.status,
    status_desc: t.status_desc,
    confirm: 0,
    confirm_desc: "未确认"
  };

  realtimeWarnList.push(item);
  if (realtimeWarnList.length > 5000) {
    realtimeWarnList.splice(0, realtimeWarnList.length - 5000);
  }
  return item;
}

// 自动启动 1 秒 1 次模拟实时告警发生器 (无论前端是否暂停，后台真实流水持续生成)
let alarmTimer: any = null;

export function startMockAlarmGenerator() {
  if (alarmTimer) return;
  if (typeof setInterval !== 'undefined') {
    alarmTimer = setInterval(() => {
      try {
        generateOneMockAlarm();
      } catch {}
    }, 1000);
    // 关键优化：调用 unref() 确保定时器不会阻碍 Node.js 进程退出，彻底根除 vite build 卡死问题
    if (alarmTimer && typeof alarmTimer.unref === 'function') {
      alarmTimer.unref();
    }
  }
}

export function stopMockAlarmGenerator() {
  if (alarmTimer) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }
}

/**
 * 2. GET /api/scada/warn/realtime (后端改动：不带游标时默认倒序获取系统最新N条告警，按时间正序排好返回；带游标时增量拉取)
 */
export function handleGetScadaWarnRealtime(query: { limit?: any; after_seq?: any }) {
  startMockAlarmGenerator();
  const limit = Math.min(Math.max(1, Number(query.limit) || 100), 500);
  const afterSeq = Number(query.after_seq) || 0;

  let result: MockRealtimeWarn[] = [];
  if (afterSeq === 0) {
    // 不带游标 (或 after_seq === 0)：默认获取系统最新产生的 limit 条告警，按时间正序排好返回
    result = realtimeWarnList.slice(-limit);
  } else {
    // 增量游标：由于 realtimeWarnList 严格按 seq_id 递增，从末尾快速向前定位最新切片，复杂度从 O(N) 降为 O(1)
    const totalLen = realtimeWarnList.length;
    let startIndex = totalLen;
    while (startIndex > 0 && realtimeWarnList[startIndex - 1].seq_id > afterSeq) {
      startIndex--;
    }
    result = realtimeWarnList.slice(startIndex, startIndex + limit);
  }

  return {
    code: 200,
    msg: "success",
    total: result.length,
    data: result
  };
}

/**
 * 3. POST /api/scada/warn/ack
 */
export function handlePostScadaWarnAck(payload: { seq_id?: any; seq_ids?: any; operator?: string }) {
  const operator = payload.operator || "web_user";
  let targetSeqIds: number[] = [];

  if (Array.isArray(payload.seq_ids)) {
    targetSeqIds = payload.seq_ids.map(Number).filter(n => !isNaN(n));
  } else if (payload.seq_id !== undefined) {
    const id = Number(payload.seq_id);
    if (!isNaN(id)) targetSeqIds = [id];
  }

  let clearedCount = 0;
  const targetSet = new Set(targetSeqIds);

  realtimeWarnList.forEach(item => {
    if (targetSet.has(item.seq_id)) {
      if (item.confirm === 0) {
        clearedCount++;
      }
      item.confirm = 1;
      item.confirm_desc = "已确认";
      // 模拟底层对位复归 (DNET_YX_UNFLASH)
      if (item.key_id && liveYxMap.has(item.key_id)) {
        const pt = liveYxMap.get(item.key_id);
        if (pt && isYxFlashingStatus(pt.status)) {
          pt.status = 0;
        }
      }
    }
  });

  return {
    code: 200,
    msg: "Batch acknowledged",
    cleared_count: clearedCount,
    operator
  };
}

/**
 * 4. POST /api/scada/warn/ack_all
 */
export function handlePostScadaWarnAckAll(payload: { operator?: string }) {
  const operator = payload.operator || "web_user";
  let clearedCount = 0;

  realtimeWarnList.forEach(item => {
    if (item.confirm === 0) {
      clearedCount++;
      item.confirm = 1;
      item.confirm_desc = "已确认";
    }
    if (item.key_id && liveYxMap.has(item.key_id)) {
      const pt = liveYxMap.get(item.key_id);
      if (pt && isYxFlashingStatus(pt.status)) {
        pt.status = 0;
      }
    }
  });

  return {
    code: 200,
    msg: "All acknowledged",
    cleared_count: clearedCount,
    operator
  };
}

/**
 * 5. POST /api/scada/warn/clear
 */
export function handlePostScadaWarnClear() {
  realtimeWarnList = [];
  return {
    code: 200,
    msg: "Cache cleared"
  };
}

/**
 * 6. POST /api/scada/warn/history
 */
export function handlePostScadaWarnHistory(body: any) {
  const startTime = Number(body?.start_time) || 0;
  const endTime = Number(body?.end_time) || Math.floor(Date.now() / 1000);
  const keyword = String(body?.keyword || "").trim().toLowerCase();
  const limit = Math.min(Math.max(1, Number(body?.limit) || 500), 1000);

  let results = [...mockHistoryWarnPool];

  // 若内存实时告警中有已确认的项目，也归入检索候选
  realtimeWarnList.forEach(item => {
    const isPresent = results.some(r => r.key_id === item.key_id && r.timestamp === item.timestamp);
    if (!isPresent) {
      results.push({
        time: item.time,
        timestamp: item.timestamp,
        msec: 0,
        table_no: item.type === 1 ? 43 : (item.type === 2 ? 44 : (item.type === 28 ? 362 : 55)),
        table_name: item.type === 1 ? "遥信变位" : (item.type === 2 ? "遥测越限" : (item.type === 28 ? "保护动作" : "事件 SOE")),
        content: item.content,
        alias: `DEV_${item.dev_id}_PT_${item.key_id}`,
        fac_id: item.fac_id,
        bay_id: item.bay_id,
        dev_id: item.dev_id,
        key_id: item.key_id,
        status: item.val === 1 ? 7 : 8,
        val: item.val,
        host: "SCADA-SVR-01",
        operator: item.confirm === 1 ? "dispatcher_zhang" : ""
      });
    }
  });

  if (startTime > 0) {
    results = results.filter(r => r.timestamp >= startTime);
  }
  if (endTime > 0) {
    results = results.filter(r => r.timestamp <= endTime);
  }
  if (keyword) {
    results = results.filter(r =>
      r.content.toLowerCase().includes(keyword) ||
      (r.alias && r.alias.toLowerCase().includes(keyword)) ||
      r.table_name.toLowerCase().includes(keyword)
    );
  }

  // 排序：时间倒序
  results.sort((a, b) => b.timestamp - a.timestamp);

  const paged = results.slice(0, limit);
  return {
    code: 200,
    msg: "success",
    total: results.length,
    data: paged
  };
}

/**
 * 7. GET /api/scada/warn/report
 */
export function handleGetScadaWarnReport(query: { key_id?: any; timestamp?: any }) {
  const keyId = Number(query.key_id) || 52000001;
  const timestamp = Number(query.timestamp) || Math.floor(Date.now() / 1000);

  // 根据测点与时间输出综合诊断报告
  return {
    code: 200,
    msg: "success",
    data: {
      fac_name: keyId === 61000006 ? "速利达光伏电站" : "220kV 东郊变电站",
      bay_name: keyId === 61000006 ? "35kV开关室 101间隔" : "2211 出线间隔",
      fault_type: "断路器动作 / 保护联动跳闸时序分析报告",
      detail: `系统监测到测点 [KEY_${keyId}] 发生开关跳闸或保护变位，经过时序与拓扑关系综合比对，微机保护装置动作正常，关联开关可靠分断短路电流。处理建议：检查保护装置定值、CT二次接线及一次开关本体绝缘情况。`,
      related_events: [
        `2026-10-23 21:50:00.000 220kV 东郊变 2211开关 事故跳闸`,
        `2026-10-23 21:50:00.040 220kV 东郊变 距离保护I段 动作就位`,
        `2026-10-23 21:50:00.085 220kV 东郊变 零序过流保护 加速动作`,
        `2026-10-23 21:50:01.200 220kV 东郊变 自动重合闸 动作未成功 (闭锁)`
      ]
    }
  };
}


