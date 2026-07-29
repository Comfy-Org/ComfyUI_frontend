import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  collectAllNodes,
  getExecutionIdByNode,
  isExecutionPathActive
} from '@/utils/graphTraversalUtil'
import { filterOutputNodes } from '@/utils/nodeFilterUtil'

import type { TourMediaKind } from './tourRolePins'

export interface HeuristicRoles {
  prompt: LGraphNode | null
  sink: LGraphNode
  mediaKind: TourMediaKind
}

const MEDIA: Partial<Record<string, TourMediaKind>> = {
  IMAGE: 'image',
  VIDEO: 'video'
}

const words = (label: unknown) =>
  String(label ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

function promptScore(node: LGraphNode, fed: string[]): number {
  if (node.isVirtualNode) return -1
  const boxes = (node.widgets ?? []).filter(
    (widget) => widget.type === 'customtext' || widget.options?.multiline
  )
  if (!boxes.length) return -1
  return Math.max(
    ...boxes.map((box) => {
      const own = [...words(node.title), ...words(box.name)]
      if ([...own, ...fed].some((w) => w === 'negative' || w === 'system'))
        return -1
      if (fed.includes('positive')) return 3
      if (own.includes('positive')) return 2
      if (own.includes('prompt')) return 1
      return 0
    })
  )
}

function findPrompt(nodes: LGraphNode[]): LGraphNode | null {
  const fedNames = new Map<LGraphNode, string[]>()
  for (const consumer of nodes)
    (consumer.inputs ?? []).forEach((input, slot) => {
      const producer = consumer.getInputNode(slot)
      if (producer)
        fedNames.set(producer, [
          ...(fedNames.get(producer) ?? []),
          ...words(input.name)
        ])
    })
  const ranked = nodes
    .map((node) => ({
      node,
      score: promptScore(node, fedNames.get(node) ?? [])
    }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
  const [best, next] = ranked
  if (!best) return null
  return !next || best.score > next.score ? best.node : null
}

function findSink(nodes: LGraphNode[]) {
  const sinks = filterOutputNodes(nodes).flatMap((node) => {
    const input = (node.inputs ?? []).find(
      (i) => i.link != null && MEDIA[String(i.type).toUpperCase()]
    )
    return input
      ? [{ node, mediaKind: MEDIA[String(input.type).toUpperCase()]! }]
      : []
  })
  const [first] = sinks
  return first && sinks.every((sink) => sink.mediaKind === first.mediaKind)
    ? first
    : null
}

export function heuristicRoles(graph: LGraph): HeuristicRoles | null {
  const active = collectAllNodes(graph).filter((node) => {
    const executionId = getExecutionIdByNode(graph, node)
    return executionId ? isExecutionPathActive(graph, executionId) : false
  })
  const sink = findSink(active)
  if (!sink) return null
  return {
    prompt: findPrompt(active),
    sink: sink.node,
    mediaKind: sink.mediaKind
  }
}
