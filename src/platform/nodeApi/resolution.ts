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
