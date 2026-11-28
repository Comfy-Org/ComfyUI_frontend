import type { GraphOrSubgraph } from '@comfyorg/graph-model/entityRegistry'
import { reportError } from '@comfyorg/telemetry/reportError'

import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { prepareNodeConstruction } from '@/lib/litegraph/src/nodeConstruction'
import type { NodeConstructionResult } from '@/lib/litegraph/src/nodeConstruction'
import { withNodeAddSource } from '@/platform/telemetry/nodeAdded/nodeAddSource'

type GroupEffectPhase = 'links' | 'widgets' | 'reconnect'
type GroupEffect = {
  phase: GroupEffectPhase
  apply: () => void
  compensate?: () => void
}
type GroupExpansionPhase =
  | GroupEffectPhase
  | 'construction'
  | 'configure'
  | 'attach'
  | 'remove'
  | 'complete'

type ConvertToNodesResult =
  | { readonly refused: false; readonly nodes: LGraphNode[] }
  | { readonly refused: true; readonly memberType: string }
  | {
      readonly refused: true
      readonly memberType: string
      readonly interference: {
        phase: GroupExpansionPhase
        cause: unknown
        cleanupErrors: unknown[]
      }
    }

function reportUnavailableDefinition(
  result: NodeConstructionResult | ReturnType<typeof prepareNodeConstruction>
): void {
  if (result.kind === 'refused' && result.reason === 'missing-owned-definition')
    result.report()
}

function prepareRequiredMembers(
  types: readonly (string | undefined)[],
  graph: GraphOrSubgraph
) {
  const preparations = types.map((type) =>
    prepareNodeConstruction(LiteGraph, { type: type ?? '<unknown>', graph })
  )
  const ready: Extract<
    ReturnType<typeof prepareNodeConstruction>,
    { kind: 'ready' }
  >[] = []
  for (const [index, prepared] of preparations.entries()) {
    if (prepared.kind === 'refused') {
      reportUnavailableDefinition(prepared)
      return { refused: true as const, memberType: types[index] ?? '<unknown>' }
    }
    ready.push(prepared)
  }
  return { refused: false as const, preparations: ready }
}

function hasExpectedMembership(
  member: LGraphNode,
  graph: GraphOrSubgraph,
  attached: boolean
): boolean {
  const belongsToGraph =
    member.graph === graph && graph.getNodeById(member.id) === member
  if (attached) return belongsToGraph
  return (
    (member.graph === null || member.graph === graph) &&
    graph.getNodeById(member.id) !== member
  )
}

function runGroupChange({
  graph,
  canvas,
  expand,
  fail
}: {
  graph: GraphOrSubgraph
  canvas: LGraphCanvas
  expand: () => ConvertToNodesResult
  fail: (cause: unknown) => ConvertToNodesResult
}): ConvertToNodesResult {
  const isVisible = canvas.graph === graph
  let result: ConvertToNodesResult
  try {
    if (isVisible) canvas.emitBeforeChange()
    graph.beforeChange()
    result = expand()
  } catch (cause) {
    result = fail(cause)
  } finally {
    try {
      graph.afterChange()
    } catch (cause) {
      result = fail(cause)
    } finally {
      if (isVisible) {
        try {
          canvas.emitAfterChange()
        } catch (cause) {
          result = fail(cause)
        }
      }
    }
  }
  return result
}

function removeOwnedNodes(
  nodes: readonly LGraphNode[],
  graph: GraphOrSubgraph
) {
  const errors: unknown[] = []
  for (const node of [...nodes].reverse()) {
    try {
      if (node.graph === graph && graph.getNodeById(node.id) === node) {
        graph.remove(node, { force: true, preserveSubgraphDefinitions: true })
      }
      if (node.graph?.getNodeById(node.id) === node)
        errors.push('Member remains attached after cleanup')
    } catch (cause) {
      errors.push(cause)
    }
  }
  return errors
}

export function expandLegacyGroup({
  group,
  canvas,
  types,
  configure,
  effects
}: {
  group: LGraphNode
  canvas: LGraphCanvas
  types: readonly (string | undefined)[]
  configure: (node: LGraphNode, index: number) => void
  effects: (nodes: LGraphNode[]) => Iterable<GroupEffect>
}): ConvertToNodesResult {
  const graph = group.graph
  if (!graph) return { refused: false, nodes: [] }
  const preparation = prepareRequiredMembers(types, graph)
  if (preparation.refused) return preparation

  const staged: Extract<NodeConstructionResult, { kind: 'created' }>[] = []
  const attached = new Set<LGraphNode>()
  const compensations: (() => void)[] = []
  let phase: GroupExpansionPhase = 'construction'
  let memberType = '<unknown>'
  const fail = (cause: unknown): ConvertToNodesResult => {
    const cleanupErrors = removeOwnedNodes(
      staged.map(({ node }) => node),
      graph
    )
    for (const built of staged) {
      if (built.node.graph?.getNodeById(built.node.id) === built.node) continue
      try {
        built.cancelUnattachedSubscriptions()
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    for (const compensate of compensations.splice(0).reverse()) {
      try {
        compensate()
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    reportError(cause, {
      errorType: 'failure_expanding_legacy_group',
      surface: 'graph',
      context: { phase, memberType, cleanupFailures: cleanupErrors.length }
    })
    return {
      refused: true,
      memberType,
      interference: { phase, cause, cleanupErrors }
    }
  }
  const validate = (): ConvertToNodesResult | undefined => {
    const originalPresent =
      group.graph === graph && graph.getNodeById(group.id) === group
    const expectOriginal = phase !== 'remove' && phase !== 'complete'
    if (originalPresent !== expectOriginal)
      return fail('Original group membership changed during expansion')
    for (const built of staged) {
      const member = built.node
      if (
        !built.isCurrent() ||
        !hasExpectedMembership(member, graph, attached.has(member))
      ) {
        memberType = member.type
        return fail('Group member ownership changed during expansion')
      }
    }
  }
  for (const [index, prepared] of preparation.preparations.entries()) {
    memberType = types[index] ?? '<unknown>'
    const result = prepared.construct()
    if (result.kind !== 'created') {
      reportUnavailableDefinition(result)
      return fail(result.kind === 'failed' ? result.cause : result)
    }
    staged.push(result)
    const failure = validate()
    if (failure) return failure
  }
  const nodes = staged.map(({ node }) => node)
  const steps = function* (): Iterable<{
    phase: GroupExpansionPhase
    apply: () => void
    compensate?: () => void
  }> {
    for (const [index, node] of nodes.entries()) {
      yield { phase: 'configure', apply: () => configure(node, index) }
      yield {
        phase: 'attach',
        apply: () => {
          attached.add(node)
          withNodeAddSource('paste', () => graph.add(node, true))
        }
      }
    }
    yield* effects(nodes)
    yield { phase: 'remove', apply: () => graph.remove(group) }
  }
  const expand = (): ConvertToNodesResult => {
    const initialFailure = validate()
    if (initialFailure) return initialFailure
    for (const step of steps()) {
      phase = step.phase
      if ('compensate' in step && step.compensate)
        compensations.push(step.compensate)
      step.apply()
      const failure = validate()
      if (failure) return failure
    }
    return { refused: false, nodes }
  }
  const result = runGroupChange({ graph, canvas, expand, fail })
  if (result.refused) return result
  phase = 'complete'
  return validate() ?? result
}

function hasReceivingOwnership(
  nodes: readonly LGraphNode[],
  graph: GraphOrSubgraph
): boolean {
  const pending = nodes.map((node) => ({ node, graph }))
  const visited = new Set<GraphOrSubgraph>()
  for (const { node, graph: receiver } of pending) {
    if (node.graph !== receiver || receiver.getNodeById(node.id) !== node)
      return false
    if (!node.isSubgraphNode()) continue
    if (graph.rootGraph.subgraphs.get(node.subgraph.id) !== node.subgraph)
      return false
    if (visited.has(node.subgraph)) continue
    visited.add(node.subgraph)
    pending.push(
      ...node.subgraph.nodes.map((inner) => ({
        node: inner,
        graph: node.subgraph
      }))
    )
  }
  return true
}

export function completeGroupMigration(
  graph: GraphOrSubgraph,
  nodes: readonly LGraphNode[]
): boolean {
  let ownedNodes = [...nodes]
  const fail = (cause: unknown) => {
    const cleanupErrors = removeOwnedNodes(ownedNodes, graph)
    reportError(cause, {
      errorType: 'failure_migrating_legacy_group',
      surface: 'graph',
      context: {
        rootGraphId: graph.rootGraph.id,
        cleanupFailures: cleanupErrors.length
      }
    })
    return false
  }
  try {
    if (!hasReceivingOwnership(nodes, graph))
      return fail('Expanded members lost receiving ownership')
    for (const node of nodes) {
      node.updateArea()
      if (!hasReceivingOwnership(nodes, graph))
        return fail('Expanded members lost receiving ownership')
    }
    const converted = graph.convertToSubgraph(new Set(nodes))
    ownedNodes = [...nodes, converted.node]
    if (!hasReceivingOwnership([converted.node], graph))
      return fail('Migrated host lost receiving ownership')
    return true
  } catch (cause) {
    return fail(cause)
  }
}
