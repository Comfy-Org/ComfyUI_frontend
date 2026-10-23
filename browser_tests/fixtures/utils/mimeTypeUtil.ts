const MIME_TYPES_BY_EXTENSION = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['svg', 'image/svg+xml'],
  ['avif', 'image/avif'],
  ['webm', 'video/webm'],
  ['mp4', 'video/mp4'],
  ['mp3', 'audio/mpeg'],
  ['wav', 'audio/wav'],
  ['flac', 'audio/flac'],
  ['ogg', 'audio/ogg'],
  ['opus', 'audio/ogg'],
  ['csv', 'text/csv'],
  ['json', 'application/json'],
  ['glb', 'model/gltf-binary']
])

export function getMimeType(fileName: string): string {
  const name = fileName.toLowerCase()
  const dot = name.lastIndexOf('.')
  const extension = dot === -1 ? '' : name.slice(dot + 1)
  return MIME_TYPES_BY_EXTENSION.get(extension) ?? 'application/octet-stream'
}
