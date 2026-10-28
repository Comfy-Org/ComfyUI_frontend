import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'

import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'

/** Matches interior node-level errors that are not lifted to the host. */
export interface PromotedWidgetExecutionSource {
  executionId: NodeExecutionId
  widgetName: string
}

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
