/**
 * SCADA 系统 HTTP 开放接口模拟与数据服务
 * 严格遵照 SCADA 接口文档规范：
 * 1. GET /api/scada/config
 * 2. POST /api/scada/realtime
 * 3. POST /api/scada/control/yk
 * 4. POST /api/scada/control/yt
 */

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
                { id: 62000004, name: "yc04", alias: "F01.V10.S01.DL01.YC004", type: 0, type_name: "普通遥测", val: 120000, status: 0, status_name: "正常" },
                { id: 62000005, name: "yc05", alias: "F01.V10.S01.DL01.YC005", type: 0, type_name: "普通遥测", val: 6.6, status: 0, status_name: "正常" },
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
  }

  return {
    code: 200,
    msg: "YT command sent successfully"
  };
}
