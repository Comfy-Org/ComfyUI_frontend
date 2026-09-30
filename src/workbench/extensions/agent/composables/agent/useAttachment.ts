import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { hasImageType } from '@/utils/eventUtils'
import { formatSize } from '@/utils/formatUtil'
import {
  agentAttachCapability,
  partitionAttachableFiles
} from '../../utils/attachableFiles'
import { refusedAttachmentsMessage } from '../../utils/attachmentMessages'
import type { ComposerAttachment } from './useComposer'

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
  /**
   * How many attachments are already staged on the turn. Required rather than
   * optional: defaulting it to 0 would disable the count cap silently, and the
   * composer — not this composable — owns the staged list.
   */
  stagedCount: () => number
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

type DeferredOutcome =
  | 'uploaded'
  | 'unsupported'
  | 'cancelled'
  | 'failed'
  | 'fetch_failed'

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
    options.stage({
      id,
      name,
      ref: '',
      uploading: true,
      capability: agentAttachCapability(name) ?? 'unknown'
    })
    return id
  }

  function reportTurnLimit(): void {
    options.onError?.(
      i18n.global.t('agent.attachmentCountExceeded', {
        count: MAX_TURN_ATTACHMENTS
      })
    )
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
    notify = true
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
          project_context: 'agent_composer'
        }
      })
      if (notify)
        options.onError?.(
          i18n.global.t('agent.attachmentUploadFailed', { name })
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
      options.update(id, {
        name: file.name,
        previewUrl: hasImageType(file) ? URL.createObjectURL(file) : undefined
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
    resolve: (signal: AbortSignal) => Promise<File | undefined>
  ): Promise<DeferredOutcome | 'too_many'> {
    if (options.stagedCount() >= MAX_TURN_ATTACHMENTS) {
      reportTurnLimit()
      return 'too_many'
    }
    return stageDeferredFile(name, resolve)
  }

  async function stageDeferredFile(
    name: string,
    resolve: (signal: AbortSignal) => Promise<File | undefined>
  ): Promise<DeferredOutcome> {
    const id = stage(name)
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
      options.update(id, {
        name: file.name,
        capability: agentAttachCapability(file.name) ?? 'unknown'
      })
      if (isTooLarge(file)) {
        options.remove(id)
        return 'failed'
      }
      if (!(await uploadStagedFile(id, file))) return 'failed'
      options.onUploaded?.()
      return 'uploaded'
    } catch {
      if (cancelled.has(id)) return 'cancelled'
      failAttachment(id, name, 'agent_attachment_fetch_failed', false)()
      return 'fetch_failed'
    } finally {
      settle(id)
    }
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

    const room = Math.max(0, MAX_TURN_ATTACHMENTS - options.stagedCount())
    if (attachable.length > room) reportTurnLimit()

    const staged = attachable
      .slice(0, room)
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

  return { addDeferredFile, addFiles, cancelUpload, cancelAllUploads }
}
