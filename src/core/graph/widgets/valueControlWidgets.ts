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
import { IS_CONTROL_WIDGET } from '@/scripts/controlWidgetMarker'
import {
  isValueControlMode,
  nextValueForLinkedTarget
} from '@/scripts/valueControl'
import { CONTROL_OPTIONS } from '@/types/simplifiedWidget'

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

/**
 * `control_after_generate` is either a group-node widget name override or a
 * control mode that core's `io.ControlAfterGenerate` enum serialises into
 * `object_info`. Only a non-blank string that is not a mode is a name.
 */
function controlAfterGenerateNameOverride(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  return isValueControlMode(value) ? undefined : value
}

export function addValueControlWidget(
  node: LGraphNode,
  targetWidget: IBaseWidget,
  defaultValue?: string,
  _values?: unknown,
  widgetName?: string,
  inputData?: InputSpec
): IComboWidget {
  const name =
    controlAfterGenerateNameOverride(inputData?.[1]?.control_after_generate) ??
    widgetName
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
  // `useIntWidget` forwards a group-node name override here as the mode.
  const specNameOverride = controlAfterGenerateNameOverride(
    inputData?.[1]?.control_after_generate
  )
  if (!defaultValue || defaultValue === specNameOverride) {
    defaultValue = 'randomize'
  }

  const getName = (
    defaultName: 'control_after_generate' | 'control_filter_list',
    optionName: 'controlAfterGenerateName' | 'controlFilterListName'
  ) => {
    const nameOverride = options[optionName]
    if (nameOverride) return nameOverride
    const inputOptions = inputData?.[1]
    const specValue = inputOptions?.[defaultName]
    const defaultNameOverride =
      defaultName === 'control_after_generate'
        ? controlAfterGenerateNameOverride(specValue)
        : typeof specValue === 'string'
          ? specValue
          : undefined
    if (defaultNameOverride !== undefined) return defaultNameOverride
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
      values: [...CONTROL_OPTIONS],
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
    const values = valueControl.options.values
    if (Array.isArray(values)) values.push('increment-wrap')
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
