import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'path';
import fs from 'fs';

// Linux & 老工控机/凝思系统稳定性兼容参数
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage'); // 关键：解决共享内存不足导致的渲染器崩溃
  app.commandLine.appendSwitch('disable-gpu-process-crash-limit');
  
  // 字体清晰度与色彩配置文件
  app.commandLine.appendSwitch('enable-font-antialiasing');
  app.commandLine.appendSwitch('font-render-hinting', 'medium');
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
  app.commandLine.appendSwitch('high-dpi-support', '1');
  app.commandLine.appendSwitch('force-color-profile', 'srgb');

  // 关键优化：解决凝思系统 SwiftShader 软件渲染下的 Passthrough 报错，并启用校验解码器提升平移/旋转帧率
  app.commandLine.appendSwitch('use-cmd-decoder', 'validating');

  // 如果遇到显卡驱动不支持（如 ANGLE/Mesa 0x0500 报错），允许通过 --disable-gpu 或环境变量强制纯软件渲染
  if (process.argv.includes('--disable-gpu') || process.env.SCADA_DISABLE_GPU === '1') {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-gpu-rasterization');
  }
}

// 全平台防后台挂起/休眠节流优化：彻底解决窗口最小化或后台运行时被 Chromium 挂起、重新放大时界面假死卡顿的问题
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#040810',
    title: 'SCADA 工业组态大屏工作台',
    frame: true, // Native window frame for cross-platform compatibility
    autoHideMenuBar: true,
    show: false, // Show once ready to avoid white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      nativeWindowOpen: true, // 消除 Electron 15 废弃警告
      backgroundThrottling: false // 关键：彻底禁用后台休眠与定时器节流，保持 60FPS 活跃状态，最小化还原无卡死
    }
  });

  // Remove default menu for clean SCADA workstation feel
  Menu.setApplicationMenu(null);

  // Ready to show
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

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

// ---------------- IPC Handlers for Windows & Linux ----------------
function setupIpcHandlers() {
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
}

// App lifecycle with Single Instance Lock for Windows & Linux
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    setupIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
