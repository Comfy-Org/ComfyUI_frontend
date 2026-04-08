import { computed } from 'vue'

import { getTemplate } from '@/components/builder/layoutTemplates'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useAppModeStore } from '@/stores/appModeStore'
import { resolveNodeWidget } from '@/utils/litegraphUtil'

export interface ResolvedArrangeWidget {
  nodeId: NodeId
  widgetName: string
  node: LGraphNode
  widget: IBaseWidget
}

export function inputsForZone(
  selectedInputs: [NodeId, string][],
  getZone: (nodeId: NodeId, widgetName: string) => string | undefined,
  zoneId: string,
  defaultZoneId?: string
): [NodeId, string][] {
  return selectedInputs.filter(([nodeId, widgetName]) => {
    const assigned = getZone(nodeId, widgetName)
    if (assigned) return assigned === zoneId
    return defaultZoneId ? zoneId === defaultZoneId : false
  })
}

/**
 * Composable for builder arrange mode.
 * Returns a computed Map<zoneId, resolved widget items[]>.
 */
export function useArrangeZoneWidgets() {
  const appModeStore = useAppModeStore()

  const template = computed(
    () => getTemplate(appModeStore.layoutTemplateId) ?? getTemplate('single')!
  )

  return computed(() => {
    const map = new Map<string, ResolvedArrangeWidget[]>()
    const defaultZoneId = template.value.zones[0]?.id

    for (const zone of template.value.zones) {
      const inputs = inputsForZone(
        appModeStore.selectedInputs,
        appModeStore.getZone,
        zone.id,
        defaultZoneId
      )
      const resolved = inputs
        .map(([nodeId, widgetName]) => {
          const [node, widget] = resolveNodeWidget(nodeId, widgetName)
          return node && widget ? { nodeId, widgetName, node, widget } : null
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
      map.set(zone.id, resolved)
    }

    return map
  })
}
