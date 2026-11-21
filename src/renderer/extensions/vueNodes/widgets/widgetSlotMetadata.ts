import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { WidgetSlotMetadata } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { LinkTopology } from '@comfyorg/graph-model/linkTopology'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'

export function createSlotMetadata(
  input: INodeInputSlot,
  index: number,
  link: LinkTopology | undefined,
  graphRef: LGraph | null | undefined
): WidgetSlotMetadata {
  const originNode = link ? graphRef?.getNodeById(link.originNodeId) : null
  return {
    index,
    linked: link !== undefined,
    originNodeId: link?.originNodeId,
    originOutputName: link
      ? originNode?.outputs[link.originSlot]?.name
      : undefined,
    promoted: input.widgetId !== undefined,
    shape: input.shape,
    type: String(input.type)
  }
}

function getSlotWidgetName(input: INodeInputSlot): string | undefined {
  return (
    input.widget?.name ||
    (input.widgetId !== undefined && input.name ? input.name : undefined)
  )
}

export function buildSlotMetadata(
  inputs: INodeInputSlot[] | undefined,
  graphRef: LGraph | null | undefined,
  nodeId: NodeId
): Map<string, WidgetSlotMetadata> {
  const linkStore = useLinkStore()
  const scope = graphRef ? graphScopeOf(graphRef) : undefined
  const metadata = new Map<string, WidgetSlotMetadata>()
  for (const [index, input] of inputs?.entries() ?? []) {
    const link = scope
      ? linkStore.getInputSlotLink(scope, nodeId, index)
      : undefined
    const widgetName = getSlotWidgetName(input)
    if (!widgetName || metadata.has(widgetName)) continue
    metadata.set(widgetName, createSlotMetadata(input, index, link, graphRef))
  }
  return metadata
}
