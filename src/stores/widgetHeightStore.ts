import { z } from 'zod'

import { defineWidgetComponentStore } from './widgetComponentStore'

export const useWidgetHeightStore = defineWidgetComponentStore({
  id: 'widgetHeight',
  wireKey: 'widgetHeights',
  schema: z
    .number()
    .finite()
    .positive()
    .transform((height) => ({ height: Math.round(height) })),
  encode: ({ height }) => Math.round(height)
})
