import { WORKSPACE_PARTNER_NODE_DISABLED_TYPE } from '@/platform/errorCatalog/validationErrorResolver'
import type { PromptResponse } from '@/schemas/apiSchema'
import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

const PARTNER_NODE_DISABLED_PROMPT_TYPE = 'PARTNER_NODE_DISABLED'

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : null
}

export function normalizePartnerNodePolicyPromptError(
  response: unknown,
  prompt: ComfyApiWorkflow
): PromptResponse | null {
  if (!response || typeof response !== 'object') return null

  const rawError = Reflect.get(response, 'error')
  if (!rawError || typeof rawError !== 'object') return null
  if (Reflect.get(rawError, 'type') !== PARTNER_NODE_DISABLED_PROMPT_TYPE) {
    return null
  }

  const classTypes = stringArray(Reflect.get(rawError, 'class_types'))
  if (!classTypes?.length) return null

  const deniedClassTypes = new Set(classTypes)
  const nodeErrors: NonNullable<PromptResponse['node_errors']> = {}
  for (const [executionId, node] of Object.entries(prompt)) {
    if (!deniedClassTypes.has(node.class_type)) continue

    nodeErrors[executionId] = {
      class_type: node.class_type,
      dependent_outputs: [],
      errors: [
        {
          type: WORKSPACE_PARTNER_NODE_DISABLED_TYPE,
          message: 'This node has been disabled by your team admin.',
          details: '',
          extra_info: {}
        }
      ]
    }
  }
  if (Object.keys(nodeErrors).length === 0) return null

  const message = Reflect.get(rawError, 'message')
  const providers = stringArray(Reflect.get(rawError, 'providers'))
  return {
    error: {
      type: PARTNER_NODE_DISABLED_PROMPT_TYPE,
      message:
        typeof message === 'string'
          ? message
          : 'Partner nodes are disabled by workspace policy.',
      details: '',
      extra_info: { class_types: classTypes, providers: providers ?? [] }
    },
    node_errors: nodeErrors
  }
}

export function isPartnerNodePolicyPromptResponse(
  response: PromptResponse
): boolean {
  return (
    typeof response.error === 'object' &&
    response.error.type === PARTNER_NODE_DISABLED_PROMPT_TYPE
  )
}
