export async function extractFilesFromDragEvent(
  event: DragEvent
): Promise<File[]> {
  if (!event.dataTransfer) return []

  // Prefer a same-page resource URL when one is present. Browsers can
  // synthesize a lossy, re-encoded copy of an in-page <img> element (with no
  // original metadata, and not necessarily a stable/filterable MIME type)
  // into dataTransfer.files when dragging directly from e.g. the asset
  // gallery, even though the genuine resource URL is also available via
  // text/uri-list. Fetching that URL gets the real file.
  const validTypes = ['text/uri-list', 'text/x-moz-url']
  const match = [...event.dataTransfer.types].find((t) =>
    validTypes.includes(t)
  )
  if (match) {
    const uri = event.dataTransfer.getData(match)?.split('\n')?.[0]
    if (uri) {
      try {
        const response = await fetch(uri)
        if (response.ok) {
          const blob = await response.blob()
          return [new File([blob], uri, { type: blob.type })]
        }
      } catch {
        // Fall through to dataTransfer.files below
      }
    }
  }

  // Genuine OS-level file drags don't populate a URI list at all, so this is
  // also the fallback used when there's no URL, or fetching it failed.
  // Dragging from Chrome->Firefox there is a file but its a bmp, so ignore that
  return Array.from(event.dataTransfer.files).filter(
    (file) => file.type !== 'image/bmp'
  )
}

export function hasImageType({ type }: File): boolean {
  return type.startsWith('image')
}

export function hasAudioType({ type }: File): boolean {
  return type.startsWith('audio')
}

export function hasVideoType({ type }: File): boolean {
  return type.startsWith('video')
}

export function isMediaFile(file: File): boolean {
  return hasImageType(file) || hasAudioType(file) || hasVideoType(file)
}
