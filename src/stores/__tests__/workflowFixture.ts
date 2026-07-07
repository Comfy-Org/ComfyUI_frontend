import { fromPartial } from '@total-typescript/shoehorn'
import type { PartialDeep } from '@total-typescript/shoehorn'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

export function createTestWorkflow(
  overrides: PartialDeep<ComfyWorkflow> = {}
): ComfyWorkflow {
  return fromPartial<ComfyWorkflow>({
    path: 'workflows/test.json',
    ...overrides
  })
}
