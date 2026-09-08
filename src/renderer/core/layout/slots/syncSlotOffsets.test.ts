import { beforeEach, describe, expect, it, vi } from 'vitest'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { toNodeId } from '@/types/nodeId'
import { slotId } from '@/types/slotId'
import type { UUID } from '@/utils/uuid'

import { syncSlotOffsets } from './syncSlotOffsets'

const GRAPH_ID = vi.hoisted<UUID>(() => 'graph-id')

function setRect(element: HTMLElement, rect: DOMRect): void {
  element.getBoundingClientRect = () => rect
}

describe('syncSlotOffsets', () => {
  beforeEach(() => layoutStore.resetForTests())

  it('stores canvas-scale-independent offsets relative to the node', () => {
    const nodeId = toNodeId('node-with-hyphen')
    const node = document.createElement('div')
    node.dataset.nodeId = String(nodeId)
    Object.defineProperty(node, 'offsetWidth', { value: 200 })
    setRect(node, new DOMRect(100, 200, 400, 300))

    const input = document.createElement('div')
    input.dataset.slotKey = slotId(nodeId, 'input', 0)
    setRect(input, new DOMRect(88, 248, 24, 40))
    node.append(input)

    const output = document.createElement('div')
    output.dataset.slotKey = slotId(nodeId, 'output', 1)
    setRect(output, new DOMRect(488, 288, 24, 40))
    node.append(output)

    syncSlotOffsets(node, GRAPH_ID, nodeId)

    expect(
      layoutStore.getSlotOffset(GRAPH_ID, nodeId, 0, 'input', 'expanded')
    ).toEqual({ x: 0, y: 4 })
    expect(
      layoutStore.getSlotOffset(GRAPH_ID, nodeId, 1, 'output', 'expanded')
    ).toEqual({ x: 200, y: 24 })
  })

  it('stores collapsed offsets separately from expanded geometry', () => {
    const nodeId = toNodeId('collapsed')
    const node = document.createElement('div')
    node.dataset.nodeId = String(nodeId)
    node.dataset.collapsed = ''
    Object.defineProperty(node, 'offsetWidth', { value: 280 })
    setRect(node, new DOMRect(100, 200, 280, 30))

    const input = document.createElement('div')
    input.dataset.slotKey = slotId(nodeId, 'input', 1)
    setRect(input, new DOMRect(110, 211, 8, 8))
    node.append(input)

    const output = document.createElement('div')
    output.dataset.slotKey = slotId(nodeId, 'output', 0)
    setRect(output, new DOMRect(376, 211, 8, 8))
    node.append(output)

    syncSlotOffsets(node, GRAPH_ID, nodeId)

    expect(
      layoutStore.getSlotOffset(GRAPH_ID, nodeId, 0, 'output', 'expanded')
    ).toBeNull()
    expect(
      layoutStore.getSlotOffset(GRAPH_ID, nodeId, 0, 'output', 'collapsed')
    ).toEqual({ x: 280, y: -15 })
    expect(
      layoutStore.getSlotOffset(GRAPH_ID, nodeId, 1, 'input', 'collapsed')
    ).toEqual({ x: 14, y: -15 })
  })

  it('clears stored offsets when the node has no rendered slots', () => {
    const nodeId = toNodeId('empty')
    const node = document.createElement('div')
    layoutStore.updateNodeSlotOffsets(
      GRAPH_ID,
      nodeId,
      [{ index: 0, type: 'input', position: { x: 1, y: 2 } }],
      'expanded'
    )

    syncSlotOffsets(node, GRAPH_ID, nodeId)

    expect(
      layoutStore.getSlotOffset(GRAPH_ID, nodeId, 0, 'input', 'expanded')
    ).toBeNull()
  })

  it('preserves stored offsets when the node has no measurable scale', () => {
    const nodeId = toNodeId('hidden')
    const node = document.createElement('div')
    const input = document.createElement('div')
    input.dataset.slotKey = slotId(nodeId, 'input', 0)
    node.append(input)
    layoutStore.updateNodeSlotOffsets(
      GRAPH_ID,
      nodeId,
      [{ index: 0, type: 'input', position: { x: 1, y: 2 } }],
      'expanded'
    )

    syncSlotOffsets(node, GRAPH_ID, nodeId)

    expect(
      layoutStore.getSlotOffset(GRAPH_ID, nodeId, 0, 'input', 'expanded')
    ).toEqual({ x: 1, y: 2 })
  })
})
