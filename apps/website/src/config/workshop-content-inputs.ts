import { z } from 'astro/zod'

import rawInputs from '../data/workshop-content-inputs.json'

export const workshopContentInputs = new Map(
  Object.entries(
    z
      .record(
        z.string(),
        z
          .object({
            routerId: z.string(),
            options: z.record(z.string(), z.json()).default({}),
            unavailableReason: z.string().optional()
          })
          .strict()
      )
      .parse(rawInputs)
  )
)
