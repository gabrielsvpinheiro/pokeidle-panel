import { app, BrowserWindow, ClipboardItem, Menu, Notification, clipboard, ipcMain, powerMonitor, powerSaveBlocker, shell, type MenuItemConstructorOptions } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { ECO_INTERVALS, SLOT_COUNT, ZOOM_STEP, type EcoState, type PanelCommand, type PanelPrefs, type UpdateAction, type LayoutConfig, type SlotConfig, type SlotRects } from '@shared/types'
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

const screenshotDir = (): string => join(app.getPath('pictures'), APP_NAME)

async function saveScreenshot(id: number): Promise<string | null> {
  const image = await slots.capture(id)
  if (!image) return null
  const name = store.panel.slots[id].name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || `account-${id + 1}`
  const stamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
  const file = join(screenshotDir(), `${name}_${stamp}.png`)
  await mkdir(screenshotDir(), { recursive: true })
  const png = image.toPNG()
  await writeFile(file, png)
  await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })]).catch(() => {})
  return file
}

function ecoState(): EcoState {
  const prefs = store.panel.prefs
  const byBattery = !prefs.eco && prefs.ecoOnBattery && powerMonitor.isOnBatteryPower()
  return { active: prefs.eco || byBattery, byBattery, live: slots?.getLive() ?? null }
}

function applyEco(): void {
  if (!slots) return
  const state = ecoState()
  slots.setEco(state.active, store.panel.prefs.ecoInterval)
  send('panel:eco', ecoState())
}

function setPrefs(patch: Partial<PanelPrefs>): void {
  store.panel.prefs = { ...store.panel.prefs, ...patch }
  persist()
  buildMenu()
  applyEco()
}

function zoomActive(delta: number): void {
  const slot = slots?.activeSlot()
  if (slot !== null && slot !== undefined) command({ type: 'zoom', slot, delta })
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
          label: 'Eco mode',
          type: 'checkbox',
          accelerator: 'CmdOrCtrl+E',
          checked: store.panel.prefs.eco,
          click: (item) => setPrefs({ eco: item.checked })
        },
        {
          label: 'Eco mode on battery',
          type: 'checkbox',
          checked: store.panel.prefs.ecoOnBattery,
          click: (item) => setPrefs({ ecoOnBattery: item.checked })
        },
        {
          label: 'Eco refresh',
          submenu: ECO_INTERVALS.map((n) => ({
            label: `Every ${n} seconds`,
            type: 'radio' as const,
            checked: store.panel.prefs.ecoInterval === n,
            click: () => setPrefs({ ecoInterval: n })
          }))
        },
        { type: 'separator' },
        {
          label: 'Auto-recover stuck accounts',
          type: 'checkbox',
          checked: store.panel.prefs.autoReload,
          click: (item) => setPrefs({ autoReload: item.checked })
        },
        {
          label: 'Desktop notifications',
          type: 'checkbox',
          checked: store.panel.prefs.notifications,
          click: (item) => setPrefs({ notifications: item.checked })
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom in account', accelerator: 'CmdOrCtrl+=', click: () => zoomActive(ZOOM_STEP) },
        { label: 'Zoom out account', accelerator: 'CmdOrCtrl+-', click: () => zoomActive(-ZOOM_STEP) },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Keyboard shortcuts', accelerator: 'CmdOrCtrl+/', click: () => command({ type: 'shortcuts' }) },
        { label: 'Check for updates…', click: () => void updater.check(true) }
      ]
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
    alert,
    zoom: (slot, delta) => command({ type: 'zoom', slot, delta }),
    live: () => send('panel:eco', ecoState()),
    snapshot: (id, snapshot) => send('panel:snapshot', id, snapshot)
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

  win.webContents.once('did-finish-load', () => void slots.sync().then(applyEco))
}

function registerIpc(): void {
  ipcMain.handle('panel:get-state', () => ({
    config: store.panel,
    statuses: slots.getStatuses(),
    since: slots.getSince(),
    version: app.getVersion(),
    update: updater.getState(),
    eco: ecoState()
  }))
  ipcMain.handle('panel:set-prefs', (_e, patch: Partial<PanelPrefs>) => setPrefs(patch))
  ipcMain.on('panel:set-live', (_e, id: number) => {
    if (Number.isInteger(id) && id >= 0 && id < SLOT_COUNT) slots.setLive(id)
  })
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
  ipcMain.handle('panel:screenshot', (_e, id: number) =>
    Number.isInteger(id) && id >= 0 && id < SLOT_COUNT ? saveScreenshot(id).catch(() => null) : null
  )
  ipcMain.on('panel:reveal-screenshot', (_e, file: string) => {
    if (typeof file === 'string' && dirname(file) === screenshotDir()) shell.showItemInFolder(file)
  })
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
  powerMonitor.on('on-battery', applyEco)
  powerMonitor.on('on-ac', applyEco)
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
