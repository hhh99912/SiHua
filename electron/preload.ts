import { contextBridge, ipcRenderer } from 'electron';

// Safe sanitization helper for structured cloning across context bridge / IPC
// Strips Vue 3 reactive Proxies, internal symbols (__v_raw, etc.), DOM nodes, and non-cloneables
const safePojo = (obj: any) => {
  if (obj === undefined || obj === null) return obj;
  if (typeof obj !== 'object') return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
};

// Expose safe, strongly typed Electron APIs to Vue renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getSystemInfo: () => ipcRenderer.invoke('app:get-system-info'),
  saveFile: (payload: { data: string; defaultName?: string; filters?: any[] }) => 
    ipcRenderer.invoke('dialog:save-file', safePojo(payload)),
  openFile: (payload?: { filters?: any[] }) => 
    ipcRenderer.invoke('dialog:open-file', safePojo(payload)),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  close: () => ipcRenderer.invoke('window:close'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  screens: {
    loadAll: () => ipcRenderer.invoke('screens:load-all'),
    saveAll: (screens: any) => ipcRenderer.invoke('screens:save-all', safePojo(screens)),
    saveOne: (payload: { screen?: any; screenJson?: string; oldName?: string }) => 
      ipcRenderer.invoke('screens:save-one', safePojo(payload)),
    deleteOne: (name: string) => ipcRenderer.invoke('screens:delete-one', String(name)),
    getConfig: () => ipcRenderer.invoke('screens:get-config'),
    getIndexScreen: () => ipcRenderer.invoke('screens:get-index-screen'),
    setIndexScreen: (payload: { indexScreenName: string; indexScreenId: string }) => 
      ipcRenderer.invoke('screens:set-index-screen', safePojo(payload)),
    openDir: () => ipcRenderer.invoke('screens:open-dir')
  }
});
