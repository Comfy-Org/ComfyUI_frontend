if (!globalThis.comfy_v4) {
  throw new Error(
    '[comfy] /comfy/api/v4.js has no API to export: it was imported before ' +
      'ComfyUI installed one, or a pack removed window.comfy_v4.'
  )
}

/** The API the host installed before it loaded any extension. */
export const comfy = globalThis.comfy_v4
