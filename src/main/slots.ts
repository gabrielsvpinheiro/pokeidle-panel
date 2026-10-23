import { BrowserWindow, WebContentsView, session, type Session } from 'electron'
import { GAME_URL, type PanelConfig, type SlotRects, type SlotStatus } from '@shared/types'
import { parseProxy } from './proxy'

const partitionOf = (id: number): string => `persist:account-${id}`

const SIGNED_OUT_PROBE = `[...document.querySelectorAll('input[type="password"]')].some((e) => e.offsetParent !== null)`
const PROBE_INTERVAL = 30_000
const HANG_TIMEOUT = 30_000
const RETRY_BASE = 15_000
const RETRY_MAX = 300_000

export interface SlotHooks {
  status: (id: number, status: SlotStatus) => void
  alert: (id: number, message: string) => void
}

interface Retry {
  attempts: number
  timer: NodeJS.Timeout | null
}

export class SlotManager {
  private views = new Map<number, WebContentsView>()
  private statuses: Record<number, SlotStatus> = {}
  private rects: SlotRects = {}
  private suspended = false
  private appliedProxy = new Map<number, string>()
  private retries = new Map<number, Retry>()
  private seenSignedIn = new Set<number>()
  private probeTimer: NodeJS.Timeout

  constructor(
    private win: BrowserWindow,
    private getConfig: () => PanelConfig,
    private hooks: SlotHooks
  ) {
    this.probeTimer = setInterval(() => {
      for (const id of this.views.keys()) void this.probe(id)
    }, PROBE_INTERVAL)
  }

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
    this.seenSignedIn.delete(id)
    await ses.clearStorageData()
    await ses.clearCache()
    this.reload(id)
  }

  destroyAll(): void {
    clearInterval(this.probeTimer)
    for (const id of [...this.views.keys()]) this.destroy(id)
  }

  private nameOf(id: number): string {
    return this.getConfig().slots[id]?.name ?? `Account ${id + 1}`
  }

  private setStatus(id: number, status: SlotStatus): void {
    if (this.statuses[id] === status) return
    this.statuses[id] = status
    this.hooks.status(id, status)
  }

  private scheduleRetry(id: number): void {
    if (!this.getConfig().prefs.autoReload) return
    const retry = this.retries.get(id) ?? { attempts: 0, timer: null }
    if (retry.timer) return
    retry.attempts++
    const delay = Math.min(RETRY_BASE * 2 ** (retry.attempts - 1), RETRY_MAX)
    if (retry.attempts === 1) this.hooks.alert(id, `${this.nameOf(id)} could not load the game. Retrying automatically.`)
    retry.timer = setTimeout(() => {
      retry.timer = null
      this.reload(id)
    }, delay)
    this.retries.set(id, retry)
  }

  private clearRetry(id: number): void {
    const retry = this.retries.get(id)
    if (retry?.timer) clearTimeout(retry.timer)
    this.retries.delete(id)
  }

  private async probe(id: number): Promise<void> {
    const view = this.views.get(id)
    const status = this.statuses[id]
    if (!view || view.webContents.isDestroyed() || (status !== 'online' && status !== 'signedout')) return
    const signedOut = await view.webContents.executeJavaScript(SIGNED_OUT_PROBE).catch(() => null)
    if (this.views.get(id) !== view) return
    if (signedOut === true) {
      if (this.statuses[id] !== 'online') return
      this.setStatus(id, 'signedout')
      if (this.seenSignedIn.delete(id)) this.hooks.alert(id, `${this.nameOf(id)} was signed out.`)
    } else if (signedOut === false) {
      this.seenSignedIn.add(id)
      if (this.statuses[id] === 'signedout') this.setStatus(id, 'online')
    }
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
    const alive = (): boolean => this.views.get(id) === view && !wc.isDestroyed()
    let failed = false
    let hangTimer: NodeJS.Timeout | null = null

    wc.on('did-start-navigation', (details) => {
      if (!details.isMainFrame || details.isSameDocument) return
      failed = false
      this.setStatus(id, 'loading')
    })
    wc.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
      if (!isMainFrame || code === -3) return
      failed = true
      this.setStatus(id, 'error')
      this.scheduleRetry(id)
    })
    const settle = (): void => {
      if (failed || this.statuses[id] === 'signedout') return
      this.setStatus(id, 'online')
      this.clearRetry(id)
      setTimeout(() => void this.probe(id), 3000)
    }
    wc.on('did-finish-load', settle)
    wc.on('did-stop-loading', settle)

    wc.on('unresponsive', () => {
      if (hangTimer || !this.getConfig().prefs.autoReload) return
      hangTimer = setTimeout(() => {
        hangTimer = null
        if (!alive()) return
        this.hooks.alert(id, `${this.nameOf(id)} froze and is being restarted.`)
        wc.forcefullyCrashRenderer()
      }, HANG_TIMEOUT)
    })
    wc.on('responsive', () => {
      if (hangTimer) clearTimeout(hangTimer)
      hangTimer = null
    })

    wc.on('render-process-gone', (_e, details) => {
      failed = false
      this.setStatus(id, 'crashed')
      if (details.reason !== 'killed') this.hooks.alert(id, `${this.nameOf(id)} crashed and is being reloaded.`)
      if (!this.getConfig().prefs.autoReload) return
      setTimeout(() => {
        if (alive()) wc.reload()
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
    this.clearRetry(id)
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
