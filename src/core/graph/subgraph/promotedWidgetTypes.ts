import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { NodeId } from '@/types/nodeId'

export interface ResolvedPromotedWidget {
  node: LGraphNode
  nodePath: NodeId[]
  widget: IBaseWidget
}

/**
 * A persisted promotion's source identity: the interior node + widget a host
 * subgraph input was promoted from. Used by the migration/schema layer, where
 * the source is a stored tuple rather than something link-derivable.
 */
export interface PromotedWidgetSource {
  sourceNodeId: NodeId
  sourceWidgetName: string
}
