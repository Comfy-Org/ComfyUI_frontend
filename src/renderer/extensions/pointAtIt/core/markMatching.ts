import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { boundsOf, coveredFraction, rectContains } from './geometry'
import type { Point, Rect } from './geometry'
import type { HostNode, HostSetting } from './pointHost'
import type { Chip, Draft } from './pointState'
import { addressKey } from './targetAddress'
import type { GraphAddress } from './targetAddress'

const CLICK_EXTENT = 6
const NODE_COVERED = 0.6
const SETTING_COVERED = 0.5

/** What a hit test found under a point. */
export interface PickedTarget {
  address: GraphAddress
  label: string
  rect: Rect
}

function chip(target: GraphAddress, label: string): Chip {
  return { id: addressKey(target), target, label }
}

function nodeChip(node: HostNode): Chip {
  return chip({ kind: 'node', nodeId: node.id }, node.title)
}

function settingLabel(node: HostNode, setting: HostSetting): string {
  return `${node.title} › ${setting.label}`
}

function settingChip(node: HostNode, setting: HostSetting): Chip {
  return chip(
    { kind: 'setting', nodeId: node.id, setting: setting.name },
    settingLabel(node, setting)
  )
}

function isClick(stroke: readonly Point[]): boolean {
  const { width, height } = boundsOf(stroke)
  return width <= CLICK_EXTENT && height <= CLICK_EXTENT
}

/** The setting row under the point, else the node under it, topmost node first. */
export function targetAtPoint(
  point: Point,
  nodes: readonly HostNode[]
): PickedTarget | null {
  const node = nodes.findLast(
    (candidate) => candidate.rect && rectContains(candidate.rect, point)
  )
  if (!node?.rect) return null
  for (const setting of node.settings) {
    if (setting.rect && rectContains(setting.rect, point))
      return {
        address: { kind: 'setting', nodeId: node.id, setting: setting.name },
        label: settingLabel(node, setting),
        rect: setting.rect
      }
  }
  return {
    address: { kind: 'node', nodeId: node.id },
    label: node.title,
    rect: node.rect
  }
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
  if (isClick(stroke)) {
    const picked = targetAtPoint(stroke[0], nodes)
    return picked ? [chip(picked.address, picked.label)] : []
  }
  return nodes.flatMap((node) =>
    node.rect ? chipsUnderStroke(node, node.rect, stroke) : []
  )
}

/** One comment covering every selected node, or null when nothing is selected. */
export function draftForSelection(
  selection: readonly NodeLocatorId[],
  nodes: readonly HostNode[]
): Draft | null {
  const selected = nodes.filter((node) => selection.includes(node.id))
  if (selected.length === 0) return null
  return {
    annotationId: null,
    targets: selected.map((node) => ({ kind: 'node', nodeId: node.id })),
    label: selected.map((node) => node.title).join(', '),
    comment: ''
  }
}
