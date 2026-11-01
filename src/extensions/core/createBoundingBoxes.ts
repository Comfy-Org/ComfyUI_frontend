import { cloneDeep } from 'es-toolkit'
import { nextTick } from 'vue'

import { isBoundingBox } from '@/composables/boundingBoxes/boundingBoxesUtil'
import type { ComfyExtension } from '@/types/comfy'

function isCanvasDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function withCanvasSize(value: unknown, width: number, height: number) {
  if (!Array.isArray(value)) return value
  return value.map((box: unknown) => {
    if (!isBoundingBox(box)) return box
    const metadata =
      typeof box.metadata === 'object' && box.metadata !== null
        ? box.metadata
        : {}
    return {
      ...box,
      metadata: { ...metadata, _canvas_size: { width, height } }
    }
  })
}

const INTERNAL_WIDGETS = new Set(['last_incoming'])

export const createBoundingBoxesExtension: ComfyExtension = {
  name: 'Comfy.CreateBoundingBoxes',

  nodeCreated(node) {
    if (node.constructor.comfyClass !== 'CreateBoundingBoxes') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 420), Math.max(oldHeight, 560)])

    for (const widget of node.widgets ?? []) {
      if (INTERNAL_WIDGETS.has(widget.name)) widget.hidden = true
    }
    const editorState = node.widgets?.find(
      (widget) => widget.name === 'editor_state'
    )
    if (!editorState) return
    editorState.serializeValue = async () => {
      await nextTick()
      const width = node.widgets?.find(
        (widget) => widget.name === 'width'
      )?.value
      const height = node.widgets?.find(
        (widget) => widget.name === 'height'
      )?.value
      const boxes = cloneDeep(editorState.value)
      if (!isCanvasDimension(width) || !isCanvasDimension(height)) return boxes
      return withCanvasSize(boxes, width, height)
    }
  }
}
