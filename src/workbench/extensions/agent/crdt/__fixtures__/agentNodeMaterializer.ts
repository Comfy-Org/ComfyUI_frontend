import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'

import { createGraphMutations } from '@/core/graph/graphMutations'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
// eslint-disable-next-line import-x/no-restricted-paths
import { LayoutSource } from '@/renderer/core/layout/types'
import type { GraphScope } from '@/types/graphScopeId'
import { graphScopeOf } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'

export class DummyNode extends LGraphNode {
  constructor() {
    super('dummy')
  }
}

export class WidgetNode extends LGraphNode {
  constructor() {
    super('widget-node')
    this.serialize_widgets = true
    this.addWidget('number', 'value', 0, () => {})
  }
}

export class TwoWidgetNode extends LGraphNode {
  constructor() {
    super('two-widget-node')
    this.serialize_widgets = true
    this.addWidget('number', 'steps', 0, () => {})
    this.addWidget('number', 'seed', 0, () => {})
  }
}

export class ThreeWidgetNode extends LGraphNode {
  constructor() {
    super('three-widget-node')
    this.serialize_widgets = true
    this.addWidget('number', 'a', 0, () => {})
    this.addWidget('number', 'b', 0, () => {})
    this.addWidget('number', 'c', 0, () => {})
  }
}

export class LateWidgetNode extends WidgetNode {}
export class LateTwoWidgetNode extends TwoWidgetNode {}

/** Widget values observed by `onConfigure`, in configure order. */
export const configuredWidgetValues: unknown[] = []

class ConfigureCapturingWidgetNode extends WidgetNode {
  override onConfigure(): void {
    configuredWidgetValues.push(this.widgets?.[0]?.value)
  }
}

/** Toggled per test; a definition holding this type fails to instantiate. */
let configureShouldThrow = false

export function setConfigureShouldThrow(value: boolean): void {
  configureShouldThrow = value
}

export class ThrowsOnConfigureNode extends LGraphNode {
  constructor() {
    super('throws-on-configure')
  }

  override onConfigure(): void {
    if (configureShouldThrow) throw new Error('interior node rejected')
  }

  override onRemoved(): void {}
}

export class ThrowsOnAddedNode extends LGraphNode {
  constructor() {
    super('throws-on-added')
  }

  override onAdded(): void {
    throw new Error('extension code blew up in onAdded')
  }

  // Declared (as a no-op) so a test can make the rollback's own cleanup throw.
  // `LGraphNode.onRemoved` is optional, so it is absent from the prototype and
  // cannot be spied on otherwise.
  override onRemoved(): void {}
}

export const REMOTE: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'agent:test',
  opId: 'op-test'
}
export const CATALOG: WidgetCatalog = {
  types: {
    dummy: { widget_order: [] },
    'widget-node': { widget_order: ['value'] },
    'configure-capture': { widget_order: ['value'] },
    'throws-on-configure': { widget_order: [] }
  }
}

export function agentOperation(id: string, version: number, payload: object) {
  return {
    op_id: id,
    actor: 'agent:test',
    base_version: version,
    stamp: [version, 'agent:test', id],
    ...payload
  }
}

/**
 * Same layout port the agent panel wires in production: remote adds create
 * the layout entry with remote provenance BEFORE any live node exists, so a
 * later `LGraph.add()` adopts it instead of minting a canvas-sourced create.
 * A stubbed port would hide the add_node echo this test suite guards against.
 */
export function remoteMutations(scope: GraphScope) {
  return createGraphMutations({
    getScope: () => scope,
    layout: {
      createNode(scope, nodeId, { position, size }, context) {
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
  })
}

/** One node payload shape, complete enough for a definition's own `nodes`. */
export function nodePayload(id: number, type = 'dummy') {
  return {
    id,
    type,
    pos: [0, 0],
    size: [100, 80],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [],
    outputs: []
  } satisfies ISerialisedNode
}

/** Commit a remote add to the stores only, the way a follower frame does. */
export function seedAgentAddedNode(graph: LGraph, id: number, type = 'dummy') {
  const scope = graphScopeOf(graph)
  remoteMutations(scope).addNode(nodePayload(id, type), {
    ...REMOTE,
    opId: `op-${id}`
  })
  return scope
}

/** Registers the fixture node types and resets per-test toggles; call from `beforeEach`. */
export function setupMaterializerFixtures(): void {
  LiteGraph.registerNodeType('dummy', DummyNode)
  LiteGraph.registerNodeType('widget-node', WidgetNode)
  LiteGraph.registerNodeType('two-widget-node', TwoWidgetNode)
  LiteGraph.registerNodeType('configure-capture', ConfigureCapturingWidgetNode)
  LiteGraph.registerNodeType('throws-on-configure', ThrowsOnConfigureNode)
  LiteGraph.registerNodeType('throws-on-added', ThrowsOnAddedNode)
  configuredWidgetValues.length = 0
  setConfigureShouldThrow(false)
}
