/**
 * Frontend-node resolution — the system that turns "virtual" nodes into
 * ordinary links and values at prompt time.
 *
 * This replaces `isVirtualNode` + `applyToGraph()`, which runs pack callbacks
 * that mutate the live graph in the middle of serialization
 * (`executionUtil.ts:38` — core does it too). Under ECS that is a system with
 * side effects: not replayable, corrupts the document if it throws halfway,
 * and syncs phantom mutations under CRDT.
 *
 * Here resolution is a pure derivation. A pack's resolver answers a question
 * about its own outputs against a read-only view; this pass follows the
 * answers (Get → Set → Reroute → …) to a fixpoint. Nothing is written
 * anywhere: a resolver that throws poisons one prompt build and the graph is
 * untouched, which is the property `applyToGraph` structurally cannot have.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { inputLink } from '@/lib/litegraph/src/node/slotLinks'
import { toNodeId } from '@/types/nodeId'

import type { WidgetValue } from './widgetHandle'

/**
 * "Whatever feeds this input." The only way one resolution names another.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface InputRef {
  readonly nodeId: string
  readonly input: number
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type OutputResolution =
  | { readonly omit: true }
  | { readonly forwardTo: InputRef }
  | { readonly literal: WidgetValue }

/**
 * What a resolver may see. Reads only — there is nothing here that writes.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface ResolvedNodeView {
  readonly id: string
  readonly type: string
  /**
   * The node's own properties, frozen.
   *
   * A broadcaster keeps its per-node opt-in here — cg-use-everywhere reads
   * `properties.ue_properties` to decide what it may feed. Candidate inputs
   * already carry `nodeProperties`, so without this a supplier could read
   * every node's configuration except its own.
   */
  readonly properties: Readonly<Record<string, unknown>>
  widgetValue(name: string): WidgetValue | undefined
  input(ref: string | number): InputRef | undefined
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface ResolveView {
  readonly self: ResolvedNodeView
  nodesOfType(type: string): readonly ResolvedNodeView[]
}

export type Resolver = (view: ResolveView) => Record<string, OutputResolution>

/** Where an output ends up after every frontend node in the chain resolves. */
export type ResolvedSource =
  | {
      readonly kind: 'output'
      readonly nodeId: string
      readonly output: number
    }
  | { readonly kind: 'literal'; readonly value: WidgetValue }
  | { readonly kind: 'omitted'; readonly reason: string }

const key = (nodeId: string, output: number) => `${nodeId}:${output}`

function viewOf(graph: LGraph, nodeId: string): ResolvedNodeView | undefined {
  const node = graph.getNodeById(toNodeId(nodeId))
  if (!node) return undefined
  return {
    id: String(node.id),
    type: node.type ?? '',
    properties: Object.freeze({ ...(node.properties ?? {}) }),
    widgetValue: (name) =>
      node.widgets?.find((w) => w.name === name)?.value as
        | WidgetValue
        | undefined,
    input: (ref) => {
      const index =
        typeof ref === 'number'
          ? ref
          : (node.inputs?.findIndex((i) => i.name === ref) ?? -1)
      if (index < 0 || index >= (node.inputs?.length ?? 0)) return undefined
      return { nodeId: String(node.id), input: index }
    }
  }
}

/**
 * Resolves every output of every frontend node in the graph.
 *
 * Pure over the graph: the result is a map, the graph is never written. The
 * caller (the prompt builder) substitutes sources while it serializes.
 */
export function resolveFrontendNodes(
  graph: LGraph,
  resolvers: ReadonlyMap<string, Resolver>
): ReadonlyMap<string, ResolvedSource> {
  const resolved = new Map<string, ResolvedSource>()

  /** One resolver call per node, memoised — resolvers must be pure anyway. */
  const answers = new Map<string, Record<string, OutputResolution>>()
  const answersFor = (nodeId: string, type: string) => {
    let answer = answers.get(nodeId)
    if (!answer) {
      const resolver = resolvers.get(type)
      const self = viewOf(graph, nodeId)
      answer =
        resolver && self
          ? resolver({
              self,
              nodesOfType: (wanted) =>
                (graph.nodes ?? [])
                  .filter((n) => n.type === wanted)
                  .map((n) => viewOf(graph, String(n.id)))
                  .filter((v): v is ResolvedNodeView => v !== undefined)
            })
          : {}
      answers.set(nodeId, answer)
    }
    return answer
  }

  /** Follows one output to its final source. `trail` catches cycles. */
  function follow(
    nodeId: string,
    output: number,
    trail: Set<string>
  ): ResolvedSource {
    const k = key(nodeId, output)
    const already = resolved.get(k)
    if (already) return already
    if (trail.has(k)) {
      return { kind: 'omitted', reason: `cycle through ${k}` }
    }
    trail.add(k)

    const node = graph.getNodeById(toNodeId(nodeId))
    if (!node) return { kind: 'omitted', reason: `no node ${nodeId}` }

    // A node with no resolver is a real backend node: the chain ends here.
    if (!resolvers.has(node.type ?? '')) {
      return { kind: 'output', nodeId, output }
    }

    const outputName = node.outputs?.[output]?.name ?? String(output)
    const answer =
      answersFor(nodeId, node.type ?? '')[outputName] ??
      answersFor(nodeId, node.type ?? '')[String(output)]

    let source: ResolvedSource
    if (!answer || 'omit' in answer) {
      source = {
        kind: 'omitted',
        reason: answer ? 'omitted by resolver' : 'no resolution for output'
      }
    } else if ('literal' in answer) {
      source = { kind: 'literal', value: answer.literal }
    } else {
      // forwardTo names an input; the source is whatever link feeds it, and
      // that source may itself be a frontend node — hence the recursion.
      const target = graph.getNodeById(toNodeId(answer.forwardTo.nodeId))
      const link = target
        ? inputLink(graph, target.id, answer.forwardTo.input)
        : undefined
      source = link
        ? follow(String(link.origin_id), link.origin_slot, trail)
        : {
            kind: 'omitted',
            reason: `nothing feeds ${answer.forwardTo.nodeId}:${answer.forwardTo.input}`
          }
    }
    resolved.set(k, source)
    return source
  }

  for (const node of graph.nodes ?? []) {
    if (!resolvers.has(node.type ?? '')) continue
    const outputs = node.outputs?.length ?? 0
    for (let output = 0; output < outputs; output++) {
      follow(String(node.id), output, new Set())
    }
  }
  return resolved
}

/** An input in the graph that no link feeds. */
export interface UnconnectedInput {
  readonly nodeId: string
  readonly nodeType: string
  readonly input: number
  readonly name: string
  readonly type: string
  /**
   * What the user actually sees on the slot — `label`, else `localized_name`,
   * else `name`. Broadcast packs match against this, not `name`, and the two
   * differ in every non-English locale.
   */
  readonly label: string
  /** The socket form of a widget rather than a plain input. */
  readonly isWidgetInput: boolean
  /** The owning node, for matching by title, mode, colour, or opt-in flags. */
  readonly nodeTitle: string
  readonly nodeMode: number
  readonly nodeColor: string | undefined
  /**
   * The owning node's properties, frozen.
   *
   * Broadcast packs keep their per-node opt-in here — which inputs a user has
   * allowed to be fed. Without it a supplier can only match by type and would
   * feed every unconnected input of that type, which is the silent
   * wrong-broadcast failure this view exists to prevent.
   */
  readonly nodeProperties: Readonly<Record<string, unknown>>
}

/**
 * An edge a node supplies into somebody else's unconnected input.
 *
 * `from` is the supplier's own output index, or a literal. It is deliberately
 * not an arbitrary node reference: a node may only offer what it itself has,
 * so one pack cannot rewire two other nodes to each other.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface SuppliedEdge {
  readonly to: InputRef
  readonly from:
    | { readonly output: number }
    | { readonly literal: WidgetValue }
    /**
     * Whatever feeds this node's own input `k` — for a node that rebroadcasts
     * its upstream rather than producing a value.
     *
     * The broadcast nodes this exists for have inputs and **no outputs**, so
     * `{ output: n }` cannot describe them: it would name a slot the backend
     * never declared and force it to execute a node that produces nothing.
     * Resolved exactly as `Resolver`'s `forwardTo`, so it chains through
     * reroutes for free.
     */
    | { readonly forwardInput: number }
}

export interface SupplyView {
  readonly self: ResolvedNodeView
  nodesOfType(type: string): readonly ResolvedNodeView[]
  /**
   * Every unfed input in the graph — what a broadcaster matches against by
   * type, by name, or by its own regex.
   */
  unconnectedInputs(): readonly UnconnectedInput[]
}

/**
 * Answers "what do I feed", the mirror of `Resolver`'s "what feeds me".
 *
 * `Resolver` is demand-side: it is asked about the resolver's own outputs, and
 * is never called for a node with none. cg-use-everywhere broadcasts a value
 * into every matching unconnected input in the graph, which that shape cannot
 * express at all — the nodes being fed are not the resolver, and the edges are
 * discovered rather than declared. Hence a second, supply-side pass.
 *
 */
export type Supplier = (view: SupplyView) => readonly SuppliedEdge[]

/**
 * Resolves the inputs that suppliers feed, keyed `nodeId:inputIndex`.
 *
 * Runs after `resolveFrontendNodes` and takes its result, so a supplier whose
 * own output is fed by a reroute chain still lands on the real source.
 *
 * Two suppliers claiming one input is a conflict with no correct answer, so
 * the first in graph order wins and the rest are ignored. Deterministic beats
 * clever: the alternative is a prompt that changes when nodes are reordered.
 */
/** What a supplier's `from` finally points at. */
function sourceFor(
  graph: LGraph,
  supplierId: LGraphNode['id'],
  from: SuppliedEdge['from'],
  resolved: ReadonlyMap<string, ResolvedSource>
): ResolvedSource {
  if ('literal' in from) return { kind: 'literal', value: from.literal }

  if ('forwardInput' in from) {
    // Whatever feeds the supplier's own input, exactly as `forwardTo` does.
    const link = inputLink(graph, supplierId, from.forwardInput)
    if (!link) {
      return {
        kind: 'omitted',
        reason: `nothing feeds ${String(supplierId)}:${from.forwardInput}`
      }
    }
    const origin = String(link.origin_id)
    return (
      resolved.get(key(origin, link.origin_slot)) ?? {
        kind: 'output',
        nodeId: origin,
        output: link.origin_slot
      }
    )
  }

  // The supplier may itself be a frontend node standing for something else,
  // so prefer what the demand-side pass already worked out for that output.
  return (
    resolved.get(key(String(supplierId), from.output)) ?? {
      kind: 'output',
      nodeId: String(supplierId),
      output: from.output
    }
  )
}

export function resolveSuppliedInputs(
  graph: LGraph,
  suppliers: ReadonlyMap<string, Supplier>,
  resolved: ReadonlyMap<string, ResolvedSource>
): ReadonlyMap<string, ResolvedSource> {
  const supplied = new Map<string, ResolvedSource>()
  if (!suppliers.size) return supplied

  const unconnected: UnconnectedInput[] = []
  for (const node of graph.nodes ?? []) {
    for (const [index, input] of (node.inputs ?? []).entries()) {
      if (input.link != null) continue
      unconnected.push({
        nodeId: String(node.id),
        nodeType: node.type ?? '',
        input: index,
        name: input.name ?? '',
        type: typeof input.type === 'string' ? input.type : String(input.type),
        label: input.label ?? input.localized_name ?? input.name ?? '',
        isWidgetInput: input.widget != null,
        nodeTitle: node.title ?? '',
        nodeMode: node.mode ?? 0,
        nodeColor: node.color,
        nodeProperties: Object.freeze({ ...(node.properties ?? {}) })
      })
    }
  }

  for (const node of graph.nodes ?? []) {
    const supplier = suppliers.get(node.type ?? '')
    const self = supplier ? viewOf(graph, String(node.id)) : undefined
    if (!supplier || !self) continue

    const edges = supplier({
      self,
      nodesOfType: (wanted) =>
        (graph.nodes ?? [])
          .filter((n) => n.type === wanted)
          .map((n) => viewOf(graph, String(n.id)))
          .filter((v): v is ResolvedNodeView => v !== undefined),
      unconnectedInputs: () => unconnected
    })

    for (const edge of edges) {
      const target = `${edge.to.nodeId}:${edge.to.input}`
      if (supplied.has(target)) continue

      supplied.set(target, sourceFor(graph, node.id, edge.from, resolved))
    }
  }

  return supplied
}
