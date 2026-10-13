import { vi } from 'vitest'

import type { useAuthDialogs as realUseAuthDialogs } from '../useAuthDialogs'

type AuthDialogs = ReturnType<typeof realUseAuthDialogs>

const dialog: Awaited<ReturnType<AuthDialogs['showUpdatePasswordDialog']>> = {
  key: 'test-dialog',
  visible: true,
  component: {},
  contentProps: {},
  dialogComponentProps: {},
  priority: 1
}

const authDialogs = vi.mockObject<AuthDialogs>(
  {
    showApiNodesSignInDialog: async () => false,
    showSignInDialog: async () => false,
    showUpdatePasswordDialog: async () => dialog
  },
  { spy: true }
)

export const useAuthDialogs = vi.fn(() => authDialogs)
