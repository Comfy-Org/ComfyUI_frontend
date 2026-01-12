import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { app } from '../app'
import { $el } from '../ui'

interface ImageLike {
  naturalWidth: number
  naturalHeight: number
}

export function calculateImageGrid(
  imgs: ImageLike[],
  dw: number,
  dh: number
): {
  cellWidth: number
  cellHeight: number
  cols: number
  rows: number
  shiftX: number
} {
  let best = 0
  let w = imgs[0].naturalWidth
  let h = imgs[0].naturalHeight
  const numImages = imgs.length

  let cellWidth = 0
  let cellHeight = 0
  let cols = 1
  let rows = 1
  let shiftX = 0
  // compact style
  for (let c = 1; c <= numImages; c++) {
    const r = Math.ceil(numImages / c)
    const cW = dw / c
    const cH = dh / r
    const scaleX = cW / w
    const scaleY = cH / h

    const scale = Math.min(scaleX, scaleY, 1)
    const imageW = w * scale
    const imageH = h * scale
    const area = imageW * imageH * numImages

    if (area > best) {
      best = area
      cellWidth = imageW
      cellHeight = imageH
      cols = c
      rows = r
      shiftX = c * ((cW - imageW) / 2)
    }
  }

  return { cellWidth, cellHeight, cols, rows, shiftX }
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export function createImageHost(node: LGraphNode) {
  const el = $el('div.comfy-img-preview')
  let currentImgs: HTMLImageElement[] | null = null
  let first = true

  function updateSize() {
    if (!currentImgs) return

    let elH = el.clientHeight
    if (first) {
      first = false
      // On first run, if we are small then grow a bit
      if (elH < 190) {
        elH = 190
      }
      el.style.setProperty('--comfy-widget-min-height', elH.toString())
    } else {
      el.style.removeProperty('--comfy-widget-min-height')
    }

    const nw = node.size[0]
    const { cellWidth, cellHeight } = calculateImageGrid(
      currentImgs,
      nw - 20,
      elH
    )

    el.style.setProperty('--comfy-img-preview-width', `${cellWidth}px`)
    el.style.setProperty('--comfy-img-preview-height', `${cellHeight}px`)
  }
  return {
    el,
    getCurrentImage() {
      return currentImgs?.[0]
    },
    updateImages(imgs: HTMLImageElement[]) {
      if (imgs !== currentImgs) {
        if (currentImgs == null) {
          requestAnimationFrame(() => {
            updateSize()
          })
        }
        el.replaceChildren(...imgs)
        currentImgs = imgs
        node.onResize?.(node.size)
        node.graph?.setDirtyCanvas(true, true)
      }
    },
    getHeight() {
      updateSize()
    },
    onDraw() {
      // Element from point uses a hittest find elements so we need to toggle pointer events
      el.style.pointerEvents = 'all'
      const over = document.elementFromPoint(
        app.canvas.mouse[0],
        app.canvas.mouse[1]
      )
      el.style.pointerEvents = 'none'

      if (!over || !currentImgs) return
      // Set the overIndex so Open Image etc work
      const idx = currentImgs.indexOf(over as HTMLImageElement)
      node.overIndex = idx
    }
  }
}
