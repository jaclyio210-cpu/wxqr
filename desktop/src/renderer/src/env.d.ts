/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    saveImage: (dataUrl: string, filename: string) => Promise<{ success: boolean; path?: string }>
    getConfig: () => Promise<{ apiUrl: string }>
    setConfig: (config: { apiUrl: string }) => Promise<void>
  }
}
