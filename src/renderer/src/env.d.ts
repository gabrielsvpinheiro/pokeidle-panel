import type { PanelApi } from '@shared/types'

declare global {
  interface Window {
    panel: PanelApi
  }
}
