import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/schemas/comfyWorkflowSchema'

/**
 * Tag names used in ComfyUI metadata
 */
export enum ComfyMetadataTags {
  PROMPT = 'PROMPT',
  WORKFLOW = 'WORKFLOW'
}

/**
 * Metadata extracted from ComfyUI output files
 */
export interface ComfyMetadata {
  workflow?: ComfyWorkflowJSON
  prompt?: ComfyApiWorkflow
  [key: string]: string | ComfyWorkflowJSON | ComfyApiWorkflow | undefined
}

export type EbmlElementRange = {
  /** Position in the buffer */
  pos: number
  /** Length of the element in bytes */
  len: number
}

export type EbmlTagPosition = {
  name: EbmlElementRange
  value: EbmlElementRange
}

export type VInt = {
  /** The value of the variable-length integer */
  value: number
  /** The length of the variable-length integer in bytes */
  length: number
}

export type TextRange = {
  start: number
  end: number
}

export enum ASCII {
  GLTF = 0x46546c67,
  JSON = 0x4e4f534a,
  OPEN_BRACE = 0x7b
}

export enum GltfSizeBytes {
  HEADER = 12,
  CHUNK_HEADER = 8
}

export type GltfHeader = {
  magicNumber: number
  gltfFormatVersion: number
  totalLengthBytes: number
}

export type GltfChunkHeader = {
  chunkLengthBytes: number
  chunkTypeIdentifier: number
}

export type GltfExtras = {
  workflow?: string | object
  prompt?: string | object
  [key: string]: any
}

export type GltfJsonData = {
  asset?: {
    extras?: GltfExtras
    [key: string]: any
  }
  [key: string]: any
}

/**
 * Represents the content range [start, end) of an ISOBMFF box, excluding its header.
 * Null if the box was not found.
 */
export type IsobmffBoxContentRange = { start: number; end: number } | null
