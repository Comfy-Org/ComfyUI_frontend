/**
 * @fileoverview Adapter to convert V2 history format to V1 format
 * @module platform/remote/comfyui/history/adapters/v2ToV1Adapter
 */
import type { HistoryTaskItem, TaskPrompt } from '../types/historyV1Types'
import type {
  HistoryResponseV2,
  RawHistoryItemV2,
  TaskOutput,
  TaskPromptV2
} from '../types/historyV2Types'

function mapPromptV2toV1(
  promptV2: TaskPromptV2,
  outputs: TaskOutput,
  syntheticPriority: number
): TaskPrompt {
  return [
    syntheticPriority,
    promptV2.prompt_id,
    {},
    promptV2.extra_data,
    Object.keys(outputs)
  ]
}

function getExecutionSuccessTimestamp(item: RawHistoryItemV2): number {
  return (
    item.status?.messages?.find((m) => m[0] === 'execution_success')?.[1]
      ?.timestamp ?? 0
  )
}

export function mapHistoryV2toHistory(
  historyV2Response: HistoryResponseV2
): HistoryTaskItem[] {
  const { history } = historyV2Response

  // Sort by execution_success timestamp, descending (newest first)
  history.sort((a, b) => {
    return getExecutionSuccessTimestamp(b) - getExecutionSuccessTimestamp(a)
  })

  // Count items with valid timestamps for synthetic priority calculation
  const countWithTimestamps = history.filter(
    (item) => getExecutionSuccessTimestamp(item) > 0
  ).length

  return history.map((item, index): HistoryTaskItem => {
    const { prompt, outputs, status, meta } = item
    const timestamp = getExecutionSuccessTimestamp(item)

    // Items with timestamps get priority based on sorted position (highest first)
    const syntheticPriority = timestamp > 0 ? countWithTimestamps - index : 0

    return {
      taskType: 'History' as const,
      prompt: mapPromptV2toV1(prompt, outputs, syntheticPriority),
      status,
      outputs,
      meta
    }
  })
}
