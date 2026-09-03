import { computed, unref } from 'vue'
import type { MaybeRef } from 'vue'

import type { TooltipConfig } from '@/components/ui/tooltip'
import { resolveNodeDefSlotText, resolveNodeDefText } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

/**
 * Composable for managing Vue node tooltips
 * Provides tooltip text for node headers, slots, and widgets
 */
export function useNodeTooltips(nodeType: MaybeRef<string>) {
  const nodeDefStore = useNodeDefStore()
  const settingsStore = useSettingStore()

  // Check if tooltips are globally enabled
  const tooltipsEnabled = computed(() =>
    settingsStore.get('Comfy.EnableTooltips')
  )

  // Get node definition for tooltip data
  const nodeDef = computed(() => nodeDefStore.nodeDefsByName[unref(nodeType)])

  /**
   * Get tooltip text for node description (header hover)
   */
  const getNodeDescription = computed(() => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    return resolveNodeDefText(
      'description',
      unref(nodeType),
      nodeDef.value.description || undefined
    )
  })

  /**
   * Get tooltip text for input slots
   */
  const getInputSlotTooltip = (slotName: string) => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    return resolveNodeDefSlotText(
      'tooltip',
      unref(nodeType),
      slotName,
      nodeDef.value.inputs?.[slotName]?.tooltip
    )
  }

  /**
   * Get tooltip text for output slots
   */
  const getOutputSlotTooltip = (slotIndex: number) => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    return resolveNodeDefSlotText(
      'tooltip',
      unref(nodeType),
      slotIndex,
      nodeDef.value.outputs?.[slotIndex]?.tooltip
    )
  }

  /**
   * Get tooltip text for widgets
   */
  const getWidgetTooltip = (widget: { name: string; tooltip?: string }) => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    // First try widget-specific tooltip
    const widgetTooltip = widget.tooltip
    if (widgetTooltip) return widgetTooltip

    // Then try input-based tooltip lookup
    return resolveNodeDefSlotText(
      'tooltip',
      unref(nodeType),
      widget.name,
      nodeDef.value.inputs?.[widget.name]?.tooltip
    )
  }

  const createTooltipConfig = (text: string): TooltipConfig => {
    const tooltipDelay = settingsStore.get('LiteGraph.Node.TooltipDelay')
    const tooltipText = text || ''

    return {
      value: tooltipText,
      showDelay: Number(tooltipDelay),
      hideDelay: 0,
      disabled: !tooltipsEnabled.value || !tooltipText,
      contentClass:
        'max-w-96 whitespace-pre-line px-4 py-2 text-sm font-normal leading-tight shadow-none'
    }
  }

  return {
    tooltipsEnabled,
    getNodeDescription,
    getInputSlotTooltip,
    getOutputSlotTooltip,
    getWidgetTooltip,
    createTooltipConfig
  }
}
