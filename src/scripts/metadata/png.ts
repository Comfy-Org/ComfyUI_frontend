async function decompressZlib(
  data: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new DecompressionStream('deflate')
  const writer = stream.writable.getWriter()
  writer.write(data)
  writer.close()

  const reader = stream.readable.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let totalLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    totalLength += value.length
  }

  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export async function getFromPngBuffer(
  buffer: ArrayBuffer
): Promise<Record<string, string>> {
  const pngData = new Uint8Array(buffer)
  const dataView = new DataView(pngData.buffer)

  if (dataView.getUint32(0) !== 0x89504e47) {
    console.error('Not a valid PNG file')
    return {}
  }

  let offset = 8
  const txt_chunks: Record<string, string> = {}

  while (offset < pngData.length) {
    const length = dataView.getUint32(offset)
    const type = String.fromCharCode(...pngData.slice(offset + 4, offset + 8))

    if (type === 'tEXt' || type === 'comf' || type === 'iTXt') {
      let keyword_end = offset + 8
      while (pngData[keyword_end] !== 0) {
        keyword_end++
      }
      const keyword = String.fromCharCode(
        ...pngData.slice(offset + 8, keyword_end)
      )

      let textStart = keyword_end + 1
      let isCompressed = false
      let compressionMethod = 0

      if (type === 'iTXt') {
        isCompressed = pngData[textStart] === 1
        compressionMethod = pngData[textStart + 1]
        textStart += 2

        while (pngData[textStart] !== 0 && textStart < offset + 8 + length) {
          textStart++
        }
        textStart++

        while (pngData[textStart] !== 0 && textStart < offset + 8 + length) {
          textStart++
        }
        textStart++
      }

      let contentArraySegment = pngData.slice(textStart, offset + 8 + length)

      if (isCompressed) {
        if (compressionMethod === 0) {
          try {
            contentArraySegment = await decompressZlib(contentArraySegment)
          } catch (e) {
            console.error(`Failed to decompress iTXt chunk "${keyword}":`, e)
          }
        } else {
          console.warn(
            `Unsupported compression method ${compressionMethod} for iTXt chunk "${keyword}"`
          )
        }
      }

      const contentJson = new TextDecoder('utf-8').decode(contentArraySegment)
      txt_chunks[keyword] = contentJson
    }

    offset += 12 + length
  }
  return txt_chunks
}

export async function getFromPngFile(
  file: File
): Promise<Record<string, string>> {
  return new Promise<Record<string, string>>((resolve) => {
    const reader = new FileReader()
    reader.onload = async (event) => {
      const result = await getFromPngBuffer(event.target?.result as ArrayBuffer)
      resolve(result)
    }
    reader.readAsArrayBuffer(file)
  })
}
