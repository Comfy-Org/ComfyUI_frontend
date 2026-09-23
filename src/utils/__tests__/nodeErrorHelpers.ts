import type { ExecutionErrorWsMessage } from '@/platform/remote/comfyui/execution/types'
import type { NodeError } from '@/platform/remote/comfyui/types'
import type { NodeValidationError } from '@/utils/executionErrorUtil'

export function runtimeError(
  nodeId: ExecutionErrorWsMessage['node_id']
): ExecutionErrorWsMessage {
  return {
    prompt_id: 'prompt',
    timestamp: 0,
    node_id: nodeId,
    node_type: 'KSampler',
    executed: [],
    exception_type: 'RuntimeError',
    exception_message: 'Execution failed',
    traceback: []
  }
}

export function validationError(
  type: string,
  inputName?: string,
  extraInfo: Record<string, unknown> = {},
  message = `${type} message`,
  details = `${type} details`
): NodeValidationError {
  return {
    type,
    message,
    details,
    ...(inputName
      ? { extra_info: { ...extraInfo, input_name: inputName } }
      : {})
  }
}

export function nodeError(
  errors: NodeValidationError[],
  classType = 'InteriorNode'
): NodeError {
  return {
    class_type: classType,
    dependent_outputs: [],
    errors
  }
}
