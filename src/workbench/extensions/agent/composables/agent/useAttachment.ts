import { ref } from 'vue'

import type { ComposerAttachment } from './useComposer'

// Pre-read size guard: reject before touching the file so a huge image can never OOM the
// tab (monolith parity, comfyAgent.ts:1946-2037).
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

interface UploadResult {
  // Server-facing reference the send path forwards (e.g. an uploaded LoadImage filename).
  ref: string
  // Optional local/remote preview URL for the chip thumbnail.
  url?: string
}

export interface UseAttachmentOptions {
  // Host-injected cloud upload. Standalone tests inject a fake.
  upload: (file: File) => Promise<UploadResult>
  onError?: (message: string) => void
}

/**
 * useAttachment — stage image/file attachments for the composer.
 *
 * Two parity-critical behaviors: the 20MB guard is checked BEFORE the file is read, and
 * onDrop calls preventDefault FIRST (a browser default-drop navigates away and destroys
 * the panel, a documented monolith bug) before any async work.
 */
export function useAttachment(options: UseAttachmentOptions) {
  const pending = ref(false)

  async function addFiles(
    files: Iterable<File>
  ): Promise<ComposerAttachment[]> {
    const staged: ComposerAttachment[] = []
    // pending spans the whole batch so a multi-file drop shows one steady busy state
    // instead of flickering between files.
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
          // A failed upload must not lose already-staged files, skip the rest of the batch,
          // or surface as an unhandled rejection to the drop handler's caller.
          options.onError?.(`${file.name} could not be uploaded`)
        }
      }
    } finally {
      pending.value = false
    }
    return staged
  }

  function onDrop(event: DragEvent): Promise<ComposerAttachment[]> {
    // preventDefault FIRST, before any await — a default drop navigates the tab.
    event.preventDefault()
    const files = event.dataTransfer?.files
    return files && files.length > 0
      ? addFiles(Array.from(files))
      : Promise.resolve([])
  }

  return { pending, addFiles, onDrop }
}
