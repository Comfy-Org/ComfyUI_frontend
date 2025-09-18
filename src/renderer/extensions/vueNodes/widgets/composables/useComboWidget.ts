import { ref } from 'vue'

import MultiSelectWidget from '@/components/graph/widgets/MultiSelectWidget.vue'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IAssetWidget,
  IBaseWidget,
  IComboWidget
} from '@/lib/litegraph/src/types/widgets'
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

// Type guards for widget safety
function isAssetWidget(widget: IBaseWidget): widget is IAssetWidget {
  return widget.type === 'asset'
}

function isComboWidget(widget: IBaseWidget): widget is IComboWidget {
  return widget.type === 'combo'
}

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
        const assetWidget = widget
        await assetBrowserDialog.show({
          nodeType: node.comfyClass || '',
          inputName: inputSpec.name,
          currentValue: assetWidget.value,
          onAssetSelected: (filename: string) => {
            assetWidget.value = filename
            // Must call widget.callback to notify litegraph of value changes
            // This ensures proper serialization and triggers any downstream effects
            assetWidget.callback?.(assetWidget.value)
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
