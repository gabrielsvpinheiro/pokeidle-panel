import { useState, type ReactNode } from 'react'
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, type SlotConfig, type SlotStatus } from '@shared/types'
import { Ball } from './Ball'
import { IconExpand, IconGrid, IconMute, IconReload, IconSettings, IconSound, IconZoomIn, IconZoomOut } from './Icons'

const STATUS_LABEL: Record<SlotStatus, string> = {
  idle: 'Empty',
  loading: 'Loading',
  online: 'Online',
  signedout: 'Signed out',
  error: 'Load failed',
  crashed: 'Recovering'
}

function ActionButton(props: {
  icon: ReactNode
  hint: string
  tone?: 'warn'
  disabled?: boolean
  onHint: (hint: string | null) => void
  onClick: () => void
}) {
  const show = () => props.onHint(props.hint)
  const hide = () => props.onHint(null)
  return (
    <button
      className={`action${props.tone ? ` action-${props.tone}` : ''}`}
      title={props.hint}
      aria-label={props.hint}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.icon}
    </button>
  )
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'just now'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

interface Props {
  slot: SlotConfig
  status: SlotStatus
  onlineFor: number | null
  focused: boolean
  registerContent: (el: HTMLDivElement | null) => void
  onFocus: () => void
  onRestore: () => void
  onReload: () => void
  onToggleMute: () => void
  onZoom: (delta: number | null) => void
  onSettings: () => void
  onActivate: () => void
}

export function Tile(p: Props) {
  const { slot, status } = p
  const [hint, setHint] = useState<string | null>(null)
  return (
    <section className={`tile${slot.enabled ? '' : ' tile-empty'}`} aria-label={slot.name}>
      <div className="tile-bar">
        <Ball slot={slot.id} size={22} dim={!slot.enabled} />
        <span className="tile-name" title={slot.name}>{slot.name}</span>
        {hint ? (
          <span className="tile-hint" aria-hidden>{hint}</span>
        ) : (
          <>
            <span className={`led led-${status}`} title={STATUS_LABEL[status]} />
            <span className="tile-status" title={p.onlineFor !== null ? 'Time since this account last loaded the game' : undefined}>
              {STATUS_LABEL[status]}
              {p.onlineFor !== null && ` · ${formatDuration(p.onlineFor)}`}
            </span>
          </>
        )}
        <span className="spacer" />
        {slot.enabled && (
          <>
            <ActionButton
              icon={slot.muted ? <IconMute /> : <IconSound />}
              hint={slot.muted ? 'Muted: click to turn the sound on' : 'Sound on: click to mute'}
              tone={slot.muted ? 'warn' : undefined}
              onHint={setHint}
              onClick={p.onToggleMute}
            />
            <div className="zoom-group">
              <ActionButton
                icon={<IconZoomOut />}
                hint="Zoom out this account (Ctrl/Cmd −)"
                disabled={slot.zoom <= ZOOM_MIN}
                onHint={setHint}
                onClick={() => p.onZoom(-ZOOM_STEP)}
              />
              <button
                className="zoom-level"
                title="Zoom level: click to reset to 100%"
                aria-label={`Zoom ${Math.round(slot.zoom * 100)}%, click to reset`}
                onMouseEnter={() => setHint('Zoom level: click to reset to 100%')}
                onMouseLeave={() => setHint(null)}
                onClick={() => p.onZoom(null)}
              >
                {Math.round(slot.zoom * 100)}%
              </button>
              <ActionButton
                icon={<IconZoomIn />}
                hint="Zoom in this account (Ctrl/Cmd +)"
                disabled={slot.zoom >= ZOOM_MAX}
                onHint={setHint}
                onClick={() => p.onZoom(ZOOM_STEP)}
              />
            </div>
            <ActionButton icon={<IconReload />} hint="Reload this account's game" onHint={setHint} onClick={p.onReload} />
          </>
        )}
        <ActionButton icon={<IconSettings />} hint="Settings: nickname, proxy, log out" onHint={setHint} onClick={p.onSettings} />
        <ActionButton
          icon={p.focused ? <IconGrid /> : <IconExpand />}
          hint={p.focused ? 'Back to all accounts' : 'Expand to fill the window'}
          onHint={setHint}
          onClick={p.focused ? p.onRestore : p.onFocus}
        />
      </div>
      <div className="tile-body" ref={slot.enabled ? p.registerContent : undefined}>
        {!slot.enabled && (
          <div className="empty">
            <Ball slot={slot.id} size={64} dim />
            <p>Slot {slot.id + 1} is empty</p>
            <button className="btn btn-primary" onClick={p.onActivate}>Activate account</button>
          </div>
        )}
      </div>
    </section>
  )
}
