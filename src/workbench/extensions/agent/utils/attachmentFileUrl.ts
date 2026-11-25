import {
  getAssetFileUrl,
  getAssetUrl
} from '@/platform/assets/utils/assetUrlUtil'

/** File URL of an attached asset: by its asset id when known, else by its input filename. */
export function attachmentFileUrl({
  ref,
  id
}: {
  ref: string
  id?: string
}): string {
  if (!id) return getAssetUrl({ name: ref, tags: ['input'] })
  return getAssetFileUrl(
    { id, name: ref, tags: ['input'] },
    { disposition: 'inline' }
  )
}
