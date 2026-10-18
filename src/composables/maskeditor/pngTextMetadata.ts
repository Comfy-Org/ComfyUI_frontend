export function copyPngTextMetadata(
  source: ArrayBuffer,
  image: Blob
): Blob | null {
  if (source.byteLength === 0) return null
  const view = new DataView(source)
  if (
    source.byteLength < 8 ||
    view.getUint32(0) !== 0x89504e47 ||
    view.getUint32(4) !== 0x0d0a1a0a
  ) {
    return image
  }

  const chunks: Blob[] = []
  let offset = 8
  while (offset + 12 <= source.byteLength) {
    const length = view.getUint32(offset)
    const end = offset + length + 12
    if (end > source.byteLength) return null
    const type = String.fromCharCode(...new Uint8Array(source, offset + 4, 4))
    if (offset === 8 && (type !== 'IHDR' || length !== 13)) return null
    if (type === 'IEND') {
      if (length !== 0) return null
      return chunks.length
        ? new Blob([image.slice(0, 33), ...chunks, image.slice(33)], {
            type: image.type
          })
        : image
    }
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      chunks.push(new Blob([source.slice(offset, end)]))
    }
    offset = end
  }
  return null
}
