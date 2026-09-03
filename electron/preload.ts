import { contextBridge, ipcRenderer } from 'electron';

// Expose safe, strongly typed Electron APIs to Vue renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getSystemInfo: () => ipcRenderer.invoke('app:get-system-info'),
  saveFile: (payload: { data: string; defaultName?: string; filters?: any[] }) => 
    ipcRenderer.invoke('dialog:save-file', payload),
  openFile: (payload?: { filters?: any[] }) => 
    ipcRenderer.invoke('dialog:open-file', payload),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  close: () => ipcRenderer.invoke('window:close'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url)
});
