import type { LGraphNode } from '@comfyorg/litegraph'
import { ref } from 'vue'

import BadgedNumberInput from '@/components/graph/widgets/BadgedNumberInput.vue'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

const PADDING = 8

type BadgeState = 'normal' | 'random' | 'lock' | 'increment' | 'decrement'

interface BadgedNumberInputOptions {
  defaultValue?: number
  badgeState?: BadgeState
  disabled?: boolean
  minHeight?: number
  serialize?: boolean
}

export const useBadgedNumberInput = (
  options: BadgedNumberInputOptions = {}
) => {
  const {
    defaultValue = 0,
    badgeState = 'normal',
    disabled = false,
    minHeight = 40,
    serialize = true
  } = options

  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    // Initialize widget value as string to conform to ComponentWidgetImpl requirements
    const widgetValue = ref<string>(defaultValue.toString())

    // Create the widget instance
    const widget = new ComponentWidgetImpl<
      string | object,
      Omit<
        InstanceType<typeof BadgedNumberInput>['$props'],
        'widget' | 'modelValue'
      >
    >({
      node,
      name: inputSpec.name,
      component: BadgedNumberInput,
      inputSpec,
      props: {
        badgeState,
        disabled
      },
      options: {
        // Required: getter for widget value - return as string
        getValue: () => widgetValue.value as string | object,

        // Required: setter for widget value - accept number, string or object
        setValue: (value: string | object | number) => {
          let stringValue: string
          if (typeof value === 'object') {
            stringValue = JSON.stringify(value)
          } else {
            stringValue = String(value)
          }
          const numValue = parseFloat(stringValue)
          if (!isNaN(numValue)) {
            widgetValue.value = numValue.toString()
          }
        },

        // Optional: minimum height for the widget
        getMinHeight: () => minHeight + PADDING,

        // Optional: whether to serialize this widget's value
        serialize
      }
    })

    // Register the widget with the node
    addWidget(node, widget)

    return widget
  }

  return widgetConstructor
}

// Export types for use in other modules
export type { BadgeState, BadgedNumberInputOptions }
