const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
}

const MIME_TO_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_TO_MIME)
    .filter(([ext]) => ext !== '.jpeg')
    .map(([ext, mime]) => [mime, ext])
)

export function getMimeType(fileName: string): string {
  const name = fileName.toLowerCase()
  const ext = name.slice(name.lastIndexOf('.'))
  return EXT_TO_MIME[ext] ?? 'application/octet-stream'
}

export function getExtension(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? ''
}
