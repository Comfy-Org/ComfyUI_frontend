import { t } from '@/i18n'
import { type LGraphNode, isComboWidget } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IComboWidget,
  IStringWidget
} from '@/lib/litegraph/src/types/widgets'
import { nextValueForLinkedTarget } from './valueControl'
import { useSettingStore } from '@/platform/settings/settingStore'
import { dynamicWidgets } from '@/core/graph/widgets/dynamicWidgets'
import { useBooleanWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBooleanWidget'
import { useBoundingBoxWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBoundingBoxWidget'
import { useCurveWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useCurveWidget'
import { useChartWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useChartWidget'
import { useColorWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useColorWidget'
import { useComboWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useComboWidget'
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
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDefSchema'

import type { ComfyApp } from './app'
import { IS_CONTROL_WIDGET } from './controlWidgetMarker'
import './domWidget'
import './errorNodeWidgets'

export { IS_CONTROL_WIDGET }

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

function controlValueRunBefore() {
  return useSettingStore().get('Comfy.WidgetControlMode') === 'before'
}

export function updateControlWidgetLabel(widget: IBaseWidget) {
  if (controlValueRunBefore()) {
    widget.label = t('g.control_before_generate')
  } else {
    widget.label = t('g.control_after_generate')
  }
}

const HAS_EXECUTED = Symbol()

export function addValueControlWidget(
  node: LGraphNode,
  targetWidget: IBaseWidget,
  defaultValue?: string,
  _values?: unknown,
  widgetName?: string,
  inputData?: InputSpec
): IComboWidget {
  let name = inputData?.[1]?.control_after_generate
  if (typeof name !== 'string') {
    name = widgetName
  }
  const widgets = addValueControlWidgets(
    node,
    targetWidget,
    defaultValue ?? 'randomize',
    {
      addFilterList: false,
      controlAfterGenerateName: name
    },
    inputData
  )
  return widgets[0]
}

export function addValueControlWidgets(
  node: LGraphNode,
  targetWidget: IBaseWidget,
  defaultValue?: string,
  options?: Record<string, any>,
  inputData?: InputSpec
): [IComboWidget, ...IStringWidget[]] {
  if (!defaultValue) defaultValue = 'randomize'
  if (!options) options = {}

  const getName = (defaultName: string, optionName: string) => {
    let name = defaultName
    if (options[optionName]) {
      name = options[optionName]
    } else if (typeof inputData?.[1]?.[defaultName] === 'string') {
      name = inputData?.[1]?.[defaultName]
    } else if (inputData?.[1]?.control_prefix) {
      name = inputData?.[1]?.control_prefix + ' ' + name
    }
    return name
  }

  const valueControl = node.addWidget(
    'combo',
    getName('control_after_generate', 'controlAfterGenerateName'),
    defaultValue,
    function () {},
    {
      values: ['fixed', 'increment', 'decrement', 'randomize'],
      serialize: false, // Don't include this in prompt.
      canvasOnly: true
    }
  ) as IComboWidget

  valueControl.tooltip =
    'Allows the linked widget to be changed automatically, for example randomizing the noise seed.'
  valueControl[IS_CONTROL_WIDGET] = true
  updateControlWidgetLabel(valueControl)
  Object.defineProperty(valueControl, 'disabled', {
    get: () => targetWidget.computedDisabled
  })
  const widgets: [IComboWidget, ...IStringWidget[]] = [valueControl]

  const isCombo = isComboWidget(targetWidget)
  let comboFilter: IStringWidget
  if (isCombo && valueControl.options.values) {
    // @ts-expect-error Combo widget values may be a dictionary or legacy function type
    valueControl.options.values.push('increment-wrap')
  }
  if (isCombo && options.addFilterList !== false) {
    comboFilter = node.addWidget(
      'string',
      getName('control_filter_list', 'controlFilterListName'),
      '',
      function () {},
      {
        serialize: false // Don't include this in prompt.
      }
    ) as IStringWidget
    updateControlWidgetLabel(comboFilter)
    comboFilter.tooltip =
      "Allows for filtering the list of values when changing the value via the control generate mode. Allows for RegEx matches in the format /abc/ to only filter to values containing 'abc'."
    Object.defineProperty(comboFilter, 'disabled', {
      get: () => targetWidget.computedDisabled
    })

    widgets.push(comboFilter)
  }

  function applyWidgetControl(isPartialExecution: boolean | undefined) {
    if (
      node.inputs?.some(
        (input, index) =>
          input.widget?.name === targetWidget.name &&
          node.isInputConnected(index)
      )
    )
      return

    const next = nextValueForLinkedTarget({
      target: targetWidget,
      linkedWidgets: targetWidget.linkedWidgets,
      nodeId: node.id,
      isPartialExecution
    })
    if (next === undefined) return

    targetWidget.value = next
    targetWidget.callback?.(next)
  }

  valueControl.beforeQueued = ({ isPartialExecution } = {}) => {
    if (controlValueRunBefore()) {
      // Don't run on first execution
      if (valueControl[HAS_EXECUTED]) {
        applyWidgetControl(isPartialExecution)
      }
    }
    valueControl[HAS_EXECUTED] = true
  }

  valueControl.afterQueued = ({ isPartialExecution } = {}) => {
    if (!controlValueRunBefore()) {
      applyWidgetControl(isPartialExecution)
    }
  }

  return widgets
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
  TEXTAREA: transformWidgetConstructorV2ToV1(useTextareaWidget()),
  CURVE: transformWidgetConstructorV2ToV1(useCurveWidget()),
  RANGE: transformWidgetConstructorV2ToV1(useRangeWidget()),
  BOUNDING_BOXES: transformWidgetConstructorV2ToV1(useBoundingBoxesWidget()),
  COLORS: transformWidgetConstructorV2ToV1(useColorsWidget()),
  ...dynamicWidgets
} as const

export function isValidWidgetType(
  key: unknown
): key is keyof typeof ComfyWidgets {
  return ComfyWidgets[key as keyof typeof ComfyWidgets] !== undefined
}
