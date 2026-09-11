import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { hasImageType } from '@/utils/eventUtils'
import { formatSize } from '@/utils/formatUtil'
import type { ComposerAttachment } from './useComposer'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
const MAX_ADVERTISED_ATTACHMENT_BYTES = 512 * 1024 * 1024
const MULTIPART_ENVELOPE_BYTES = 1024
const UPLOAD_HANDSHAKE_TIMEOUT_MS = 30 * 1000
const UPLOAD_FLOOR_BYTES_PER_SECOND = 64 * 1024
const DEFERRED_FETCH_TIMEOUT_MS = 60 * 1000
const MAX_CONCURRENT_UPLOADS = 3

interface UploadResult {
  ref: string
  url?: string
}

export interface UseAttachmentOptions {
  upload: (file: File, signal: AbortSignal) => Promise<UploadResult>
  uploadTimeoutMs?: number
  maxBytes?: (file: File) => number
  onError?: (message: string) => void
  onUploaded?: () => void
  stage: (attachment: ComposerAttachment) => void
  update: (id: string, patch: Partial<ComposerAttachment>) => void
  remove: (id: string) => void
}

/**
 * The server advertises `max_upload_size` as an unvalidated flag value, and the
 * cap it enforces covers the whole multipart body rather than the file alone.
 */
export function resolveAttachmentLimit(advertised: unknown): number {
  const advertisedBytes =
    typeof advertised === 'number' &&
    Number.isFinite(advertised) &&
    advertised > 0
      ? Math.min(advertised, MAX_ADVERTISED_ATTACHMENT_BYTES)
      : MAX_ATTACHMENT_BYTES
  return Math.max(0, advertisedBytes - MULTIPART_ENVELOPE_BYTES)
}

// A fetch upload reports no transfer progress, so the deadline is sized from a
// floor throughput instead of being keyed off a stall.
function uploadDeadlineMs(file: File): number {
  return (
    UPLOAD_HANDSHAKE_TIMEOUT_MS +
    (file.size / UPLOAD_FLOOR_BYTES_PER_SECOND) * 1000
  )
}

async function withDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  onExpire?: () => void
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      onExpire?.()
      reject(new Error(`Timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })
  try {
    return await Promise.race([work, expiry])
  } finally {
    clearTimeout(timer)
  }
}

async function forEachWithLimit<T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>
): Promise<void> {
  let next = 0
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) await run(items[next++])
    }
  )
  await Promise.all(workers)
}

let stagedCount = 0

export function useAttachment(options: UseAttachmentOptions) {
  const inFlight = new Map<string, AbortController>()
  const cancelled = new Set<string>()

  function stage(name: string): string {
    const id = `upload-${++stagedCount}:${name}`
    options.stage({ id, name, ref: '', uploading: true })
    return id
  }

  function isTooLarge(file: File): boolean {
    const maxBytes = options.maxBytes?.(file) ?? MAX_ATTACHMENT_BYTES
    if (file.size <= maxBytes) return false

    options.onError?.(
      i18n.global.t('agent.attachmentTooLarge', {
        name: file.name,
        limit: formatSize(maxBytes)
      })
    )
    return true
  }

  function failAttachment(id: string, name: string, errorType: string) {
    return (cause: unknown): undefined => {
      reportError(cause, { errorType })
      options.onError?.(i18n.global.t('agent.attachmentUploadFailed', { name }))
      options.remove(id)
      return undefined
    }
  }

  async function uploadStagedFile(id: string, file: File): Promise<boolean> {
    options.update(id, {
      name: file.name,
      previewUrl: hasImageType(file) ? URL.createObjectURL(file) : undefined
    })
    const controller = new AbortController()
    inFlight.set(id, controller)
    try {
      const result = await withDeadline(
        options.upload(file, controller.signal),
        options.uploadTimeoutMs ?? uploadDeadlineMs(file),
        () => controller.abort()
      )
      options.update(id, { ref: result.ref, uploading: false })
      return true
    } catch (cause) {
      if (!cancelled.has(id))
        failAttachment(id, file.name, 'agent_attachment_upload_failed')(cause)
      return false
    } finally {
      inFlight.delete(id)
      cancelled.delete(id)
    }
  }

  function cancelUpload(id: string): void {
    const controller = inFlight.get(id)
    if (!controller) return
    cancelled.add(id)
    controller.abort()
  }

  function cancelAllUploads(): void {
    for (const id of [...inFlight.keys()]) cancelUpload(id)
  }

  async function addDeferredFile(
    name: string,
    resolve: () => Promise<File | undefined>
  ): Promise<File | undefined> {
    const id = stage(name)
    const file = await withDeadline(resolve(), DEFERRED_FETCH_TIMEOUT_MS).catch(
      failAttachment(id, name, 'agent_attachment_fetch_failed')
    )
    if (!file) {
      options.remove(id)
      return undefined
    }
    if (isTooLarge(file)) {
      options.remove(id)
      return file
    }
    if (await uploadStagedFile(id, file)) options.onUploaded?.()
    return file
  }

  async function addFiles(files: Iterable<File>): Promise<void> {
    const staged = [...files]
      .filter((file) => !isTooLarge(file))
      .map((file) => ({ file, id: stage(file.name) }))
    let uploaded = 0
    await forEachWithLimit(
      staged,
      MAX_CONCURRENT_UPLOADS,
      async ({ id, file }) => {
        if (await uploadStagedFile(id, file)) uploaded += 1
      }
    )
    if (uploaded > 0) options.onUploaded?.()
  }

  return { addDeferredFile, addFiles, cancelUpload, cancelAllUploads }
}
