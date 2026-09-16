import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc/register'
import { markCleanExit } from './recovery/session'
import { createMainWindow } from './windows'

process.env.APP_ROOT = join(__dirname, '../..')

if (process.platform === 'win32') {
  app.setAppUserModelId('org.studypdf.app')
}

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})

app.whenReady().then(() => {
  registerIpc()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

let quitting = false

app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  void markCleanExit().finally(() => {
    app.quit()
  })
})
