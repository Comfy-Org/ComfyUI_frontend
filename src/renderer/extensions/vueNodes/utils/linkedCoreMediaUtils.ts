import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeExecutionOutput } from '@/schemas/apiSchema'
import { isInputPreviewOutput } from '@/utils/nodeOutputUtil'

type MediaLoaderSelectorWidget = Pick<SafeWidgetData, 'name' | 'slotMetadata'>

const LINKED_CORE_MEDIA_LOADERS = {
  LoadAudio: { selectorName: 'audio', showsInputPreview: false },
  LoadImage: { selectorName: 'image', showsInputPreview: true },
  LoadImageMask: { selectorName: 'image', showsInputPreview: true },
  LoadImageOutput: { selectorName: 'image', showsInputPreview: true },
  LoadVideo: { selectorName: 'file', showsInputPreview: true }
} as const

type LinkedCoreMediaLoaderClass = keyof typeof LINKED_CORE_MEDIA_LOADERS

function isLinkedCoreMediaLoaderClass(
  value: string
): value is LinkedCoreMediaLoaderClass {
  return Object.hasOwn(LINKED_CORE_MEDIA_LOADERS, value)
}

function getCoreMediaLoaderClass(
  node: LGraphNode
): LinkedCoreMediaLoaderClass | undefined {
  const nodeData = node.constructor.nodeData
  const nodeClass = node.constructor.comfyClass
  if (
    !nodeData ||
    !('isCoreNode' in nodeData) ||
    nodeData.isCoreNode !== true ||
    !isLinkedCoreMediaLoaderClass(nodeClass)
  )
    return undefined

  return nodeClass
}

function isMediaLoaderSelectorLinked(
  node: LGraphNode,
  nodeClass: LinkedCoreMediaLoaderClass,
  widgets?: readonly MediaLoaderSelectorWidget[]
): boolean {
  const { selectorName } = LINKED_CORE_MEDIA_LOADERS[nodeClass]
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

function getLinkedCoreMediaLoaderClass(
  node: LGraphNode,
  widgets?: readonly MediaLoaderSelectorWidget[]
): LinkedCoreMediaLoaderClass | undefined {
  const nodeClass = getCoreMediaLoaderClass(node)
  if (!nodeClass || !isMediaLoaderSelectorLinked(node, nodeClass, widgets))
    return undefined

  return nodeClass
}

export function shouldHideLinkedCoreMediaInputActions(
  node: LGraphNode,
  widgets?: readonly MediaLoaderSelectorWidget[]
): boolean {
  const nodeClass = getLinkedCoreMediaLoaderClass(node, widgets)
  return (
    nodeClass !== undefined &&
    LINKED_CORE_MEDIA_LOADERS[nodeClass].showsInputPreview
  )
}

export function shouldHideLinkedCoreMediaInputPreview(
  node: LGraphNode,
  output: Pick<NodeExecutionOutput, 'images'> | undefined,
  widgets?: readonly MediaLoaderSelectorWidget[]
): boolean {
  return (
    shouldHideLinkedCoreMediaInputActions(node, widgets) &&
    isInputPreviewOutput(output)
  )
}

export function shouldHideLinkedCoreLoadAudioPlayer(
  node: LGraphNode,
  widgets?: readonly MediaLoaderSelectorWidget[]
): boolean {
  return getLinkedCoreMediaLoaderClass(node, widgets) === 'LoadAudio'
}
