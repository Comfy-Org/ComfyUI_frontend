import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  ColorCorrectSettings,
  IBaseWidget,
  IColorCorrectWidget,
  INumericWidget
} from '@/lib/litegraph/src/types/widgets'
import type {
  ColorCorrectInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

interface FieldConfig {
  key: keyof ColorCorrectSettings
  min: number
  max: number
  step: number
  step2: number
  precision: number
}

const FIELDS: FieldConfig[] = [
  { key: 'temperature', min: -100, max: 100, step: 50, step2: 5, precision: 0 },
  { key: 'hue', min: -90, max: 90, step: 50, step2: 5, precision: 0 },
  { key: 'brightness', min: -100, max: 100, step: 50, step2: 5, precision: 0 },
  { key: 'contrast', min: -100, max: 100, step: 50, step2: 5, precision: 0 },
  { key: 'saturation', min: -100, max: 100, step: 50, step2: 5, precision: 0 },
  { key: 'gamma', min: 0.2, max: 2.2, step: 1, step2: 0.1, precision: 1 }
]

const DEFAULT_SETTINGS: ColorCorrectSettings = {
  temperature: 0,
  hue: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  gamma: 1.0
}

function isColorCorrectWidget(
  widget: IBaseWidget
): widget is IColorCorrectWidget {
  return widget.type === 'colorcorrect'
}

function isNumericWidget(widget: IBaseWidget): widget is INumericWidget {
  return widget.type === 'number'
}

export const useColorCorrectWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IColorCorrectWidget => {
    const spec = inputSpec as ColorCorrectInputSpec
    const { name } = spec
    const defaultValue: ColorCorrectSettings = spec.default ?? {
      ...DEFAULT_SETTINGS
    }

    const subWidgets: INumericWidget[] = []

    const rawWidget = node.addWidget(
      'colorcorrect',
      name,
      { ...defaultValue },
      null,
      {
        serialize: true,
        canvasOnly: false
      }
    )

    if (!isColorCorrectWidget(rawWidget)) {
      throw new Error(`Unexpected widget type: ${rawWidget.type}`)
    }

    const widget = rawWidget

    widget.callback = () => {
      for (let i = 0; i < FIELDS.length; i++) {
        const field = FIELDS[i]
        const subWidget = subWidgets[i]
        if (subWidget) {
          subWidget.value = widget.value[field.key]
        }
      }
    }

    for (const field of FIELDS) {
      const subWidget = node.addWidget(
        'number',
        field.key,
        defaultValue[field.key],
        function (this: INumericWidget, v: number) {
          this.value =
            field.precision === 0 ? Math.round(v) : Math.round(v * 10) / 10
          widget.value[field.key] = this.value
          widget.callback?.(widget.value)
        },
        {
          min: field.min,
          max: field.max,
          step: field.step,
          step2: field.step2,
          precision: field.precision,
          serialize: false,
          canvasOnly: true
        }
      )

      if (!isNumericWidget(subWidget)) {
        throw new Error(`Unexpected widget type: ${subWidget.type}`)
      }

      subWidgets.push(subWidget)
    }

    widget.linkedWidgets = subWidgets

    return widget
  }
}
