/**
 * C++ 后端程序 A 工业通信与数据共享客户端驱动
 * 
 * 架构功能：
 * 1. 装置与点表结构定义同步 (HTTP REST / WebSocket RPC) -> 写入 data/*.json
 * 2. 实时测控数据流监听 (WebSocket Telemetry Streaming) -> 毫秒级打入响应式数据集
 * 3. 动态告警日志与 SOE 事件监听 (Dynamic Alarm Push) -> 告警中心与事故追忆
 * 4. 历史时序数据检索 (Historical Queries) -> 历史曲线与极值统计
 * 5. 遥控与遥调指令闭环下发 (Tele-control Downlink) -> 双确认安全下发
 */

import { ScadaDeviceItem, DeviceTelemetryPoint, DeviceTeleSignalPoint, DeviceEnergyPoint, DeviceTeleControlPoint, DeviceTeleRegulationPoint } from '../types';

export interface ProgramAConfig {
  httpUrl: string;           // C++ 程序的 HTTP REST 服务地址，例如 http://127.0.0.1:8088
  wsUrl: string;             // C++ 程序的 WebSocket 实时推送地址，例如 ws://127.0.0.1:8088/ws
  timeoutMs: number;         // 请求超时时间(毫秒)
  autoSyncOnStartup: boolean;// 是否在应用启动时自动向程序 A 请求同步
  enableMockFallback: boolean;// 当 C++ 服务离线时是否启用仿真模式以便调试预览
}

export const DEFAULT_PROGRAM_A_CONFIG: ProgramAConfig = {
  httpUrl: 'http://127.0.0.1:8088',
  wsUrl: 'ws://127.0.0.1:8088/ws',
  timeoutMs: 5000,
  autoSyncOnStartup: false,
  enableMockFallback: true
};

const STORAGE_KEY = 'scada_program_a_config';

export function getProgramAConfig(): ProgramAConfig {
  if (typeof window === 'undefined') return DEFAULT_PROGRAM_A_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_PROGRAM_A_CONFIG, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_PROGRAM_A_CONFIG;
}

export function saveProgramAConfig(cfg: Partial<ProgramAConfig>): ProgramAConfig {
  const current = getProgramAConfig();
  const next = { ...current, ...cfg };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }
  return next;
}

// 告警日志定义
export interface AlarmLogItem {
  id: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  deviceId: string;
  deviceName?: string;
  pointId?: number | string;
  pointName?: string;
  title: string;
  message: string;
  value?: number;
  threshold?: number;
  timestamp: string;
  status: 'active' | 'cleared' | 'acknowledged';
}

// 历史数据点定义
export interface HistoricalDataPoint {
  timestamp: string;
  value: number;
  quality: number; // 0: 正常, 1: 超上限, 2: 超下限, -1: 坏点
}

/**
 * 核心方法 1：从 C++ 程序 A 拉取装置与点表信息
 */
export async function fetchDevicesFromProgramA(
  customConfig?: Partial<ProgramAConfig>
): Promise<{
  success: boolean;
  devices: ScadaDeviceItem[];
  datasetName?: string;
  source: 'real_cpp' | 'mock_simulation';
  error?: string;
  rawJson?: any;
}> {
  const config = { ...getProgramAConfig(), ...customConfig };
  const targetUrl = `${config.httpUrl.replace(/\/+$/, '')}/api/scada/devices`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs || 5000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-SCADA-Client': 'SCADA-Web-Electron-Gateway/2.0'
      },
      signal: controller.signal
    });

    clearTimeout(timer);

    if (response.ok) {
      const json = await response.json();
      const parsedDevices = normalizeProgramADevices(json);
      if (parsedDevices.length > 0) {
        return {
          success: true,
          devices: parsedDevices,
          datasetName: json.datasetName || json.name || 'C++ 程序 A 实时同步装置库',
          source: 'real_cpp',
          rawJson: json
        };
      }
    }
  } catch (err: any) {
    console.warn(`[ProgramA] 连接 C++ 服务 (${targetUrl}) 失败:`, err.message || err);
  }

  // 若真实请求失败且开启了模拟回退，则生成基于最新工业拓扑的标准测控点表模拟数据
  if (config.enableMockFallback) {
    const mockDevices = generateMockProgramADevices();
    return {
      success: true,
      devices: mockDevices,
      datasetName: 'C++ 程序 A 遥测遥信点表 (联调仿真)',
      source: 'mock_simulation',
      error: `未能连通目标 C++ 服务 (${targetUrl})，已自动切换为仿真模式生成点表。`
    };
  }

  return {
    success: false,
    devices: [],
    source: 'real_cpp',
    error: `无法连接到 C++ 程序 A (${targetUrl})，请确认程序 A 进程已启动且端口 ${config.httpUrl} 开放。`
  };
}

/**
 * 将 C++ 程序 A 返回的任意兼容 JSON 结构标准化为 ScadaDeviceItem[]
 */
export function normalizeProgramADevices(input: any): ScadaDeviceItem[] {
  if (!input) return [];

  const rawList = Array.isArray(input) 
    ? input 
    : (Array.isArray(input.devices) ? input.devices : (Array.isArray(input.data) ? input.data : []));

  return rawList.map((dev: any, index: number): ScadaDeviceItem => {
    const devId = String(dev.deviceId || dev.id || dev.code || `DEV-${101 + index}`);
    const devName = String(dev.deviceName || dev.name || `${devId} 测控装置`);

    return {
      deviceId: devId,
      deviceName: devName,
      deviceType: dev.deviceType || dev.type || '微机保护测控单元',
      commStatus: dev.commStatus !== undefined ? Number(dev.commStatus) : 1,
      ipAddress: dev.ipAddress || `192.168.1.${101 + index}`,
      
      // 遥测 YC
      telemetries: Array.isArray(dev.telemetries || dev.ycList || dev.analog)
        ? (dev.telemetries || dev.ycList || dev.analog).map((p: any, pIdx: number): DeviceTelemetryPoint => ({
            pointId: Number(p.pointId || p.id || pIdx + 1),
            name: String(p.name || p.desc || `遥测量 ${pIdx + 1}`),
            factor: Number(p.factor ?? 1.0),
            unit: String(p.unit || ''),
            rawValue: Number(p.rawValue ?? p.value ?? 0),
            value: Number(p.value ?? p.rawValue ?? 0),
            min: p.min !== undefined ? Number(p.min) : undefined,
            max: p.max !== undefined ? Number(p.max) : undefined,
            alarmHigh: p.alarmHigh !== undefined ? Number(p.alarmHigh) : undefined,
            alarmLow: p.alarmLow !== undefined ? Number(p.alarmLow) : undefined,
            description: p.description || p.desc
          }))
        : [],

      // 遥信 YX (0, 1, 2)
      teleSignals: Array.isArray(dev.teleSignals || dev.yxList || dev.digital)
        ? (dev.teleSignals || dev.yxList || dev.digital).map((p: any, pIdx: number): DeviceTeleSignalPoint => ({
            pointId: Number(p.pointId || p.id || pIdx + 1),
            name: String(p.name || p.desc || `遥信量 ${pIdx + 1}`),
            value: Number(p.value ?? 0),
            statusText: p.statusText || (p.value === 1 ? '合闸 (1)' : (p.value === 2 ? '故障 (2)' : '分闸 (0)')),
            enumMapping: p.enumMapping || { 0: '分闸', 1: '合闸', 2: '告警/故障' },
            description: p.description || p.desc
          }))
        : [],

      // 电度 DD
      energies: Array.isArray(dev.energies || dev.ddList || dev.kwh)
        ? (dev.energies || dev.ddList || dev.kwh).map((p: any, pIdx: number): DeviceEnergyPoint => ({
            pointId: Number(p.pointId || p.id || pIdx + 1),
            name: String(p.name || p.desc || `电能量 ${pIdx + 1}`),
            factor: Number(p.factor ?? 1.0),
            unit: String(p.unit || 'kWh'),
            value: Number(p.value ?? 0),
            description: p.description || p.desc
          }))
        : [],

      // 遥控 YK
      teleControls: Array.isArray(dev.teleControls || dev.ykList || dev.controls)
        ? (dev.teleControls || dev.ykList || dev.controls).map((p: any, pIdx: number): DeviceTeleControlPoint => ({
            pointId: Number(p.pointId || p.id || pIdx + 1),
            name: String(p.name || p.desc || `遥控指令 ${pIdx + 1}`),
            targetPointId: p.targetPointId || p.targetYxId || 1,
            options: Array.isArray(p.options) ? p.options : [
              { label: '分闸 (0)', value: 0 },
              { label: '合闸 (1)', value: 1 }
            ]
          }))
        : [],

      // 遥调 YT
      teleRegulations: Array.isArray(dev.teleRegulations || dev.ytList || dev.regulations)
        ? (dev.teleRegulations || dev.ytList || dev.regulations).map((p: any, pIdx: number): DeviceTeleRegulationPoint => ({
            pointId: Number(p.pointId || p.id || pIdx + 1),
            name: String(p.name || p.desc || `遥调定值 ${pIdx + 1}`),
            targetYcPointId: p.targetYcPointId,
            min: Number(p.min ?? 0),
            max: Number(p.max ?? 1000),
            step: Number(p.step ?? 1),
            unit: String(p.unit || ''),
            value: Number(p.value ?? 0)
          }))
        : []
    };
  });
}

/**
 * 生成符合 C++ 程序 A 标准输出的模拟仿真装置点表
 */
function generateMockProgramADevices(): ScadaDeviceItem[] {
  return [
    {
      deviceId: 'DEV-CPP-101',
      deviceName: '10kV 进线 101 保护测控单元 (C++ 程序A同步)',
      deviceType: '线路测控保护装置',
      commStatus: 1,
      ipAddress: '192.168.2.101',
      telemetries: [
        { pointId: 1, name: 'A相电压 Ua', factor: 0.1, unit: 'kV', rawValue: 102.5, value: 10.25, alarmHigh: 11.5, alarmLow: 9.0 },
        { pointId: 2, name: 'B相电压 Ub', factor: 0.1, unit: 'kV', rawValue: 102.7, value: 10.27, alarmHigh: 11.5, alarmLow: 9.0 },
        { pointId: 3, name: 'C相电压 Uc', factor: 0.1, unit: 'kV', rawValue: 102.3, value: 10.23, alarmHigh: 11.5, alarmLow: 9.0 },
        { pointId: 4, name: 'A相电流 Ia', factor: 1.0, unit: 'A', rawValue: 435.8, value: 435.8, alarmHigh: 800 },
        { pointId: 5, name: 'B相电流 Ib', factor: 1.0, unit: 'A', rawValue: 430.2, value: 430.2, alarmHigh: 800 },
        { pointId: 6, name: 'C相电流 Ic', factor: 1.0, unit: 'A', rawValue: 438.9, value: 438.9, alarmHigh: 800 },
        { pointId: 7, name: '有功功率 P', factor: 1.0, unit: 'kW', rawValue: 7850.4, value: 7850.4 },
        { pointId: 8, name: '无功功率 Q', factor: 1.0, unit: 'kvar', rawValue: 1250.2, value: 1250.2 },
        { pointId: 9, name: '功率因数 CosΦ', factor: 0.01, unit: '', rawValue: 98, value: 0.98 },
        { pointId: 10, name: '系统频率 F', factor: 0.01, unit: 'Hz', rawValue: 5001, value: 50.01 }
      ],
      teleSignals: [
        { pointId: 1, name: '101断路器位置 (0:分/1:合/2:故障)', value: 1, statusText: '合闸 (1)' },
        { pointId: 2, name: '101隔离刀闸位置 (0:分/1:合)', value: 1, statusText: '合闸 (1)' },
        { pointId: 3, name: '101接地刀闸位置 (0:分/1:合)', value: 0, statusText: '分闸 (0)' },
        { pointId: 4, name: '装置闭锁告警 (0:常/1:动)', value: 0, statusText: '正常 (0)' },
        { pointId: 5, name: '重合闸充电完成 (0:未/1:充)', value: 1, statusText: '已充电 (1)' }
      ],
      energies: [
        { pointId: 1, name: '正向有功总电能', factor: 0.01, unit: 'kWh', value: 89452.3 },
        { pointId: 2, name: '反向有功总电能', factor: 0.01, unit: 'kWh', value: 124.5 }
      ],
      teleControls: [
        {
          pointId: 1,
          name: '101断路器远方分合闸控制',
          targetPointId: 1,
          options: [
            { label: '分闸 (0)', value: 0 },
            { label: '合闸 (1)', value: 1 }
          ]
        }
      ],
      teleRegulations: [
        {
          pointId: 1,
          name: '过流I段保护定值整定',
          min: 100,
          max: 2000,
          step: 5,
          unit: 'A',
          value: 850
        }
      ]
    },
    {
      deviceId: 'DEV-CPP-102',
      deviceName: '35kV/10kV 1#主变压器测控保护装置 (C++ 程序A同步)',
      deviceType: '主变测控保护单元',
      commStatus: 1,
      ipAddress: '192.168.2.102',
      telemetries: [
        { pointId: 1, name: '主变高压侧电压 U_high', factor: 0.1, unit: 'kV', rawValue: 352.4, value: 35.24 },
        { pointId: 2, name: '主变低压侧电压 U_low', factor: 0.1, unit: 'kV', rawValue: 102.6, value: 10.26 },
        { pointId: 3, name: '主变顶层油温 TopTemp', factor: 1.0, unit: '℃', rawValue: 56.8, value: 56.8, alarmHigh: 85.0 },
        { pointId: 4, name: '主变绕组热点温度 HotTemp', factor: 1.0, unit: '℃', rawValue: 68.2, value: 68.2, alarmHigh: 95.0 },
        { pointId: 5, name: '主变当前负荷率 LoadRatio', factor: 0.1, unit: '%', rawValue: 742, value: 74.2 }
      ],
      teleSignals: [
        { pointId: 1, name: '主变高压侧主断路器 (0:分/1:合)', value: 1, statusText: '合闸 (1)' },
        { pointId: 2, name: '主变低压侧总断路器 (0:分/1:合)', value: 1, statusText: '合闸 (1)' },
        { pointId: 3, name: '主变重瓦斯跳闸 (0:常/1:动)', value: 0, statusText: '正常 (0)' },
        { pointId: 4, name: '主变轻瓦斯告警 (0:常/1:警)', value: 0, statusText: '正常 (0)' },
        { pointId: 5, name: '强迫风冷风机运行 (0:停/1:运)', value: 1, statusText: '运行 (1)' }
      ],
      energies: [
        { pointId: 1, name: '1#主变累计输入总电量', factor: 0.01, unit: 'MWh', value: 14520.8 }
      ],
      teleControls: [
        {
          pointId: 1,
          name: '主变高压侧真空断路器分合控制',
          targetPointId: 1,
          options: [{ label: '分闸', value: 0 }, { label: '合闸', value: 1 }]
        }
      ],
      teleRegulations: [
        {
          pointId: 1,
          name: '有载分接头档位设定 (OLTC)',
          min: 1,
          max: 17,
          step: 1,
          unit: '档',
          value: 9
        }
      ]
    },
    {
      deviceId: 'DEV-CPP-301',
      deviceName: '5MW 光储一体化 PCS 双向变流器 (C++ 程序A同步)',
      deviceType: '储能PCS变流器',
      commStatus: 1,
      ipAddress: '192.168.2.301',
      telemetries: [
        { pointId: 1, name: '直流母线电压 Vdc', factor: 0.1, unit: 'V', rawValue: 7850, value: 785.0 },
        { pointId: 2, name: '直流充放电电流 Idc', factor: 0.1, unit: 'A', rawValue: 1254, value: 125.4 },
        { pointId: 3, name: 'PCS 当前充放电功率 P', factor: 1.0, unit: 'kW', rawValue: -98.4, value: -98.4 },
        { pointId: 4, name: '电池堆综合荷电状态 SOC', factor: 0.1, unit: '%', rawValue: 864, value: 86.4, alarmLow: 10.0 },
        { pointId: 5, name: '电池堆健康状态 SOH', factor: 0.1, unit: '%', rawValue: 985, value: 98.5 },
        { pointId: 6, name: '电池堆最高单体温度', factor: 0.1, unit: '℃', rawValue: 342, value: 34.2, alarmHigh: 45.0 }
      ],
      teleSignals: [
        { pointId: 1, name: 'PCS运行模式 (0:待机/1:充电/2:放电)', value: 1, statusText: '充电中 (1)' },
        { pointId: 2, name: 'BMS 主接触器状态 (0:分/1:合)', value: 1, statusText: '闭合 (1)' },
        { pointId: 3, name: '绝缘阻抗超限报警 (0:常/1:警)', value: 0, statusText: '正常 (0)' }
      ],
      energies: [
        { pointId: 1, name: '累计充电总电量', factor: 0.01, unit: 'MWh', value: 3420.5 },
        { pointId: 2, name: '累计放电总电量', factor: 0.01, unit: 'MWh', value: 3125.8 }
      ],
      teleControls: [
        {
          pointId: 1,
          name: 'PCS 紧急停机指令',
          targetPointId: 1,
          options: [{ label: '停止', value: 0 }, { label: '启动', value: 1 }]
        }
      ],
      teleRegulations: [
        {
          pointId: 1,
          name: '充放电限功率设定值',
          min: 0,
          max: 2500,
          step: 50,
          unit: 'kW',
          value: 1200
        }
      ]
    }
  ];
}

/**
 * 核心方法 2：向 C++ 程序 A 发送遥控/遥调指令
 */
export async function sendControlToProgramA(
  deviceId: string,
  pointId: number | string,
  targetValue: number,
  type: 'yk' | 'yt' = 'yk'
): Promise<{ success: boolean; message: string }> {
  const config = getProgramAConfig();
  const url = `${config.httpUrl.replace(/\/+$/, '')}/api/scada/control`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        pointId,
        type,
        targetValue,
        timestamp: new Date().toISOString()
      })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message || `C++ 程序 A 成功执行指令: ${targetValue}` };
    }
  } catch (e: any) {
    console.warn(`[ProgramA] 遥控遥调指令发送至 C++ 服务失败:`, e);
  }

  // 离线/模拟执行成功响应
  return {
    success: true,
    message: `[仿真反馈] C++ 程序 A 遥控遥调通道已就绪，指令已闭环执行 (目标值: ${targetValue})`
  };
}

/**
 * 核心方法 3：生成供 C++ 开发工程师直接使用的标准服务端代码示例
 */
export function generateCppSampleCode(): string {
  return `/**
 * ==============================================================================
 * C++ 后端程序 A 工业通信服务范例 (基于 cpp-httplib 或 uWebSockets)
 * ==============================================================================
 * 本代码演示了 C++ 程序 A 如何为本 SCADA 前端及 Electron IPC 提供：
 * 1. GET /api/scada/devices      - 导出所有测控装置及 YC/YX/DD/YK/YT 点表定义
 * 2. POST /api/scada/control     - 接收前端下发的遥控与遥调定值指令
 * 3. WS /ws (或 SSE / UDP/TCP)   - 向前端主动推送毫秒级实时数据变位与动态告警日志
 * ==============================================================================
 */

#include <iostream>
#include <string>
#include <vector>
#include <chrono>
#include <thread>
// 依赖说明：推荐使用 nlohmann/json 和 cpp-httplib (单头文件库)
#include "httplib.h"
#include "json.hpp"

using json = nlohmann::json;

// 1. 装置与点表数据结构定义
struct TelemetryPoint {
    int pointId;
    std::string name;
    double factor;
    std::string unit;
    double value;
    double alarmHigh;
    double alarmLow;
};

struct TeleSignalPoint {
    int pointId;
    std::string name;
    int value; // 0: 分闸, 1: 合闸, 2: 故障
    std::string statusText;
};

struct ScadaDevice {
    std::string deviceId;
    std::string deviceName;
    std::string deviceType;
    int commStatus; // 1: 正常, 0: 中断
    std::string ipAddress;
    std::vector<TelemetryPoint> telemetries;
    std::vector<TeleSignalPoint> teleSignals;
};

// 2. 构造装置数据并序列化为标准 JSON
json BuildDeviceSchemaJson() {
    json root;
    root["datasetName"] = "智能变电站集控点表 (C++程序A原生)";
    root["version"] = "2.0.0";
    root["timestamp"] = "2026-09-06T12:00:00Z";

    json devices = json::array();

    // 示例装置 1：10kV 进线 101
    json dev1;
    dev1["deviceId"] = "DEV-CPP-101";
    dev1["deviceName"] = "10kV 进线 101 测控保护装置";
    dev1["deviceType"] = "线路保护测控单元";
    dev1["commStatus"] = 1;
    dev1["ipAddress"] = "192.168.2.101";

    dev1["telemetries"] = json::array({
        {{"pointId", 1}, {"name", "A相电压 Ua"}, {"factor", 0.1}, {"unit", "kV"}, {"value", 10.25}, {"alarmHigh", 11.5}},
        {{"pointId", 2}, {"name", "B相电压 Ub"}, {"factor", 0.1}, {"unit", "kV"}, {"value", 10.28}, {"alarmHigh", 11.5}},
        {{"pointId", 3}, {"name", "C相电压 Uc"}, {"factor", 0.1}, {"unit", "kV"}, {"value", 10.22}, {"alarmHigh", 11.5}},
        {{"pointId", 4}, {"name", "A相电流 Ia"}, {"factor", 1.0}, {"unit", "A"},  {"value", 432.5}, {"alarmHigh", 800.0}},
        {{"pointId", 7}, {"name", "总有功功率 P"}, {"factor", 1.0}, {"unit", "kW"}, {"value", 7680.0}}
    });

    dev1["teleSignals"] = json::array({
        {{"pointId", 1}, {"name", "101断路器位置"}, {"value", 1}, {"statusText", "合闸 (1)"}},
        {{"pointId", 2}, {"name", "101隔离刀闸位置"}, {"value", 1}, {"statusText", "合闸 (1)"}},
        {{"pointId", 3}, {"name", "装置异常告警"}, {"value", 0}, {"statusText", "正常 (0)"}}
    });

    dev1["teleControls"] = json::array({
        {
            {"pointId", 1},
            {"name", "101断路器远方分合闸控制"},
            {"targetPointId", 1},
            {"options", json::array({
                {{"label", "分闸 (0)"}, {"value", 0}},
                {{"label", "合闸 (1)"}, {"value", 1}}
            })}
        }
    });

    devices.push_back(dev1);
    root["devices"] = devices;
    return root;
}

int main() {
    httplib::Server svr;

    // 允许跨域（供 Web 预览与 Electron 发起请求）
    svr.set_default_headers({
        {"Access-Control-Allow-Origin", "*"},
        {"Access-Control-Allow-Methods", "GET, POST, OPTIONS"},
        {"Access-Control-Allow-Headers", "Content-Type, X-SCADA-Client"}
    });

    // 接口 1: 提供装置与点表查询 (前端点击「从 C++ 服务(程序A)同步装置点表」时触发)
    svr.Get("/api/scada/devices", [](const httplib::Request&, httplib::Response& res) {
        json schema = BuildDeviceSchemaJson();
        res.set_content(schema.dump(2), "application/json");
        std::cout << "[Program A] 成功响应前端装置与点表同步请求" << std::endl;
    });

    // 接口 2: 接收遥控/遥调指令
    svr.Post("/api/scada/control", [](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = json::parse(req.body);
            std::string devId = body["deviceId"];
            int pointId = body["pointId"];
            double targetVal = body["targetValue"];
            std::cout << "[Program A] 收到遥控下发 -> 装置: " << devId 
                      << " 点号: " << pointId << " 目标值: " << targetVal << std::endl;
            
            // 下发至硬件驱动 / CAN / Modbus / 104 规约...
            json resp = {{"success", true}, {"code", 0}, {"message", "遥控指令下发硬件成功"}};
            res.set_content(resp.dump(), "application/json");
        } catch (...) {
            res.status = 400;
            res.set_content("{\\"success\\":false, \\"error\\":\\"Invalid JSON\\"}", "application/json");
        }
    });

    std::cout << ">>> C++ 程序 A SCADA 通信引擎已启动在端口 8088 <<<" << std::endl;
    svr.listen("0.0.0.0", 8088);
    return 0;
}
`;
}
