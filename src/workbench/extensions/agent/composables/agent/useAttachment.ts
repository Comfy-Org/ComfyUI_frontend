import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { DroppedAssetTooLargeError, hasImageType } from '@/utils/eventUtils'
import { formatSize } from '@/utils/formatUtil'
import type { ComposerAttachment } from './useComposer'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
const UPLOAD_HANDSHAKE_TIMEOUT_MS = 60 * 1000
const UPLOAD_FLOOR_BYTES_PER_SECOND = 64 * 1024
const MAX_CONCURRENT_UPLOADS = 3
export const MAX_ATTACHMENT_BATCH_SIZE = 100

class AttachmentDeadlineError extends Error {
  constructor(timeoutMs: number) {
    super(`Timed out after ${timeoutMs}ms`)
    this.name = 'AttachmentDeadlineError'
  }
}

interface UploadResult {
  ref: string
  url?: string
  subfolder?: string
  uploadType?: string
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
  isPresent?: (id: string) => boolean
}

// A fetch upload reports no transfer progress, so the deadline is sized from a
// floor throughput instead of being keyed off a stall.
function transferDeadlineMs(bytes: number): number {
  return (
    UPLOAD_HANDSHAKE_TIMEOUT_MS + (bytes / UPLOAD_FLOOR_BYTES_PER_SECOND) * 1000
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
      reject(new AttachmentDeadlineError(timeoutMs))
      onExpire?.()
    }, timeoutMs)
  })
  try {
    return await Promise.race([work, expiry])
  } finally {
    clearTimeout(timer)
  }
}

let stagedCount = 0

export function useAttachment(options: UseAttachmentOptions) {
  const pending = new Set<string>()
  const inFlight = new Map<string, AbortController>()
  const cancelled = new Set<string>()
  const waiting: Array<() => void> = []
  let activeUploads = 0

  function stage(name: string): string {
    const id = `upload-${++stagedCount}:${name}`
    pending.add(id)
    options.stage({ id, name, ref: '', uploading: true })
    return id
  }

  function settle(id: string): void {
    pending.delete(id)
    inFlight.delete(id)
    cancelled.delete(id)
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

  function failAttachment(
    id: string,
    name: string,
    errorType: string,
    cause: unknown
  ) {
    return (): undefined => {
      const failureReason =
        cause instanceof AttachmentDeadlineError
          ? 'timeout'
          : cause instanceof Error && cause.name === 'AbortError'
            ? 'aborted'
            : 'transport'
      reportError(new Error('Agent attachment operation failed', { cause }), {
        errorType,
        tags: {
          failure_kind: 'caught_unexpected',
          feature_area: 'agent',
          operation: 'save',
          outcome: 'failed',
          integration_target: 'assets',
          feature_flag: 'agent_panel',
          feature_flag_state: 'enabled',
          project_context: 'agent_composer',
          failure_reason: failureReason
        }
      })
      options.onError?.(i18n.global.t('agent.attachmentUploadFailed', { name }))
      options.remove(id)
      return undefined
    }
  }

  function acquireUploadSlot(): Promise<void> | undefined {
    if (activeUploads === MAX_CONCURRENT_UPLOADS)
      return new Promise<void>((resolve) => waiting.push(resolve))
    activeUploads += 1
  }

  function releaseUploadSlot(): void {
    const next = waiting.shift()
    if (next) next()
    else activeUploads -= 1
  }

  async function uploadStagedFile(
    id: string,
    file: File,
    ownsUploadSlot = false
  ): Promise<'uploaded' | 'cancelled' | 'failed'> {
    const slot = ownsUploadSlot ? undefined : acquireUploadSlot()
    if (slot) await slot
    try {
      if (cancelled.has(id)) return 'cancelled'
      options.update(id, {
        name: file.name,
        previewUrl: hasImageType(file) ? URL.createObjectURL(file) : undefined
      })
      const controller = new AbortController()
      inFlight.set(id, controller)
      const result = await withDeadline(
        options.upload(file, controller.signal),
        options.uploadTimeoutMs ?? transferDeadlineMs(file.size),
        () => controller.abort()
      )
      options.update(id, {
        ref: result.ref,
        ...(result.url ? { previewUrl: result.url } : {}),
        ...(result.subfolder ? { subfolder: result.subfolder } : {}),
        ...(result.uploadType ? { uploadType: result.uploadType } : {}),
        uploading: false
      })
      return 'uploaded'
    } catch (error) {
      if (cancelled.has(id)) return 'cancelled'
      if (options.isPresent && !options.isPresent(id)) return 'cancelled'
      failAttachment(id, file.name, 'agent_attachment_upload_failed', error)()
      return 'failed'
    } finally {
      settle(id)
      if (!ownsUploadSlot) releaseUploadSlot()
    }
  }

  function cancelUpload(id: string): void {
    if (!pending.has(id)) return
    cancelled.add(id)
    options.remove(id)
    inFlight.get(id)?.abort()
  }

  function cancelAllUploads(): void {
    for (const id of [...pending]) cancelUpload(id)
  }

  async function addDeferredFile(
    name: string,
    resolve: (
      signal: AbortSignal,
      maxBytes: number
    ) => Promise<File | undefined>
  ): Promise<'uploaded' | 'unsupported' | 'cancelled' | 'failed'> {
    if (pending.size >= MAX_ATTACHMENT_BATCH_SIZE) {
      options.onError?.(
        i18n.global.t('agent.attachmentBatchLimit', {
          count: 1,
          limit: MAX_ATTACHMENT_BATCH_SIZE
        })
      )
      return 'failed'
    }
    const id = stage(name)
    const slot = acquireUploadSlot()
    if (slot) await slot
    let fetchSlotReleased = false
    try {
      if (cancelled.has(id)) return 'cancelled'
      const controller = new AbortController()
      inFlight.set(id, controller)
      // The source size is unknown until the fetch finishes. Size this first
      // transfer from the largest file we would accept so slow, valid assets
      // get the same throughput floor as the subsequent upload.
      const maxBytes =
        options.maxBytes?.(new File([], name)) ?? MAX_ATTACHMENT_BYTES
      const file = await withDeadline(
        resolve(controller.signal, maxBytes),
        transferDeadlineMs(maxBytes),
        () => controller.abort()
      )
      if (cancelled.has(id)) return 'cancelled'
      if (!file) {
        options.remove(id)
        return 'unsupported'
      }
      if (isTooLarge(file)) {
        options.remove(id)
        return 'failed'
      }
      inFlight.delete(id)
      releaseUploadSlot()
      fetchSlotReleased = true
      const outcome = await uploadStagedFile(id, file)
      if (outcome !== 'uploaded') return outcome
      options.onUploaded?.()
      return 'uploaded'
    } catch (error) {
      if (cancelled.has(id)) return 'cancelled'
      if (options.isPresent && !options.isPresent(id)) return 'cancelled'
      if (error instanceof DroppedAssetTooLargeError) {
        options.onError?.(
          i18n.global.t('agent.attachmentTooLarge', {
            name,
            limit: formatSize(error.maxBytes)
          })
        )
        options.remove(id)
        return 'failed'
      }
      failAttachment(id, name, 'agent_attachment_fetch_failed', error)()
      return 'failed'
    } finally {
      settle(id)
      if (!fetchSlotReleased) releaseUploadSlot()
    }
  }

  async function addFiles(files: Iterable<File>): Promise<void> {
    const candidates = [...files]
    const accepted: File[] = []
    let oversized = 0
    for (const file of candidates) {
      const maxBytes = options.maxBytes?.(file) ?? MAX_ATTACHMENT_BYTES
      if (file.size > maxBytes) oversized += 1
      else accepted.push(file)
    }
    if (oversized === 1) {
      const oversizedFile = candidates.find((file) => {
        const maxBytes = options.maxBytes?.(file) ?? MAX_ATTACHMENT_BYTES
        return file.size > maxBytes
      })!
      const maxBytes = options.maxBytes?.(oversizedFile) ?? MAX_ATTACHMENT_BYTES
      options.onError?.(
        i18n.global.t('agent.attachmentTooLarge', {
          name: oversizedFile.name,
          limit: formatSize(maxBytes)
        })
      )
    } else if (oversized > 1) {
      options.onError?.(
        i18n.global.t('agent.attachmentsTooLarge', { count: oversized })
      )
    }
    const availableSlots = Math.max(0, MAX_ATTACHMENT_BATCH_SIZE - pending.size)
    const staged = accepted
      .slice(0, availableSlots)
      .map((file) => ({ file, id: stage(file.name) }))
    const omitted = accepted.length - staged.length
    if (omitted > 0)
      options.onError?.(
        i18n.global.t('agent.attachmentBatchLimit', {
          count: omitted,
          limit: MAX_ATTACHMENT_BATCH_SIZE
        })
      )
    await Promise.all(
      staged.map(async ({ id, file }) => {
        if ((await uploadStagedFile(id, file)) === 'uploaded')
          options.onUploaded?.()
      })
    )
  }

  return { addDeferredFile, addFiles, cancelUpload, cancelAllUploads }
}
