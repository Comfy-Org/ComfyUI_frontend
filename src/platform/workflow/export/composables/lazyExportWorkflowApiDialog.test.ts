import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { openExportWorkflowApiDialog } from '@/platform/workflow/export/composables/lazyExportWorkflowApiDialog'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock(
  '@/platform/workflow/export/components/ExportWorkflowApiDialogContent.vue',
  () => ({ default: { template: '<div />' } })
)

describe('openExportWorkflowApiDialog', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('opens a dialog that its content can close', async () => {
    const dialogStore = useDialogStore()
    const showDialog = vi.spyOn(dialogStore, 'showDialog')
    const closeDialog = vi.spyOn(dialogStore, 'closeDialog')

    await openExportWorkflowApiDialog('image_flux2')

    const dialog = showDialog.mock.calls[0][0]
    expect(dialog).toMatchObject({
      key: 'global-export-workflow-api',
      title: 'apiExport.title',
      dialogComponentProps: { renderer: 'reka', size: 'md' }
    })

    const props = dialog.props as
      | { initialWorkflowBaseName?: string; onClose?: () => void }
      | undefined
    expect(props?.initialWorkflowBaseName).toBe('image_flux2')
    const onClose = props?.onClose
    expect(onClose).toEqual(expect.any(Function))
    if (typeof onClose !== 'function') return

    onClose()
    expect(closeDialog).toHaveBeenCalledWith({
      key: 'global-export-workflow-api'
    })
  })
})
