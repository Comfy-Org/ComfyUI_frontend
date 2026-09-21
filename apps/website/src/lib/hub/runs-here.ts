import { workshopModels } from '../../config/workshop-browse-content'
import { getRouterWorkshopModelDetail } from '../../config/workshop-router-content'
import hubTemplateDetails from '../../data/hubTemplateDetails.json'
import { partnerModelFor } from './template-use-case'
import type { HubTemplate, HubTemplateDetails } from './types'
import { hubTemplateDetailsSchema } from './types'

const details: HubTemplateDetails =
  hubTemplateDetailsSchema.parse(hubTemplateDetails)

/**
 * A workflow belongs in the Hub only if this page can run it as it stands: one
 * call to a model the Router carries, nothing to install and nothing to
 * download. That is what puts a form and a Run button under every card, and it
 * is why no card here has to warn a reader about custom nodes.
 */
export function runsHere(template: HubTemplate): boolean {
  const model = partnerModelFor(template, workshopModels)
  if (!model || !getRouterWorkshopModelDetail(model.slug)) return false
  const detail = details[template.name] ?? {}
  return (detail.requiresCustomNodes ?? []).length === 0 && !detail.size
}
