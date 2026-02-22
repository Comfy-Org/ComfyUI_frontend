import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { app } from '@/scripts/app'

export function resolveWidgetGraphId(node: LGraphNode): UUID {
  return node.graph?.rootGraph.id ?? app.rootGraph.id
}
