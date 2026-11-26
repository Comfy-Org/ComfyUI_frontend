import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { parseJsonWithNonFinite } from '@/utils/jsonUtil'

const DERIVED_SUFFIX = '.workflow.json'
const MAX_WORKFLOW_METADATA_BYTES = 10 * 1024 * 1024
const SHARED_READER_PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]
const PNG_CHUNK_START_OFFSET = 8
const PNG_TEXT_CHUNKS = new Set(['tEXt', 'comf', 'iTXt'])

export const DERIVED_WORKFLOW_SOURCE_PREFIX = 'derived-workflow:'

function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, '') || name
}

export function derivedWorkflowName(sourceName: string): string {
  return `${stripExtension(sourceName)}${DERIVED_SUFFIX}`
}

const WORKFLOW_BEARING_IMAGE = /\.(png|webp|avif)$/i

export function canCarryEmbeddedWorkflow(file: File): boolean {
  return (
    WORKFLOW_BEARING_IMAGE.test(file.name) &&
    (file.type === '' ||
      file.type === 'application/octet-stream' ||
      /^image\/(png|webp|avif)$/.test(file.type))
  )
}

function looksLikeEditorWorkflow(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('nodes' in value))
    return false
  return Array.isArray(value.nodes) && value.nodes.length > 0
}

function parseWorkflow(raw: string | object): unknown {
  return typeof raw === 'string' ? parseJsonWithNonFinite(raw) : raw
}

type PngChunk = {
  type: string
  dataStart: number
  dataEnd: number
  nextOffset: number
}

function readPngChunk(
  bytes: Uint8Array,
  view: DataView,
  offset: number
): PngChunk | undefined {
  if (offset + 12 > bytes.length) return undefined
  const length = view.getUint32(offset)
  const dataStart = offset + 8
  const dataEnd = dataStart + length
  if (dataEnd + 4 > bytes.length) return undefined
  return {
    type: String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)),
    dataStart,
    dataEnd,
    nextOffset: dataEnd + 4
  }
}

function isBoundedPngTextChunk(bytes: Uint8Array, chunk: PngChunk): boolean {
  if (!PNG_TEXT_CHUNKS.has(chunk.type)) return true
  if (chunk.dataEnd - chunk.dataStart > MAX_WORKFLOW_METADATA_BYTES)
    return false
  const keywordLength = bytes
    .subarray(chunk.dataStart, chunk.dataEnd)
    .indexOf(0)
  if (keywordLength < 0) return false
  return (
    chunk.type !== 'iTXt' || bytes[chunk.dataStart + keywordLength + 1] !== 1
  )
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= SHARED_READER_PNG_MAGIC.length &&
    SHARED_READER_PNG_MAGIC.every((byte, index) => bytes[index] === byte)
  )
}

async function hasBoundedPngMetadata(file: File): Promise<boolean> {
  if (file.type !== 'image/png') return true
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!hasPngSignature(bytes)) return true
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = PNG_CHUNK_START_OFFSET
  while (offset < bytes.length) {
    const chunk = readPngChunk(bytes, view, offset)
    if (!chunk || !isBoundedPngTextChunk(bytes, chunk)) return false
    if (chunk.type === 'IEND') return true
    offset = chunk.nextOffset
  }
  return false
}

export async function deriveWorkflowFile(
  file: File
): Promise<File | undefined> {
  if (!canCarryEmbeddedWorkflow(file)) return undefined

  const parserFile =
    file.type === '' || file.type === 'application/octet-stream'
      ? new File([file], file.name, {
          type: `image/${file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()}`,
          lastModified: file.lastModified
        })
      : file

  if (!(await hasBoundedPngMetadata(parserFile))) return undefined

  let metadata
  try {
    metadata = await getWorkflowDataFromFile(parserFile)
  } catch {
    return undefined
  }

  const raw = metadata?.workflow
  if (!raw) return undefined
  if (typeof raw === 'string' && raw.length > MAX_WORKFLOW_METADATA_BYTES)
    return undefined

  let workflow: unknown
  try {
    workflow = parseWorkflow(raw)
  } catch {
    return undefined
  }
  if (!looksLikeEditorWorkflow(workflow)) return undefined

  let serialized: string
  try {
    serialized = JSON.stringify(workflow)
  } catch {
    return undefined
  }

  return new File([serialized], derivedWorkflowName(file.name), {
    type: 'application/json'
  })
}
