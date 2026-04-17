import { computed, unref } from 'vue'
import type { MaybeRef } from 'vue'

import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import { st } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

/**
 * Composable for managing Vue node tooltips
 * Provides tooltip text for node headers, slots, and widgets
 */
export function useNodeTooltips(nodeType: MaybeRef<string>) {
  const nodeDefStore = useNodeDefStore()
  const settingsStore = useSettingStore()

  const tooltipsEnabled = computed(() =>
    settingsStore.get('Comfy.EnableTooltips')
  )

  const tooltipDelay = computed(
    () => settingsStore.get('LiteGraph.Node.TooltipDelay') as number
  )

  const nodeDef = computed(() => nodeDefStore.nodeDefsByName[unref(nodeType)])

  /**
   * Get tooltip text for node description (header hover)
   */
  const getNodeDescription = computed(() => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    const key = `nodeDefs.${normalizeI18nKey(unref(nodeType))}.description`
    return st(key, nodeDef.value.description || '')
  })

  /**
   * Get tooltip text for input slots
   */
  function getInputSlotTooltip(slotName: string) {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    const key = `nodeDefs.${normalizeI18nKey(unref(nodeType))}.inputs.${normalizeI18nKey(slotName)}.tooltip`
    const inputTooltip = nodeDef.value.inputs?.[slotName]?.tooltip ?? ''
    return st(key, inputTooltip)
  }

  /**
   * Get tooltip text for output slots
   */
  function getOutputSlotTooltip(slotIndex: number) {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    const key = `nodeDefs.${normalizeI18nKey(unref(nodeType))}.outputs.${slotIndex}.tooltip`
    const outputTooltip = nodeDef.value.outputs?.[slotIndex]?.tooltip ?? ''
    return st(key, outputTooltip)
  }

  /**
   * Get tooltip text for widgets
   */
  function getWidgetTooltip(widget: SafeWidgetData) {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    // First try widget-specific tooltip
    const widgetTooltip = (widget as { tooltip?: string }).tooltip
    if (widgetTooltip) return widgetTooltip

    // Then try input-based tooltip lookup
    const key = `nodeDefs.${normalizeI18nKey(unref(nodeType))}.inputs.${normalizeI18nKey(widget.name)}.tooltip`
    const inputTooltip = nodeDef.value.inputs?.[widget.name]?.tooltip ?? ''
    return st(key, inputTooltip)
  }

  return {
    tooltipsEnabled,
    tooltipDelay,
    getNodeDescription,
    getInputSlotTooltip,
    getOutputSlotTooltip,
    getWidgetTooltip
  }
}
