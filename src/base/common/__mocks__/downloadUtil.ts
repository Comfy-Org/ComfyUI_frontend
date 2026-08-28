import { vi } from 'vitest'

import type {
  downloadBlob as DownloadBlob,
  downloadFile as DownloadFile,
  extractFilenameFromContentDisposition as ExtractFilenameFromContentDisposition,
  openFileInNewTab as OpenFileInNewTab
} from '../downloadUtil'

export const downloadBlob = vi.fn<typeof DownloadBlob>()
export const downloadFile = vi.fn<typeof DownloadFile>()
export const extractFilenameFromContentDisposition =
  vi.fn<typeof ExtractFilenameFromContentDisposition>()
export const openFileInNewTab = vi.fn<typeof OpenFileInNewTab>()
