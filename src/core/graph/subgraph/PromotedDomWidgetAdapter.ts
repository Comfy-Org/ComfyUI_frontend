import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { BaseDOMWidget } from '@/scripts/domWidget'
import { generateUUID } from '@/utils/formatUtil'

import type { PromotedWidgetSlot } from './PromotedWidgetSlot'

/**
 * Properties delegated to the PromotedWidgetSlot instead of the inner widget.
 */
type SlotManagedKey = 'y' | 'last_y' | 'computedHeight'
const SLOT_MANAGED = new Set<string>([
  'y',
  'last_y',
  'computedHeight'
] satisfies SlotManagedKey[])

/**
 * Creates a Proxy-based adapter that makes an interior DOM widget appear to
 * belong to the SubgraphNode (host).
 *
 * `DomWidgets.vue` positions DOM widgets using `widget.node.pos` and
 * `widget.y`. This proxy overrides those to reference the host node and the
 * PromotedWidgetSlot's positional state, so the DOM element renders at the
 * correct location on the parent graph.
 *
 * Only ONE of {adapter, interior widget} should be registered in
 * `domWidgetStore` at a time.
 */
export function createPromotedDomWidgetAdapter<V extends object | string>(
  inner: BaseDOMWidget<V>,
  hostNode: LGraphNode,
  slot: PromotedWidgetSlot
): BaseDOMWidget<V> & { readonly innerWidget: BaseDOMWidget<V> } {
  const adapterId = generateUUID()

  type Adapted = BaseDOMWidget<V> & { readonly innerWidget: BaseDOMWidget<V> }

  return new Proxy(inner as Adapted, {
    get(target, prop, receiver) {
      switch (prop) {
        case 'id':
          return adapterId
        case 'node':
          return hostNode
        case 'promoted':
        case 'serialize':
          return false
        case 'innerWidget':
          return target
        case 'isVisible':
          return function isVisible() {
            return !target.hidden && hostNode.isWidgetVisible(receiver)
          }
      }

      if (SLOT_MANAGED.has(prop as string))
        return (slot as IBaseWidget)[prop as SlotManagedKey]

      return Reflect.get(target, prop, receiver)
    },

    set(target, prop, value) {
      if (SLOT_MANAGED.has(prop as string)) {
        const widget: IBaseWidget = slot
        widget[prop as SlotManagedKey] = value
        return true
      }

      return Reflect.set(target, prop, value)
    }
  })
}
