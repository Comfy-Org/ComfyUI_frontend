import { zPriceBadge } from '@comfyorg/object-info-parser'
import { z } from 'zod'

export const workshopPublishedPricingSchema = z.object({
  sourceUrl: z.url(),
  verifiedOn: z.iso.date(),
  models: z.record(
    z.string(),
    z.object({
      creditsPerRun: z.number().positive(),
      useCases: z.array(z.enum(['generate-images', 'edit-images'])).nonempty()
    })
  )
})

export const workshopNodePricingSchema = z
  .array(
    z
      .object({
        routerId: z.string().regex(/^[^/]+\/[^/]+$/),
        nodeType: z.string().min(1),
        sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
        priceBadge: zPriceBadge,
        widgets: z.record(
          z.string(),
          z.union([z.string(), z.number(), z.boolean()])
        ),
        useCases: z.array(z.string().min(1)).nonempty().optional()
      })
      .superRefine((row, context) => {
        for (const dependency of row.priceBadge.depends_on.widgets) {
          if (!(dependency.name in row.widgets)) {
            context.addIssue({
              code: 'custom',
              path: ['widgets', dependency.name],
              message: `Missing default for pricing widget ${dependency.name}`
            })
          }
        }
      })
  )
  .superRefine((rows, context) => {
    const ids = new Set<string>()
    for (const [index, row] of rows.entries()) {
      if (ids.has(row.routerId))
        context.addIssue({
          code: 'custom',
          path: [index, 'routerId'],
          message: 'Duplicate Router pricing binding'
        })
      ids.add(row.routerId)
    }
  })
