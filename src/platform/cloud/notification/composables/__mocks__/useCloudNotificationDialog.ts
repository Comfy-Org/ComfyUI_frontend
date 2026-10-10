import { vi } from 'vitest'

import type { useCloudNotificationDialog as realUseCloudNotificationDialog } from '../useCloudNotificationDialog'

const cloudNotificationDialog = vi.mockObject<
  ReturnType<typeof realUseCloudNotificationDialog>
>({ showCloudNotification: async () => {} }, { spy: true })

export const useCloudNotificationDialog = vi.fn(() => cloudNotificationDialog)
