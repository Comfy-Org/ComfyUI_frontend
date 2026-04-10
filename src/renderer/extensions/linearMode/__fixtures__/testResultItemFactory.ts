import type { ResultItemType } from '@/schemas/apiSchema'
import type { CompareImages } from '@/stores/queueStore'
import { ResultItemImpl } from '@/stores/queueStore'

export function makeResultItem(opts: {
  filename?: string
  mediaType?: string
  nodeId?: string
  subfolder?: string
  type?: ResultItemType
  compareImages?: CompareImages
}): ResultItemImpl {
  return new ResultItemImpl({
    filename: opts.filename ?? '',
    subfolder: opts.subfolder ?? '',
    type: opts.type ?? 'output',
    mediaType: opts.mediaType ?? 'images',
    nodeId: opts.nodeId ?? '1',
    compareImages: opts.compareImages
  })
}
