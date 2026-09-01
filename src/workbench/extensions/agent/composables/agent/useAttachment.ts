import { i18n } from '@/i18n'
import { api } from '@/scripts/api'
import { hasImageType, hasVideoType } from '@/utils/eventUtils'
import type { ComposerAttachment } from './useComposer'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
export const MAX_VIDEO_ATTACHMENT_BYTES = 200 * 1024 * 1024

interface UploadResult {
  ref: string
  url?: string
}

export interface UseAttachmentOptions {
  upload: (file: File) => Promise<UploadResult>
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
    const serverLimit = api.getServerFeature<number>(
      'max_upload_size',
      MAX_VIDEO_ATTACHMENT_BYTES
    )
    const maxBytes =
      options.maxBytes?.(file) ??
      Math.min(
        serverLimit,
        hasVideoType(file) ? MAX_VIDEO_ATTACHMENT_BYTES : MAX_ATTACHMENT_BYTES
      )
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
    try {
      const result = await options.upload(file)
      options.update(id, { ref: result.ref, uploading: false })
      return true
    } catch {
      options.onError?.(
        i18n.global.t('agent.attachmentUploadFailed', { name: file.name })
      )
      options.remove(id)
      return false
    }
  }

  async function addDeferredFile(
    name: string,
    resolve: () => Promise<File | undefined>
  ): Promise<File | undefined> {
    const id = stage(name)
    let file: File | undefined
    try {
      file = await resolve()
    } catch {
      options.remove(id)
      options.onError?.(i18n.global.t('agent.attachmentUploadFailed', { name }))
      return undefined
    }
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
