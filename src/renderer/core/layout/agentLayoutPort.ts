import type { SemanticLayoutMutationPort } from '@/core/graph/graphMutations'
import type { layoutStore as LayoutStore } from './store/layoutStore'
import { LayoutSource } from './types'

/**
 * The agent's renderer-owned layout port (ADR-GRAPH-DOCUMENT-0024). Layout is
 * the one part of a graph mutation the semantic stores cannot reconstruct, so
 * this port also supplies the capture the canonical commit rolls back to when
 * a batch fails part-way through publishing.
 */
export function createAgentLayoutPort(
  layout: typeof LayoutStore
): SemanticLayoutMutationPort {
  return {
    createNode(scope, nodeId, nodeLayout, context) {
      const { position, size } = nodeLayout
      layout.applyOperation({
        type: 'createNode',
        graphId: scope.rootGraphId,
        ownerGraphId: scope.owningGraphId,
        nodeId,
        layout: {
          id: nodeId,
          position,
          size,
          bounds: { x: position.x, y: position.y, ...size },
          zIndex: layout.allocateZIndex(),
          visible: true
        },
        source: LayoutSource.AgentRemote,
        actor: context.actor,
        opId: context.opId,
        timestamp: Date.now()
      })
    },
    deleteNodes(scope, nodeIds, context) {
      const timestamp = Date.now()
      layout.applyOperations(
        nodeIds.map((nodeId) => ({
          type: 'deleteNode',
          graphId: scope.rootGraphId,
          ownerGraphId: scope.owningGraphId,
          nodeId,
          source: LayoutSource.AgentRemote,
          actor: context.actor,
          opId: context.opId,
          timestamp
        }))
      )
    },
    captureNodes(scope, nodeIds) {
      const captured = nodeIds.map(
        (nodeId) =>
          [nodeId, layout.getNodeLayout(scope.rootGraphId, nodeId)] as const
      )
      return {
        restore(context) {
          const common = {
            graphId: scope.rootGraphId,
            ownerGraphId: scope.owningGraphId,
            source: LayoutSource.AgentRemote,
            actor: context.actor,
            opId: context.opId,
            timestamp: Date.now()
          }
          // `createNode` refuses an occupied key, so every captured node is
          // cleared before the ones that had a layout are put back.
          layout.applyOperations([
            ...captured.map(([nodeId]) => ({
              type: 'deleteNode' as const,
              nodeId,
              ...common
            })),
            ...captured.flatMap(([nodeId, nodeLayout]) =>
              nodeLayout
                ? [
                    {
                      type: 'createNode' as const,
                      nodeId,
                      layout: { ...nodeLayout },
                      ...common
                    }
                  ]
                : []
            )
          ])
        }
      }
    }
  }
}
