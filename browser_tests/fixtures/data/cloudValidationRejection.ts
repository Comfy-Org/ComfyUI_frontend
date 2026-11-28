import type { PromptOutputsSkippedNodeError } from '@comfyorg/ingest-types'

const PREVIEW_ANY_NODE_ID = '1'
const MISSING_SOURCE_MESSAGE = 'Required input is missing: source'

export const cloudValidationSummary = `Prompt outputs failed validation. node ${PREVIEW_ANY_NODE_ID} (PreviewAny): source — required_input_missing: ${MISSING_SOURCE_MESSAGE}.`

export const cloudRelayedNodeErrors: Record<
  string,
  PromptOutputsSkippedNodeError
> = {
  [PREVIEW_ANY_NODE_ID]: {
    class_type: 'PreviewAny',
    dependent_outputs: [PREVIEW_ANY_NODE_ID],
    errors: [
      {
        type: 'required_input_missing',
        message: MISSING_SOURCE_MESSAGE,
        extra_info: { input_name: 'source' }
      }
    ]
  }
}
