import { i18n } from '@/i18n'
import { hasImageType } from '@/utils/eventUtils'
import type { ComposerAttachment } from './useComposer'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
const MAX_ATTACHMENT_LABEL = `${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB`

interface UploadResult {
  ref: string
  url?: string
}

export interface UseAttachmentOptions {
  upload: (file: File) => Promise<UploadResult>
  onError?: (message: string) => void
  stage: (attachment: ComposerAttachment) => void
  update: (id: string, patch: Partial<ComposerAttachment>) => void
  remove: (id: string) => void
}

let stagedCount = 0

export function useAttachment(options: UseAttachmentOptions) {
  async function addFiles(files: Iterable<File>): Promise<void> {
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        options.onError?.(
          i18n.global.t('agent.attachmentTooLarge', {
            name: file.name,
            limit: MAX_ATTACHMENT_LABEL
          })
        )
        continue
      }
      const id = `upload-${++stagedCount}:${file.name}`
      options.stage({
        id,
        name: file.name,
        ref: '',
        // Only images can be shown in an <img>; anything else falls back to the
        // icon tile rather than rendering a broken thumbnail.
        previewUrl: hasImageType(file) ? URL.createObjectURL(file) : undefined,
        uploading: true
      })
      try {
        const result = await options.upload(file)
        options.update(id, { ref: result.ref, uploading: false })
      } catch {
        options.onError?.(
          i18n.global.t('agent.attachmentUploadFailed', { name: file.name })
        )
        options.remove(id)
      }
    }
  }

  return { addFiles }
}
