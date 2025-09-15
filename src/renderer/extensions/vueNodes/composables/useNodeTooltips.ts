import { type Ref, computed } from 'vue'

import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import { st } from '@/i18n'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

/**
 * Composable for managing Vue node tooltips
 * Provides tooltip text for node headers, slots, and widgets
 */
export function useNodeTooltips(
  nodeType: string,
  containerRef?: Ref<HTMLElement | undefined>
) {
  const nodeDefStore = useNodeDefStore()
  const settingsStore = useSettingStore()

  // Check if tooltips are globally enabled
  const tooltipsEnabled = computed(() =>
    settingsStore.get('Comfy.EnableTooltips')
  )

  // Get node definition for tooltip data
  const nodeDef = computed(() => nodeDefStore.nodeDefsByName[nodeType])

  /**
   * Get tooltip text for node description (header hover)
   */
  const getNodeDescription = computed(() => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    const key = `nodeDefs.${normalizeI18nKey(nodeType)}.description`
    return st(key, nodeDef.value.description || '')
  })

  /**
   * Get tooltip text for input slots
   */
  const getInputSlotTooltip = (slotName: string) => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    const key = `nodeDefs.${normalizeI18nKey(nodeType)}.inputs.${normalizeI18nKey(slotName)}.tooltip`
    const inputTooltip = nodeDef.value.inputs?.[slotName]?.tooltip ?? ''
    return st(key, inputTooltip)
  }

  /**
   * Get tooltip text for output slots
   */
  const getOutputSlotTooltip = (slotIndex: number) => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    const key = `nodeDefs.${normalizeI18nKey(nodeType)}.outputs.${slotIndex}.tooltip`
    const outputTooltip = nodeDef.value.outputs?.[slotIndex]?.tooltip ?? ''
    return st(key, outputTooltip)
  }

  /**
   * Get tooltip text for widgets
   */
  const getWidgetTooltip = (widget: SafeWidgetData) => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    // First try widget-specific tooltip
    const widgetTooltip = (widget as { tooltip?: string }).tooltip
    if (widgetTooltip) return widgetTooltip

    // Then try input-based tooltip lookup
    const key = `nodeDefs.${normalizeI18nKey(nodeType)}.inputs.${normalizeI18nKey(widget.name)}.tooltip`
    const inputTooltip = nodeDef.value.inputs?.[widget.name]?.tooltip ?? ''
    return st(key, inputTooltip)
  }

  /**
   * Create tooltip configuration object for v-tooltip directive
   */
  const createTooltipConfig = (text: string) => {
    const tooltipDelay = settingsStore.get('LiteGraph.Node.TooltipDelay')
    const tooltipText = text || ''

    const config: {
      value: string
      showDelay: number
      disabled: boolean
      appendTo?: HTMLElement
      pt?: any
    } = {
      value: tooltipText,
      showDelay: tooltipDelay as number,
      disabled: !tooltipsEnabled.value || !tooltipText,
      pt: {
        text: {
          class:
            'bg-[#171718] border border-[#5B5E7D] rounded-md px-4 py-2 text-white text-sm font-normal leading-tight max-w-[300px] shadow-none'
        },
        arrow: {
          class: 'before:border-[#171718]'
        }
      }
    }

    // If we have a container reference, append tooltips to it
    if (containerRef?.value) {
      config.appendTo = containerRef.value
    }

    return config
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
