import { beforeEach, describe, expect, it } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'

const GRAPH = createUuidv4()
const NODE = toNodeId('1')
const HEIGHT = 200

function storedHeight() {
  return layoutStore.getNodeLayoutRef(GRAPH, NODE).value?.size.height
}

describe('batchUpdateNodeBounds height normalization', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: GRAPH,
      nodeId: NODE,
      layout: {
        id: NODE,
        position: { x: 0, y: 0 },
        size: { width: 100, height: HEIGHT },
        zIndex: 0,
        visible: true,
        bounds: { x: 0, y: 0, width: 100, height: HEIGHT }
      },
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })
  })

  const bounds = (height: number) => [
    { nodeId: NODE, bounds: { x: 0, y: 0, width: 100, height } }
  ]

  it('subtracts the title height from DOM-measured bounds', () => {
    layoutStore.batchUpdateNodeBounds(GRAPH, bounds(HEIGHT), {
      source: LayoutSource.Vue,
      boundsIncludeTitleHeight: true
    })

    expect(storedHeight()).toBe(HEIGHT - LiteGraph.NODE_TITLE_HEIGHT)
  })

  it('stores store-sourced bounds as given', () => {
    layoutStore.batchUpdateNodeBounds(GRAPH, bounds(HEIGHT), {
      source: LayoutSource.Vue
    })

    expect(storedHeight()).toBe(HEIGHT)
  })
})
