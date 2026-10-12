import { vi } from 'vitest'

import type { useDialogService as realUseDialogService } from '../dialogService'

type DialogService = ReturnType<typeof realUseDialogService>

const dialog: ReturnType<DialogService['showLayoutDialog']> = {
  key: 'test-dialog',
  visible: true,
  component: {},
  contentProps: {},
  dialogComponentProps: {},
  priority: 1
}

const dialogService = vi.mockObject<DialogService>(
  {
    showExecutionErrorDialog: () => {},
    showExtensionDialog: () => ({ dialog, closeDialog: vi.fn() }),
    prompt: async () => null,
    showErrorDialog: () => {},
    confirm: async () => null,
    showLayoutDialog: () => dialog,
    showSmallLayoutDialog: () => dialog
  },
  { spy: true }
)

export const useDialogService = vi.fn(() => dialogService)
