import type { ComposerAttachment } from './useComposer'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

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
  // Each file stages an uploading chip immediately (local object-URL preview),
  // then settles in place: the upload's ref on success, removal + error on failure.
  async function addFiles(files: Iterable<File>): Promise<void> {
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        options.onError?.(`${file.name} is larger than 20MB`)
        continue
      }
      const id = `upload-${++stagedCount}:${file.name}`
      options.stage({
        id,
        name: file.name,
        ref: '',
        previewUrl: URL.createObjectURL(file),
        uploading: true
      })
      try {
        const result = await options.upload(file)
        options.update(id, { ref: result.ref, uploading: false })
      } catch {
        options.onError?.(`${file.name} could not be uploaded`)
        options.remove(id)
      }
    }
  }

  function onDrop(event: DragEvent): Promise<void> {
    // preventDefault before any await — a default drop navigates the tab away.
    event.preventDefault()
    const files = event.dataTransfer?.files
    return files && files.length > 0
      ? addFiles(Array.from(files))
      : Promise.resolve()
  }

  return { addFiles, onDrop }
}
