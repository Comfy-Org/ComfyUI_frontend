import type { useExecutionErrorStore } from '@/stores/executionErrorStore'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'

type ExecutionErrorStore = ReturnType<typeof useExecutionErrorStore>

export function seedRequiredInputMissingNodeError(
  store: ExecutionErrorStore,
  executionId: NodeExecutionId,
  inputName: string
): void {
  store.recordNodeErrors({
    [executionId]: nodeError(
      [validationError('required_input_missing', inputName, {}, 'Missing', '')],
      'TestNode'
    )
  })
}
