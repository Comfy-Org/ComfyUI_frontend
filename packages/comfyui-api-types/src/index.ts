export type { PromptRequest, PromptResponse } from './generated'

import type { PromptRequest } from './generated'

type StringMap<T extends Record<string, string>> = T

/** Core's `workflow_metadata`: string keys to string values. */
export type PromptWorkflowMetadata = StringMap<
  NonNullable<PromptRequest['workflow_metadata']>
>
