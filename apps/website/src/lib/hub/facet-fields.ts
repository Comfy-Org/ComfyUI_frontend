import type { WorkshopModel } from '../../config/workshop'
import { partnerModelFor } from './template-use-case'
import type { HubTemplate } from './types'

export type FacetedTemplate = HubTemplate & {
  readonly partner?: string
}

export function withFacetFields(
  template: HubTemplate,
  models: readonly WorkshopModel[]
): FacetedTemplate {
  return {
    ...template,
    partner: partnerModelFor(template, models)?.provider
  }
}
