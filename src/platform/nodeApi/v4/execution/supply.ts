import { reportError } from '@comfyorg/telemetry/reportError'
import { isPlainObject, once } from 'es-toolkit'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { inputHasLink } from '@/lib/litegraph/src/node/slotLinks'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import {
  callListener,
  reportIfRejected
} from '@/platform/nodeApi/shared/listeners'
import type {
  Supplier,
  SupplyView,
  UnconnectedInput
} from '@/platform/nodeApi/v4/types'
import { runs } from './nodeModes'
import type { NodeViews } from './nodeView'
import { shownName } from './nodeView'

type SupplySource =
  | { readonly kind: 'output'; readonly output: number }
  | { readonly kind: 'forwardInput'; readonly input: number }

/** The claim that feeds an input. */
export interface Supply {
  readonly supplier: LGraphNode
  readonly nodeId: string
  readonly input: number
  readonly from: SupplySource
}

interface Claim {
  readonly supplier: LGraphNode
  readonly from: SupplySource
  readonly priority: number
}

/** The supplies of one graph, in the order of the inputs they feed. */
export interface GraphSupplies {
  readonly all: readonly Supply[]
  /** The supplies that feed `nodeId`, by input index. */
  feeding(nodeId: string): ReadonlyMap<number, Supply> | undefined
}

/** Asks each graph's suppliers once, the first time its supplies are needed. */
export function createSupplies(
  suppliersFor: (node: LGraphNode) => readonly Supplier[],
  views: NodeViews
): (graph: LGraph) => GraphSupplies {
  const known = new WeakMap<LGraph, GraphSupplies>()
  return (graph) => {
    const existing = known.get(graph)
    if (existing) return existing
    const supplies = graphSupplies(graph, suppliersFor, views)
    known.set(graph, supplies)
    return supplies
  }
}

function graphSupplies(
  graph: LGraph,
  suppliersFor: (node: LGraphNode) => readonly Supplier[],
  views: NodeViews
): GraphSupplies {
  const candidates = once(() => unconnectedInputs(graph, views))
  const candidateInputs = once(() => inputsByNode(candidates()))
  const listCandidates = Object.freeze(() => candidates())
  const claims = new Map<string, Claim[]>()
  for (const node of graph.nodes.filter(runs)) {
    const view: SupplyView = Object.freeze({
      self: views.viewOf(graph, node),
      unconnectedInputs: listCandidates
    })
    for (const supply of suppliersFor(node)) {
      const edges = callListener('setSupply', () => {
        const given = supply(view)
        reportIfRejected('setSupply', given)
        return checkedEdges(given, node, candidateInputs)
      })
      for (const { key, claim } of edges ?? []) {
        claims.set(key, [...(claims.get(key) ?? []), claim])
      }
    }
  }
  return winningSupplies(claims, claims.size ? candidates() : [])
}

function unconnectedInputs(
  graph: LGraph,
  views: NodeViews
): readonly UnconnectedInput[] {
  return Object.freeze(
    graph.nodes
      .filter((node) => !node.isVirtualNode)
      .flatMap((node) => unconnectedInputsOf(graph, node, views))
  )
}

function unconnectedInputsOf(
  graph: LGraph,
  node: LGraphNode,
  views: NodeViews
): UnconnectedInput[] {
  const view = views.viewOf(graph, node)
  const unlinked = node.inputs
    .map((input, index) => ({ input, index }))
    .filter(({ index }) => !inputHasLink(graph, node.id, index))
  return unlinked.map(({ input, index }) =>
    Object.freeze({
      nodeId: view.id,
      nodeType: view.type,
      nodeTitle: node.title,
      nodeMode: view.mode,
      nodeColor: view.color,
      get nodeGroups() {
        return view.groups
      },
      get nodeProperties() {
        return view.properties
      },
      input: index,
      name: input.name,
      label: shownName(input),
      type: String(input.type),
      isWidgetInput: input.widget !== undefined
    })
  )
}

function inputsByNode(
  candidates: readonly UnconnectedInput[]
): ReadonlyMap<string, ReadonlySet<number>> {
  const byNode = new Map<string, Set<number>>()
  for (const { nodeId, input } of candidates) {
    byNode.set(nodeId, (byNode.get(nodeId) ?? new Set<number>()).add(input))
  }
  return byNode
}

const EDGE_FIELDS = new Set(['to', 'from', 'priority'])

function checkedEdges(
  edges: unknown,
  supplier: LGraphNode,
  candidateInputs: () => ReadonlyMap<string, ReadonlySet<number>>
): readonly { key: string; claim: Claim }[] {
  if (!Array.isArray(edges)) {
    throw invalidArgument('setSupply', 'a list of supplied edges', edges)
  }
  return edges.map((edge: unknown) => {
    if (
      !isPlainObject(edge) ||
      Object.keys(edge).some((field) => !EDGE_FIELDS.has(field))
    ) {
      throw invalidArgument(
        'setSupply',
        'an edge of to, from and priority',
        edge
      )
    }
    return {
      key: targetKey(edge.to, candidateInputs()),
      claim: {
        supplier,
        from: checkedSource(edge.from, supplier),
        priority: checkedPriority(edge.priority)
      }
    }
  })
}

function targetKey(
  to: unknown,
  candidateInputs: ReadonlyMap<string, ReadonlySet<number>>
): string {
  const named =
    isPlainObject(to) &&
    Object.keys(to).length === 2 &&
    typeof to.nodeId === 'string' &&
    typeof to.input === 'number' &&
    candidateInputs.get(to.nodeId)?.has(to.input) === true
  if (!named) {
    throw invalidArgument('setSupply', 'a to of an unconnected input', to)
  }
  return `${to.nodeId}:${to.input}`
}

function checkedSource(from: unknown, supplier: LGraphNode): SupplySource {
  if (isPlainObject(from) && Object.keys(from).length === 1) {
    if (isSlotIndex(from.output, supplier.outputs.length)) {
      return Object.freeze({ kind: 'output', output: from.output })
    }
    if (isSlotIndex(from.forwardInput, supplier.inputs.length)) {
      return Object.freeze({ kind: 'forwardInput', input: from.forwardInput })
    }
  }
  throw invalidArgument(
    'setSupply',
    "a from of one of the supplier's own outputs or inputs",
    from
  )
}

function isSlotIndex(index: unknown, count: number): index is number {
  return Number.isInteger(index) && Number(index) >= 0 && Number(index) < count
}

function checkedPriority(priority: unknown): number {
  if (priority === undefined) return 0
  if (typeof priority === 'number' && Number.isFinite(priority)) return priority
  throw invalidArgument(
    'setSupply',
    'a priority that is a finite number',
    priority
  )
}

function winningSupplies(
  claims: ReadonlyMap<string, readonly Claim[]>,
  candidates: readonly UnconnectedInput[]
): GraphSupplies {
  const all: Supply[] = []
  const byNode = new Map<string, Map<number, Supply>>()
  for (const { nodeId, input } of candidates) {
    const key = `${nodeId}:${input}`
    const inputClaims = claims.get(key)
    const winner = inputClaims && winningClaim(key, inputClaims)
    if (!winner) continue
    const supply = Object.freeze({ ...winner, nodeId, input })
    all.push(supply)
    const feeding = byNode.get(nodeId) ?? new Map<number, Supply>()
    byNode.set(nodeId, feeding.set(input, supply))
  }
  return { all, feeding: (nodeId) => byNode.get(nodeId) }
}

function winningClaim(
  key: string,
  claims: readonly Claim[]
): Pick<Supply, 'supplier' | 'from'> | undefined {
  const top = Math.max(...claims.map(({ priority }) => priority))
  const distinct = new Map(
    claims
      .filter(({ priority }) => priority === top)
      .map(({ supplier, from }) => [
        `${supplier.id}:${from.kind}:${from.kind === 'output' ? from.output : from.input}`,
        { supplier, from }
      ])
  )
  if (distinct.size > 1) reportConflict(key)
  return distinct.size === 1 ? [...distinct.values()][0] : undefined
}

function reportConflict(input: string): void {
  reportError(
    new Error(`Equal highest claims on input ${input}; it is not fed.`),
    {
      errorType: 'node_api_supply_conflict',
      surface: 'platform',
      level: 'warning',
      tags: { input }
    }
  )
}
