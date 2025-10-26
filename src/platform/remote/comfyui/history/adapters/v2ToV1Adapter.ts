/**
 * @fileoverview Adapter to convert V2 history format to V1 format
 * @module platform/remote/comfyui/history/adapters/v2ToV1Adapter
 *
 * Converts cloud API V2 response format to the V1 format expected by the app.
 */

import type { HistoryTaskItem, TaskPrompt } from '../types/historyV1Types'
import type {
  HistoryResponseV2,
  RawHistoryItemV2,
  TaskOutput,
  TaskPromptV2
} from '../types/historyV2Types'

/**
 * Maps V2 prompt format to V1 prompt tuple format.
 */
function mapPromptV2toV1(
  promptV2: TaskPromptV2,
  outputs: TaskOutput
): TaskPrompt {
  const outputNodesIds = Object.keys(outputs)
  const { priority, prompt_id, extra_data } = promptV2
  return [priority, prompt_id, {}, extra_data, outputNodesIds]
}

/**
 * Maps V2 history format to V1 history format.
 */
export function mapHistoryV2toHistory(
  historyV2Response: HistoryResponseV2
): HistoryTaskItem[] {
  return historyV2Response.history.map(
    ({ prompt, status, outputs, meta }: RawHistoryItemV2): HistoryTaskItem => ({
      taskType: 'History' as const,
      prompt: mapPromptV2toV1(prompt, outputs),
      status,
      outputs,
      meta
    })
  )
}
