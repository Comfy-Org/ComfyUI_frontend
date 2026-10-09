import type { Locale } from '@/config/locales'
import type { RoadmapArea, RoadmapStage } from '@/content/roadmap.schema'
import { ROADMAP_AREA_ORDER, ROADMAP_BELOW_NOW } from '@/content/roadmap.schema'

/** The shape the board needs, so these stay testable without a content build. */
export interface TimelineEntry {
  id: string
  data: { area: RoadmapArea; stage: RoadmapStage; order: number }
}

/** Entry ids are `<locale>/<slug>`, and `zh-CN` must not match `zh`. */
export function entriesForLocale<T extends TimelineEntry>(
  entries: readonly T[],
  locale: Locale
): T[] {
  return entries.filter((entry) => entry.id.startsWith(`${locale}/`))
}

/** Above the NOW marker, newest first, which `order` is what actually controls. */
export function shippedEntries<T extends TimelineEntry>(
  entries: readonly T[]
): T[] {
  return entries
    .filter((entry) => entry.data.stage === 'shipped')
    .sort((a, b) => a.data.order - b.data.order)
}

/** Below the marker: shipping, then building, then exploring, `order` breaking ties. */
export function upcomingEntries<T extends TimelineEntry>(
  entries: readonly T[]
): T[] {
  const rank = (stage: RoadmapStage) =>
    ROADMAP_BELOW_NOW.indexOf(stage as (typeof ROADMAP_BELOW_NOW)[number])
  return entries
    .filter((entry) => entry.data.stage !== 'shipped')
    .sort(
      (a, b) =>
        rank(a.data.stage) - rank(b.data.stage) || a.data.order - b.data.order
    )
}

/** Filter chips, in page order, for areas that actually have an entry. */
export function areasInUse(entries: readonly TimelineEntry[]): RoadmapArea[] {
  return ROADMAP_AREA_ORDER.filter((area) =>
    entries.some((entry) => entry.data.area === area)
  )
}
