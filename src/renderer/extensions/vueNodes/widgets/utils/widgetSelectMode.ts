import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ResultItemType } from '@/schemas/resultItemTypeSchema'
import type { AssetKind } from '@/types/widgetTypes'

interface WidgetSelectModeWidget {
  type: string
  spec?: InputSpec
}

interface WidgetSelectModeContext {
  assetApiEnabled: boolean
  useAssetBrowser: boolean
}

export function resolveWidgetSelectMode(
  widget: WidgetSelectModeWidget,
  { assetApiEnabled, useAssetBrowser }: WidgetSelectModeContext
) {
  const spec =
    widget.spec && isComboInputSpec(widget.spec) ? widget.spec : undefined

  let assetKind: AssetKind = 'unknown'
  if (spec?.video_upload) {
    assetKind = 'video'
  } else if (spec?.image_upload || spec?.animated_image_upload) {
    assetKind = 'image'
  } else if (spec?.audio_upload) {
    assetKind = 'audio'
  } else if (spec?.mesh_upload) {
    assetKind = 'mesh'
  }

  const allowUpload =
    spec?.image_upload === true ||
    spec?.animated_image_upload === true ||
    spec?.video_upload === true ||
    spec?.audio_upload === true ||
    spec?.mesh_upload === true
  const uploadFolder: ResultItemType | undefined = spec?.mesh_upload
    ? 'input'
    : spec?.image_folder
  const isAssetMode =
    useAssetBrowser || (assetApiEnabled && widget.type === 'asset')

  return {
    allowUpload,
    assetKind,
    isAssetMode,
    isDropdownUIWidget: isAssetMode || assetKind !== 'unknown',
    uploadFolder,
    uploadSubfolder: spec?.upload_subfolder
  }
}
