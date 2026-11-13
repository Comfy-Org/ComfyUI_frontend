import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { inputLink } from '@/lib/litegraph/src/node/slotLinks'

import type {
  ResolvedSource,
  ResolvedSupply,
  Resolver
} from '@/platform/nodeApi/v4/types'
import { runs } from './nodeModes'
import type { Resolutions } from './resolution'
import type { GraphSupplies, Supply } from './supply'

interface Walk {
  readonly graph: LGraph
  readonly resolverFor: (node: LGraphNode) => Resolver | undefined
  readonly resolutions: Resolutions
  readonly visited: Set<string>
}

const OMITTED: ResolvedSource = Object.freeze({ kind: 'omitted' })
const LITERAL: ResolvedSource = Object.freeze({ kind: 'literal' })

/** The supplies of `graph`, frozen, each with the output in the graph a link from it would start at. */
export function resolvedSuppliesIn(
  graph: LGraph,
  supplies: GraphSupplies,
  resolverFor: (node: LGraphNode) => Resolver | undefined,
  resolutions: Resolutions
): readonly ResolvedSupply[] {
  return Object.freeze(
    supplies.all.map((supply) =>
      Object.freeze({
        supplierNodeId: String(supply.supplier.id),
        to: Object.freeze({ nodeId: supply.nodeId, input: supply.input }),
        from: sourceInGraph(graph, supply, resolverFor, resolutions)
      })
    )
  )
}

function sourceInGraph(
  graph: LGraph,
  { supplier, from }: Supply,
  resolverFor: (node: LGraphNode) => Resolver | undefined,
  resolutions: Resolutions
): ResolvedSource {
  const walk: Walk = { graph, resolverFor, resolutions, visited: new Set() }
  return from.kind === 'output'
    ? outputSource(walk, supplier, from.output)
    : inputSource(walk, supplier, from.input)
}

function outputSource(
  walk: Walk,
  node: LGraphNode,
  output: number
): ResolvedSource {
  const resolve = runs(node) ? walk.resolverFor(node) : undefined
  const resolution =
    resolve && walk.resolutions.outputOf(walk.graph, node, resolve, output)
  switch (resolution?.kind) {
    case undefined:
      return Object.freeze({ kind: 'output', nodeId: String(node.id), output })
    case 'omit':
      return OMITTED
    case 'literal':
      return LITERAL
    case 'forward':
      return inputSource(walk, resolution.node, resolution.input)
  }
}

function inputSource(
  walk: Walk,
  node: LGraphNode,
  input: number
): ResolvedSource {
  const key = `${node.id}:${input}`
  if (walk.visited.has(key)) return OMITTED
  walk.visited.add(key)
  const link = inputLink(walk.graph, node.id, input)
  const origin = link && walk.graph.getNodeById(link.origin_id)
  return link && origin ? outputSource(walk, origin, link.origin_slot) : OMITTED
}
