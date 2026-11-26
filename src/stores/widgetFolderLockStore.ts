import { z } from 'zod'

import { defineWidgetComponentStore } from './widgetComponentStore'

export const useWidgetFolderLockStore = defineWidgetComponentStore({
  id: 'widgetFolderLock',
  wireKey: 'widget_folder_locks',
  schema: z
    .array(z.string().min(1))
    .min(1)
    .transform((directory) => ({ directory })),
  encode: ({ directory }) => [...directory]
})
