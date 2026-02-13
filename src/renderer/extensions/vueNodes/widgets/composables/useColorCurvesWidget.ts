import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  ColorCurvesSettings,
  IBaseWidget,
  IColorCurvesWidget
} from '@/lib/litegraph/src/types/widgets'
import type {
  ColorCurvesInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

const DEFAULT_SETTINGS: ColorCurvesSettings = {
  rgb: [
    [0, 0],
    [1, 1]
  ],
  red: [
    [0, 0],
    [1, 1]
  ],
  green: [
    [0, 0],
    [1, 1]
  ],
  blue: [
    [0, 0],
    [1, 1]
  ]
}

function isColorCurvesWidget(
  widget: IBaseWidget
): widget is IColorCurvesWidget {
  return widget.type === 'colorcurves'
}

export const useColorCurvesWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IColorCurvesWidget => {
    const spec = inputSpec as ColorCurvesInputSpec
    const { name } = spec
    const defaultValue: ColorCurvesSettings = spec.default ?? {
      ...DEFAULT_SETTINGS,
      rgb: [...DEFAULT_SETTINGS.rgb],
      red: [...DEFAULT_SETTINGS.red],
      green: [...DEFAULT_SETTINGS.green],
      blue: [...DEFAULT_SETTINGS.blue]
    }

    const rawWidget = node.addWidget(
      'colorcurves',
      name,
      { ...defaultValue },
      null,
      {
        serialize: true,
        canvasOnly: false
      }
    )

    if (!isColorCurvesWidget(rawWidget)) {
      throw new Error(`Unexpected widget type: ${rawWidget.type}`)
    }

    return rawWidget
  }
}
