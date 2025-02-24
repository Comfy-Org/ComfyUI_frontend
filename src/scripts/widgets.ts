import type { LGraphNode } from '@comfyorg/litegraph'
import type { IWidget } from '@comfyorg/litegraph'
import type {
  IComboWidget,
  IStringWidget
} from '@comfyorg/litegraph/dist/types/widgets'

import { useBooleanWidget } from '@/composables/widgets/useBooleanWidget'
import { useComboWidget } from '@/composables/widgets/useComboWidget'
import { useFloatWidget } from '@/composables/widgets/useFloatWidget'
import { useImageUploadWidget } from '@/composables/widgets/useImageUploadWidget'
import { useIntWidget } from '@/composables/widgets/useIntWidget'
import { useMarkdownWidget } from '@/composables/widgets/useMarkdownWidget'
import { useSeedWidget } from '@/composables/widgets/useSeedWidget'
import { useStringWidget } from '@/composables/widgets/useStringWidget'
import { t } from '@/i18n'
import { useSettingStore } from '@/stores/settingStore'
import type { InputSpec } from '@/types/apiTypes'

import type { ComfyApp } from './app'
import './domWidget'

export type ComfyWidgetConstructor = (
  node: LGraphNode,
  inputName: string,
  inputData: InputSpec,
  app: ComfyApp,
  widgetName?: string
) => { widget: IWidget; minWidth?: number; minHeight?: number }

function controlValueRunBefore() {
  return useSettingStore().get('Comfy.WidgetControlMode') === 'before'
}

export function updateControlWidgetLabel(widget: IWidget) {
  if (controlValueRunBefore()) {
    widget.label = t('g.control_before_generate')
  } else {
    widget.label = t('g.control_after_generate')
  }
}

export const IS_CONTROL_WIDGET = Symbol()
const HAS_EXECUTED = Symbol()

export function addValueControlWidget(
  node: LGraphNode,
  targetWidget: IWidget,
  defaultValue?: string,
  values?: unknown,
  widgetName?: string,
  inputData?: InputSpec
): IWidget {
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
  targetWidget: IWidget,
  defaultValue?: string,
  options?: Record<string, any>,
  inputData?: InputSpec
): IWidget[] {
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

  const widgets: IWidget[] = []
  const valueControl = node.addWidget(
    'combo',
    getName('control_after_generate', 'controlAfterGenerateName'),
    defaultValue,
    function () {},
    {
      values: ['fixed', 'increment', 'decrement', 'randomize'],
      serialize: false // Don't include this in prompt.
    }
  ) as IComboWidget

  valueControl.tooltip =
    'Allows the linked widget to be changed automatically, for example randomizing the noise seed.'
  // @ts-ignore index with symbol
  valueControl[IS_CONTROL_WIDGET] = true
  updateControlWidgetLabel(valueControl)
  widgets.push(valueControl)

  const isCombo = targetWidget.type === 'combo'
  let comboFilter: IStringWidget
  if (isCombo && valueControl.options.values) {
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

    widgets.push(comboFilter)
  }

  const applyWidgetControl = () => {
    var v = valueControl.value

    if (isCombo && v !== 'fixed') {
      let values = targetWidget.options.values ?? []
      const filter = comboFilter?.value
      if (filter) {
        let check
        if (filter.startsWith('/') && filter.endsWith('/')) {
          try {
            const regex = new RegExp(filter.substring(1, filter.length - 1))
            check = (item: string) => regex.test(item)
          } catch (error) {
            console.error(
              'Error constructing RegExp filter for node ' + node.id,
              filter,
              error
            )
          }
        }
        if (!check) {
          const lower = filter.toLocaleLowerCase()
          check = (item: string) => item.toLocaleLowerCase().includes(lower)
        }
        values = values.filter((item: string) => check(item))
        if (!values.length && targetWidget.options.values?.length) {
          console.warn(
            'Filter for node ' + node.id + ' has filtered out all items',
            filter
          )
        }
      }
      // @ts-expect-error targetWidget.value can be number or string
      let current_index = values.indexOf(targetWidget.value)
      let current_length = values.length

      switch (v) {
        case 'increment':
          current_index += 1
          break
        case 'increment-wrap':
          current_index += 1
          if (current_index >= current_length) {
            current_index = 0
          }
          break
        case 'decrement':
          current_index -= 1
          break
        case 'randomize':
          current_index = Math.floor(Math.random() * current_length)
          break
        default:
          break
      }
      current_index = Math.max(0, current_index)
      current_index = Math.min(current_length - 1, current_index)
      if (current_index >= 0) {
        let value = values[current_index]
        targetWidget.value = value
        targetWidget.callback?.(value)
      }
    } else {
      //number
      let { min = 0, max = 1, step = 1 } = targetWidget.options
      // limit to something that javascript can handle
      max = Math.min(1125899906842624, max)
      min = Math.max(-1125899906842624, min)
      let range = (max - min) / (step / 10)

      //adjust values based on valueControl Behaviour
      switch (v) {
        case 'fixed':
          break
        case 'increment':
          // @ts-expect-error targetWidget.value can be number or string
          targetWidget.value += step / 10
          break
        case 'decrement':
          // @ts-expect-error targetWidget.value can be number or string
          targetWidget.value -= step / 10
          break
        case 'randomize':
          targetWidget.value =
            Math.floor(Math.random() * range) * (step / 10) + min
          break
        default:
          break
      }
      /*check if values are over or under their respective
       * ranges and set them to min or max.*/
      // @ts-expect-error targetWidget.value can be number or string
      if (targetWidget.value < min) targetWidget.value = min
      // @ts-expect-error targetWidget.value can be number or string
      if (targetWidget.value > max) targetWidget.value = max
      targetWidget.callback?.(targetWidget.value)
    }
  }

  valueControl.beforeQueued = () => {
    if (controlValueRunBefore()) {
      // Don't run on first execution
      // @ts-ignore index with symbol
      if (valueControl[HAS_EXECUTED]) {
        applyWidgetControl()
      }
    }
    // @ts-ignore index with symbol
    valueControl[HAS_EXECUTED] = true
  }

  valueControl.afterQueued = () => {
    if (!controlValueRunBefore()) {
      applyWidgetControl()
    }
  }

  return widgets
}

const SeedWidget = useSeedWidget()

export const ComfyWidgets: Record<string, ComfyWidgetConstructor> = {
  'INT:seed': SeedWidget,
  'INT:noise_seed': SeedWidget,
  INT: useIntWidget(),
  FLOAT: useFloatWidget(),
  BOOLEAN: useBooleanWidget(),
  STRING: useStringWidget(),
  MARKDOWN: useMarkdownWidget(),
  COMBO: useComboWidget(),
  IMAGEUPLOAD: useImageUploadWidget()
}
