import { describe, expect, it, vi } from 'vitest'

import { openExportWorkflowApiDialog } from '@/platform/workflow/export/composables/lazyExportWorkflowApiDialog'

const showDialog = vi.hoisted(() => vi.fn())

vi.mock(
  '@/platform/workflow/export/composables/useExportWorkflowApiDialog',
  () => ({
    useExportWorkflowApiDialog: () => ({ show: showDialog })
  })
)

describe('openExportWorkflowApiDialog', () => {
  it('loads and opens the API export dialog', async () => {
    await openExportWorkflowApiDialog()

    expect(showDialog).toHaveBeenCalledOnce()
  })
})
