import { expectTypeOf, it } from 'vitest'

import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { BaseLGraph } from '#/LGraph'
import type {
  ContextMenu,
  LGraph,
  LGraphNode,
  LGraphNodeConstructor,
  Subgraph
} from '#/litegraph'
import type { GraphOrSubgraph } from '#/subgraph/Subgraph'
import type { Rectangle } from '#/infrastructure/Rectangle'
import type * as Entities from '@comfyorg/graph-model/entityRegistry'
import type { LGraphNodeConstructor as NodeConstructor } from './nodeConstructor'
import type { NodeBindable } from '@comfyorg/graph-model/widgets'

it('preserves concrete graph, node, constructor, and generic menu contracts', () => {
  expectTypeOf<Entities.LGraph>().toEqualTypeOf<LGraph>()
  expectTypeOf<Entities.LGraphNode>().toEqualTypeOf<LGraphNode>()
  expectTypeOf<Entities.Rectangle>().toEqualTypeOf<Rectangle>()
  expectTypeOf<Entities.BaseLGraph>().toEqualTypeOf<BaseLGraph>()
  expectTypeOf<
    Entities.LitegraphEntityRegistry['GraphOrSubgraph']
  >().toEqualTypeOf<GraphOrSubgraph>()
  expectTypeOf<GraphOrSubgraph>().toEqualTypeOf<LGraph | Subgraph>()
  expectTypeOf<NodeBindable>().toEqualTypeOf<{
    setNodeId(nodeId: NodeId): void
  }>()
  expectTypeOf<LGraphNode['graph']>().toEqualTypeOf<LGraph | Subgraph | null>()
  expectTypeOf<NodeConstructor>().toEqualTypeOf<LGraphNodeConstructor>()
  expectTypeOf<Entities.ContextMenu<string>>().toEqualTypeOf<
    ContextMenu<string>
  >()
  expectTypeOf<Entities.ContextMenu>().toEqualTypeOf<ContextMenu>()
})
