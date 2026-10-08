import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { hasImageType } from '@/utils/eventUtils'
import { formatSize } from '@/utils/formatUtil'
import type { ComposerAttachment } from './useComposer'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
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

let stagedCount = 0

// A file's (name, size, last-modified) triple is a cheap, no-dependency stand-in
// for a content hash: a real content change almost always touches one of the
// three, and collisions only let an already-uploaded result be reused, never
// block a genuinely new upload. Scoped to one useAttachment instance's
// lifetime, not persisted, so this only catches the common case (the same
// file re-attached across messages in one session) and never claims to be a
// cross-session or cross-user content dedup.
function fileUploadKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

export function useAttachment(options: UseAttachmentOptions) {
  const pending = new Set<string>()
  const inFlight = new Map<string, AbortController>()
  const cancelled = new Set<string>()
  const waiting: Array<() => void> = []
  const uploaded = new Map<string, UploadResult>()
  let uploadGeneration = 0
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

  function failAttachment(id: string, name: string, errorType: string) {
    return (): undefined => {
      reportError(new Error('Agent attachment upload failed'), {
        surface: 'agent',
        errorType,
        tags: {
          failure_kind: 'caught_unexpected',
          feature_area: 'agent',
          operation: 'save',
          outcome: 'failed',
          integration_target: 'assets',
          feature_flag: 'agent_panel',
          feature_flag_state: 'enabled',
          project_context: 'agent_composer'
        }
      })
      options.onError?.(i18n.global.t('agent.attachmentUploadFailed', { name }))
      options.remove(id)
      return undefined
    }
  }

  async function resolveUpload(id: string, file: File): Promise<UploadResult> {
    const key = fileUploadKey(file)
    const cached = uploaded.get(key)
    if (cached) return cached

    const generation = uploadGeneration
    const controller = new AbortController()
    inFlight.set(id, controller)
    const result = await withDeadline(
      options.upload(file, controller.signal),
      options.uploadTimeoutMs ?? uploadDeadlineMs(file),
      () => controller.abort()
    )
    if (generation === uploadGeneration) uploaded.set(key, result)
    return result
  }

  function forgetUploads(): void {
    uploaded.clear()
    uploadGeneration += 1
  }

  async function uploadStagedFile(id: string, file: File): Promise<boolean> {
    if (activeUploads === MAX_CONCURRENT_UPLOADS)
      await new Promise<void>((resolve) => waiting.push(resolve))
    else activeUploads += 1
    try {
      if (cancelled.has(id)) return false
      options.update(id, {
        name: file.name,
        previewUrl: hasImageType(file) ? URL.createObjectURL(file) : undefined
      })
      const result = await resolveUpload(id, file)
      options.update(id, {
        ref: result.ref,
        ...(result.url ? { previewUrl: result.url } : {}),
        uploading: false
      })
      return true
    } catch {
      if (!cancelled.has(id))
        failAttachment(id, file.name, 'agent_attachment_upload_failed')()
      return false
    } finally {
      settle(id)
      const next = waiting.shift()
      if (next) next()
      else activeUploads -= 1
    }
  }

  function cancelUpload(id: string): void {
    if (!pending.has(id)) return
    cancelled.add(id)
    options.remove(id)
    inFlight.get(id)?.abort()
  }

  function cancelAllUploads(): void {
    for (const id of Array.from(pending)) cancelUpload(id)
  }

  async function addDeferredFile(
    name: string,
    resolve: () => Promise<File | undefined>
  ): Promise<'uploaded' | 'unsupported' | 'cancelled' | 'failed'> {
    const id = stage(name)
    try {
      const file = await withDeadline(resolve(), DEFERRED_FETCH_TIMEOUT_MS)
      if (cancelled.has(id)) return 'cancelled'
      if (!file) {
        options.remove(id)
        return 'unsupported'
      }
      if (isTooLarge(file)) {
        options.remove(id)
        return 'failed'
      }
      if (!(await uploadStagedFile(id, file))) return 'failed'
      options.onUploaded?.()
      return 'uploaded'
    } catch {
      if (cancelled.has(id)) return 'cancelled'
      failAttachment(id, name, 'agent_attachment_fetch_failed')()
      return 'failed'
    } finally {
      settle(id)
    }
  }

  async function addFiles(files: Iterable<File>): Promise<boolean> {
    const staged = [...files]
      .filter((file) => !isTooLarge(file))
      .map((file) => ({ file, id: stage(file.name) }))
    let uploaded = 0
    await Promise.all(
      staged.map(async ({ id, file }) => {
        if (await uploadStagedFile(id, file)) uploaded += 1
      })
    )
    if (uploaded > 0) options.onUploaded?.()
    return uploaded > 0
  }

  return {
    addDeferredFile,
    addFiles,
    cancelUpload,
    cancelAllUploads,
    forgetUploads
  }
}
