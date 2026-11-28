import type {
  GraphOrSubgraph,
  LGraphNode,
  LiteGraphGlobal
} from '@comfyorg/graph-model/entityRegistry'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'

type CreateNodeOptions = NonNullable<
  Parameters<LiteGraphGlobal['createNode']>[2]
>
type NodeDefinition = Omit<
  NonNullable<LGraphNode['constructor']['nodeData']>,
  symbol
>

export const NODE_CREATION_GRAPH_FACTORY = Symbol('nodeCreationGraphFactory')

type CreationRequest = Readonly<{
  type: string
  title?: string
  options?: Omit<CreateNodeOptions, 'targetGraph'>
}>

type NodeCreationRefusal =
  | {
      kind: 'refused'
      reason: 'unregistered' | 'stale-preparation'
      type: string
    }
  | {
      kind: 'refused'
      reason: 'missing-owned-definition'
      type: string
      report: () => void
    }

type NodeConstructionPlan = Readonly<{
  kind: 'ready'
  construct: () => LGraphNode
  isCurrent: () => boolean
  cancel: () => void
}>

export interface NodeConstructionCapability {
  prepare: (
    request: CreationRequest & {
      registered: LiteGraphGlobal['registered_node_types'][string]
      title: string
      graph?: GraphOrSubgraph
    }
  ) => NodeCreationRefusal | NodeConstructionPlan
  definitionFor: (node: LGraphNode) => NodeDefinition | undefined
}

export type NodeConstructionResult =
  | NodeCreationRefusal
  | {
      kind: 'created'
      node: LGraphNode
      isCurrent: () => boolean
      cancelUnattachedSubscriptions: () => void
    }
  | {
      kind: 'failed'
      phase: 'constructor' | 'onNodeCreated'
      cause: unknown
    }

export type NodeConstructionPreparation =
  | NodeCreationRefusal
  | Readonly<{
      kind: 'ready'
      construct: () => NodeConstructionResult
    }>

export function nodeDefinition(node: LGraphNode): NodeDefinition | undefined {
  return (
    node.constructor[NODE_CREATION_GRAPH_FACTORY]?.definitionFor(node) ??
    node.constructor.nodeData
  )
}

function prepare(
  registry: Pick<LiteGraphGlobal, 'registered_node_types'>,
  request: CreationRequest & { graph?: GraphOrSubgraph }
): NodeConstructionPreparation {
  const { type, options } = request
  const registered = Object.hasOwn(registry.registered_node_types, type)
    ? registry.registered_node_types[type]
    : undefined
  if (!registered) return { kind: 'refused', reason: 'unregistered', type }

  const title = request.title || registered.title || type
  const capability = registered[NODE_CREATION_GRAPH_FACTORY]
  const plan = capability
    ? capability.prepare({ ...request, title, registered })
    : {
        kind: 'ready' as const,
        construct: () => new registered(title),
        isCurrent: () => true,
        cancel: () => {}
      }
  if (plan.kind === 'refused') return plan
  const isCurrent = () =>
    registry.registered_node_types[type] === registered && plan.isCurrent()

  return {
    kind: 'ready',
    construct: () => {
      if (!isCurrent()) {
        plan.cancel()
        return { kind: 'refused', reason: 'stale-preparation', type }
      }
      let node: LGraphNode
      try {
        node = plan.construct()
      } catch (cause) {
        plan.cancel()
        return { kind: 'failed', phase: 'constructor', cause }
      }
      node._state.type = type
      node.title ||= title
      node.mode ||= LGraphEventMode.ALWAYS
      if (options) Object.assign(node, options)
      try {
        node.onNodeCreated?.()
      } catch (cause) {
        plan.cancel()
        return { kind: 'failed', phase: 'onNodeCreated', cause }
      }
      if (!isCurrent()) {
        plan.cancel()
        return { kind: 'refused', reason: 'stale-preparation', type }
      }
      return {
        kind: 'created',
        node,
        isCurrent,
        cancelUnattachedSubscriptions: plan.cancel
      }
    }
  }
}

export function prepareNodeConstruction(
  registry: Pick<LiteGraphGlobal, 'registered_node_types'>,
  request: CreationRequest & { graph: GraphOrSubgraph }
): NodeConstructionPreparation {
  return prepare(registry, request)
}

export function createLegacyNode(
  registry: Pick<
    LiteGraphGlobal,
    'registered_node_types' | 'catch_exceptions' | 'debug'
  >,
  type: string,
  title?: string,
  options?: CreateNodeOptions
): LGraphNode | null {
  const { targetGraph: graph, ...nodeOptions } = options ?? {}
  const prepared = prepare(registry, {
    type,
    title,
    graph,
    options: nodeOptions
  })
  const result = prepared.kind === 'ready' ? prepared.construct() : prepared
  switch (result.kind) {
    case 'created':
      return result.node
    case 'refused':
      if (result.reason === 'missing-owned-definition') result.report()
      else if (result.reason === 'unregistered' && registry.debug)
        console.warn(`GraphNode type "${type}" not registered.`)
      return null
    case 'failed':
      if (result.phase === 'onNodeCreated' || !registry.catch_exceptions)
        throw result.cause
      console.error(result.cause)
      return null
  }
}
