import type { ServedPack } from '@/platform/nodeApi/shared/versionHost'

export const V4_PACK_SCRIPT = '/extensions/v4-smoke-pack/main.js'
export const V4_PACK_RECORDS: ServedPack[] = [
  { segment: 'v4-smoke-pack', id: 'v4-smoke-pack', version: '1.0.0' }
]
export const V4_MODEL_LABEL = 'Model, labelled by a V4 pack'

export const v4PackSource = `
import { comfy } from '/comfy/api/v4.js'

const packId = comfy.registerPack(import.meta)
comfy.defs.extend(packId, 'KSampler', (builder) => {
  builder.onCreated((node, event) => {
    if (!event.loading)
      node.inputs.byName('model')?.modify({ label: '${V4_MODEL_LABEL}' })
  })
})
`
