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
  /** The groups this node sits inside — the other half of "my group". */
  readonly groups: readonly GroupMembership[]
  /** Muted, bypassed or normal, as `LGraphEventMode`. */
  readonly mode: number
  readonly color: string | undefined
  /**
   * This node's own inputs.
   *
   * `unconnectedInputs()` already describes every *other* node's slots, and a
   * supplier needs the same of its own: "send whatever is plugged into me to
   * every unconnected input of the same type" cannot be written without
   * knowing what type is plugged in. Without it a supplier is type-blind and
   * would feed a CLIP into a MODEL slot in silence.
   *
   * `type` is the slot's declared type; `connectedType` is what actually
   * arrives, resolved through reroutes, and is undefined when nothing is
   * connected.
   */
  readonly inputs: readonly OwnInput[]
  /** This node's own outputs, in slot order. */
  readonly outputs: readonly OwnOutput[]
  widgetValue(name: string): WidgetValue | undefined
  input(ref: string | number): InputRef | undefined
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface ResolveView {
  readonly self: ResolvedNodeView
  nodesOfType(type: string): readonly ResolvedNodeView[]
}

/**
 * May answer asynchronously: a sandboxed pack's resolver runs in a worker, so
 * its answer can only arrive as a promise. The prompt path awaits it; the
 * synchronous entry points (`input.resolvedSource()`, `resolvedSupplies()`)
 * treat a promise as unresolved and say so — see `resolution.async.test.ts`.
 */
export type Resolver = (
  view: ResolveView
) =>
  | Record<string, OutputResolution>
  | Promise<Record<string, OutputResolution>>

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

/**
 * The groups a node sits inside.
 *
 * Membership is geometric — a group holds whatever its rectangle overlaps —
 * so it is recomputed rather than read from anything stored. Computed once per
 * resolution pass and shared, because recomputing per node is quadratic on a
 * graph with many groups.
 */
function groupsByNodeId(graph: LGraph): ReadonlyMap<string, GroupMembership[]> {
  const byNode = new Map<string, GroupMembership[]>()
  for (const group of graph._groups ?? []) {
    group.recomputeInsideNodes()
    const membership: GroupMembership = Object.freeze({
      id: String(group.id),
      title: group.title
    })
    for (const node of group._nodes) {
      const key = String(node.id)
      const list = byNode.get(key)
      if (list) list.push(membership)
      else byNode.set(key, [membership])
    }
  }
  return byNode
}

function viewOf(
  graph: LGraph,
  nodeId: string,
  groups: ReadonlyMap<string, GroupMembership[]> = new Map()
): ResolvedNodeView | undefined {
  const node = graph.getNodeById(toNodeId(nodeId))
  if (!node) return undefined
  return {
    id: String(node.id),
    type: node.type ?? '',
    properties: Object.freeze({ ...(node.properties ?? {}) }),
    groups: Object.freeze(groups.get(String(node.id)) ?? []),
    mode: node.mode ?? 0,
    color: node.color,
    inputs: Object.freeze(
      (node.inputs ?? []).map((slot, index) => {
        const link = inputLink(graph, node.id, index)
        const connectedType =
          link?.resolve(graph).subgraphInput?.type ?? link?.type
        return Object.freeze({
          index,
          name: slot.name ?? '',
          label: slot.label ?? slot.localized_name ?? slot.name ?? '',
          type:
            typeof slot.type === 'string' ? slot.type : String(slot.type ?? ''),
          connected: link !== undefined,
          connectedType:
            connectedType != null ? String(connectedType) : undefined,
          sourceNodeId:
            link && !link.originIsIoNode ? String(link.origin_id) : undefined
        })
      })
    ),
    outputs: Object.freeze(
      (node.outputs ?? []).map((slot, index) =>
        Object.freeze({
          index,
          name: slot.name ?? '',
          label: slot.label ?? slot.localized_name ?? slot.name ?? '',
          type:
            typeof slot.type === 'string' ? slot.type : String(slot.type ?? '')
        })
      )
    ),
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
const isThenable = (v: unknown): v is Promise<unknown> =>
  !!v && typeof (v as { then?: unknown }).then === 'function'

function callResolver(
  graph: LGraph,
  resolvers: ReadonlyMap<string, Resolver>,
  nodeId: string,
  type: string
):
  | Record<string, OutputResolution>
  | Promise<Record<string, OutputResolution>> {
  const resolver = resolvers.get(type)
  const self = viewOf(graph, nodeId)
  if (!resolver || !self) return {}
  return resolver({
    self,
    nodesOfType: (wanted) =>
      (graph.nodes ?? [])
        .filter((n) => n.type === wanted)
        .map((n) => viewOf(graph, String(n.id)))
        .filter((v): v is ResolvedNodeView => v !== undefined)
  })
}

/**
 * Awaits every resolver up front, so the synchronous algorithm below can run
 * against plain values. One call per resolver-bearing node, same as the
 * memoised path.
 */
async function prebuildResolverAnswers(
  graph: LGraph,
  resolvers: ReadonlyMap<string, Resolver>
): Promise<ReadonlyMap<string, Record<string, OutputResolution>>> {
  const prebuilt = new Map<string, Record<string, OutputResolution>>()
  for (const node of graph.nodes ?? []) {
    const type = node.type ?? ''
    if (!resolvers.has(type)) continue
    const nodeId = String(node.id)
    prebuilt.set(nodeId, await callResolver(graph, resolvers, nodeId, type))
  }
  return prebuilt
}

/** The prompt path's entry: awaits async resolvers, then resolves as usual. */
export async function resolveFrontendNodesAsync(
  graph: LGraph,
  resolvers: ReadonlyMap<string, Resolver>
): Promise<ReadonlyMap<string, ResolvedSource>> {
  return resolveFrontendNodes(
    graph,
    resolvers,
    await prebuildResolverAnswers(graph, resolvers)
  )
}

export function resolveFrontendNodes(
  graph: LGraph,
  resolvers: ReadonlyMap<string, Resolver>,
  /**
   * Answers computed ahead of time — `prebuildResolverAnswers` awaited each
   * resolver, so an async resolver's answer is here as a plain value. Without
   * this, a promise-returning resolver on this synchronous path counts as
   * unresolved, loudly.
   */
  prebuilt?: ReadonlyMap<string, Record<string, OutputResolution>>
): ReadonlyMap<string, ResolvedSource> {
  const resolved = new Map<string, ResolvedSource>()

  /** One resolver call per node, memoised — resolvers must be pure anyway. */
  const answers = new Map<string, Record<string, OutputResolution>>()
  const answersFor = (nodeId: string, type: string) => {
    let answer = answers.get(nodeId) ?? prebuilt?.get(nodeId)
    if (!answer) {
      const raw = callResolver(graph, resolvers, nodeId, type)
      if (isThenable(raw)) {
        console.warn(
          `[nodeApi] '${type}' resolves asynchronously, which this ` +
            `synchronous read cannot await — treating node ${nodeId} as ` +
            `unresolved. The prompt path awaits it correctly.`
        )
        answer = {}
      } else {
        answer = raw
      }
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

export function resolveInputSource(
  graph: LGraph,
  nodeId: string,
  input: number,
  resolvers: ReadonlyMap<string, Resolver>
): ResolvedSource | undefined {
  const link = inputLink(graph, toNodeId(nodeId), input)
  if (!link) return undefined

  return (
    resolveFrontendNodes(graph, resolvers).get(
      key(String(link.origin_id), link.origin_slot)
    ) ?? {
      kind: 'output',
      nodeId: String(link.origin_id),
      output: link.origin_slot
    }
  )
}

/** An input in the graph that no link feeds. */
/** One of a node's own inputs, as its supplier sees it. */
/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface OwnInput {
  readonly index: number
  readonly name: string
  /** What the user sees — `label`, else `localized_name`, else `name`. */
  readonly label: string
  readonly type: string
  readonly connected: boolean
  /** The type actually arriving, or undefined when nothing is connected. */
  readonly connectedType: string | undefined
  /** The node feeding this input, if any. */
  readonly sourceNodeId: string | undefined
}

/** One of a node's own outputs, as its supplier sees it. */
/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface OwnOutput {
  readonly index: number
  readonly name: string
  /** What the user sees — `label`, else `localized_name`, else `name`. */
  readonly label: string
  readonly type: string
}

/** A group a node sits inside. */
/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface GroupMembership {
  readonly id: string
  readonly title: string
}

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
   * The groups the owning node sits inside, innermost first.
   *
   * Broadcast packs restrict by group — "only nodes in my group", "only nodes
   * outside it", "only groups whose title matches this regex". Membership is
   * geometric and recomputed here, so it matches what the user sees rather
   * than anything stored.
   */
  readonly nodeGroups: readonly GroupMembership[]
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
 */
export interface SuppliedEdge {
  readonly to: InputRef
  /**
   * Which claim wins when several suppliers name the same input. Higher wins;
   * defaults to 0.
   *
   * **Equal claims feed nothing.** Two suppliers that both say "highest
   * priority" for one input have no correct answer, and picking either makes
   * the prompt depend on node order — so the input is left unfed and the
   * conflict logged. That is what the broadcast pack this exists for does, and
   * it is the only choice that cannot silently produce a different image.
   */
  readonly priority?: number
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
/** May answer asynchronously, under the same rules as {@link Resolver}. */
export type Supplier = (
  view: SupplyView
) => readonly SuppliedEdge[] | Promise<readonly SuppliedEdge[]>

/**
 * One winning supply after priority arbitration and source resolution.
 */
export interface ResolvedSupply {
  /** The node whose supplier offered this edge. */
  readonly supplierNodeId: string
  /** The unconnected input the supplier won. */
  readonly to: InputRef
  /** The final source the prompt builder will use. */
  readonly from: ResolvedSource
}

/**
 * Resolves the inputs that suppliers feed, keyed `nodeId:inputIndex`.
 *
 * Runs after `resolveFrontendNodes` and takes its result, so a supplier whose
 * own output is fed by a reroute chain still lands on the real source.
 *
 * The highest-priority claim wins. An exact tie feeds nothing because choosing
 * either would make execution depend on graph order.
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

export function resolveSupplies(
  graph: LGraph,
  suppliers: ReadonlyMap<string, Supplier>,
  resolved: ReadonlyMap<string, ResolvedSource>,
  /** Awaited edges from `prebuildSupplierEdges`; same contract as resolvers. */
  prebuiltEdges?: ReadonlyMap<string, readonly SuppliedEdge[]>
): readonly ResolvedSupply[] {
  const supplied: ResolvedSupply[] = []
  if (!suppliers.size) return Object.freeze(supplied)

  const groups = groupsByNodeId(graph)
  /** Every claim on an input, so a conflict can be seen rather than raced. */
  const claims = new Map<
    string,
    { edge: SuppliedEdge; from: LGraphNode['id']; priority: number }[]
  >()
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
        nodeProperties: Object.freeze({ ...(node.properties ?? {}) }),
        nodeGroups: Object.freeze(groups.get(String(node.id)) ?? [])
      })
    }
  }

  for (const node of graph.nodes ?? []) {
    const supplier = suppliers.get(node.type ?? '')
    const self = supplier ? viewOf(graph, String(node.id), groups) : undefined
    if (!supplier || !self) continue

    const raw =
      prebuiltEdges?.get(String(node.id)) ??
      supplier({
        self,
        nodesOfType: (wanted) =>
          (graph.nodes ?? [])
            .filter((n) => n.type === wanted)
            .map((n) => viewOf(graph, String(n.id), groups))
            .filter((v): v is ResolvedNodeView => v !== undefined),
        unconnectedInputs: () => unconnected
      })
    let edges: readonly SuppliedEdge[]
    if (isThenable(raw)) {
      console.warn(
        `[nodeApi] '${node.type}' supplies asynchronously, which this ` +
          `synchronous read cannot await — treating node ${node.id} as ` +
          `supplying nothing. The prompt path awaits it correctly.`
      )
      edges = []
    } else {
      edges = raw
    }

    for (const edge of edges) {
      const target = `${edge.to.nodeId}:${edge.to.input}`
      const claim = { edge, from: node.id, priority: edge.priority ?? 0 }
      const existing = claims.get(target)
      if (existing) existing.push(claim)
      else claims.set(target, [claim])
    }
  }

  for (const [target, contenders] of claims) {
    // Highest priority wins; an exact tie feeds nothing. Picking either would
    // make the prompt depend on node order, so the same workflow could queue
    // differently after an unrelated edit.
    const [best, runnerUp] = [...contenders].sort(
      (a, b) => b.priority - a.priority
    )
    if (runnerUp && runnerUp.priority === best.priority) {
      console.warn(
        `[nodeApi] ${contenders.length} suppliers claim ${target} at priority ` +
          `${best.priority}; leaving it unfed. Give one a higher priority.`
      )
      continue
    }
    const from = Object.freeze({
      ...sourceFor(graph, best.from, best.edge.from, resolved)
    }) as ResolvedSource
    supplied.push(
      Object.freeze({
        supplierNodeId: String(best.from),
        to: Object.freeze({ ...best.edge.to }),
        from
      })
    )
  }

  return Object.freeze(supplied)
}

export function resolveSuppliedInputs(
  graph: LGraph,
  suppliers: ReadonlyMap<string, Supplier>,
  resolved: ReadonlyMap<string, ResolvedSource>,
  prebuiltEdges?: ReadonlyMap<string, readonly SuppliedEdge[]>
): ReadonlyMap<string, ResolvedSource> {
  return new Map(
    resolveSupplies(graph, suppliers, resolved, prebuiltEdges).map(
      ({ to, from }) => [key(to.nodeId, to.input), from]
    )
  )
}

/**
 * Awaits every supplier up front — the supplier-side twin of
 * `prebuildResolverAnswers`, sharing its view construction with
 * `resolveSupplies` by running it once per supplying node.
 */
async function prebuildSupplierEdges(
  graph: LGraph,
  suppliers: ReadonlyMap<string, Supplier>
): Promise<ReadonlyMap<string, readonly SuppliedEdge[]>> {
  const prebuilt = new Map<string, readonly SuppliedEdge[]>()
  if (!suppliers.size) return prebuilt

  const groups = groupsByNodeId(graph)
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
        nodeProperties: Object.freeze({ ...(node.properties ?? {}) }),
        nodeGroups: Object.freeze(groups.get(String(node.id)) ?? [])
      })
    }
  }

  for (const node of graph.nodes ?? []) {
    const supplier = suppliers.get(node.type ?? '')
    const self = supplier ? viewOf(graph, String(node.id), groups) : undefined
    if (!supplier || !self) continue
    prebuilt.set(
      String(node.id),
      await supplier({
        self,
        nodesOfType: (wanted) =>
          (graph.nodes ?? [])
            .filter((n) => n.type === wanted)
            .map((n) => viewOf(graph, String(n.id), groups))
            .filter((v): v is ResolvedNodeView => v !== undefined),
        unconnectedInputs: () => unconnected
      })
    )
  }
  return prebuilt
}

/** The prompt path's supplier entry: awaits, then arbitrates as usual. */
export async function resolveSuppliedInputsAsync(
  graph: LGraph,
  suppliers: ReadonlyMap<string, Supplier>,
  resolved: ReadonlyMap<string, ResolvedSource>
): Promise<ReadonlyMap<string, ResolvedSource>> {
  return resolveSuppliedInputs(
    graph,
    suppliers,
    resolved,
    await prebuildSupplierEdges(graph, suppliers)
  )
}
