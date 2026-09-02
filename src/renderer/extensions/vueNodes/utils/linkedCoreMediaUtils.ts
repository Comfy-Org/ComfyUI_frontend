import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeExecutionOutput } from '@/schemas/apiSchema'
import { isInputPreviewOutput } from '@/utils/nodeOutputUtil'

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
  nodeClass: LinkedCoreMediaLoaderClass
): boolean {
  const { selectorName } = LINKED_CORE_MEDIA_LOADERS[nodeClass]
  const selectorSlotIndex =
    node.inputs?.findIndex(
      (input) =>
        input.widget?.name === selectorName || input.name === selectorName
    ) ?? -1
  return selectorSlotIndex >= 0 && node.isInputConnected(selectorSlotIndex)
}

function getLinkedCoreMediaLoaderClass(
  node: LGraphNode
): LinkedCoreMediaLoaderClass | undefined {
  const nodeClass = getCoreMediaLoaderClass(node)
  if (!nodeClass || !isMediaLoaderSelectorLinked(node, nodeClass))
    return undefined

  return nodeClass
}

export function shouldHideLinkedCoreMediaInputActions(
  node: LGraphNode
): boolean {
  const nodeClass = getLinkedCoreMediaLoaderClass(node)
  return (
    nodeClass !== undefined &&
    LINKED_CORE_MEDIA_LOADERS[nodeClass].showsInputPreview
  )
}

export function shouldHideLinkedCoreMediaInputPreview(
  node: LGraphNode,
  output: Pick<NodeExecutionOutput, 'images'> | undefined
): boolean {
  return (
    shouldHideLinkedCoreMediaInputActions(node) && isInputPreviewOutput(output)
  )
}

export function shouldHideLinkedCoreLoadAudioPlayer(node: LGraphNode): boolean {
  return getLinkedCoreMediaLoaderClass(node) === 'LoadAudio'
}
