export interface ElectronSystemInfo {
  isElectron: boolean;
  platform: 'win32' | 'linux' | 'darwin' | string;
  arch: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  appVersion: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  getSystemInfo: () => Promise<ElectronSystemInfo>;
  saveFile: (payload: { data: string; defaultName?: string; filters?: any[] }) => Promise<{
    success: boolean;
    filePath?: string;
    canceled?: boolean;
    error?: string;
  }>;
  openFile: (payload?: { filters?: any[] }) => Promise<{
    success: boolean;
    filePath?: string;
    content?: string;
    canceled?: boolean;
    error?: string;
  }>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  close: () => Promise<void>;
  toggleFullscreen: () => Promise<boolean>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

declare module 'electron' {
  export const app: any;
  export const BrowserWindow: any;
  export const ipcMain: any;
  export const ipcRenderer: any;
  export const dialog: any;
  export const shell: any;
  export const Menu: any;
  export const contextBridge: any;
}
