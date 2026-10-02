import { t } from '@/i18n'
import { isComboWidget } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IComboWidget,
  IStringWidget
} from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { InputSpec } from '@/schemas/nodeDefSchema'

import { IS_CONTROL_WIDGET } from './controlWidgetMarker'
import { nextValueForLinkedTarget } from './valueControl'

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
  const controlAfterGenerate = inputData?.[1]?.control_after_generate
  const name =
    typeof controlAfterGenerate === 'string' ? controlAfterGenerate : widgetName
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

interface ValueControlWidgetOptions {
  addFilterList?: boolean
  controlAfterGenerateName?: string
  controlFilterListName?: string
}

export function addValueControlWidgets(
  node: LGraphNode,
  targetWidget: IBaseWidget,
  defaultValue?: string,
  options: ValueControlWidgetOptions = {},
  inputData?: InputSpec
): [IComboWidget, ...IStringWidget[]] {
  if (!defaultValue) defaultValue = 'randomize'

  const getName = (
    defaultName: string,
    optionName: 'controlAfterGenerateName' | 'controlFilterListName'
  ) => {
    const nameOverride = options[optionName]
    if (nameOverride) return nameOverride
    const inputOptions = inputData?.[1]
    const defaultNameOverride = inputOptions?.[defaultName]
    if (typeof defaultNameOverride === 'string') return defaultNameOverride
    if (inputOptions?.control_prefix) {
      return inputOptions.control_prefix + ' ' + defaultName
    }
    return defaultName
  }

  const valueControl = node.addWidget(
    'combo',
    getName('control_after_generate', 'controlAfterGenerateName'),
    defaultValue,
    function () {},
    {
      values: ['fixed', 'increment', 'decrement', 'randomize'],
      serialize: false, // Don't include this in prompt.
      surfaces: { canvas: 'shown', vueNode: 'never', panel: 'never' }
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
  if (isCombo) {
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

  function applyWidgetControl() {
    if (
      node.inputs.some(
        (input, index) =>
          input.widget?.name === targetWidget.name &&
          node.isInputConnected(index)
      )
    )
      return

    const next = nextValueForLinkedTarget({
      target: targetWidget,
      linkedWidgets: targetWidget.linkedWidgets,
      nodeId: node.id
    })
    if (next === undefined) return

    targetWidget.value = next
    targetWidget.callback?.(next)
  }

  valueControl.beforeQueued = () => {
    if (controlValueRunBefore()) {
      // Don't run on first execution
      if (valueControl[HAS_EXECUTED]) {
        applyWidgetControl()
      }
    }
    valueControl[HAS_EXECUTED] = true
  }

  valueControl.afterQueued = () => {
    if (!controlValueRunBefore()) {
      applyWidgetControl()
    }
  }

  return widgets
}
