import { useEffect } from 'react'
import { IconClose } from './Icons'

const MOD = navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'

const ROWS: [string[], string][] = [
  [[`${MOD} 1`, '…', `${MOD} 4`], 'Focus account 1 to 4'],
  [[`${MOD} 0`], 'Back to the grid'],
  [[`${MOD} +`, `${MOD} −`], 'Zoom in / out the last clicked account'],
  [['Ctrl', 'mouse wheel'], 'Zoom inside a game'],
  [[`${MOD} E`], 'Turn Eco mode on or off'],
  [[`${MOD} /`], 'Show this list'],
  [['Double-click name'], 'Rename an account'],
  [['Drag name'], 'Swap two accounts'],
  [['Double-click divider'], 'Reset tile sizes'],
  [['Esc'], 'Close dialogs']
]

export function Shortcuts({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal aria-label="Keyboard shortcuts">
        <header>
          <h2>Shortcuts</h2>
          <span className="spacer" />
          <button className="action" onClick={onClose} title="Close" aria-label="Close" autoFocus>
            <IconClose />
          </button>
        </header>
        <dl className="shortcuts">
          {ROWS.map(([keys, label]) => (
            <div key={label} className="shortcut-row">
              <dt>
                {keys.map((k) => (k === '…' ? <span key={k}>…</span> : <kbd key={k}>{k}</kbd>))}
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
