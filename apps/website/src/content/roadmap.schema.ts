import { z } from 'astro/zod'

const ROADMAP_AREAS = [
  'engine',
  'cloud',
  'frontend',
  'desktop',
  'platform',
  'community'
] as const

// Stage of work, not a date. The roadmap deliberately carries no timing.
export const ROADMAP_STAGES = ['exploring', 'building', 'shipping'] as const

export const roadmapSchema = z.strictObject({
  title: z.string(),
  area: z.enum(ROADMAP_AREAS),
  stage: z.enum(ROADMAP_STAGES),
  order: z.number().int().nonnegative()
})
