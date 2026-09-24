import type { Locale } from '../../i18n/translations'
import type { WorkshopModel } from '../../config/models-catalogue'
import type { CardView } from './catalogue-card'
import { cardViewFor } from './catalogue-card'
import type { FacetedTemplate } from './facet-fields'
import { withFacetFields } from './facet-fields'
import { partnerModelFor } from './template-use-case'
import type { HubTemplate } from './types'
import { hubTemplatesSchema } from './types'
import { taskLabelFor } from '../workshop/task-label'

/** What one operation costs to run, as the Router prices it. */
export type PriceOf = (model: WorkshopModel) => Promise<string | undefined>

/** One row per operation on a model page: what it does and what it costs. */
export interface PricedOperation {
  readonly model: WorkshopModel
  readonly task: string
  readonly price: string | undefined
}

/** The registry's templates, validated and read against the catalogue. */
export function facetedTemplates(
  raw: unknown,
  models: readonly WorkshopModel[]
): readonly FacetedTemplate[] {
  return hubTemplatesSchema
    .parse(raw)
    .map((template) => withFacetFields(template, models))
}

/** A detail page's related strip draws the same cards as the grid. */
export function relatedCardViews(
  templates: readonly HubTemplate[],
  models: readonly WorkshopModel[]
): readonly CardView[] {
  return templates.map((template) =>
    cardViewFor(
      {
        kind: 'workflow',
        key: template.name,
        template: withFacetFields(template, models),
        runsOn: partnerModelFor(template, models)
      },
      models
    )
  )
}

/**
 * The Router prices one operation at a time and leaves some unpriced. The grid
 * looks a price up by slug, so an operation without one is absent rather than
 * present and empty.
 */
export async function priceBySlug(
  models: readonly WorkshopModel[],
  priceOf: PriceOf
): Promise<ReadonlyMap<string, string>> {
  const priced = await Promise.all(
    models.map(async (model) => [model.slug, await priceOf(model)] as const)
  )
  return new Map(
    priced.filter((entry): entry is readonly [string, string] =>
      Boolean(entry[1])
    )
  )
}

/** The operations a model page offers, each with its task and its price. */
export async function pricedOperations(
  operations: readonly WorkshopModel[],
  priceOf: PriceOf,
  locale: Locale = 'en'
): Promise<readonly PricedOperation[]> {
  return Promise.all(
    operations.map(async (model) => ({
      model,
      task: taskLabelFor(model, locale),
      price: await priceOf(model)
    }))
  )
}
