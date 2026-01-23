import type { NodeOutputWith } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'

type ImageCompareOutput = NodeOutputWith<{
  a_images?: Record<string, string>[]
  b_images?: Record<string, string>[]
}>

useExtensionService().registerExtension({
  name: 'Comfy.ImageCompare',

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'ImageCompare') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 350)])

    const onExecuted = node.onExecuted

    node.onExecuted = function (output: ImageCompareOutput) {
      onExecuted?.call(this, output)

      const { a_images: aImages, b_images: bImages } = output
      const rand = app.getRandParam()

      const beforeUrl =
        aImages && aImages.length > 0
          ? api.apiURL(`/view?${new URLSearchParams(aImages[0])}${rand}`)
          : ''
      const afterUrl =
        bImages && bImages.length > 0
          ? api.apiURL(`/view?${new URLSearchParams(bImages[0])}${rand}`)
          : ''

      const widget = node.widgets?.find((w) => w.type === 'imagecompare')

      if (widget) {
        widget.value = {
          before: beforeUrl,
          after: afterUrl
        }
        widget.callback?.(widget.value)
      }
    }
  }
})
