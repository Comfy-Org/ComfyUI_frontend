import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { isPlainObject } from 'es-toolkit'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { callListener } from '@/platform/nodeApi/shared/listeners'
import type {
  ResolveView,
  Resolver,
  WidgetValue
} from '@/platform/nodeApi/v4/types'
import { savableValue } from '@/platform/nodeApi/v4/widgets/savableValue'
import type { NodeViews } from './nodeView'

type CheckedResolution =
  | { readonly kind: 'omit' }
  | {
      readonly kind: 'forward'
      readonly node: LGraphNode
      readonly input: number
    }
  | { readonly kind: 'literal'; readonly value: WidgetValue }

type Answer = ReadonlyMap<number, CheckedResolution>

export interface Resolutions {
  /** What an output of `node` stands for, or `undefined` if `resolve` does not say. */
  outputOf(
    graph: LGraph,
    node: LGraphNode,
    resolve: Resolver,
    output: number
  ): CheckedResolution | undefined
}

/** Asks each node's resolver once, the first time one of its outputs is resolved. */
export function createResolutions(views: NodeViews): Resolutions {
  const answers = new WeakMap<LGraphNode, Answer>()

  function answerOf(
    graph: LGraph,
    node: LGraphNode,
    resolve: Resolver
  ): Answer {
    const known = answers.get(node)
    if (known) return known
    const answer =
      callListener('resolve', () =>
        checkedAnswer(graph, node, resolve(resolveView(graph, node, views)))
      ) ?? new Map<number, CheckedResolution>()
    answers.set(node, answer)
    return answer
  }

  return {
    outputOf: (graph, node, resolve, output) =>
      answerOf(graph, node, resolve).get(output)
  }
}

function resolveView(
  graph: LGraph,
  node: LGraphNode,
  views: NodeViews
): ResolveView {
  return Object.freeze({
    self: views.viewOf(graph, node),
    nodesOfType: (type: string) => views.nodesOfType(graph, type)
  })
}

function checkedAnswer(
  graph: LGraph,
  node: LGraphNode,
  answer: unknown
): Answer {
  if (!isPlainObject(answer)) {
    throw invalidArgument('resolve', 'an object of output resolutions', answer)
  }
  const checked = new Map<number, CheckedResolution>()
  for (const [key, resolution] of Object.entries(answer)) {
    const output = outputIndexOf(node, key)
    if (output === undefined || checked.has(output)) {
      throw invalidArgument('resolve', 'each output named once', key)
    }
    checked.set(output, checkedResolution(graph, resolution))
  }
  return checked
}

function outputIndexOf(node: LGraphNode, key: string): number | undefined {
  const index = /^(0|[1-9]\d*)$/.test(key) ? Number(key) : -1
  if (index >= 0 && index < node.outputs.length) return index
  const named = node.outputs.findIndex((output) => output.name === key)
  return named === -1 ? undefined : named
}

function checkedResolution(
  graph: LGraph,
  resolution: unknown
): CheckedResolution {
  if (isPlainObject(resolution) && Object.keys(resolution).length === 1) {
    if (resolution.omit === true) return Object.freeze({ kind: 'omit' })
    if (Object.hasOwn(resolution, 'forwardTo')) {
      return forwardTo(graph, resolution.forwardTo)
    }
    if (Object.hasOwn(resolution, 'literal')) return literal(resolution.literal)
  }
  throw invalidArgument(
    'resolve',
    'a resolution of { omit: true }, { forwardTo } or { literal }',
    resolution
  )
}

function forwardTo(graph: LGraph, ref: unknown): CheckedResolution {
  if (
    isPlainObject(ref) &&
    Object.keys(ref).length === 2 &&
    typeof ref.nodeId === 'string' &&
    typeof ref.input === 'number'
  ) {
    const { nodeId, input } = ref
    const node = graph.getNodeById(toNodeId(nodeId))
    if (
      node &&
      Number.isInteger(input) &&
      input >= 0 &&
      input < node.inputs.length
    ) {
      return Object.freeze({ kind: 'forward', node, input })
    }
  }
  throw invalidArgument(
    'resolve',
    'a forwardTo of { nodeId, input } naming an input in its graph',
    ref
  )
}

function literal(value: unknown): CheckedResolution {
  return Object.freeze({
    kind: 'literal',
    value: savableValue('resolve', value)
  })
}
