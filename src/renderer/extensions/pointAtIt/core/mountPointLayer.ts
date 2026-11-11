import { createApp } from 'vue'

import { resolveSwitch } from './activation'
import { pointConfig } from './config'
import PointLayer from './PointLayer.vue'
import type { PointHost } from './pointHost'

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
  const overlay = createApp(PointLayer, {
    host,
    config: {
      ...pointConfig,
      strokeEntry: pointConfig.strokeEntry || strokeSwitch
    }
  })
  overlay.mount(root)
  return () => {
    overlay.unmount()
    root.remove()
  }
}
