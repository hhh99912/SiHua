var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
if (process.platform === "linux") {
  import_electron.app.commandLine.appendSwitch("no-sandbox");
  import_electron.app.commandLine.appendSwitch("disable-gpu-sandbox");
  import_electron.app.commandLine.appendSwitch("disable-dev-shm-usage");
  import_electron.app.commandLine.appendSwitch("disable-gpu-process-crash-limit");
}
var mainWindow = null;
var isDev = process.env.NODE_ENV === "development" || !import_electron.app.isPackaged;
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#040810",
    title: "SCADA \u5DE5\u4E1A\u7EC4\u6001\u5927\u5C4F\u5DE5\u4F5C\u53F0",
    frame: true,
    // Native window frame for cross-platform compatibility
    autoHideMenuBar: true,
    show: false,
    // Show once ready to avoid white flash
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false
    }
  });
  import_electron.Menu.setApplicationMenu(null);
  mainWindow.once("ready-to-show", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:3000";
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = import_path.default.join(__dirname, "../dist/index.html");
    if (import_fs.default.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      mainWindow.loadURL(devUrl);
    }
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      import_electron.shell.openExternal(url);
    }
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function setupIpcHandlers() {
  import_electron.ipcMain.handle("app:get-system-info", () => {
    return {
      isElectron: true,
      platform: process.platform,
      // 'win32' | 'linux' | 'darwin'
      arch: process.arch,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      appVersion: import_electron.app.getVersion()
    };
  });
  import_electron.ipcMain.handle("dialog:save-file", async (_event, payload) => {
    if (!mainWindow) return { success: false, error: "No active window" };
    const { defaultName = "scada-project.json", filters = [{ name: "JSON Project", extensions: ["json"] }] } = payload;
    const result = await import_electron.dialog.showSaveDialog(mainWindow, {
      title: "\u5BFC\u51FA\u5927\u5C4F\u5DE5\u7A0B\u6587\u4EF6",
      defaultPath: defaultName,
      filters
    });
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }
    try {
      await import_fs.default.promises.writeFile(result.filePath, payload.data, "utf-8");
      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: err?.message || "Failed to write file" };
    }
  });
  import_electron.ipcMain.handle("dialog:open-file", async (_event, payload) => {
    if (!mainWindow) return { success: false, error: "No active window" };
    const { filters = [{ name: "SCADA JSON Project", extensions: ["json", "txt"] }] } = payload || {};
    const result = await import_electron.dialog.showOpenDialog(mainWindow, {
      title: "\u6253\u5F00\u5927\u5C4F\u5DE5\u7A0B\u6587\u4EF6",
      properties: ["openFile"],
      filters
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    try {
      const filePath = result.filePaths[0];
      const content = await import_fs.default.promises.readFile(filePath, "utf-8");
      return { success: true, filePath, content };
    } catch (err) {
      return { success: false, error: err?.message || "Failed to read file" };
    }
  });
  import_electron.ipcMain.handle("window:minimize", () => {
    if (mainWindow) mainWindow.minimize();
  });
  import_electron.ipcMain.handle("window:maximize", () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });
  import_electron.ipcMain.handle("window:is-maximized", () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });
  import_electron.ipcMain.handle("window:close", () => {
    if (mainWindow) mainWindow.close();
  });
  import_electron.ipcMain.handle("window:toggle-fullscreen", () => {
    if (mainWindow) {
      const isFull = mainWindow.isFullScreen();
      mainWindow.setFullScreen(!isFull);
      return !isFull;
    }
    return false;
  });
  import_electron.ipcMain.handle("app:open-external", (_event, url) => {
    import_electron.shell.openExternal(url);
  });
}
var gotTheLock = import_electron.app.requestSingleInstanceLock();
if (!gotTheLock) {
  import_electron.app.quit();
} else {
  import_electron.app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  import_electron.app.whenReady().then(() => {
    setupIpcHandlers();
    createWindow();
    import_electron.app.on("activate", () => {
      if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  import_electron.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      import_electron.app.quit();
    }
  });
}
