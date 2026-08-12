import { resolveSubgraphInputTarget } from '@/core/graph/subgraph/resolveSubgraphInputTarget'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  collectAllNodes,
  getExecutionIdByNode,
  isExecutionPathActive
} from '@/utils/graphTraversalUtil'
import { filterOutputNodes } from '@/utils/nodeFilterUtil'

import { MEDIA_KIND_BY_SINK_TYPE } from './tourRolePins'
import type { TourMediaKind } from './tourRolePins'

/** Roles read off a graph nobody pinned. Host-mapping stays the caller's job. */
interface HeuristicRoles {
  source: LGraphNode | null
  prompt: LGraphNode | null
  sink: LGraphNode | null
  mediaKind: TourMediaKind
}

const MEDIA_KIND_BY_SLOT_TYPE: Partial<Record<string, TourMediaKind>> = {
  IMAGE: 'image',
  VIDEO: 'video'
}

/** `neg` alone is the abbreviation; anything longer must be `negative*`, or
 * `negate`, `negligible` and Spanish `negro` disqualify a real prompt. */
const DISQUALIFYING = ['negative', 'neg', 'system', 'undesired', 'avoid']

/** `anti` names the negative box only next to the noun — `Anti-prompt`,
 * `AntiPrompt`, `ANTIPROMPT` — since `anti_aliasing` and `antique` are ordinary
 * words a real prompt carries. Read off the normalised label, not its words, so
 * the pair survives the separator and camelCase spellings alike. */
const ANTI_PROMPT = /\banti ?prompts?\b/

function disqualified(word: string): boolean {
  return DISQUALIFYING.includes(word) || word.startsWith('negative')
}

function readsAsAntiPrompt(label: string | undefined): boolean {
  return ANTI_PROMPT.test(labelWords(label).join(' '))
}

/** Real templates ship nodes with no title and widgets with no name. */
function labelWords(label: string | undefined): string[] {
  return (label ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
}

function slotType(slot: { type?: unknown }): string {
  return String(slot.type ?? '').toUpperCase()
}

/** Multiline is what separates a prompt box from a seed or a filename. */
function promptWidgets(node: LGraphNode) {
  return (node.widgets ?? []).filter(
    (widget) => widget.type === 'customtext' || widget.options?.multiline
  )
}

function consumerInputNames(nodes: LGraphNode[]): Map<LGraphNode, string[]> {
  const names = new Map<LGraphNode, string[]>()

  for (const consumer of nodes) {
    const inputs = consumer.inputs ?? []
    inputs.forEach((input, slot) => {
      const producer = consumer.getInputNode(slot)
      if (producer)
        names.set(producer, [...(names.get(producer) ?? []), input.name])
    })
  }

  return names
}

/** A text node inside a subgraph is titled nothing useful; its port is not. */
function exposedInputNames(nodes: LGraphNode[]): Map<LGraphNode, string[]> {
  const names = new Map<LGraphNode, string[]>()

  for (const host of nodes) {
    if (!host.isSubgraphNode?.() || !host.subgraph) continue

    for (const input of host.inputs ?? []) {
      const target = resolveSubgraphInputTarget(host, input.name)
      const inner = target && host.subgraph.getNodeById(target.nodeId)
      if (inner) names.set(inner, [...(names.get(inner) ?? []), input.name])
    }
  }

  return names
}

/**
 * Ranks a text node on its title, its widget's name, any subgraph port wired to
 * it, and the input name it feeds one hop on, normalised for case and
 * separators. Anything reading as a negative prompt disqualifies.
 */
function promptScore(labels: string[], fedInputNames: string[]): number {
  const words = labels.flatMap(labelWords)
  const fed = fedInputNames.flatMap(labelWords)

  if ([...words, ...fed].some(disqualified)) return -1
  if ([...labels, ...fedInputNames].some(readsAsAntiPrompt)) return -1
  if (fed.includes('positive')) return 3
  if (words.includes('positive')) return 2
  if (words.includes('prompt')) return 1
  return 0
}

/**
 * Each node scores on its best prompt widget, so one carrying both a positive
 * and a negative box is not disqualified by widget order. A tie at the top
 * resolves to nothing; a lone text box wins by being alone. Virtual nodes are
 * skipped: a note never runs, and a subgraph host's promoted widgets mirror an
 * interior node that host-maps back to it, tying a prompt against itself.
 */
function findPrompt(nodes: LGraphNode[]): LGraphNode | null {
  const consumers = consumerInputNames(nodes)
  const exposed = exposedInputNames(nodes)

  const ranked = nodes
    .flatMap((node) => {
      if (node.isVirtualNode) return []
      const widgets = promptWidgets(node)
      if (!widgets.length) return []
      const fed = consumers.get(node) ?? []
      const shared = [node.title, ...(exposed.get(node) ?? [])]
      const scores = widgets.map((w) => promptScore([...shared, w.name], fed))
      return [{ node, score: Math.max(...scores) }]
    })
    .sort((a, b) => b.score - a.score)

  const [best, runnerUp] = ranked
  if (!best || best.score < 0) return null
  return !runnerUp || best.score > runnerUp.score ? best.node : null
}

/** Produces an image and consumes nothing. Two of them is a coin flip. */
function findSource(nodes: LGraphNode[]): LGraphNode | null {
  const sources = nodes.filter(
    (node) =>
      !node.isVirtualNode &&
      !(node.inputs ?? []).some((input) => input.link != null) &&
      (node.outputs ?? []).some((output) => slotType(output) === 'IMAGE')
  )

  return sources.length === 1 ? sources[0] : null
}

/** Any output node fed media can show the result; disagreeing kinds cannot. */
function findSink(
  nodes: LGraphNode[]
): { node: LGraphNode; mediaKind: TourMediaKind } | null {
  const sinks = filterOutputNodes(nodes).flatMap((node) => {
    for (const input of node.inputs ?? []) {
      const slotKind = MEDIA_KIND_BY_SLOT_TYPE[slotType(input)]
      if (input.link == null || !slotKind) continue
      const mediaKind = MEDIA_KIND_BY_SINK_TYPE[node.type] ?? slotKind
      return [{ node, slotKind, mediaKind }]
    }
    return []
  })

  const [first] = sinks
  if (!first) return null
  // Sinks must agree on the data they are fed; a video combine and a still
  // preview of the same frames do not disagree, they rank — the video is the
  // result and the preview is scaffolding.
  if (!sinks.every(({ slotKind }) => slotKind === first.slotKind)) return null
  return sinks.find(({ mediaKind }) => mediaKind === 'video') ?? first
}

/** Roles for a shared workflow or an unpinned template. No sink, no tour. */
export function heuristicRoles(graph: LGraph): HeuristicRoles | null {
  const active = collectAllNodes(graph).filter((node) => {
    const executionId = getExecutionIdByNode(graph, node)
    return executionId ? isExecutionPathActive(graph, executionId) : false
  })

  const sink = findSink(active)
  if (!sink) return null

  return {
    source: findSource(active),
    prompt: findPrompt(active),
    sink: sink.node,
    mediaKind: sink.mediaKind
  }
}
