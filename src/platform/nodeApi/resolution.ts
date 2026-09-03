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
import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import type { WidgetValue } from './widgetHandle'
import { ComfyApiError } from './errors'

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
  readonly signal: AbortSignal
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
  for (const group of graph._groups) {
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

function freezeNested<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value
  }
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    freezeNested(Reflect.get(value, key), seen)
  }
  return Object.freeze(value)
}

function cloneValue(
  value: unknown,
  seen = new WeakMap<object, unknown>()
): unknown {
  if (value === null || typeof value !== 'object') return value
  const existing = seen.get(value)
  if (existing !== undefined) return existing
  if (value instanceof Date) return new Date(value)
  if (Array.isArray(value)) return cloneArray(value, seen)
  if (value instanceof Map) return cloneMap(value, seen)
  if (value instanceof Set) return cloneSet(value, seen)
  return cloneRecord(value, seen)
}

function cloneArray(
  value: readonly unknown[],
  seen: WeakMap<object, unknown>
): unknown[] {
  const copy: unknown[] = []
  seen.set(value, copy)
  copy.push(...value.map((entry) => cloneValue(entry, seen)))
  return copy
}

function cloneMap(
  value: ReadonlyMap<unknown, unknown>,
  seen: WeakMap<object, unknown>
): Map<unknown, unknown> {
  const copy = new Map<unknown, unknown>()
  seen.set(value, copy)
  for (const [key, entry] of value) {
    copy.set(cloneValue(key, seen), cloneValue(entry, seen))
  }
  return copy
}

function cloneSet(
  value: ReadonlySet<unknown>,
  seen: WeakMap<object, unknown>
): Set<unknown> {
  const copy = new Set<unknown>()
  seen.set(value, copy)
  for (const entry of value) copy.add(cloneValue(entry, seen))
  return copy
}

function cloneRecord(
  value: object,
  seen: WeakMap<object, unknown>
): Record<string, unknown> {
  const copy: Record<string, unknown> = {}
  seen.set(value, copy)
  for (const [key, entry] of Object.entries(value)) {
    copy[key] = cloneValue(entry, seen)
  }
  return copy
}

function snapshotValue<T>(value: T): T {
  return freezeNested(cloneValue(value)) as T
}

function snapshotRecord(
  value: Record<string, unknown> | undefined
): Readonly<Record<string, unknown>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value ?? {}).map(([key, entry]) => [
        key,
        snapshotValue(entry)
      ])
    )
  )
}

function displayNameOf(slot: {
  label?: unknown
  localized_name?: unknown
  name?: unknown
}): string {
  return String(
    extensionValue(slot.label) ??
      extensionValue(slot.localized_name) ??
      extensionValue(slot.name) ??
      ''
  )
}

function slotTypeOf(slot: { type?: unknown }): string {
  return typeof slot.type === 'string'
    ? slot.type
    : String(extensionValue(slot.type) ?? '')
}

function inputViewOf(
  graph: LGraph,
  node: LGraphNode,
  store: ReturnType<typeof useLinkStore>,
  scope: ReturnType<typeof graphScopeOf>,
  slot: LGraphNode['inputs'][number],
  index: number
): OwnInput {
  const topology = store.getInputSlotLink(scope, node.id, index)
  const link = topology === undefined ? undefined : graph.getLink(topology.id)
  const connectedType = link?.resolve(graph).subgraphInput?.type ?? link?.type
  return Object.freeze({
    index,
    name: extensionValue(slot.name) ?? '',
    label: displayNameOf(slot),
    type: slotTypeOf(slot),
    connected: link !== undefined,
    connectedType: connectedType == null ? undefined : String(connectedType),
    sourceNodeId:
      link && !link.originIsIoNode ? String(link.origin_id) : undefined
  })
}

function outputViewOf(
  slot: LGraphNode['outputs'][number],
  index: number
): OwnOutput {
  return Object.freeze({
    index,
    name: extensionValue(slot.name) ?? '',
    label: displayNameOf(slot),
    type: slotTypeOf(slot)
  })
}

function viewOf(
  graph: LGraph,
  nodeId: string,
  groups: ReadonlyMap<string, GroupMembership[]> = new Map()
): ResolvedNodeView | undefined {
  const node = graph.getNodeById(toNodeId(nodeId))
  if (!node) return undefined
  // Hoisted: resolving the store and the graph scope per input made both a
  // function of slot count on a path the prompt build walks for every node.
  const store = useLinkStore()
  const scope = graphScopeOf(graph)
  return {
    id: String(node.id),
    type: extensionValue(node.type) ?? '',
    properties: snapshotRecord(node.properties),
    groups: Object.freeze(groups.get(String(node.id)) ?? []),
    mode: extensionValue(node.mode) ?? 0,
    color: node.color,
    inputs: Object.freeze(
      node.inputs.map((slot, index) =>
        inputViewOf(graph, node, store, scope, slot, index)
      )
    ),
    outputs: Object.freeze(node.outputs.map(outputViewOf)),
    widgetValue: (name) =>
      snapshotValue(node.widgets?.find((w) => w.name === name)?.value),
    input: (ref) => {
      const index =
        typeof ref === 'number'
          ? ref
          : node.inputs.findIndex((i) => i.name === ref)
      if (index < 0 || index >= node.inputs.length) return undefined
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[]
) => {
  const actual = Object.keys(value)
  return (
    actual.length === keys.length && keys.every((key) => actual.includes(key))
  )
}

function validateInputRef(
  graph: LGraph,
  value: unknown,
  owner: string
): InputRef {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['nodeId', 'input']) ||
    typeof value.nodeId !== 'string' ||
    !Number.isSafeInteger(value.input)
  ) {
    throw new ComfyApiError(`${owner} returned an invalid input reference.`)
  }
  const node = graph.getNodeById(toNodeId(value.nodeId))
  const input = Number(value.input)
  if (!node || input < 0 || input >= node.inputs.length) {
    throw new ComfyApiError(
      `${owner} referenced input '${value.nodeId}:${input}' outside this graph.`
    )
  }
  return Object.freeze({ nodeId: value.nodeId, input })
}

function validateOutputResolution(
  graph: LGraph,
  resolution: Record<string, unknown>,
  owner: string,
  output: string
): OutputResolution {
  if (hasExactKeys(resolution, ['omit']) && resolution.omit === true) {
    return Object.freeze({ omit: true })
  }
  if (hasExactKeys(resolution, ['forwardTo'])) {
    return Object.freeze({
      forwardTo: validateInputRef(graph, resolution.forwardTo, owner)
    })
  }
  if (hasExactKeys(resolution, ['literal'])) {
    return Object.freeze({
      literal: snapshotValue(resolution.literal) as WidgetValue
    })
  }
  throw new ComfyApiError(
    `${owner} returned an invalid resolution for '${output}'.`
  )
}

function validateResolverAnswer(
  graph: LGraph,
  nodeId: string,
  type: string,
  value: unknown
): Record<string, OutputResolution> {
  const owner = `Resolver '${type}' on node '${nodeId}'`
  if (!isRecord(value)) {
    throw new ComfyApiError(`${owner} must return an object.`)
  }
  const node = graph.getNodeById(toNodeId(nodeId))
  if (!node)
    throw new ComfyApiError(`${owner} no longer belongs to this graph.`)
  const allowedOutputs = new Set(
    node.outputs.flatMap((output, index) => [
      extensionValue(output.name) ?? String(index),
      String(index)
    ])
  )
  const validated: Record<string, OutputResolution> = {}
  for (const [output, resolution] of Object.entries(value)) {
    if (!allowedOutputs.has(output) || !isRecord(resolution)) {
      throw new ComfyApiError(
        `${owner} returned an invalid output '${output}'.`
      )
    }
    validated[output] = validateOutputResolution(
      graph,
      resolution,
      owner,
      output
    )
  }
  return Object.freeze(validated)
}

const DEFAULT_RESOLUTION_TIMEOUT_MS = 5_000
const inactiveSignal = new AbortController().signal

async function runBounded<T>(
  options: ResolutionOptions,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_RESOLUTION_TIMEOUT_MS
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ComfyApiError('Resolution timeout must be a positive number.')
  }

  const controller = new AbortController()
  const onExternalAbort = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) onExternalAbort()
  else
    options.signal?.addEventListener('abort', onExternalAbort, { once: true })

  const timeout = setTimeout(
    () =>
      controller.abort(
        new ComfyApiError(`Resolution timed out after ${timeoutMs}ms.`)
      ),
    timeoutMs
  )
  const aborted = new Promise<never>((_, reject) => {
    const rejectAbort = () => {
      reject(
        controller.signal.reason instanceof Error
          ? controller.signal.reason
          : new ComfyApiError('Resolution was aborted.')
      )
    }
    if (controller.signal.aborted) rejectAbort()
    else
      controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })

  try {
    return await Promise.race([run(controller.signal), aborted])
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', onExternalAbort)
  }
}

function callResolver(
  graph: LGraph,
  resolvers: ReadonlyMap<string, Resolver>,
  nodeId: string,
  type: string,
  groups: ReadonlyMap<string, GroupMembership[]>,
  signal: AbortSignal = inactiveSignal
):
  | Record<string, OutputResolution>
  | Promise<Record<string, OutputResolution>> {
  const resolver = resolvers.get(type)
  const self = viewOf(graph, nodeId, groups)
  if (!resolver || !self) return {}
  return resolver({
    self,
    signal,
    nodesOfType: (wanted) =>
      graph.nodes
        .filter((n) => n.type === wanted)
        .map((n) => viewOf(graph, String(n.id), groups))
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
  resolvers: ReadonlyMap<string, Resolver>,
  options: ResolutionOptions
): Promise<ReadonlyMap<string, Record<string, OutputResolution>>> {
  const groups = groupsByNodeId(graph)
  const nodes = graph.nodes.filter((node) =>
    resolvers.has(extensionValue(node.type) ?? '')
  )
  return runBounded(options, async (signal) => {
    const entries = await Promise.all(
      nodes.map(async (node) => {
        const nodeId = String(node.id)
        const answer = await callResolver(
          graph,
          resolvers,
          nodeId,
          extensionValue(node.type) ?? '',
          groups,
          signal
        )
        return [nodeId, answer] as const
      })
    )
    return new Map(entries)
  })
}

/** The prompt path's entry: awaits async resolvers, then resolves as usual. */
export async function resolveFrontendNodesAsync(
  graph: LGraph,
  resolvers: ReadonlyMap<string, Resolver>,
  options: ResolutionOptions = {}
): Promise<ReadonlyMap<string, ResolvedSource>> {
  return resolveFrontendNodes(
    graph,
    resolvers,
    await prebuildResolverAnswers(graph, resolvers, options)
  )
}

interface FollowContext {
  readonly graph: LGraph
  readonly resolvers: ReadonlyMap<string, Resolver>
  readonly resolved: Map<string, ResolvedSource>
  readonly answersFor: (
    nodeId: string,
    type: string
  ) => Record<string, OutputResolution>
}

function forwardedSource(
  context: FollowContext,
  input: InputRef,
  trail: Set<string>
): ResolvedSource {
  const target = context.graph.getNodeById(toNodeId(input.nodeId))
  const link = target
    ? inputLink(context.graph, target.id, input.input)
    : undefined
  return link
    ? followResolvedOutput(
        context,
        String(link.origin_id),
        link.origin_slot,
        trail
      )
    : {
        kind: 'omitted',
        reason: `nothing feeds ${input.nodeId}:${input.input}`
      }
}

function sourceFromResolution(
  context: FollowContext,
  answer: OutputResolution | null | undefined,
  trail: Set<string>
): ResolvedSource {
  if (!answer || 'omit' in answer) {
    return {
      kind: 'omitted',
      reason: answer ? 'omitted by resolver' : 'no resolution for output'
    }
  }
  if ('literal' in answer) {
    return { kind: 'literal', value: answer.literal }
  }
  return forwardedSource(context, answer.forwardTo, trail)
}

function followResolvedOutput(
  context: FollowContext,
  nodeId: string,
  output: number,
  trail: Set<string>
): ResolvedSource {
  const outputKey = key(nodeId, output)
  const already = context.resolved.get(outputKey)
  if (already) return already
  if (trail.has(outputKey)) {
    return { kind: 'omitted', reason: `cycle through ${outputKey}` }
  }
  trail.add(outputKey)

  const node = context.graph.getNodeById(toNodeId(nodeId))
  if (!node) return { kind: 'omitted', reason: `no node ${nodeId}` }

  const nodeType = extensionValue(node.type) ?? ''
  if (!context.resolvers.has(nodeType)) {
    return { kind: 'output', nodeId, output }
  }

  const outputName = node.outputs.at(output)?.name ?? String(output)
  const answers = context.answersFor(nodeId, nodeType)
  const answer = extensionValue(answers[outputName] ?? answers[String(output)])
  const source = sourceFromResolution(context, answer, trail)
  context.resolved.set(outputKey, source)
  return source
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
  const groups = groupsByNodeId(graph)

  /** One resolver call per node, memoised — resolvers must be pure anyway. */
  const answers = new Map<string, Record<string, OutputResolution>>()
  const answersFor = (nodeId: string, type: string) => {
    let answer = answers.get(nodeId) ?? prebuilt?.get(nodeId)
    if (!answer) {
      const raw = callResolver(graph, resolvers, nodeId, type, groups)
      if (isThenable(raw)) {
        console.warn(
          `[nodeApi] '${type}' resolves asynchronously, which this ` +
            `synchronous read cannot await — treating node ${nodeId} as ` +
            `unresolved. The prompt path awaits it correctly.`
        )
        answer = {}
      } else {
        answer = validateResolverAnswer(graph, nodeId, type, raw)
      }
      answers.set(nodeId, answer)
    } else {
      answer = validateResolverAnswer(graph, nodeId, type, answer)
      answers.set(nodeId, answer)
    }
    return answer
  }

  const context: FollowContext = { graph, resolvers, resolved, answersFor }

  for (const node of graph.nodes) {
    if (!resolvers.has(extensionValue(node.type) ?? '')) continue
    const outputs = node.outputs.length
    for (let output = 0; output < outputs; output++) {
      followResolvedOutput(context, String(node.id), output, new Set())
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
  readonly signal: AbortSignal
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

export interface ResolutionOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

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

function unconnectedInputOf(
  node: LGraphNode,
  input: LGraphNode['inputs'][number],
  index: number,
  properties: Readonly<Record<string, unknown>>,
  groups: ReadonlyMap<string, GroupMembership[]>
): UnconnectedInput {
  return {
    nodeId: String(node.id),
    nodeType: extensionValue(node.type) ?? '',
    input: index,
    name: extensionValue(input.name) ?? '',
    type: slotTypeOf(input),
    label: displayNameOf(input),
    isWidgetInput: input.widget != null,
    nodeTitle: extensionValue(node.title) ?? '',
    nodeMode: extensionValue(node.mode) ?? 0,
    nodeColor: node.color,
    nodeProperties: properties,
    nodeGroups: Object.freeze(groups.get(String(node.id)) ?? [])
  }
}

function unconnectedInputsOf(
  graph: LGraph,
  groups: ReadonlyMap<string, GroupMembership[]>
): readonly UnconnectedInput[] {
  const unconnected: UnconnectedInput[] = []
  // Hoisted above both loops, and asks only whether a link exists: resolving
  // the LLink to discard it cost a second lookup per input of every node.
  const store = useLinkStore()
  const scope = graphScopeOf(graph)
  for (const node of graph.nodes) {
    // Per node, and only once a node turns out to have an unconnected input:
    // the deep-frozen copy was being rebuilt for every input of every node.
    let nodeProperties: Readonly<Record<string, unknown>> | undefined
    for (const [index, input] of node.inputs.entries()) {
      if (store.getInputSlotLink(scope, node.id, index)) continue
      nodeProperties ??= snapshotRecord(node.properties)
      unconnected.push(
        unconnectedInputOf(node, input, index, nodeProperties, groups)
      )
    }
  }
  return Object.freeze(unconnected)
}

function validateSuppliedEdges(
  graph: LGraph,
  supplier: LGraphNode,
  value: unknown
): readonly SuppliedEdge[] {
  const owner = `Supplier '${supplier.type}' on node '${String(supplier.id)}'`
  if (!Array.isArray(value)) {
    throw new ComfyApiError(`${owner} must return an array.`)
  }
  return Object.freeze(
    value.map((candidate) =>
      validateSuppliedEdge(graph, supplier, candidate, owner)
    )
  )
}

function validSuppliedEdgeShape(candidate: unknown): candidate is {
  to: unknown
  from: unknown
  priority?: number
} {
  if (!isRecord(candidate)) return false
  const allowed = new Set(['to', 'from', 'priority'])
  if (Object.keys(candidate).some((key) => !allowed.has(key))) return false
  if (!Object.hasOwn(candidate, 'to') || !Object.hasOwn(candidate, 'from')) {
    return false
  }
  return (
    candidate.priority === undefined ||
    (typeof candidate.priority === 'number' &&
      Number.isFinite(candidate.priority))
  )
}

function validateIndexedSource(
  candidate: Record<string, unknown>,
  key: 'output' | 'forwardInput',
  length: number,
  owner: string
): SuppliedEdge['from'] | undefined {
  if (
    !hasExactKeys(candidate, [key]) ||
    !Number.isSafeInteger(candidate[key])
  ) {
    return undefined
  }
  const index = Number(candidate[key])
  if (index < 0 || index >= length) {
    const noun = key === 'output' ? 'output' : 'input'
    throw new ComfyApiError(
      `${owner} referenced nonexistent ${noun} '${index}'.`
    )
  }
  return key === 'output'
    ? Object.freeze({ output: index })
    : Object.freeze({ forwardInput: index })
}

function validateSuppliedSource(
  supplier: LGraphNode,
  candidate: unknown,
  owner: string
): SuppliedEdge['from'] {
  if (!isRecord(candidate)) {
    throw new ComfyApiError(`${owner} returned an invalid edge source.`)
  }
  const output = validateIndexedSource(
    candidate,
    'output',
    supplier.outputs.length,
    owner
  )
  if (output) return output
  const input = validateIndexedSource(
    candidate,
    'forwardInput',
    supplier.inputs.length,
    owner
  )
  if (input) return input
  if (hasExactKeys(candidate, ['literal'])) {
    return Object.freeze({
      literal: snapshotValue(candidate.literal) as WidgetValue
    })
  }
  throw new ComfyApiError(`${owner} returned an invalid edge source.`)
}

function validateSuppliedEdge(
  graph: LGraph,
  supplier: LGraphNode,
  candidate: unknown,
  owner: string
): SuppliedEdge {
  if (!validSuppliedEdgeShape(candidate)) {
    throw new ComfyApiError(`${owner} returned an invalid supplied edge.`)
  }
  const to = validateInputRef(graph, candidate.to, owner)
  if (inputLink(graph, toNodeId(to.nodeId), to.input)) {
    throw new ComfyApiError(
      `${owner} cannot supply connected input '${to.nodeId}:${to.input}'.`
    )
  }
  return Object.freeze({
    to,
    from: validateSuppliedSource(supplier, candidate.from, owner),
    ...(candidate.priority === undefined
      ? {}
      : { priority: candidate.priority })
  })
}

interface SupplyClaim {
  readonly edge: SuppliedEdge
  readonly from: LGraphNode['id']
  readonly priority: number
}

function viewsOfType(
  graph: LGraph,
  groups: ReadonlyMap<string, GroupMembership[]>,
  wanted: string
): readonly ResolvedNodeView[] {
  return graph.nodes
    .filter((node) => node.type === wanted)
    .map((node) => viewOf(graph, String(node.id), groups))
    .filter((view): view is ResolvedNodeView => view !== undefined)
}

function supplierEdgesOf(
  graph: LGraph,
  node: LGraphNode,
  supplier: Supplier,
  self: ResolvedNodeView,
  groups: ReadonlyMap<string, GroupMembership[]>,
  unconnected: readonly UnconnectedInput[],
  prebuiltEdges?: ReadonlyMap<string, readonly SuppliedEdge[]>
): readonly SuppliedEdge[] {
  const raw =
    prebuiltEdges?.get(String(node.id)) ??
    supplier({
      self,
      signal: inactiveSignal,
      nodesOfType: (wanted) => viewsOfType(graph, groups, wanted),
      unconnectedInputs: () => unconnected
    })
  if (!isThenable(raw)) return validateSuppliedEdges(graph, node, raw)
  console.warn(
    `[nodeApi] '${node.type}' supplies asynchronously, which this ` +
      `synchronous read cannot await — treating node ${node.id} as ` +
      `supplying nothing. The prompt path awaits it correctly.`
  )
  return []
}

function collectSupplyClaims(
  graph: LGraph,
  suppliers: ReadonlyMap<string, Supplier>,
  groups: ReadonlyMap<string, GroupMembership[]>,
  unconnected: readonly UnconnectedInput[],
  prebuiltEdges?: ReadonlyMap<string, readonly SuppliedEdge[]>
): ReadonlyMap<string, SupplyClaim[]> {
  const claims = new Map<string, SupplyClaim[]>()
  for (const node of graph.nodes) {
    const supplier = suppliers.get(extensionValue(node.type) ?? '')
    const self = supplier ? viewOf(graph, String(node.id), groups) : undefined
    if (!supplier || !self) continue
    const edges = supplierEdgesOf(
      graph,
      node,
      supplier,
      self,
      groups,
      unconnected,
      prebuiltEdges
    )
    for (const edge of edges) {
      const target = `${edge.to.nodeId}:${edge.to.input}`
      const claim = { edge, from: node.id, priority: edge.priority ?? 0 }
      const existing = claims.get(target)
      if (existing) existing.push(claim)
      else claims.set(target, [claim])
    }
  }
  return claims
}

function winningClaim(
  target: string,
  contenders: readonly SupplyClaim[]
): SupplyClaim | undefined {
  const sorted = [...contenders].sort((a, b) => b.priority - a.priority)
  const best = sorted.at(0)
  const runnerUp = sorted.at(1)
  if (!best) return undefined
  if (!runnerUp || runnerUp.priority !== best.priority) return best
  console.warn(
    `[nodeApi] ${contenders.length} suppliers claim ${target} at priority ` +
      `${best.priority}; leaving it unfed. Give one a higher priority.`
  )
  return undefined
}

function resolvedSupplyOf(
  graph: LGraph,
  claim: SupplyClaim,
  resolved: ReadonlyMap<string, ResolvedSource>
): ResolvedSupply {
  const from = Object.freeze({
    ...sourceFor(graph, claim.from, claim.edge.from, resolved)
  }) as ResolvedSource
  return Object.freeze({
    supplierNodeId: String(claim.from),
    to: Object.freeze({ ...claim.edge.to }),
    from
  })
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
  const unconnected = unconnectedInputsOf(graph, groups)
  const claims = collectSupplyClaims(
    graph,
    suppliers,
    groups,
    unconnected,
    prebuiltEdges
  )

  for (const [target, contenders] of claims) {
    const best = winningClaim(target, contenders)
    if (!best) continue
    supplied.push(resolvedSupplyOf(graph, best, resolved))
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
  suppliers: ReadonlyMap<string, Supplier>,
  options: ResolutionOptions
): Promise<ReadonlyMap<string, readonly SuppliedEdge[]>> {
  if (!suppliers.size) return new Map()

  const groups = groupsByNodeId(graph)
  const unconnected = unconnectedInputsOf(graph, groups)
  return runBounded(options, async (signal) => {
    const entries = await Promise.all(
      graph.nodes.map(async (node) => {
        const supplier = suppliers.get(extensionValue(node.type) ?? '')
        if (!supplier) return undefined
        const self = viewOf(graph, String(node.id), groups)
        if (!self) return undefined
        const edges = await supplier({
          self,
          signal,
          nodesOfType: (wanted) =>
            graph.nodes
              .filter((n) => n.type === wanted)
              .map((n) => viewOf(graph, String(n.id), groups))
              .filter((v): v is ResolvedNodeView => v !== undefined),
          unconnectedInputs: () => unconnected
        })
        return [String(node.id), edges] as const
      })
    )
    return new Map(entries.filter((entry) => entry !== undefined))
  })
}

/** The prompt path's supplier entry: awaits, then arbitrates as usual. */
export async function resolveSuppliedInputsAsync(
  graph: LGraph,
  suppliers: ReadonlyMap<string, Supplier>,
  resolved: ReadonlyMap<string, ResolvedSource>,
  options: ResolutionOptions = {}
): Promise<ReadonlyMap<string, ResolvedSource>> {
  return resolveSuppliedInputs(
    graph,
    suppliers,
    resolved,
    await prebuildSupplierEdges(graph, suppliers, options)
  )
}
