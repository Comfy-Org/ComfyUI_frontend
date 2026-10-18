const TEXT_CHUNKS = new Set(['tEXt', 'zTXt', 'iTXt'])
const PNG_HEADER_SIZE = 33

function isPng(view: DataView): boolean {
  return (
    view.byteLength >= 8 &&
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a
  )
}

function readTextChunks(source: ArrayBuffer, view: DataView): Blob[] | null {
  if (
    view.byteLength < PNG_HEADER_SIZE ||
    view.getUint32(8) !== 13 ||
    view.getUint32(12) !== 0x49484452
  )
    return null
  const chunks: Blob[] = []
  let offset = PNG_HEADER_SIZE
  while (offset + 12 <= source.byteLength) {
    const length = view.getUint32(offset)
    const end = offset + length + 12
    if (end > source.byteLength) return null
    const type = String.fromCharCode(...new Uint8Array(source, offset + 4, 4))
    if (type === 'IEND') return length === 0 ? chunks : null
    if (TEXT_CHUNKS.has(type))
      chunks.push(new Blob([source.slice(offset, end)]))
    offset = end
  }
  return null
}

export function copyPngTextMetadata(
  source: ArrayBuffer,
  image: Blob
): Blob | null {
  if (source.byteLength === 0) return null
  const view = new DataView(source)
  if (!isPng(view)) return image
  const chunks = readTextChunks(source, view)
  if (!chunks) return null
  if (!chunks.length) return image
  return new Blob(
    [image.slice(0, PNG_HEADER_SIZE), ...chunks, image.slice(PNG_HEADER_SIZE)],
    { type: image.type }
  )
}
