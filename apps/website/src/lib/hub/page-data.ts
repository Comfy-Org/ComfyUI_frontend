import type { WorkshopModel } from '../../config/models-catalogue'
import type { CardView } from './catalogue-card'
import { cardViewFor } from './catalogue-card'
import { withFacetFields } from './facet-fields'
import { partnerModelFor } from './template-use-case'
import type { HubTemplate, HubTemplateDetails } from './types'

/** Workflows whose registry entry names at least one custom node. */
export function customNodeNames(
  details: HubTemplateDetails
): ReadonlySet<string> {
  return new Set(
    Object.entries(details)
      .filter(([, detail]) => (detail.requiresCustomNodes?.length ?? 0) > 0)
      .map(([name]) => name)
  )
}

/**
 * A detail page's related strip draws the same cards as the grid, so it reads
 * the same requirements: a card that hides its custom nodes here would promise
 * an install the grid warned about.
 */
export function relatedCardViews(
  templates: readonly HubTemplate[],
  models: readonly WorkshopModel[],
  needsCustomNodes: ReadonlySet<string>
): readonly CardView[] {
  return templates.map((template) =>
    cardViewFor(
      {
        kind: template.isApp ? 'app' : 'workflow',
        key: template.name,
        template: withFacetFields(template, models),
        runsOn: partnerModelFor(template, models)
      },
      needsCustomNodes,
      new Map<string, string>()
    )
  )
}
