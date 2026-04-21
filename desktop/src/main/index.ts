import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const configPath = join(app.getPath('userData'), 'wxqr-config.json')

ipcMain.handle('save-image', async (_, dataUrl: string, filename: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }],
  })
  if (canceled || !filePath) return { success: false }
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  try {
    writeFileSync(filePath, Buffer.from(base64, 'base64'))
    return { success: true, path: filePath }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('get-config', () => {
  if (existsSync(configPath)) {
    try { return JSON.parse(readFileSync(configPath, 'utf-8')) } catch { /* ignore */ }
  }
  return { apiUrl: '' }
})

ipcMain.handle('set-config', (_, config: { apiUrl: string }) => {
  writeFileSync(configPath, JSON.stringify(config))
})

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
