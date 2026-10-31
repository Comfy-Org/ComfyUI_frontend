import { z } from 'zod'

import { resultItemType } from './resultItemTypeSchema'

export const zResultItem = z.object({
  filename: z.string().optional(),
  subfolder: z.string().optional(),
  type: resultItemType.optional(),
  display_name: z.string().optional(),
  id: z.string().optional(),
  preview_id: z.string().optional()
})
export type ResultItem = z.infer<typeof zResultItem>
export const zOutputs = z
  .object({
    audio: z.array(zResultItem).optional(),
    images: z.array(zResultItem).optional(),
    video: z.array(zResultItem).optional(),
    animated: z.array(z.boolean()).optional(),
    text: z.union([z.string(), z.array(z.string())]).optional()
  })
  .passthrough()

export type NodeExecutionOutput = z.infer<typeof zOutputs>

export type NodeOutputWith<T extends Record<string, unknown>> =
  NodeExecutionOutput & T
