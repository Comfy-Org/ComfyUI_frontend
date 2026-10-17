import { cloneDeep } from 'es-toolkit'
import { nextTick } from 'vue'

import { isBoundingBox } from '@/composables/boundingBoxes/boundingBoxesUtil'
import type {
  BoundingBoxesInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'
import type { BoundingBox } from '@/types/boundingBoxes'

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

export const useBoundingBoxesWidget = (): ComfyWidgetConstructorV2 => {
  return (node, inputSpec: InputSpecV2) => {
    const spec = inputSpec as BoundingBoxesInputSpec
    const defaultValue: BoundingBox[] =
      spec.default?.map((box) => ({
        ...box,
        metadata: { ...box.metadata, palette: [...box.metadata.palette] }
      })) ?? []
    const widget = node.addWidget(
      'boundingboxes',
      spec.name,
      defaultValue,
      null,
      {
        serialize: true,
        hideInPanel: true
      }
    )

    if (
      node.comfyClass === 'CreateBoundingBoxes' &&
      spec.name === 'editor_state'
    ) {
      widget.serializeValue = async () => {
        await nextTick()
        const width = node.widgets?.find((w) => w.name === 'width')?.value
        const height = node.widgets?.find((w) => w.name === 'height')?.value
        const boxes = cloneDeep(widget.value)
        if (!isCanvasDimension(width) || !isCanvasDimension(height))
          return boxes
        return withCanvasSize(boxes, width, height)
      }
    }

    return widget
  }
}
