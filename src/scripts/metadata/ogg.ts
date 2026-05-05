import type { ComfyMetadata } from '@/types/metadataTypes'

const OGG_HEADER_SIZE = 27 // Base size of the Ogg page header (from magic number to just before segment count)
const OGG_PAGE_SEGMENTS_OFFSET = 26 // Offset position where the number of segments in the page is stored
const OGG_MAX_SEGMENT_SIZE = 255 // Ogg spec: the maximum size of a single segment is 255 bytes

// Magic numbers as byte arrays to avoid per-page TextDecoder allocations
const OGG_S_MAGIC = new TextEncoder().encode('OggS')
const OPUS_TAGS_MAGIC = new TextEncoder().encode('OpusTags')

/**
 * Extracts ComfyUI metadata (prompt and workflow) from an Ogg/Opus audio file.
 *
 * Reads the file as a binary ArrayBuffer, locates the OpusTags packet by
 * tracing Ogg pages, and parses the embedded Vorbis Comments to retrieve
 * JSON-encoded prompt and workflow data.
 *
 * @param file - The Ogg/Opus file to extract metadata from.
 * @returns A promise resolving to a {@link ComfyMetadata} object containing
 *   the parsed `prompt` and `workflow` fields, or `undefined` for each if
 *   not found or if parsing fails.
 */
export async function getOggMetadata(file: File): Promise<ComfyMetadata> {
  // Metadata is usually in the first couple of pages. A 2 MB cap covers all realistic sizes.
  // If the packet exceeds this, parsing will abort and warn instead of reading the whole file.
  const MAX_READ_BYTES = 2 * 1024 * 1024
  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.slice(0, MAX_READ_BYTES).arrayBuffer()
  } catch (err) {
    console.warn('Ogg metadata file read failed:', err)
    return { prompt: undefined, workflow: undefined }
  }

  const data = new Uint8Array(arrayBuffer)
  const decoder = new TextDecoder('utf-8')

  // Sequentially trace Ogg pages to extract segments of the 'OpusTags' packet containing metadata
  const segments = extractOpusTags(data)
  if (segments.length === 0) {
    console.warn(
      'Ogg metadata parsing failed: No OpusTags found or invalid Ogg file'
    )
    return { prompt: undefined, workflow: undefined }
  }

  // If the last segment is 255 bytes, the packet continues beyond our MAX_READ_BYTES cap.
  // We avoid reading further to prevent full-file scans on audio without embedded metadata.
  if (segments[segments.length - 1].length === OGG_MAX_SEGMENT_SIZE) {
    console.warn(
      'Ogg metadata parsing: OpusTags packet extends beyond the 2 MB read cap ' +
        'and was truncated; prompt/workflow metadata will be unavailable.'
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

/**
 * Traverses the Ogg page structure to extract all segments belonging to the
 * OpusTags packet.
 *
 * Scans pages sequentially by verifying the `OggS` capture pattern, reads
 * the segment table from each page header, and collects contiguous segments
 * that form the OpusTags packet. Relies on Ogg lacing rules: a segment
 * shorter than 255 bytes signals the end of the current packet.
 *
 * @param data - Raw binary content of the Ogg file.
 * @returns An array of `Uint8Array` segments that together constitute the
 *   OpusTags packet, or an empty array if the packet is not found.
 */
function extractOpusTags(data: Uint8Array): Uint8Array[] {
  const segments: Uint8Array[] = []
  let offset = 0
  let inOpusTags = false

  while (offset + OGG_HEADER_SIZE <= data.length) {
    if (!compareMagic(data, offset, OGG_S_MAGIC)) break

    const pageSegmentsCount = data[offset + OGG_PAGE_SEGMENTS_OFFSET]
    const lengthsOffset = offset + OGG_HEADER_SIZE
    let dataOffset = lengthsOffset + pageSegmentsCount

    if (dataOffset > data.length) break

    let pageProcessingEnded = false

    for (let i = 0; i < pageSegmentsCount; i++) {
      const segmentLength = data[lengthsOffset + i]

      // Stop processing if the segment exceeds our available data buffer
      if (dataOffset + segmentLength > data.length) {
        pageProcessingEnded = true
        break
      }

      const segment = data.subarray(dataOffset, dataOffset + segmentLength)
      dataOffset += segmentLength

      if (!inOpusTags) {
        if (segmentLength >= 8 && compareMagic(segment, 0, OPUS_TAGS_MAGIC)) {
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

/**
 * Parses a reconstructed OpusTags packet according to the Vorbis Comments
 * specification and extracts ComfyUI metadata fields.
 *
 * Skips the 8-byte `OpusTags` magic string, reads the vendor string, then
 * iterates over user comments formatted as `KEY=VALUE` pairs. Recognises
 * `prompt` and `workflow` keys and JSON-parses their values into the
 * returned metadata object.
 *
 * @param packetData - The complete, concatenated OpusTags packet as a
 *   `Uint8Array`.
 * @param decoder - UTF-8 TextDecoder used to decode comment strings.
 * @returns A {@link ComfyMetadata} object with `prompt` and/or `workflow`
 *   populated from the embedded comments, or `undefined` for missing fields.
 */
function parseVorbisComments(
  packetData: Uint8Array,
  decoder: TextDecoder
): ComfyMetadata {
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

  const result: ComfyMetadata = {}
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
      const key = text.substring(0, separatorIndex).toLowerCase()
      const value = text.substring(separatorIndex + 1)
      if (key === 'prompt') {
        try {
          result.prompt = JSON.parse(value)
        } catch (e) {
          console.warn('Ogg metadata parsing failed for prompt:', e)
        }
      } else if (key === 'workflow') {
        try {
          result.workflow = JSON.parse(value)
        } catch (e) {
          console.warn('Ogg metadata parsing failed for workflow:', e)
        }
      }
    }

    if (result.prompt !== undefined && result.workflow !== undefined) break
  }

  return result
}

/**
 * Compares a portion of a Uint8Array with a magic byte sequence.
 */
function compareMagic(
  data: Uint8Array,
  offset: number,
  magic: Uint8Array
): boolean {
  for (let i = 0; i < magic.length; i++) {
    if (data[offset + i] !== magic[i]) return false
  }
  return true
}
