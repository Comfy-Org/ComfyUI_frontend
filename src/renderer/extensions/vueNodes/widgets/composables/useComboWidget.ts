import { ref } from 'vue'

import MultiSelectWidget from '@/components/graph/widgets/MultiSelectWidget.vue'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isAssetWidget, isComboWidget } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { assetService } from '@/platform/assets/services/assetService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { transformInputSpecV2ToV1 } from '@/schemas/nodeDef/migration'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  type InputSpec,
  isComboInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  type BaseDOMWidget,
  ComponentWidgetImpl,
  addWidget
} from '@/scripts/domWidget'
import {
  type ComfyWidgetConstructorV2,
  addValueControlWidgets
} from '@/scripts/widgets'

import { useRemoteWidget } from './useRemoteWidget'

const getDefaultValue = (inputSpec: ComboInputSpec) => {
  if (inputSpec.default) return inputSpec.default
  if (inputSpec.options?.length) return inputSpec.options[0]
  if (inputSpec.remote) return 'Loading...'
  return undefined
}

const addMultiSelectWidget = (
  node: LGraphNode,
  inputSpec: ComboInputSpec
): IBaseWidget => {
  const widgetValue = ref<string[]>([])
  const widget = new ComponentWidgetImpl({
    node,
    name: inputSpec.name,
    component: MultiSelectWidget,
    inputSpec,
    options: {
      getValue: () => widgetValue.value,
      setValue: (value: string[]) => {
        widgetValue.value = value
      }
    }
  })
  addWidget(node, widget as BaseDOMWidget<object | string>)
  // TODO: Add remote support to multi-select widget
  // https://github.com/Comfy-Org/ComfyUI_frontend/issues/3003
  return widget
}

const addComboWidget = (
  node: LGraphNode,
  inputSpec: ComboInputSpec
): IBaseWidget => {
  const settingStore = useSettingStore()
  const isUsingAssetAPI = settingStore.get('Comfy.Assets.UseAssetAPI')
  const isEligible = assetService.isAssetBrowserEligible(
    inputSpec.name,
    node.comfyClass || ''
  )

  if (isUsingAssetAPI && isEligible) {
    // Get the default value for the button text (currently selected model)
    const currentValue = getDefaultValue(inputSpec)
    const displayLabel = currentValue ?? t('widgets.selectModel')

    const assetBrowserDialog = useAssetBrowserDialog()

    const widget = node.addWidget(
      'asset',
      inputSpec.name,
      displayLabel,
      async () => {
        if (!isAssetWidget(widget)) {
          throw new Error(`Expected asset widget but received ${widget.type}`)
        }
        await assetBrowserDialog.show({
          nodeType: node.comfyClass || '',
          inputName: inputSpec.name,
          currentValue: widget.value,
          onAssetSelected: (filename: string) => {
            const oldValue = widget.value
            widget.value = filename
            // Litegraph separates user interactions from programmatic value changes:
            // - widget.callback: handles UI events like button clicks (opens this dialog)
            // - node.onWidgetChanged: notifies graph of value updates (serialization, downstream effects)
            // Using onWidgetChanged prevents a callback race where asset selection could reopen the dialog
            node.onWidgetChanged?.(widget.name, filename, oldValue, widget)
            node.graph?.setDirtyCanvas?.(true, true)
          }
        })
      }
    )

    return widget
  }

  // Create normal combo widget
  const defaultValue = getDefaultValue(inputSpec)
  const comboOptions = inputSpec.options ?? []
  const widget = node.addWidget(
    'combo',
    inputSpec.name,
    defaultValue,
    () => {},
    {
      values: comboOptions
    }
  )

  if (inputSpec.remote) {
    if (!isComboWidget(widget)) {
      throw new Error(`Expected combo widget but received ${widget.type}`)
    }
    const remoteWidget = useRemoteWidget({
      remoteConfig: inputSpec.remote,
      defaultValue,
      node,
      widget
    })
    if (inputSpec.remote.refresh_button) remoteWidget.addRefreshButton()

    const origOptions = widget.options
    widget.options = new Proxy(origOptions, {
      get(target, prop) {
        // Assertion: Proxy handler passthrough
        return prop !== 'values'
          ? target[prop as keyof typeof target]
          : remoteWidget.getValue()
      }
    })
  }

  if (inputSpec.control_after_generate) {
    if (!isComboWidget(widget)) {
      throw new Error(`Expected combo widget but received ${widget.type}`)
    }
    widget.linkedWidgets = addValueControlWidgets(
      node,
      widget,
      undefined,
      undefined,
      transformInputSpecV2ToV1(inputSpec)
    )
  }

  return widget
}

export const useComboWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    if (!isComboInputSpec(inputSpec)) {
      throw new Error(`Invalid input data: ${inputSpec}`)
    }
    return inputSpec.multi_select
      ? addMultiSelectWidget(node, inputSpec)
      : addComboWidget(node, inputSpec)
  }

  return widgetConstructor
}
