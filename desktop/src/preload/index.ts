import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  saveImage: (dataUrl: string, filename: string): Promise<{ success: boolean; path?: string }> =>
    ipcRenderer.invoke('save-image', dataUrl, filename),
  getConfig: (): Promise<{ apiUrl: string }> =>
    ipcRenderer.invoke('get-config'),
  setConfig: (config: { apiUrl: string }): Promise<void> =>
    ipcRenderer.invoke('set-config', config),
})
