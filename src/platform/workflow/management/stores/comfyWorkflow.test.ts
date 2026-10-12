import { describe, expect, it, vi } from 'vitest'

import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

// Simulates the dialog-service chunk failing to provide `useDialogService`
// -- the condition reported in production as `promptSave()`'s
// `const { useDialogService } = await import('@/services/dialogService')`
// throwing "Cannot destructure property 'useDialogService' of '(intermediate
// value)' as it is undefined". (Vitest's module-mock guard refuses to let a
// mock factory resolve to a literal `undefined` module, so this reproduces
// the closest failure this harness can exercise: the chunk resolving without
// the expected export.) This has been hit when saving a newly-imported,
// temporary workflow -- e.g. one that failed graph validation on import --
// for the first time, since that is exactly the path that reaches
// `promptSave()` before any filename has been assigned.
vi.mock(import('@/services/dialogService'), () => ({}))

describe('ComfyWorkflow.promptSave', () => {
  it('resolves to null when useDialogService is unavailable', async () => {
    const workflow = new ComfyWorkflow({
      path: 'workflows/imported-with-invalid-nodes.json',
      modified: Date.now(),
      size: -1
    })

    await expect(workflow.promptSave()).resolves.toBeNull()
  })
})
