import { whenever } from '@vueuse/core'
import { watch } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import { drawSmartGuides } from './drawSmartGuides'
import { activeGuides } from './smartGuidesState'

const GAP_LABEL_FONT_SIZE = 10

/** Draws the active smart guides on the LiteGraph canvas while it renders the nodes itself. */
export function useLitegraphSmartGuides() {
  const canvasStore = useCanvasStore()
  let color = ''

  function draw(canvas: LGraphCanvas, ctx: CanvasRenderingContext2D) {
    const guides = activeGuides.value
    if (LiteGraph.vueNodesMode || !guides.length) return

    const { offset, scale } = canvas.ds
    ctx.save()
    ctx.strokeStyle = ctx.fillStyle = color
    ctx.font = `${GAP_LABEL_FONT_SIZE}px ${LiteGraph.NODE_FONT}`
    drawSmartGuides(ctx, guides, ({ x, y }) => ({
      x: (x + offset[0]) * scale,
      y: (y + offset[1]) * scale
    }))
    ctx.restore()
  }

  whenever(
    () => canvasStore.canvas,
    (canvas) => {
      canvas.onDrawOverlay = useChainCallback(canvas.onDrawOverlay, (ctx) =>
        draw(canvas, ctx)
      )
    },
    { immediate: true }
  )

  watch(
    activeGuides,
    (guides, shown) => {
      const canvas = canvasStore.canvas
      if (LiteGraph.vueNodesMode || !canvas) return
      if (!guides.length && !shown.length) return
      if (!shown.length)
        color = getComputedStyle(canvas.canvas).getPropertyValue('--primary')
      canvas.setDirty(true)
    },
    { flush: 'sync' }
  )
}
