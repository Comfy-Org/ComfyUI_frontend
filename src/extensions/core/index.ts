import { dispatchComfyExtensions } from '../dispatch'
import type { ComfyExtensionConfigs, ComfyExtensionEntrance } from '../types'

export async function registerExtensions() {
  console.log('importExtensions running...')

  const extConfigs = import.meta.glob(`./extensions/*/comfy.ext.config.ts`, {
    // Since each config is small, we only import the default export and use eager mode for better tree-shaking and performance.
    import: 'default',
    eager: true,
  }) as ComfyExtensionConfigs
  const extensionEntrance = import.meta.glob(`./extensions/*/index.ts`) as ComfyExtensionEntrance

  dispatchComfyExtensions({ configs: extConfigs, entrance: extensionEntrance })
}

