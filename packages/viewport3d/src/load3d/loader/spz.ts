const SPZ_V4_MAGIC = [0x4e, 0x47, 0x53, 0x50]

export function isSpzV4(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < SPZ_V4_MAGIC.length) return false
  const head = new Uint8Array(bytes, 0, SPZ_V4_MAGIC.length)
  return SPZ_V4_MAGIC.every((byte, index) => head[index] === byte)
}
