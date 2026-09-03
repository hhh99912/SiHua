// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  getSystemInfo: () => import_electron.ipcRenderer.invoke("app:get-system-info"),
  saveFile: (payload) => import_electron.ipcRenderer.invoke("dialog:save-file", payload),
  openFile: (payload) => import_electron.ipcRenderer.invoke("dialog:open-file", payload),
  minimize: () => import_electron.ipcRenderer.invoke("window:minimize"),
  maximize: () => import_electron.ipcRenderer.invoke("window:maximize"),
  isMaximized: () => import_electron.ipcRenderer.invoke("window:is-maximized"),
  close: () => import_electron.ipcRenderer.invoke("window:close"),
  toggleFullscreen: () => import_electron.ipcRenderer.invoke("window:toggle-fullscreen"),
  openExternal: (url) => import_electron.ipcRenderer.invoke("app:open-external", url)
});
