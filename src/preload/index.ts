import { contextBridge, ipcRenderer } from 'electron'
import type { EcoState, PanelApi, PanelCommand, SlotStatus, Snapshot, UpdateState } from '@shared/types'

const api: PanelApi = {
  getState: () => ipcRenderer.invoke('panel:get-state'),
  updateSlot: (id, patch) => ipcRenderer.invoke('panel:update-slot', id, patch),
  setLayout: (layout) => ipcRenderer.invoke('panel:set-layout', layout),
  updateAction: (action) => ipcRenderer.send('panel:update-action', action),
  onUpdate: (cb) => {
    const handler = (_: unknown, state: UpdateState) => cb(state)
    ipcRenderer.on('panel:update-state', handler)
    return () => ipcRenderer.removeListener('panel:update-state', handler)
  },
  setPrefs: (patch) => ipcRenderer.invoke('panel:set-prefs', patch),
  setLive: (id) => ipcRenderer.send('panel:set-live', id),
  onEco: (cb) => {
    const handler = (_: unknown, state: EcoState) => cb(state)
    ipcRenderer.on('panel:eco', handler)
    return () => ipcRenderer.removeListener('panel:eco', handler)
  },
  onSnapshot: (cb) => {
    const handler = (_: unknown, id: number, snapshot: Snapshot) => cb(id, snapshot)
    ipcRenderer.on('panel:snapshot', handler)
    return () => ipcRenderer.removeListener('panel:snapshot', handler)
  },
  setRects: (rects) => ipcRenderer.send('panel:rects', rects),
  setSuspended: (suspended) => ipcRenderer.send('panel:suspend', suspended),
  reloadSlot: (id) => ipcRenderer.send('panel:reload', id),
  clearSlot: (id) => ipcRenderer.invoke('panel:clear', id),
  screenshot: (id) => ipcRenderer.invoke('panel:screenshot', id),
  revealScreenshot: (path) => ipcRenderer.send('panel:reveal-screenshot', path),
  onStatus: (cb) => {
    const handler = (_: unknown, id: number, status: SlotStatus, since: number) => cb(id, status, since)
    ipcRenderer.on('panel:status', handler)
    return () => ipcRenderer.removeListener('panel:status', handler)
  },
  onCommand: (cb) => {
    const handler = (_: unknown, command: PanelCommand) => cb(command)
    ipcRenderer.on('panel:command', handler)
    return () => ipcRenderer.removeListener('panel:command', handler)
  }
}

contextBridge.exposeInMainWorld('panel', api)
