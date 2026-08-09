import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeExecutionOutput } from '@/schemas/apiSchema'

const CORE_MEDIA_SELECTOR_NAMES = {
  LoadAudio: 'audio',
  LoadImage: 'image',
  LoadVideo: 'file'
} as const

type CoreMediaNodeClass = keyof typeof CORE_MEDIA_SELECTOR_NAMES
type MediaSelectorWidget = Pick<SafeWidgetData, 'name' | 'slotMetadata'>

export type CoreMediaMenuActionKind = 'input' | 'preview'

const coreMediaMenuActionKinds = new WeakMap<object, CoreMediaMenuActionKind>()

function isCoreMediaNodeClass(value: string): value is CoreMediaNodeClass {
  return Object.hasOwn(CORE_MEDIA_SELECTOR_NAMES, value)
}

function getCoreMediaNodeClass(
  node: LGraphNode
): CoreMediaNodeClass | undefined {
  const nodeData = node.constructor.nodeData
  const nodeClass = node.constructor.comfyClass
  if (
    !nodeData ||
    !('isCoreNode' in nodeData) ||
    nodeData.isCoreNode !== true ||
    !isCoreMediaNodeClass(nodeClass)
  )
    return undefined

  return nodeClass
}

function isMediaSelectorLinked(
  node: LGraphNode,
  nodeClass: CoreMediaNodeClass,
  widgets?: readonly MediaSelectorWidget[]
): boolean {
  const selectorName = CORE_MEDIA_SELECTOR_NAMES[nodeClass]
  if (widgets) {
    return widgets.some(
      (widget) =>
        widget.name === selectorName && widget.slotMetadata?.linked === true
    )
  }

  return node.inputs.some(
    (input) => input.widget?.name === selectorName && input.link != null
  )
}

export function getLinkedCoreMediaNodeClass(
  node: LGraphNode,
  widgets?: readonly MediaSelectorWidget[]
): CoreMediaNodeClass | undefined {
  const nodeClass = getCoreMediaNodeClass(node)
  if (!nodeClass || !isMediaSelectorLinked(node, nodeClass, widgets))
    return undefined

  return nodeClass
}

export function isInputMediaPreview(
  output: Pick<NodeExecutionOutput, 'images'> | undefined
): boolean {
  return Boolean(
    output?.images?.length &&
    output.images.every((image) => image?.type === 'input')
  )
}

export function shouldHideCoreInputMediaPreview(
  node: LGraphNode,
  output: Pick<NodeExecutionOutput, 'images'> | undefined,
  widgets?: readonly MediaSelectorWidget[]
): boolean {
  const nodeClass = getLinkedCoreMediaNodeClass(node, widgets)
  return (
    (nodeClass === 'LoadImage' || nodeClass === 'LoadVideo') &&
    isInputMediaPreview(output)
  )
}

export function shouldHideCoreLoadAudioPlayer(
  node: LGraphNode,
  widgets?: readonly MediaSelectorWidget[]
): boolean {
  return getLinkedCoreMediaNodeClass(node, widgets) === 'LoadAudio'
}

export function markCoreMediaMenuCallback<T extends object>(
  callback: T,
  kind: CoreMediaMenuActionKind
): T {
  coreMediaMenuActionKinds.set(callback, kind)
  return callback
}

export function filterUnavailableCoreMediaMenuActions<T>(
  options: readonly T[],
  unavailableKinds: ReadonlySet<CoreMediaMenuActionKind>
): T[] {
  return options.filter((option) => {
    if (!option || typeof option !== 'object' || !('callback' in option))
      return true

    const { callback } = option
    if (typeof callback !== 'function') return true

    const kind = coreMediaMenuActionKinds.get(callback)
    return !kind || !unavailableKinds.has(kind)
  })
}
