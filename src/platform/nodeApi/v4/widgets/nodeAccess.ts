import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'

import type { LiveNode } from '@/platform/nodeApi/v4/nodeHandle'

/** A node as the API finds it now, with the widgets a handle can reach. */
export interface NodeWithWidgets {
  readonly graph: LGraph
  readonly node: LGraphNode
  readonly widgets: readonly BaseWidget[]
}

export interface NodeAccess {
  /** The node, or nothing once it is deleted or its document is replaced. */
  live(): NodeWithWidgets | undefined
  read<T>(reader: (found: NodeWithWidgets) => T): T | undefined
}

export function nodeAccess(locate: () => LiveNode | undefined): NodeAccess {
  function live(): NodeWithWidgets | undefined {
    const found = locate()
    if (!found) return undefined
    const { graph, node } = found
    const widgets = (node.widgets ?? []).filter(
      (widget): widget is BaseWidget => widget instanceof BaseWidget
    )
    return { graph, node, widgets }
  }
  return {
    live,
    read(reader) {
      const found = live()
      return found && reader(found)
    }
  }
}
