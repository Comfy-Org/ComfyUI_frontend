import { getMediaTypeFromFilename } from '@/utils/formatUtil'

import { isCloud } from './types'

/**
 * Appends `res=512` to the given URLSearchParams when in cloud mode
 * and the file is an image (or filename is unknown).
 *
 * The cloud backend resizes images server-side to prevent
 * the frontend from loading very large originals for previews.
 */
export function appendCloudResParam(
  params: URLSearchParams,
  filename?: string
): void {
  if (!isCloud) return
  if (filename && getMediaTypeFromFilename(filename) !== 'image') return
  params.set('res', '512')
}
