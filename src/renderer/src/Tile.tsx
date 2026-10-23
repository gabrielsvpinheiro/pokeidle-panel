import type { SlotConfig, SlotStatus } from '@shared/types'
import { Ball } from './Ball'
import { IconExpand, IconGrid, IconMute, IconReload, IconSettings, IconSound } from './Icons'

const STATUS_LABEL: Record<SlotStatus, string> = {
  idle: 'Empty',
  loading: 'Loading',
  online: 'Online',
  error: 'Load failed',
  crashed: 'Recovering'
}

interface Props {
  slot: SlotConfig
  status: SlotStatus
  focused: boolean
  registerContent: (el: HTMLDivElement | null) => void
  onFocus: () => void
  onRestore: () => void
  onReload: () => void
  onToggleMute: () => void
  onSettings: () => void
  onActivate: () => void
}

export function Tile(p: Props) {
  const { slot, status } = p
  return (
    <section className={`tile${slot.enabled ? '' : ' tile-empty'}`} aria-label={slot.name}>
      <div className="tile-bar">
        <Ball slot={slot.id} size={22} dim={!slot.enabled} />
        <span className="tile-name" title={slot.name}>{slot.name}</span>
        <span className={`led led-${status}`} title={STATUS_LABEL[status]} />
        <span className="tile-status">{STATUS_LABEL[status]}</span>
        <span className="spacer" />
        {slot.enabled && (
          <>
            <button className="icon-btn" title={slot.muted ? 'Unmute' : 'Mute'} onClick={p.onToggleMute}>
              {slot.muted ? <IconMute /> : <IconSound />}
            </button>
            <button className="icon-btn" title="Reload" onClick={p.onReload}><IconReload /></button>
          </>
        )}
        <button className="icon-btn" title="Settings" onClick={p.onSettings}><IconSettings /></button>
        <button
          className="icon-btn"
          title={p.focused ? 'Back to grid' : 'Focus this account'}
          onClick={p.focused ? p.onRestore : p.onFocus}
        >
          {p.focused ? <IconGrid /> : <IconExpand />}
        </button>
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
