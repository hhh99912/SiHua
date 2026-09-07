/**
 * UDS (Unix Domain Socket / Windows Named Pipe) 工业通信客户端与协议驱动
 * 
 * 适用于 SCADA 前端与 C++ 后端主程序 A 之间的超高速纯本地 IPC 通信：
 * - 免 HTTP 端口占用与请求开销
 * - 免 WebSocket / SSE 长连接握手与协议包装
 * - 纯本地套接字 / 命名管道，支持二进制 / 紧凑 JSON 数据交换
 * - 纯触发式拉取 (获取实时数据、获取点表、查询历史曲线)
 * - 持续式告警事件流推送 (可由前端开启或随时关闭)
 */

import { ScadaDeviceItem, DeviceTelemetryPoint, DeviceTeleSignalPoint } from '../types';
import { PRESET_SCADA_DEVICES } from '../data/presetDatasets';
import { isElectron } from './platform';

export interface UdsConfig {
  socketPath: string; // Linux/macOS: 如 '/tmp/scada_service_a.sock' | Windows: 如 '\\\\.\\pipe\\scada_service_a'
  reconnectIntervalMs: number;
  autoConnect: boolean;
}

export interface UdsStatus {
  connected: boolean;
  socketPath: string;
  isAlarmStreaming: boolean;
  lastActiveTime?: number;
  latencyMs?: number;
  error?: string;
  source: 'native_uds' | 'simulation_bridge';
}

export interface ScadaAlarmEvent {
  id: string;
  timestamp: number;
  timeStr: string;
  deviceId: string;
  deviceName: string;
  pointType: 'YC' | 'YX' | 'DD' | 'COMM' | 'SYS';
  pointId: number;
  pointName: string;
  level: 'critical' | 'major' | 'minor' | 'info'; // 告警级别: 事故/严重/一般/变位
  value: any;
  threshold?: number;
  message: string;
  acknowledged: boolean;
}

export interface HistoryQueryParam {
  deviceId: string;
  pointId: number;
  pointType?: 'YC' | 'DD';
  timeRange: '1h' | '6h' | '24h' | '7d';
  startTime?: number;
  endTime?: number;
}

export interface HistoryPoint {
  time: string;
  timestamp: number;
  value: number;
  quality: number;
}

// 默认 UDS 路径配置
const DEFAULT_UDS_CONFIG: UdsConfig = {
  socketPath: navigator.platform?.toLowerCase().includes('win')
    ? '\\\\.\\pipe\\scada_service_a'
    : '/tmp/scada_service_a.sock',
  reconnectIntervalMs: 3000,
  autoConnect: false
};

const STORAGE_KEY_UDS_CONFIG = 'ge_scada_uds_config_v1';

export function getUdsConfig(): UdsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UDS_CONFIG);
    if (raw) {
      return { ...DEFAULT_UDS_CONFIG, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_UDS_CONFIG };
}

export function saveUdsConfig(cfg: UdsConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_UDS_CONFIG, JSON.stringify(cfg));
  } catch {}
}

// 内部状态
let isAlarmStreamingActive = false;
let alarmListeners: ((event: ScadaAlarmEvent) => void)[] = [];
let realtimeListeners: ((devices: ScadaDeviceItem[]) => void)[] = [];
let simAlarmTimer: any = null;

/**
 * 1. 触发获取：从 C++ 程序 A 通过 UDS 获取所有装置与点表
 */
export async function triggerGetDevicesViaUds(cfg?: UdsConfig): Promise<{
  success: boolean;
  devices: ScadaDeviceItem[];
  datasetName?: string;
  source: 'native_uds' | 'simulation_bridge';
  error?: string;
}> {
  const currentCfg = cfg || getUdsConfig();

  // 1.1 Electron 原生 UDS IPC
  if (isElectron() && (window as any).electronAPI?.uds?.getDevices) {
    try {
      const res = await (window as any).electronAPI.uds.getDevices(currentCfg);
      if (res && res.success && Array.isArray(res.devices) && res.devices.length > 0) {
        return {
          success: true,
          devices: res.devices,
          datasetName: res.datasetName || 'UDS 动态装置点表库',
          source: 'native_uds'
        };
      }
    } catch (err: any) {
      console.warn('[UDS] Electron 原生 UDS 获取点表异常:', err);
    }
  }

  // 1.2 触发式仿真响应 (当 C++ UDS 服务未启动或 Web 开发模式时)
  const mockDevices = JSON.parse(JSON.stringify(PRESET_SCADA_DEVICES));
  return {
    success: true,
    devices: mockDevices,
    datasetName: 'UDS 本地套接字装置点表 (仿真响应)',
    source: 'simulation_bridge'
  };
}

/**
 * 2. 触发获取：单次主动触发拉取最新所有测点遥测/遥信实时数据
 */
export async function triggerGetRealtimeDataViaUds(cfg?: UdsConfig): Promise<{
  success: boolean;
  devices: ScadaDeviceItem[];
  timestamp: number;
  source: 'native_uds' | 'simulation_bridge';
  error?: string;
}> {
  const currentCfg = cfg || getUdsConfig();

  // 2.1 Electron 原生 UDS IPC
  if (isElectron() && (window as any).electronAPI?.uds?.getRealtimeData) {
    try {
      const res = await (window as any).electronAPI.uds.getRealtimeData(currentCfg);
      if (res && res.success && Array.isArray(res.devices)) {
        notifyRealtimeListeners(res.devices);
        return {
          success: true,
          devices: res.devices,
          timestamp: res.timestamp || Date.now(),
          source: 'native_uds'
        };
      }
    } catch (err: any) {
      console.warn('[UDS] Electron 原生 UDS 获取实时数据异常:', err);
    }
  }

  // 2.2 仿真单次拉取
  const updated = (PRESET_SCADA_DEVICES || []).map(dev => {
    const nextDev = { ...dev };
    if (nextDev.telemetries) {
      nextDev.telemetries = nextDev.telemetries.map(yc => {
        const delta = (Math.random() - 0.5) * (yc.value * 0.04 || 0.5);
        const val = Math.max(0, Math.round((yc.value + delta) * 100) / 100);
        return { ...yc, value: val, rawValue: Math.round(val / (yc.factor || 1)) };
      });
    }
    return nextDev;
  });

  notifyRealtimeListeners(updated);
  return {
    success: true,
    devices: updated,
    timestamp: Date.now(),
    source: 'simulation_bridge'
  };
}

/**
 * 3. 触发获取：查询指定测点的历史时序数据与历史曲线
 */
export async function triggerGetHistoryDataViaUds(param: HistoryQueryParam, cfg?: UdsConfig): Promise<{
  success: boolean;
  data: HistoryPoint[];
  stats: { max: number; min: number; avg: number; count: number; latest: number };
  source: 'native_uds' | 'simulation_bridge';
  error?: string;
}> {
  const currentCfg = cfg || getUdsConfig();

  // 3.1 Electron 原生 UDS
  if (isElectron() && (window as any).electronAPI?.uds?.getHistoryData) {
    try {
      const res = await (window as any).electronAPI.uds.getHistoryData(param, currentCfg);
      if (res && res.success && Array.isArray(res.data)) {
        return {
          success: true,
          data: res.data,
          stats: res.stats,
          source: 'native_uds'
        };
      }
    } catch (err: any) {
      console.warn('[UDS] Electron 原生 UDS 获取历史数据异常:', err);
    }
  }

  // 3.2 仿真历史数据生成器
  const now = Date.now();
  let count = 60;
  let intervalMs = 60 * 1000;

  if (param.timeRange === '1h') {
    count = 60;
    intervalMs = 60 * 1000;
  } else if (param.timeRange === '6h') {
    count = 72;
    intervalMs = 5 * 60 * 1000;
  } else if (param.timeRange === '24h') {
    count = 96;
    intervalMs = 15 * 60 * 1000;
  } else if (param.timeRange === '7d') {
    count = 168;
    intervalMs = 60 * 60 * 1000;
  }

  const list: HistoryPoint[] = [];
  const startTime = now - (count - 1) * intervalMs;
  const baseVal = 10.45;

  for (let i = 0; i < count; i++) {
    const t = startTime + i * intervalMs;
    const date = new Date(t);
    const hour = date.getHours() + date.getMinutes() / 60;
    const dailyFactor = Math.sin((hour - 6) * Math.PI / 12) * 0.15;
    const noise = (Math.random() - 0.5) * 0.08;
    const v = Math.round(Math.max(0, baseVal * (1 + dailyFactor + noise)) * 100) / 100;

    const timeStr = param.timeRange === '7d'
      ? `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:00`
      : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    list.push({
      time: timeStr,
      timestamp: t,
      value: v,
      quality: 1
    });
  }

  const values = list.map(d => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / values.length) * 100) / 100;

  return {
    success: true,
    data: list,
    stats: { max, min, avg, count: list.length, latest: values[values.length - 1] },
    source: 'simulation_bridge'
  };
}

/**
 * 4. 触发开启：开启 UDS 告警事件流持续推送
 */
export async function startAlarmStreamViaUds(cfg?: UdsConfig): Promise<{ success: boolean; message: string }> {
  if (isAlarmStreamingActive) return { success: true, message: '告警推送流已在运行中' };
  isAlarmStreamingActive = true;
  const currentCfg = cfg || getUdsConfig();

  // 4.1 Electron 原生
  if (isElectron() && (window as any).electronAPI?.uds?.startAlarmStream) {
    try {
      await (window as any).electronAPI.uds.startAlarmStream(currentCfg);
    } catch (e) {
      console.warn('[UDS] Electron 启动告警流 IPC 异常:', e);
    }
  }

  // 4.2 持续生成仿真告警事件流
  clearInterval(simAlarmTimer);
  simAlarmTimer = setInterval(() => {
    if (!isAlarmStreamingActive) return;
    const dev = PRESET_SCADA_DEVICES[Math.floor(Math.random() * PRESET_SCADA_DEVICES.length)] || PRESET_SCADA_DEVICES[0];
    const types: ('critical' | 'major' | 'minor' | 'info')[] = ['critical', 'major', 'minor', 'info'];
    const selectedLevel = types[Math.floor(Math.random() * types.length)];
    const now = new Date();

    let msg = '';
    let pName = '测控保护单元';
    let pType: 'YC' | 'YX' | 'DD' | 'COMM' | 'SYS' = 'YC';
    let pId = 1;
    let val: any = 0;

    if (selectedLevel === 'critical') {
      pType = 'YX';
      pName = '10kV 进线断路器 501';
      pId = 1;
      val = 2; // 故障跳闸
      msg = `【事故告警】${dev.deviceName} 速断保护I段动作，断路器跳闸！`;
    } else if (selectedLevel === 'major') {
      pType = 'YC';
      pName = '主变顶层油温 TopTemp';
      pId = 3;
      val = 88.5;
      msg = `【越限告警】${dev.deviceName} 顶层油温 88.5℃ (高报限值 85.0℃)`;
    } else if (selectedLevel === 'minor') {
      pType = 'YC';
      pName = '三相母线电压 Ua';
      pId = 1;
      val = 11.62;
      msg = `【一般告警】${dev.deviceName} 电压越上限 11.62kV (限值 11.5kV)`;
    } else {
      pType = 'YX';
      pName = '手车工作/试验位置';
      pId = 2;
      val = 1;
      msg = `【状态变位】${dev.deviceName} 隔离开关合闸到位 (遥信变位 SOE)`;
    }

    const alarmEvent: ScadaAlarmEvent = {
      id: `ALM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      timeStr: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`,
      deviceId: dev.deviceId,
      deviceName: dev.deviceName,
      pointType: pType,
      pointId: pId,
      pointName: pName,
      level: selectedLevel,
      value: val,
      message: msg,
      acknowledged: false
    };

    notifyAlarmListeners(alarmEvent);
  }, 4500);

  return { success: true, message: 'UDS 告警事件流已开启持续推送' };
}

/**
 * 5. 触发关闭：关闭 UDS 告警事件流推送
 */
export async function stopAlarmStreamViaUds(): Promise<{ success: boolean; message: string }> {
  isAlarmStreamingActive = false;
  clearInterval(simAlarmTimer);

  if (isElectron() && (window as any).electronAPI?.uds?.stopAlarmStream) {
    try {
      await (window as any).electronAPI.uds.stopAlarmStream();
    } catch {}
  }

  return { success: true, message: 'UDS 告警事件流已停止推送' };
}

export function isAlarmStreamRunning(): boolean {
  return isAlarmStreamingActive;
}

// 事件监听机制
export function onUdsAlarm(callback: (event: ScadaAlarmEvent) => void): () => void {
  alarmListeners.push(callback);
  return () => {
    alarmListeners = alarmListeners.filter(cb => cb !== callback);
  };
}

export function onUdsRealtime(callback: (devices: ScadaDeviceItem[]) => void): () => void {
  realtimeListeners.push(callback);
  return () => {
    realtimeListeners = realtimeListeners.filter(cb => cb !== callback);
  };
}

function notifyAlarmListeners(event: ScadaAlarmEvent) {
  alarmListeners.forEach(cb => {
    try {
      cb(event);
    } catch (e) {
      console.error('[UDS] 告警回调异常:', e);
    }
  });
}

function notifyRealtimeListeners(devices: ScadaDeviceItem[]) {
  realtimeListeners.forEach(cb => {
    try {
      cb(devices);
    } catch (e) {
      console.error('[UDS] 实时数据回调异常:', e);
    }
  });
}

/**
 * 生成 C++ 纯原生 UDS (Unix Domain Socket / Windows Named Pipe) 服务端示范代码
 */
export function generateCppUdsSampleCode(): string {
  return `/**
 * ============================================================================
 * C++ SCADA 后端主程序 A (基于 Unix Domain Socket / 命名管道 高速 IPC 范例)
 * ============================================================================
 * 特点:
 * 1. 零 HTTP/TCP 协议栈开销，纯本地 IPC 内存级管道。
 * 2. 触发式请求/响应: GET_DEVICES, GET_REALTIME, GET_HISTORY, CONTROL
 * 3. 持续式告警流推送: START_ALARM_STREAM, STOP_ALARM_STREAM
 * 4. 依赖极简: 仅需系统标准套接字头文件与 nlohmann/json
 * ============================================================================
 */

#include <iostream>
#include <string>
#include <vector>
#include <thread>
#include <atomic>
#include <chrono>
#include <cstring>

#if defined(_WIN32)
#include <windows.h>
#define UDS_PIPE_NAME "\\\\\\\\.\\\\pipe\\\\scada_service_a"
#else
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#define UDS_SOCKET_PATH "/tmp/scada_service_a.sock"
#endif

// 推荐引入轻量 JSON 库: #include <nlohmann/json.hpp>
// using json = nlohmann::json;

class ScadaUdsServer {
private:
    std::atomic<bool> m_running{false};
    std::atomic<bool> m_alarmStreaming{false};
    std::thread m_serverThread;
    std::thread m_alarmThread;
    int m_clientFd{-1};

public:
    ScadaUdsServer() = default;
    ~ScadaUdsServer() { stop(); }

    void start() {
        m_running = true;
        m_serverThread = std::thread(&ScadaUdsServer::serverLoop, this);
        m_alarmThread = std::thread(&ScadaUdsServer::alarmPushLoop, this);
        std::cout << "[UDS Server] C++ SCADA 管道服务已启动, 监听: " <<
#if defined(_WIN32)
            UDS_PIPE_NAME
#else
            UDS_SOCKET_PATH
#endif
            << std::endl;
    }

    void stop() {
        m_running = false;
        m_alarmStreaming = false;
        if (m_serverThread.joinable()) m_serverThread.join();
        if (m_alarmThread.joinable()) m_alarmThread.join();
    }

private:
    // 处理前端发来的指令
    std::string handleCommand(const std::string& cmdJsonStr) {
        std::cout << "[UDS Received] " << cmdJsonStr << std::endl;
        
        // 解析指令: {"cmd": "GET_DEVICES" | "GET_REALTIME" | "START_ALARM" | "STOP_ALARM" | "GET_HISTORY"}
        if (cmdJsonStr.find("GET_DEVICES") != std::string::npos) {
            return "{\\"success\\": true, \\"datasetName\\": \\"C++ UDS 动态装置库\\", \\"devices\\": ["
                   "{\\"deviceId\\": \\"DEV-101\\", \\"deviceName\\": \\"10kV 1号进线柜\\", \\"commStatus\\": 1, "
                   "\\"telemetries\\": [{\\"pointId\\": 1, \\"name\\": \\"A相电压 Ua\\", \\"value\\": 10.45, \\"unit\\": \\"kV\\", \\"factor\\": 0.1}],"
                   "\\"teleSignals\\": [{\\"pointId\\": 1, \\"name\\": \\"断路器状态\\", \\"value\\": 1, \\"statusText\\": \\"合闸 (1)\\"}]}"
                   "]}\\n";
        }
        else if (cmdJsonStr.find("GET_REALTIME") != std::string::npos) {
            // 返回实时遥测、遥信最新数值
            return "{\\"success\\": true, \\"timestamp\\": 1725600000000, \\"devices\\": ["
                   "{\\"deviceId\\": \\"DEV-101\\", \\"telemetries\\": [{\\"pointId\\": 1, \\"value\\": 10.48}]}"
                   "]}\\n";
        }
        else if (cmdJsonStr.find("START_ALARM") != std::string::npos) {
            m_alarmStreaming = true;
            return "{\\"success\\": true, \\"message\\": \\"Alarm streaming started\\"}\\n";
        }
        else if (cmdJsonStr.find("STOP_ALARM") != std::string::npos) {
            m_alarmStreaming = false;
            return "{\\"success\\": true, \\"message\\": \\"Alarm streaming stopped\\"}\\n";
        }
        else if (cmdJsonStr.find("GET_HISTORY") != std::string::npos) {
            return "{\\"success\\": true, \\"data\\": ["
                   "{\\"time\\": \\"10:00\\", \\"timestamp\\": 1725600000000, \\"value\\": 10.42, \\"quality\\": 1},"
                   "{\\"time\\": \\"10:15\\", \\"timestamp\\": 1725600900000, \\"value\\": 10.46, \\"quality\\": 1}"
                   "]}\\n";
        }

        return "{\\"success\\": true, \\"ack\\": true}\\n";
    }

    void serverLoop() {
#if !defined(_WIN32)
        unlink(UDS_SOCKET_PATH);
        int serverFd = socket(AF_UNIX, SOCK_STREAM, 0);
        if (serverFd < 0) return;

        struct sockaddr_un addr;
        memset(&addr, 0, sizeof(addr));
        addr.sun_family = AF_UNIX;
        strncpy(addr.sun_path, UDS_SOCKET_PATH, sizeof(addr.sun_path) - 1);

        if (bind(serverFd, (struct sockaddr*)&addr, sizeof(addr)) < 0) return;
        listen(serverFd, 5);

        while (m_running) {
            int clientFd = accept(serverFd, NULL, NULL);
            if (clientFd < 0) continue;
            m_clientFd = clientFd;

            char buf[4096];
            while (m_running) {
                ssize_t n = read(clientFd, buf, sizeof(buf) - 1);
                if (n <= 0) break;
                buf[n] = '\\0';

                std::string response = handleCommand(buf);
                write(clientFd, response.c_str(), response.size());
            }
            close(clientFd);
            m_clientFd = -1;
        }
        close(serverFd);
        unlink(UDS_SOCKET_PATH);
#endif
    }

    // 后台告警推送流线程 (当前端触发 START_ALARM 时持续推流)
    void alarmPushLoop() {
        while (m_running) {
            std::this_thread::sleep_for(std::chrono::seconds(3));
            if (m_alarmStreaming && m_clientFd > 0) {
                std::string pushMsg = "{\\"event\\": \\"ALARM_PUSH\\", \\"deviceId\\": \\"DEV-101\\", "
                                      "\\"level\\": \\"critical\\", \\"pointName\\": \\"进线过流I段\\", "
                                      "\\"message\\": \\"过流跳闸SOE动作\\", \\"timestamp\\": 1725600000000}\\n";
#if !defined(_WIN32)
                write(m_clientFd, pushMsg.c_str(), pushMsg.size());
#endif
            }
        }
    }
};

int main() {
    ScadaUdsServer server;
    server.start();

    std::cout << "SCADA C++ UDS 服务运行中，按 Enter 键退出..." << std::endl;
    std::cin.get();
    server.stop();
    return 0;
}
`;
}
