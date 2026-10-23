import { useEffect, useState } from 'react'
import type { SlotConfig } from '@shared/types'
import { Ball } from './Ball'

interface Props {
  slot: SlotConfig
  onSave: (patch: Partial<Omit<SlotConfig, 'id'>>) => void
  onClearSession: () => Promise<void>
  onClose: () => void
}

export function Settings({ slot, onSave, onClearSession, onClose }: Props) {
  const [name, setName] = useState(slot.name)
  const [enabled, setEnabled] = useState(slot.enabled)
  const [muted, setMuted] = useState(slot.muted)
  const [proxy, setProxy] = useState(slot.proxy)
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    onSave({ name: name.trim() || slot.name, enabled, muted, proxy: proxy.trim() })
    onClose()
  }

  const clear = async () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    await onClearSession()
    setConfirmClear(false)
    setCleared(true)
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal aria-label={`Settings for ${slot.name}`}>
        <header>
          <Ball slot={slot.id} size={34} />
          <h2>Trainer {slot.id + 1} settings</h2>
        </header>

        <label className="field">
          <span>Nickname</span>
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>

        <label className="check">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Account active (loads the game)</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} />
          <span>Mute audio</span>
        </label>

        <label className="field">
          <span>Proxy (optional)</span>
          <input
            value={proxy}
            placeholder="http://user:pass@host:port"
            onChange={(e) => setProxy(e.target.value)}
            spellCheck={false}
          />
          <small>Supports http, https, socks4 and socks5. SOCKS5 with a password is not supported by the engine. Changing it reloads this account.</small>
        </label>

        <div className="danger">
          <button className={confirmClear ? 'btn btn-danger armed' : 'btn btn-ghost'} onClick={clear}>
            {confirmClear ? 'Click again to confirm: log out and wipe data' : 'Clear session (log out)'}
          </button>
          {cleared && <small>Session cleared.</small>}
        </div>

        <footer>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </footer>
      </div>
    </div>
  )
}
