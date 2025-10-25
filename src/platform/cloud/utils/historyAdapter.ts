import {
  zHistoryResponseV2Shallow,
  zRawHistoryItemV2
} from '@/schemas/apiSchema'
import type {
  HistoryResponseV2,
  HistoryTaskItem,
  PromptId,
  RawHistoryItemV2,
  TaskOutput,
  TaskPrompt,
  TaskPromptV2
} from '@/schemas/apiSchema'

/**
 * Maps V2 prompt format to V1 prompt tuple format.
 */
function mapPromptV2toV1(
  promptV2: TaskPromptV2,
  promptId: PromptId,
  outputs: TaskOutput
): TaskPrompt {
  const outputNodesIds = Object.keys(outputs)
  const { priority, extra_data } = promptV2
  return [priority, promptId, {}, extra_data, outputNodesIds]
}

/**
 * Maps V2 history format to V1 history format.
 * Validates response structure and first item to catch breaking API changes.
 */
export function mapHistoryV2toHistory(
  historyV2Response: HistoryResponseV2
): HistoryTaskItem[] {
  // Basic validation
  // 1. Validate response has correct shape
  zHistoryResponseV2Shallow.parse(historyV2Response)
  if (historyV2Response.history.length > 0) {
    // 2. Validate first item deeply to catch breaking API changes
    zRawHistoryItemV2.parse(historyV2Response.history[0])
  }

  return historyV2Response.history.map(
    ({
      prompt_id,
      prompt,
      status,
      outputs,
      meta
    }: RawHistoryItemV2): HistoryTaskItem => ({
      taskType: 'History' as const,
      prompt: mapPromptV2toV1(prompt, prompt_id, outputs),
      status,
      outputs,
      meta
    })
  )
}
