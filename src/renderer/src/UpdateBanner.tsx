import { useState } from 'react'
import type { UpdateState } from '@shared/types'
import { IconClose, IconDownload } from './Icons'

interface Props {
  state: UpdateState
  onAction: (action: 'install' | 'download') => void
}

export function UpdateBanner({ state, onAction }: Props) {
  const [dismissed, setDismissed] = useState<UpdateState | null>(null)
  if (state.kind === 'idle' || dismissed === state) return null

  const closable = state.kind === 'uptodate' || state.kind === 'error' || state.kind === 'manual'

  let message = ''
  let button: { label: string; action: 'install' | 'download' } | null = null
  switch (state.kind) {
    case 'checking':
      message = 'Checking for updates…'
      break
    case 'uptodate':
      message = 'You are on the latest version.'
      break
    case 'downloading':
      message = `Downloading version ${state.version}… ${state.percent}%`
      break
    case 'ready':
      message = `Version ${state.version} is ready to install.`
      button = { label: 'Restart and update', action: 'install' }
      break
    case 'manual':
      message = `Version ${state.version} is available.`
      button = { label: 'Download update', action: 'download' }
      break
    case 'error':
      message = `Could not check for updates: ${state.message}`
      break
  }

  return (
    <div className={`banner banner-${state.kind}`} role="status">
      <IconDownload />
      <span>{message}</span>
      {button && (
        <button className="btn btn-primary btn-small" onClick={() => onAction(button.action)}>
          {button.label}
        </button>
      )}
      {closable && (
        <button className="action" onClick={() => setDismissed(state)} title="Dismiss this message" aria-label="Dismiss">
          <IconClose />
        </button>
      )}
    </div>
  )
}
