import { getControlProjections } from '@/core/graph/widgets/control/controlProjection'
import { registerWidgetControlFromConfig } from '@/core/graph/widgets/control/widgetControl'
import { isValueControlMode } from '@/core/graph/widgets/control/valueControl'
import type { ValueControlMode } from '@/core/graph/widgets/control/valueControl'
import { t } from '@/i18n'
import { type LGraphNode, isComboWidget } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IComboWidget,
  IStringWidget
} from '@/lib/litegraph/src/types/widgets'
import { registerWidgetControlLabelProvider } from '@/lib/litegraph/src/widgetControlLabel'
import { useSettingStore } from '@/platform/settings/settingStore'
import { dynamicWidgets } from '@/core/graph/widgets/dynamicWidgets'
import { useBooleanWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBooleanWidget'
import { useBoundingBoxWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBoundingBoxWidget'
import { useCurveWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useCurveWidget'
import { useChartWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useChartWidget'
import { useColorWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useColorWidget'
import { useComboWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useComboWidget'
import { useCompositorWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useCompositorWidget'
import { useFloatWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useFloatWidget'
import { useGalleriaWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useGalleriaWidget'
import { useBoundingBoxesWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBoundingBoxesWidget'
import { useColorsWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useColorsWidget'
import { useImageCompareWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageCompareWidget'
import { useImageUploadWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget'
import { useIntWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useIntWidget'
import { useMarkdownWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget'
import { usePainterWidget } from '@/renderer/extensions/vueNodes/widgets/composables/usePainterWidget'
import { useRangeWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useRangeWidget'
import { useStringWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget'
import { useTextareaWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useTextareaWidget'
import { useVideoEditWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useVideoEditWidget'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDefSchema'

import type { ComfyApp } from './app'
import './domWidget'
import './errorNodeWidgets'

registerWidgetControlLabelProvider(() =>
  useSettingStore().get('Comfy.WidgetControlMode') === 'before'
    ? t('g.control_before_generate')
    : t('g.control_after_generate')
)

export type ComfyWidgetConstructorV2 = (
  node: LGraphNode,
  inputSpec: InputSpecV2
) => IBaseWidget

export type ComfyWidgetConstructor = (
  node: LGraphNode,
  inputName: string,
  inputData: InputSpec,
  app: ComfyApp,
  widgetName?: string
) => { widget: IBaseWidget; minWidth?: number; minHeight?: number }

/**
 * Transforms a V2 widget constructor to a V1 widget constructor.
 * @param widgetConstructorV2 The V2 widget constructor to transform.
 * @returns The transformed V1 widget constructor.
 */
const transformWidgetConstructorV2ToV1 = (
  widgetConstructorV2: ComfyWidgetConstructorV2
): ComfyWidgetConstructor => {
  return (node, inputName, inputData) => {
    const inputSpec = transformInputSpecV1ToV2(inputData, {
      name: inputName
    })
    const widget = widgetConstructorV2(node, inputSpec)
    return {
      widget,
      minWidth: widget.options.minNodeSize?.[0],
      minHeight: widget.options.minNodeSize?.[1]
    }
  }
}

function toControlMode(value: string | undefined): ValueControlMode {
  return isValueControlMode(value) ? value : 'randomize'
}

interface ValueControlOptions extends Record<string, unknown> {
  addFilterList?: boolean
  controlAfterGenerateName?: string
  controlFilterListName?: string
}

function configureValueControl(
  targetWidget: IBaseWidget,
  defaultValue: string | undefined,
  addFilterList: boolean
): void {
  targetWidget.controlConfig = {
    mode: toControlMode(defaultValue),
    hasFilter: isComboWidget(targetWidget) && addFilterList
  }
  registerWidgetControlFromConfig(targetWidget)
}

function resolveControlTarget(
  nodeOrTarget: LGraphNode | IBaseWidget,
  legacyTarget: IBaseWidget | undefined
): IBaseWidget {
  if (legacyTarget) return legacyTarget
  if ('options' in nodeOrTarget) return nodeOrTarget
  throw new TypeError('Value control target widget is required')
}

function configuredControlProjections(
  targetWidget: IBaseWidget
): [IComboWidget, ...IStringWidget[]] {
  const [mode, ...filters] = getControlProjections(targetWidget)
  if (!mode) throw new Error('Value control was not configured')
  return [mode, ...filters]
}

function legacyControlName(
  defaultName: string,
  optionName: keyof ValueControlOptions,
  options: ValueControlOptions,
  inputData: InputSpec | undefined
): string {
  const optionNameValue = options[optionName]
  if (typeof optionNameValue === 'string') return optionNameValue
  const inputName = inputData?.[1]?.[defaultName]
  if (typeof inputName === 'string') return inputName
  const prefix = inputData?.[1]?.control_prefix
  return prefix ? `${prefix} ${defaultName}` : defaultName
}

export function addValueControlWidget(
  targetWidget: IBaseWidget,
  defaultValue?: string
): void
export function addValueControlWidget(
  node: LGraphNode,
  targetWidget: IBaseWidget,
  defaultValue?: string,
  values?: unknown,
  widgetName?: string,
  inputData?: InputSpec
): IComboWidget
export function addValueControlWidget(
  nodeOrTarget: LGraphNode | IBaseWidget,
  targetOrDefault?: IBaseWidget | string,
  legacyDefault?: string,
  _legacyValues?: unknown,
  legacyWidgetName?: string,
  legacyInputData?: InputSpec
): void | IComboWidget {
  const legacyTarget =
    typeof targetOrDefault === 'object' ? targetOrDefault : undefined
  const targetWidget = resolveControlTarget(nodeOrTarget, legacyTarget)
  const defaultValue = legacyTarget
    ? legacyDefault
    : typeof targetOrDefault === 'string'
      ? targetOrDefault
      : undefined
  configureValueControl(targetWidget, defaultValue, false)
  if (!legacyTarget) return

  const [mode] = configuredControlProjections(targetWidget)
  mode.name = legacyControlName(
    'control_after_generate',
    'controlAfterGenerateName',
    { controlAfterGenerateName: legacyWidgetName },
    legacyInputData
  )
  return mode
}

export function addValueControlWidgets(
  targetWidget: IBaseWidget,
  defaultValue?: string,
  options?: ValueControlOptions
): void
export function addValueControlWidgets(
  node: LGraphNode,
  targetWidget: IBaseWidget,
  defaultValue?: string,
  options?: ValueControlOptions,
  inputData?: InputSpec
): [IComboWidget, ...IStringWidget[]]
export function addValueControlWidgets(
  nodeOrTarget: LGraphNode | IBaseWidget,
  targetOrDefault?: IBaseWidget | string,
  defaultOrOptions?: string | ValueControlOptions,
  legacyOptions: ValueControlOptions = {},
  legacyInputData?: InputSpec
): void | [IComboWidget, ...IStringWidget[]] {
  const legacyTarget =
    typeof targetOrDefault === 'object' ? targetOrDefault : undefined
  const targetWidget = resolveControlTarget(nodeOrTarget, legacyTarget)
  const defaultValue = legacyTarget
    ? typeof defaultOrOptions === 'string'
      ? defaultOrOptions
      : undefined
    : typeof targetOrDefault === 'string'
      ? targetOrDefault
      : undefined
  const options = legacyTarget
    ? legacyOptions
    : typeof defaultOrOptions === 'object'
      ? defaultOrOptions
      : {}
  configureValueControl(
    targetWidget,
    defaultValue,
    options.addFilterList !== false
  )
  if (!legacyTarget) return

  const projections = configuredControlProjections(targetWidget)
  projections[0].name = legacyControlName(
    'control_after_generate',
    'controlAfterGenerateName',
    options,
    legacyInputData
  )
  if (projections[1]) {
    projections[1].name = legacyControlName(
      'control_filter_list',
      'controlFilterListName',
      options,
      legacyInputData
    )
  }
  return projections
}

export const ComfyWidgets = {
  INT: transformWidgetConstructorV2ToV1(useIntWidget()),
  FLOAT: transformWidgetConstructorV2ToV1(useFloatWidget()),
  BOOLEAN: transformWidgetConstructorV2ToV1(useBooleanWidget()),
  STRING: transformWidgetConstructorV2ToV1(useStringWidget()),
  MARKDOWN: transformWidgetConstructorV2ToV1(useMarkdownWidget()),
  COMBO: transformWidgetConstructorV2ToV1(useComboWidget()),
  IMAGEUPLOAD: useImageUploadWidget(),
  COLOR: transformWidgetConstructorV2ToV1(useColorWidget()),
  IMAGECOMPARE: transformWidgetConstructorV2ToV1(useImageCompareWidget()),
  BOUNDING_BOX: transformWidgetConstructorV2ToV1(useBoundingBoxWidget()),
  CHART: transformWidgetConstructorV2ToV1(useChartWidget()),
  GALLERIA: transformWidgetConstructorV2ToV1(useGalleriaWidget()),
  PAINTER: transformWidgetConstructorV2ToV1(usePainterWidget()),
  COMPOSITOR: transformWidgetConstructorV2ToV1(useCompositorWidget()),
  TEXTAREA: transformWidgetConstructorV2ToV1(useTextareaWidget()),
  CURVE: transformWidgetConstructorV2ToV1(useCurveWidget()),
  RANGE: transformWidgetConstructorV2ToV1(useRangeWidget()),
  VIDEO_EDIT: transformWidgetConstructorV2ToV1(useVideoEditWidget()),
  BOUNDING_BOXES: transformWidgetConstructorV2ToV1(useBoundingBoxesWidget()),
  COLORS: transformWidgetConstructorV2ToV1(useColorsWidget()),
  ...dynamicWidgets
} as const

export function isValidWidgetType(
  key: unknown
): key is keyof typeof ComfyWidgets {
  return ComfyWidgets[key as keyof typeof ComfyWidgets] !== undefined
}
