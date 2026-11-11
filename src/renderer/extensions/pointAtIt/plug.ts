import { resolveSwitch } from './core/activation'

type LayerExtension = {
  name: string
  setup: () => void
}

let removeLayer: (() => void) | undefined

/**
 * The layer's only entry point. Off: registers nothing and loads nothing.
 * On: loads the layer and registers one extension that mounts it at setup.
 */
export async function plug(
  register: (extension: LayerExtension) => unknown
): Promise<void> {
  if (!resolveSwitch('layer', window.location.search, window.localStorage))
    return
  const [{ createComfyPointHost }, { mountPointLayer }] = await Promise.all([
    import('./comfyPointHost'),
    import('./core/mountPointLayer')
  ])
  register({
    name: 'Comfy.PointAtItPoc',
    setup() {
      removeLayer?.()
      removeLayer = mountPointLayer(createComfyPointHost())
    }
  })
}

import.meta.hot?.dispose(() => removeLayer?.())
