import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { NodeEvent } from '@/lib/litegraph/src/infrastructure/LGraphNodeEventMap'
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

  async nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'ImageCompare') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 350)])

    node.on(NodeEvent.EXECUTED, ({ output }) => {
      const { a_images: aImages, b_images: bImages } =
        output as ImageCompareOutput
      const rand = app.getRandParam()

      const toUrl = (record: Record<string, string>) => {
        const params = new URLSearchParams(record)
        return api.apiURL(`/view?${params}${rand}`)
      }

      const beforeImages =
        aImages && aImages.length > 0 ? aImages.map(toUrl) : []
      const afterImages =
        bImages && bImages.length > 0 ? bImages.map(toUrl) : []

      const widget = node.widgets?.find((w) => w.type === 'imagecompare')

      if (widget) {
        widget.value = { beforeImages, afterImages }
        widget.callback?.(widget.value)
      }
    })
  }
})
