import { contextBridge, ipcRenderer } from 'electron'
import type { PanelApi } from '@shared/types'

const api: PanelApi = {
  getState: () => ipcRenderer.invoke('panel:get-state'),
  updateSlot: (id, patch) => ipcRenderer.invoke('panel:update-slot', id, patch),
  setLayout: (layout) => ipcRenderer.invoke('panel:set-layout', layout),
  setRects: (rects) => ipcRenderer.send('panel:rects', rects),
  setSuspended: (suspended) => ipcRenderer.send('panel:suspend', suspended),
  reloadSlot: (id) => ipcRenderer.send('panel:reload', id),
  clearSlot: (id) => ipcRenderer.invoke('panel:clear', id),
  onStatus: (cb) => {
    const handler = (_: unknown, id: number, status: never) => cb(id, status)
    ipcRenderer.on('panel:status', handler)
    return () => ipcRenderer.removeListener('panel:status', handler)
  },
  onCommand: (cb) => {
    const handler = (_: unknown, command: never) => cb(command)
    ipcRenderer.on('panel:command', handler)
    return () => ipcRenderer.removeListener('panel:command', handler)
  }
}

contextBridge.exposeInMainWorld('panel', api)
