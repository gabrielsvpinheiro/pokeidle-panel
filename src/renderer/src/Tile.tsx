import type { ReactNode } from 'react'
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

function ActionButton(props: {
  icon: ReactNode
  label: string
  hint: string
  tone?: 'warn'
  onClick: () => void
}) {
  return (
    <button
      className={`action${props.tone ? ` action-${props.tone}` : ''}`}
      title={props.hint}
      aria-label={`${props.label}: ${props.hint}`}
      onClick={props.onClick}
    >
      {props.icon}
      <span className="action-label">{props.label}</span>
    </button>
  )
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
            <ActionButton
              icon={slot.muted ? <IconMute /> : <IconSound />}
              label={slot.muted ? 'Muted' : 'Sound on'}
              hint={slot.muted ? 'Audio is muted. Click to turn the sound on.' : 'Audio is playing. Click to mute this account.'}
              tone={slot.muted ? 'warn' : undefined}
              onClick={p.onToggleMute}
            />
            <ActionButton icon={<IconReload />} label="Reload" hint="Reload the game page for this account" onClick={p.onReload} />
          </>
        )}
        <ActionButton icon={<IconSettings />} label="Settings" hint="Nickname, proxy, mute and log out" onClick={p.onSettings} />
        <ActionButton
          icon={p.focused ? <IconGrid /> : <IconExpand />}
          label={p.focused ? 'Show all' : 'Expand'}
          hint={p.focused ? 'Go back to the grid with all accounts' : 'Fill the window with this account'}
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
