import type { WorkshopModel } from '../../config/models-catalogue'
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
    // Ten registry titles carry a stray leading or trailing space, which reads
    // as a blank first character and sorts ahead of every digit and letter.
    title: template.title.trim(),
    partner: partnerModelFor(template, models)?.provider
  }
}
