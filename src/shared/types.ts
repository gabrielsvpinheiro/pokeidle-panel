export const SLOT_COUNT = 4
export const GAME_URL = 'https://pokeidle.io/app'

export interface SlotConfig {
  id: number
  name: string
  enabled: boolean
  muted: boolean
  proxy: string
}

export type LayoutMode = 'grid' | 'focus'

export type TileCount = 1 | 2 | 3 | 4

export interface LayoutConfig {
  mode: LayoutMode
  count: TileCount
  focused: number
  colRatio: number
  rowRatios: [number, number]
}

export interface PanelConfig {
  slots: SlotConfig[]
  layout: LayoutConfig
}

export type SlotStatus = 'idle' | 'loading' | 'online' | 'error' | 'crashed'

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
  getState(): Promise<{
    config: PanelConfig
    statuses: Record<number, SlotStatus>
    version: string
    update: UpdateState
  }>
  updateAction(action: UpdateAction): void
  onUpdate(cb: (state: UpdateState) => void): () => void
  updateSlot(id: number, patch: Partial<Omit<SlotConfig, 'id'>>): Promise<void>
  setLayout(layout: LayoutConfig): Promise<void>
  setRects(rects: SlotRects): void
  setSuspended(suspended: boolean): void
  reloadSlot(id: number): void
  clearSlot(id: number): Promise<void>
  onStatus(cb: (id: number, status: SlotStatus) => void): () => void
  onCommand(cb: (command: PanelCommand) => void): () => void
}
