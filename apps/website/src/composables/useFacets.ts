import type { Ref } from 'vue'
import { computed } from 'vue'

import { tagDisplayName } from '../lib/hub/tag-aliases'
import { mediaName } from '../lib/hub/media-names'
import type { FilterBadge } from './useHubStore'
import { useHubStore } from './useHubStore'

export interface FacetTemplate {
  readonly tags: readonly string[]
  readonly models: readonly string[]
  readonly mediaType?: string
  readonly partner?: string
  readonly industries?: readonly string[]
}

export interface FacetValue {
  readonly value: string
  readonly displayValue: string
  readonly count: number
}

export interface Facet {
  readonly type: FilterBadge['type']
  readonly values: readonly FacetValue[]
}

const FACET_SOURCES: Record<
  FilterBadge['type'],
  {
    field: (t: FacetTemplate) => readonly string[]
    display: (v: string) => string
  }
> = {
  model: { field: (t) => t.models, display: (v) => v },
  tag: { field: (t) => t.tags, display: tagDisplayName },
  media: {
    field: (t) => (t.mediaType ? [t.mediaType] : []),
    display: mediaName
  },
  partner: { field: (t) => (t.partner ? [t.partner] : []), display: (v) => v },
  industry: { field: (t) => t.industries ?? [], display: (v) => v }
}

function buildFacet(
  templates: readonly FacetTemplate[],
  type: FilterBadge['type']
): Facet {
  const { field, display } = FACET_SOURCES[type]
  const counts = new Map<string, number>()
  for (const t of templates) {
    for (const v of new Set(field(t))) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  const values = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, displayValue: display(value), count }))
  return { type, values }
}

export function useFacets(templates: Ref<readonly FacetTemplate[]>) {
  const store = useHubStore()
  const facetsByType = computed<Record<FilterBadge['type'], Facet>>(() => ({
    model: buildFacet(templates.value, 'model'),
    tag: buildFacet(templates.value, 'tag'),
    media: buildFacet(templates.value, 'media'),
    partner: buildFacet(templates.value, 'partner'),
    industry: buildFacet(templates.value, 'industry')
  }))
  const isBadgeActive = (type: FilterBadge['type'], value: string) =>
    store.filterBadges.value.some((b) => b.type === type && b.value === value)
  const activeCountForType = (type: FilterBadge['type']) =>
    store.filterBadges.value.filter((b) => b.type === type).length
  return { facetsByType, isBadgeActive, activeCountForType }
}
