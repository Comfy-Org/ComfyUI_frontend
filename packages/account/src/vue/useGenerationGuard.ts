import { onScopeDispose } from 'vue'

import { createBoundedOperation } from '../core/boundedOperation.js'
import type { BoundedOperation } from '../core/boundedOperation.js'

/**
 * A {@link createBoundedOperation} bound to the current Vue scope: when the
 * component or effect scope disposes, every outstanding attempt is abandoned,
 * so work resolving after teardown cannot act on an owner that is already gone.
 */
export function useGenerationGuard(): BoundedOperation {
  const operation = createBoundedOperation()
  onScopeDispose(operation.abandon)
  return operation
}
