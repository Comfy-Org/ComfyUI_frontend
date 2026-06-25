/**
 * Best-effort filename extraction from a dragged resource URL. Prefers
 * ComfyUI's own `?filename=` query convention (used by /api/view and /view),
 * falling back to the last path segment for other URLs.
 */
function extractFilenameFromUri(uri: string): string {
  try {
    const url = new URL(uri)
    const queryFilename = url.searchParams.get('filename')
    if (queryFilename) return queryFilename

    const lastSegment = url.pathname.split('/').filter(Boolean).pop()
    return lastSegment || 'file'
  } catch {
    return uri.split('/').pop() || 'file'
  }
}

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
    // text/uri-list (RFC 2483) may contain multiple lines, where lines
    // starting with '#' are comments and must be skipped - otherwise a
    // leading comment line (e.g. one starting with '#') would resolve as a
    // same-page fragment URL and be fetched instead of the real URI.
    const uri = event.dataTransfer
      .getData(match)
      ?.split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#'))
    if (uri) {
      try {
        const response = await fetch(uri)
        if (response.ok) {
          const blob = await response.blob()
          return [
            new File([blob], extractFilenameFromUri(uri), { type: blob.type })
          ]
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
