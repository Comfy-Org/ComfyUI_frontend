import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { addressKey } from './agentReply'
import type { TargetAddress } from './agentReply'
import { boundsOf, coveredFraction, rectContains, unionRects } from './geometry'
import type { Point, Rect } from './geometry'
import type { HostNode, HostSetting } from './pointHost'
import type { Chip } from './pointState'

const CLICK_EXTENT = 6
const NODE_COVERED = 0.6
const SETTING_COVERED = 0.5

function chip(target: TargetAddress, label: string): Chip {
  return { id: addressKey(target), target, label }
}

function nodeChip(node: HostNode): Chip {
  return chip({ kind: 'node', nodeId: node.id }, node.title)
}

function settingChip(node: HostNode, setting: HostSetting): Chip {
  return chip(
    { kind: 'setting', nodeId: node.id, setting: setting.name },
    `${node.title} › ${setting.label}`
  )
}

function isClick(stroke: readonly Point[]): boolean {
  const { width, height } = boundsOf(stroke)
  return width <= CLICK_EXTENT && height <= CLICK_EXTENT
}

function chipsAtPoint(point: Point, nodes: readonly HostNode[]): Chip[] {
  const node = nodes.findLast(
    (candidate) => candidate.rect && rectContains(candidate.rect, point)
  )
  if (!node) return []
  const setting = node.settings.find(
    (candidate) => candidate.rect && rectContains(candidate.rect, point)
  )
  return [setting ? settingChip(node, setting) : nodeChip(node)]
}

function chipsUnderStroke(
  node: HostNode,
  rect: Rect,
  stroke: readonly Point[]
): Chip[] {
  const covered = coveredFraction(rect, stroke)
  if (covered >= NODE_COVERED) return [nodeChip(node)]
  const settings = node.settings.filter(
    (setting) =>
      setting.rect && coveredFraction(setting.rect, stroke) >= SETTING_COVERED
  )
  if (settings.length > 0)
    return settings.map((setting) => settingChip(node, setting))
  const touched =
    covered > 0 || stroke.some((point) => rectContains(rect, point))
  return touched ? [nodeChip(node)] : []
}

/** Reads a stroke as the nodes and settings it marks, in drawing order of the nodes. */
export function matchMark(
  stroke: readonly Point[],
  nodes: readonly HostNode[]
): Chip[] {
  if (stroke.length === 0) return []
  if (isClick(stroke)) return chipsAtPoint(stroke[0], nodes)
  return nodes.flatMap((node) =>
    node.rect ? chipsUnderStroke(node, node.rect, stroke) : []
  )
}

/** One chip per selected node, anchored at the selected nodes that are drawn. */
export function markSelection(
  selection: readonly NodeLocatorId[],
  nodes: readonly HostNode[],
  fallbackAnchor: Rect
): { chips: Chip[]; anchor: Rect } {
  const selected = nodes.filter((node) => selection.includes(node.id))
  const drawn = selected.flatMap((node) => (node.rect ? [node.rect] : []))
  return {
    chips: selected.map(nodeChip),
    anchor: unionRects(drawn) ?? fallbackAnchor
  }
}
