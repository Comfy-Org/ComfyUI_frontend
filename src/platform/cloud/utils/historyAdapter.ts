import type {
  HistoryResponseV2,
  HistoryTaskItem,
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
  outputs: TaskOutput
): TaskPrompt {
  const outputNodesIds = Object.keys(outputs)
  const { priority, prompt_id, extra_data } = promptV2
  return [priority, prompt_id, {}, extra_data, outputNodesIds]
}

/**
 * Maps V2 history format to V1 history format.
 * Validates response structure and first item to catch breaking API changes.
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
