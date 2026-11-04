import type {
  NodeExecutionOutput,
  TaskOutput
} from '@comfyorg/api-client/executionTypes'

import type {
  AppContract,
  FileModality,
  MediaItem
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { parseNodeOutput } from '@/stores/resultItemParsing'
import type { AugmentedResultItem } from '@/utils/resultItem'
import {
  is3DResult,
  isAudioResult,
  isImageResult,
  isVideoResult
} from '@/utils/resultItem'

type AppOutputPort = AppContract['outputs'][number]

const FILE_RESULT_MATCHERS: Record<
  FileModality,
  (item: AugmentedResultItem) => boolean
> = {
  image: isImageResult,
  video: isVideoResult,
  audio: isAudioResult,
  '3d': is3DResult
}

function textItems(output: NodeExecutionOutput | undefined): MediaItem[] {
  const text = output?.text
  const texts = typeof text === 'string' ? [text] : (text ?? [])
  return texts.map((value) => ({ kind: 'text', text: value }))
}

function fileItems(
  nodeId: string,
  output: NodeExecutionOutput | undefined,
  modality: FileModality
): MediaItem[] {
  return parseNodeOutput(nodeId, output)
    .filter(FILE_RESULT_MATCHERS[modality])
    .map((result) => ({
      kind: 'file',
      modality,
      ref: {
        filename: result.filename,
        subfolder: result.subfolder,
        type: result.type ?? 'output'
      }
    }))
}

function portItems(
  port: AppOutputPort,
  outputs: TaskOutput | undefined
): MediaItem[] {
  const output = outputs?.[port.outputNodeId]
  if (port.modality === 'text') return textItems(output)
  return fileItems(port.outputNodeId, output, port.modality)
}

/** Each output port's items from one finished job, in job order. */
export function collectRunOutputs(
  contract: AppContract,
  outputs: TaskOutput | undefined
): Record<string, MediaItem[]> {
  return Object.fromEntries(
    contract.outputs.map((port) => [port.name, portItems(port, outputs)])
  )
}

export function hasRunOutputs(
  contract: AppContract,
  outputs: TaskOutput | undefined
): boolean {
  return Object.values(collectRunOutputs(contract, outputs)).some(
    (items) => items.length > 0
  )
}
