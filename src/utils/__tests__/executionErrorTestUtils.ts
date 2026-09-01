import type { NodeError } from '@/schemas/apiSchema'
import type { useExecutionErrorStore } from '@/stores/executionErrorStore'
import type { NodeExecutionId } from '@/types/nodeIdentification'

type ExecutionErrorStore = ReturnType<typeof useExecutionErrorStore>

function createRequiredInputMissingNodeError(inputName: string): NodeError {
  return {
    errors: [
      {
        type: 'required_input_missing',
        message: 'Missing',
        details: '',
        extra_info: { input_name: inputName }
      }
    ],
    dependent_outputs: [],
    class_type: 'TestNode'
  }
}

export function seedRequiredInputMissingNodeError(
  store: ExecutionErrorStore,
  executionId: NodeExecutionId,
  inputName: string
): void {
  store.lastNodeErrors = {
    [executionId]: createRequiredInputMissingNodeError(inputName)
  }
}
