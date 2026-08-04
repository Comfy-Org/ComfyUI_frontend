import { beforeEach, describe, expect, it } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { canvasLayoutMutations } from '@/renderer/core/layout/operations/graphLayoutRegistration'
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
    canvasLayoutMutations().createNode(GRAPH, NODE, {
      position: { x: 0, y: 0 },
      size: { width: 100, height: HEIGHT }
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

  /**
   * The shared ResizeObserver leaves `LayoutSource.DOM` set on the store, and
   * drag-end passes already-title-less heights without resetting it — which
   * took the title height off a second time.
   */
  it('ignores an ambient DOM source left set by an earlier mutation', () => {
    layoutStore.setSource(LayoutSource.DOM)

    layoutStore.batchUpdateNodeBounds(GRAPH, bounds(HEIGHT), {
      source: LayoutSource.Vue
    })

    expect(storedHeight()).toBe(HEIGHT)
  })
})
