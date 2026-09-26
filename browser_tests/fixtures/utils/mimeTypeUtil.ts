// Extension → media type, as a browser would set it on a dragged file. A table
// rather than an `if` chain: the chain's cognitive complexity grew with every
// entry and crossed the analyzer's threshold, and a lookup is flat no matter
// how many types the harness learns about.
const MIME_TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  webm: 'video/webm',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  csv: 'text/csv',
  json: 'application/json',
  glb: 'model/gltf-binary'
}

export function getMimeType(fileName: string): string {
  const name = fileName.toLowerCase()
  // A name with no dot has no extension; `split('.').pop()` would hand back
  // the whole name and match a bare `png` the old suffix test rejected.
  const dot = name.lastIndexOf('.')
  const extension = dot === -1 ? '' : name.slice(dot + 1)
  return (
    // `hasOwn`, not a bare index: a file named `constructor.x` would otherwise
    // resolve to something off `Object.prototype`.
    (Object.hasOwn(MIME_TYPES_BY_EXTENSION, extension)
      ? MIME_TYPES_BY_EXTENSION[extension]
      : undefined) ?? 'application/octet-stream'
  )
}
