import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ECO_IDLE_MINUTES, ECO_INTERVALS, SLOT_COUNT, clampZoom, type EcoIdleMinutes, type EcoInterval, type PanelConfig } from '@shared/types'

export interface StoredFile {
  panel: PanelConfig
  window: { width: number; height: number; x?: number; y?: number; maximized: boolean }
}

const SLOT_NAMES = ['Trainer 1', 'Trainer 2', 'Trainer 3', 'Trainer 4']

export function defaults(): StoredFile {
  return {
    panel: {
      slots: Array.from({ length: SLOT_COUNT }, (_, i) => ({
        id: i,
        name: SLOT_NAMES[i],
        enabled: i === 0,
        muted: false,
        proxy: '',
        zoom: 1
      })),
      layout: { mode: 'grid', count: 4, order: [0, 1, 2, 3], focused: 0, colRatio: 0.5, rowRatios: [0.5, 0.5] },
      prefs: { autoReload: true, notifications: true, eco: false, ecoOnBattery: true, ecoInterval: 15, ecoIdleMinutes: 2 }
    },
    window: { width: 1480, height: 920, maximized: false }
  }
}

const clamp = (n: unknown, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(0.85, Math.max(0.15, n)) : fallback

const isPermutation = (o: unknown): o is number[] =>
  Array.isArray(o) && o.length === SLOT_COUNT && Array.from({ length: SLOT_COUNT }, (_, i) => i).every((i) => o.includes(i))

function sanitize(raw: Partial<StoredFile>): StoredFile {
  const base = defaults()
  const slots = base.panel.slots.map((slot, i) => {
    const s = raw.panel?.slots?.[i]
    return {
      id: i,
      name: typeof s?.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 24) : slot.name,
      enabled: typeof s?.enabled === 'boolean' ? s.enabled : slot.enabled,
      muted: typeof s?.muted === 'boolean' ? s.muted : slot.muted,
      proxy: typeof s?.proxy === 'string' ? s.proxy.trim() : '',
      zoom: typeof s?.zoom === 'number' && Number.isFinite(s.zoom) ? clampZoom(s.zoom) : 1
    }
  })
  const l = raw.panel?.layout
  const focused = Number.isInteger(l?.focused) ? Math.min(SLOT_COUNT - 1, Math.max(0, l!.focused)) : 0
  const p = raw.panel?.prefs
  return {
    panel: {
      slots,
      prefs: {
        autoReload: p?.autoReload !== false,
        notifications: p?.notifications !== false,
        eco: p?.eco === true,
        ecoOnBattery: p?.ecoOnBattery !== false,
        ecoInterval: ECO_INTERVALS.includes(p?.ecoInterval as EcoInterval) ? (p!.ecoInterval as EcoInterval) : 15,
        ecoIdleMinutes: ECO_IDLE_MINUTES.includes(p?.ecoIdleMinutes as EcoIdleMinutes) ? (p!.ecoIdleMinutes as EcoIdleMinutes) : 2
      },
      layout: {
        mode: l?.mode === 'focus' ? 'focus' : 'grid',
        count: l?.count === 1 || l?.count === 2 || l?.count === 3 ? l.count : 4,
        order: isPermutation(l?.order) ? [...l.order] : Array.from({ length: SLOT_COUNT }, (_, i) => i),
        focused,
        colRatio: clamp(l?.colRatio, 0.5),
        rowRatios: [clamp(l?.rowRatios?.[0], 0.5), clamp(l?.rowRatios?.[1], 0.5)]
      }
    },
    window: { ...base.window, ...raw.window }
  }
}

const file = (): string => join(app.getPath('userData'), 'config.json')

export function loadConfig(): StoredFile {
  try {
    return sanitize(JSON.parse(readFileSync(file(), 'utf8')))
  } catch {
    return defaults()
  }
}

let pending: StoredFile | null = null
let timer: NodeJS.Timeout | null = null

export function saveConfig(data: StoredFile): void {
  pending = data
  if (timer) return
  timer = setTimeout(flushConfig, 400)
}

export function flushConfig(): void {
  if (timer) clearTimeout(timer)
  timer = null
  if (!pending) return
  const data = pending
  pending = null
  writeFile(file(), JSON.stringify(data, null, 2)).catch(() => {})
}

export function sanitizeConfig(raw: Partial<StoredFile>): StoredFile {
  return sanitize(raw)
}
