import { ref } from 'vue'

import MultiSelectWidget from '@/components/graph/widgets/MultiSelectWidget.vue'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isAssetWidget, isComboWidget } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'
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
import { fileNameMappingService } from '@/services/fileNameMappingService'

import { useRemoteWidget } from './useRemoteWidget'

// Extended interface for widgets with filename mapping
interface IFilenameMappingWidget extends IComboWidget {
  serializeValue?: () => any
  getRawValues?: () => string[]
  refreshMappings?: () => void
  incrementValue?: (options: any) => void
  decrementValue?: (options: any) => void
  setValue?: (value: any, options?: any) => void
  _displayValue?: string
  computedDisabled?: boolean
}

// Common media file extensions (images, videos, audio)
const FILE_EXTENSIONS = [
  // Image formats
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.tiff',
  '.svg',
  // Video formats
  '.mp4',
  '.avi',
  '.mov',
  '.webm',
  '.mkv',
  '.flv',
  '.wmv',
  // Audio formats
  '.mp3',
  '.wav',
  '.flac',
  '.aac',
  '.ogg',
  '.m4a',
  '.wma'
]

/**
 * Check if options contain filename-like values (UUIDs or legacy hashes)
 */
function hasFilenameOptions(options: any[]): boolean {
  return options.some((opt: any) => {
    if (typeof opt !== 'string') return false

    // Check for UUID format (new system)
    const isUUID =
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        opt
      )

    // Check for common file extensions (legacy)
    const hasExtension = FILE_EXTENSIONS.some((ext) =>
      opt.toLowerCase().endsWith(ext)
    )

    // Check for hash-like filenames (legacy ComfyUI hashed files)
    const isHashLike = /^[a-f0-9]{8,}\./i.test(opt)

    return isUUID || hasExtension || isHashLike
  })
}

/**
 * Apply filename mapping to a widget using a simplified approach
 */
function applyFilenameMappingToWidget(
  widget: IComboWidget,
  node: LGraphNode,
  _inputSpec: ComboInputSpec
) {
  // Validate widget exists
  if (!widget) {
    return
  }

  // Simple approach: just override _displayValue for text display
  // Leave all widget functionality intact

  // Cast to extended interface for type safety
  const mappingWidget = widget as IFilenameMappingWidget

  // Override serializeValue to ensure asset ID is used for API
  mappingWidget.serializeValue = function () {
    // Always return the actual widget value (asset ID) for serialization
    return mappingWidget.value
  }

  // Override _displayValue to show human-readable names
  try {
    Object.defineProperty(mappingWidget, '_displayValue', {
      get() {
        if (mappingWidget.computedDisabled) return ''

        // Get current asset ID value
        const assetId = mappingWidget.value
        if (typeof assetId !== 'string') return String(assetId)

        // Try to get human-readable name from cache (deduplicated for display)
        const mapping = fileNameMappingService.getCachedMapping('input', true)
        const humanName = mapping[assetId]

        // Return human name for display, fallback to asset ID
        return humanName || assetId
      },
      configurable: true
    })
  } catch (error) {
    // Property might be non-configurable, continue without override
  }

  // Also override the options.values to show human names in dropdown
  const originalOptions = mappingWidget.options as any

  // Store original values array - maintain the same array reference
  const rawValues = Array.isArray(originalOptions.values)
    ? originalOptions.values
    : []

  // Create a computed property that returns mapped values
  if (mappingWidget.options) {
    try {
      Object.defineProperty(mappingWidget.options, 'values', {
        get() {
          if (!Array.isArray(rawValues)) return rawValues

          // Map values to human-readable names (deduplicated for dropdown display)
          const mapping = fileNameMappingService.getCachedMapping('input', true)
          const mapped = rawValues.map((value: any) => {
            if (typeof value === 'string') {
              const humanName = mapping[value]
              if (humanName) {
                return humanName
              }
            }
            return value
          })
          return mapped
        },
        set(newValues) {
          // Update raw values array in place to maintain reference
          rawValues.length = 0
          if (Array.isArray(newValues)) {
            rawValues.push(...newValues)
          }
          // Trigger UI update
          node.setDirtyCanvas?.(true, true)
          node.graph?.setDirtyCanvas?.(true, true)
        },
        configurable: true,
        enumerable: true
      })
    } catch (error) {
      // Property might be non-configurable, continue without override
    }
  }

  // Add helper methods for managing the raw values
  mappingWidget.getRawValues = function () {
    return rawValues
  }

  // Add a method to force refresh the dropdown
  mappingWidget.refreshMappings = function () {
    // Force litegraph to re-read the values and trigger UI update
    node.setDirtyCanvas?.(true, true)
    node.graph?.setDirtyCanvas?.(true, true)
  }

  // Override incrementValue and decrementValue for arrow key navigation
  mappingWidget.incrementValue = function (options: any) {
    // Get the current human-readable value (deduplicated)
    const mapping = fileNameMappingService.getCachedMapping('input', true)
    const currentHumanName = mapping[mappingWidget.value] || mappingWidget.value

    // Get the values array (which contains human names through our proxy)
    const rawValues = mappingWidget.options?.values
    if (!rawValues || typeof rawValues === 'function') return

    const values = Array.isArray(rawValues)
      ? rawValues
      : Object.values(rawValues)
    const currentIndex = values.indexOf(currentHumanName as any)

    if (currentIndex >= 0 && currentIndex < values.length - 1) {
      // Get next value and set it (setValue will handle conversion)
      const nextValue = values[currentIndex + 1]
      mappingWidget.setValue?.(nextValue, options)
    }
  }
  mappingWidget.decrementValue = function (options: any) {
    // Get the current human-readable value (deduplicated)
    const mapping = fileNameMappingService.getCachedMapping('input', true)
    const currentHumanName = mapping[mappingWidget.value] || mappingWidget.value

    // Get the values array (which contains human names through our proxy)
    const rawValues = mappingWidget.options?.values
    if (!rawValues || typeof rawValues === 'function') return

    const values = Array.isArray(rawValues)
      ? rawValues
      : Object.values(rawValues)
    const currentIndex = values.indexOf(currentHumanName as any)

    if (currentIndex > 0) {
      // Get previous value and set it (setValue will handle conversion)
      const prevValue = values[currentIndex - 1]
      mappingWidget.setValue?.(prevValue, options)
    }
  }

  // Override setValue to handle human name selection from dropdown
  const originalSetValue = mappingWidget.setValue
  mappingWidget.setValue = function (selectedValue: any, options?: any) {
    if (typeof selectedValue === 'string') {
      // Check if this is a human-readable name that needs reverse mapping
      // Use deduplicated reverse mapping to handle suffixed names
      const reverseMapping = fileNameMappingService.getCachedReverseMapping(
        'input',
        true
      )
      const assetId = reverseMapping[selectedValue] || selectedValue

      // Set the asset ID
      mappingWidget.value = assetId

      // Call original setValue with asset ID if it exists
      if (originalSetValue) {
        originalSetValue.call(mappingWidget, assetId, options)
      }

      // Trigger callback with asset ID
      if (mappingWidget.callback) {
        mappingWidget.callback.call(mappingWidget, assetId)
      }
    } else {
      mappingWidget.value = selectedValue
      if (originalSetValue) {
        originalSetValue.call(mappingWidget, selectedValue, options)
      }
      if (mappingWidget.callback) {
        mappingWidget.callback.call(mappingWidget, selectedValue)
      }
    }
  }

  // Override callback to handle human name selection
  const originalCallback = mappingWidget.callback
  if (mappingWidget.callback) {
    mappingWidget.callback = function (selectedValue: any) {
      if (typeof selectedValue === 'string') {
        // Check if this is a human-readable name that needs reverse mapping
        // Use deduplicated reverse mapping to handle suffixed names
        const reverseMapping = fileNameMappingService.getCachedReverseMapping(
          'input',
          true
        )
        const assetId = reverseMapping[selectedValue] || selectedValue

        // Set the asset ID
        mappingWidget.value = assetId

        // Call original callback with asset ID
        if (originalCallback) {
          originalCallback.call(mappingWidget, assetId)
        }
      } else {
        mappingWidget.value = selectedValue
        if (originalCallback) {
          originalCallback.call(mappingWidget, selectedValue)
        }
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
            // Using onWidgetChanged prevents a callback race where asset selection could reopen the dialog
            node.onWidgetChanged?.(widget.name, filename, oldValue, widget)
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

  // For non-remote combo widgets, check if they contain filenames and apply mapping
  if (!inputSpec.remote && inputSpec.options) {
    // Check if options contain filename-like values
    const hasFilenames = hasFilenameOptions(inputSpec.options)

    if (hasFilenames) {
      // Apply filename mapping for display
      // @ts-expect-error - widget is not a ComboWidget
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
