export const SLOT_COUNT = 4
export const GAME_URL = 'https://pokeidle.io/app'

export interface SlotConfig {
  id: number
  name: string
  enabled: boolean
  muted: boolean
  proxy: string
  zoom: number
  hidden: boolean
}

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 1.5
export const ZOOM_STEP = 0.1

export const clampZoom = (z: number): number =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))

export type LayoutMode = 'grid' | 'focus'

export type TileCount = 1 | 2 | 3 | 4

export interface LayoutConfig {
  mode: LayoutMode
  count: TileCount
  order: number[]
  focused: number
  colRatio: number
  rowRatios: [number, number]
}

export const ECO_INTERVALS = [0, 5, 15, 30, 60] as const
export type EcoInterval = (typeof ECO_INTERVALS)[number]

export const ECO_IDLE_MINUTES = [0, 1, 2, 5, 10] as const
export type EcoIdleMinutes = (typeof ECO_IDLE_MINUTES)[number]

export interface PanelPrefs {
  autoReload: boolean
  notifications: boolean
  eco: boolean
  ecoOnBattery: boolean
  ecoInterval: EcoInterval
  ecoIdleMinutes: EcoIdleMinutes
}

export type EcoMode = 'off' | 'eco' | 'farming'

export interface EcoState {
  active: boolean
  byBattery: boolean
  cards: boolean
  live: number | null
}

export interface Usage {
  cpu: number
  memory: number
}

export interface UsageReport {
  slots: Record<number, Usage>
  total: Usage
}

export interface Snapshot {
  url: string
  at: number
}

export interface PanelConfig {
  slots: SlotConfig[]
  layout: LayoutConfig
  prefs: PanelPrefs
}

export type SlotStatus = 'idle' | 'loading' | 'online' | 'signedout' | 'error' | 'crashed'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type SlotRects = Record<number, Rect | null>

export type PanelCommand =
  | { type: 'grid' }
  | { type: 'focus'; slot: number }
  | { type: 'zoom'; slot: number; delta: number }
  | { type: 'shortcuts' }
  | { type: 'reload-config' }

export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'uptodate' }
  | { kind: 'downloading'; version: string; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'manual'; version: string }
  | { kind: 'error'; message: string }

export type UpdateAction = 'check' | 'install' | 'download'

export interface PanelApi {
  getConfig(): Promise<PanelConfig>
  getState(): Promise<{
    config: PanelConfig
    statuses: Record<number, SlotStatus>
    since: Record<number, number>
    version: string
    update: UpdateState
    eco: EcoState
  }>
  setPrefs(patch: Partial<PanelPrefs>): Promise<void>
  setLive(id: number | null): void
  openEcoMenu(x: number, y: number): void
  onEco(cb: (state: EcoState) => void): () => void
  onSnapshot(cb: (id: number, snapshot: Snapshot) => void): () => void
  onUsage(cb: (report: UsageReport) => void): () => void
  updateAction(action: UpdateAction): void
  onUpdate(cb: (state: UpdateState) => void): () => void
  updateSlot(id: number, patch: Partial<Omit<SlotConfig, 'id'>>): Promise<void>
  setLayout(layout: LayoutConfig): Promise<void>
  setRects(rects: SlotRects): void
  setSuspended(suspended: boolean): void
  reloadSlot(id: number): void
  clearSlot(id: number): Promise<void>
  screenshot(id: number): Promise<string | null>
  revealScreenshot(path: string): void
  onStatus(cb: (id: number, status: SlotStatus, since: number) => void): () => void
  onCommand(cb: (command: PanelCommand) => void): () => void
}
