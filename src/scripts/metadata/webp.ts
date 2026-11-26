function parseExifData(exifData: Uint8Array) {
  const isLittleEndian = String.fromCharCode(...exifData.slice(0, 2)) === 'II'

  function readInt(
    offset: number,
    isLittleEndian: boolean,
    length: 2 | 4
  ): number {
    const arr = exifData.slice(offset, offset + length)
    const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength)
    return length === 2
      ? view.getUint16(0, isLittleEndian)
      : view.getUint32(0, isLittleEndian)
  }

  const ifdOffset = readInt(4, isLittleEndian, 4)

  function parseIFD(offset: number): Record<number, string | undefined> {
    const numEntries = readInt(offset, isLittleEndian, 2)
    const result: Record<number, string | undefined> = {}

    for (let i = 0; i < numEntries; i++) {
      const entryOffset = offset + 2 + i * 12
      const tag = readInt(entryOffset, isLittleEndian, 2)
      const type = readInt(entryOffset + 2, isLittleEndian, 2)
      const numValues = readInt(entryOffset + 4, isLittleEndian, 4)
      const valueOffset = readInt(entryOffset + 8, isLittleEndian, 4)

      let value
      if (type === 2) {
        value = new TextDecoder('utf-8').decode(
          exifData.subarray(valueOffset, valueOffset + numValues - 1)
        )
      }

      result[tag] = value
    }

    return result
  }

  const ifdData = parseIFD(ifdOffset)
  return ifdData
}

export function getFromWebpFile(file: File) {
  return file
    .arrayBuffer()
    .then((buffer): Record<string, string> => {
      const webp = new Uint8Array(buffer)
      const dataView = new DataView(webp.buffer)

      if (
        dataView.getUint32(0) !== 0x52494646 ||
        dataView.getUint32(8) !== 0x57454250
      ) {
        console.error('Not a valid WEBP file')
        return {}
      }

      let offset = 12
      const txt_chunks: Record<string, string> = {}
      while (offset < webp.length) {
        const chunk_length = dataView.getUint32(offset + 4, true)
        const chunk_type = String.fromCharCode(
          ...webp.slice(offset, offset + 4)
        )
        if (chunk_type === 'EXIF') {
          let exifOffset = offset + 8
          let exifLength = chunk_length
          if (
            String.fromCharCode(...webp.slice(exifOffset, exifOffset + 6)) ==
            'Exif\0\0'
          ) {
            exifOffset += 6
            exifLength -= 6
          }
          const data = parseExifData(
            webp.slice(exifOffset, exifOffset + exifLength)
          )
          for (const key in data) {
            const value = data[Number(key)]
            if (typeof value === 'string') {
              const index = value.indexOf(':')
              txt_chunks[value.slice(0, index)] = value.slice(index + 1)
            }
          }
          break
        }

        offset += 8 + chunk_length + (chunk_length % 2)
      }

      return txt_chunks
    })
    .catch((): Record<string, string> => ({}))
}
