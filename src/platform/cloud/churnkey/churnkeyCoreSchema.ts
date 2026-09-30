import type { SdkConfig } from '@churnkey/react/core'
import { z } from 'zod'

const copy = z.object({
  headline: z.string(),
  body: z.string(),
  cta: z.string(),
  declineCta: z.string()
})
const discount = z.object({
  type: z.literal('discount'),
  decisionId: z.string().min(1),
  couponId: z.literal('comfy_retention_30_3_v1').optional(),
  percentOff: z.literal(30),
  amountOff: z.literal(0).optional(),
  durationInMonths: z.literal(3),
  copy
})
const step = z.object({
  guid: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional()
})
const interval = z.object({
  interval: z.enum(['month', 'year']),
  intervalCount: z.number().int().positive()
})
export const churnkeyCoreSchema = z.object({
  blueprintId: z.string().min(1),
  autoOptimizationKey: z.string().optional(),
  steps: z
    .array(
      z.discriminatedUnion('type', [
        step.extend({
          type: z.literal('survey'),
          reasons: z.array(
            z.object({
              id: z.string().min(1),
              label: z.string().min(1),
              freeform: z.boolean().optional(),
              offer: discount.optional()
            })
          )
        }),
        step.extend({ type: z.literal('offer'), offer: discount }),
        step.extend({
          type: z.literal('feedback'),
          placeholder: z.string().optional(),
          required: z.boolean().optional(),
          minLength: z.number().int().nonnegative().optional()
        }),
        step.extend({ type: z.literal('confirm') })
      ])
    )
    .min(1),
  customer: z.object({
    id: z.string().min(1),
    currency: z.string().optional()
  }),
  subscriptions: z
    .array(
      z.object({
        id: z.string().min(1),
        customerId: z.string().min(1),
        start: z.string().datetime(),
        status: z.object({
          name: z.literal('active'),
          currentPeriod: z.object({
            start: z.string().datetime(),
            end: z.string().datetime()
          })
        }),
        duration: interval,
        items: z
          .array(
            z.object({
              quantity: z.number().int().positive(),
              price: z.object({
                id: z.string().min(1),
                duration: interval,
                amount: z.object({
                  value: z.number().positive(),
                  currency: z.string().min(1)
                })
              })
            })
          )
          .length(1)
      })
    )
    .length(1),
  settings: z.object({
    clickToCancelEnabled: z.boolean(),
    strictFTCComplianceEnabled: z.boolean(),
    cancelAtPeriodEnd: z.boolean().optional(),
    discountCooldown: z.number().optional(),
    pauseCooldown: z.number().optional()
  })
}) satisfies z.ZodType<SdkConfig>
