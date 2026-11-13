import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'

import type { LiveNode as LiveNodeOnGraph } from '@/platform/nodeApi/v4/nodeHandle'

/** A node as the API finds it now, with the widgets a handle can reach. */
export interface LiveNode {
  readonly graph: LGraph
  readonly node: LGraphNode
  readonly widgets: readonly BaseWidget[]
}

export interface NodeAccess {
  /** The node, or nothing once it is deleted or its document is replaced. */
  live(): LiveNode | undefined
  read<T>(reader: (found: LiveNode) => T): T | undefined
}

export function nodeAccess(
  locate: () => LiveNodeOnGraph | undefined
): NodeAccess {
  function live(): LiveNode | undefined {
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
