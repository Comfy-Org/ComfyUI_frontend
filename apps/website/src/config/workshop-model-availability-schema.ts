import { z } from 'astro/zod'

/**
 * Per-slug availability. `disabled: true` drops the entry from the build;
 * `flag` keeps it built but shows it only to visitors for whom that PostHog
 * flag is on (see `scripts/workshop-model-flags.ts`). Either way `reason` says
 * why, for whoever reads this file next.
 */
export const workshopModelAvailabilitySchema = z.record(
  z.string(),
  z
    .object({
      disabled: z.boolean().optional(),
      flag: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'a PostHog flag key')
        .optional(),
      reason: z.string().trim().min(1)
    })
    .strict()
    .refine((entry) => entry.disabled !== undefined || entry.flag, {
      message: 'set disabled or flag'
    })
)
