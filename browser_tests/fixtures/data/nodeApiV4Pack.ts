export const V4_PACK_SCRIPT = '/extensions/v4-smoke-pack/main.js'
export const V4_MODEL_LABEL = 'Model, labelled by a V4 pack'

/** Pack script that imports the published V4 module and labels the `model` input of each KSampler the user adds. */
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
