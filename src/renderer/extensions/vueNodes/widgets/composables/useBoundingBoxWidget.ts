import {
  nodeWidgetValue,
  setNodeWidgetValue,
  watchNodeWidgetValues
} from '@/composables/node/widgetStoreSync'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IBoundingBoxWidget,
  IImageCropWidget,
  INumericWidget
} from '@/lib/litegraph/src/types/widgets'
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

function isNumericWidget(widget: IBaseWidget): widget is INumericWidget {
  return widget.type === 'number'
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

    const subWidgetName = (field: keyof Bounds) => `${name}.${field}`
    const subWidgetNames = FIELDS.map(subWidgetName)

    const subWidgets: INumericWidget[] = []
    for (const field of FIELDS) {
      const subWidget = node.addWidget(
        'number',
        subWidgetName(field),
        defaultValue[field],
        () => {},
        {
          min: field === 'width' || field === 'height' ? 1 : 0,
          max: 8192,
          step: 10,
          step2: 1,
          precision: 0,
          serialize: false,
          canvasOnly: true
        }
      )

      if (!isNumericWidget(subWidget)) {
        throw new Error(`Unexpected widget type: ${subWidget.type}`)
      }

      subWidget.label = field
      subWidgets.push(subWidget)
    }

    widget.linkedWidgets = subWidgets

    const syncSubWidgets = (bounds: Bounds) => {
      for (const field of FIELDS) {
        setNodeWidgetValue(node, subWidgetName(field), bounds[field])
      }
    }

    watchNodeWidgetValues(node, `bounds:${name}:main`, [name], ([bounds]) => {
      if (isBounds(bounds)) syncSubWidgets(bounds)
    })

    watchNodeWidgetValues(
      node,
      `bounds:${name}:fields`,
      subWidgetNames,
      (values) => {
        const bounds = nodeWidgetValue(node, name)
        if (!isBounds(bounds)) return
        if (values.some((value) => typeof value !== 'number')) return
        const fieldValues = values as number[]
        const mirrorsBounds = FIELDS.every(
          (field, i) => fieldValues[i] === bounds[field]
        )
        if (mirrorsBounds) return
        const next: Bounds = {
          x: Math.round(fieldValues[0]),
          y: Math.round(fieldValues[1]),
          width: Math.round(fieldValues[2]),
          height: Math.round(fieldValues[3])
        }
        if (FIELDS.every((field) => next[field] === bounds[field])) {
          syncSubWidgets(next)
          return
        }
        setNodeWidgetValue(node, name, next)
      }
    )

    return widget
  }
}
