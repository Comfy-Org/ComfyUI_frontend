export async function getOggMetadata(file: File) {
  // Read the entire file into memory (Opus files are generally small enough)
  const arrayBuffer = await file.arrayBuffer()
  const data = new Uint8Array(arrayBuffer)
  const decoder = new TextDecoder('utf-8')

  // Sequentially trace Ogg pages to extract segments of the 'OpusTags' packet containing metadata
  const segments = extractOpusTags(data, decoder)
  if (segments.length === 0) {
    console.error(
      'Ogg metadata parsing failed: No OpusTags found or invalid Ogg file'
    )
    return { prompt: undefined, workflow: undefined }
  }

  // Concatenate the extracted segments to reconstruct the complete OpusTags packet (binary data)
  const packetData = new Uint8Array(
    segments.reduce((sum, seg) => sum + seg.length, 0)
  )
  let currentOffset = 0
  for (const seg of segments) {
    packetData.set(seg, currentOffset)
    currentOffset += seg.length
  }

  // Parse the reconstructed packet according to the Vorbis Comments specification to extract JSON
  return parseVorbisComments(packetData, decoder)
}

function extractOpusTags(data: Uint8Array, decoder: TextDecoder): Uint8Array[] {
  const OGG_HEADER_SIZE = 27 // Base size of the Ogg page header (from magic number to just before segment count)
  const OGG_PAGE_SEGMENTS_OFFSET = 26 // Offset position where the number of segments in the page is stored
  const OGG_MAX_SEGMENT_SIZE = 255 // Ogg spec: the maximum size of a single segment is 255 bytes

  const segments: Uint8Array[] = []
  let offset = 0
  let inOpusTags = false

  while (offset + OGG_HEADER_SIZE < data.length) {
    const pageSignature = decoder.decode(data.subarray(offset, offset + 4))
    if (pageSignature !== 'OggS') break

    const pageSegmentsCount = data[offset + OGG_PAGE_SEGMENTS_OFFSET]
    const lengthsOffset = offset + OGG_HEADER_SIZE
    let dataOffset = lengthsOffset + pageSegmentsCount

    if (dataOffset > data.length) break

    let pageProcessingEnded = false

    for (let i = 0; i < pageSegmentsCount; i++) {
      const segmentLength = data[lengthsOffset + i]

      // Bounds check: ensure the segment data lies within the available data
      if (dataOffset + segmentLength > data.length) break

      const segment = data.subarray(dataOffset, dataOffset + segmentLength)
      dataOffset += segmentLength

      if (!inOpusTags) {
        const segmentMagic = decoder.decode(segment.subarray(0, 8))
        if (segmentMagic === 'OpusTags') {
          inOpusTags = true
        }
      }

      if (inOpusTags) {
        segments.push(segment)
        // Ogg lacing spec: If a segment length is less than 255 (OGG_MAX_SEGMENT_SIZE),
        // it marks the end of the current packet (data chunk)
        if (segmentLength < OGG_MAX_SEGMENT_SIZE) {
          pageProcessingEnded = true
          break
        }
      }
    }

    if (pageProcessingEnded) break
    offset = dataOffset
  }

  return segments
}

function parseVorbisComments(packetData: Uint8Array, decoder: TextDecoder) {
  let readIndex = 8 // Skip 'OpusTags' magic string (8 bytes)
  const packetView = new DataView(
    packetData.buffer,
    packetData.byteOffset,
    packetData.byteLength
  )

  // Bounds check: ensure vendor length field is within packet
  if (readIndex + 4 > packetData.length)
    return { prompt: undefined, workflow: undefined }

  // Skip vendor string length (4 bytes) + vendor string
  const vendorLength = packetView.getUint32(readIndex, true)
  readIndex += 4

  // Bounds check: ensure vendor string is within packet
  if (readIndex + vendorLength > packetData.length)
    return { prompt: undefined, workflow: undefined }
  readIndex += vendorLength

  // Bounds check: ensure user comment list length field is within packet
  if (readIndex + 4 > packetData.length)
    return { prompt: undefined, workflow: undefined }

  // Get the number of user comments
  const userCommentListLength = packetView.getUint32(readIndex, true)
  readIndex += 4

  let prompt, workflow
  for (let i = 0; i < userCommentListLength; i++) {
    // Bounds check: ensure comment length field is within packet
    if (readIndex + 4 > packetData.length) break

    // Vorbis Comments spec: Get comment length (32-bit little-endian)
    const commentLength = packetView.getUint32(readIndex, true)
    readIndex += 4

    // Bounds check: ensure comment data is within packet
    if (readIndex + commentLength > packetData.length) break

    // Extract and decode the comment string (UTF-8)
    const text = decoder.decode(
      packetData.subarray(readIndex, readIndex + commentLength)
    )
    readIndex += commentLength

    const separatorIndex = text.indexOf('=')
    if (separatorIndex !== -1) {
      const key = text.substring(0, separatorIndex)
      const value = text.substring(separatorIndex + 1)
      if (key === 'prompt') {
        try {
          prompt = JSON.parse(value)
        } catch (e) {
          console.warn('Ogg metadata parsing failed for prompt:', e)
        }
      } else if (key === 'workflow') {
        try {
          workflow = JSON.parse(value)
        } catch (e) {
          console.warn('Ogg metadata parsing failed for workflow:', e)
        }
      }
    }

    if (prompt !== undefined && workflow !== undefined) break
  }

  return { prompt, workflow }
}
