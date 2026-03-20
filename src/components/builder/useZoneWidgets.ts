import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DropIndicatorData } from '@/components/builder/dropIndicatorUtil'
import { buildDropIndicator } from '@/components/builder/dropIndicatorUtil'
import { getTemplate } from '@/components/builder/layoutTemplates'
import type {
  SafeWidgetData,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useMaskEditor } from '@/composables/maskeditor/useMaskEditor'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useAppModeStore } from '@/stores/appModeStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { resolveNodeWidget } from '@/utils/litegraphUtil'

export const OUTPUT_ZONE_KEY = '__output__'

export interface ResolvedArrangeWidget {
  nodeId: NodeId
  widgetName: string
  node: LGraphNode
  widget: IBaseWidget
}

export interface EnrichedNodeData extends VueNodeData {
  hasErrors: boolean
  dropIndicator?: DropIndicatorData
  onDragDrop?: LGraphNode['onDragDrop']
  onDragOver?: LGraphNode['onDragOver']
}

export function inputsForZone(
  selectedInputs: [NodeId, string][],
  getZone: (nodeId: NodeId, widgetName: string) => string | undefined,
  zoneId: string
): [NodeId, string][] {
  return selectedInputs.filter(
    ([nodeId, widgetName]) => getZone(nodeId, widgetName) === zoneId
  )
}

/**
 * Composable for ArrangeLayout (builder/arrange mode).
 * Returns a computed Map<zoneId, resolved widget items[]>.
 */
export function useArrangeZoneWidgets() {
  const appModeStore = useAppModeStore()

  const template = computed(
    () => getTemplate(appModeStore.layoutTemplateId) ?? getTemplate('sidebar')!
  )

  return computed(() => {
    const map = new Map<string, ResolvedArrangeWidget[]>()

    for (const zone of template.value.zones) {
      const inputs = inputsForZone(
        appModeStore.selectedInputs,
        appModeStore.getZone,
        zone.id
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

/**
 * Composable for AppTemplateView (app runtime mode).
 * Returns a computed Map<zoneId, enriched VueNodeData[]>.
 *
 * Uses Map<LGraphNode, Widget[]> grouping instead of takeWhile,
 * so non-contiguous inputs for the same node are correctly merged.
 */
export function useAppZoneWidgets() {
  const appModeStore = useAppModeStore()
  const executionErrorStore = useExecutionErrorStore()
  const maskEditor = useMaskEditor()
  const { t } = useI18n()

  const template = computed(
    () => getTemplate(appModeStore.layoutTemplateId) ?? getTemplate('sidebar')!
  )

  const dropIndicatorOptions = computed(() => ({
    imageLabel: t('linearMode.dragAndDropImage'),
    videoLabel: t('linearMode.dragAndDropVideo'),
    openMaskEditor: maskEditor.openMaskEditor
  }))

  return computed(() => {
    const map = new Map<string, EnrichedNodeData[]>()

    for (const zone of template.value.zones) {
      const inputs = inputsForZone(
        appModeStore.selectedInputs,
        appModeStore.getZone,
        zone.id
      )
      map.set(
        zone.id,
        resolveAppWidgets(
          inputs,
          executionErrorStore,
          dropIndicatorOptions.value
        )
      )
    }

    return map
  })
}

/**
 * Resolve inputs into enriched VueNodeData grouped by node.
 * Uses Map-based grouping (fixes takeWhile non-contiguous bug).
 * Filters out nodes with mode !== ALWAYS.
 */
function resolveAppWidgets(
  inputs: [NodeId, string][],
  executionErrorStore: ReturnType<typeof useExecutionErrorStore>,
  dropIndicatorOptions?: Parameters<typeof buildDropIndicator>[1]
): EnrichedNodeData[] {
  const nodeWidgetMap = new Map<LGraphNode, IBaseWidget[]>()

  for (const [nodeId, widgetName] of inputs) {
    const [node, widget] = resolveNodeWidget(nodeId, widgetName)
    if (!node || !widget) continue
    if (!nodeWidgetMap.has(node)) nodeWidgetMap.set(node, [])
    nodeWidgetMap.get(node)!.push(widget)
  }

  const result: EnrichedNodeData[] = []

  for (const [node, inputGroup] of nodeWidgetMap) {
    if (node.mode !== LGraphEventMode.ALWAYS) continue

    const nodeData = extractVueNodeData(node)
    const enriched: EnrichedNodeData = {
      ...nodeData,
      hasErrors: !!executionErrorStore.lastNodeErrors?.[node.id],
      dropIndicator: dropIndicatorOptions
        ? buildDropIndicator(node, dropIndicatorOptions)
        : undefined,
      onDragDrop: node.onDragDrop,
      onDragOver: node.onDragOver
    }

    const filteredWidgets = (enriched.widgets ?? []).filter(
      (vueWidget: SafeWidgetData) => {
        if (vueWidget.slotMetadata?.linked) return false
        if (!node.isSubgraphNode())
          return inputGroup.some((w) => w.name === vueWidget.name)

        const storeNodeId = vueWidget.storeNodeId?.split(':')?.[1] ?? ''
        return inputGroup.some(
          (subWidget) =>
            isPromotedWidgetView(subWidget) &&
            subWidget.sourceNodeId === storeNodeId &&
            subWidget.sourceWidgetName === vueWidget.storeName
        )
      }
    )

    const updatedWidgets = filteredWidgets.map((widget) => ({
      ...widget,
      slotMetadata: undefined,
      nodeId: String(node.id)
    }))

    result.push({ ...enriched, widgets: updatedWidgets })
  }

  return result
}
