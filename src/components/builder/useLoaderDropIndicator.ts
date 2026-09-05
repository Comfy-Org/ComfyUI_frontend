import { extractWidgetStringValue } from '@/composables/maskeditor/useMaskEditorLoader'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { useWidgetValueStore } from '@/stores/widgetValueStore'
import { parseWidgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'
import { parseImageWidgetValue } from '@/utils/imageUtil'

type LoaderMediaType = 'image' | 'video' | 'audio'

export interface LoaderDropIndicator {
  iconClass: string
  mediaUrl: string | undefined
  mediaType: LoaderMediaType
  label: string | undefined
  onClick: () => void
  onMaskEdit: (() => void) | undefined
}

interface LoaderMediaConfig {
  /** Name of the widget holding the selected filename. */
  widgetName: string
  mediaType: LoaderMediaType
  labelKey: string
}

/**
 * Native loader node types that upload/select a single media file. App mode
 * only renders widgets, so these types are hard-coded here to get the same
 * inline preview as the normal editor. See FE-1344 for the long-term plan of
 * making the preview part of the selection widget itself.
 */
const LOADER_MEDIA_CONFIG: Record<string, LoaderMediaConfig> = {
  LoadImage: {
    widgetName: 'image',
    mediaType: 'image',
    labelKey: 'linearMode.dragAndDropImage'
  },
  LoadVideo: {
    widgetName: 'file',
    mediaType: 'video',
    labelKey: 'linearMode.dragAndDropVideo'
  },
  LoadAudio: {
    widgetName: 'audio',
    mediaType: 'audio',
    labelKey: 'linearMode.dragAndDropAudio'
  }
}

function buildMediaUrl(
  mediaType: LoaderMediaType,
  filename: string,
  subfolder: string,
  type: string
) {
  if (!filename) return undefined

  const params = new URLSearchParams({ filename, subfolder, type })
  appendCloudResParam(params, filename)
  const previewParam = mediaType === 'image' ? app.getPreviewFormatParam() : ''
  return api.apiURL(`/view?${params}${previewParam}`)
}

/**
 * Builds the App mode drop-zone preview for native loader nodes
 * (`LoadImage`, `LoadVideo`, `LoadAudio`). Returns `undefined` for any other
 * node type.
 */
export function getLoaderDropIndicator(
  node: LGraphNode,
  id: WidgetId,
  options: {
    mobile: boolean
    label: (key: string) => string
    onMaskEdit: (node: LGraphNode) => void
    widgetValueStore: Pick<ReturnType<typeof useWidgetValueStore>, 'getWidget'>
  }
): LoaderDropIndicator | undefined {
  const config = LOADER_MEDIA_CONFIG[node.type ?? '']
  if (!config) return undefined
  if (parseWidgetId(id).name !== config.widgetName) return undefined

  const stringValue = extractWidgetStringValue(
    options.widgetValueStore.getWidget(id)?.value
  )
  const { filename, subfolder, type } = stringValue
    ? parseImageWidgetValue(stringValue)
    : { filename: '', subfolder: '', type: 'input' }

  const mediaUrl = buildMediaUrl(config.mediaType, filename, subfolder, type)

  return {
    iconClass: iconForMediaType(config.mediaType),
    mediaUrl,
    mediaType: config.mediaType,
    label: options.mobile ? undefined : options.label(config.labelKey),
    onClick: () =>
      node.widgets?.find((w) => w.name === 'upload')?.callback?.(undefined),
    onMaskEdit:
      config.mediaType === 'image' && mediaUrl
        ? () => options.onMaskEdit(node)
        : undefined
  }
}
