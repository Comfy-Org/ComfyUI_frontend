import { ref } from 'vue'

import AssetPickerWidget from '@/components/graph/widgets/AssetPickerWidget.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  ComboInputSpec,
  type InputSpec,
  isComboInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import { app } from '@/scripts/app'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

import { useComboWidget } from './useComboWidget'

/**
 * Checks if a node and widget combination is eligible for asset browser enhancement
 */
function checkAssetBrowserEligibility(
  node: LGraphNode,
  inputSpec: ComboInputSpec
): boolean {
  // Simplified check for testing - just focus on ckpt_name widgets for now
  if (!isModelSelectionWidget(inputSpec)) {
    console.log('❌ Not a model selection widget:', inputSpec.name)
    return false
  }

  // Additional check: if node.type is available and set, ensure it's CheckpointLoaderSimple
  if (node.type && node.type !== 'CheckpointLoaderSimple') {
    console.log('❌ Not CheckpointLoaderSimple, got:', node.type)
    return false
  }

  console.log('✅ Eligible for asset browser enhancement for:', inputSpec.name)
  return true
}

/**
 * Determines if this widget is for model selection based on name patterns
 */
function isModelSelectionWidget(inputSpec: ComboInputSpec): boolean {
  const modelWidgetNames = ['ckpt_name', 'model_name', 'checkpoint']
  return modelWidgetNames.some((pattern) =>
    inputSpec.name.toLowerCase().includes(pattern)
  )
}

/**
 * Creates an asset picker widget using ComponentWidgetImpl
 */
function createAssetPickerWidget(node: LGraphNode, inputSpec: ComboInputSpec) {
  console.log('🎯 Creating AssetPickerWidget for:', node.type, inputSpec.name)

  const widgetValue = ref<string>(inputSpec.default || '')

  const widget = new ComponentWidgetImpl<string | object>({
    node,
    name: inputSpec.name,
    component: AssetPickerWidget,
    inputSpec,
    options: {
      getValue: () => widgetValue.value,
      setValue: (value: string | object) => {
        const stringValue = typeof value === 'string' ? value : String(value)
        widgetValue.value = stringValue
        console.log('🔧 Widget value updated to:', stringValue)
      }
    },
    props: {
      widget: {
        get value() {
          return widgetValue.value
        },
        name: inputSpec.name,
        setValue: (newValue: string) => {
          console.log('🔧 AssetPickerWidget setValue called with:', newValue)

          // Get canvas from the ComfyUI app instance - this is the proper way
          // to access the canvas for widget setValue operations
          const canvas = app.canvas

          if (!canvas) {
            console.error('Canvas not found on app instance')
            throw new Error('Canvas is required for setValue operation')
          }

          // Call the inherited setValue with proper WidgetEventOptions context
          // Create a synthetic pointer event for programmatic calls
          const syntheticPointerEvent = new PointerEvent('pointerdown', {
            bubbles: false,
            cancelable: false,
            pointerId: -1,
            pointerType: 'mouse'
          })

          // Add the required canvas properties
          const canvasEvent = Object.assign(syntheticPointerEvent, {
            canvasX: 0,
            canvasY: 0,
            deltaX: 0,
            deltaY: 0,
            safeOffsetX: 0,
            safeOffsetY: 0
          })

          widget.setValue(newValue, {
            e: canvasEvent,
            node: node,
            canvas: canvas
          })
          console.log('✅ Widget setValue called with proper context')
        }
      },
      nodeType: node.type || 'unknown',
      widgetName: inputSpec.name
    }
  })

  addWidget(node, widget)
  return widget
}

/**
 * Enhanced combo widget constructor that conditionally uses asset browser
 */
export const useAssetComboWidget = (): ComfyWidgetConstructorV2 => {
  const standardComboWidget = useComboWidget()

  return (node: LGraphNode, inputSpec: InputSpec) => {
    // Debug logging to see all widget creation attempts
    console.log('🔧 useAssetComboWidget called for:', {
      nodeType: node.type,
      inputName: inputSpec.name,
      inputType: inputSpec.type
    })

    if (!isComboInputSpec(inputSpec)) {
      console.log('❌ Not a combo input spec:', inputSpec)
      throw new Error(`Invalid input data: ${inputSpec}`)
    }

    const shouldUseAssetBrowser = checkAssetBrowserEligibility(node, inputSpec)
    console.log('🤔 Asset browser eligibility:', {
      nodeType: node.type,
      inputName: inputSpec.name,
      eligible: shouldUseAssetBrowser
    })

    if (shouldUseAssetBrowser) {
      return createAssetPickerWidget(node, inputSpec)
    }

    // Fallback to standard combo widget
    return standardComboWidget(node, inputSpec)
  }
}
