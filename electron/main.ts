import { app, BrowserWindow, ipcMain, dialog, shell, Menu, powerSaveBlocker } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import net from 'net';
import { exec } from 'child_process';
import { crashMonitor } from './crash-monitor';

// ==============================================================================
// 工业 SCADA 永远常亮保护系统 (防止凝思 Linux / X11 DPMS 熄屏、屏幕保护与系统休眠)
// ==============================================================================
let powerBlockerId: number | null = null;

const enableIndustrialStayAwake = () => {
  try {
    if (powerBlockerId === null || !powerSaveBlocker.isStarted(powerBlockerId)) {
      powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
      console.log(`[SCADA Power] 工业常亮模式已开启, powerSaveBlocker ID: ${powerBlockerId}`);
    }
  } catch (err: any) {
    console.warn('[SCADA Power] 开启 powerSaveBlocker 失败:', err?.message);
  }

  // 凝思安全操作系统 (Linx OS 4.9.x / Linux X11) 核心修复：
  // 即使凝思系统设置了永不休眠，X11 底层的 DPMS 节能协议与 xscreensaver 定时器仍会在长时间无物理键鼠输入时强制熄屏黑屏！
  // 通过主动执行 xset 彻底关闭 DPMS 与屏保超时，确保永远常亮！
  if (process.platform === 'linux') {
    try {
      exec('xset s off -dpms; xset s 0 0; xset dpms 0 0 0; xset s reset', (error) => {
        if (error) {
          console.warn('[SCADA Power] xset 命令执行提示 (非关键):', error.message);
        } else {
          console.log('[SCADA Power] 凝思 X11 DPMS 硬件节能与屏幕保护已彻底关闭，锁定屏幕永远常亮');
        }
      });
    } catch {}
  }
};

// Linux 凝思环境下每 60 秒发送一次心跳重置 X11 屏保计时器 (安全单例执行，绝不堆积子进程)
let isXsetResetRunning = false;
if (process.platform === 'linux' && typeof setInterval !== 'undefined') {
  setInterval(() => {
    if (isXsetResetRunning) return;
    isXsetResetRunning = true;
    try {
      exec('xset s reset', { timeout: 3000 }, () => {
        isXsetResetRunning = false;
      });
    } catch {
      isXsetResetRunning = false;
    }
  }, 60000);
}


// ==============================================================================
// 凝思安全操作系统 (Linx OS 4.9.x) / Intel 2代核显 (i915) / 96DPI VGA 屏幕高清抗模糊与输入法专用配置
// ==============================================================================
if (process.platform === 'linux') {
  // 1. 基础安全沙箱与共享内存稳定性
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage'); // 解决共享内存不足导致的渲染器崩溃
  app.commandLine.appendSwitch('disable-gpu-process-crash-limit');
  app.commandLine.appendSwitch('disable-gpu-watchdog'); // 彻底禁用 GPU 看门狗，防止图形渲染超时引发崩溃连锁反应导致 Linux 4.9 内核震荡重启

  // 2. 核心抗模糊：锁定 1:1 像素比，彻底防止 VGA 480x270mm EDID 导致 Chromium 自动计算 1.05x/1.1x 模糊缩放
  const customScale = process.env.SCADA_SCALE_FACTOR || '1';
  app.commandLine.appendSwitch('force-device-scale-factor', customScale);
  app.commandLine.appendSwitch('high-dpi-support', '1');
  app.commandLine.appendSwitch('force-color-profile', 'srgb');

  // 3. 字体清晰度与 FreeType 亚像素渲染 (针对 96 DPI VGA 屏幕深度调优)
  app.commandLine.appendSwitch('enable-font-antialiasing');
  app.commandLine.appendSwitch('enable-lcd-text'); // 开启 LCD RGB 次像素文字微调，消除灰度抗锯齿导致的字体发虚发灰
  
  // 关键：Linux 96 DPI 屏幕下，full hinting 将汉字横平竖直笔画对齐到物理屏幕整数像素，彻底消除未放大时的发虚
  const hintingMode = process.env.SCADA_FONT_HINTING || 'full';
  app.commandLine.appendSwitch('font-render-hinting', hintingMode);

  // 4. 显卡与图形光栅化调优 (严格适配 Intel 2代核显 i915 / Linux 4.9 内核稳定防护)
  // Linux 凝思工控机环境下默认彻底禁用 GPU 硬件加速 (纯 CPU 软渲染)，彻底消除 i915 DRM Ring 挂死与内核 Panic
  // 除非用户显式传入 --enable-gpu 或 --hardware-gpu
  const isEnableGpuRequested = process.argv.includes('--enable-gpu') || process.argv.includes('--hardware-gpu');
  const isDisableGpuRequested = !isEnableGpuRequested || 
    process.argv.includes('--disable-gpu') || 
    process.argv.includes('--software-render') || 
    process.argv.includes('--cpu-render') || 
    process.argv.includes('--soft-render') || 
    process.env.SCADA_DISABLE_GPU === '1';

  if (isDisableGpuRequested) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-gpu-rasterization');
  } else {
    // 未禁用 GPU 时的安全防线：严禁 zero-copy 防范 i915 DRM ring 挂死导致系统重启
    app.commandLine.appendSwitch('ignore-gpu-blocklist');
    app.commandLine.appendSwitch('disable-gpu-vsync');
    app.commandLine.appendSwitch('disable-gpu-rasterization');
    app.commandLine.appendSwitch('disable-zero-copy');
    app.commandLine.appendSwitch('disable-accelerated-video-decode');
    app.commandLine.appendSwitch('disable-accelerated-video-encode');
    app.commandLine.appendSwitch('use-cmd-decoder', 'validating');
  }

  app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar');

  // 5. Linux 凝思安全系统 (X11/Xorg) / Fcitx / IBus 中文输入法唤醒支持 (Ctrl+Space / 候选框)
  if (!process.env.XMODIFIERS) process.env.XMODIFIERS = '@im=fcitx';
  if (!process.env.GTK_IM_MODULE) {
    const hasGtk3Fcitx = fs.existsSync('/usr/lib/x86_64-linux-gnu/gtk-3.0/3.0.0/immodules/im-fcitx.so') ||
                         fs.existsSync('/usr/lib/gtk-3.0/3.0.0/immodules/im-fcitx.so') ||
                         fs.existsSync('/usr/lib64/gtk-3.0/3.0.0/immodules/im-fcitx.so');
    process.env.GTK_IM_MODULE = hasGtk3Fcitx ? 'fcitx' : 'xim';
  }
  if (!process.env.QT_IM_MODULE) process.env.QT_IM_MODULE = 'fcitx';

  app.commandLine.appendSwitch('gtk-version', '3');
}

// 全平台防后台挂起/休眠节流优化：彻底解决窗口最小化或后台运行时被 Chromium 挂起、重新放大时界面假死卡顿的问题
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CanvasOopRasterization,UseSkiaRendererByDefaultForOOPR,CalculateNativeWinOcclusion,Translate,AutofillServerCommunication');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-background-networking');
// 保留 Breakpad 崩溃转储能力，杜绝闪退后无迹可寻
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-speech-api');
app.commandLine.appendSwitch('disable-print-preview');
app.commandLine.appendSwitch('disable-client-side-phishing-detection');
app.commandLine.appendSwitch('no-pings');

// V8 与 Chromium 内存配置：彻底消除人工 512MB 封顶与内存挤占引起的系统崩溃！
// 智能根据系统物理内存动态分配：严禁超出物理内存上限触发 Linux OOM-Killer！
// 若工控机物理内存 <= 2.5GB (2GB工控机)，V8 限制在 800MB；4GB工控机限制在 1400MB；8GB+ 限制在 2048MB
const totalHostMemMb = Math.floor(os.totalmem() / 1024 / 1024);
let v8MaxOldSpaceMb = 1400;
if (totalHostMemMb <= 2500) {
  v8MaxOldSpaceMb = 800;
} else if (totalHostMemMb <= 4500) {
  v8MaxOldSpaceMb = 1400;
} else {
  v8MaxOldSpaceMb = 2048;
}

app.commandLine.appendSwitch('js-flags', `--max-old-space-size=${v8MaxOldSpaceMb} --expose-gc --optimize-for-size --max-semi-space-size=64`);
app.commandLine.appendSwitch('disk-cache-size', '33554432');
app.commandLine.appendSwitch('media-cache-size', '8388608');

// Linux 凝思安全操作系统底层内核防重启加固：关闭内核 Panic-on-OOM 与 Softlockup Panic
if (process.platform === 'linux') {
  try {
    exec('sysctl -w vm.panic_on_oom=0 kernel.panic=0 kernel.panic_on_oops=0 kernel.hung_task_panic=0 kernel.softlockup_panic=0 2>/dev/null || true');
  } catch {}
}

// 定期在空闲时段触发 V8 垃圾回收以释放无用内存
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    if (typeof global !== 'undefined' && (global as any).gc) {
      try { (global as any).gc(); } catch {}
    }
  }, 30000);
}

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#080f1e', // 与工业 SCADA 背景色完全一致，彻底杜绝白屏闪烁
    title: 'KND科能达 SCADA 工业组态大屏工作台',
    frame: true,
    autoHideMenuBar: true,
    show: false, // 严格保持隐藏，直到首屏真实渲染完毕才显示，彻底杜绝冷启动白屏
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      nativeWindowOpen: true,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  // 绑定黑匣子窗口崩溃与卡顿监控
  crashMonitor.attachWindow(mainWindow);

  // Remove default menu for clean SCADA workstation feel
  Menu.setApplicationMenu(null);

  // 消除冷启动白屏核心：等待前端 Vue 完成挂载首帧（通过 app:renderer-ready 握手），再呼出窗口
  const showWindowFast = () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  };

  // 1. 优先等待前端 Vue 首帧挂载完成握手（彻底告别 did-finish-load 阶段过早弹出 X11 白色空窗的问题）
  ipcMain.once('app:renderer-ready', showWindowFast);

  // 2. Chromium 内部 ready-to-show：配合 250ms 短暂缓冲，确保首帧像素提交到 X11
  mainWindow.once('ready-to-show', () => {
    setTimeout(showWindowFast, 250);
  });

  // 3. 保底超时：冷启动极端低速磁盘 I/O 异常时保底 4500ms
  setTimeout(showWindowFast, 4500);

  // 监听窗口恢复与显示事件，瞬间触发渲染重绘，消除后台唤醒时的视觉停顿
  mainWindow.on('restore', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.invalidate();
    }
  });

  mainWindow.on('show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.invalidate();
    }
  });

  // Load URL or built file
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production built distribution
    const indexPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      mainWindow.loadURL(devUrl);
    }

    // 如果通过命令行参数 --debug 或环境变量 SCADA_DEBUG=1 启动，则开启 DevTools
    if (process.argv.includes('--debug') || process.env.SCADA_DEBUG === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  }

  // External links opened in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ==============================================================================
// 深瑞 (Shenrui) SCADA 独立子模块窗口架构 (凝思安全操作系统原生进程/线程窗口)
// 每个子模块 (监控运行/图形编辑/全站告警/历史告警/历史曲线/报表/系统健康) 拥有独立原生窗口，
// 窗口标签严格显示在凝思系统应用面板 (OS taskbar) 中，总管底栏永驻系统底部作为统一守护守护进程。
// ==============================================================================
interface ModuleWindowConfig {
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maximized?: boolean;
}

const MODULE_CONFIGS: Record<string, ModuleWindowConfig> = {
  'monitor-screen': {
    title: '监控运行',
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 768,
    maximized: true
  },
  'graphic-editor': {
    title: '图形编辑',
    width: 1600,
    height: 960,
    minWidth: 1200,
    minHeight: 720
  },
  'alarm-window': {
    title: '全站告警',
    width: 1450,
    height: 850,
    minWidth: 1100,
    minHeight: 650
  },
  'history-alarm': {
    title: '历史告警',
    width: 1400,
    height: 820,
    minWidth: 1000,
    minHeight: 600
  },
  'history-curve': {
    title: '历史曲线',
    width: 1400,
    height: 820,
    minWidth: 1000,
    minHeight: 600
  },
  'report-window': {
    title: '综合报表',
    width: 1400,
    height: 820,
    minWidth: 1000,
    minHeight: 600
  },
  'health-monitor': {
    title: '系统健康',
    width: 1200,
    height: 750,
    minWidth: 900,
    minHeight: 550
  }
};

const moduleWindows = new Map<string, BrowserWindow>();
let daemonBarWindow: BrowserWindow | null = null;
let startMenuWindow: BrowserWindow | null = null;
let userMenuWindow: BrowserWindow | null = null;

// 统一的页面 URL 加载器，在开发环境优先直连 Vite 端口，打包后加载 dist/index.html
function loadAppUrl(win: BrowserWindow, queryParams?: Record<string, string>) {
  const queryStr = queryParams ? '?' + new URLSearchParams(queryParams).toString() : '';
  const devUrl = process.env.VITE_DEV_SERVER_URL || (isDev ? 'http://localhost:3000' : '');

  if (devUrl) {
    win.loadURL(`${devUrl}${queryStr}`);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath, { query: queryParams || {} });
    } else {
      win.loadURL(`http://localhost:3000${queryStr}`);
    }
  }
}

// 创建并锁定凝思系统桌面底部的“总管底栏进程” (深瑞架构：常驻屏幕底部，只有底栏，不遮挡凝思系统)
function createDaemonBarWindow(): BrowserWindow {
  if (daemonBarWindow && !daemonBarWindow.isDestroyed()) {
    daemonBarWindow.show();
    daemonBarWindow.focus();
    return daemonBarWindow;
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  const barHeight = 44;

  daemonBarWindow = new BrowserWindow({
    width: screenWidth,
    height: barHeight,
    x: 0,
    y: screenHeight - barHeight,
    minWidth: 1000,
    minHeight: barHeight,
    maxHeight: barHeight,
    backgroundColor: '#ebe4d4',
    title: '总管进程',
    frame: false, // 无边框底栏，纯净贴合桌面底部
    resizable: false,
    movable: false,
    alwaysOnTop: true, // 工业总管底栏永远常驻最前端
    show: false,
    skipTaskbar: true, // 核心：从凝思系统栏/任务栏彻底隐藏，系统栏只展示子模块进程！
    type: process.platform === 'linux' ? 'dock' : 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  Menu.setApplicationMenu(null);
  crashMonitor.attachWindow(daemonBarWindow);

  daemonBarWindow.once('ready-to-show', () => {
    daemonBarWindow?.setSkipTaskbar(true);
    daemonBarWindow?.show();
  });

  daemonBarWindow.on('closed', () => {
    daemonBarWindow = null;
    exitAllScadaProcesses();
  });

  loadAppUrl(daemonBarWindow, { mode: 'daemon-bar' });
  return daemonBarWindow;
}

// 创建向上弹出的系统菜单独立无边框窗口 (解决底栏高度44px导致DOM菜单被裁剪弹不出来的问题)
// 矩形直角 + 纯色背景 + 永远置顶，彻底杜绝Linux X11透明圆角四角发黑漏色
function createStartMenuWindow(): BrowserWindow {
  if (startMenuWindow && !startMenuWindow.isDestroyed()) {
    return startMenuWindow;
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { height: screenHeight } = primaryDisplay.bounds;
  const menuWidth = 240;
  const menuHeight = 420;
  const barHeight = 44;

  startMenuWindow = new BrowserWindow({
    width: menuWidth,
    height: menuHeight,
    x: 6,
    y: screenHeight - barHeight - menuHeight - 4,
    resizable: false,
    movable: false,
    frame: false,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#f2eee3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  Menu.setApplicationMenu(null);
  startMenuWindow.setAlwaysOnTop(true, 'pop-up-menu');

  // 失去焦点时自动收起菜单
  startMenuWindow.on('blur', () => {
    startMenuWindow?.hide();
  });

  loadAppUrl(startMenuWindow, { mode: 'start-menu' });
  return startMenuWindow;
}

// 创建向上弹出的用户菜单独立无边框窗口 (最上层显示，右对齐用户头像正上方)
function createUserMenuWindow(): BrowserWindow {
  if (userMenuWindow && !userMenuWindow.isDestroyed()) {
    return userMenuWindow;
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  const menuWidth = 190;
  const menuHeight = 150;
  const barHeight = 44;

  userMenuWindow = new BrowserWindow({
    width: menuWidth,
    height: menuHeight,
    x: Math.max(10, screenWidth - menuWidth - 70),
    y: screenHeight - barHeight - menuHeight - 4,
    resizable: false,
    movable: false,
    frame: false,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#f2eee3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  Menu.setApplicationMenu(null);
  userMenuWindow.setAlwaysOnTop(true, 'pop-up-menu');

  // 失去焦点时自动收起用户菜单
  userMenuWindow.on('blur', () => {
    userMenuWindow?.hide();
  });

  loadAppUrl(userMenuWindow, { mode: 'user-menu' });
  return userMenuWindow;
}

// 退出总管进程：推掉所有子进程并彻底退出系统
function exitAllScadaProcesses() {
  if (startMenuWindow && !startMenuWindow.isDestroyed()) {
    startMenuWindow.destroy();
    startMenuWindow = null;
  }
  if (userMenuWindow && !userMenuWindow.isDestroyed()) {
    userMenuWindow.destroy();
    userMenuWindow = null;
  }
  moduleWindows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  });
  moduleWindows.clear();
  if (daemonBarWindow && !daemonBarWindow.isDestroyed()) {
    daemonBarWindow.destroy();
    daemonBarWindow = null;
  }
  app.quit();
}

function openModuleWindow(moduleId: string): BrowserWindow {
  if (startMenuWindow && !startMenuWindow.isDestroyed()) {
    startMenuWindow.hide();
  }
  if (userMenuWindow && !userMenuWindow.isDestroyed()) {
    userMenuWindow.hide();
  }

  const existing = moduleWindows.get(moduleId);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.maximize();
    existing.show();
    existing.focus();
    return existing;
  }

  const conf = MODULE_CONFIGS[moduleId] || {
    title: moduleId,
    width: 1600,
    height: 960
  };

  const win = new BrowserWindow({
    width: conf.width,
    height: conf.height,
    minWidth: conf.minWidth || 900,
    minHeight: conf.minHeight || 600,
    title: conf.title, // 核心：严格为子模块中文名称，在凝思系统应用面板显示为'监控运行'、'图形编辑'等
    frame: true, // 凝思系统原生窗口标题栏与操作按键
    autoHideMenuBar: true,
    backgroundColor: '#080f1e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      nativeWindowOpen: true,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  crashMonitor.attachWindow(win);

  const showWin = () => {
    if (win && !win.isDestroyed() && !win.isVisible()) {
      // 用户明确要求：每个子模块打开时默认最大化！
      win.maximize();
      win.show();
      win.focus();
    }
  };

  win.once('ready-to-show', () => {
    setTimeout(showWin, 50);
  });

  // 保底：即使 ready-to-show 触发受阻，在 1500ms 后强制呼出窗口
  setTimeout(showWin, 1500);

  win.on('closed', () => {
    moduleWindows.delete(moduleId);
    // 即使挨个关闭所有子模块窗口，总管进程底栏也一直存在，绝不自动退出！
  });

  loadAppUrl(win, { module: moduleId });

  moduleWindows.set(moduleId, win);
  return win;
}

// ---------------- IPC Handlers for Windows & Linux ----------------
function setupIpcHandlers() {
  // 子模块独立多窗口 IPC 调度 (深瑞架构：不污染底栏，交由凝思桌面管理)
  ipcMain.handle('scada:open-module', (_event, moduleId: string) => {
    try {
      openModuleWindow(moduleId);
      return { success: true };
    } catch (err: any) {
      console.error(`[SCADA] Failed to open module ${moduleId}:`, err);
      return { success: false, error: err?.message };
    }
  });

  ipcMain.handle('scada:close-module', (_event, moduleId: string) => {
    const win = moduleWindows.get(moduleId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    return { success: true };
  });

  ipcMain.handle('scada:get-open-modules', () => {
    const openIds: string[] = [];
    moduleWindows.forEach((win, id) => {
      if (!win.isDestroyed()) openIds.push(id);
    });
    return openIds;
  });

  // 向上弹出/隐藏系统菜单窗口 (解决底层44px窗口无法向外展示溢出菜单的难题)
  ipcMain.handle('scada:toggle-start-menu', () => {
    if (!startMenuWindow || startMenuWindow.isDestroyed()) {
      createStartMenuWindow();
    }
    if (startMenuWindow.isVisible()) {
      startMenuWindow.hide();
    } else {
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { height: screenHeight } = primaryDisplay.bounds;
      const menuWidth = 240;
      const menuHeight = 410;
      const barHeight = 44;
      startMenuWindow.setBounds({
        x: 8,
        y: screenHeight - barHeight - menuHeight - 6,
        width: menuWidth,
        height: menuHeight
      });
      startMenuWindow.show();
      startMenuWindow.focus();
    }
    return { success: true };
  });

  ipcMain.handle('scada:close-start-menu', () => {
    if (startMenuWindow && !startMenuWindow.isDestroyed()) {
      startMenuWindow.hide();
    }
    return { success: true };
  });

  // 向上弹出/隐藏用户菜单窗口 (最上层显示，不被44px底栏截断)
  ipcMain.handle('scada:toggle-user-menu', () => {
    if (!userMenuWindow || userMenuWindow.isDestroyed()) {
      createUserMenuWindow();
    }
    if (userMenuWindow.isVisible()) {
      userMenuWindow.hide();
    } else {
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
      const menuWidth = 190;
      const menuHeight = 150;
      const barHeight = 44;
      userMenuWindow.setBounds({
        x: Math.max(10, screenWidth - menuWidth - 70),
        y: screenHeight - barHeight - menuHeight - 4,
        width: menuWidth,
        height: menuHeight
      });
      userMenuWindow.show();
      userMenuWindow.focus();
    }
    return { success: true };
  });

  ipcMain.handle('scada:close-user-menu', () => {
    if (userMenuWindow && !userMenuWindow.isDestroyed()) {
      userMenuWindow.hide();
    }
    return { success: true };
  });

  ipcMain.handle('scada:user-action', (_event, action: string) => {
    if (userMenuWindow && !userMenuWindow.isDestroyed()) {
      userMenuWindow.hide();
    }
    if (daemonBarWindow && !daemonBarWindow.isDestroyed()) {
      daemonBarWindow.webContents.send('scada:user-action', action);
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scada:user-action', action);
    }
    moduleWindows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('scada:user-action', action);
      }
    });
    return { success: true };
  });

  ipcMain.handle('scada:exit-app', () => {
    exitAllScadaProcesses();
  });

  // System Info
  ipcMain.handle('app:get-system-info', () => {
    return {
      isElectron: true,
      platform: process.platform, // 'win32' | 'linux' | 'darwin'
      arch: process.arch,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      appVersion: app.getVersion()
    };
  });

  // Native Save File Dialog
  ipcMain.handle('dialog:save-file', async (_event, payload: { data: string; defaultName?: string; filters?: any[] }) => {
    if (!mainWindow) return { success: false, error: 'No active window' };

    const { defaultName = 'scada-project.json', filters = [{ name: 'JSON Project', extensions: ['json'] }] } = payload;

    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出大屏工程文件',
      defaultPath: defaultName,
      filters
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    try {
      await fs.promises.writeFile(result.filePath, payload.data, 'utf-8');
      return { success: true, filePath: result.filePath };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to write file' };
    }
  });

  // Native Open File Dialog
  ipcMain.handle('dialog:open-file', async (_event, payload?: { filters?: any[] }) => {
    if (!mainWindow) return { success: false, error: 'No active window' };

    const { filters = [{ name: 'SCADA JSON Project', extensions: ['json', 'txt'] }] } = payload || {};

    const result = await dialog.showOpenDialog(mainWindow, {
      title: '打开大屏工程文件',
      properties: ['openFile'],
      filters
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    try {
      const filePath = result.filePaths[0];
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return { success: true, filePath, content };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to read file' };
    }
  });

  // Window Controls
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window:toggle-fullscreen', () => {
    if (mainWindow) {
      const isFull = mainWindow.isFullScreen();
      mainWindow.setFullScreen(!isFull);
      return !isFull;
    }
    return false;
  });

  // External shell opener
  ipcMain.handle('app:open-external', (_event, url: string) => {
    shell.openExternal(url);
  });

  // ---------------- SCADA Screen JSON Files Disk Storage IPC (graph/ 路径写死) ----------------
  const getScreensDir = () => {
    const execDir = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
    const dir = path.resolve(execDir, 'graph');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  };

  const getGraphConfigFile = () => {
    return path.join(getScreensDir(), '.graph_config.json');
  };

  const isValidScreenJson = (parsed: any, filename: string): boolean => {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    if (filename.startsWith('.')) return false;
    const hasScreen = parsed.screen && typeof parsed.screen === 'object';
    const hasComps = Array.isArray(parsed.components);
    if (!hasScreen && !hasComps) return false;
    if (hasScreen) {
      if (typeof parsed.screen.width === 'number' && (isNaN(parsed.screen.width) || parsed.screen.width <= 0)) return false;
      if (typeof parsed.screen.height === 'number' && (isNaN(parsed.screen.height) || parsed.screen.height <= 0)) return false;
    }
    const name = (parsed.name || parsed.screen?.name || filename.replace(/\.json$/i, '')).trim();
    if (!name) return false;
    return true;
  };

  ipcMain.handle('screens:get-config', () => {
    const dir = getScreensDir();
    let files: any[] = [];
    try {
      files = fs.readdirSync(dir)
        .filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'))
        .map(f => {
          const stat = fs.statSync(path.join(dir, f));
          let isValid = false;
          try {
            const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
            isValid = isValidScreenJson(JSON.parse(raw), f);
          } catch {}
          return {
            filename: f,
            screenName: f.replace(/\.json$/i, ''),
            sizeBytes: stat.size,
            updatedAt: stat.mtime.toISOString(),
            isValid
          };
        });
    } catch {}

    let indexScreen = { indexScreenName: '', indexScreenId: '' };
    try {
      const cfgPath = getGraphConfigFile();
      if (fs.existsSync(cfgPath)) {
        indexScreen = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      }
    } catch {}

    return {
      storageDir: 'graph',
      absolutePath: dir,
      fileCount: files.filter(f => f.isValid).length,
      files,
      indexScreen
    };
  });

  ipcMain.handle('screens:get-index-screen', () => {
    try {
      const cfgPath = getGraphConfigFile();
      if (fs.existsSync(cfgPath)) {
        return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      }
    } catch {}
    return { indexScreenName: '', indexScreenId: '' };
  });

  ipcMain.handle('screens:set-index-screen', (_event, payload: { indexScreenName: string; indexScreenId: string }) => {
    try {
      const cfgPath = getGraphConfigFile();
      fs.writeFileSync(cfgPath, JSON.stringify({
        indexScreenName: payload.indexScreenName || '',
        indexScreenId: payload.indexScreenId || '',
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf-8');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  });

  ipcMain.handle('screens:load-all', async () => {
    const dir = getScreensDir();
    const loadedScreens: any[] = [];
    const validFiles: string[] = [];
    try {
      const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
      for (const file of files) {
        try {
          const content = await fs.promises.readFile(path.join(dir, file), 'utf-8');
          const parsed = JSON.parse(content);
          if (!isValidScreenJson(parsed, file)) {
            continue;
          }
          const fallbackName = file.replace(/\.json$/i, '');
          const screenName = (parsed.name || parsed.screen?.name || fallbackName).trim();
          const screenId = parsed.id || parsed.screen?.id || `screen-${Date.now()}`;
          const screenConfig = parsed.screen || { id: screenId, name: screenName, width: 1920, height: 1080 };
          screenConfig.id = screenId;
          screenConfig.name = screenName;
          loadedScreens.push({
            id: screenId,
            name: screenName,
            description: parsed.description || '',
            screen: screenConfig,
            components: Array.isArray(parsed.components) ? parsed.components : []
          });
          validFiles.push(file);
        } catch {}
      }
    } catch {}

    // 确保 graph 下至少有一个合理的 JSON
    if (loadedScreens.length === 0) {
      const defaultScreen = {
        id: 'screen-10kv-main',
        name: '10kV配电室一次系统接线图',
        description: '系统默认保底标准大屏',
        version: '2.0.0',
        updatedAt: new Date().toISOString(),
        screen: {
          id: 'screen-10kv-main',
          name: '10kV配电室一次系统接线图',
          width: 1920,
          height: 1080,
          backgroundColor: '#040914',
          backgroundGrid: true,
          gridSize: 20,
          gridColor: 'rgba(0, 242, 255, 0.22)',
          theme: 'cyber-dark'
        },
        components: []
      };
      try {
        const p = path.join(dir, '10kV配电室一次系统接线图.json');
        await fs.promises.writeFile(p, JSON.stringify(defaultScreen, null, 2), 'utf-8');
        loadedScreens.push(defaultScreen);
        validFiles.push('10kV配电室一次系统接线图.json');
      } catch {}
    }

    return { success: true, screens: loadedScreens, storageDir: dir, count: loadedScreens.length, files: validFiles };
  });

  ipcMain.handle('screens:save-all', async (_event, screens: any) => {
    return { success: true, count: Array.isArray(screens) ? screens.length : 0 };
  });

  ipcMain.handle('screens:save-one', async (_event, payload: { screen?: any; screenJson?: string; oldName?: string }) => {
    try {
      const dir = getScreensDir();
      let s = payload?.screen;
      if (!s && payload?.screenJson) {
        try {
          s = JSON.parse(payload.screenJson);
        } catch (pe: any) {
          return { success: false, error: 'screenJson 解析失败: ' + pe.message };
        }
      } else if (typeof s === 'string') {
        try {
          s = JSON.parse(s);
        } catch (pe: any) {
          return { success: false, error: 'screen 字符串解析失败: ' + pe.message };
        }
      }

      if (!s || typeof s !== 'object') {
        return { success: false, error: '大屏数据格式无效' };
      }

      const rawName = s.name || s.screen?.name || '未命名大屏';
      const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_').trim();
      const newFname = `${safeName}.json`;

      if (payload.oldName && payload.oldName.trim() !== rawName.trim()) {
        const oldFname = `${payload.oldName.replace(/[\\/:*?"<>|]/g, '_').trim()}.json`;
        const oldPath = path.join(dir, oldFname);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch {}
        }
      }

      const data = {
        id: s.id || s.screen?.id || `screen-${Date.now()}`,
        name: rawName.trim(),
        description: s.description || '',
        version: s.screen?.version || '2.0.0',
        updatedAt: new Date().toISOString(),
        screen: s.screen || { id: s.id, name: rawName.trim(), width: 1920, height: 1080 },
        components: Array.isArray(s.components) ? s.components : []
      };

      await fs.promises.writeFile(path.join(dir, newFname), JSON.stringify(data, null, 2), 'utf-8');
      return { success: true, filename: newFname, storageDir: dir };
    } catch (err: any) {
      console.error('[Electron Main] 保存大屏发生异常:', err);
      return { success: false, error: err?.message || '写入大屏文件异常' };
    }
  });

  ipcMain.handle('screens:delete-one', async (_event, name: string) => {
    const dir = getScreensDir();
    const fname = `${(name || '').replace(/[\\/:*?"<>|]/g, '_').trim()}.json`;
    const fpath = path.join(dir, fname);
    if (fs.existsSync(fpath)) {
      try { fs.unlinkSync(fpath); return { success: true, filename: fname }; } catch {}
    }
    return { success: false, filename: fname };
  });

  ipcMain.handle('screens:open-dir', async () => {
    const dir = getScreensDir();
    try {
      await shell.openPath(dir);
      return { success: true, dir };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  });

  // ---------------- SCADA Base Config Disk Storage IPC (cfg/base.json 与 graph 同级) ----------------
  const getCfgDir = () => {
    const execDir = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
    const dir = path.resolve(execDir, 'cfg');
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    }
    return dir;
  };

  const getBaseConfigFile = () => {
    const cfgDir = getCfgDir();
    const baseFile = path.join(cfgDir, 'base.json');
    if (!fs.existsSync(baseFile)) {
      try {
        fs.writeFileSync(baseFile, JSON.stringify({
          SAFE_DATA_START: "2025-05-06",
          description: "GE-SCADA 现场基础运行配置文件 (支持工程师现场配置安全运行起始日期与站所基础参数)",
          station_name: "智能变电站"
        }, null, 2), 'utf-8');
      } catch (err) {
        console.warn('[Electron] 初始化 cfg/base.json 失败:', err);
      }
    }
    return baseFile;
  };

  // 凝思与桌面运行启动时，自动在磁盘 graph 同级目录下确保 cfg 目录与 base.json
  getBaseConfigFile();

  ipcMain.handle('cfg:get-base', () => {
    try {
      const baseFile = getBaseConfigFile();
      if (fs.existsSync(baseFile)) {
        const raw = fs.readFileSync(baseFile, 'utf-8');
        return { success: true, data: JSON.parse(raw) };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || '读取 base.json 失败' };
    }
    return { success: true, data: { SAFE_DATA_START: "2025-05-06" } };
  });

  ipcMain.handle('cfg:save-base', (_event: any, payload: any) => {
    try {
      const baseFile = getBaseConfigFile();
      let current: any = { SAFE_DATA_START: "2025-05-06" };
      if (fs.existsSync(baseFile)) {
        try { current = JSON.parse(fs.readFileSync(baseFile, 'utf-8')); } catch {}
      }
      const merged = { ...current, ...payload };
      fs.writeFileSync(baseFile, JSON.stringify(merged, null, 2), 'utf-8');
      return { success: true, data: merged };
    } catch (err: any) {
      return { success: false, error: err?.message || '写入 base.json 失败' };
    }
  });

  // ---------------- SCADA Template JSON Files Disk Storage IPC (model/ 目录) ----------------
  const getModelsDir = () => {
    const execDir = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
    const dir = path.resolve(execDir, 'model');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  };

  ipcMain.handle('models:load-all', async () => {
    const dir = getModelsDir();
    const models: any[] = [];
    const files: string[] = [];

    try {
      const list = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
      for (const filename of list) {
        const filePath = path.join(dir, filename);
        try {
          const raw = await fs.promises.readFile(filePath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            const name = (parsed.name || parsed.screen?.name || filename.replace(/\.json$/i, '')).trim();
            const id = parsed.id || `model-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            models.push({
              id,
              name,
              description: parsed.description || '',
              category: parsed.category || '自定义模板',
              tags: Array.isArray(parsed.tags) ? parsed.tags : ['自定义模板'],
              version: parsed.version || '2.0.0',
              updatedAt: parsed.updatedAt || new Date().toISOString(),
              filename,
              screen: parsed.screen || {
                id: `screen-${id}`,
                name,
                width: 1920,
                height: 1080,
                backgroundColor: '#040914'
              },
              components: Array.isArray(parsed.components) ? parsed.components : [],
              datasets: Array.isArray(parsed.datasets) ? parsed.datasets : []
            });
            files.push(filename);
          }
        } catch (e) {
          console.warn(`[Electron Main] 解析模板文件失败: ${filename}`, e);
        }
      }
    } catch (err) {
      console.error('[Electron Main] 读取 model 目录失败:', err);
    }

    return {
      success: true,
      models,
      storageDir: dir,
      count: models.length,
      files
    };
  });

  ipcMain.handle('models:save-one', async (_event, payload: any) => {
    try {
      const dir = getModelsDir();
      const name = (payload?.name || '').trim();
      if (!name) {
        return { success: false, error: '模板名称不能为空' };
      }

      const safeName = name.replace(/[\\/:*?"<>|]/g, '_').trim();
      const filename = `${safeName}.json`;
      const filePath = path.join(dir, filename);

      const modelToSave = {
        id: payload.id || `model-${Date.now()}`,
        name,
        description: payload.description || '自定义模板',
        category: payload.category || '自定义模板',
        tags: Array.isArray(payload.tags) && payload.tags.length > 0 ? payload.tags : ['自定义模板'],
        version: payload.version || '2.0.0',
        updatedAt: new Date().toISOString(),
        filename,
        screen: {
          ...(payload.screen || {}),
          name
        },
        components: Array.isArray(payload.components) ? payload.components : [],
        datasets: Array.isArray(payload.datasets) ? payload.datasets : []
      };

      await fs.promises.writeFile(filePath, JSON.stringify(modelToSave, null, 2), 'utf-8');
      return { success: true, filename, name, model: modelToSave };
    } catch (err: any) {
      console.error('[Electron Main] 保存模板失败:', err);
      return { success: false, error: err?.message || '保存模板异常' };
    }
  });

  ipcMain.handle('models:delete-one', async (_event, name: string) => {
    try {
      const dir = getModelsDir();
      const safeName = (name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
      const filename = `${safeName}.json`;
      const filePath = path.join(dir, filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return { success: true, filename };
      }
      return { success: false, error: `未找到模板文件: ${filename}` };
    } catch (err: any) {
      return { success: false, error: err?.message || '删除模板异常' };
    }
  });

  // ---------------- SCADA Custom Cells JSON Files Disk Storage IPC (cell/ 目录) ----------------
  const getCellsDir = () => {
    const execDir = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
    const dir = path.resolve(execDir, 'cell');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  };

  ipcMain.handle('cells:load-all', async () => {
    const dir = getCellsDir();
    const cells: any[] = [];
    const files: string[] = [];

    try {
      const list = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
      for (const filename of list) {
        const fullPath = path.join(dir, filename);
        try {
          const content = await fs.promises.readFile(fullPath, 'utf-8');
          const parsed = JSON.parse(content);
          if (parsed && (parsed.id || parsed.name)) {
            parsed.filename = filename;
            cells.push(parsed);
            files.push(filename);
          }
        } catch (e: any) {
          console.warn(`[Electron Main] 读取图元文件失败: ${filename}`, e.message);
        }
      }
    } catch (err: any) {
      console.error('[Electron Main] 读取 cell 目录失败:', err);
    }

    return {
      success: true,
      cells,
      storageDir: dir,
      count: cells.length,
      files
    };
  });

  ipcMain.handle('cells:save-one', async (_event, cellData: any) => {
    try {
      const dir = getCellsDir();
      if (!cellData || !cellData.name) {
        return { success: false, error: '图元名称不能为空' };
      }

      const rawName = String(cellData.name).trim();
      const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_').trim();
      const filename = `${safeName}.json`;
      const fullPath = path.join(dir, filename);

      const payloadToSave = {
        ...cellData,
        id: cellData.id || `cell-${Date.now()}`,
        name: rawName,
        filename,
        updatedAt: new Date().toISOString()
      };

      await fs.promises.writeFile(fullPath, JSON.stringify(payloadToSave, null, 2), 'utf-8');
      return { success: true, filename, cell: payloadToSave };
    } catch (err: any) {
      console.error('[Electron Main] 保存图元失败:', err);
      return { success: false, error: err?.message || '保存图元失败' };
    }
  });

  ipcMain.handle('cells:delete-one', async (_event, cellIdentifier: string) => {
    try {
      const dir = getCellsDir();
      if (!cellIdentifier) {
        return { success: false, error: '未指定图元名称或ID' };
      }
      if (!fs.existsSync(dir)) {
        return { success: true };
      }

      const trimmed = String(cellIdentifier).trim();
      const raw = trimmed.replace(/\.json$/i, '');
      const safeName = raw.replace(/[\\/:*?"<>|]/g, '_').trim();

      // 1. 尝试直接文件名匹配
      const candidateFilenames = [
        trimmed,
        trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`,
        `${safeName}.json`
      ];

      for (const fn of candidateFilenames) {
        const fullPath = path.join(dir, fn);
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
          return { success: true, filename: fn };
        }
      }

      // 2. 遍历匹配 JSON 内部结构
      const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
      for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
          const content = await fs.promises.readFile(fullPath, 'utf-8');
          const parsed = JSON.parse(content);
          const nameWithoutExt = file.replace(/\.json$/i, '').trim();
          if (
            parsed.id === trimmed ||
            parsed.name === trimmed ||
            parsed.filename === trimmed ||
            nameWithoutExt === trimmed ||
            nameWithoutExt.toLowerCase() === trimmed.toLowerCase()
          ) {
            await fs.promises.unlink(fullPath);
            return { success: true, filename: file };
          }
        } catch {}
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || '删除图元失败' };
    }
  });

  // ---------------- SCADA Dynamic Datasets & Tag Tables JSON Disk Storage IPC (data/ 目录) ----------------
  const getDataDir = () => {
    const execDir = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
    const dir = path.resolve(execDir, 'data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  };

  ipcMain.handle('data:load-all', async () => {
    const dir = getDataDir();
    const datasets: any[] = [];
    const files: string[] = [];

    try {
      const list = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
      for (const filename of list) {
        const fullPath = path.join(dir, filename);
        try {
          const content = await fs.promises.readFile(fullPath, 'utf-8');
          const parsed = JSON.parse(content);
          if (parsed && (parsed.id || parsed.name || Array.isArray(parsed.devices))) {
            parsed.filename = filename;
            datasets.push(parsed);
            files.push(filename);
          }
        } catch (e: any) {
          console.warn(`[Electron Main] 解析数据集文件 ${filename} 失败:`, e.message);
        }
      }

      return {
        success: true,
        datasets,
        files,
        storageDir: dir
      };
    } catch (err: any) {
      return { success: false, datasets: [], files: [], error: err?.message || '读取 data 目录异常' };
    }
  });

  ipcMain.handle('data:save-one', async (_event, datasetData: any) => {
    try {
      const dir = getDataDir();
      if (!datasetData || typeof datasetData !== 'object') {
        return { success: false, error: '数据集数据无效' };
      }
      const rawName = (datasetData.name || datasetData.id || '数据集').trim();
      const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_').trim();
      const filename = `${safeName}.json`;
      const fullPath = path.join(dir, filename);

      const datasetToSave = {
        ...datasetData,
        filename,
        updatedAt: new Date().toISOString()
      };

      await fs.promises.writeFile(fullPath, JSON.stringify(datasetToSave, null, 2), 'utf-8');
      return { success: true, filename, dataset: datasetToSave };
    } catch (err: any) {
      return { success: false, error: err?.message || '保存数据集文件异常' };
    }
  });

  ipcMain.handle('data:delete-one', async (_event, identifier: string) => {
    try {
      const dir = getDataDir();
      if (!identifier) {
        return { success: false, error: '未指定数据集标识' };
      }
      if (!fs.existsSync(dir)) return { success: true };

      const trimmed = String(identifier).trim();
      const safeName = trimmed.replace(/\.json$/i, '').replace(/[\\/:*?"<>|]/g, '_').trim();

      const candidateFilenames = [
        trimmed,
        trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`,
        `${safeName}.json`
      ];

      for (const fn of candidateFilenames) {
        const fullPath = path.join(dir, fn);
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
          return { success: true, filename: fn };
        }
      }

      const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('.'));
      for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
          const content = await fs.promises.readFile(fullPath, 'utf-8');
          const parsed = JSON.parse(content);
          const nameWithoutExt = file.replace(/\.json$/i, '').trim();
          if (
            parsed.id === trimmed ||
            parsed.name === trimmed ||
            nameWithoutExt === trimmed ||
            nameWithoutExt.toLowerCase() === trimmed.toLowerCase()
          ) {
            await fs.promises.unlink(fullPath);
            return { success: true, filename: file };
          }
        } catch {}
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || '删除数据集失败' };
    }
  });

  // ---------------- SCADA Global Config JSON File Storage IPC (data/scada_config.json) ----------------
  const getScadaConfigFilePath = () => {
    const dir = getDataDir();
    return path.join(dir, 'scada_config.json');
  };

  ipcMain.handle('scada:get-config-file', async () => {
    try {
      const p = getScadaConfigFilePath();
      if (fs.existsSync(p)) {
        const content = await fs.promises.readFile(p, 'utf-8');
        return { success: true, data: JSON.parse(content), path: p };
      }
      return { success: false, message: 'scada_config.json not found' };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  });

  ipcMain.handle('scada:save-config-file', async (_event, payload: any) => {
    try {
      const p = getScadaConfigFilePath();
      let raw = '';
      if (typeof payload === 'string') {
        raw = payload;
      } else if (payload && payload.data) {
        raw = typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data, null, 2);
      } else {
        raw = JSON.stringify(payload, null, 2);
      }
      await fs.promises.writeFile(p, raw, 'utf-8');
      return { success: true, path: p };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  });

  // ================= UDS (Unix Domain Socket / Named Pipe) IPC with C++ Program A =================
  const getUdsSocketPath = () => {
    if (process.platform === 'win32') {
      return process.env.SCADA_NAMED_PIPE || '\\\\.\\pipe\\scada_service_a';
    }
    return process.env.SCADA_UDS_SOCK || '/tmp/scada_service_a.sock';
  };

  // Helper function to send one-off request to C++ Program A via UDS
  const sendUdsRequest = (action: string, payload: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      const socketPath = getUdsSocketPath();
      const client = net.createConnection({ path: socketPath }, () => {
        const msg = JSON.stringify({ action, ...payload, timestamp: Date.now() }) + '\n';
        client.write(msg);
      });

      let buffer = '';
      client.on('data', (data) => {
        buffer += data.toString();
        if (buffer.includes('\n')) {
          const lines = buffer.split('\n');
          try {
            const parsed = JSON.parse(lines[0]);
            client.end();
            resolve(parsed);
          } catch (e) {
            client.end();
            resolve({ raw: lines[0] });
          }
        }
      });

      client.on('error', (err) => {
        // Program A is not running or socket does not exist -> reject to let fallback activate
        reject(err);
      });

      client.setTimeout(2500, () => {
        client.destroy();
        reject(new Error('UDS socket request timeout'));
      });
    });
  };

  // 1. 触发获取装置点表信息 (Get Devices & Points via UDS)
  ipcMain.handle('uds:get-devices', async (_event, options) => {
    try {
      const res = await sendUdsRequest('get_devices', options);
      return { success: true, source: 'native_uds', data: res.devices || res.data || res };
    } catch (err: any) {
      // Fallback if C++ program A is offline
      return { 
        success: true, 
        source: 'fallback', 
        error: err.message,
        data: null 
      };
    }
  });

  // 2. 触发获取实时数据 (Trigger Realtime Data via UDS)
  ipcMain.handle('uds:get-realtime', async (_event, options) => {
    try {
      const res = await sendUdsRequest('get_realtime', options);
      return { success: true, source: 'native_uds', data: res.telemetries || res.data || res };
    } catch (err: any) {
      return { 
        success: true, 
        source: 'fallback', 
        error: err.message,
        data: null 
      };
    }
  });

  // 3. 触发获取测点历史数据 (Trigger History Data via UDS)
  ipcMain.handle('uds:get-history', async (_event, payload) => {
    try {
      const res = await sendUdsRequest('get_history', payload);
      return { success: true, source: 'native_uds', data: res.points || res.data || res };
    } catch (err: any) {
      return { 
        success: true, 
        source: 'fallback', 
        error: err.message,
        data: null 
      };
    }
  });

  // 4. 开启/关闭 告警流 (Alarm Stream)
  let alarmStreamClient: net.Socket | null = null;
  ipcMain.handle('uds:start-alarm-stream', async () => {
    if (alarmStreamClient) {
      return { success: true, message: 'Alarm stream already running' };
    }

    const socketPath = getUdsSocketPath();
    try {
      alarmStreamClient = net.createConnection({ path: socketPath }, () => {
        alarmStreamClient?.write(JSON.stringify({ action: 'subscribe_alarms' }) + '\n');
      });

      let buf = '';
      alarmStreamClient.on('data', (chunk) => {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const alarmEvent = JSON.parse(line);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('uds:alarm-event', alarmEvent);
            }
          } catch {}
        }
      });

      alarmStreamClient.on('error', () => {
        alarmStreamClient = null;
      });

      alarmStreamClient.on('close', () => {
        alarmStreamClient = null;
      });

      return { success: true, source: 'native_uds' };
    } catch (err: any) {
      alarmStreamClient = null;
      return { success: false, error: err?.message };
    }
  });

  ipcMain.handle('uds:stop-alarm-stream', async () => {
    if (alarmStreamClient) {
      try {
        alarmStreamClient.write(JSON.stringify({ action: 'unsubscribe_alarms' }) + '\n');
        alarmStreamClient.destroy();
      } catch {}
      alarmStreamClient = null;
    }
    return { success: true };
  });

  // ---------------- 工业常亮防熄屏电源管理 IPC ----------------
  ipcMain.handle('power:get-stay-awake', () => {
    return {
      success: true,
      stayAwake: powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId),
      blockerId: powerBlockerId,
      platform: process.platform,
      isLinxLinux: process.platform === 'linux'
    };
  });

  ipcMain.handle('power:set-stay-awake', (_event, enabled: boolean) => {
    if (enabled) {
      enableIndustrialStayAwake();
    } else {
      if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
        try {
          powerSaveBlocker.stop(powerBlockerId);
        } catch {}
        powerBlockerId = null;
      }
    }
    return {
      success: true,
      stayAwake: powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)
    };
  });

  // ---------------- 工业黑匣子与重启崩溃诊断 IPC ----------------
  ipcMain.handle('diagnostics:get-status', () => {
    return {
      success: true,
      data: crashMonitor.getDiagnosticData()
    };
  });

  ipcMain.handle('diagnostics:open-logs-dir', async () => {
    const dir = crashMonitor.getLogsDirectoryPath();
    try {
      await shell.openPath(dir);
      return { success: true, dir };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  });

  ipcMain.handle('diagnostics:read-report', async () => {
    try {
      const p = path.join(crashMonitor.getLogsDirectoryPath(), 'reboot_diagnosis_report.txt');
      if (fs.existsSync(p)) {
        const content = await fs.promises.readFile(p, 'utf-8');
        return { success: true, content };
      }
      return { success: false, message: '诊断报告尚未生成' };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  });
}

// App lifecycle with Single Instance Lock for Windows & Linux
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (daemonBarWindow && !daemonBarWindow.isDestroyed()) {
      daemonBarWindow.show();
      daemonBarWindow.focus();
    }
  });

  app.whenReady().then(() => {
    crashMonitor.init(() => daemonBarWindow);
    enableIndustrialStayAwake();
    setupIpcHandlers();
    
    // 1. 创建常驻系统底部的“总管底栏进程” (深瑞模式：常驻桌面底部，不遮挡凝思桌面，没有多余大窗口)
    createDaemonBarWindow();

    // 2. 默认拉起“监控运行”子模块独立窗口
    setTimeout(() => {
      openModuleWindow('monitor-screen');
    }, 450);

    app.on('activate', () => {
      if (!daemonBarWindow || daemonBarWindow.isDestroyed()) {
        createDaemonBarWindow();
      }
    });
  });

  app.on('before-quit', () => {
    crashMonitor.markCleanExit();
  });

  app.on('window-all-closed', () => {
    // 关键：即使挨个关闭所有子模块窗口，只要总管进程底栏还在，就绝不退出！
    if (!daemonBarWindow || daemonBarWindow.isDestroyed()) {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    }
  });
}

