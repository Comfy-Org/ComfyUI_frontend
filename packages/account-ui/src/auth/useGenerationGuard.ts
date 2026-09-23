import { createBoundedOperation } from '@comfyorg/account-core/boundedOperation'
import type { BoundedOperation } from '@comfyorg/account-core/boundedOperation'
import { onScopeDispose } from 'vue'

/**
 * A {@link createBoundedOperation} bound to the current Vue scope: when the
 * component or effect scope disposes, every outstanding attempt is abandoned,
 * so work resolving after teardown cannot act on an owner that is already gone.
 *
 * Call it from a component `setup` or an active `effectScope`. With no active
 * scope `onScopeDispose` no-ops, so it never auto-abandons; use
 * {@link createBoundedOperation} directly at module scope instead.
 */
export function useGenerationGuard(): BoundedOperation {
  const operation = createBoundedOperation()
  onScopeDispose(operation.abandon)
  return operation
}
