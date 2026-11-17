import { createApp } from 'vue'

import { resolveSwitch } from './activation'
import { pointConfig } from './config'
import { createHistoryKeeper, historySettings } from './historyKeeper'
import type { PointHost } from './pointHost'
import PointRoot from './PointRoot.vue'

/** Mounts the overlay in its own root under `document.body`; returns its removal. */
export function mountPointLayer(host: PointHost): () => void {
  const root = document.createElement('div')
  root.dataset.pointAtItPoc = ''
  document.body.append(root)
  const strokeSwitch = resolveSwitch(
    'stroke',
    window.location.search,
    window.localStorage
  )
  const overlay = createApp(PointRoot, {
    host,
    config: {
      ...pointConfig,
      strokeEntry: pointConfig.strokeEntry || strokeSwitch
    },
    history: createHistoryKeeper(() => window.localStorage, historySettings)
  })
  overlay.mount(root)
  return () => {
    overlay.unmount()
    root.remove()
  }
}
