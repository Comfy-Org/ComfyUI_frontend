import { useChainCallback } from '@/composables/functional/useChainCallback'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import {
  SAFE_INTEGER_MAX,
  computeNextControlledValue
} from '@/scripts/valueControl'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.SeedNode',
  async beforeRegisterNodeDef(
    nodeType: typeof LGraphNode,
    nodeData: ComfyNodeDef
  ) {
    if (nodeData.name !== 'SeedNode') return

    nodeType.prototype.onNodeCreated = useChainCallback(
      nodeType.prototype.onNodeCreated,
      function (this: LGraphNode) {
        const seedWidget = this.widgets?.find((w) => w.name === 'seed')

        if (
          seedWidget?.options &&
          (typeof seedWidget.options.max !== 'number' ||
            seedWidget.options.max > SAFE_INTEGER_MAX)
        ) {
          seedWidget.options.max = SAFE_INTEGER_MAX
        }

        this.addWidget(
          'button',
          t('g.randomizeSeed'),
          '',
          () => {
            if (!seedWidget) return

            const nextValue = computeNextControlledValue(
              seedWidget,
              'randomize'
            )
            if (nextValue === undefined) return

            seedWidget.value = nextValue
            seedWidget.callback?.(seedWidget.value)
            this.setDirtyCanvas(true, true)
          },
          { serialize: false }
        )

        const newSize = this.computeSize()
        this.size[0] = Math.max(this.size[0], newSize[0])
        this.size[1] = Math.max(this.size[1], newSize[1])
      }
    )
  }
})
