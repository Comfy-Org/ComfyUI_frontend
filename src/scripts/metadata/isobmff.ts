import {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/schemas/comfyWorkflowSchema'
import { ASCII, ComfyMetadata, ComfyMetadataTags } from '@/types/metadataTypes'

const MAX_READ_BYTES = 2 * 1024 * 1024
const ISOBMFF_BOX_TYPES = {
  USER_DATA: [0x75, 0x64, 0x74, 0x61],
  META_DATA: [0x6d, 0x65, 0x74, 0x61],
  ITEM_LIST: [0x69, 0x6c, 0x73, 0x74],
  KEYS: [0x6b, 0x65, 0x79, 0x73],
  DATA: [0x64, 0x61, 0x74, 0x61]
}

// Check if a buffer matches a specific ISOBMFF box type at position
const matchesBoxType = (
  data: Uint8Array,
  pos: number,
  boxType: number[]
): boolean => {
  if (pos + 4 > data.length) return false

  for (let i = 0; i < 4; i++) {
    if (data[pos + i] !== boxType[i]) return false
  }

  return true
}

// Read a 32-bit unsigned integer (big-endian)
const readUint32 = (data: Uint8Array, pos: number): number => {
  if (pos + 4 > data.length) return 0

  return (
    (data[pos] << 24) |
    (data[pos + 1] << 16) |
    (data[pos + 2] << 8) |
    data[pos + 3]
  )
}

// Find an ISOBMFF box by type and return its content range
const findIsobmffBox = (
  data: Uint8Array,
  startPos: number,
  endPos: number,
  boxType: number[]
): { start: number; end: number } | null => {
  for (let pos = startPos; pos < endPos - 8; pos++) {
    // Get box size (includes header)
    const size = readUint32(data, pos)
    if (size <= 8 || pos + size > endPos) continue

    // Check if box type matches
    if (matchesBoxType(data, pos + 4, boxType)) {
      return {
        start: pos + 8, // Skip header (4 bytes size + 4 bytes type)
        end: pos + size
      }
    }

    // Skip to the next box
    if (size > 0) pos += size - 1
  }

  return null
}

const extractJson = (data: Uint8Array, start: number, end: number): any => {
  let jsonStart = start
  while (jsonStart < end && data[jsonStart] !== ASCII.OPEN_BRACE) {
    jsonStart++
  }

  if (jsonStart >= end) return null

  // Convert to text and try to parse as JSON
  try {
    const jsonText = new TextDecoder().decode(data.slice(jsonStart, end))
    return JSON.parse(jsonText)
  } catch {
    return null
  }
}

const processIsobmffMetadataValue = (
  data: Uint8Array,
  start: number,
  end: number,
  tagName: string
): ComfyWorkflowJSON | ComfyApiWorkflow | null => {
  if (
    tagName === ComfyMetadataTags.WORKFLOW ||
    tagName === ComfyMetadataTags.PROMPT
  ) {
    const jsonData = extractJson(data, start, end)
    if (jsonData) return jsonData
  }

  return null
}

const findTagsInUserDataBox = (
  data: Uint8Array,
  boxStart: number,
  boxEnd: number
): Array<{ name: string; valueStart: number; valueEnd: number }> => {
  const tags: Array<{ name: string; valueStart: number; valueEnd: number }> = []

  let pos = boxStart
  while (pos < boxEnd - 8) {
    const size = readUint32(data, pos)
    if (size <= 8 || pos + size > boxEnd) {
      pos++
      continue
    }

    // Get 4-character tag name
    const tagName = String.fromCharCode(
      data[pos + 4],
      data[pos + 5],
      data[pos + 6],
      data[pos + 7]
    )

    // Check if it's one of our tags
    if (
      tagName === ComfyMetadataTags.WORKFLOW ||
      tagName === ComfyMetadataTags.PROMPT
    ) {
      tags.push({
        name: tagName,
        valueStart: pos + 8, // Skip header
        valueEnd: pos + size
      })
    }

    pos += size
  }

  return tags
}

const parseIsobmffMetadata = (data: Uint8Array): ComfyMetadata => {
  const metadata: ComfyMetadata = {}

  const userDataBox = findIsobmffBox(
    data,
    0,
    data.length,
    ISOBMFF_BOX_TYPES.USER_DATA
  )
  if (!userDataBox) return metadata

  const tags = findTagsInUserDataBox(data, userDataBox.start, userDataBox.end)
  for (const tag of tags) {
    const value = processIsobmffMetadataValue(
      data,
      tag.valueStart,
      tag.valueEnd,
      tag.name
    )
    if (value !== null) {
      metadata[tag.name.toLowerCase()] = value
    }
  }

  return metadata
}

/**
 * Extracts ComfyUI Workflow metadata from an ISO Base Media File Format (ISOBMFF) file.
 * This format is the basis for MP4, MOV, etc.
 * @param file - The file to extract metadata from
 */
export function getFromIsobmffFile(file: File): Promise<ComfyMetadata> {
  return new Promise<ComfyMetadata>((resolve) => {
    const reader = new FileReader()
    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (!event.target?.result) {
        resolve({})
        return
      }

      try {
        const data = new Uint8Array(event.target.result as ArrayBuffer)
        resolve(parseIsobmffMetadata(data))
      } catch {
        resolve({})
      }
    }
    reader.onerror = () => resolve({})
    reader.readAsArrayBuffer(file.slice(0, MAX_READ_BYTES))
  })
}
