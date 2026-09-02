const HDR_EXTENSIONS = ['.exr', '.hdr'] as const

export function isHdrImageFilename(filename: string | undefined): boolean {
  if (!filename) return false
  const lower = filename.toLowerCase()
  return HDR_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function getImageFilenameFromUrl(url: string): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url, window.location.origin)
    return (
      parsed.searchParams.get('filename') ??
      parsed.pathname.split('/').pop() ??
      undefined
    )
  } catch {
    return url.split('/').pop()
  }
}

export function isHdrImageUrl(url: string | undefined): boolean {
  if (!url) return false
  return isHdrImageFilename(getImageFilenameFromUrl(url))
}

export function toFullResolutionUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin)
    parsed.searchParams.delete('preview')
    return url.startsWith('http')
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}
