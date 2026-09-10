import type { GraphMutationsDeps } from '@/core/graph/graphMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'

/**
 * Renderer-owned layout port for the in-app agent CRDT materializer.
 *
 * The follower core (`src/core/graph/graphMutations.ts` and
 * `src/workbench/extensions/agent/crdt/**`) never imports the renderer; the
 * composition root (`AgentPanelRoot.vue`) injects this port, mirroring the
 * mint-port seam in `crdt/mintPortWiring.ts`. The port shape is owned by
 * `GraphMutationsDeps['layout']`, so the renderer adapts to the semantic
 * contract rather than the other way round.
 *
 * See docs/adr/CRDT-FOLLOWER-0031-renderer-provided-layout-port-for-agent-materializer.md
 */
export function createAgentLayoutPort(): GraphMutationsDeps['layout'] {
  return {
    createNode(scope, nodeId, layout, context) {
      const { position, size } = layout
      layoutStore.applyOperation({
        type: 'createNode',
        graphId: scope.rootGraphId,
        ownerGraphId: scope.owningGraphId,
        nodeId,
        layout: {
          id: nodeId,
          position,
          size,
          bounds: { x: position.x, y: position.y, ...size },
          zIndex: layoutStore.allocateZIndex(),
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
      layoutStore.applyOperations(
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
    }
  }
}
