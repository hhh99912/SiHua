import { app, BrowserWindow, dialog, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * SCADA 工业黑匣子与系统重启/崩溃监控引擎
 * 针对 凝思安全操作系统 (Linx OS 4.9.x) / 工控机环境深度定制：
 * 1. 毫秒级写入崩溃与退出日志 (fs.writeFileSync)，杜绝异步日志丢失
 * 2. 10 秒低开销原子心跳守护，记录内存 (V8 Heap/RSS)、系统总/空闲内存、负载与文件句柄
 * 3. 每次启动自动溯源并分析「上一次为什么突然重启/退出」
 * 4. 彻底诊断：V8 堆溢出 (OOM)、Linux 内核 OOM-Killer、段错误、看门狗超时、工控机硬件断电
 */

export interface SystemSnapshot {
  timestamp: string;
  uptimeSeconds: number;
  osUptimeSeconds: number;
  processMemory: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
    externalMb: number;
  };
  systemMemory: {
    totalMb: number;
    freeMb: number;
    usedPercent: number;
  };
  cpuLoad: number[];
  fdCount?: number;
  activeWindows: number;
  status: 'alive' | 'clean_exit' | 'crashing';
}

export interface CrashEventRecord {
  id: string;
  timestamp: string;
  type: 'render-process-gone' | 'uncaught-exception' | 'unhandled-rejection' | 'signal' | 'child-process-gone';
  reason?: string;
  exitCode?: number;
  errorStack?: string;
  snapshot?: SystemSnapshot;
}

export interface RebootDiagnosisReport {
  analyzedAt: string;
  wasCleanShutdown: boolean;
  presumedReason: string;
  details: string;
  lastHeartbeatTime?: string;
  lastHeartbeatUptime?: number;
  lastMemoryStats?: {
    rssMb: number;
    heapUsedMb: number;
    freeSystemMb: number;
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedActions: string[];
}

export class ScadaCrashMonitor {
  private logsDir: string;
  private heartbeatFile: string;
  private blackboxLogFile: string;
  private crashHistoryFile: string;
  private diagnosisReportFile: string;
  private cleanExitFlagFile: string;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private lastReport: RebootDiagnosisReport | null = null;
  private getWindowFn: (() => BrowserWindow | null) | null = null;

  constructor() {
    // 确定日志目录：如果是已打包程序，位于程序同级 logs/；开发模式位于工程根目录 logs/
    const execDir = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
    this.logsDir = path.resolve(execDir, 'logs');
    if (!fs.existsSync(this.logsDir)) {
      try {
        fs.mkdirSync(this.logsDir, { recursive: true });
      } catch (err) {
        console.error('[CrashMonitor] 创建日志目录失败:', err);
      }
    }

    this.heartbeatFile = path.join(this.logsDir, 'heartbeat.json');
    this.blackboxLogFile = path.join(this.logsDir, 'scada_blackbox.log');
    this.crashHistoryFile = path.join(this.logsDir, 'scada_crash_history.json');
    this.diagnosisReportFile = path.join(this.logsDir, 'reboot_diagnosis_report.txt');
    this.cleanExitFlagFile = path.join(this.logsDir, '.clean_shutdown_marker');
  }

  public init(getWindow: () => BrowserWindow | null) {
    this.getWindowFn = getWindow;

    // 1. 在开机首刻分析上一次退出情况
    this.lastReport = this.analyzePreviousSession();
    this.writeDiagnosisReportToFile(this.lastReport);

    // 2. 清理退出标记，标记当前会话为「运行中」
    this.removeCleanExitMarker();

    // 3. 注册 Node 主进程崩溃与信号监听
    this.registerProcessHooks();

    // 4. 启动 10 秒低开销黑匣子心跳记录
    this.startHeartbeatLoop();

    // 5. 打印黑匣子启动信息
    this.logBlackboxLine(`[SYSTEM_STARTUP] SCADA 启动. PID=${process.pid}, Node=${process.version}, 诊断结果=${this.lastReport.presumedReason}`);
  }

  /**
   * 记录单行黑匣子日志，并实现安全的 20MB 滚动轮转
   */
  public logBlackboxLine(message: string) {
    try {
      const nowStr = new Date().toISOString();
      const line = `[${nowStr}] ${message}\n`;
      fs.appendFileSync(this.blackboxLogFile, line, 'utf-8');

      // 检查文件体积是否超过 20MB
      const stat = fs.statSync(this.blackboxLogFile);
      if (stat.size > 20 * 1024 * 1024) {
        const backupFile = path.join(this.logsDir, 'scada_blackbox.old.log');
        try {
          if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
          fs.renameSync(this.blackboxLogFile, backupFile);
        } catch {}
      }
    } catch {}
  }

  /**
   * 获取当前系统与进程快照
   */
  public getSnapshot(status: 'alive' | 'clean_exit' | 'crashing' = 'alive'): SystemSnapshot {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    let fdCount: number | undefined = undefined;
    if (process.platform === 'linux' && fs.existsSync('/proc/self/fd')) {
      try {
        fdCount = fs.readdirSync('/proc/self/fd').length;
      } catch {}
    }

    const wins = BrowserWindow.getAllWindows();

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      osUptimeSeconds: Math.floor(os.uptime()),
      processMemory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        externalMb: Math.round(mem.external / 1024 / 1024)
      },
      systemMemory: {
        totalMb: Math.round(totalMem / 1024 / 1024),
        freeMb: Math.round(freeMem / 1024 / 1024),
        usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100)
      },
      cpuLoad: os.loadavg().map(v => +v.toFixed(2)),
      fdCount,
      activeWindows: wins.length,
      status
    };
  }

  /**
   * 启动 10 秒黑匣子定时心跳
   */
  private startHeartbeatLoop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    // 立即写一次初始心跳
    this.writeHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      this.writeHeartbeat();
    }, 10000);
  }

  private writeHeartbeat() {
    try {
      const snapshot = this.getSnapshot('alive');
      const tempPath = `${this.heartbeatFile}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.heartbeatFile);

      // 每 60 秒在 blackbox.log 中打一次汇总标记
      if (snapshot.uptimeSeconds % 60 < 10) {
        this.logBlackboxLine(
          `[HEARTBEAT] Uptime=${snapshot.uptimeSeconds}s, Heap=${snapshot.processMemory.heapUsedMb}/${snapshot.processMemory.heapTotalMb}MB, RSS=${snapshot.processMemory.rssMb}MB, FreeSys=${snapshot.systemMemory.freeMb}MB, Load=${snapshot.cpuLoad.join(',')}, FDs=${snapshot.fdCount ?? 'N/A'}`
        );
      }
    } catch (err: any) {
      console.warn('[CrashMonitor] 写入心跳异常:', err.message);
    }
  }

  /**
   * 深度逆向分析：诊断上一次突然退出的真正诱因
   */
  private analyzePreviousSession(): RebootDiagnosisReport {
    const now = new Date().toISOString();

    // 1. 检查是否存在正常退出的标记文件
    if (fs.existsSync(this.cleanExitFlagFile)) {
      return {
        analyzedAt: now,
        wasCleanShutdown: true,
        presumedReason: '正常退出 (用户主动关闭或系统安全注销)',
        details: '上次会话检测到了合法的退出标记，未发生异常崩溃或强行断电。',
        confidence: 'HIGH',
        recommendedActions: ['系统状态正常，无需特殊处理。']
      };
    }

    // 2. 如果不存在正常退出标记，检查上一次遗留的 heartbeat.json
    if (!fs.existsSync(this.heartbeatFile)) {
      return {
        analyzedAt: now,
        wasCleanShutdown: false,
        presumedReason: '初次部署运行或历史记录被清除',
        details: '未找到上次心跳记录文件 (heartbeat.json)，可能是首次在此机器上安装或日志被手动清空。',
        confidence: 'LOW',
        recommendedActions: ['继续观察监控，黑匣子已自动开始捕获本次运行数据。']
      };
    }

    try {
      const raw = fs.readFileSync(this.heartbeatFile, 'utf-8');
      const lastSnap: SystemSnapshot = JSON.parse(raw);
      const lastHeartbeatTime = lastSnap.timestamp;
      const lastHeartbeatUptime = lastSnap.uptimeSeconds;
      const rssMb = lastSnap.processMemory?.rssMb || 0;
      const heapUsedMb = lastSnap.processMemory?.heapUsedMb || 0;
      const heapTotalMb = lastSnap.processMemory?.heapTotalMb || 0;
      const freeSysMb = lastSnap.systemMemory?.freeMb || 0;
      const totalSysMb = lastSnap.systemMemory?.totalMb || 0;
      const currentOsUptime = os.uptime();

      // 检查最近是否有崩溃事件记录
      let recentCrashEvent: CrashEventRecord | null = null;
      if (fs.existsSync(this.crashHistoryFile)) {
        try {
          const list: CrashEventRecord[] = JSON.parse(fs.readFileSync(this.crashHistoryFile, 'utf-8'));
          if (list && list.length > 0) {
            recentCrashEvent = list[list.length - 1];
          }
        } catch {}
      }

      // 核心特征判断 A：明确捕获到了渲染进程或子进程的崩溃事件
      if (recentCrashEvent && recentCrashEvent.snapshot?.timestamp === lastHeartbeatTime) {
        if (recentCrashEvent.reason === 'oom') {
          return {
            analyzedAt: now,
            wasCleanShutdown: false,
            presumedReason: '【确诊】前端渲染进程 V8 堆内存溢出 (OOM)',
            details: `渲染进程在 ${lastHeartbeatTime} 因内存耗尽被 Chromium 引擎直接中止。退出码: ${recentCrashEvent.exitCode}。`,
            lastHeartbeatTime,
            lastHeartbeatUptime,
            lastMemoryStats: { rssMb, heapUsedMb, freeSystemMb: freeSysMb },
            confidence: 'HIGH',
            recommendedActions: [
              '已在当前版本调高 V8 堆内存限制至 2048MB（之前版本被限制在 512MB 极易触发 OOM）。',
              '已优化 ECharts 与画布缓存，避免长周期数据累积。'
            ]
          };
        } else if (recentCrashEvent.reason === 'crashed') {
          return {
            analyzedAt: now,
            wasCleanShutdown: false,
            presumedReason: '【确诊】渲染进程段错误 (SIGSEGV / 非法指令崩溃)',
            details: `渲染器发生底层段错误异常退出 (Reason: crashed, ExitCode: ${recentCrashEvent.exitCode})。通常由显卡驱动或 Mesa 软渲染非法内存访问引发。`,
            lastHeartbeatTime,
            lastHeartbeatUptime,
            lastMemoryStats: { rssMb, heapUsedMb, freeSystemMb: freeSysMb },
            confidence: 'HIGH',
            recommendedActions: [
              '建议使用纯 CPU 软件渲染模式 (--disable-gpu --software-render)。',
              '执行 deploy/linx-crash-diagnose.sh 查看 Xorg.0.log 是否有驱动报错。'
            ]
          };
        }
      }

      // 核心特征判断 B：整机重启特征 (凝思主机 OS Uptime 明显短于正常时间)
      // 如果当前系统的开机时间 (osUptime) 很短 (例如小于 180 秒)，说明不是单纯应用重启，而是整台工控机重新启动了！
      const isWholeMachineReboot = currentOsUptime < 300;

      // 核心特征判断 C：内存耗尽导致的 Linux OOM-Killer 或内核 Panic
      if (freeSysMb < 100 || (totalSysMb > 0 && freeSysMb / totalSysMb < 0.05)) {
        return {
          analyzedAt: now,
          wasCleanShutdown: false,
          presumedReason: isWholeMachineReboot
            ? '【高危确诊】系统物理内存耗尽，触发 Linux 内核 Panic 导致工控机整机重启！'
            : '【高危确诊】物理内存耗尽，触发 Linux OOM-Killer 强制杀死 SCADA 进程！',
          details: `上次停止前，凝思主机剩余物理内存仅剩 ${freeSysMb}MB (${Math.round((freeSysMb/totalSysMb)*100)}%)！凝思安全内核若配置了 vm.panic_on_oom=1，在内存枯竭时会直接触发 Kernel Panic 并在 10 秒后强制重启整机。`,
          lastHeartbeatTime,
          lastHeartbeatUptime,
          lastMemoryStats: { rssMb, heapUsedMb, freeSystemMb: freeSysMb },
          confidence: 'HIGH',
          recommendedActions: [
            '在凝思系统终端执行: sudo sysctl -w vm.panic_on_oom=0 防止内核因 OOM 触发整机重启。',
            '执行: sudo dmesg -T | grep -i oom 或 cat /var/log/messages | grep oom-killer 确认内核日志。',
            '给工控机开启 2GB 以上 Swap 交换分区缓冲瞬时突发内存。'
          ]
        };
      }

      // 核心特征判断 D：V8 堆内存逼近 512MB 限制 (针对之前版本的典型病因)
      if (heapUsedMb > 480 || heapTotalMb > 490) {
        return {
          analyzedAt: now,
          wasCleanShutdown: false,
          presumedReason: '【确诊】V8 堆内存触顶 (512MB 限制)，导致 Node/Chromium 引擎直接 SIGABRT 闪退！',
          details: `上次运行 ${Math.floor(lastHeartbeatUptime / 60)} 分钟，最后心跳记录 V8 堆内存已达到 ${heapUsedMb}MB (上限为 512MB)！触发了 V8 FATAL ERROR 并由 Docker/守护脚本自动拉起。`,
          lastHeartbeatTime,
          lastHeartbeatUptime,
          lastMemoryStats: { rssMb, heapUsedMb, freeSystemMb: freeSysMb },
          confidence: 'HIGH',
          recommendedActions: [
            '本次启动已彻底解除 512MB 人工封顶，现已将 V8 堆内存扩展至 2048MB。',
            '排查是否在前端保存了过多的历史快照或高频图表重绘。'
          ]
        };
      }

      // 核心特征判断 E：整机工控机硬件看门狗 (Hardware Watchdog) 超时复位或意外掉电
      if (isWholeMachineReboot) {
        return {
          analyzedAt: now,
          wasCleanShutdown: false,
          presumedReason: '【疑难确诊】工控机硬件看门狗 (Watchdog) 触发整机硬复位，或电源异常瞬间断电！',
          details: `检测到凝思操作系统整机在开机仅 ${Math.floor(currentOsUptime)} 秒前刚重新开机，且上次 SCADA 心跳是在正常运行时突发中断 (最后系统空闲内存: ${freeSysMb}MB, V8堆内存: ${heapUsedMb}MB，均无溢出)。此特征符合研华/研祥/工控机主板芯片 /dev/watchdog 硬件喂狗超时或电源断电瞬间重启。`,
          lastHeartbeatTime,
          lastHeartbeatUptime,
          lastMemoryStats: { rssMb, heapUsedMb, freeSystemMb: freeSysMb },
          confidence: 'MEDIUM',
          recommendedActions: [
            '检查工控机主板 BIOS 中的 Watchdog Timer 设置或凝思系统中的 /usr/sbin/watchdog 守护进程。',
            '在凝思系统终端运行: sudo dmesg | grep -i watchdog 查看硬件看门狗复位记录。',
            '运行我们提供的 deploy/linx-crash-diagnose.sh 自动脚本进行内核与看门狗诊断。'
          ]
        };
      }

      // 保底归纳
      return {
        analyzedAt: now,
        wasCleanShutdown: false,
        presumedReason: '【未知异常中断】程序被外部 SIGKILL (kill -9) 强行杀死或无前兆中断',
        details: `上次运行持续了 ${Math.floor(lastHeartbeatUptime / 60)} 分钟，但在 ${lastHeartbeatTime} 突发中断，内存状态正常。外部守护进程重启了它。`,
        lastHeartbeatTime,
        lastHeartbeatUptime,
        lastMemoryStats: { rssMb, heapUsedMb, freeSystemMb: freeSysMb },
        confidence: 'LOW',
        recommendedActions: [
          '检查是否有外部守护脚本或 Docker healthcheck 误判并将容器杀死重启。',
          '通过 deploy/linx-crash-diagnose.sh 分析 /var/log/syslog 系统日志。'
        ]
      };
    } catch (err: any) {
      return {
        analyzedAt: now,
        wasCleanShutdown: false,
        presumedReason: '解析上次心跳文件失败',
        details: `读取 ${this.heartbeatFile} 时发生解析错误: ${err.message}`,
        confidence: 'LOW',
        recommendedActions: ['黑匣子将重新建立干净的数据基线。']
      };
    }
  }

  private writeDiagnosisReportToFile(report: RebootDiagnosisReport) {
    try {
      const content = [
        '==============================================================================',
        '              GE-SCADA 工业监控系统 - 上次运行与异常重启诊断报告',
        '==============================================================================',
        `分析生成时间: ${report.analyzedAt}`,
        `上次是否正常退出: ${report.wasCleanShutdown ? '是 (Clean Shutdown)' : '否 (异常中断 / 突然重启)'}`,
        `诊断推断原因: ${report.presumedReason}`,
        `可信度等级: ${report.confidence}`,
        '------------------------------------------------------------------------------',
        `详细分析依据:`,
        `  ${report.details}`,
        report.lastHeartbeatTime ? `  上次最后心跳时刻: ${report.lastHeartbeatTime}` : '',
        report.lastHeartbeatUptime ? `  上次连续运行时长: ${Math.floor(report.lastHeartbeatUptime / 60)} 分钟 (${report.lastHeartbeatUptime} 秒)` : '',
        report.lastMemoryStats ? `  上次最后内存状态: V8堆内存=${report.lastMemoryStats.heapUsedMb}MB, 进程物理RSS=${report.lastMemoryStats.rssMb}MB, 系统空闲=${report.lastMemoryStats.freeSystemMb}MB` : '',
        '------------------------------------------------------------------------------',
        '建议处置与优化措施:',
        ...report.recommendedActions.map((act, i) => `  ${i + 1}. ${act}`),
        '==============================================================================',
        ''
      ].filter(Boolean).join('\n');

      fs.writeFileSync(this.diagnosisReportFile, content, 'utf-8');
    } catch {}
  }

  /**
   * 记录崩溃事件到历史清单
   */
  public recordCrashEvent(event: Omit<CrashEventRecord, 'id' | 'timestamp' | 'snapshot'>) {
    try {
      const snapshot = this.getSnapshot('crashing');
      const record: CrashEventRecord = {
        id: `crash-${Date.now()}`,
        timestamp: new Date().toISOString(),
        snapshot,
        ...event
      };

      // 1. 同步毫秒级刷写 fatal_crash.log
      const fatalLogPath = path.join(this.logsDir, 'fatal_crash.log');
      const logEntry = `[${record.timestamp}] [${record.type}] Reason=${record.reason || 'N/A'}, ExitCode=${record.exitCode ?? 'N/A'}\nStack:\n${record.errorStack || 'No stack'}\nSnapshot: RSS=${snapshot.processMemory.rssMb}MB, Heap=${snapshot.processMemory.heapUsedMb}MB, FreeSys=${snapshot.systemMemory.freeMb}MB\n----------------------------------------\n`;
      fs.appendFileSync(fatalLogPath, logEntry, 'utf-8');

      // 2. 写入 crash_history.json
      let list: CrashEventRecord[] = [];
      if (fs.existsSync(this.crashHistoryFile)) {
        try {
          list = JSON.parse(fs.readFileSync(this.crashHistoryFile, 'utf-8'));
        } catch {}
      }
      list.push(record);
      if (list.length > 50) list.shift();
      fs.writeFileSync(this.crashHistoryFile, JSON.stringify(list, null, 2), 'utf-8');

      this.logBlackboxLine(`[CRASH_EVENT] ${record.type}: ${record.reason || ''}, ExitCode=${record.exitCode}`);
    } catch (err: any) {
      console.error('[CrashMonitor] 记录崩溃事件异常:', err.message);
    }
  }

  /**
   * 注册 Node.js 主进程与底层异常监听
   */
  private registerProcessHooks() {
    process.on('uncaughtException', (error) => {
      console.error('[CrashMonitor] 未捕获的主进程严重异常:', error);
      this.recordCrashEvent({
        type: 'uncaught-exception',
        reason: error.name,
        errorStack: error.stack
      });
    });

    process.on('unhandledRejection', (reason: any) => {
      console.warn('[CrashMonitor] 未处理的 Promise Rejection:', reason);
      this.recordCrashEvent({
        type: 'unhandled-rejection',
        reason: 'Unhandled Promise Rejection',
        errorStack: reason instanceof Error ? reason.stack : String(reason)
      });
    });

    // 监听 POSIX 安全退出信号 (SIGINT, SIGTERM)
    const handleCleanSignal = (signal: string) => {
      this.logBlackboxLine(`[SIGNAL_RECEIVED] 收到系统信号 ${signal}，正在执行安全关机归档...`);
      this.markCleanExit();
    };

    process.on('SIGINT', () => handleCleanSignal('SIGINT'));
    process.on('SIGTERM', () => handleCleanSignal('SIGTERM'));
    process.on('SIGHUP', () => handleCleanSignal('SIGHUP'));
  }

  /**
   * 注册 BrowserWindow 渲染进程崩溃与挂起监听
   */
  public attachWindow(win: BrowserWindow) {
    if (!win || win.isDestroyed()) return;

    // 1. 渲染进程异常消失 (OOM, killed, crashed)
    win.webContents.on('render-process-gone', (_event, details) => {
      console.error('[CrashMonitor] 渲染器进程消失 (render-process-gone):', details);
      this.recordCrashEvent({
        type: 'render-process-gone',
        reason: details.reason,
        exitCode: details.exitCode
      });

      // 如果是 OOM 或崩溃，弹出明确提示而不是让用户懵逼面对重启
      try {
        dialog.showErrorBox(
          'SCADA 界面渲染器发生异常中断',
          `原因: ${details.reason} (退出代码: ${details.exitCode})\n\n` +
          `黑匣子已将现场内存快照与诊断日志安全写入 logs/ 目录。\n` +
          `建议重新载入界面或通过 deploy/linx-crash-diagnose.sh 查看工控机状态。`
        );
      } catch {}
    });

    // 2. 界面长时间无响应卡死 (例如 400+ 测点陷入死循环)
    win.webContents.on('unresponsive', () => {
      console.warn('[CrashMonitor] 警告: SCADA 渲染界面长时间无响应 (unresponsive)');
      this.logBlackboxLine('[WARN_UNRESPONSIVE] 渲染界面主线程卡顿超过警戒阈值');
    });

    win.webContents.on('responsive', () => {
      this.logBlackboxLine('[INFO_RESPONSIVE] 渲染界面已从卡顿状态恢复响应');
    });
  }

  /**
   * 标记正常退出
   */
  public markCleanExit() {
    try {
      fs.writeFileSync(this.cleanExitFlagFile, JSON.stringify({
        cleanShutdownAt: new Date().toISOString(),
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
      }), 'utf-8');
      this.logBlackboxLine('[CLEAN_EXIT] 正常退出标记已建立');
    } catch {}
  }

  private removeCleanExitMarker() {
    try {
      if (fs.existsSync(this.cleanExitFlagFile)) {
        fs.unlinkSync(this.cleanExitFlagFile);
      }
    } catch {}
  }

  /**
   * 获取当前诊断数据供前端 UI 展示
   */
  public getDiagnosticData() {
    return {
      currentSnapshot: this.getSnapshot('alive'),
      lastRebootReport: this.lastReport,
      logsDir: this.logsDir,
      historyLogExists: fs.existsSync(this.blackboxLogFile),
      fatalLogExists: fs.existsSync(path.join(this.logsDir, 'fatal_crash.log'))
    };
  }

  public getLogsDirectoryPath() {
    return this.logsDir;
  }
}

export const crashMonitor = new ScadaCrashMonitor();
