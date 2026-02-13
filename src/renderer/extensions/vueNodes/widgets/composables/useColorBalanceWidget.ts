import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  ColorBalanceSettings,
  IBaseWidget,
  IColorBalanceWidget,
  INumericWidget
} from '@/lib/litegraph/src/types/widgets'
import type {
  ColorBalanceInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

interface FieldConfig {
  key: keyof ColorBalanceSettings
  min: number
  max: number
  step: number
  step2: number
  precision: number
}

const FIELDS: FieldConfig[] = [
  { key: 'shadows_red', min: -100, max: 100, step: 50, step2: 1, precision: 0 },
  {
    key: 'shadows_green',
    min: -100,
    max: 100,
    step: 50,
    step2: 1,
    precision: 0
  },
  {
    key: 'shadows_blue',
    min: -100,
    max: 100,
    step: 50,
    step2: 1,
    precision: 0
  },
  {
    key: 'midtones_red',
    min: -100,
    max: 100,
    step: 50,
    step2: 1,
    precision: 0
  },
  {
    key: 'midtones_green',
    min: -100,
    max: 100,
    step: 50,
    step2: 1,
    precision: 0
  },
  {
    key: 'midtones_blue',
    min: -100,
    max: 100,
    step: 50,
    step2: 1,
    precision: 0
  },
  {
    key: 'highlights_red',
    min: -100,
    max: 100,
    step: 50,
    step2: 1,
    precision: 0
  },
  {
    key: 'highlights_green',
    min: -100,
    max: 100,
    step: 50,
    step2: 1,
    precision: 0
  },
  {
    key: 'highlights_blue',
    min: -100,
    max: 100,
    step: 50,
    step2: 1,
    precision: 0
  }
]

const DEFAULT_SETTINGS: ColorBalanceSettings = {
  shadows_red: 0,
  shadows_green: 0,
  shadows_blue: 0,
  midtones_red: 0,
  midtones_green: 0,
  midtones_blue: 0,
  highlights_red: 0,
  highlights_green: 0,
  highlights_blue: 0
}

function isColorBalanceWidget(
  widget: IBaseWidget
): widget is IColorBalanceWidget {
  return widget.type === 'colorbalance'
}

function isNumericWidget(widget: IBaseWidget): widget is INumericWidget {
  return widget.type === 'number'
}

export const useColorBalanceWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IColorBalanceWidget => {
    const spec = inputSpec as ColorBalanceInputSpec
    const { name } = spec
    const defaultValue: ColorBalanceSettings = spec.default ?? {
      ...DEFAULT_SETTINGS
    }

    const subWidgets: INumericWidget[] = []

    const rawWidget = node.addWidget(
      'colorbalance',
      name,
      { ...defaultValue },
      null,
      {
        serialize: true,
        canvasOnly: false
      }
    )

    if (!isColorBalanceWidget(rawWidget)) {
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
          this.value = Math.round(v)
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
