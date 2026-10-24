import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SLOT_COUNT, clampZoom, type LayoutConfig, type PanelConfig, type SlotConfig, type SlotRects, type SlotStatus, type Snapshot, type TileCount, type UpdateState, type EcoState, type UsageReport } from '@shared/types'
import { Ball } from './Ball'
import { IconKeyboard, IconLayout, IconLeaf, IconPause } from './Icons'
import { Settings } from './Settings'
import { Shortcuts } from './Shortcuts'
import { Tile } from './Tile'
import { UpdateBanner } from './UpdateBanner'

export const formatMemory = (mb: number): string => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`)

const MIN = 0.15
const MAX = 0.85
const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n))

type Drag = { kind: 'col' } | { kind: 'row'; column: 0 | 1 }

export function App() {
  const [config, setConfig] = useState<PanelConfig | null>(null)
  const [statuses, setStatuses] = useState<Record<number, SlotStatus>>({})
  const [since, setSince] = useState<Record<number, number>>({})
  const [now, setNow] = useState(Date.now())
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [eco, setEco] = useState<EcoState>({ active: false, byBattery: false, cards: false, live: null })
  const [usage, setUsage] = useState<UsageReport | null>(null)
  const [snapshots, setSnapshots] = useState<Record<number, Snapshot>>({})
  const [moving, setMoving] = useState<{ id: number; over: number | null } | null>(null)
  const [settingsFor, setSettingsFor] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [version, setVersion] = useState('')
  const [update, setUpdate] = useState<UpdateState>({ kind: 'idle' })

  const stageRef = useRef<HTMLDivElement>(null)
  const colRefs = useRef<(HTMLDivElement | null)[]>([null, null])
  const contentRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    void window.panel.getState().then((s) => {
      setConfig(s.config)
      setStatuses(s.statuses)
      setSince(s.since)
      setVersion(s.version)
      setUpdate(s.update)
      setEco(s.eco)
    })
    const offStatus = window.panel.onStatus((id, status, at) => {
      setStatuses((prev) => ({ ...prev, [id]: status }))
      setSince((prev) => ({ ...prev, [id]: at }))
    })
    const offEco = window.panel.onEco(setEco)
    const offUsage = window.panel.onUsage(setUsage)
    const offSnapshot = window.panel.onSnapshot((id, snap) => setSnapshots((prev) => ({ ...prev, [id]: snap })))
    const offUpdate = window.panel.onUpdate(setUpdate)
    return () => {
      offStatus()
      offUpdate()
      offEco()
      offSnapshot()
      offUsage()
    }
  }, [])

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), eco.active ? 5_000 : 30_000)
    return () => clearInterval(tick)
  }, [eco.active])

  const ecoRef = useRef(eco)
  ecoRef.current = eco
  const focusTarget = config?.layout.mode === 'focus' ? config.layout.focused : null
  useEffect(() => {
    if (focusTarget !== null && ecoRef.current.active) window.panel.setLive(focusTarget)
  }, [focusTarget])

  const updateLayout = useCallback((patch: Partial<LayoutConfig>) => {
    setConfig((prev) => {
      if (!prev) return prev
      const layout = { ...prev.layout, ...patch }
      void window.panel.setLayout(layout)
      return { ...prev, layout }
    })
  }, [])

  const updateSlot = useCallback((id: number, patch: Partial<Omit<SlotConfig, 'id'>>) => {
    setConfig((prev) =>
      prev ? { ...prev, slots: prev.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)) } : prev
    )
    return window.panel.updateSlot(id, patch)
  }, [])

  const configRef = useRef<PanelConfig | null>(null)
  configRef.current = config

  const zoomSlot = useCallback(
    (id: number, delta: number | null) => {
      const slot = configRef.current?.slots[id]
      if (!slot) return
      void updateSlot(id, { zoom: delta === null ? 1 : clampZoom(slot.zoom + delta) })
    },
    [updateSlot]
  )

  useEffect(
    () =>
      window.panel.onCommand((cmd) => {
        if (cmd.type === 'grid') updateLayout({ mode: 'grid' })
        else if (cmd.type === 'focus') updateLayout({ mode: 'focus', focused: cmd.slot })
        else if (cmd.type === 'zoom') zoomSlot(cmd.slot, cmd.delta)
        else if (cmd.type === 'shortcuts') setShortcutsOpen(true)
      }),
    [updateLayout, zoomSlot]
  )

  const suspended = dragging || settingsFor !== null || moving !== null || shortcutsOpen
  useEffect(() => window.panel.setSuspended(suspended), [suspended])

  const report = useCallback(() => {
    const rects: SlotRects = {}
    for (let id = 0; id < SLOT_COUNT; id++) {
      const el = contentRefs.current[id]
      if (!el) {
        rects[id] = null
        continue
      }
      const r = el.getBoundingClientRect()
      rects[id] = { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    window.panel.setRects(rects)
  }, [])

  useLayoutEffect(report)

  useEffect(() => {
    const ro = new ResizeObserver(report)
    if (stageRef.current) ro.observe(stageRef.current)
    window.addEventListener('resize', report)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', report)
    }
  }, [report])

  const startDrag = (drag: Drag) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!config) return
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    setDragging(true)

    const move = (ev: PointerEvent) => {
      if (drag.kind === 'col') {
        const box = stageRef.current!.getBoundingClientRect()
        updateLayout({ colRatio: clamp((ev.clientX - box.left) / box.width) })
      } else {
        const box = colRefs.current[drag.column]!.getBoundingClientRect()
        const next = clamp((ev.clientY - box.top) / box.height)
        setConfig((prev) => {
          if (!prev) return prev
          const rowRatios: [number, number] = [...prev.layout.rowRatios]
          rowRatios[drag.column] = next
          const layout = { ...prev.layout, rowRatios }
          void window.panel.setLayout(layout)
          return { ...prev, layout }
        })
      }
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      setDragging(false)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const beginMove = (id: number) => (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    const grip = e.currentTarget
    grip.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startY = e.clientY
    let active = false
    let over: number | null = null

    const move = (ev: PointerEvent) => {
      if (!active && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return
      active = true
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-slot]')
      over = target ? Number(target.dataset.slot) : null
      setMoving({ id, over })
    }
    const up = () => {
      grip.removeEventListener('pointermove', move)
      grip.removeEventListener('pointerup', up)
      grip.removeEventListener('pointercancel', up)
      setMoving(null)
      const current = configRef.current
      if (!active || over === null || over === id || !current) return
      const order = [...current.layout.order]
      const a = order.indexOf(id)
      const b = order.indexOf(over)
      ;[order[a], order[b]] = [order[b], order[a]]
      updateLayout({ order })
    }
    grip.addEventListener('pointermove', move)
    grip.addEventListener('pointerup', up)
    grip.addEventListener('pointercancel', up)
  }

  const resetCol = () => updateLayout({ colRatio: 0.5 })
  const resetRow = (column: 0 | 1) => () => {
    if (!config) return
    const rowRatios: [number, number] = [...config.layout.rowRatios]
    rowRatios[column] = 0.5
    updateLayout({ rowRatios })
  }

  if (!config) return null
  const { layout, slots } = config

  const tile = (slot: SlotConfig) => (
    <Tile
      key={slot.id}
      slot={slot}
      status={statuses[slot.id] ?? 'idle'}
      onlineFor={statuses[slot.id] === 'online' && since[slot.id] ? now - since[slot.id] : null}
      focused={layout.mode === 'focus'}
      registerContent={(el) => {
        contentRefs.current[slot.id] = el
      }}
      onFocus={() => updateLayout({ mode: 'focus', focused: slot.id })}
      onRestore={() => updateLayout({ mode: 'grid' })}
      onReload={() => window.panel.reloadSlot(slot.id)}
      onToggleMute={() => void updateSlot(slot.id, { muted: !slot.muted })}
      onZoom={(delta) => zoomSlot(slot.id, delta)}
      onRename={(name) => void updateSlot(slot.id, { name })}
      onScreenshot={() => window.panel.screenshot(slot.id)}
      frozen={slot.enabled && isFrozen(slot.id)}
      usage={usage?.slots[slot.id] ?? null}
      snapshot={eco.cards ? null : snapshots[slot.id] ?? null}
      onPause={eco.active && eco.live === slot.id ? () => window.panel.setLive(null) : undefined}
      now={now}
      onWake={() => window.panel.setLive(slot.id)}
      onGripPointerDown={layout.mode === 'grid' && layout.count > 1 ? beginMove(slot.id) : undefined}
      moveState={moving ? (moving.id === slot.id ? 'source' : moving.over === slot.id ? 'target' : 'idle') : null}
      onSettings={() => setSettingsFor(slot.id)}
      onActivate={() => void updateSlot(slot.id, { enabled: true })}
    />
  )

  const shown =
    layout.mode === 'focus'
      ? [slots[layout.focused]]
      : (() => {
          const ordered = layout.order.map((id) => slots[id])
          return [...ordered.filter((s) => s.enabled), ...ordered.filter((s) => !s.enabled)].slice(0, layout.count)
        })()

  const shownIds = new Set(shown.map((s) => s.id))
  const isFrozen = (id: number) => eco.active && id !== eco.live

  const toggleEco = () => {
    if (!config) return
    const patch = eco.active ? { eco: false, ...(eco.byBattery ? { ecoOnBattery: false } : {}) } : { eco: true }
    setConfig({ ...config, prefs: { ...config.prefs, ...patch } })
    void window.panel.setPrefs(patch)
  }
  for (let id = 0; id < SLOT_COUNT; id++) {
    if (!shownIds.has(id)) contentRefs.current[id] = null
  }

  const columns: SlotConfig[][] =
    shown.length === 4 ? [[shown[0], shown[2]], [shown[1], shown[3]]] : shown.length === 3 ? [[shown[0]], [shown[1], shown[2]]] : shown.map((s) => [s])

  const column = (c: 0 | 1, items: SlotConfig[]) => (
    <div className="col" ref={(el) => { colRefs.current[c] = el }} style={{ flex: columns.length === 1 ? 1 : c === 0 ? layout.colRatio : 1 - layout.colRatio }}>
      {items.length === 1 ? (
        <div className="cell" style={{ flex: 1 }}>{tile(items[0])}</div>
      ) : (
        <>
          <div className="cell" style={{ flex: layout.rowRatios[c] }}>{tile(items[0])}</div>
          <div className="gutter gutter-h" onPointerDown={startDrag({ kind: 'row', column: c })} onDoubleClick={resetRow(c)} title="Drag to resize, double-click to reset" />
          <div className="cell" style={{ flex: 1 - layout.rowRatios[c] }}>{tile(items[1])}</div>
        </>
      )}
    </div>
  )

  const COUNTS: TileCount[] = [1, 2, 3, 4]

  const editing = settingsFor !== null ? slots[settingsFor] : null

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="lens" />
          <span className="dot dot-r" /><span className="dot dot-y" /><span className="dot dot-g" />
          <h1>POKEIDLE PANEL</h1>
          {version && (
            <button className="version" onClick={() => window.panel.updateAction('check')} title="Click to check for updates">
              v{version}
            </button>
          )}
        </div>

        <div className="layout-picker" role="group" aria-label="How many accounts to show">
          {COUNTS.map((n) => (
            <button
              key={n}
              className={`layout-btn${layout.mode === 'grid' && layout.count === n ? ' active' : ''}`}
              onClick={() => updateLayout({ mode: 'grid', count: n })}
              title={n === 1 ? 'Show 1 account' : `Show ${n} accounts side by side`}
              aria-label={n === 1 ? 'Show 1 account' : `Show ${n} accounts`}
              aria-pressed={layout.mode === 'grid' && layout.count === n}
            >
              <IconLayout count={n} />
            </button>
          ))}
        </div>

        <nav className="trainers" aria-label="Accounts">
          {slots.map((s) => (
            <button
              key={s.id}
              className={`trainer${layout.mode === 'focus' && layout.focused === s.id ? ' active' : ''}${s.enabled ? '' : ' off'}`}
              onClick={() => updateLayout({ mode: 'focus', focused: s.id })}
              title={`Focus ${s.name} (Ctrl/Cmd+${s.id + 1})`}
            >
              <Ball slot={s.id} size={20} dim={!s.enabled} />
              <span>{s.name}</span>
              <span className={`led led-${s.enabled ? statuses[s.id] ?? 'idle' : 'idle'}`} />
            </button>
          ))}
        </nav>

        {usage && (
          <span
            className="usage-total"
            title="Whole app: CPU (100% = one core) and memory. Activity Monitor can show more memory because it also counts GPU and compressed memory."
          >
            CPU {usage.total.cpu}% · {formatMemory(usage.total.memory)}
          </span>
        )}

        <button
          className={`eco-btn${eco.active ? ' active' : ''}`}
          onClick={toggleEco}
          aria-pressed={eco.active}
          title={
            eco.active
              ? eco.byBattery
                ? 'Eco mode is on because the Mac is on battery. Click to turn it off.'
                : 'Eco mode is on: only the account you click stays live, the others refresh as pictures. Click to turn off.'
              : 'Eco mode: keep only the clicked account live and refresh the others as pictures to save energy (Ctrl/Cmd+E)'
          }
        >
          <IconLeaf />
          <span>Eco</span>
        </button>

        <button
          className="pause-all-btn"
          onClick={() => window.panel.pauseAll()}
          disabled={eco.active && eco.live === null}
          title="Pause all accounts: show the Farming screen while they keep farming in the background (Ctrl/Cmd+Shift+E)"
          aria-label="Pause all accounts"
        >
          <IconPause />
        </button>

        <button className="help-btn" onClick={() => setShortcutsOpen(true)} title="Keyboard shortcuts (Ctrl/Cmd + /)" aria-label="Keyboard shortcuts">
          <IconKeyboard />
        </button>
      </header>

      <UpdateBanner state={update} onAction={(a) => window.panel.updateAction(a)} />

      <main className="stage" ref={stageRef}>
        {column(0, columns[0])}
        {columns.length === 2 && (
          <>
            <div className="gutter gutter-v" onPointerDown={startDrag({ kind: 'col' })} onDoubleClick={resetCol} title="Drag to resize, double-click to reset" />
            {column(1, columns[1])}
          </>
        )}
      </main>

      {shortcutsOpen && <Shortcuts onClose={() => setShortcutsOpen(false)} />}

      {editing && (
        <Settings
          key={editing.id}
          slot={editing}
          onSave={(patch) => void updateSlot(editing.id, patch)}
          onClearSession={() => window.panel.clearSlot(editing.id)}
          onClose={() => setSettingsFor(null)}
        />
      )}
    </div>
  )
}
