import { z } from 'zod'

import { defineWidgetComponentStore } from './widgetComponentStore'

export const useWidgetPreviewDisplayStore = defineWidgetComponentStore({
  id: 'widgetPreviewDisplay',
  wireKey: 'previewDisplay',
  schema: z.enum(['shown', 'hidden']).transform((mode) => ({ mode })),
  encode: ({ mode }) => mode
})
