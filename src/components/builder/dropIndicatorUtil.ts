import { downloadFile } from '@/base/common/downloadUtil'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { extractWidgetStringValue } from '@/composables/maskeditor/useMaskEditorLoader'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { parseImageWidgetValue } from '@/utils/imageUtil'

interface DropIndicatorData {
  iconClass: string
  imageUrl?: string
  videoUrl?: string
  label?: string
  onClick?: (e: MouseEvent) => void
  onMaskEdit?: () => void
  onDownload?: () => void
  onRemove?: () => void
}

/**
 * Build a DropZone indicator for LoadImage or LoadVideo nodes.
 * Returns undefined for other node types.
 */
export function buildDropIndicator(
  node: LGraphNode,
  options: {
    imageLabel?: string
    videoLabel?: string
    openMaskEditor?: (node: LGraphNode) => void
  }
): DropIndicatorData | undefined {
  if (node.type === 'LoadImage') {
    return buildImageDropIndicator(node, options)
  }

  if (node.type === 'LoadVideo') {
    return buildVideoDropIndicator(node, options)
  }

  return undefined
}

function buildImageDropIndicator(
  node: LGraphNode,
  options: {
    imageLabel?: string
    openMaskEditor?: (node: LGraphNode) => void
  }
): DropIndicatorData {
  const stringValue = extractWidgetStringValue(node.widgets?.[0]?.value)

  const { filename, subfolder, type } = stringValue
    ? parseImageWidgetValue(stringValue)
    : { filename: '', subfolder: '', type: 'input' }

  const imageUrl = filename
    ? (() => {
        const params = new URLSearchParams({ filename, subfolder, type })
        appendCloudResParam(params, filename)
        return api.apiURL(`/view?${params}${app.getPreviewFormatParam()}`)
      })()
    : undefined

  return {
    iconClass: 'icon-[lucide--image]',
    imageUrl,
    label: options.imageLabel,
    onClick: () => node.widgets?.[1]?.callback?.(undefined),
    onMaskEdit:
      imageUrl && options.openMaskEditor
        ? () => options.openMaskEditor!(node)
        : undefined,
    onDownload: imageUrl ? () => downloadFile(imageUrl) : undefined,
    onRemove: imageUrl
      ? () => {
          const imageWidget = node.widgets?.find((w) => w.name === 'image')
          if (imageWidget) {
            imageWidget.value = ''
            imageWidget.callback?.(undefined)
          }
        }
      : undefined
  }
}

function buildVideoDropIndicator(
  node: LGraphNode,
  options: { videoLabel?: string }
): DropIndicatorData {
  const stringValue = extractWidgetStringValue(node.widgets?.[0]?.value)

  const { filename, subfolder, type } = stringValue
    ? parseImageWidgetValue(stringValue)
    : { filename: '', subfolder: '', type: 'input' }

  const videoUrl = filename
    ? api.apiURL(`/view?${new URLSearchParams({ filename, subfolder, type })}`)
    : undefined

  return {
    iconClass: 'icon-[lucide--video]',
    videoUrl,
    label: options.videoLabel,
    onClick: () => node.widgets?.[1]?.callback?.(undefined)
  }
}
