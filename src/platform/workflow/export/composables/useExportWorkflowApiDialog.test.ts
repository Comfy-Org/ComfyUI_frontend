import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ExportWorkflowApiDialogContent from '@/platform/workflow/export/components/ExportWorkflowApiDialogContent.vue'
import { useExportWorkflowApiDialog } from '@/platform/workflow/export/composables/useExportWorkflowApiDialog'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

describe('useExportWorkflowApiDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens the API export dialog with the shared dialog system', () => {
    const dialogStore = useDialogStore()
    const showDialog = vi.spyOn(dialogStore, 'showDialog')
    const closeDialog = vi.spyOn(dialogStore, 'closeDialog')

    useExportWorkflowApiDialog().show()

    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'global-export-workflow-api',
        title: 'apiExport.title',
        component: ExportWorkflowApiDialogContent,
        props: { onClose: expect.any(Function) },
        dialogComponentProps: {
          renderer: 'reka',
          size: 'md'
        }
      })
    )

    const props = showDialog.mock.calls[0][0].props as
      | { onClose?: () => void }
      | undefined
    const onClose = props?.onClose
    expect(onClose).toEqual(expect.any(Function))
    if (typeof onClose !== 'function') return

    onClose()
    expect(closeDialog).toHaveBeenCalledWith({
      key: 'global-export-workflow-api'
    })
  })
})
