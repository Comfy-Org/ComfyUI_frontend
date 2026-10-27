import { TimeoutError } from 'es-toolkit/error'
import { withTimeout } from 'es-toolkit/promise'

import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { hasAudioType, hasImageType, hasVideoType } from '@/utils/eventUtils'
import { formatSize, getMediaTypeFromFilename } from '@/utils/formatUtil'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import {
  AgentApiError,
  AgentResponseUnreadableError
} from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'
import { isAgentAttachable } from '@/workbench/extensions/agent/utils/attachableFiles'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

export const MAX_TURN_ATTACHMENTS = 25
const UPLOAD_HANDSHAKE_TIMEOUT_MS = 30 * 1000
const UPLOAD_FLOOR_BYTES_PER_SECOND = 64 * 1024
const DEFERRED_FETCH_TIMEOUT_MS = 60 * 1000
const MAX_CONCURRENT_UPLOADS = 3
const MAX_TELEMETRY_FILE_TYPE_LENGTH = 128
const MIME_TYPE_PATTERN =
  /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+\/[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

interface UploadResult {
  ref: string
  url?: string
}

type UploadFileResult = 'uploaded' | 'cancelled' | 'failed'

type Admission = 'admitted' | 'duplicate' | 'too_many'

type FileStaging =
  | { file: File; outcome: 'upload'; id: string }
  | {
      file: File
      outcome: 'staged' | 'skipped' | Exclude<Admission, 'admitted'>
    }

type DeferredFileResult =
  | UploadFileResult
  | Exclude<Admission, 'admitted'>
  | 'unsupported'
  | 'fetch_failed'

export interface UseAttachmentOptions {
  upload: (file: File, signal: AbortSignal) => Promise<UploadResult>
  resolveStoredPreview?: (
    file: File,
    ref: string
  ) => Promise<string | undefined>
  validate?: (file: File) => boolean | Promise<boolean>
  uploadTimeoutMs?: number
  maxBytes?: (file: File) => number
  onError?: (message: string) => void
  onUploaded?: () => void
  onDuplicate?: (names: string[]) => void
  staged: () => readonly ComposerAttachment[]
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

let stagedCount = 0

function fileUploadKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function fileSourceKey(file: File): string {
  return `file:${JSON.stringify([file.name, file.size, file.lastModified, file.type])}`
}

async function fileContentHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function attachmentMediaKind(file: File): MediaKind {
  if (hasImageType(file) || isHdrImageFilename(file.name)) return 'image'
  if (hasVideoType(file)) return 'video'
  if (hasAudioType(file)) return 'audio'
  return getMediaTypeFromFilename(file.name)
}

function localPreview(
  file: File,
  kind: MediaKind
): Pick<ComposerAttachment, 'previewUrl' | 'mediaUrl'> {
  if (isHdrImageFilename(file.name)) return {}
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

  function stageUnsupported(
    name: string,
    sourceKey: string
  ): string | undefined {
    const id = `upload-${++stagedCount}:${name}`
    const staged = options.stage({
      id,
      name,
      ref: '',
      sourceKey,
      validationError: 'unsupported-type'
    })
    return staged ? id : undefined
  }

  function admit(sourceKey: string | undefined): Admission {
    const staged = options.staged()
    if (staged.length < MAX_TURN_ATTACHMENTS) return 'admitted'
    return sourceKey && staged.some((item) => item.sourceKey === sourceKey)
      ? 'duplicate'
      : 'too_many'
  }

  function reportAdmission(name: string, admission: Admission): void {
    if (admission === 'duplicate') options.onDuplicate?.([name])
    if (admission === 'too_many') reportTurnLimit()
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

  function uploadFailureCause(cause: unknown): string {
    if (cause instanceof AgentApiError) return `http_${cause.status}`
    if (cause instanceof AgentResponseUnreadableError)
      return 'unreadable_response'
    if (cause instanceof TimeoutError) return 'timeout'
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
    const deadline = new AbortController()
    inFlight.set(id, controller)
    const result = await withTimeout(
      () => options.upload(file, controller.signal),
      options.uploadTimeoutMs ?? uploadDeadlineMs(file),
      { signal: deadline.signal }
    )
      .catch((error: unknown) => {
        if (error instanceof TimeoutError) controller.abort()
        throw error
      })
      .finally(() => deadline.abort())
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
      void showStoredPreview(id, file, result.ref)
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

  async function showStoredPreview(
    id: string,
    file: File,
    ref: string
  ): Promise<void> {
    if (!options.resolveStoredPreview) return
    const previewUrl = await options
      .resolveStoredPreview(file, ref)
      .catch(() => undefined)
    if (previewUrl) options.update(id, { previewUrl })
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
    const deadline = new AbortController()
    inFlight.set(id, controller)
    try {
      const file = await withTimeout(
        () => resolve(controller.signal),
        DEFERRED_FETCH_TIMEOUT_MS,
        { signal: deadline.signal }
      )
        .catch((error: unknown) => {
          if (error instanceof TimeoutError) controller.abort()
          throw error
        })
        .finally(() => deadline.abort())
      if (cancelled.has(id)) return 'cancelled'
      if (!file) {
        options.remove(id)
        return 'fetch_failed'
      }
      if (!isAgentAttachable(file)) {
        options.update(id, {
          name: file.name,
          uploading: false,
          validationError: 'unsupported-type'
        })
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
    const admission = admit(sourceKey)
    if (admission !== 'admitted') {
      reportAdmission(name, admission)
      return admission
    }
    const id = stage(name, sourceKey)
    if (!id) {
      options.onDuplicate?.([name])
      return 'duplicate'
    }
    return uploadDeferredFile(id, name, resolve)
  }

  function addUnsupportedAsset(
    name: string,
    sourceKey: string
  ): Exclude<DeferredFileResult, UploadFileResult | 'fetch_failed'> {
    const admission = admit(sourceKey)
    if (admission !== 'admitted') {
      reportAdmission(name, admission)
      return admission
    }
    if (stageUnsupported(name, sourceKey)) return 'unsupported'
    options.onDuplicate?.([name])
    return 'duplicate'
  }

  function stageFile(file: File): FileStaging {
    const supported = isAgentAttachable(file)
    if (supported && isTooLarge(file)) return { file, outcome: 'skipped' }
    const sourceKey = fileSourceKey(file)
    const admission = admit(sourceKey)
    if (admission !== 'admitted') return { file, outcome: admission }
    if (!supported)
      return {
        file,
        outcome: stageUnsupported(file.name, sourceKey) ? 'staged' : 'duplicate'
      }
    const id = stage(file.name, sourceKey)
    return id ? { file, outcome: 'upload', id } : { file, outcome: 'duplicate' }
  }

  async function addFiles(files: Iterable<File>): Promise<boolean> {
    const staged = Array.from(files, stageFile)
    const duplicates = staged.flatMap(({ file, outcome }) =>
      outcome === 'duplicate' ? [file.name] : []
    )
    if (duplicates.length) options.onDuplicate?.(duplicates)
    if (staged.some(({ outcome }) => outcome === 'too_many')) reportTurnLimit()
    let uploaded = 0
    await Promise.all(
      staged.map(async (item) => {
        if (item.outcome !== 'upload') return
        if ((await uploadStagedFile(item.id, item.file)) === 'uploaded')
          uploaded += 1
      })
    )
    if (uploaded > 0) options.onUploaded?.()
    return uploaded > 0
  }

  return {
    addDeferredFile,
    addFiles,
    addUnsupportedAsset,
    cancelUpload,
    cancelAllUploads,
    forgetUploads
  }
}
