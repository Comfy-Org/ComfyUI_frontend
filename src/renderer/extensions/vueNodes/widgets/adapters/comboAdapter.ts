import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { AssetKind } from '@/types/widgetTypes'

import type { SpecAdapter, SpecAdapterProps } from './specAdapter'

function deriveAssetKind(spec: ComboInputSpec): AssetKind {
  if (spec.video_upload) return 'video'
  if (spec.image_upload || spec.animated_image_upload) return 'image'
  if (spec.audio_upload) return 'audio'
  if (spec.mesh_upload) return 'mesh'
  return 'unknown'
}

export const comboAdapter: SpecAdapter<ComboInputSpec> = {
  canHandle: isComboInputSpec,
  extractProps: (spec): SpecAdapterProps => {
    const allowUpload =
      spec.image_upload === true ||
      spec.animated_image_upload === true ||
      spec.video_upload === true ||
      spec.audio_upload === true ||
      spec.mesh_upload === true
    return {
      assetKind: deriveAssetKind(spec),
      allowUpload,
      uploadFolder: spec.mesh_upload ? 'input' : spec.image_folder,
      uploadSubfolder: spec.upload_subfolder
    }
  }
}
