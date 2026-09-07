import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import net from 'net';

// Linux & 老工控机/凝思系统稳定性兼容参数
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage'); // 关键：解决共享内存不足导致的渲染器崩溃
  app.commandLine.appendSwitch('disable-gpu-process-crash-limit');
  
  // 字体清晰度与色彩配置文件 (凝思系统/Linux LCD 亚像素高清渲染核心优化)
  app.commandLine.appendSwitch('enable-font-antialiasing');
  app.commandLine.appendSwitch('enable-lcd-text'); // 开启 LCD RGB 次像素文字渲染，杜绝灰度抗锯齿导致的字体模糊发虚
  app.commandLine.appendSwitch('font-render-hinting', process.env.SCADA_FONT_HINTING || 'slight'); // Linux CJK 字体最优微调模式
  app.commandLine.appendSwitch('force-device-scale-factor', process.env.SCADA_SCALE_FACTOR || '1');
  app.commandLine.appendSwitch('high-dpi-support', '1');
  app.commandLine.appendSwitch('force-color-profile', 'srgb');

  // 图像与 2D Canvas 矢量硬加速优化
  app.commandLine.appendSwitch('enable-features', 'Accelerated2dCanvas,OverlayScrollbar,CanvasOopRasterization');

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
