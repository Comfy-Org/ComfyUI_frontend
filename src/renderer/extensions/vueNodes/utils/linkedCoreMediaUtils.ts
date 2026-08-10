import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeExecutionOutput } from '@/schemas/apiSchema'
import {
  CORE_MEDIA_LOADER_WIDGET_NAMES,
  isCoreMediaLoaderClass
} from '@/utils/loaderNodeUtil'
import type { CoreMediaLoaderClass } from '@/utils/loaderNodeUtil'
import { isInputPreviewOutput } from '@/utils/nodeOutputUtil'

type MediaLoaderSelectorWidget = Pick<SafeWidgetData, 'name' | 'slotMetadata'>

function getCoreMediaLoaderClass(
  node: LGraphNode
): CoreMediaLoaderClass | undefined {
  const nodeData = node.constructor.nodeData
  const nodeClass = node.constructor.comfyClass
  if (
    !nodeData ||
    !('isCoreNode' in nodeData) ||
    nodeData.isCoreNode !== true ||
    !isCoreMediaLoaderClass(nodeClass)
  )
    return undefined

  return nodeClass
}

function isMediaLoaderSelectorLinked(
  node: LGraphNode,
  nodeClass: CoreMediaLoaderClass,
  widgets?: readonly MediaLoaderSelectorWidget[]
): boolean {
  const selectorName = CORE_MEDIA_LOADER_WIDGET_NAMES[nodeClass]
  if (widgets) {
    return widgets.some(
      (widget) =>
        widget.name === selectorName && widget.slotMetadata?.linked === true
    )
  }

  const selectorWidget = node.widgets?.find(
    (widget) => widget.name === selectorName
  )
  const selectorSlot = node.getSlotFromWidget(selectorWidget)
  if (!selectorSlot) return false

  const selectorSlotIndex = node.inputs.indexOf(selectorSlot)
  return selectorSlotIndex >= 0 && node.isInputConnected(selectorSlotIndex)
}

export function getLinkedCoreMediaLoaderClass(
  node: LGraphNode,
  widgets?: readonly MediaLoaderSelectorWidget[]
): CoreMediaLoaderClass | undefined {
  const nodeClass = getCoreMediaLoaderClass(node)
  if (!nodeClass || !isMediaLoaderSelectorLinked(node, nodeClass, widgets))
    return undefined

  return nodeClass
}

export function shouldHideLinkedCoreMediaInputPreview(
  node: LGraphNode,
  output: Pick<NodeExecutionOutput, 'images'> | undefined,
  widgets?: readonly MediaLoaderSelectorWidget[]
): boolean {
  const nodeClass = getLinkedCoreMediaLoaderClass(node, widgets)
  return (
    (nodeClass === 'LoadImage' || nodeClass === 'LoadVideo') &&
    isInputPreviewOutput(output)
  )
}

export function shouldHideLinkedCoreLoadAudioPlayer(
  node: LGraphNode,
  widgets?: readonly MediaLoaderSelectorWidget[]
): boolean {
  return getLinkedCoreMediaLoaderClass(node, widgets) === 'LoadAudio'
}
