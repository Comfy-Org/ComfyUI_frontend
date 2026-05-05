import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { NodeError } from '@/schemas/apiSchema'
import type { useExecutionErrorStore } from '@/stores/executionErrorStore'

type ExecutionErrorStore = ReturnType<typeof useExecutionErrorStore>

interface RequiredInputMissingNodeErrorOptions {
  classType?: string
  details?: string
  dependentOutputs?: NodeError['dependent_outputs']
  message?: string
}

export function createRequiredInputMissingNodeError(
  inputName: string,
  {
    classType = 'TestNode',
    details = '',
    dependentOutputs = [],
    message = 'Missing'
  }: RequiredInputMissingNodeErrorOptions = {}
): NodeError {
  return {
    errors: [
      {
        type: 'required_input_missing',
        message,
        details,
        extra_info: { input_name: inputName }
      }
    ],
    dependent_outputs: dependentOutputs,
    class_type: classType
  }
}

export function seedRequiredInputMissingNodeError(
  store: ExecutionErrorStore,
  executionId: NodeId,
  inputName: string,
  options?: RequiredInputMissingNodeErrorOptions
): void {
  store.lastNodeErrors = {
    [String(executionId)]: createRequiredInputMissingNodeError(
      inputName,
      options
    )
  }
}
