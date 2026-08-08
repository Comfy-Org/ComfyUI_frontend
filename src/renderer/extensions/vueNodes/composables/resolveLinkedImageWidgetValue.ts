import { resolvePromotedInputBoundaryChain } from '@/core/graph/subgraph/promotedInputBoundary'
import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { isWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { appendNodeExecutionId } from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { NodeId } from '@/types/nodeId'
import type { WidgetValue } from '@/types/simplifiedWidget'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { parseImageWidgetValue } from '@/utils/imageUtil'

interface ResolvedLinkedImageWidgetValue {
  hostExecutionId: NodeExecutionId
  value: WidgetValue
}

export function isLinkedImageWidget(
  widget: Pick<SafeWidgetData, 'slotMetadata' | 'spec'>
): boolean {
  if (!widget.slotMetadata?.linked || !widget.spec) return false
  if (!isComboInputSpec(widget.spec)) return false
  return widget.spec.image_upload || widget.spec.animated_image_upload || false
}

export function getImageWidgetPreviewUrls(value: WidgetValue): string[] {
  const values =
    typeof value === 'string'
      ? [value]
      : Array.isArray(value) && value.every((item) => typeof item === 'string')
        ? value
        : []

  return values.flatMap((rawValue) => {
    const { filename, subfolder, type } = parseImageWidgetValue(rawValue)
    if (!filename) return []

    const params = new URLSearchParams({ filename, subfolder, type })
    appendCloudResParam(params, filename)
    return [
      api.apiURL(
        `/view?${params}${app.getPreviewFormatParam()}${app.getRandParam()}`
      )
    ]
  })
}

export function resolveLinkedImageWidgetValue(
  rootGraph: LGraph,
  activeSubgraphHostExecutionId: NodeExecutionId,
  sourceNodeId: NodeId,
  sourceInputName: string
): ResolvedLinkedImageWidgetValue | undefined {
  const sourceExecutionId = appendNodeExecutionId(
    activeSubgraphHostExecutionId,
    sourceNodeId
  )

  const surface = resolvePromotedInputBoundaryChain(
    rootGraph,
    sourceExecutionId,
    sourceInputName
  ).at(-1)
  if (!surface) return undefined

  const hostNode = getNodeByExecutionId(rootGraph, surface.hostExecutionId)
  if (!hostNode?.isSubgraphNode()) return undefined

  const widgetId = hostNode.inputs.find(
    (input) => input.name === surface.inputName
  )?.widgetId
  if (!widgetId) return undefined

  const value = useWidgetValueStore().getWidget(widgetId)?.value
  return isWidgetValue(value)
    ? { hostExecutionId: surface.hostExecutionId, value }
    : undefined
}
