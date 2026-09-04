import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IBoundingBoxWidget,
  IImageCropWidget,
  INumericWidget
} from '@/lib/litegraph/src/types/widgets'
import { NumberWidget } from '@/lib/litegraph/src/widgets/NumberWidget'
import type { Bounds } from '@/renderer/core/layout/types'
import type {
  BoundingBoxInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

function isBoundingBoxLikeWidget(
  widget: IBaseWidget
): widget is IBoundingBoxWidget | IImageCropWidget {
  return widget.type === 'boundingbox' || widget.type === 'imagecrop'
}

const FIELDS: (keyof Bounds)[] = ['x', 'y', 'width', 'height']

function isBounds(value: unknown): value is Bounds {
  return (
    !!value &&
    typeof value === 'object' &&
    FIELDS.every(
      (field) => typeof (value as Record<string, unknown>)[field] === 'number'
    )
  )
}

export const useBoundingBoxWidget = (): ComfyWidgetConstructorV2 => {
  return (
    node: LGraphNode,
    inputSpec: InputSpecV2
  ): IBoundingBoxWidget | IImageCropWidget => {
    const spec = inputSpec as BoundingBoxInputSpec
    const { name, component } = spec
    const defaultValue: Bounds = spec.default ?? {
      x: 0,
      y: 0,
      width: 512,
      height: 512
    }

    const widgetType = component === 'ImageCrop' ? 'imagecrop' : 'boundingbox'

    const rawWidget = node.addWidget(
      widgetType,
      name,
      { ...defaultValue },
      () => {},
      {
        serialize: true,
        canvasOnly: false
      }
    )

    if (!isBoundingBoxLikeWidget(rawWidget)) {
      throw new Error(`Unexpected widget type: ${rawWidget.type}`)
    }

    const widget = rawWidget

    const currentBounds = (): Bounds =>
      isBounds(widget.value) ? widget.value : defaultValue

    const createFieldProjection = (field: keyof Bounds): NumberWidget => {
      const subWidget = new NumberWidget(
        {
          type: 'number',
          name: field,
          value: defaultValue[field],
          options: {
            min: field === 'width' || field === 'height' ? 1 : 0,
            max: 8192,
            step: 10,
            step2: 1,
            precision: 0,
            serialize: false,
            canvasOnly: true
          },
          y: 0
        },
        node
      )
      Object.defineProperty(subWidget, 'value', {
        get: () => currentBounds()[field],
        set: (v: number) => {
          widget.value = { ...currentBounds(), [field]: Math.round(v) }
        }
      })
      subWidget.setNodeId = () => {}
      return subWidget
    }

    const subWidgets: INumericWidget[] = []
    for (const field of FIELDS) {
      const subWidget = createFieldProjection(field)
      node.addCustomWidget(subWidget)
      subWidgets.push(subWidget)
    }
    node.expandToFitContent()

    widget.linkedWidgets = subWidgets

    return widget
  }
}
