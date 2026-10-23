import { app, BrowserWindow, Menu, Notification, ipcMain, powerSaveBlocker, shell, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import { SLOT_COUNT, type PanelCommand, type UpdateAction, type LayoutConfig, type SlotConfig, type SlotRects } from '@shared/types'
import { flushConfig, loadConfig, saveConfig, sanitizeConfig, type StoredFile } from './config'
import { SlotManager } from './slots'
import { Updater } from './updater'

const APP_NAME = 'PokeIdle Panel'

app.setName(APP_NAME)
app.setPath('userData', process.env.POKEIDLE_PANEL_DATA ?? join(app.getPath('appData'), 'pokeidle-panel'))

let store: StoredFile
let win: BrowserWindow
let slots: SlotManager
let updater: Updater

function persist(): void {
  store = sanitizeConfig(store)
  saveConfig(store)
}

function send(channel: string, ...args: unknown[]): void {
  if (!win.isDestroyed()) win.webContents.send(channel, ...args)
}

function command(cmd: PanelCommand): void {
  send('panel:command', cmd)
}

const activeNotifications = new Set<Notification>()

function alert(slot: number, body: string): void {
  if (!store.panel.prefs.notifications || !Notification.isSupported()) return
  const n = new Notification({ title: APP_NAME, body })
  activeNotifications.add(n)
  n.on('click', () => {
    if (win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    command({ type: 'focus', slot })
  })
  n.on('close', () => activeNotifications.delete(n))
  n.show()
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const focusItems: MenuItemConstructorOptions[] = Array.from({ length: SLOT_COUNT }, (_, i) => ({
    label: `Focus Trainer ${i + 1}`,
    accelerator: `CmdOrCtrl+${i + 1}`,
    click: () => command({ type: 'focus', slot: i })
  }))
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'Panel',
      submenu: [
        { label: 'Show all (grid)', accelerator: 'CmdOrCtrl+0', click: () => command({ type: 'grid' }) },
        ...focusItems,
        { type: 'separator' },
        {
          label: 'Auto-recover stuck accounts',
          type: 'checkbox',
          checked: store.panel.prefs.autoReload,
          click: (item) => {
            store.panel.prefs.autoReload = item.checked
            persist()
          }
        },
        {
          label: 'Desktop notifications',
          type: 'checkbox',
          checked: store.panel.prefs.notifications,
          click: (item) => {
            store.panel.prefs.notifications = item.checked
            persist()
          }
        }
      ]
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: 'Check for updates…', click: () => void updater.check(true) }]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const w = store.window
  win = new BrowserWindow({
    width: w.width,
    height: w.height,
    x: w.x,
    y: w.y,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: '#12141d',
    ...(app.isPackaged ? {} : { icon: join(__dirname, '../../build/icon.png') }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })
  if (w.maximized) win.maximize()

  slots = new SlotManager(win, () => store.panel, {
    status: (id, status, since) => send('panel:status', id, status, since),
    alert
  })

  const saveBounds = (): void => {
    if (win.isDestroyed()) return
    store.window.maximized = win.isMaximized()
    if (!win.isMaximized() && !win.isMinimized()) {
      const b = win.getBounds()
      store.window = { ...store.window, ...b }
    }
    saveConfig(store)
  }
  win.on('resize', saveBounds)
  win.on('move', saveBounds)
  win.on('close', () => {
    saveBounds()
    flushConfig()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))

  win.webContents.once('did-finish-load', () => void slots.sync())
}

function registerIpc(): void {
  ipcMain.handle('panel:get-state', () => ({
    config: store.panel,
    statuses: slots.getStatuses(),
    since: slots.getSince(),
    version: app.getVersion(),
    update: updater.getState()
  }))
  ipcMain.on('panel:update-action', (_e, action: UpdateAction) => {
    if (action === 'check') void updater.check(true)
    else if (action === 'install') updater.install()
    else if (action === 'download') updater.openDownload()
  })

  ipcMain.handle('panel:update-slot', async (_e, id: number, patch: Partial<SlotConfig>) => {
    if (!Number.isInteger(id) || id < 0 || id >= SLOT_COUNT) return
    const { id: _ignored, ...allowed } = patch
    store.panel.slots[id] = { ...store.panel.slots[id], ...allowed }
    persist()
    await slots.sync()
  })

  ipcMain.handle('panel:set-layout', (_e, layout: LayoutConfig) => {
    store.panel.layout = layout
    persist()
  })

  ipcMain.on('panel:rects', (_e, rects: SlotRects) => slots.setRects(rects))
  ipcMain.on('panel:suspend', (_e, suspended: boolean) => slots.setSuspended(!!suspended))
  ipcMain.on('panel:reload', (_e, id: number) => slots.reload(id))
  ipcMain.handle('panel:clear', (_e, id: number) => slots.clear(id))
}

app.on('login', (event, webContents, _details, authInfo, callback) => {
  if (!authInfo.isProxy) return
  const creds = slots?.credentialsFor(webContents?.session)
  if (!creds) return
  event.preventDefault()
  callback(creds.username, creds.password)
})

app.whenReady().then(() => {
  store = loadConfig()
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(join(__dirname, '../../build/icon.png'))
  powerSaveBlocker.start('prevent-app-suspension')
  buildMenu()
  createWindow()
  updater = new Updater((state) => send('panel:update-state', state))
  updater.start()
  registerIpc()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      void slots.sync()
    }
  })
})

app.on('window-all-closed', () => {
  slots?.destroyAll()
  app.quit()
})
