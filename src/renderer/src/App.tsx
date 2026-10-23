import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SLOT_COUNT, type LayoutConfig, type PanelConfig, type SlotConfig, type SlotRects, type SlotStatus } from '@shared/types'
import { Ball } from './Ball'
import { IconGrid } from './Icons'
import { Settings } from './Settings'
import { Tile } from './Tile'

const MIN = 0.15
const MAX = 0.85
const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n))

type Drag = { kind: 'col' } | { kind: 'row'; column: 0 | 1 }

export function App() {
  const [config, setConfig] = useState<PanelConfig | null>(null)
  const [statuses, setStatuses] = useState<Record<number, SlotStatus>>({})
  const [settingsFor, setSettingsFor] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const colRefs = useRef<(HTMLDivElement | null)[]>([null, null])
  const contentRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    void window.panel.getState().then((s) => {
      setConfig(s.config)
      setStatuses(s.statuses)
    })
    const offStatus = window.panel.onStatus((id, status) => setStatuses((prev) => ({ ...prev, [id]: status })))
    return offStatus
  }, [])

  const updateLayout = useCallback((patch: Partial<LayoutConfig>) => {
    setConfig((prev) => {
      if (!prev) return prev
      const layout = { ...prev.layout, ...patch }
      void window.panel.setLayout(layout)
      return { ...prev, layout }
    })
  }, [])

  useEffect(
    () =>
      window.panel.onCommand((cmd) => {
        if (cmd.type === 'grid') updateLayout({ mode: 'grid' })
        else updateLayout({ mode: 'focus', focused: cmd.slot })
      }),
    [updateLayout]
  )

  const updateSlot = useCallback((id: number, patch: Partial<Omit<SlotConfig, 'id'>>) => {
    setConfig((prev) =>
      prev ? { ...prev, slots: prev.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)) } : prev
    )
    return window.panel.updateSlot(id, patch)
  }, [])

  const suspended = dragging || settingsFor !== null
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
      focused={layout.mode === 'focus'}
      registerContent={(el) => {
        contentRefs.current[slot.id] = el
      }}
      onFocus={() => updateLayout({ mode: 'focus', focused: slot.id })}
      onRestore={() => updateLayout({ mode: 'grid' })}
      onReload={() => window.panel.reloadSlot(slot.id)}
      onToggleMute={() => void updateSlot(slot.id, { muted: !slot.muted })}
      onSettings={() => setSettingsFor(slot.id)}
      onActivate={() => void updateSlot(slot.id, { enabled: true })}
    />
  )

  for (let id = 0; id < SLOT_COUNT; id++) {
    const visible = layout.mode === 'grid' || layout.focused === id
    if (!visible) contentRefs.current[id] = null
  }

  const column = (c: 0 | 1) => (
    <div className="col" ref={(el) => { colRefs.current[c] = el }} style={{ flex: c === 0 ? layout.colRatio : 1 - layout.colRatio }}>
      <div className="cell" style={{ flex: layout.rowRatios[c] }}>{tile(slots[c])}</div>
      <div className="gutter gutter-h" onPointerDown={startDrag({ kind: 'row', column: c })} onDoubleClick={resetRow(c)} title="Drag to resize, double-click to reset" />
      <div className="cell" style={{ flex: 1 - layout.rowRatios[c] }}>{tile(slots[c + 2])}</div>
    </div>
  )

  const editing = settingsFor !== null ? slots[settingsFor] : null

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="lens" />
          <span className="dot dot-r" /><span className="dot dot-y" /><span className="dot dot-g" />
          <h1>POKEIDLE PANEL</h1>
        </div>

        <nav className="trainers" aria-label="Accounts">
          <button
            className={`trainer${layout.mode === 'grid' ? ' active' : ''}`}
            onClick={() => updateLayout({ mode: 'grid' })}
            title="Show all accounts (Ctrl/Cmd+0)"
          >
            <IconGrid />
            <span>All</span>
          </button>
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
      </header>

      <main className="stage" ref={stageRef}>
        {layout.mode === 'grid' ? (
          <>
            {column(0)}
            <div className="gutter gutter-v" onPointerDown={startDrag({ kind: 'col' })} onDoubleClick={resetCol} title="Drag to resize, double-click to reset" />
            {column(1)}
          </>
        ) : (
          <div className="cell" style={{ flex: 1 }}>{tile(slots[layout.focused])}</div>
        )}
      </main>

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
