import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { Viewport3d } from '@/extensions/core/load3d/Viewport3d'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

type WidgetCallback = (value: unknown, ...rest: unknown[]) => void

export interface WirableWidget {
  name: string
  value: unknown
  callback?: WidgetCallback
}

interface NodeWithWirableWidgets {
  widgets?: WirableWidget[]
}

type ViewportStatus = Pick<
  Viewport3d,
  'updateStatusMouseOnNode' | 'refreshViewport'
>

interface NodeWiringHooks {
  viewport: () => ViewportStatus | null | undefined
  onConnectionsChange?: () => void
}

export function useViewportNodeWiring() {
  const wrappedWidgets: { widget: WirableWidget; original?: WidgetCallback }[] =
    []
  const wrappedSet = new WeakSet<WirableWidget>()
  let wiredNode: LGraphNode | null = null
  let originalOnMouseEnter: LGraphNode['onMouseEnter']
  let originalOnMouseLeave: LGraphNode['onMouseLeave']
  let originalOnConnectionsChange: LGraphNode['onConnectionsChange']

  function wireWidgets(
    node: NodeWithWirableWidgets,
    names: readonly string[],
    onChange: (widget: WirableWidget) => void
  ): void {
    for (const name of names) {
      const widget = node.widgets?.find((w) => w.name === name)
      if (!widget || wrappedSet.has(widget)) continue
      wrappedSet.add(widget)
      const original = widget.callback
      wrappedWidgets.push({ widget, original })
      widget.callback = (value, ...rest) => {
        original?.call(widget, value, ...rest)
        onChange(widget)
      }
    }
  }

  function wireNode(node: LGraphNode, hooks: NodeWiringHooks): void {
    unwireNode()
    wiredNode = node
    originalOnMouseEnter = node.onMouseEnter
    originalOnMouseLeave = node.onMouseLeave
    originalOnConnectionsChange = node.onConnectionsChange
    node.onMouseEnter = useChainCallback(node.onMouseEnter, () => {
      const viewport = hooks.viewport()
      viewport?.updateStatusMouseOnNode(true)
      viewport?.refreshViewport()
    })
    node.onMouseLeave = useChainCallback(node.onMouseLeave, () => {
      hooks.viewport()?.updateStatusMouseOnNode(false)
    })
    if (hooks.onConnectionsChange) {
      node.onConnectionsChange = useChainCallback(
        node.onConnectionsChange,
        hooks.onConnectionsChange
      )
    }
  }

  function unwireNode(): void {
    if (!wiredNode) return
    wiredNode.onMouseEnter = originalOnMouseEnter
    wiredNode.onMouseLeave = originalOnMouseLeave
    wiredNode.onConnectionsChange = originalOnConnectionsChange
    wiredNode = null
  }

  function unwire(): void {
    for (const { widget, original } of wrappedWidgets) {
      widget.callback = original
      wrappedSet.delete(widget)
    }
    wrappedWidgets.length = 0
    unwireNode()
  }

  return { wireWidgets, wireNode, unwire }
}
