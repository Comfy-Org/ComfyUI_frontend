import {
  evaluatePricingContext,
  normalizeWidgetValue
} from '@comfyorg/shared-frontend-utils/nodePricing'

import pricingJson from '../data/workshop-node-pricing.json'
import publishedPricingJson from '../data/workshop-published-pricing.json'
import type { UseCase, WorkshopModel } from './models-catalogue'
import {
  workshopNodePricingSchema,
  workshopPublishedPricingSchema
} from './workshop-node-pricing.schema'

const rules = workshopNodePricingSchema.parse(pricingJson)
const published = new Map(
  Object.entries(
    workshopPublishedPricingSchema.parse(publishedPricingJson).models
  )
)

export async function estimateWorkshopNodePrice(
  model: Pick<WorkshopModel, 'routerId'>,
  useCase: UseCase | undefined
): Promise<string | undefined> {
  if (!useCase) return
  const rule = rules.find(
    (row) =>
      row.routerId === model.routerId &&
      (!row.useCases || row.useCases.includes(useCase))
  )
  if (!rule) {
    const rate = published.get(model.routerId)
    if (rate?.useCases.some((operation) => operation === useCase))
      return `${rate.creditsPerRun} credits/Run`
    return
  }
  const { priceBadge } = rule
  const withImage = useCase === 'edit-images' || useCase === 'animate-images'
  const widgets = Object.fromEntries(
    priceBadge.depends_on.widgets.map((dep) => [
      dep.name,
      normalizeWidgetValue(rule.widgets[dep.name], dep.type)
    ])
  )
  if (Object.values(widgets).some((value) => value === null)) return
  const label = await evaluatePricingContext(
    `${rule.nodeType}:${rule.sourceCommit}`,
    priceBadge,
    {
      widgets,
      inputs: Object.fromEntries(
        priceBadge.depends_on.inputs.map((name) => [
          name,
          { connected: withImage }
        ])
      ),
      inputGroups: Object.fromEntries(
        priceBadge.depends_on.input_groups.map((name) => [
          name,
          withImage ? 1 : 0
        ])
      )
    }
  )
  return label || undefined
}
