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
import { partitionAttachableFiles } from '../../utils/attachableFiles'
import { refusedAttachmentsMessage } from '../../utils/attachmentMessages'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

/**
 * The contract's `maxItems` on AgentPostMessageRequest.attachments.
 *
 * Capped here rather than left to the server because the server does not refuse
 * the overflow — resolveAttachmentAssets drops every reference past this many
 * with a warn log, so the file would appear attached and then silently not
 * exist for the turn. That is the failure PM-1856 is about.
 *
 * Restated as a number because Zod exposes `maxItems` only through internals;
 * useAttachment.test.ts pins it against zAgentPostMessageRequest itself, so a
 * change to the spec fails there rather than drifting unnoticed.
 */
export const MAX_TURN_ATTACHMENTS = 25
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

type UploadFileResult = 'uploaded' | 'cancelled' | 'failed'

type DeferredFileResult =
  | UploadFileResult
  | 'unsupported'
  | 'duplicate'
  | 'fetch_failed'
  | 'too_many'

export interface UseAttachmentOptions {
  upload: (file: File, signal: AbortSignal) => Promise<UploadResult>
  validate?: (file: File) => boolean | Promise<boolean>
  uploadTimeoutMs?: number
  maxBytes?: (file: File) => number
  onError?: (message: string) => void
  onUploaded?: () => void
  onDuplicate?: (names: string[]) => void
  /**
   * How many attachments are already staged on the turn. Required rather than
   * optional: defaulting it to 0 would disable the count cap silently, and the
   * composer — not this composable — owns the staged list.
   */
  stagedCount: () => number
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

function fileUploadKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

async function fileContentHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
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
  const uploaded = new Map<string, Map<string, UploadResult>>()
  const contentHashes = new WeakMap<File, Promise<string>>()
  let uploadGeneration = 0
  let activeUploads = 0

  function contentHashFor(file: File): Promise<string> {
    const cached = contentHashes.get(file)
    if (cached) return cached
    const hash = fileContentHash(file)
    contentHashes.set(file, hash)
    return hash
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

  function reportTurnLimit(): void {
    options.onError?.(
      i18n.global.t('agent.attachmentCountExceeded', {
        count: MAX_TURN_ATTACHMENTS
      })
    )
  }

  function failAttachment(
    id: string,
    file: { name: string; size?: number; type?: string },
    errorType: string,
    cause: unknown,
    notify = true
  ) {
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
          project_context: 'agent_composer',
          upload_failure_cause: uploadFailureCause(cause),
          file_type: telemetryFileType(file.type),
          file_size_bytes: file.size ?? -1
        }
      })
      if (notify)
        options.onError?.(
          i18n.global.t('agent.attachmentUploadFailed', { name: file.name })
        )
      options.remove(id)
      return undefined
    }
  }

  async function resolveUpload(id: string, file: File): Promise<UploadResult> {
    const key = fileUploadKey(file)
    const contentHash = contentHashFor(file)
    if (uploaded.has(key)) {
      const hash = await contentHash
      const cachedResult = uploaded.get(key)?.get(hash)
      if (cancelled.has(id)) throw new DOMException('Aborted', 'AbortError')
      if (cachedResult) return cachedResult
    }

    const generation = uploadGeneration
    const controller = new AbortController()
    inFlight.set(id, controller)
    const result = await withDeadline(
      options.upload(file, controller.signal),
      options.uploadTimeoutMs ?? uploadDeadlineMs(file),
      () => controller.abort()
    )
    const hash = await contentHash
    if (cancelled.has(id)) throw new DOMException('Aborted', 'AbortError')
    if (generation === uploadGeneration) {
      const cachedResults = uploaded.get(key) ?? new Map<string, UploadResult>()
      cachedResults.set(hash, result)
      uploaded.set(key, cachedResults)
    }
    return result
  }

  function forgetUploads(): void {
    uploaded.clear()
    uploadGeneration += 1
  }

  async function uploadStagedFile(
    id: string,
    file: File
  ): Promise<UploadFileResult> {
    if (activeUploads === MAX_CONCURRENT_UPLOADS)
      await new Promise<void>((resolve) => waiting.push(resolve))
    else activeUploads += 1
    try {
      if (cancelled.has(id)) return 'cancelled'
      if (options.validate) {
        const valid = await options.validate(file)
        if (cancelled.has(id)) return 'cancelled'
        if (!valid) {
          options.update(id, {
            name: file.name,
            uploading: false,
            validationError: 'invalid-video'
          })
          return 'failed'
        }
      }
      const mediaKind = attachmentMediaKind(file)
      options.update(id, {
        name: file.name,
        mediaKind,
        ...localPreview(file, mediaKind)
      })
      const result = await resolveUpload(id, file)
      options.update(id, {
        ref: result.ref,
        ...uploadedPreview(mediaKind, result.url),
        uploading: false
      })
      return 'uploaded'
    } catch (cause) {
      if (cancelled.has(id)) return 'cancelled'
      failAttachment(id, file, 'agent_attachment_upload_failed', cause)()
      return 'failed'
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

  async function uploadDeferredFile(
    id: string,
    name: string,
    resolve: (signal: AbortSignal) => Promise<File | undefined>
  ): Promise<DeferredFileResult> {
    const controller = new AbortController()
    inFlight.set(id, controller)
    try {
      const file = await withDeadline(
        resolve(controller.signal),
        DEFERRED_FETCH_TIMEOUT_MS,
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
      const result = await uploadStagedFile(id, file)
      if (result === 'uploaded') options.onUploaded?.()
      return result
    } catch (cause) {
      if (cancelled.has(id)) return 'cancelled'
      failAttachment(
        id,
        { name },
        'agent_attachment_fetch_failed',
        cause,
        false
      )()
      return 'fetch_failed'
    } finally {
      settle(id)
    }
  }

  async function addDeferredFile(
    name: string,
    resolve: (signal: AbortSignal) => Promise<File | undefined>,
    sourceKey?: string
  ): Promise<DeferredFileResult> {
    if (options.stagedCount() >= MAX_TURN_ATTACHMENTS) {
      reportTurnLimit()
      return 'too_many'
    }
    const id = stage(name, sourceKey)
    if (!id) {
      options.onDuplicate?.([name])
      return 'duplicate'
    }
    return uploadDeferredFile(id, name, resolve)
  }

  // The one gate every upload path passes through. The paperclip, a panel drop
  // and a paste all land here, so putting the type check anywhere else is what
  // let them disagree in the first place (PM-1854): `accept` on the file input
  // is only a picker hint, and "All Files" defeats it.
  async function addFiles(files: Iterable<File>): Promise<boolean> {
    const { attachable, rejected } = partitionAttachableFiles(files)
    // One message for the whole batch: dropping a folder of unsupported files
    // would otherwise stack that many simultaneous 5-second toasts.
    if (rejected.length > 0) {
      options.onError?.(
        refusedAttachmentsMessage(rejected.map(({ name }) => name))
      )
    }

    const sized = attachable.filter((file) => !isTooLarge(file))
    const duplicates: string[] = []
    const staged = sized.flatMap((file) => {
      if (options.stagedCount() >= MAX_TURN_ATTACHMENTS) return []
      const sourceKey = `file:${JSON.stringify([file.name, file.size, file.lastModified, file.type])}`
      const id = stage(file.name, sourceKey)
      if (!id) duplicates.push(file.name)
      return id ? [{ file, id }] : []
    })
    if (duplicates.length) options.onDuplicate?.(duplicates)
    if (staged.length + duplicates.length < sized.length) reportTurnLimit()
    let uploaded = 0
    await Promise.all(
      staged.map(async ({ id, file }) => {
        if ((await uploadStagedFile(id, file)) === 'uploaded') uploaded += 1
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
