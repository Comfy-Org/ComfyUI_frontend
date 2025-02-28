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
