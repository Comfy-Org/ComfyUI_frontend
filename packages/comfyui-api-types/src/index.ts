export type {
  GetFeaturesResponse,
  GetModelsInFolderResponse,
  PromptRequest,
  PromptResponse
} from './generated'
export { zGetModelsInFolderResponse } from './generated/zod.gen'

import type { GetFeaturesResponse, PromptRequest } from './generated'

type StringMap<T extends Record<string, string>> = T

/** Core's `workflow_metadata`: string keys to string values. */
export type PromptWorkflowMetadata = StringMap<
  NonNullable<PromptRequest['workflow_metadata']>
>

/** Core's `agent` server feature: the local agent host's lifecycle. */
export type ComfyAgentFeature = NonNullable<GetFeaturesResponse['agent']>
