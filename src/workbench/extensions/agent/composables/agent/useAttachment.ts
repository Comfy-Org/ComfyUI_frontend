import { ref } from 'vue'

import type { ComposerAttachment } from './useComposer'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

interface UploadResult {
  ref: string
  url?: string
}

export interface UseAttachmentOptions {
  upload: (file: File) => Promise<UploadResult>
  onError?: (message: string) => void
}

export function useAttachment(options: UseAttachmentOptions) {
  const pending = ref(false)

  async function addFiles(
    files: Iterable<File>
  ): Promise<ComposerAttachment[]> {
    const staged: ComposerAttachment[] = []
    pending.value = true
    try {
      for (const file of files) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          options.onError?.(`${file.name} is larger than 20MB`)
          continue
        }
        try {
          const result = await options.upload(file)
          staged.push({
            id: `${result.ref}:${file.name}`,
            name: file.name,
            ref: result.ref,
            previewUrl: result.url
          })
        } catch {
          options.onError?.(`${file.name} could not be uploaded`)
        }
      }
    } finally {
      pending.value = false
    }
    return staged
  }

  function onDrop(event: DragEvent): Promise<ComposerAttachment[]> {
    // preventDefault before any await — a default drop navigates the tab away.
    event.preventDefault()
    const files = event.dataTransfer?.files
    return files && files.length > 0
      ? addFiles(Array.from(files))
      : Promise.resolve([])
  }

  return { pending, addFiles, onDrop }
}
