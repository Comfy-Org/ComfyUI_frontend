import { z } from 'astro/zod'

// Page section order. Areas with no entries are skipped.
export const ROADMAP_AREA_ORDER = [
  'engine',
  'cloud',
  'frontend',
  'desktop',
  'platform',
  'community'
] as const

// Legend order too, so the key reads in the order work moves through.
export const ROADMAP_STAGES = ['exploring', 'building', 'shipping'] as const

export const roadmapSchema = z.strictObject({
  title: z.string(),
  area: z.enum(ROADMAP_AREA_ORDER),
  stage: z.enum(ROADMAP_STAGES),
  // Rendered verbatim, so each locale writes its own string and an entry can
  // be as coarse as it honestly is. Omit the field rather than passing "".
  date: z.string().min(1).optional(),
  order: z.number().int().nonnegative()
})
