function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

function isAnimatedPng(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let offset = 8; offset + 8 <= bytes.length;) {
    const type = ascii(bytes, offset + 4, 4)
    if (type === 'acTL') return true
    if (type === 'IDAT') return false
    offset += 12 + view.getUint32(offset)
  }
  return false
}

function isAnimatedWebp(bytes: Uint8Array): boolean {
  return ascii(bytes, 12, 4) === 'VP8X' && (bytes[20] & 0x02) !== 0
}

/** Whether encoded GIF, PNG, WebP or AVIF bytes hold more than one frame. */
function isAvifSequence(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const boxEnd = Math.min(view.getUint32(0), bytes.length)
  for (let offset = 8; offset + 4 <= boxEnd; offset += 4) {
    if (offset !== 12 && ascii(bytes, offset, 4) === 'avis') return true
  }
  return false
}

export function isAnimatedImage(bytes: Uint8Array): boolean {
  if (ascii(bytes, 0, 3) === 'GIF') return true
  if (ascii(bytes, 1, 3) === 'PNG') return isAnimatedPng(bytes)
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP')
    return isAnimatedWebp(bytes)
  if (ascii(bytes, 4, 4) === 'ftyp') return isAvifSequence(bytes)
  return false
}
