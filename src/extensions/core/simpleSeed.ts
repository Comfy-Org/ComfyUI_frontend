import { useChainCallback } from '@/composables/functional/useChainCallback'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { SAFE_INTEGER_MAX } from '@/scripts/valueControl'
import { useExtensionService } from '@/services/extensionService'
import { t } from '@/i18n'

useExtensionService().registerExtension({
  name: 'Comfy.SimpleSeedNode',
  async beforeRegisterNodeDef(
    nodeType: typeof LGraphNode,
    nodeData: ComfyNodeDef
  ) {
    if (nodeData.name !== 'SimpleSeedNode') return

    nodeType.prototype.onNodeCreated = useChainCallback(
      nodeType.prototype.onNodeCreated,
      function (this: any) {
        this.addWidget(
          'button',
          t('g.randomizeSeed'),
          '',
          () => {
            const seedWidget = this.widgets?.find((w: any) => w.name === 'seed')

            if (seedWidget) {
              const min = typeof seedWidget.options?.min === 'number' ? seedWidget.options.min : 0
              const max = typeof seedWidget.options?.max === 'number' ? seedWidget.options.max : SAFE_INTEGER_MAX
              const step = (typeof seedWidget.options?.step === 'number' ? seedWidget.options.step : 1) || 1

              const range = (max - min) / step
              const randomSeed = min + Math.floor(Math.random() * (range + 1)) * step

              seedWidget.value = Math.min(max, Math.max(min, randomSeed))

              if (typeof seedWidget.callback === 'function') {
                seedWidget.callback(seedWidget.value)
              }

              this.setDirtyCanvas(true, true)
            } else {
              console.warn("[SimpleSeedNode] Could not find the 'seed' widget to randomize.")
            }
          },
          { serialize: false }
        )

        const newSize = this.computeSize()
        if (this.size[0] < newSize[0]) this.size[0] = newSize[0]
        if (this.size[1] < newSize[1]) this.size[1] = newSize[1]
      }
    )
  }
})
