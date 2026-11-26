import type { Comfy } from './types'

class NodeApiNotInstalledError extends Error {
  override name = 'NodeApiNotInstalledError'
}

function installedApi(): Comfy {
  if (!window.comfy_v4) {
    throw new NodeApiNotInstalledError(
      '[comfy] /comfy/api/v4.js has no API to export: it was imported before ' +
        'ComfyUI installed one, or a pack removed window.comfy_v4.'
    )
  }
  return window.comfy_v4
}

/** The API the host installed before it loaded any extension. */
export const comfy: Comfy = installedApi()
