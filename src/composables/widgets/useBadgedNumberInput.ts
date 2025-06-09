import type { LGraphNode } from '@comfyorg/litegraph'
import { reactive, ref } from 'vue'

import BadgedNumberInput from '@/components/graph/widgets/BadgedNumberInput.vue'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgetTypes'

const PADDING = 8

type BadgeState = 'normal' | 'random' | 'lock' | 'increment' | 'decrement'

type NumberWidgetMode = 'int' | 'float'

interface BadgedNumberInputOptions {
  defaultValue?: number
  badgeState?: BadgeState
  disabled?: boolean
  minHeight?: number
  serialize?: boolean
  mode?: NumberWidgetMode
}

// Helper function to map control widget values to badge states
const mapControlValueToBadgeState = (controlValue: string): BadgeState => {
  switch (controlValue) {
    case 'fixed':
      return 'lock'
    case 'increment':
      return 'increment'
    case 'decrement':
      return 'decrement'
    case 'randomize':
      return 'random'
    default:
      return 'normal'
  }
}

export const useBadgedNumberInput = (
  options: BadgedNumberInputOptions = {}
) => {
  const {
    defaultValue = 0,
    disabled = false,
    minHeight = 32,
    serialize = true,
    mode = 'int'
  } = options

  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    // Initialize widget value as string to conform to ComponentWidgetImpl requirements
    const widgetValue = ref<string>(defaultValue.toString())

    // Determine if we should show control widget and badge
    const shouldShowControlWidget =
      inputSpec.control_after_generate ??
      // Legacy compatibility: seed inputs get control widgets
      ['seed', 'noise_seed'].includes(inputSpec.name)

    // Create reactive props object for the component
    const componentProps = reactive({
      badgeState:
        options.badgeState ??
        (shouldShowControlWidget ? 'random' : ('normal' as BadgeState)),
      disabled
    })

    const controlWidget: any = null

    // Create the main widget instance
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
      props: componentProps,
      options: {
        // Required: getter for widget value - return as string
        getValue: () => widgetValue.value as string | object,

        // Required: setter for widget value - accept number, string or object
        setValue: (value: string | object | number) => {
          let numValue: number
          if (typeof value === 'object') {
            numValue = parseFloat(JSON.stringify(value))
          } else {
            numValue =
              typeof value === 'number' ? value : parseFloat(String(value))
          }

          if (!isNaN(numValue)) {
            // Apply int/float specific value processing
            if (mode === 'int') {
              const step = (inputSpec as any).step ?? 1
              if (step === 1) {
                numValue = Math.round(numValue)
              } else {
                const min = (inputSpec as any).min ?? 0
                const offset = min % step
                numValue =
                  Math.round((numValue - offset) / step) * step + offset
              }
            }
            widgetValue.value = numValue.toString()
          }
        },

        // Optional: minimum height for the widget
        getMinHeight: () => minHeight + PADDING,
        // Lock maximum height to prevent oversizing
        getMaxHeight: () => 45,

        // Optional: whether to serialize this widget's value
        serialize
      }
    })

    // Add control widget if needed - temporarily disabled to fix circular dependency
    if (shouldShowControlWidget) {
      // TODO: Re-implement control widget functionality without circular dependency
      console.warn(
        'Control widget functionality temporarily disabled due to circular dependency'
      )
      // controlWidget = addValueControlWidget(
      //   node,
      //   widget as any, // Cast to satisfy the interface
      //   'randomize',
      //   undefined,
      //   undefined,
      //   transformInputSpecV2ToV1(inputSpec)
      // )

      // Set up reactivity to update badge state when control widget changes
      if (controlWidget) {
        const originalCallback = controlWidget.callback
        controlWidget.callback = function (value: string) {
          componentProps.badgeState = mapControlValueToBadgeState(value)
          if (originalCallback) {
            originalCallback.call(this, value)
          }
        }

        // Initialize badge state
        componentProps.badgeState = mapControlValueToBadgeState(
          controlWidget.value || 'randomize'
        )

        // Link the widgets
        ;(widget as any).linkedWidgets = [controlWidget]
      }
    }

    // Register the widget with the node
    addWidget(node, widget)

    return widget
  }

  return widgetConstructor
}

// Export types for use in other modules
export type { BadgeState, BadgedNumberInputOptions, NumberWidgetMode }
