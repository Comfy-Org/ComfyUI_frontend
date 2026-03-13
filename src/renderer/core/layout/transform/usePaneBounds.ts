/**
 * Manages the TransformPane's box-model size and coordinate offset so that
 * all canvas nodes sit within the div's pre-transform bounds.
 *
 * Chrome paints composited-layer children into the parent's GPU texture only
 * when they are within the parent's pre-transform box. Nodes outside the box
 * get promoted to individual compositing layers — causing "layer explosion"
 * that destroys pan/zoom frame rates.
 *
 * This composable dynamically computes the minimum offset and size needed to
 * contain every node in positive coordinate space. The offset is added to each
 * node's CSS `translate` and subtracted from the camera's `translate3d` so the
 * on-screen positions remain identical.
 *
 * Values only grow (never shrink) to avoid triggering mass re-renders when a
 * single node moves.
 */
import { createSharedComposable } from '@vueuse/core'
import { reactive, readonly } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

const PADDING = 2000
const INITIAL_OFFSET = 5000

function usePaneBoundsIndividual() {
  const offset = reactive({ x: INITIAL_OFFSET, y: INITIAL_OFFSET })
  const size = reactive({
    width: INITIAL_OFFSET * 2,
    height: INITIAL_OFFSET * 2
  })

  /**
   * Expand the pane to contain all given nodes.
   * Only grows offset and size — never shrinks — to avoid triggering
   * reactive style updates on every node when a single node moves.
   */
  function expandToContain(nodes: LGraphNode[]) {
    if (nodes.length === 0) return

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const node of nodes) {
      const x = node.pos[0]
      const y = node.pos[1]
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + node.size[0])
      maxY = Math.max(maxY, y + node.size[1])
    }

    const neededOffsetX = Math.max(Math.ceil(-minX) + PADDING, INITIAL_OFFSET)
    const neededOffsetY = Math.max(Math.ceil(-minY) + PADDING, INITIAL_OFFSET)

    if (neededOffsetX > offset.x) offset.x = neededOffsetX
    if (neededOffsetY > offset.y) offset.y = neededOffsetY

    const neededWidth = Math.ceil(maxX) + offset.x + PADDING
    const neededHeight = Math.ceil(maxY) + offset.y + PADDING

    if (neededWidth > size.width) size.width = neededWidth
    if (neededHeight > size.height) size.height = neededHeight
  }

  return {
    offset: readonly(offset),
    size: readonly(size),
    expandToContain
  }
}

export const usePaneBounds = createSharedComposable(usePaneBoundsIndividual)
