import { app, net, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '@shared/types'

const OWNER = 'gabrielsvpinheiro'
const REPO = 'pokeidle-panel'
const RELEASES = `https://github.com/${OWNER}/${REPO}/releases/latest`
const SELF_UPDATE = process.platform === 'win32'
const CHECK_INTERVAL = 4 * 60 * 60 * 1000

function isNewer(remote: string, local: string): boolean {
  const parse = (v: string): number[] => v.replace(/^v/, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0)
  const a = parse(remote)
  const b = parse(local)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

function downloadUrl(): string {
  if (process.platform !== 'darwin') return RELEASES
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  return `${RELEASES}/download/PokeIdle-Panel-mac-${arch}.dmg`
}

export class Updater {
  private state: UpdateState = { kind: 'idle' }
  private userInitiated = false

  constructor(private publish: (state: UpdateState) => void) {
    if (!SELF_UPDATE || !app.isPackaged) return
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('update-available', (info) => this.set({ kind: 'downloading', version: info.version, percent: 0 }))
    autoUpdater.on('download-progress', (p) => {
      if (this.state.kind === 'downloading') this.set({ ...this.state, percent: Math.round(p.percent) })
    })
    autoUpdater.on('update-downloaded', (info) => this.set({ kind: 'ready', version: info.version }))
    autoUpdater.on('update-not-available', () => this.set(this.userInitiated ? { kind: 'uptodate' } : { kind: 'idle' }))
    autoUpdater.on('error', (err) => this.set(this.userInitiated ? { kind: 'error', message: err.message } : { kind: 'idle' }))
  }

  getState(): UpdateState {
    return this.state
  }

  start(): void {
    if (!app.isPackaged) return
    setTimeout(() => void this.check(false), 15_000)
    setInterval(() => void this.check(false), CHECK_INTERVAL)
  }

  async check(userInitiated: boolean): Promise<void> {
    if (!app.isPackaged) {
      if (userInitiated) this.set({ kind: 'error', message: 'Updates only work in the installed app.' })
      return
    }
    if (['downloading', 'ready', 'checking'].includes(this.state.kind)) return
    this.userInitiated = userInitiated
    if (userInitiated) this.set({ kind: 'checking' })
    try {
      if (SELF_UPDATE) await autoUpdater.checkForUpdates()
      else await this.checkManually()
    } catch (err) {
      this.set(userInitiated ? { kind: 'error', message: (err as Error).message } : { kind: 'idle' })
    }
  }

  install(): void {
    if (this.state.kind === 'ready') autoUpdater.quitAndInstall()
  }

  openDownload(): void {
    void shell.openExternal(downloadUrl())
  }

  private async checkManually(): Promise<void> {
    const res = await net.fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `${REPO}/${app.getVersion()}` }
    })
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`)
    const { tag_name: tag } = (await res.json()) as { tag_name: string }
    if (isNewer(tag, app.getVersion())) this.set({ kind: 'manual', version: tag.replace(/^v/, '') })
    else this.set(this.userInitiated ? { kind: 'uptodate' } : { kind: 'idle' })
  }

  private set(state: UpdateState): void {
    this.state = state
    this.publish(state)
  }
}
