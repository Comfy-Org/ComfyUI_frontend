import { ref } from 'vue'

import MultiSelectWidget from '@/components/graph/widgets/MultiSelectWidget.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'
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
import { fileNameMappingService } from '@/services/fileNameMappingService'

import { useRemoteWidget } from './useRemoteWidget'

// Common file extensions that indicate file inputs
const FILE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.tiff',
  '.svg',
  '.safetensors',
  '.ckpt',
  '.pt',
  '.pth',
  '.bin'
]

/**
 * Check if options contain filename-like values
 */
function hasFilenameOptions(options: any[]): boolean {
  return options.some((opt: any) => {
    if (typeof opt !== 'string') return false
    // Check for common file extensions
    const hasExtension = FILE_EXTENSIONS.some((ext) =>
      opt.toLowerCase().endsWith(ext)
    )
    // Check for hash-like filenames (ComfyUI hashed files)
    const isHashLike = /^[a-f0-9]{8,}\./i.test(opt)
    return hasExtension || isHashLike
  })
}

/**
 * Apply filename mapping to a widget using a simplified approach
 */
function applyFilenameMappingToWidget(
  widget: IComboWidget,
  node: LGraphNode,
  inputSpec: ComboInputSpec
) {
  // Simple approach: just override _displayValue for text display
  // Leave all widget functionality intact
  console.debug(
    `[FilenameMapping] STARTING applyFilenameMappingToWidget for:`,
    {
      inputName: inputSpec.name,
      widgetName: widget.name,
      currentOptions: widget.options,
      currentValues: Array.isArray(widget.options?.values)
        ? widget.options.values.slice(0, 3)
        : widget.options?.values || 'none'
    }
  )

  // Override serializeValue to ensure hash is used for API
  ;(widget as any).serializeValue = function () {
    // Always return the actual widget value (hash) for serialization
    return widget.value
  }

  // Override _displayValue to show human-readable names
  Object.defineProperty(widget, '_displayValue', {
    get() {
      if ((widget as any).computedDisabled) return ''

      // Get current hash value
      const hashValue = widget.value
      if (typeof hashValue !== 'string') return String(hashValue)

      // Try to get human-readable name from cache
      const mapping = fileNameMappingService.getCachedMapping('input')
      const humanName = mapping[hashValue]

      // Return human name for display, fallback to hash
      return humanName || hashValue
    },
    configurable: true
  })

  // Also override the options.values to show human names in dropdown
  const originalOptions = widget.options as any

  // Store original values array - maintain the same array reference
  const rawValues = Array.isArray(originalOptions.values)
    ? originalOptions.values
    : []

  console.debug('[FilenameMapping] Initial raw values:', rawValues)

  // Create a computed property that returns mapped values
  Object.defineProperty(widget.options, 'values', {
    get() {
      if (!Array.isArray(rawValues)) return rawValues

      // Map values to human-readable names
      const mapping = fileNameMappingService.getCachedMapping('input')
      const mapped = rawValues.map((value: any) => {
        if (typeof value === 'string') {
          const humanName = mapping[value]
          if (humanName) {
            console.debug(`[FilenameMapping] Mapped ${value} -> ${humanName}`)
            return humanName
          }
        }
        return value
      })
      console.debug('[FilenameMapping] Returning mapped values:', mapped)
      return mapped
    },
    set(newValues) {
      // Update raw values array in place to maintain reference
      rawValues.length = 0
      if (Array.isArray(newValues)) {
        rawValues.push(...newValues)
      }
      console.debug('[FilenameMapping] Values set to:', rawValues)
      // Trigger UI update
      node.setDirtyCanvas?.(true, true)
      node.graph?.setDirtyCanvas?.(true, true)
    },
    configurable: true,
    enumerable: true
  })

  // Add helper methods for managing the raw values
  ;(widget as any).getRawValues = function () {
    return rawValues
  }

  // Add a method to force refresh the dropdown
  ;(widget as any).refreshMappings = function () {
    console.debug('[FilenameMapping] Force refreshing dropdown')
    // Force litegraph to re-read the values
    const currentValues = widget.options.values
    console.debug('[FilenameMapping] Current mapped values:', currentValues)
    // Trigger UI update
    node.setDirtyCanvas?.(true, true)
    node.graph?.setDirtyCanvas?.(true, true)
  }

  // Override incrementValue and decrementValue for arrow key navigation
  ;(widget as any).incrementValue = function (options: any) {
    // Get the current human-readable value
    const mapping = fileNameMappingService.getCachedMapping('input')
    const currentHumanName = mapping[widget.value] || widget.value

    // Get the values array (which contains human names through our proxy)
    const rawValues = widget.options?.values
    if (!rawValues || typeof rawValues === 'function') return

    const values = Array.isArray(rawValues)
      ? rawValues
      : Object.values(rawValues)
    const currentIndex = values.indexOf(currentHumanName as any)

    if (currentIndex >= 0 && currentIndex < values.length - 1) {
      // Get next value and set it (setValue will handle conversion)
      const nextValue = values[currentIndex + 1]
      ;(widget as any).setValue(nextValue, options)
    }
  }
  ;(widget as any).decrementValue = function (options: any) {
    // Get the current human-readable value
    const mapping = fileNameMappingService.getCachedMapping('input')
    const currentHumanName = mapping[widget.value] || widget.value

    // Get the values array (which contains human names through our proxy)
    const rawValues = widget.options?.values
    if (!rawValues || typeof rawValues === 'function') return

    const values = Array.isArray(rawValues)
      ? rawValues
      : Object.values(rawValues)
    const currentIndex = values.indexOf(currentHumanName as any)

    if (currentIndex > 0) {
      // Get previous value and set it (setValue will handle conversion)
      const prevValue = values[currentIndex - 1]
      ;(widget as any).setValue(prevValue, options)
    }
  }

  // Override setValue to handle human name selection from dropdown
  const originalSetValue = (widget as any).setValue
  ;(widget as any).setValue = function (selectedValue: any, options?: any) {
    if (typeof selectedValue === 'string') {
      // Check if this is a human-readable name that needs reverse mapping
      const reverseMapping =
        fileNameMappingService.getCachedReverseMapping('input')
      const hashValue = reverseMapping[selectedValue] || selectedValue

      // Set the hash value
      widget.value = hashValue

      // Call original setValue with hash value if it exists
      if (originalSetValue) {
        originalSetValue.call(widget, hashValue, options)
      }

      // Trigger callback with hash value
      if (widget.callback) {
        widget.callback.call(widget, hashValue)
      }
    } else {
      widget.value = selectedValue
      if (originalSetValue) {
        originalSetValue.call(widget, selectedValue, options)
      }
      if (widget.callback) {
        widget.callback.call(widget, selectedValue)
      }
    }
  }

  // Override callback to handle human name selection
  const originalCallback = widget.callback
  widget.callback = function (selectedValue: any) {
    if (typeof selectedValue === 'string') {
      // Check if this is a human-readable name that needs reverse mapping
      const reverseMapping =
        fileNameMappingService.getCachedReverseMapping('input')
      const hashValue = reverseMapping[selectedValue] || selectedValue

      // Set the hash value
      widget.value = hashValue

      // Call original callback with hash value
      if (originalCallback) {
        originalCallback.call(widget, hashValue)
      }
    } else {
      widget.value = selectedValue
      if (originalCallback) {
        originalCallback.call(widget, selectedValue)
      }
    }
  }

  // Trigger async load of mappings and update display when ready
  fileNameMappingService
    .getMapping('input')
    .then(() => {
      // Mappings loaded, trigger redraw to update display
      node.setDirtyCanvas?.(true, true)
      node.graph?.setDirtyCanvas?.(true, true)
    })
    .catch(() => {
      // Silently fail - will show hash values as fallback
    })
}

const getDefaultValue = (inputSpec: ComboInputSpec) => {
  if (inputSpec.default) return inputSpec.default
  if (inputSpec.options?.length) return inputSpec.options[0]
  if (inputSpec.remote) return 'Loading...'
  return undefined
}

const addMultiSelectWidget = (node: LGraphNode, inputSpec: ComboInputSpec) => {
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

const addComboWidget = (node: LGraphNode, inputSpec: ComboInputSpec) => {
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
  ) as IComboWidget

  if (inputSpec.remote) {
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
    widget.linkedWidgets = addValueControlWidgets(
      node,
      widget,
      undefined,
      undefined,
      transformInputSpecV2ToV1(inputSpec)
    )
  }

  // For non-remote combo widgets, check if they contain filenames and apply mapping
  if (!inputSpec.remote && inputSpec.options) {
    // Check if options contain filename-like values
    const hasFilenames = hasFilenameOptions(inputSpec.options)

    console.debug(
      '[FilenameMapping] Checking combo widget for filename mapping:',
      {
        inputName: inputSpec.name,
        hasFilenames,
        optionsCount: inputSpec.options.length,
        sampleOptions: inputSpec.options.slice(0, 3)
      }
    )

    if (hasFilenames) {
      // Apply filename mapping for display
      console.debug(
        '[FilenameMapping] Applying filename mapping to widget:',
        inputSpec.name
      )
      applyFilenameMappingToWidget(widget, node, inputSpec)
    }
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
