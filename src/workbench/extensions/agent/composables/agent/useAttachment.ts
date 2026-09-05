import { i18n } from '@/i18n'
import { hasImageType } from '@/utils/eventUtils'
import type { ComposerAttachment } from './useComposer'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
const ATTACHMENT_UPLOAD_TIMEOUT_MS = 2 * 60 * 1000

interface UploadResult {
  ref: string
  url?: string
}

export interface UseAttachmentOptions {
  upload: (file: File, signal: AbortSignal) => Promise<UploadResult>
  uploadTimeoutMs?: number
  maxBytes?: (file: File) => number
  onError?: (message: string) => void
  stage: (attachment: ComposerAttachment) => void
  update: (id: string, patch: Partial<ComposerAttachment>) => void
  remove: (id: string) => void
}

let stagedCount = 0

export function useAttachment(options: UseAttachmentOptions) {
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
        limit: `${maxBytes / 1024 / 1024}MB`
      })
    )
    return true
  }

  async function uploadStagedFile(id: string, file: File): Promise<boolean> {
    options.update(id, {
      name: file.name,
      previewUrl: hasImageType(file) ? URL.createObjectURL(file) : undefined
    })
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const timedOut = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort()
          reject(new Error('Attachment upload timed out'))
        }, options.uploadTimeoutMs ?? ATTACHMENT_UPLOAD_TIMEOUT_MS)
      })
      const result = await Promise.race([
        options.upload(file, controller.signal),
        timedOut
      ])
      options.update(id, { ref: result.ref, uploading: false })
      return true
    } catch {
      options.onError?.(
        i18n.global.t('agent.attachmentUploadFailed', { name: file.name })
      )
      options.remove(id)
      return false
    } finally {
      clearTimeout(timeout)
    }
  }

  async function addDeferredFile(
    name: string,
    resolve: () => Promise<File | undefined>
  ): Promise<File | undefined> {
    const id = stage(name)
    const file = await resolve()
    if (!file) {
      options.remove(id)
      return undefined
    }
    if (isTooLarge(file)) {
      options.remove(id)
      return file
    }
    await uploadStagedFile(id, file)
    return file
  }

  async function addFiles(files: Iterable<File>): Promise<void> {
    const staged = [...files]
      .filter((file) => !isTooLarge(file))
      .map((file) => ({ file, id: stage(file.name) }))
    await Promise.all(staged.map(({ id, file }) => uploadStagedFile(id, file)))
  }

  return { addDeferredFile, addFiles }
}
