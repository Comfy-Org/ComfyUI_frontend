import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { hasAudioType, hasImageType, hasVideoType } from '@/utils/eventUtils'
import { formatSize, getMediaTypeFromFilename } from '@/utils/formatUtil'
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import {
  AgentApiError,
  AgentResponseUnreadableError
} from '../../services/agent/agentRestClient'
import type { ComposerAttachment } from '../../types/composerAttachment'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
const UPLOAD_HANDSHAKE_TIMEOUT_MS = 30 * 1000
const UPLOAD_FLOOR_BYTES_PER_SECOND = 64 * 1024
const DEFERRED_FETCH_TIMEOUT_MS = 60 * 1000
const MAX_CONCURRENT_UPLOADS = 3
const MAX_TELEMETRY_FILE_TYPE_LENGTH = 128
const MIME_TYPE_PATTERN =
  /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+\/[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

class DeadlineExceededError extends Error {
  constructor(timeoutMs: number) {
    super(`Timed out after ${timeoutMs}ms`)
    this.name = 'DeadlineExceededError'
  }
}

interface UploadResult {
  ref: string
  url?: string
}

type DeferredFileResult =
  | 'uploaded'
  | 'unsupported'
  | 'cancelled'
  | 'failed'
  | 'duplicate'

export interface UseAttachmentOptions {
  upload: (file: File, signal: AbortSignal) => Promise<UploadResult>
  uploadTimeoutMs?: number
  maxBytes?: (file: File) => number
  onError?: (message: string) => void
  onUploaded?: () => void
  onDuplicate?: (names: string[]) => void
  stage: (attachment: ComposerAttachment) => boolean
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

function telemetryFileType(type: string | undefined): string {
  if (!type || type.length > MAX_TELEMETRY_FILE_TYPE_LENGTH) return 'unknown'
  return MIME_TYPE_PATTERN.test(type) ? type : 'unknown'
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
      reject(new DeadlineExceededError(timeoutMs))
    }, timeoutMs)
  })
  try {
    return await Promise.race([work, expiry])
  } finally {
    clearTimeout(timer)
  }
}

let stagedCount = 0
let fileSourceCount = 0
const fileSourceKeys = new WeakMap<File, string>()
const fileFingerprintKeys = new WeakMap<File, Promise<string>>()
const resolvedFileFingerprintKeys = new WeakMap<File, string>()

function fileMetadataKey(file: File): string {
  return JSON.stringify([file.name, file.size, file.lastModified, file.type])
}

async function fingerprintFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const contentHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
  return `file:${JSON.stringify([
    file.name,
    file.size,
    file.lastModified,
    file.type,
    contentHash
  ])}`
}

function attachmentMediaKind(file: File): MediaKind {
  if (hasImageType(file)) return 'image'
  if (hasVideoType(file)) return 'video'
  if (hasAudioType(file)) return 'audio'
  return getMediaTypeFromFilename(file.name)
}

function localPreview(
  file: File,
  kind: MediaKind
): Pick<ComposerAttachment, 'previewUrl' | 'mediaUrl'> {
  const playable = kind === 'video' || kind === 'audio'
  const url =
    kind === 'image' || playable ? URL.createObjectURL(file) : undefined
  return {
    previewUrl: kind === 'image' ? url : undefined,
    mediaUrl: playable ? url : undefined
  }
}

function uploadedPreview(
  kind: MediaKind,
  url?: string
): Partial<ComposerAttachment> {
  if (!url) return {}
  if (kind === 'audio' || kind === 'video') return { mediaUrl: url }
  if (kind === 'image') return { previewUrl: url }
  return {}
}

export function useAttachment(options: UseAttachmentOptions) {
  const pending = new Set<string>()
  const inFlight = new Map<string, AbortController>()
  const cancelled = new Set<string>()
  const waiting: Array<() => void> = []
  const metadataFingerprints = new Map<string, Promise<string>>()
  const seenSourceFiles = new WeakSet<File>()
  let acceptingFiles = true
  let activeUploads = 0

  function fileSourceKey(file: File): string {
    const existing = fileSourceKeys.get(file)
    if (existing) return existing
    const sourceKey = `file:${++fileSourceCount}`
    fileSourceKeys.set(file, sourceKey)
    return sourceKey
  }

  function fileFingerprintKey(file: File): Promise<string> {
    const existing = fileFingerprintKeys.get(file)
    if (existing) return existing
    const sourceKey = fingerprintFile(file).then((key) => {
      resolvedFileFingerprintKeys.set(file, key)
      return key
    })
    fileFingerprintKeys.set(file, sourceKey)
    return sourceKey
  }

  function stage(name: string, sourceKey?: string): string | undefined {
    const id = `upload-${++stagedCount}:${name}`
    if (!options.stage({ id, name, ref: '', uploading: true, sourceKey }))
      return undefined
    pending.add(id)
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

  // The file's declared size/type and the failure's shape (status code,
  // timeout, abort) are safe, bounded context. The caught error's own
  // message/stack are not reported: they can carry a local file path (e.g. a
  // dropped file's full source path), which is why this always reports a
  // fresh synthetic Error rather than the original cause.
  function uploadFailureCause(cause: unknown): string {
    if (cause instanceof AgentApiError) return `http_${cause.status}`
    if (cause instanceof AgentResponseUnreadableError)
      return 'unreadable_response'
    if (cause instanceof DeadlineExceededError) return 'timeout'
    if (cause instanceof DOMException && cause.name === 'AbortError')
      return 'aborted'
    return 'unknown'
  }

  function failAttachment(
    id: string,
    file: { name: string; size?: number; type?: string },
    errorType: string,
    cause: unknown
  ) {
    return (): undefined => {
      reportError(new Error('Agent attachment upload failed'), {
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
          upload_failure_cause: uploadFailureCause(cause),
          file_type: telemetryFileType(file.type),
          file_size_bytes: file.size ?? -1
        }
      })
      options.onError?.(
        i18n.global.t('agent.attachmentUploadFailed', { name: file.name })
      )
      options.remove(id)
      return undefined
    }
  }

  async function uploadStagedFile(id: string, file: File): Promise<boolean> {
    if (activeUploads === MAX_CONCURRENT_UPLOADS)
      await new Promise<void>((resolve) => waiting.push(resolve))
    else activeUploads += 1
    try {
      if (cancelled.has(id)) return false
      const mediaKind = attachmentMediaKind(file)
      options.update(id, {
        name: file.name,
        mediaKind,
        ...localPreview(file, mediaKind)
      })
      const controller = new AbortController()
      inFlight.set(id, controller)
      const result = await withDeadline(
        options.upload(file, controller.signal),
        options.uploadTimeoutMs ?? uploadDeadlineMs(file),
        () => controller.abort()
      )
      options.update(id, {
        ref: result.ref,
        ...uploadedPreview(mediaKind, result.url),
        uploading: false
      })
      return true
    } catch (cause) {
      if (!cancelled.has(id))
        failAttachment(id, file, 'agent_attachment_upload_failed', cause)()
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
    acceptingFiles = false
    for (const id of Array.from(pending)) cancelUpload(id)
  }

  async function uploadDeferredFile(
    id: string,
    name: string,
    resolve: () => Promise<File | undefined>
  ): Promise<DeferredFileResult> {
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
    } catch (cause) {
      if (cancelled.has(id)) return 'cancelled'
      failAttachment(id, { name }, 'agent_attachment_fetch_failed', cause)()
      return 'failed'
    } finally {
      settle(id)
    }
  }

  async function addDeferredFile(
    name: string,
    resolve: () => Promise<File | undefined>,
    sourceKey?: string
  ): Promise<DeferredFileResult> {
    const id = stage(name, sourceKey)
    if (!id) {
      options.onDuplicate?.([name])
      return 'duplicate'
    }
    return uploadDeferredFile(id, name, resolve)
  }

  async function addFiles(files: Iterable<File>): Promise<boolean> {
    const duplicates: string[] = []
    const candidates = [...files].filter((file) => !isTooLarge(file))
    const staged: Array<{
      file: File
      fingerprint: Promise<string>
      id?: string
      priorFingerprint?: Promise<string>
    }> = []
    for (const file of candidates) {
      const metadataKey = fileMetadataKey(file)
      const priorFingerprint = metadataFingerprints.get(metadataKey)
      const fingerprint = fileFingerprintKey(file)
      const knownSourceFile = seenSourceFiles.has(file)
      seenSourceFiles.add(file)
      if (priorFingerprint && !knownSourceFile) {
        staged.push({ file, fingerprint, priorFingerprint })
        continue
      }

      const id = stage(
        file.name,
        resolvedFileFingerprintKeys.get(file) ?? fileSourceKey(file)
      )
      if (!id) {
        duplicates.push(file.name)
        continue
      }
      if (!priorFingerprint) {
        metadataFingerprints.set(
          metadataKey,
          fingerprint.then((sourceKey) => {
            options.update(id, { sourceKey })
            return sourceKey
          })
        )
      } else {
        void fingerprint.then((sourceKey) => {
          options.update(id, { sourceKey })
        })
      }
      staged.push({ file, id, fingerprint, priorFingerprint })
    }
    if (duplicates.length) options.onDuplicate?.(duplicates)
    const fingerprintDuplicates: string[] = []
    let uploaded = 0
    await Promise.all(
      staged.map(async ({ id, file, fingerprint, priorFingerprint }) => {
        if (id) {
          const upload = uploadStagedFile(id, file)
          await fingerprint.catch(() => undefined)
          if (await upload) uploaded += 1
          return
        }
        let sourceKey: string
        try {
          await priorFingerprint
          sourceKey = await fingerprint
        } catch {
          if (!acceptingFiles) return
          const fallbackId = stage(file.name, fileSourceKey(file))
          if (fallbackId && (await uploadStagedFile(fallbackId, file)))
            uploaded += 1
          return
        }
        if (!acceptingFiles) return
        const finalId = stage(file.name, sourceKey)
        if (!finalId) {
          fingerprintDuplicates.push(file.name)
          return
        }
        if (await uploadStagedFile(finalId, file)) uploaded += 1
      })
    )
    if (fingerprintDuplicates.length)
      options.onDuplicate?.(fingerprintDuplicates)
    if (uploaded > 0) options.onUploaded?.()
    return uploaded > 0
  }

  return { addDeferredFile, addFiles, cancelUpload, cancelAllUploads }
}
