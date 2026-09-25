import type { ResultItemType } from '@/schemas/resultItemTypeSchema'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { AssetKind } from '@/types/widgetTypes'

export interface ComboSpecDescriptor {
  kind: AssetKind
  allowUpload: boolean
  folder: ResultItemType | undefined
  subfolder: string | undefined
}

export function parseComboSpecDescriptor(
  spec: ComboInputSpec | undefined
): ComboSpecDescriptor {
  if (!spec) {
    return {
      kind: 'unknown',
      allowUpload: false,
      folder: undefined,
      subfolder: undefined
    }
  }

  const {
    image_upload,
    animated_image_upload,
    video_upload,
    image_folder,
    audio_upload,
    mesh_upload,
    upload_subfolder
  } = spec

  let kind: AssetKind = 'unknown'
  if (video_upload) {
    kind = 'video'
  } else if (image_upload || animated_image_upload) {
    kind = 'image'
  } else if (audio_upload) {
    kind = 'audio'
  } else if (mesh_upload) {
    kind = 'mesh'
  }

  const allowUpload =
    image_upload === true ||
    animated_image_upload === true ||
    video_upload === true ||
    audio_upload === true ||
    mesh_upload === true

  return {
    kind,
    allowUpload,
    folder: mesh_upload ? 'input' : image_folder,
    subfolder: upload_subfolder
  }
}
