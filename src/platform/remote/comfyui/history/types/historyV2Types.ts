/**
 * @fileoverview History V2 types and schemas - Internal cloud API format
 * @module platform/remote/comfyui/history/types/historyV2Types
 *
 * These types and schemas represent the V2 history format returned by the cloud API.
 * They are only used internally and are converted to V1 format via adapter.
 *
 * IMPORTANT: These types should NOT be used outside this history module.
 */

import { z } from 'zod'

import {
  zExtraData,
  zPromptId,
  zQueueIndex,
  zStatus,
  zTaskMeta,
  zTaskOutput
} from '@/schemas/apiSchema'

const zTaskPromptV2 = z.object({
  priority: zQueueIndex,
  prompt_id: zPromptId,
  extra_data: zExtraData
})

const zRawHistoryItemV2 = z.object({
  prompt_id: zPromptId,
  prompt: zTaskPromptV2,
  status: zStatus.optional(),
  outputs: zTaskOutput,
  meta: zTaskMeta.optional()
})

const zHistoryResponseV2 = z.object({
  history: z.array(zRawHistoryItemV2)
})

export type TaskPromptV2 = z.infer<typeof zTaskPromptV2>
export type RawHistoryItemV2 = z.infer<typeof zRawHistoryItemV2>
export type HistoryResponseV2 = z.infer<typeof zHistoryResponseV2>
export type TaskOutput = z.infer<typeof zTaskOutput>

export { zRawHistoryItemV2 }
