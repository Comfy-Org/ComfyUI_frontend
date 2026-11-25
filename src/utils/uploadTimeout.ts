import { sumBy } from 'es-toolkit'

import { isDesktop } from '@/platform/distribution/types'

const UPLOAD_BASE_TIMEOUT_MS = 120_000
const UPLOAD_FLOOR_BYTES_PER_SECOND = 256 * 1024

/** Response timeout for each request of a batch of files uploaded concurrently over one link. */
export function uploadTimeoutMs(files: readonly File[]): number {
  if (isDesktop) return UPLOAD_BASE_TIMEOUT_MS
  const batchBytes = sumBy(files, (file) => file.size)
  return (
    UPLOAD_BASE_TIMEOUT_MS +
    Math.ceil((batchBytes / UPLOAD_FLOOR_BYTES_PER_SECOND) * 1000)
  )
}
