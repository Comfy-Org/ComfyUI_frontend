import { z } from 'astro/zod'

// Filter chips follow this order.
export const ROADMAP_AREA_ORDER = [
  'engine',
  'cloud',
  'frontend',
  'desktop',
  'platform',
  'community'
] as const

export const ROADMAP_STAGES = [
  'exploring',
  'building',
  'shipping',
  'shipped'
] as const

// Below the NOW marker, closest to done first. `shipped` sorts above it.
export const ROADMAP_BELOW_NOW = ['shipping', 'building', 'exploring'] as const

export type RoadmapArea = (typeof ROADMAP_AREA_ORDER)[number]
export type RoadmapStage = (typeof ROADMAP_STAGES)[number]

export const roadmapSchema = z
  .strictObject({
    title: z.string(),
    area: z.enum(ROADMAP_AREA_ORDER),
    stage: z.enum(ROADMAP_STAGES),
    // Rendered verbatim, so each locale writes its own string. Omit the field
    // rather than passing "" when there is no date.
    date: z.string().min(1).optional(),
    // Where the thing itself lives, when it has a public page. Any stage may
    // carry one. Verify it returns 200 before adding it.
    link: z.string().url().optional(),
    order: z.number().int().nonnegative()
  })
  // A shipped entry sits above the NOW marker and claims the work is out, so
  // it has to say when. Every other stage may omit the date.
  .refine((entry) => entry.stage !== 'shipped' || entry.date !== undefined, {
    message: 'stage "shipped" requires a date',
    path: ['date']
  })
