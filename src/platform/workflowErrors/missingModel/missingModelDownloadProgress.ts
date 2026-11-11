import type { TemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'
import { formatSize } from '@/utils/formatUtil'

/** Received and total bytes of a running download, as far as the host reported them. */
export function formatDownloadedBytes(
  state: TemplateModelDownloadState
): string | undefined {
  if (state.status !== 'downloading') return undefined
  const { receivedBytes, totalBytes } = state
  if (receivedBytes !== null && totalBytes !== null) {
    return `${formatSize(receivedBytes)} / ${formatSize(totalBytes)}`
  }
  if (receivedBytes !== null) return formatSize(receivedBytes)
  return undefined
}
