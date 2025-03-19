export function getFromPngBuffer(buffer: ArrayBuffer) {
  // Get the PNG data as a Uint8Array
  const pngData = new Uint8Array(buffer)
  const dataView = new DataView(pngData.buffer)

  // Check that the PNG signature is present
  if (dataView.getUint32(0) !== 0x89504e47) {
    console.error('Not a valid PNG file')
    return
  }

  // Start searching for chunks after the PNG signature
  let offset = 8
  let txt_chunks: Record<string, string> = {}
  // Loop through the chunks in the PNG file
  while (offset < pngData.length) {
    // Get the length of the chunk
    const length = dataView.getUint32(offset)
    // Get the chunk type
    const type = String.fromCharCode(...pngData.slice(offset + 4, offset + 8))
    if (type === 'tEXt' || type == 'comf' || type === 'iTXt') {
      // Get the keyword
      let keyword_end = offset + 8
      while (pngData[keyword_end] !== 0) {
        keyword_end++
      }
      const keyword = String.fromCharCode(
        ...pngData.slice(offset + 8, keyword_end)
      )
      // Get the text
      const contentArraySegment = pngData.slice(
        keyword_end + 1,
        offset + 8 + length
      )
      const contentJson = new TextDecoder('utf-8').decode(contentArraySegment)
      txt_chunks[keyword] = contentJson
    }

    offset += 12 + length
  }
  return txt_chunks
}

export function getFromPngFile(file: File) {
  return new Promise<Record<string, string>>((r) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      // @ts-expect-error fixme ts strict error
      r(getFromPngBuffer(event.target.result as ArrayBuffer))
    }

    reader.readAsArrayBuffer(file)
  })
}
