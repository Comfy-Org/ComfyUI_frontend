import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

interface LitegraphServiceAccess {
  addNodeInput(node: LGraphNode, inputSpec: InputSpec): void
  updatePreviews(node: LGraphNode, callback?: () => void): void
  fitView(): void
}

/** `useLitegraphService` for the modules it imports, which cannot import it back. */
export let useLitegraphServiceAccess: () => LitegraphServiceAccess

/** Called by `litegraphService` when it loads. */
export function provideLitegraphService(
  useService: () => LitegraphServiceAccess
): void {
  useLitegraphServiceAccess = useService
}
