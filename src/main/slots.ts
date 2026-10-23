import { BrowserWindow, WebContentsView, session, type Session } from 'electron'
import { GAME_URL, type PanelConfig, type SlotRects, type SlotStatus } from '@shared/types'
import { parseProxy } from './proxy'

const partitionOf = (id: number): string => `persist:account-${id}`

export class SlotManager {
  private views = new Map<number, WebContentsView>()
  private statuses: Record<number, SlotStatus> = {}
  private rects: SlotRects = {}
  private suspended = false
  private appliedProxy = new Map<number, string>()

  constructor(
    private win: BrowserWindow,
    private getConfig: () => PanelConfig,
    private notify: (id: number, status: SlotStatus) => void
  ) {}

  getStatuses(): Record<number, SlotStatus> {
    return { ...this.statuses }
  }

  sessionOf(id: number): Session {
    return session.fromPartition(partitionOf(id))
  }

  credentialsFor(target: Session | undefined): { username: string; password: string } | null {
    if (!target) return null
    for (const slot of this.getConfig().slots) {
      if (this.sessionOf(slot.id) !== target) continue
      const parsed = parseProxy(slot.proxy)
      if (parsed?.username) return { username: parsed.username, password: parsed.password }
    }
    return null
  }

  async sync(): Promise<void> {
    for (const slot of this.getConfig().slots) {
      if (slot.enabled) await this.ensure(slot.id)
      else this.destroy(slot.id)
      const view = this.views.get(slot.id)
      view?.webContents.setAudioMuted(slot.muted)
    }
    this.applyBounds()
  }

  setRects(rects: SlotRects): void {
    this.rects = rects
    this.applyBounds()
  }

  setSuspended(suspended: boolean): void {
    this.suspended = suspended
    this.applyBounds()
  }

  reload(id: number): void {
    const view = this.views.get(id)
    if (!view) return
    if (view.webContents.getURL()) view.webContents.reloadIgnoringCache()
    else void view.webContents.loadURL(GAME_URL)
  }

  async clear(id: number): Promise<void> {
    const ses = this.sessionOf(id)
    await ses.clearStorageData()
    await ses.clearCache()
    this.reload(id)
  }

  destroyAll(): void {
    for (const id of [...this.views.keys()]) this.destroy(id)
  }

  private setStatus(id: number, status: SlotStatus): void {
    this.statuses[id] = status
    this.notify(id, status)
  }

  private async applyProxy(id: number): Promise<boolean> {
    const raw = this.getConfig().slots[id].proxy
    if (this.appliedProxy.get(id) === raw) return false
    const parsed = parseProxy(raw)
    await this.sessionOf(id).setProxy(
      parsed ? { mode: 'fixed_servers', proxyRules: parsed.rules } : { mode: 'system' }
    )
    this.appliedProxy.set(id, raw)
    return true
  }

  private async ensure(id: number): Promise<void> {
    const changed = await this.applyProxy(id)
    const existing = this.views.get(id)
    if (existing) {
      if (changed) this.reload(id)
      return
    }

    const ses = this.sessionOf(id)
    ses.setUserAgent(ses.getUserAgent().replace(/ Electron\/\S+/, '').replace(/ pokeidle-panel\/\S+/, ''))

    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    view.setVisible(false)
    this.win.contentView.addChildView(view)
    this.views.set(id, view)
    this.wire(id, view)
    this.setStatus(id, 'loading')
    void view.webContents.loadURL(GAME_URL).catch(() => {})
  }

  private wire(id: number, view: WebContentsView): void {
    const wc = view.webContents
    let failed = false
    wc.on('did-start-navigation', (details) => {
      if (!details.isMainFrame || details.isSameDocument) return
      failed = false
      this.setStatus(id, 'loading')
    })
    wc.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) {
        failed = true
        this.setStatus(id, 'error')
      }
    })
    const settle = (): void => {
      if (!failed) this.setStatus(id, 'online')
    }
    wc.on('did-finish-load', settle)
    wc.on('did-stop-loading', settle)
    wc.on('render-process-gone', () => {
      failed = false
      this.setStatus(id, 'crashed')
      setTimeout(() => {
        if (this.views.get(id) === view && !wc.isDestroyed()) wc.reload()
      }, 2000)
    })
    wc.setWindowOpenHandler(({ url }) => {
      if (!/^https?:/i.test(url)) return { action: 'deny' }
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 520, height: 720 } }
    })
  }

  private destroy(id: number): void {
    const view = this.views.get(id)
    if (!view) return
    this.views.delete(id)
    this.appliedProxy.delete(id)
    this.win.contentView.removeChildView(view)
    if (!view.webContents.isDestroyed()) view.webContents.close()
    this.setStatus(id, 'idle')
  }

  private applyBounds(): void {
    for (const [id, view] of this.views) {
      const rect = this.rects[id]
      if (!rect || this.suspended || rect.width < 2 || rect.height < 2) {
        view.setVisible(false)
        continue
      }
      view.setBounds({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      })
      view.setVisible(true)
    }
  }
}
