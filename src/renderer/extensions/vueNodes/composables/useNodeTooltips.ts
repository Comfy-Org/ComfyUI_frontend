import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { resolveNodeDefSlotText, resolveNodeDefText, t } from '@/i18n'
import type { INodeSlot } from '@comfyorg/litegraph/litegraph'
import { RenderShape } from '@comfyorg/graph-model/globalEnums'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { useNodeDefStore } from '@/stores/nodeDefStore'

/**
 * Composable for managing Vue node tooltips
 * Provides tooltip text for node headers, slots, and widgets
 */
export function useNodeTooltips(nodeType: MaybeRefOrGetter<string>) {
  const nodeDefStore = useNodeDefStore()
  const settingsStore = useSettingStore()

  const tooltipsEnabled = computed(() =>
    settingsStore.get('Comfy.EnableTooltips')
  )

  const findNodeDef = (type: string): ComfyNodeDefImpl | undefined =>
    nodeDefStore.nodeDefsByName[type]
  const nodeDef = computed(() => findNodeDef(toValue(nodeType)))

  const getNodeDescription = computed(() => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    return resolveNodeDefText(
      'description',
      toValue(nodeType),
      nodeDef.value.description || undefined
    )
  })

  const describeInput = (inputName: string) =>
    nodeDef.value
      ? resolveNodeDefSlotText(
          'tooltip',
          toValue(nodeType),
          inputName,
          nodeDef.value.inputs[inputName]?.tooltip
        )
      : ''

  const getInputSlotTooltip = (
    slot: Pick<INodeSlot, 'localized_name' | 'name'>
  ) => {
    if (!tooltipsEnabled.value) return ''

    const inputName = slot.name || ''
    return (
      describeInput(inputName) ||
      t('g.inputTooltip', { name: slot.localized_name || inputName })
    )
  }

  const getOutputSlotTooltip = (
    slot: Pick<INodeSlot, 'name' | 'shape'>,
    slotIndex: number
  ) => {
    if (!tooltipsEnabled.value) return ''

    const description = nodeDef.value
      ? resolveNodeDefSlotText(
          'tooltip',
          toValue(nodeType),
          slotIndex,
          nodeDef.value.outputs[slotIndex]?.tooltip
        )
      : ''
    const text = description || `Output: ${slot.name || ''}`
    return slot.shape === RenderShape.GRID
      ? `${text} ${t('vueNodesSlot.iterative')}`
      : text
  }

  const getWidgetTooltip = (
    widget: { name: string; tooltip?: string },
    fullValue = ''
  ) => {
    if (!tooltipsEnabled.value) return ''

    const description = nodeDef.value
      ? widget.tooltip || describeInput(widget.name)
      : ''
    return [description, fullValue].join('\n\n').trim()
  }

  return {
    getNodeDescription,
    getInputSlotTooltip,
    getOutputSlotTooltip,
    getWidgetTooltip
  }
}
