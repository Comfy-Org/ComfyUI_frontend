import type { LGraphNode } from '@comfyorg/litegraph'
import { ref } from 'vue'

import DropdownComboWidget from '@/components/graph/widgets/DropdownComboWidget.vue'
import { transformInputSpecV2ToV1 } from '@/schemas/nodeDef/migration'
import type {
  ComboInputSpec,
  InputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgetTypes'
import { addValueControlWidgets } from '@/scripts/widgets'

import { useRemoteWidget } from './useRemoteWidget'

const getDefaultValue = (inputSpec: ComboInputSpec) => {
  if (inputSpec.default) return inputSpec.default
  if (inputSpec.options?.length) return inputSpec.options[0]
  if (inputSpec.remote) return 'Loading...'
  return ''
}

export const useDropdownComboWidget = (
  options: { defaultValue?: string } = {}
) => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    // Type assertion to ComboInputSpec since this is specifically for combo widgets
    const comboInputSpec = inputSpec as ComboInputSpec

    // Initialize widget value
    const defaultValue = options.defaultValue ?? getDefaultValue(comboInputSpec)
    const widgetValue = ref<string>(defaultValue)

    // Create the widget instance
    const widget = new ComponentWidgetImpl<string>({
      node,
      name: inputSpec.name,
      component: DropdownComboWidget,
      inputSpec,
      options: {
        // Required: getter for widget value
        getValue: () => widgetValue.value,

        // Required: setter for widget value
        setValue: (value: string) => {
          widgetValue.value = value
        },


        // Optional: whether to serialize this widget's value
        serialize: true
      }
    })

    // Handle remote widget functionality
    if (comboInputSpec.remote) {
      const remoteWidget = useRemoteWidget({
        remoteConfig: comboInputSpec.remote,
        defaultValue,
        node,
        widget: widget as any // Cast to be compatible with the remote widget interface
      })
      if (comboInputSpec.remote.refresh_button) {
        remoteWidget.addRefreshButton()
      }

      // Update the widget to use remote data
      // Note: The remote widget will handle updating the options through the inputSpec
    }

    // Handle control_after_generate widgets
    if (comboInputSpec.control_after_generate) {
      const linkedWidgets = addValueControlWidgets(
        node,
        widget as any, // Cast to be compatible with legacy widget interface
        undefined,
        undefined,
        transformInputSpecV2ToV1(comboInputSpec)
      )
      // Store reference to linked widgets (mimicking original behavior)
      ;(widget as any).linkedWidgets = linkedWidgets
    }

    // Register the widget with the node
    addWidget(node, widget as any)

    return widget
  }

  return widgetConstructor
}
