import { isEqual } from 'es-toolkit'
import { effectScope, watch } from 'vue'
import type { EffectScope } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { linkedConcatSlots } from '@/composables/videoConcat/linkedConcatSlots'
import { translateOrder } from '@/composables/videoConcat/videoConcatOrder'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IVideoConcatWidget } from '@comfyorg/graph-model/widgets'

export function syncConcatOrderWithLinks(
  node: LGraphNode,
  widget: IVideoConcatWidget,
  source: string
) {
  let scope: EffectScope | undefined

  function stop() {
    scope?.stop()
    scope = undefined
  }

  function start() {
    stop()
    scope = effectScope(true)
    scope.run(() => {
      watch(
        () => linkedConcatSlots(node, source),
        (current, previous) => {
          const order = widget.value.order ?? []
          const translated = translateOrder(order, previous, current)
          if (!isEqual(translated, order)) {
            widget.value = { ...widget.value, order: translated }
          }
        }
      )
    })
  }

  if (node.graph) start()
  node.onAdded = useChainCallback(node.onAdded, start)
  node.onRemoved = useChainCallback(node.onRemoved, stop)
}
