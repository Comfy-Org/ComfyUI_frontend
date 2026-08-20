import { beforeEach, describe, expect, it } from 'vitest'
import { watchEffect } from 'vue'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { NodeLayout } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

/**
 * Two consumers can hold the ref for the same node: the node component itself
 * (via useNodeLayout) and any observer of that node's geometry — the first-run
 * tour coachmark, slot element tracking, a minimap. When the component
 * unmounts, its cleanup must not silence the other holders.
 */
describe('layoutStore.getNodeLayoutRef with multiple holders', () => {
  let nodeId: NodeId
  let nextNodeId = 0

  const layoutAt = (x: number): NodeLayout => ({
    id: nodeId,
    position: { x, y: 100 },
    size: { width: 200, height: 100 },
    zIndex: 0,
    visible: true,
    bounds: { x, y: 100, width: 200, height: 100 }
  })

  function createNode(id: NodeId) {
    layoutStore.setSource(LayoutSource.External)
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId: id,
      layout: layoutAt(100),
      timestamp: 1,
      source: LayoutSource.External,
      actor: 'test'
    })
  }

  function moveNodeTo(id: NodeId, x: number) {
    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId: id,
      position: { x, y: 100 },
      previousPosition: { x: 100, y: 100 },
      timestamp: 2,
      source: LayoutSource.External,
      actor: 'test'
    })
  }

  /** Mirrors how canvasCoachTarget observes a node: a watcher over the ref. */
  function observe(ref: { value: NodeLayout | null }) {
    const seen: (number | undefined)[] = []
    const stop = watchEffect(() => seen.push(ref.value?.position.x), {
      flush: 'sync'
    })
    return { seen, stop }
  }

  beforeEach(() => {
    layoutStore.initializeFromLiteGraph([])
    nodeId = toNodeId(`multi-holder-node-${nextNodeId++}`)
  })

  it('keeps notifying the second holder after the first unmounts', () => {
    createNode(nodeId)
    const holderA = layoutStore.retainNodeLayoutRef(nodeId)
    const holderB = layoutStore.retainNodeLayoutRef(nodeId)

    const { seen, stop } = observe(holderB.layout)
    expect(seen.at(-1)).toBe(100)

    // Holder A's component unmounts (viewport virtualization, graph switch...)
    holderA.release()

    moveNodeTo(nodeId, 500)
    stop()
    holderB.release()

    expect(seen.at(-1)).toBe(500)
  })

  it('drops the ref once the last holder releases', () => {
    createNode(nodeId)
    const holderA = layoutStore.retainNodeLayoutRef(nodeId)
    const holderB = layoutStore.retainNodeLayoutRef(nodeId)

    holderA.release()
    holderB.release()

    const rebuilt = layoutStore.retainNodeLayoutRef(nodeId)
    expect(rebuilt.layout).not.toBe(holderB.layout)
    rebuilt.release()
  })

  it('ignores a repeated release, which would drop a ref others still read', () => {
    createNode(nodeId)
    const holderA = layoutStore.retainNodeLayoutRef(nodeId)
    const holderB = layoutStore.retainNodeLayoutRef(nodeId)

    holderA.release()
    holderA.release()

    const { seen, stop } = observe(holderB.layout)
    moveNodeTo(nodeId, 500)
    stop()
    holderB.release()

    expect(seen.at(-1)).toBe(500)
  })
})
