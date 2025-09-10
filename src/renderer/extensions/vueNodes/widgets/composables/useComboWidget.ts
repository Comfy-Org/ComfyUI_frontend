import { ref } from 'vue'

import MultiSelectWidget from '@/components/graph/widgets/MultiSelectWidget.vue'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IComboWidget
} from '@/lib/litegraph/src/types/widgets'
import { transformInputSpecV2ToV1 } from '@/schemas/nodeDef/migration'
import {
  ComboInputSpec,
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
import { assetService } from '@/services/assetService'
import { useSettingStore } from '@/stores/settingStore'

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
): IComboWidget => {
  const settingStore = useSettingStore()
  const isUsingAssetAPI = settingStore.get('Comfy.Assets.UseAssetAPI')
  const isAssetBrowserEligible = assetService.isAssetBrowserEligible(
    inputSpec.name
  )

  if (isUsingAssetAPI && isAssetBrowserEligible) {
    // Get the default value for the button text (currently selected model)
    const currentValue = getDefaultValue(inputSpec)

    const widget = node.addWidget(
      'combo',
      inputSpec.name,
      currentValue,
      () => {
        console.log(
          `Asset Browser would open here for:\nNode: ${node.type}\nWidget: ${inputSpec.name}\nCurrent Value:${currentValue}`
        )
      },
      {
        values: [t('widgets.selectModel')]
      }
    )

    return widget as IComboWidget
  }

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
    const remoteWidget = useRemoteWidget({
      remoteConfig: inputSpec.remote,
      defaultValue,
      node,
      widget: widget as IComboWidget
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
    widget.linkedWidgets = addValueControlWidgets(
      node,
      widget,
      undefined,
      undefined,
      transformInputSpecV2ToV1(inputSpec)
    )
  }

  return widget as IComboWidget
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
