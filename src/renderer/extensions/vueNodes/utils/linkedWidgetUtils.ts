import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { isImageUploadInput } from '@/types/nodeDefAugmentation'

interface MediaUploadNodeDef {
  input?: {
    required?: Record<string, InputSpec>
  }
  isCoreNode?: boolean
}

function getMediaInputName(node: LGraphNode): string | undefined {
  const nodeDef = node.constructor.nodeData as MediaUploadNodeDef | undefined
  if (!nodeDef?.isCoreNode) return undefined

  const uploadInput = nodeDef.input?.required?.upload
  if (!uploadInput || !isImageUploadInput(uploadInput)) return undefined

  return uploadInput[1].imageInputName
}

export function hasLinkedInputPreviewWidget(
  node: LGraphNode,
  widgets: readonly Pick<SafeWidgetData, 'name' | 'slotMetadata'>[]
): boolean {
  const mediaInputName = getMediaInputName(node)
  if (!mediaInputName) return false

  return widgets.some(
    (widget) =>
      widget.name === mediaInputName && widget.slotMetadata?.linked === true
  )
}

export function isInputMediaPreview(
  output:
    | {
        images?: Array<{ type?: string } | null>
      }
    | undefined
): boolean {
  return Boolean(
    output?.images?.length &&
    output.images.every((image) => image?.type === 'input')
  )
}
