import type { WorkshopModel } from '@/config/models-catalogue'

import { captureWorkshopEvent } from './posthog'
import type {
  HubFilter,
  HubItemKind,
  HubItemSource,
  HubSurface
} from './workshop-analytics'

const MAX_QUERY_CHARS = 100

interface HubItem {
  kind: HubItemKind
  slug: string
}

interface HubPlacement {
  surface: HubSurface
  source: HubItemSource
  position: number
  row?: string
  query?: string
}

export interface HubRowView {
  surface: HubSurface
  source: HubItemSource
  row?: string
  rowSlugs: string[]
}

/** Mirrors the app's `app:search_query`: trimmed and capped, full length kept. */
export function hubSearchQuery(raw: string) {
  const trimmed = raw.trim()
  return {
    query: trimmed.toLowerCase().slice(0, MAX_QUERY_CHARS),
    query_length: trimmed.length
  }
}

/** The search a result was clicked under, so searches that led nowhere show. */
export function hubActiveQuery(raw: string): { query?: string } {
  const { query } = hubSearchQuery(raw)
  return query ? { query } : {}
}

export function hubFilterValue(value: string | readonly string[]): string {
  if (typeof value === 'string') return value
  return value.length ? value.join(',') : 'all'
}

export function hubItemOf(
  model: Pick<WorkshopModel, 'slug' | 'type' | 'routerId'>
): HubItem {
  const kind =
    model.type === 'APP'
      ? 'app'
      : model.routerId === undefined
        ? 'workflow'
        : 'model'
  return { kind, slug: model.slug }
}

export function captureHubItemClick(item: HubItem, placement: HubPlacement) {
  captureWorkshopEvent({
    name: 'hub_item_clicked',
    properties: { ...placement, ...item }
  })
}

export function captureHubFilterChange(
  surface: HubSurface,
  filter: HubFilter,
  value: string,
  previousValue: string
) {
  if (value === previousValue) return
  captureWorkshopEvent({
    name: 'hub_filter_changed',
    properties: { surface, filter, value, previous_value: previousValue }
  })
}

/** The row's whole roster once the row enters view, not which cards were seen. */
export function captureHubRowView({ rowSlugs, ...row }: HubRowView) {
  captureWorkshopEvent({
    name: 'hub_row_viewed',
    properties: { ...row, item_count: rowSlugs.length, row_slugs: rowSlugs }
  })
}
