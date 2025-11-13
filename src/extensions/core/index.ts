import { dispatchComfyExtensions } from '../dispatch'

export async function importExtensions() {
  console.log('importExtensions running...')

  const extConfigs = import.meta.glob(`./extensions/*/comfy.ext.config.ts`, {
    // Since each config is small, we only import the default export and use eager mode for better tree-shaking and performance.
    import: 'default',
    eager: true,
  })
  const extensionEntrance = import.meta.glob(`./extensions/*/index.ts`)

  dispatchComfyExtensions({ configs: extConfigs, entrance: extensionEntrance })
}

