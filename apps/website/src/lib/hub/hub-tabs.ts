import type { HubTab } from '../../composables/useHubStore'

export interface TabbableTemplate {
  readonly isApp?: boolean
}

// The tab is a scope, not a filter: everything derived from the catalogue
// (grid and facet counts) narrows through it.
export function templatesInTab<T extends TabbableTemplate>(
  templates: readonly T[],
  tab: HubTab
): T[] {
  if (tab === 'comfyApps') return templates.filter((t) => t.isApp)
  if (tab === 'nodeGraphs') return templates.filter((t) => !t.isApp)
  if (tab === 'models') return []
  return [...templates]
}

export interface ScopedBadge {
  readonly type: string
  readonly value: string
}

export interface FacetedTemplate {
  readonly models?: readonly string[]
  readonly tags?: readonly string[]
}

// Badges selected on one tab may have no option on the next; keep only the
// ones that still match something so switching never leaves an empty grid
// with an invisible filter.
export function badgesAvailableIn<
  B extends ScopedBadge,
  T extends FacetedTemplate
>(badges: readonly B[], scopedTemplates: readonly T[]): B[] {
  if (badges.length === 0) return [...badges]
  const available = new Map<string, Set<string>>([
    ['model', new Set(scopedTemplates.flatMap((t) => t.models ?? []))],
    ['tag', new Set(scopedTemplates.flatMap((t) => t.tags ?? []))]
  ])
  return badges.filter((b) => {
    const values = available.get(b.type)
    return values ? values.has(b.value) : true
  })
}
