if (!globalThis.comfy) {
  throw new Error(
    '[comfy] /comfy/api/v2.js was imported before the host installed the API. ' +
      'A pack must not be loaded before ComfyUI has started.'
  )
}

/** The API singleton installed by the host before loading extensions. */
export const comfy = globalThis.comfy
